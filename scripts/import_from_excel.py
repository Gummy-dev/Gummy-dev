"""
import_from_excel.py
Excel 파일(V1_ 시트 형식)을 읽어 현재 코드 데이터와 병합 후 JSON을 생성합니다.
실행: python3 scripts/import_from_excel.py
입력: 멸망했는데_바쁨_데이터_현재.xlsx  (V1_생존자카드 / V1_지도자 카드 / V1_이벤트 카드)
출력: src/data/survivors_from_excel.json
      src/data/leaders_from_excel.json
      src/data/events_from_excel.json

병합 전략:
  - Excel에 있는 필드(이름·속성·점수·영입비용·장수·자원·효과·설명 등)는 Excel 값이 우선
  - Excel에 없는 필드(emoji·triggers·partyPassive·color 등)는 코드 원본을 유지
  - 이벤트 resolution/reward/failPenalty/globalEffect 는 요약 텍스트만 업데이트됨
    (실제 게임 로직은 events.js 에서 직접 수정해야 합니다)
"""

import json
import subprocess
import sys
from pathlib import Path
from openpyxl import load_workbook

ROOT    = Path(__file__).parent.parent
SCRIPTS = Path(__file__).parent
XL_FILE = ROOT / "멸망했는데_바쁨_데이터_현재.xlsx"
OUT_DIR = ROOT / "src" / "data"


# ─── 유틸 ────────────────────────────────────────────────────────

def safe(val):
    if val is None:
        return ""
    s = str(val).strip()
    return "" if s in ("None", "nan", "none") else s


def one_line(val):
    return " ".join(safe(val).split())


def safe_int(val, default=0):
    try:
        return int(float(str(val)))
    except (TypeError, ValueError):
        return default


def safe_float(val):
    try:
        return float(str(val))
    except (TypeError, ValueError):
        return None




TYPE_TOKEN_ALIASES = {
    "반": "반장",
    "반장": "반장",
    "군기반장": "반장",
    "용": "용감이",
    "용감이": "용감이",
    "돌격대장": "용감이",
    "분": "분위기메이커",
    "분위기메이커": "분위기메이커",
    "4": "4차원",
    "4차원": "4차원",
    "겁": "겁쟁이",
    "겁쟁이": "겁쟁이",
}


def parse_type_entries(text):
    if not text:
        return []
    import re
    source = str(text)
    counts = {}
    for token in re.findall(r"\(([^)]+)\)", source):
        clean = token.strip()
        if clean == "상대":
            continue
        type_ = TYPE_TOKEN_ALIASES.get(clean)
        if type_:
            counts[type_] = counts.get(type_, 0) + 1
    for label, type_ in TYPE_TOKEN_ALIASES.items():
        if len(label) <= 1:
            continue
        # 괄호 표기는 위에서 처리했으므로 일반 텍스트만 세고, 이미 괄호 안에 있던 것은 제거 후 계산한다.
        plain = re.sub(r"\([^)]*\)", " ", source)
        matches = re.findall(re.escape(label), plain)
        if matches:
            counts[type_] = counts.get(type_, 0) + len(matches)
    return [{"type": type_, "count": count} for type_, count in counts.items()]


def parse_generic_survivor_count(text):
    if not text:
        return None
    import re
    source = str(text)
    counts = []
    for match in re.finditer(r"생존자\s*(\d+)", source):
        after = source[match.end():match.end()+8]
        if "상대" in after:
            continue
        counts.append(int(match.group(1)))
    return max(counts) if counts else None


def parse_type_bonus(text):
    if not text:
        return None
    import re
    bonus_match = re.search(r"\+?\s*(\d+)", str(text))
    return int(bonus_match.group(1)) if bonus_match else None


def parse_resources(text):
    """'병뚜껑+1 / 통조림-1' → {bottleCap, can}"""
    if not text:
        return None
    import re
    result = {}
    for part in str(text).split("/"):
        part = part.strip()
        m = re.search(r"병뚜껑([+-]\d+)", part)
        if m:
            result["bottleCap"] = int(m.group(1))
        m = re.search(r"통조림([+-]\d+)", part)
        if m:
            result["can"] = int(m.group(1))
    return result or None


def parse_tier(text):
    """'1단계' / '단계 2' → 1 | 2 | 3"""
    if not text:
        return None
    import re
    match = re.search(r"[123]", str(text))
    return int(match.group(0)) if match else None


