"""
export_to_excel.py
현재 코드 데이터를 Excel로 내보냅니다.
실행: python3 scripts/export_to_excel.py
출력: 멸망했는데_바쁨_데이터_현재.xlsx
"""

import json
import subprocess
import sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT    = Path(__file__).parent.parent
SCRIPTS = Path(__file__).parent
OUT_FILE = ROOT / "멸망했는데_바쁨_데이터_현재.xlsx"

# ─── 색상 상수 ─────────────────────────────────────────────────────
TYPE_COLORS = {
    "반장":       {"bg": "1E3A5F", "fg": "93C5FD"},
    "군기반장":    {"bg": "1E3A5F", "fg": "93C5FD"},
    "분위기메이커": {"bg": "4A1942", "fg": "F9A8D4"},
    "용감이":      {"bg": "14401C", "fg": "86EFAC"},
    "돌격대장":    {"bg": "14401C", "fg": "86EFAC"},
    "4차원":      {"bg": "3D3008", "fg": "FDE047"},
    "겁쟁이":     {"bg": "2D1B4E", "fg": "C4B5FD"},
    "평범":       {"bg": "1F2937", "fg": "D1D5DB"},
}
SCOPE_COLORS = {
    "personal": {"bg": "1C3040", "fg": "7DD3FC"},
    "global":   {"bg": "1C3A2A", "fg": "6EE7B7"},
    "disaster": {"bg": "3A1C1C", "fg": "FCA5A5"},
}
CAT_COLORS = {
    "resource":  "FCD34D",
    "encounter": "86EFAC",
    "attack":    "FCA5A5",
    "score":     "C4B5FD",
    "dice":      "7DD3FC",
    "clue":      "FDE68A",
}
HEADER_BG = "111827"
HEADER_FG = "F9FAFB"
ROW_ODD   = "1C2030"
ROW_EVEN  = "131720"

thin   = Side(style="thin", color="374151")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def fill(color):
    return PatternFill("solid", fgColor=color)


def hcell(cell, bg=HEADER_BG, fg=HEADER_FG):
    cell.font      = Font(bold=True, color=fg, size=9, name="Apple SD Gothic Neo")
    cell.fill      = fill(bg)
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border    = BORDER


def dcell(cell, bg=ROW_ODD, fg="E5E7EB", bold=False, halign="left"):
    cell.font      = Font(color=fg, size=9, bold=bold, name="Apple SD Gothic Neo")
    cell.fill      = fill(bg)
    cell.alignment = Alignment(horizontal=halign, vertical="top", wrap_text=True)
    cell.border    = BORDER


