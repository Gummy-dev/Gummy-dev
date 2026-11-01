"""
sync_excel.py
코드(survivors.js / leaders.js / events.js) 데이터를
기존 Excel 파일(멸망했는데_바쁨_데이터_현재.xlsx)의 V1_ 시트에 덮어씁니다.

실행: python3 scripts/sync_excel.py
입력: scripts/_dump_*.json  (Node.js dump)
수정: 멸망했는데_바쁨_데이터_현재.xlsx → V1_생존자카드, V1_지도자 카드, V1_이벤트 카드

변경되는 열만 업데이트하며, 카드 이미지·기획완료·콘티 등 나머지 열은 그대로 보존합니다.
"""

import json
import subprocess
import sys
from pathlib import Path
from openpyxl import load_workbook

ROOT    = Path(__file__).parent.parent
SCRIPTS = Path(__file__).parent
XL_FILE = ROOT / "멸망했는데_바쁨_데이터_현재.xlsx"


# ─── 유틸 ────────────────────────────────────────────────────────

def dump_current_data():
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
    return survivors, leaders, events


def fmt_resources(r):
    if not r:
        return ""
    parts = []
    if r.get("bottleCap"):
        parts.append(f"병뚜껑{r['bottleCap']:+d}")
    if r.get("can"):
        parts.append(f"통조림{r['can']:+d}")
    return " / ".join(parts)


def fmt_tier(tier):
    return f"{tier}단계" if tier in (1, 2, 3) else ""


def fmt_reactivation_cost(cost):
    if not cost:
        return ""
    if isinstance(cost, int):
        return f"통조림 {cost}"
    parts = []
    if cost.get("can"):
        parts.append(f"통조림 {cost['can']}")
    if cost.get("bottleCap"):
        parts.append(f"병뚜껑 {cost['bottleCap']}")
    return " / ".join(parts)


def fmt_reward(reward):
    if not reward:
        return ""
    if isinstance(reward, dict):
        reward = [reward]
    parts = []
    for r in reward:
        label = {"can": "통조림", "cap": "병뚜껑", "score": "점수", "survivor": "생존자"}.get(r.get("type", ""), r.get("type", ""))
        parts.append(f"{label}+{r.get('amount', '')}")
    return " / ".join(parts)


def fmt_penalty(p):
    if not p:
        return ""
    t = p.get("type", "")
    a = p.get("amount", "")
    return {"remove_random": f"생존자 -{a}명", "lose_can": f"통조림 -{a}", "lose_cap": f"병뚜껑 -{a}"}.get(t, f"{t}({a})")


def fmt_resolution(res):
    if not res:
        return ""
    t = res.get("type", "")
    a = res.get("amount", "")
    labels = {
        "pay_can":             f"통조림 지불 ({a}개)",
        "pay_cap":             f"병뚜껑 지불 ({a}개)",
        "check_survivor_type": f"속성 확인: {res.get('survivorType', '')}",
        "check_survivors_n":   f"생존자 {a}명 이상",
        "remove_choice":       f"생존자 선택 제거 ({a or 1}명)",
        "remove_random":       f"생존자 무작위 제거 ({a or 1}명)",
        "send_survivor_type":  f"속성 생존자 이전: {res.get('survivorType', '')}",
        "send_survivors_n":    f"생존자 {a}명 이전",
        "take_from_party":     "타 파티 생존자 획득",
        "remove_from_party":   "타 파티 생존자 제거",
        "reorder_my_party":    "내 파티 순서 변경",
        "reorder_other_party": "타 파티 순서 변경",
        "revive_from_grave":   "무덤에서 부활",
        "steal_from_grave":    "무덤에서 획득",
        "global_effect":       "전체 효과 선택 발동",
        "roll_dice":           f"주사위 1~5개 + 추천 보너스 ≥ {res.get('target', '')}",
    }
    base = labels.get(t, t)
    then = res.get("then")
    if then:
        then_labels = {
            "take_from_party":    "→ 타 파티 생존자 획득",
            "remove_from_party":  "→ 타 파티 생존자 제거",
            "reorder_other_party":"→ 타 파티 순서 변경",
            "steal_from_grave":   "→ 무덤에서 획득",
        }
        base += f" {then_labels.get(then, then)}"
    return base