def parse_reactivation_cost(text):
    """'통조림 1' / '통조림+1' → {can: 1}"""
    if not text:
        return None
    import re
    result = {}
    source = str(text)
    can = re.search(r"통조림\s*([+-]?\d+)", source)
    if can:
        result["can"] = abs(int(can.group(1)))
    bottle_cap = re.search(r"병뚜껑\s*([+-]?\d+)", source)
    if bottle_cap:
        result["bottleCap"] = abs(int(bottle_cap.group(1)))
    return result or None


PLAIN_SURVIVOR_ROWS = [
    ("s_plain_coward", "겁쟁이", 4, "뒤쪽(4-5번) 배치 시 식사 비용 무료"),
    ("s_plain_mood", "분위기메이커", 3, "중앙(3번) 배치 시 추가 수색 비용 🥫-1"),
    ("s_plain_charge", "용감이", 2, "앞쪽(1-2번) 배치 시 탐색 타입 보너스 +1"),
    ("s_plain_military", "반장", 2, "앞쪽(1-2번) 배치 시 순서 변경 비용 🪙-1"),
    ("s_plain_weird", "4차원", 1, ""),
]


def split_normal_survivors_by_tier(survivors):
    """예전 평범 타입 행을 제거하고 1단계 타입별 평범생존자 12장으로 확장."""
    if any(s.get("id", "").startswith("s_plain_") for s in survivors):
        return survivors

    normal = next((s for s in survivors if s.get("id") in ("s_normal_1", "s_normal_2", "s_normal_3")), None)
    if not normal:
        return survivors

    result = [s for s in survivors if s.get("id") not in ("s_normal_1", "s_normal_2", "s_normal_3")]
    for id_, type_, count, bonus in PLAIN_SURVIVOR_ROWS:
        clone = {**normal}
        clone["id"] = id_
        clone["name"] = "평범생존자"
        clone["type"] = type_
        clone["score"] = 0
        clone["recruitCost"] = 3
        clone["effect"] = "특별한 고유기능 없음"
        clone["description"] = "특별한 점은 없지만 그래서 어디든 잘 섞입니다."
        clone["emoji"] = "🧑"
        clone["count"] = count
        clone["tier"] = 1
        clone["searchTier"] = 1
        clone["reactivationCost"] = {"can": 1}
        if bonus:
            clone["specialBonus"] = bonus
        else:
            clone.pop("specialBonus", None)
        result.append(clone)
    return result


SURVIVOR_RECRUIT_COST_BY_ID = {
    # 1단계: 평범생존자 전용 기본 비용
    "s_plain_coward": 3,
    "s_plain_mood": 3,
    "s_plain_charge": 3,
    "s_plain_military": 3,
    "s_plain_weird": 3,

    # 2단계: 5~6
    "s_weird_1": 5,
    "s_coward_1": 5,
    "s_coward_6": 5,
    "s_coward_3": 5,
    "s_mood_1": 5,
    "s_mood_twins": 5,
    "s_charge_2": 5,
    "s_charge_4": 5,
    "s_coward_twins": 5,
    "s_mood_4": 5,
    "s_charge_5": 5,
    "s_weird_6": 6,
    "s_coward_2": 6,
    "s_military_1": 6,
    "s_military_2": 6,
    "s_military_3": 6,
    "s_mood_3": 6,
    "s_charge_6": 6,

    # 3단계: 7~8
    "s_weird_7": 7,
    "s_military_5": 7,
    "s_mood_5": 7,
    "s_weird_5": 7,
    "s_weird_3": 7,
    "s_coward_5": 7,
    "s_mood_2": 7,
    "s_charge_1": 7,
    "s_weird_2": 8,
    "s_weird_4": 8,
    "s_military_6": 8,
    "s_charge_3": 8,
}


SURVIVOR_TIER_BY_ID = {
    "s_plain_coward": 1,
    "s_plain_mood": 1,
    "s_plain_charge": 1,
    "s_plain_military": 1,
    "s_plain_weird": 1,
    "s_weird_1": 2,
    "s_coward_1": 2,
    "s_coward_6": 2,
    "s_coward_3": 2,
    "s_mood_1": 2,
    "s_mood_twins": 2,
    "s_charge_2": 2,
    "s_charge_4": 2,
    "s_weird_7": 3,
    "s_military_5": 3,
    "s_mood_5": 3,
}