def col_w(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def fmt_resources(r):
    if not r:
        return ""
    parts = []
    if r.get("bottleCap"):
        parts.append(f"병뚜껑{r['bottleCap']:+d}")
    if r.get("can"):
        parts.append(f"통조림{r['can']:+d}")
    return " / ".join(parts)




TYPE_SHORT = {
    "반장": "반",
    "군기반장": "반",
    "용감이": "용",
    "돌격대장": "용",
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


def fmt_reward(reward):
    if not reward:
        return ""
    if isinstance(reward, dict):
        reward = [reward]
    parts = []
    for r in reward:
        t = r.get("type", "")
        a = r.get("amount", "")
        label = {"can": "통조림", "cap": "병뚜껑", "score": "점수", "survivor": "생존자"}.get(t, t)
        parts.append(f"{label}+{a}")
    return " / ".join(parts)


def fmt_penalty(p):
    if not p:
        return ""
    t = p.get("type", "")
    a = p.get("amount", "")
    labels = {
        "remove_random": f"생존자 -{a}명",
        "lose_can": f"통조림 -{a}",
        "lose_cap": f"병뚜껑 -{a}",
    }
    return labels.get(t, f"{t}({a})")


def fmt_resolution(res):
    if not res:
        return ""
    t = res.get("type", "")
    labels = {
        "pay_can":            f"통조림 지불 ({res.get('amount', '')}개)",
        "pay_cap":            f"병뚜껑 지불 ({res.get('amount', '')}개)",
        "check_survivor_type": f"속성 확인: {res.get('survivorType', '')}",
        "check_survivors_n":  f"생존자 {res.get('amount', '')}명 이상",
        "remove_choice":      f"생존자 선택 제거 ({res.get('amount', 1)}명)",
        "remove_random":      f"생존자 무작위 제거 ({res.get('amount', 1)}명)",
        "send_survivor_type": f"속성 생존자 이전: {res.get('survivorType', '')}",
        "send_survivors_n":   f"생존자 {res.get('amount', '')}명 이전",
        "take_from_party":    "타 파티 생존자 획득",
        "remove_from_party":  "타 파티 생존자 제거",
        "reorder_my_party":   "내 파티 순서 변경",
        "reorder_other_party":"타 파티 순서 변경",
        "revive_from_grave":  "무덤에서 부활",
        "steal_from_grave":   "무덤에서 획득",
        "global_effect":      "전체 효과 선택 발동",
        "roll_dice":          f"주사위 1~5개 + 추천 보너스 ≥ {res.get('target', '')}",
    }
    base = labels.get(t, t)
    then = res.get("then")
    if then:
        then_labels = {
            "take_from_party":   "→ 타 파티 생존자 획득",
            "remove_from_party": "→ 타 파티 생존자 제거",
            "reorder_other_party": "→ 타 파티 순서 변경",
            "steal_from_grave":  "→ 무덤에서 획득",
        }
        base += f" {then_labels.get(then, then)}"
    return base


def fmt_global_effect(ge):
    if not ge:
        return ""
    t = ge.get("type", "")
    a = ge.get("amount", "")
    labels = {
        "remove_all_n":       f"모든 파티 생존자 -{a}명",
        "add_survivors_all":  f"모든 파티 생존자 +{a}명",
        "lose_can_all":       f"모든 플레이어 통조림 -{a}",
        "lose_cap_all":       f"모든 플레이어 병뚜껑 -{a}",
        "gain_can_all":       f"모든 플레이어 통조림 +{a}",
        "shuffle_all_parties":"모든 파티 순서 셔플",
        "halve_can_all":      "모든 통조림 절반",
        "compound":           "복합 효과 (아래 참조)",
    }
    text = labels.get(t, f"{t}({a})")
    if t == "compound":
        sub = ge.get("effects", [])
        parts = [fmt_global_effect(e) for e in sub]
        text = " + ".join(parts)
    return text


# ─── 시트 생성 ──────────────────────────────────────────────────────

def make_survivors_sheet(wb, survivors):
    ws = wb.create_sheet("생존자")
    ws.sheet_view.showGridLines = False

    # Keep this aligned with docs/excel-survivor-column-layout.md and the
    # current tiered survivor-search data model.
    COLS = [
        ("id",            9,  "ID"),
        ("tier",          6,  "단계"),
        ("type",         10,  "속성"),
        ("emoji",         5,  "이모지"),
        ("name",         14,  "이름"),
        ("score",         5,  "점수"),
        ("recruitCost",   7,  "영입\n비용"),
        ("count",         5,  "장수"),
        ("effect",       42,  "기본 기능"),
        ("description",  36,  "캐릭터 설명"),
        ("specialBonus", 32,  "배치 보너스"),
        ("stackKey",      9,  "겹침\n그룹키"),
        ("triggers",      9,  "트리거\n(코드)"),
        ("memo",         16,  "메모"),
        ("printColumnGroup", 7, "1열"),
    ]

    ws.row_dimensions[1].height = 30
    for i, (_, w, label) in enumerate(COLS, 1):
        c = ws.cell(row=1, column=i, value=label)
        hcell(c)
        ws.column_dimensions[get_column_letter(i)].width = w

    for ri, s in enumerate(survivors, 2):
        type_ = s.get("type", "")
        tc  = TYPE_COLORS.get(type_, {"bg": ROW_EVEN, "fg": "E5E7EB"})
        bg  = ROW_ODD if ri % 2 == 0 else ROW_EVEN
        ws.row_dimensions[ri].height = 62

        has_t = bool(s.get("triggers"))

        row = [
            s.get("id", ""),
            s.get("tier", s.get("searchTier", "")),
            type_,
            s.get("emoji", ""),
            s.get("name", ""),
            s.get("score", 0),
            s.get("recruitCost", 0),
            s.get("count", 1),
            s.get("effect", ""),
            s.get("description", ""),
            s.get("specialBonus", ""),
            s.get("stackKey") or "",
            "O" if has_t else "",
            s.get("memo", ""),
            s.get("printColumnGroup", ""),
        ]

        for ci, val in enumerate(row, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            key  = COLS[ci-1][0]
            if key == "type":
                dcell(cell, bg=tc["bg"], fg=tc["fg"], bold=True, halign="center")
            elif key in ("tier", "score", "recruitCost", "count"):
                dcell(cell, bg=bg, fg="FCD34D", bold=True, halign="center")
            elif key in ("id", "stackKey", "triggers", "memo", "printColumnGroup"):
                dcell(cell, bg=bg, fg="6B7280", halign="center")
            elif key == "emoji":
                dcell(cell, bg=bg, fg="FFFFFF", halign="center")
            elif key == "name":
                dcell(cell, bg=bg, fg="F9FAFB", bold=True)
            else:
                dcell(cell, bg=bg)

    ws.freeze_panes = "E2"

def make_leaders_sheet(wb, leaders):
    ws = wb.create_sheet("지도자")
    ws.sheet_view.showGridLines = False

    COLS = [
        ("id",           8,  "ID"),
        ("emoji",        5,  "이모지"),
        ("fullName",    17,  "풀네임"),
        ("type",        10,  "속성"),
        ("score",        5,  "점수"),
        ("maxPartySize", 7,  "파티\n최대"),
        ("init_bc",      9,  "시작\n병뚜껑"),
        ("init_can",     9,  "시작\n통조림"),
        ("pass_can",     8,  "수입\n통조림"),
        ("pass_bc",      8,  "수입\n병뚜껑"),
        ("skill_name",  13,  "고유 스킬\n이름"),
        ("skill_desc",  36,  "고유 스킬 설명"),
        ("win_name",    13,  "특수 승리\n조건명"),
        ("win_desc",    30,  "특수 승리 조건"),
        ("description", 34,  "캐릭터 설명"),
        ("color",        9,  "테마색"),
    ]

    ws.row_dimensions[1].height = 30
    for i, (_, w, label) in enumerate(COLS, 1):
        c = ws.cell(row=1, column=i, value=label)
        hcell(c)
        ws.column_dimensions[get_column_letter(i)].width = w

    for ri, l in enumerate(leaders, 2):
        type_ = l.get("type", "")
        tc = TYPE_COLORS.get(type_, {"bg": ROW_EVEN, "fg": "E5E7EB"})
        bg = ROW_ODD if ri % 2 == 0 else ROW_EVEN
        ws.row_dimensions[ri].height = 55

        ir = l.get("initialResources", {})
        pi = l.get("passiveIncome", {})
        sk = l.get("uniqueSkill", {})
        sw = l.get("specialWin", {})

        row = [
            l.get("id", ""),
            l.get("emoji", ""),
            l.get("fullName", ""),
            type_,
            l.get("score", 0),
            l.get("maxPartySize", 5),
            ir.get("bottleCap", 0),
            ir.get("can", 0),
            pi.get("can", 0),
            pi.get("bottleCap", 0),
            sk.get("name", ""),
            sk.get("description", ""),
            sw.get("name", ""),
            sw.get("description", ""),
            l.get("description", ""),
            l.get("color", ""),
        ]

        for ci, val in enumerate(row, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            key  = COLS[ci-1][0]
            if key == "type":
                dcell(cell, bg=tc["bg"], fg=tc["fg"], bold=True, halign="center")
            elif key in ("score", "maxPartySize",
                         "init_bc", "init_can", "pass_can", "pass_bc"):
                dcell(cell, bg=bg, fg="FCD34D", bold=True, halign="center")
            elif key == "id":
                dcell(cell, bg=bg, fg="6B7280", halign="center")
            elif key == "emoji":
                dcell(cell, bg=bg, fg="FFFFFF", halign="center")
            elif key == "fullName":
                dcell(cell, bg=bg, fg="F9FAFB", bold=True)
            else:
                dcell(cell, bg=bg)

    ws.freeze_panes = "D2"


def make_events_sheet(wb, events):
    ws = wb.create_sheet("이벤트")
    ws.sheet_view.showGridLines = False

    COLS = [
        ("id",          14, "ID"),
        ("emoji",        5, "이모지"),
        ("name",        14, "이름"),
        ("tier",         5, "단계"),
        ("scope",        9, "범위"),
        ("category",     9, "카테고리"),
        ("count",        5, "장수"),
        ("description", 48, "설명"),
        ("condition",   24, "조건"),
        ("resolution",  24, "해결 조건"),
        ("reward",      22, "보상"),
        ("recommendedTypes", 18, "추천 타입"),
        ("typeBonus",   10, "타입보너스"),
        ("failPenalty", 16, "실패 패널티"),
        ("globalEffect",22, "전체 효과"),
    ]

    ws.row_dimensions[1].height = 30
    for i, (_, w, label) in enumerate(COLS, 1):
        c = ws.cell(row=1, column=i, value=label)
        hcell(c)
        ws.column_dimensions[get_column_letter(i)].width = w

    for ri, e in enumerate(events, 2):
        scope = e.get("scope", "")
        cat   = e.get("category", "")
        sc    = SCOPE_COLORS.get(scope, {"bg": ROW_EVEN, "fg": "E5E7EB"})
        bg    = ROW_ODD if ri % 2 == 0 else ROW_EVEN
        ws.row_dimensions[ri].height = 58

        condition_str = fmt_condition(e)
        res_str = fmt_resolution(e.get("resolution", {}))
        rew_str = fmt_reward(e.get("reward"))
        recommended_types_str = fmt_recommended_types(e)
        type_bonus_str = fmt_type_bonus(e)
        pen_str = fmt_penalty(e.get("failPenalty"))
        ge_str  = fmt_global_effect(e.get("globalEffect", {}))
        count_  = e.get("count", 1)
        if count_ is None:
            count_ = 1

        tier_ = e.get("tier", 1) or 1
        tier_colors = {1: "4B5563", 2: "1E3A5F", 3: "3D1A4E"}
        tier_fg     = {1: "D1D5DB", 2: "93C5FD", 3: "C4B5FD"}

        row = [
            e.get("id", ""),
            e.get("emoji", ""),
            e.get("name", ""),
            tier_,
            scope,
            cat,
            count_,
            e.get("description", ""),
            condition_str,
            res_str,
            rew_str,
            recommended_types_str,
            type_bonus_str,
            pen_str,
            ge_str,
        ]

        for ci, val in enumerate(row, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            key  = COLS[ci-1][0]
            if key == "tier":
                dcell(cell, bg=tier_colors.get(tier_, "4B5563"), fg=tier_fg.get(tier_, "D1D5DB"), bold=True, halign="center")
            elif key == "scope":
                dcell(cell, bg=sc["bg"], fg=sc["fg"], bold=True, halign="center")
            elif key == "category":
                fg = CAT_COLORS.get(cat, "9CA3AF")
                dcell(cell, bg=bg, fg=fg, bold=True, halign="center")
            elif key == "count":
                dcell(cell, bg=bg, fg="FCD34D", bold=True, halign="center")
            elif key == "id":
                dcell(cell, bg=bg, fg="6B7280", halign="center")
            elif key == "emoji":
                dcell(cell, bg=bg, fg="FFFFFF", halign="center")
            elif key == "name":
                dcell(cell, bg=bg, fg="F9FAFB", bold=True)
            elif key == "condition":
                dcell(cell, bg=bg, fg="BAE6FD")
            elif key == "reward":
                dcell(cell, bg=bg, fg="86EFAC")
            elif key == "recommendedTypes":
                dcell(cell, bg=bg, fg="FCD34D")
            elif key == "typeBonus":
                dcell(cell, bg=bg, fg="FDE68A", bold=True, halign="center")
            elif key == "failPenalty":
                dcell(cell, bg=bg, fg="FCA5A5")
            elif key == "globalEffect":
                dcell(cell, bg=bg, fg="FDE047")
            else:
                dcell(cell, bg=bg)

    ws.freeze_panes = "C2"


def make_readme_sheet(wb):
    ws = wb.create_sheet("사용법", 0)
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 82

    lines = [
        ("멸망했는데 바쁨 — 게임 데이터 관리 시트", True,  "F9FAFB", 14, 40),
        ("",                                      False, "9CA3AF", 9,  10),
        ("📋  시트 구성",                          True,  "FCD34D", 10, 22),
        ("  • 생존자  —  평범/군기반장/돌격대장/4차원/겁쟁이/분위기메이커 생존자 카드 전체",
         False, "D1D5DB", 9, 18),
        ("  • 지도자  —  5명의 지도자 카드 (초기 자원, 고유 스킬, 특수 승리 조건)",
         False, "D1D5DB", 9, 18),
        ("  • 이벤트  —  personal / global / disaster 이벤트 전체",
         False, "D1D5DB", 9, 18),
        ("",                                      False, "9CA3AF", 9, 10),
        ("✏️  수정 방법",                          True,  "FCD34D", 10, 22),
        ("  1. 원하는 셀 내용을 직접 수정합니다.",  False, "D1D5DB", 9, 18),
        ("  2. id 컬럼은 절대 변경하지 마세요. 게임 코드와 연동되는 키입니다.",
         False, "FCA5A5", 9, 18),
        ("  3. 트리거(코드)=O 인 생존자는 triggers 로직이 코드에 직접 작성돼 있습니다.",
         False, "FCA5A5", 9, 18),
        ("  4. 수정 완료 후 저장하세요.",            False, "D1D5DB", 9, 18),
        ("",                                      False, "9CA3AF", 9, 10),
        ("📤  JSON 내보내기  (Excel 수정 → 게임 데이터 반영)",
         True,  "FCD34D", 10, 22),
        ("  python3 scripts/import_from_excel.py",
         False, "7DD3FC", 9, 18),
        ("  → src/data/survivors_from_excel.json / leaders_from_excel.json / events_from_excel.json",
         False, "6B7280", 9, 18),
        ("",                                      False, "9CA3AF", 9, 10),
        ("📥  Excel 재생성  (코드 수정 → Excel 업데이트)",
         True,  "FCD34D", 10, 22),
        ("  python3 scripts/export_to_excel.py",
         False, "7DD3FC", 9, 18),
        ("",                                      False, "9CA3AF", 9, 10),
        ("⚠️  이벤트 주의사항",                    True,  "FCA5A5", 10, 22),
        ("  이벤트의 resolution/reward/failPenalty/globalEffect 는 요약 텍스트입니다.",
         False, "FCA5A5", 9, 18),
        ("  실제 게임 로직은 src/data/events.js 의 구조체가 기준입니다.",
         False, "FCA5A5", 9, 18),
        ("  해결 조건 구조를 변경하려면 events.js 를 직접 수정하세요.",
         False, "FCA5A5", 9, 18),
    ]

    for ri, (text, bold, fg, size, height) in enumerate(lines, 1):
        cell = ws.cell(row=ri, column=1, value=text)
        cell.font      = Font(bold=bold, color=fg, size=size, name="Apple SD Gothic Neo")
        cell.fill      = PatternFill("solid", fgColor="111827")
        cell.alignment = Alignment(horizontal="left", vertical="center")
        ws.row_dimensions[ri].height = height


# ─── 메인 ──────────────────────────────────────────────────────────

def main():
    print("📦 JS → JSON 덤프 중...")
    result = subprocess.run(
        ["node", "scripts/dump_data_to_json.mjs"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("❌ 덤프 실패:", result.stderr)
        sys.exit(1)
    print(result.stdout.strip())

    survivors = json.loads((SCRIPTS / "_dump_survivors.json").read_text("utf-8"))
    leaders   = json.loads((SCRIPTS / "_dump_leaders.json").read_text("utf-8"))
    events    = json.loads((SCRIPTS / "_dump_events.json").read_text("utf-8"))

    print("\n📊 Excel 생성 중...")
    wb = Workbook()
    wb.remove(wb.active)

    make_readme_sheet(wb)
    make_survivors_sheet(wb, survivors)
    make_leaders_sheet(wb, leaders)
    make_events_sheet(wb, events)

    wb.save(OUT_FILE)
    print(f"✅ 저장 완료: {OUT_FILE}")


if __name__ == "__main__":
    main()