def fmt_global_effect(ge):
    if not ge:
        return ""
    t = ge.get("type", "")
    a = ge.get("amount", "")
    if t == "compound":
        return " + ".join(fmt_global_effect(e) for e in ge.get("effects", []))
    return {
        "remove_all_n":      f"모든 파티 생존자 -{a}명",
        "add_survivors_all": f"모든 파티 생존자 +{a}명",
        "lose_can_all":      f"모든 플레이어 통조림 -{a}",
        "lose_cap_all":      f"모든 플레이어 병뚜껑 -{a}",
        "gain_can_all":      f"모든 플레이어 통조림 +{a}",
        "shuffle_all_parties":"모든 파티 순서 셔플",
        "halve_can_all":     "모든 통조림 절반",
    }.get(t, f"{t}({a})")




TYPE_LABELS = {
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

TYPE_SHORT = {
    "반장": "반",
    "용감이": "용",
    "분위기메이커": "분",
    "4차원": "4",
    "겁쟁이": "겁",
}


def _event_required_types(event):
    entries = []
    if event.get("requiredType"):
        entries.append({"type": event.get("requiredType"), "count": 1})
    entries.extend(event.get("requiredTypes") or [])
    by_type = {}
    for entry in entries:
        type_ = entry.get("type")
        if not type_:
            continue
        by_type[type_] = by_type.get(type_, 0) + int(entry.get("count") or 1)
    return [{"type": type_, "count": count} for type_, count in by_type.items()]


def fmt_type_entries(entries):
    tokens = []
    for entry in entries or []:
        type_ = entry.get("type", "")
        count = int(entry.get("count") or 1)
        label = TYPE_SHORT.get(type_, type_)
        tokens.extend([f"({label})"] * count)
    return " ".join(tokens)


def fmt_condition(event):
    parts = []
    resolution = event.get("resolution") or {}
    if event.get("requiresKey") or resolution.get("requiresKey"):
        parts.append("열쇠")

    if resolution.get("type") == "shared_dispatch_reward":
        parts.extend(["생존자1", "생존자1(상대)"])
        return " + ".join(parts)
    if resolution.get("type") in ("roll_dice", "roll_dice_score_bonus", "support_roll_dice") and resolution.get("target"):
        parts.append(f"🎲{resolution.get('target')}+")

    required_types = _event_required_types(event)
    typed_count = sum(int(entry.get("count") or 1) for entry in required_types)
    min_survivors = (event.get("assignment") or {}).get("minSurvivors")
    if min_survivors and resolution.get("type") not in ("roll_dice", "roll_dice_score_bonus", "support_roll_dice"):
        generic_count = max(0, int(min_survivors) - typed_count)
        if generic_count > 0:
            parts.append(f"생존자{generic_count}")

    type_text = fmt_type_entries(required_types)
    if type_text:
        parts.append(type_text)

    if resolution.get("type") == "pay_can":
        parts.append(f"통조림-{resolution.get('amount', '')}")
    elif resolution.get("type") == "pay_cap":
        parts.append(f"병뚜껑-{resolution.get('amount', '')}")
    elif resolution.get("type") == "trade_offer":
        amount = (resolution.get("give") or {}).get("amount", 2)
        parts.append(f"통조림/병뚜껑-{amount}")
    elif resolution.get("type") == "send_survivor_type":
        parts.append(f"({TYPE_SHORT.get(resolution.get('survivorType'), resolution.get('survivorType', ''))})-1(파견)")
    elif resolution.get("type") == "send_survivors_n":
        parts.append(f"생존자{resolution.get('amount', 1)}(파견)")

    return " + ".join(str(part) for part in parts if part)


def fmt_recommended_types(event):
    recommended = event.get("recommendedParty") or []
    return fmt_type_entries(recommended)


def fmt_type_bonus(event):
    recommended = event.get("recommendedParty") or []
    if not recommended:
        return ""
    return "파견한 보너스 타입 생존자 점수 합"


def ensure_col(ws, header, label):
    found = find_col(header, label)
    if found:
        return found
    col = len(header) + 1
    ws.cell(row=3, column=col, value=label)
    header.append(label)
    return col


def find_col(header_row, *fragments):
    """헤더 행에서 키워드를 포함하는 열 인덱스(1-based) 반환"""
    for i, cell in enumerate(header_row, 1):
        if cell is None:
            continue
        clean = str(cell).replace("\n", "").replace(" ", "").replace("_x000a_", "")
        if any(f in clean for f in fragments):
            return i
    return None


# ─── V1_생존자카드 업데이트 ──────────────────────────────────────

def sync_survivors(ws, survivors):
    # 헤더는 3행
    header = [c.value for c in ws[3]]

    C = {
        "id":      find_col(header, "넘버", "ID"),
        "tier":    find_col(header, "단계"),
        "name":    find_col(header, "이름"),
        "type":    find_col(header, "속성"),
        "score":   find_col(header, "점수"),
        "recruit": find_col(header, "영입비용"),
        "count":   find_col(header, "장수"),
        "stack":   find_col(header, "겹침그룹키", "겹침"),
        "reactivation": find_col(header, "활성화요구통조림량", "활성화요구", "재활성화"),
        "ts":      find_col(header, "턴시작자원", "턴시작"),
        "te":      find_col(header, "턴종료자원", "턴종료"),
        "effect":  find_col(header, "캐릭터고유효과", "고유효과"),
        "bonus":   find_col(header, "타입효과", "타입"),
        "desc":    find_col(header, "캐릭터설명"),
    }

    s_map = {s["id"]: s for s in survivors}

    # 기존 행 업데이트
    updated_ids = set()
    for row in ws.iter_rows(min_row=4):
        id_cell = row[C["id"] - 1] if C["id"] else None
        id_ = str(id_cell.value).strip() if id_cell and id_cell.value else ""
        if not id_ or not id_.startswith("s_"):
            continue
        s = s_map.get(id_)
        if not s:
            continue

        def w(col_key, val):
            ci = C.get(col_key)
            if ci:
                row[ci - 1].value = val if val not in (None, "") else row[ci - 1].value

        score = s.get("score", 0)
        # 평범 타입은 Excel 관례상 '평범' 문자열 유지
        score_val = "평범" if s.get("type") == "평범" else (float(score) if score else "")

        w("name",   s.get("name", ""))
        w("tier",   fmt_tier(s.get("tier") or s.get("searchTier")))
        w("type",   s.get("type", ""))
        w("score",  score_val)
        w("recruit", float(s.get("recruitCost", 0)) if s.get("recruitCost") else "")
        w("count",  float(s.get("count", 1)))
        w("stack",  s.get("stackKey", "") or "")
        w("reactivation", fmt_reactivation_cost(s.get("reactivationCost")))
        w("ts",     fmt_resources(s.get("turnStartResources")))
        w("te",     fmt_resources(s.get("turnEndResources")))
        w("effect", s.get("effect", ""))
        w("bonus",  s.get("specialBonus", ""))
        w("desc",   s.get("description", ""))

        updated_ids.add(id_)

    # 신규 생존자 추가 (Excel에 없는 ID)
    new_survivors = [s for s in survivors if s["id"] not in updated_ids]
    if new_survivors:
        # 마지막 데이터 행 다음에 추가
        last_row = ws.max_row + 1
        for s in new_survivors:
            score = s.get("score", 0)
            score_val = "평범" if s.get("type") == "평범" else (float(score) if score else "")
            row_data = {
                C["id"]:     s["id"],
                C["tier"]:   fmt_tier(s.get("tier") or s.get("searchTier")),
                C["name"]:   s.get("name", ""),
                C["type"]:   s.get("type", ""),
                C["score"]:  score_val,
                C["recruit"]: float(s.get("recruitCost", 0)) if s.get("recruitCost") else "",
                C["count"]:  float(s.get("count", 1)),
                C["stack"]:  s.get("stackKey", "") or "",
                C["reactivation"]: fmt_reactivation_cost(s.get("reactivationCost")),
                C["ts"]:     fmt_resources(s.get("turnStartResources")),
                C["te"]:     fmt_resources(s.get("turnEndResources")),
                C["effect"]: s.get("effect", ""),
                C["bonus"]:  s.get("specialBonus", ""),
                C["desc"]:   s.get("description", ""),
            }
            for col, val in row_data.items():
                if col:
                    ws.cell(row=last_row, column=col, value=val)
            last_row += 1

    return len(updated_ids), len(new_survivors)


# ─── V1_지도자 카드 업데이트 ─────────────────────────────────────

def sync_leaders(ws, leaders):
    header = [c.value for c in ws[3]]

    C = {
        "id":        find_col(header, "ID", "넘버"),
        "fullName":  find_col(header, "풀네임"),
        "type":      find_col(header, "속성"),
        "score":     find_col(header, "점수"),
        "party":     find_col(header, "파티최대"),
        "init_bc":   find_col(header, "시작병뚜껑"),
        "init_can":  find_col(header, "시작통조림"),
        "pass_can":  find_col(header, "수입통조림"),
        "pass_bc":   find_col(header, "수입병뚜껑"),
        "skill_nm":  find_col(header, "고유스킬이름", "스킬이름", "병뚜껑2", "x000a"),
        "skill_desc":find_col(header, "고유스킬설명", "스킬설명"),
        "win_nm":    find_col(header, "특수승리조건명"),
        "win_desc":  find_col(header, "특수승리조건"),
        "desc":      find_col(header, "캐릭터설명"),
    }

    # skill_nm이 못 잡혔을 경우 위치 직접 탐색
    if not C["skill_nm"]:
        for i, h in enumerate(header, 1):
            if h and ("x000a" in str(h) or ("병뚜껑" in str(h) and i > 10)):
                C["skill_nm"] = i
                break

    l_map = {l["id"]: l for l in leaders}
    updated = 0

    for row in ws.iter_rows(min_row=4):
        id_cell = row[C["id"] - 1] if C["id"] else None
        id_ = str(id_cell.value).strip() if id_cell and id_cell.value else ""
        if not id_ or id_ not in l_map:
            continue
        l = l_map[id_]

        def w(col_key, val):
            ci = C.get(col_key)
            if ci:
                row[ci - 1].value = val if val not in (None,) else row[ci - 1].value

        ir = l.get("initialResources", {})
        pi = l.get("passiveIncome", {})
        sk = l.get("uniqueSkill", {})
        sw = l.get("specialWin", {})

        w("fullName",  l.get("fullName", ""))
        w("type",      l.get("type", ""))
        w("score",     float(l["score"]) if l.get("score") else "")
        w("party",     float(l.get("maxPartySize", 5)))
        w("init_bc",   float(ir.get("bottleCap", 0)))
        w("init_can",  float(ir.get("can", 0)))
        w("pass_can",  float(pi.get("can", 0)))
        w("pass_bc",   float(pi.get("bottleCap", 0)))
        w("skill_nm",  sk.get("name", ""))
        w("skill_desc",sk.get("description", ""))
        w("win_nm",    sw.get("name", ""))
        w("win_desc",  sw.get("description", ""))
        w("desc",      l.get("description", ""))

        updated += 1

    return updated


# ─── V1_이벤트 카드 업데이트 ─────────────────────────────────────

def sync_events(ws, events):
    header = [c.value for c in ws[3]]

    C = {
        "id":     find_col(header, "ID"),
        "emoji":  find_col(header, "이모지"),
        "name":   find_col(header, "이름"),
        "scope":  find_col(header, "범위"),
        "cat":    find_col(header, "카테고리"),
        "count":  find_col(header, "장수"),
        "desc":   find_col(header, "설명"),
        "condition": ensure_col(ws, header, "조건"),
        "res":    find_col(header, "해결조건"),
        "reward": find_col(header, "보상"),
        "recommendedTypes": ensure_col(ws, header, "추천 타입"),
        "typeBonus": ensure_col(ws, header, "타입보너스"),
        "fail":   find_col(header, "실패패널티"),
        "global": find_col(header, "전체효과"),
    }

    e_map = {e["id"]: e for e in events}
    updated_ids = set()

    for row in ws.iter_rows(min_row=4):
        id_cell = row[C["id"] - 1] if C["id"] else None
        id_ = str(id_cell.value).strip() if id_cell and id_cell.value else ""
        if not id_ or not id_.startswith("e_"):
            continue
        e = e_map.get(id_)
        if not e:
            continue

        def w(col_key, val):
            ci = C.get(col_key)
            if ci:
                row[ci - 1].value = val if val not in (None, "") else row[ci - 1].value

        count = e.get("count", 1)
        w("emoji",  e.get("emoji", ""))
        w("name",   e.get("name", ""))
        w("scope",  e.get("scope", ""))
        w("cat",    e.get("category", ""))
        w("count",  float(count) if count else 1.0)
        w("desc",   e.get("description", ""))
        w("condition", fmt_condition(e))
        w("res",    fmt_resolution(e.get("resolution", {})))
        w("reward", fmt_reward(e.get("reward")))
        w("recommendedTypes", fmt_recommended_types(e))
        w("typeBonus", fmt_type_bonus(e))
        w("fail",   fmt_penalty(e.get("failPenalty")))
        w("global", fmt_global_effect(e.get("globalEffect", {})))

        updated_ids.add(id_)

    # 신규 이벤트 추가
    new_events = [e for e in events if e["id"] not in updated_ids]
    if new_events:
        last_row = ws.max_row + 1
        for e in new_events:
            count = e.get("count", 1)
            row_data = {
                C["id"]:     e["id"],
                C["emoji"]:  e.get("emoji", ""),
                C["name"]:   e.get("name", ""),
                C["scope"]:  e.get("scope", ""),
                C["cat"]:    e.get("category", ""),
                C["count"]:  float(count) if count else 1.0,
                C["desc"]:   e.get("description", ""),
                C["condition"]: fmt_condition(e),
                C["res"]:    fmt_resolution(e.get("resolution", {})),
                C["reward"]: fmt_reward(e.get("reward")),
                C["recommendedTypes"]: fmt_recommended_types(e),
                C["typeBonus"]: fmt_type_bonus(e),
                C["fail"]:   fmt_penalty(e.get("failPenalty")),
                C["global"]: fmt_global_effect(e.get("globalEffect", {})),
            }
            for col, val in row_data.items():
                if col:
                    ws.cell(row=last_row, column=col, value=val)
            last_row += 1

    return len(updated_ids), len(new_events)


# ─── 메인 ─────────────────────────────────────────────────────────

def main():
    if not XL_FILE.exists():
        print(f"❌ 파일 없음: {XL_FILE.name}")
        print("   멸망했는데_바쁨_데이터_현재.xlsx 파일이 필요합니다.")
        return

    print("📦 코드 데이터 로드 중...")
    survivors, leaders, events = dump_current_data()
    print(f"   생존자 {len(survivors)}개 · 지도자 {len(leaders)}개 · 이벤트 {len(events)}개")

    print(f"\n📂 Excel 열기: {XL_FILE.name}")
    wb = load_workbook(XL_FILE)

    sheets = wb.sheetnames
    print(f"   시트: {sheets}")

    def find(name, *fallbacks):
        for n in (name, *fallbacks):
            if n in sheets:
                return wb[n]
        return None

    survivor_ws = find("V1_생존자카드")
    leader_ws   = find("V1_지도자 카드")
    event_ws    = find("V1_이벤트 카드")

    print()

    if survivor_ws:
        updated, added = sync_survivors(survivor_ws, survivors)
        print(f"✅ 생존자 — 업데이트 {updated}명" + (f", 신규 추가 {added}명" if added else ""))
    else:
        print("⚠️  V1_생존자카드 시트 없음")

    if leader_ws:
        updated = sync_leaders(leader_ws, leaders)
        print(f"✅ 지도자 — 업데이트 {updated}명")
    else:
        print("⚠️  V1_지도자 카드 시트 없음")

    if event_ws:
        updated, added = sync_events(event_ws, events)
        print(f"✅ 이벤트 — 업데이트 {updated}개" + (f", 신규 추가 {added}개" if added else ""))
    else:
        print("⚠️  V1_이벤트 카드 시트 없음")

    wb.save(XL_FILE)
    print(f"\n💾 저장 완료: {XL_FILE.name}")


if __name__ == "__main__":
    main()