def rebalance_survivor_recruit_costs(survivors):
    """수색 단계별 경제 밴드: 1단계 3~4, 2단계 5~6, 3단계 7~8."""
    for survivor in survivors:
        tier_override = SURVIVOR_TIER_BY_ID.get(survivor.get("id"))
        if tier_override:
            survivor["tier"] = tier_override
            survivor["searchTier"] = tier_override
            survivor["reactivationCost"] = {"can": tier_override}

        explicit = SURVIVOR_RECRUIT_COST_BY_ID.get(survivor.get("id"))
        if explicit:
            survivor["recruitCost"] = explicit
            continue

        tier = survivor.get("tier") or survivor.get("searchTier") or 1
        low = {1: 3, 2: 5, 3: 7}.get(tier, 3)
        high = low + 1
        survivor["recruitCost"] = high if (survivor.get("score") or 0) >= 2 else low
    return survivors


def dump_current_data():
    """Node.js로 현재 코드 데이터 덤프"""
    result = subprocess.run(
        ["node", "scripts/dump_data_to_json.mjs"],
        cwd=str(ROOT), capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("❌ 코드 데이터 덤프 실패:", result.stderr)
        sys.exit(1)

    survivors = json.loads((SCRIPTS / "_dump_survivors.json").read_text("utf-8"))
    leaders   = json.loads((SCRIPTS / "_dump_leaders.json").read_text("utf-8"))
    events    = json.loads((SCRIPTS / "_dump_events.json").read_text("utf-8"))
    return (
        {s["id"]: s for s in survivors},
        {l["id"]: l for l in leaders},
        {e["id"]: e for e in events},
    )


# ─── V1_생존자카드 읽기 ───────────────────────────────────────────

def read_survivors(ws, base_map):
    """
    헤더: 행3 (넘버·카드종류·카드이미지·이름·속성·점수·영입비용·장수·겹침그룹키·턴시작자원·턴종료자원·캐릭터고유효과·타입효과·캐릭터설명)
    데이터: 행4~
    """
    # 컬럼 위치를 헤더에서 파악
    header_row = [safe(c.value) for c in ws[3]]

    def col(name_fragments):
        """헤더에서 가장 일치하는 컬럼 인덱스 반환"""
        for i, h in enumerate(header_row):
            clean = h.replace("\n", "").replace(" ", "")
            if any(f in clean for f in name_fragments):
                return i
        return None

    IDX = {
        "id":       col(["넘버", "ID"]),
        "tier":     col(["단계"]),
        "kind":     col(["카드종류"]),
        "name":     col(["이름"]),
        "type":     col(["속성"]),
        "emoji":    col(["이모지", "카드이미지"]),
        "score":    col(["점수"]),
        "recruit":  col(["영입비용"]),
        "count":    col(["장수"]),
        "stack":    col(["겹침그룹키", "겹침"]),
        "reactivation": col(["활성화요구통조림량", "활성화요구", "재활성화"]),
        "ts":       col(["턴시작자원", "턴시작"]),
        "te":       col(["턴종료자원", "턴종료"]),
        "effect":   col(["기본기능", "캐릭터고유효과", "고유효과"]),
        "bonus":    col(["배치보너스", "타입효과", "타입"]),
        "desc":     col(["캐릭터설명", "설명"]),
    }

    def cell(row, key):
        i = IDX.get(key)
        return safe(row[i]) if i is not None and i < len(row) else ""

    # 행별로 파싱 (중복 ID 처리: count 계산용으로 그룹핑)
    rows_by_id = {}
    for row in ws.iter_rows(min_row=4, values_only=True):
        id_ = cell(row, "id")
        if not id_ or not id_.startswith("s_"):
            continue
        rows_by_id.setdefault(id_, []).append(row)

    result = []
    for id_, rows in rows_by_id.items():
        row = rows[0]  # 첫 번째 행 기준

        # count: 장수 컬럼 우선, 없으면 동일 ID 행 수
        count_raw = safe_float(cell(row, "count"))
        count = int(count_raw) if count_raw else len(rows)

        # score: float 변환 실패 시 — 평범은 1, 나머지 0
        score_raw = cell(row, "score")
        score_f   = safe_float(score_raw)
        if score_f is not None:
            score = int(score_f)
        else:
            score = 0

        recruit_raw = safe_float(cell(row, "recruit"))
        recruit = int(recruit_raw) if recruit_raw else 0

        stack = cell(row, "stack")
        tier  = parse_tier(cell(row, "tier"))
        reactivation = parse_reactivation_cost(cell(row, "reactivation"))
        ts    = parse_resources(cell(row, "ts"))
        te    = parse_resources(cell(row, "te"))

        # 코드 원본에서 보존할 필드
        base = base_map.get(id_, {})

        merged = {**base}  # 코드 원본으로 시작

        # Excel 필드 덮어쓰기
        merged["id"]    = id_
        merged["name"]  = one_line(cell(row, "name")) or base.get("name", "")
        merged["type"]  = one_line(cell(row, "type")) or base.get("type", "")
        merged["score"] = score
        merged["count"] = count

        if recruit:
            merged["recruitCost"] = recruit
        elif "recruitCost" in merged and recruit == 0:
            del merged["recruitCost"]  # 0이면 제거

        if stack and not stack.replace(".", "").isdigit():
            merged["stackKey"] = stack
        elif "stackKey" in merged and not stack:
            del merged["stackKey"]

        if tier:
            merged["tier"] = tier
            merged["searchTier"] = tier

        if reactivation:
            merged["reactivationCost"] = reactivation
        elif "reactivationCost" in merged and cell(row, "reactivation") == "":
            del merged["reactivationCost"]

        if ts:
            merged["turnStartResources"] = ts
        elif "turnStartResources" in merged and not ts:
            del merged["turnStartResources"]

        if te:
            merged["turnEndResources"] = te
        elif "turnEndResources" in merged and not te:
            del merged["turnEndResources"]

        effect = cell(row, "effect")
        bonus  = cell(row, "bonus")
        desc   = cell(row, "desc")
        if effect: merged["effect"]      = effect
        if bonus and "이벤트 행동" not in bonus:
            merged["specialBonus"] = bonus
        else:
            merged.pop("specialBonus", None)
        emoji = cell(row, "emoji")
        if emoji:  merged["emoji"] = emoji
        if desc:   merged["description"] = desc

        result.append(merged)

    return rebalance_survivor_recruit_costs(split_normal_survivors_by_tier(result))


# ─── V1_지도자 카드 읽기 ─────────────────────────────────────────

def read_leaders(ws, base_map):
    """
    헤더: 행3 (ID·카드이미지·풀네임·속성·점수·파티최대·시작병뚜껑·시작통조림·수입통조림·수입병뚜껑·고유스킬이름·고유스킬설명·특수승리조건명·특수승리조건·캐릭터설명)
    데이터: 행4~
    """
    header_row = [safe(c.value) for c in ws[3]]

    def col(frags):
        for i, h in enumerate(header_row):
            clean = h.replace("\n", "").replace(" ", "").replace("_x000a_", "")
            if any(f in clean for f in frags):
                return i
        return None

    IDX = {
        "id":        col(["ID", "넘버"]),
        "fullName":  col(["풀네임"]),
        "type":      col(["속성"]),
        "score":     col(["점수"]),
        "party":     col(["파티최대"]),
        "init_bc":   col(["시작병뚜껑"]),
        "init_can":  col(["시작통조림"]),
        "pass_can":  col(["수입통조림"]),
        "pass_bc":   col(["수입병뚜껑"]),
        "skill_nm":  col(["지도자스킬", "고유스킬이름", "스킬이름"]),
        "skill_desc":col(["지도자스킬설명", "고유스킬설명", "스킬설명"]),
        "win_nm":    col(["특수승리조건명"]),
        "win_desc":  col(["특수승리조건"]),
        "desc":      col(["캐릭터설명"]),
    }

    if IDX["win_desc"] == IDX["win_nm"]:
        for i, h in enumerate(header_row):
            clean = h.replace("\n", "").replace(" ", "").replace("_x000a_", "")
            if clean == "특수승리조건":
                IDX["win_desc"] = i
                break

    def cell(row, key):
        i = IDX.get(key)
        return safe(row[i]) if i is not None and i < len(row) else ""

    result = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        id_ = cell(row, "id")
        if not id_ or id_ not in base_map:
            continue

        base = base_map[id_]
        merged = {**base}

        score = safe_float(cell(row, "score"))

        merged["fullName"]    = cell(row, "fullName") or base.get("fullName", "")
        merged["type"]        = cell(row, "type")    or base.get("type", "")
        merged["score"]       = int(score) if score is not None else base.get("score", 0)
        merged.pop("actionCount", None)
        merged.pop("recruitCount", None)
        merged["maxPartySize"]= safe_int(cell(row, "party"), base.get("maxPartySize", 5))

        init_bc  = safe_int(cell(row, "init_bc"),  base.get("initialResources", {}).get("bottleCap", 0))
        init_can = safe_int(cell(row, "init_can"), base.get("initialResources", {}).get("can", 0))
        pass_can = safe_int(cell(row, "pass_can"), base.get("passiveIncome", {}).get("can", 0))
        pass_bc  = safe_int(cell(row, "pass_bc"),  base.get("passiveIncome", {}).get("bottleCap", 0))
        merged["initialResources"] = {"bottleCap": init_bc, "can": init_can}
        merged["passiveIncome"]    = {"can": pass_can, "bottleCap": pass_bc}

        skill_nm   = cell(row, "skill_nm")
        skill_desc = cell(row, "skill_desc")
        win_nm     = cell(row, "win_nm")
        win_desc   = cell(row, "win_desc")
        desc       = cell(row, "desc")

        if skill_nm or skill_desc:
            merged["uniqueSkill"] = {
                **base.get("uniqueSkill", {}),
                "name":        skill_nm  or base.get("uniqueSkill", {}).get("name", ""),
                "description": skill_desc or base.get("uniqueSkill", {}).get("description", ""),
            }
        if win_nm or win_desc:
            merged["specialWin"] = {
                "name":        win_nm   or base.get("specialWin", {}).get("name", ""),
                "description": win_desc or base.get("specialWin", {}).get("description", ""),
            }
        if desc:
            merged["description"] = desc

        # name: fullName 에서 / 뒤쪽 추출
        fn = merged.get("fullName", "")
        merged["name"] = fn.split("/")[-1].strip() if "/" in fn else base.get("name", "")

        result.append(merged)

    return result


# ─── V1_이벤트 카드 읽기 ─────────────────────────────────────────

def read_events(ws, base_map):
    """
    헤더: 행3 (ID·이모지·이름·범위·카테고리·장수·설명·해결조건·보상·실패패널티·전체효과)
    데이터: 행4~
    NOTE: resolution/reward/failPenalty/globalEffect 는 요약 텍스트입니다.
          실제 게임 로직 구조체는 events.js 에서 직접 수정하세요.
    """
    header_row = [safe(c.value) for c in ws[3]]

    def col(frags):
        for i, h in enumerate(header_row):
            clean = h.replace("\n", "").replace(" ", "")
            if any(f in clean for f in frags):
                return i
        return None

    IDX = {
        "id":     col(["ID"]),
        "emoji":  col(["이모지"]),
        "name":   col(["이름"]),
        "scope":  col(["범위"]),
        "cat":    col(["카테고리"]),
        "count":  col(["장수"]),
        "desc":   col(["설명"]),
        "condition": col(["조건"]),
        "res":    col(["해결조건"]),
        "reward": col(["보상"]),
        "recommendedTypes": col(["추천타입", "추천 타입"]),
        "typeBonus": col(["타입보너스"]),
        "fail":   col(["실패패널티"]),
        "global": col(["전체효과"]),
    }

    def cell(row, key):
        i = IDX.get(key)
        return safe(row[i]) if i is not None and i < len(row) else ""

    result = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        id_ = cell(row, "id")
        if not id_ or not id_.startswith("e_"):
            continue

        base  = base_map.get(id_, {})
        count_raw = safe_float(cell(row, "count"))
        count = int(count_raw) if count_raw else base.get("count", 1)

        merged = {**base}  # 코드 원본 유지 (resolution 구조체 등)

        # Excel에서 덮어쓸 필드
        emoji = cell(row, "emoji")
        name  = cell(row, "name")
        scope = cell(row, "scope")
        cat   = cell(row, "cat")
        desc  = cell(row, "desc")

        if emoji: merged["emoji"]    = emoji
        if name:  merged["name"]     = name
        if scope: merged["scope"]    = scope
        if cat:   merged["category"] = cat
        merged["count"] = count
        if desc:  merged["description"] = desc

        condition = cell(row, "condition")
        if condition:
            merged["_summary_condition"] = condition
            required_types = parse_type_entries(condition)
            if required_types:
                merged.pop("requiredType", None)
                merged["requiredTypes"] = required_types
                if len(required_types) == 1 and required_types[0].get("count") == 1:
                    merged["requiredType"] = required_types[0]["type"]
            generic_count = parse_generic_survivor_count(condition)
            if generic_count is not None:
                assignment = {**(merged.get("assignment") or {})}
                typed_count = sum(entry.get("count", 1) for entry in required_types)
                assignment["minSurvivors"] = max(generic_count + typed_count, typed_count or generic_count)
                assignment["maxSurvivors"] = max(assignment.get("maxSurvivors") or assignment["minSurvivors"], assignment["minSurvivors"])
                merged["assignment"] = assignment

        recommended_types = cell(row, "recommendedTypes")
        type_bonus = cell(row, "typeBonus")
        if recommended_types:
            merged["_summary_recommendedTypes"] = recommended_types
            recommended_party = parse_type_entries(recommended_types)
            if recommended_party:
                merged["recommendedParty"] = recommended_party
        elif type_bonus:
            # Backward compatibility: older sheets stored "(겁) (반) +3" in 타입보너스.
            recommended_party = parse_type_entries(type_bonus)
            if recommended_party:
                merged["recommendedParty"] = recommended_party

        if type_bonus:
            merged["_summary_typeBonus"] = type_bonus
            recommended_bonus = parse_type_bonus(type_bonus)
            if recommended_bonus is not None:
                merged["recommendedPartyBonus"] = recommended_bonus

        # 요약 텍스트는 참고용으로만 포함 (_summary_ 접두사)
        res    = cell(row, "res")
        reward = cell(row, "reward")
        fail   = cell(row, "fail")
        glob   = cell(row, "global")
        if res:    merged["_summary_resolution"]  = res
        if reward: merged["_summary_reward"]       = reward
        if fail:   merged["_summary_failPenalty"]  = fail
        if glob:   merged["_summary_globalEffect"] = glob

        result.append(merged)

    return result


# ─── 메인 ─────────────────────────────────────────────────────────

def main():
    if not XL_FILE.exists():
        print(f"❌ 파일 없음: {XL_FILE.name}")
        return

    print("📦 현재 코드 데이터 로드 중...")
    survivor_base, leader_base, event_base = dump_current_data()
    print(f"   생존자 {len(survivor_base)}개 · 지도자 {len(leader_base)}개 · 이벤트 {len(event_base)}개")

    print(f"\n📂 Excel 로드: {XL_FILE.name}")
    wb = load_workbook(XL_FILE, data_only=True)
    print(f"   시트: {wb.sheetnames}")

    # 시트 이름 매핑 (V1_ 또는 우리가 생성한 형식 모두 지원)
    def find_sheet(*candidates):
        for name in candidates:
            if name in wb.sheetnames:
                return wb[name]
        return None

    survivor_ws = find_sheet("V1_생존자카드", "생존자")
    leader_ws   = find_sheet("V1_지도자 카드")
    event_ws    = find_sheet("V1_이벤트 카드", "이벤트")

    print()

    if survivor_ws:
        data = read_survivors(survivor_ws, survivor_base)
        out  = OUT_DIR / "survivors_from_excel.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ 생존자 {len(data)}명 → {out.relative_to(ROOT)}")
    else:
        print("⚠️  생존자 시트 없음")

    if leader_ws:
        data = read_leaders(leader_ws, leader_base)
        out  = OUT_DIR / "leaders_from_excel.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ 지도자 {len(data)}명 → {out.relative_to(ROOT)}")
    else:
        print("⚠️  지도자 시트 없음")

    if event_ws:
        data = read_events(event_ws, event_base)
        out  = OUT_DIR / "events_from_excel.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"✅ 이벤트 {len(data)}개 → {out.relative_to(ROOT)}")
    else:
        print("⚠️  이벤트 시트 없음")

    print()
    print("💡 다음 단계:")
    print("   JSON 파일을 검토한 뒤 src/data/*.js 에 반영하세요.")
    print("   ⚠️  이벤트 _summary_* 필드는 참고용입니다. resolution 구조체는 events.js 직접 수정 필요.")


if __name__ == "__main__":
    main()
