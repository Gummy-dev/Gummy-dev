import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/gummy/Dev/Gummy-dev/apocalypse-card')
OUT = ROOT / 'event-card-print-preview.pdf'
DATA = json.loads((ROOT / 'scripts/_dump_events.json').read_text('utf-8'))
FONT_PATH = '/System/Library/Fonts/AppleSDGothicNeo.ttc'

DPI = 300
MM = DPI / 25.4
CSS = DPI / 96
PAGE_W_MM, PAGE_H_MM = 210, 297
CARD_W_MM, CARD_H_MM = 56, 87
PAGE_W, PAGE_H = round(PAGE_W_MM * MM), round(PAGE_H_MM * MM)
CARD_W, CARD_H = round(CARD_W_MM * MM), round(CARD_H_MM * MM)
CARD_GAP = 0
GRID_W = CARD_W * 3 + CARD_GAP * 2
GRID_H = CARD_H * 3 + CARD_GAP * 2
START_X = (PAGE_W - GRID_W) // 2
START_Y = (PAGE_H - GRID_H) // 2

MIN_PX = 7.5
BODY_PX = 9
CONCEPT_PX = 7.5
HEADER_PX = 13
BIG_PX = 26
SMALL_PX = 8

MIN_SIZE = round(MIN_PX * CSS)
BODY_SIZE = round(BODY_PX * CSS)
CONCEPT_SIZE = round(CONCEPT_PX * CSS)
HEADER_SIZE = round(HEADER_PX * CSS)
BIG_SIZE = round(BIG_PX * CSS)
SMALL_SIZE = round(SMALL_PX * CSS)
REWARD_SIZE = round(22 * 1.2 * 1.25 * 1.2 * CSS)
ARTIFACT_HEADER_SIZE = round(22 * CSS)
PENALTY_SIZE = round(9 * CSS)
BADGE_SIZE = round(13.8 * CSS)
HEADER_H = round(15 * MM)
CONDITION_H = round(20 * MM)
CARD_MARGIN = round(14 * CSS)
CONTENT_PAD_X = CARD_MARGIN

TYPE_LABELS = {
    '반장': '반',
    '용감이': '용',
    '분위기메이커': '분',
    '4차원': '4',
    '겁쟁이': '겁',
}
REWARD_LABELS = {
    'can': '통',
    'cap': '병',
    'survivor': '생',
    'score': '점',
    'clue': '단서',
    'key': '열쇠',
    'item': '아이템',
    'treasure': '보물',
    'exchange_arrow': '↔',
}
REWARD_ICONS = {
    'can': 'can.png',
    'cap': 'bottle-cap.png',
    'score': 'score.png',
    'survivor': 'survivor-face.png',
    'clue': 'clue.png',
}
HEADER_ICONS = {
    'attack': 'sword.png',
    'interaction': 'negotiate.png',
}
CATEGORY_LABELS = {
    'attack': '공격',
    'interaction': '협상',
    'resource': '자원',
    'dice': '탐색',
    'encounter': '조우',
    'score': '발견',
    'clue': '단서',
}
SAMPLE_IDS = [
    'e_key_caution',
    'e_clue_1_radio',
    'e_key_hidden_vault',
    'e_dice_lucky',
    'e_need_numbers',
    'e_dice_wait',
    'e_double_threat',
    'e_t1_trade_offer',
    'e_near_cache',
]

page = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
d = ImageDraw.Draw(page)
font_cache = {}
ICON_DIR = ROOT / 'src/assets/personal-icons'
_icon_cache = {}


def load_icon(name):
    if name not in _icon_cache:
        p = ICON_DIR / name
        if p.exists():
            img = Image.open(p).convert('RGBA')
            gray = img.convert('L')
            _icon_cache[name] = Image.merge('RGBA', [gray, gray, gray, img.getchannel('A')])
    return _icon_cache.get(name)


def paste_icon(icon_name, x, y, height):
    """Paste icon at (x, y) with given pixel height. Returns width used."""
    img = load_icon(icon_name)
    if img is None:
        return 0
    iw, ih = img.size
    new_w = max(1, round(iw / ih * height))
    resized = img.resize((new_w, max(1, int(height))), Image.LANCZOS)
    page.paste(resized, (int(x), int(y)), resized)
    return new_w


def font(size):
    size = int(size)
    if size not in font_cache:
        font_cache[size] = ImageFont.truetype(FONT_PATH, size)
    return font_cache[size]


def text_size(text, f):
    box = d.textbbox((0, 0), str(text), font=f)
    return box[2] - box[0], box[3] - box[1]


def fit_font(text, max_w, start, minimum=MIN_SIZE):
    size = int(start)
    while size > minimum:
        if text_size(text, font(size))[0] <= max_w:
            return font(size)
        size -= 1
    return font(minimum)


DESC_ICON_MAP = {'🥫': 'can.png', '🪙': 'bottle-cap.png'}

def tokenize_desc(text):
    """Split description into ('text', str) | ('icon', filename) tokens."""
    tokens = []
    buf = ''
    for ch in text:
        if ch in DESC_ICON_MAP:
            if buf:
                tokens.append(('text', buf))
                buf = ''
            tokens.append(('icon', DESC_ICON_MAP[ch]))
        else:
            buf += ch
    if buf:
        tokens.append(('text', buf))
    return tokens


def _token_width(tok, f, icon_h):
    if tok[0] == 'text':
        return text_size(tok[1], f)[0]
    img = load_icon(tok[1])
    if img is None:
        return 0
    iw, ih = img.size
    return round(iw / ih * icon_h)


def wrap_inline_tokens(tokens, f, icon_h, max_w, max_lines=None):
    """Wrap token list into lines respecting max_w. Returns list of token-lists."""
    # first expand text tokens by splitting on newlines
    expanded = []
    for tok in tokens:
        if tok[0] == 'text':
            parts = tok[1].split('\n')
            for i, part in enumerate(parts):
                if i > 0:
                    expanded.append(('newline',))
                if part:
                    expanded.append(('text', part))
        else:
            expanded.append(tok)

    lines = []
    cur_line = []
    cur_w = 0
    for tok in expanded:
        if tok[0] == 'newline':
            lines.append(cur_line)
            cur_line = []
            cur_w = 0
            continue
        w = _token_width(tok, f, icon_h)
        if cur_w + w > max_w and tok[0] == 'text':
            # try to word-wrap inside the text token
            words = tok[1].split(' ')
            for wi, word in enumerate(words):
                ww = text_size(('' if wi == 0 else ' ') + word, f)[0]
                if cur_line and cur_w + ww > max_w:
                    lines.append(cur_line)
                    cur_line = [('text', word)]
                    cur_w = text_size(word, f)[0]
                else:
                    sep = '' if not cur_line or cur_line[-1][0] == 'icon' or wi == 0 else ' '
                    if cur_line and cur_line[-1][0] == 'text' and sep:
                        cur_line[-1] = ('text', cur_line[-1][1] + sep + word)
                    else:
                        cur_line.append(('text', sep + word if sep else word))
                    cur_w += text_size(sep + word, f)[0]
        else:
            cur_line.append(tok)
            cur_w += w
    if cur_line:
        lines.append(cur_line)
    if max_lines:
        lines = lines[:max_lines]
    return lines


def line_total_width(toks, f, icon_h):
    return sum(_token_width(t, f, icon_h) for t in toks)


def draw_inline_line(draw, toks, center_x, y, f, icon_h, fill=(25, 25, 25)):
    """Draw a single token-line centered at center_x, top-aligned to y."""
    total_w = line_total_width(toks, f, icon_h)
    cursor = center_x - total_w / 2
    _, fh = text_size('가', f)
    for tok in toks:
        if tok[0] == 'text':
            draw.text((cursor, y), tok[1], font=f, fill=fill)
            cursor += text_size(tok[1], f)[0]
        else:
            img = load_icon(tok[1])
            if img is None:
                continue
            iw, ih = img.size
            ico_w = round(iw / ih * icon_h)
            drop = round(icon_h * 0.05)
            icon_top = y + (fh - icon_h) / 2 + drop
            page.paste(img.resize((ico_w, max(1, int(icon_h))), Image.LANCZOS), (int(cursor), int(icon_top)), img.resize((ico_w, max(1, int(icon_h))), Image.LANCZOS))
            cursor += ico_w


def draw_centered_inline_lines(draw, token_lines, center_x, top, f, icon_h, fill=(25, 25, 25), line_gap=4):
    y = top
    _, fh = text_size('가', f)
    for toks in token_lines:
        draw_inline_line(draw, toks, center_x, y, f, icon_h, fill)
        y += fh + line_gap
    return y


def wrap_text(text, f, max_w, max_lines=None):
    if not text:
        return []
    lines = []
    normalized = str(text).replace('\r', '').strip()
    for para in normalized.split('\n'):
        para = para.strip()
        if not para:
            continue
        line = ''
        for ch in para:
            cand = line + ch
            if not line or text_size(cand, f)[0] <= max_w:
                line = cand
            else:
                lines.append(line)
                line = ch
        if line:
            lines.append(line)
    return lines[:max_lines] if max_lines else lines


def draw_centered_lines(draw, lines, center_x, top, f, fill=(20, 20, 20), line_gap=8):
    y = top
    for line in lines:
        w, h = text_size(line, f)
        draw.text((center_x - w / 2, y), line, font=f, fill=fill)
        y += h + line_gap
    return y


def dashed_rect(draw, xy, dash=18, gap=10, fill=(85, 85, 85), width=2):
    x1, y1, x2, y2 = xy
    x = x1
    while x < x2:
        draw.line((x, y1, min(x + dash, x2), y1), fill=fill, width=width)
        draw.line((x, y2, min(x + dash, x2), y2), fill=fill, width=width)
        x += dash + gap
    y = y1
    while y < y2:
        draw.line((x1, y, x1, min(y + dash, y2)), fill=fill, width=width)
        draw.line((x2, y, x2, min(y + dash, y2)), fill=fill, width=width)
        y += dash + gap


def normalize_rewards(reward):
    if not reward:
        return []
    return reward if isinstance(reward, list) else [reward]


def reward_parts(event):
    parts = []
    for reward in normalize_rewards(event.get('reward')):
        r_type = reward.get('type')
        if r_type == 'exchange_arrow':
            parts.append({'label': REWARD_LABELS[r_type], 'amount': None, 'type': r_type})
            continue
        label = REWARD_LABELS.get(r_type, r_type or '')
        amount = reward.get('amount')
        parts.append({'label': label, 'amount': amount if isinstance(amount, (int, float)) and r_type != 'key' else None, 'type': r_type})
    return parts


def reward_text(event):
    parts = []
    for part in reward_parts(event):
        if part['amount'] is None:
            parts.append(part['label'])
        else:
            parts.append(f"{part['label']}{int(part['amount'])}")
    return ' '.join(parts) if parts else '-'


def draw_reward_summary(draw, event, x, center_y, max_w):
    parts = reward_parts(event)
    if not parts:
        return
    icon_h = REWARD_SIZE
    f_big = font(REWARD_SIZE)
    f_text = font(ARTIFACT_HEADER_SIZE)  # 보물/아이템 등 아이콘 없는 텍스트용
    f_small = font(round(15 * CSS))
    f_num = font(round(33 * CSS))
    item_gap = round(6 * CSS) + 6
    inner_gap = round(3 * CSS)
    ICON_DROP = {'can', 'cap'}

    def part_width(part):
        r_type = part['type']
        amount_str = str(int(part['amount'])) if part['amount'] is not None else ''
        if r_type == 'exchange_arrow':
            return text_size(part['label'], f_small)[0]
        icon_name = REWARD_ICONS.get(r_type)
        if icon_name:
            img = load_icon(icon_name)
            if img:
                iw, ih = img.size
                w = round(iw / ih * icon_h)
                if amount_str:
                    w += inner_gap + text_size(amount_str, f_num)[0]
                return w
        label = part['label']
        return text_size(label + amount_str, f_text)[0]

    widths = [part_width(p) for p in parts]
    total_w = sum(widths) + item_gap * max(0, len(widths) - 1)

    if total_w > max_w:
        scale_font = fit_font(reward_text(event), max_w, REWARD_SIZE, MIN_SIZE)
        label = reward_text(event)
        w, h = text_size(label, scale_font)
        draw.text((x, center_y - h / 2), label, font=scale_font, fill=(0, 0, 0))
        return

    cursor = x
    for idx, part in enumerate(parts):
        r_type = part['type']
        amount_str = str(int(part['amount'])) if part['amount'] is not None else ''
        if r_type == 'exchange_arrow':
            w, h = text_size(part['label'], f_small)
            draw.text((cursor, center_y - h / 2), part['label'], font=f_small, fill=(0, 0, 0))
            cursor += w
        else:
            icon_name = REWARD_ICONS.get(r_type)
            drew_icon = False
            if icon_name:
                img = load_icon(icon_name)
                if img:
                    ico_w_src, ico_h_src = img.size
                    icon_draw_w = round(ico_w_src / ico_h_src * icon_h)
                    drop = round(icon_h * 0.05) if r_type in ICON_DROP else 0
                    icon_top = round(center_y - icon_h / 2) + drop
                    paste_icon(icon_name, cursor, icon_top, icon_h)
                    _icon_cy = icon_top + icon_h / 2
                    cursor += icon_draw_w
                    drew_icon = True
            if not drew_icon:
                label = part['label']
                lw, lh = text_size(label, f_text)
                draw.text((cursor, center_y - lh / 2), label, font=f_text, fill=(0, 0, 0))
                cursor += lw
                _icon_cy = center_y
            if amount_str:
                cursor += inner_gap
                _box = d.textbbox((0, 0), amount_str, font=f_num)
                _num_extra = round(2 * CSS) if r_type == 'survivor' else 0
                draw.text((cursor, _icon_cy - (_box[1] + _box[3]) / 2 + round(2 * CSS) + _num_extra), amount_str, font=f_num, fill=(0, 0, 0))
                cursor += _box[2] - _box[0]
        if idx < len(parts) - 1:
            cursor += item_gap

def clean_description(event):
    text = str(event.get('description') or '')
    text = text.replace('실패시', '\n실패시')
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('실패시'):
            continue
        lines.append(line)
    return ' '.join(lines)


def get_required_types(event):
    result = []
    for entry in event.get('requiredTypes') or []:
        if isinstance(entry, str):
            result.append({'type': entry, 'count': 1})
        elif isinstance(entry, dict) and entry.get('type'):
            result.append({'type': entry.get('type'), 'count': int(entry.get('count') or 1)})
    return result


def get_assignment_count(event):
    assignment = event.get('assignment') or {}
    if assignment.get('minSurvivors'):
        return int(assignment['minSurvivors'])
    res = event.get('resolution') or {}
    if res.get('type') in ('check_survivors_n', 'shared_dispatch_reward') and res.get('amount'):
        return int(res['amount'])
    return None


def generic_survivor_extra(event, req_types):
    total = get_assignment_count(event)
    if not total:
        return 0
    required_typed = sum(entry.get('count', 1) for entry in req_types)
    if req_types:
        return max(0, total - required_typed)
    return total if total > 1 else 0


def fail_lines(event):
    """Returns list of str or ('icon_num', icon_name, amount_int) tuples."""
    penalty = event.get('failPenalty') or event.get('failurePenalty')
    if isinstance(penalty, dict):
        p_type = penalty.get('type')
        amount = penalty.get('amount')
        if p_type == 'lose_can':
            return ['실패시', ('icon_num', 'can.png', -int(amount))]
        if p_type == 'lose_cap':
            return ['실패시', ('icon_num', 'bottle-cap.png', -int(amount))]
        if p_type:
            return ['실패시', str(p_type)]
    text = str(event.get('description') or '')
    if '실패시 통조림' in text:
        import re
        m = re.search(r'실패시 통조림\s*(\d+)', text)
        if m:
            return ['실패시', ('icon_num', 'can.png', -int(m.group(1)))]
    if '실패시 병뚜껑' in text:
        import re
        m = re.search(r'실패시 병뚜껑\s*(\d+)', text)
        if m:
            return ['실패시', ('icon_num', 'bottle-cap.png', -int(m.group(1)))]
    return []

def is_key_event(event):
    return any(r.get('type') == 'key' for r in normalize_rewards(event.get('reward')))


def is_clue_event(event):
    return event.get('category') == 'clue' or any(r.get('type') == 'clue' for r in normalize_rewards(event.get('reward')))


def is_treasure_reward(event):
    return any(r.get('type') == 'treasure' for r in normalize_rewards(event.get('reward')))


BADGE_R = round(16 * CSS)

def draw_type_badge(draw, cx, cy, label, r=None):
    r = r or BADGE_R
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(238, 238, 238), outline=(40, 40, 40), width=2)
    f = font(BADGE_SIZE)
    w, h = text_size(label, f)
    draw.text((cx - w / 2, cy - h / 2 - 1), label, font=f, fill=(0, 0, 0))


def draw_survivor_requirement(draw, x, y, count=1):
    """Draw survivor-face icons side by side (no box). y = hard bottom boundary."""
    icon_h = round(26 * CSS)
    img = load_icon('survivor-face.png')
    if img is None:
        return icon_h
    ico_w_src, ico_h_src = img.size
    icon_w = round(ico_w_src / ico_h_src * icon_h)
    overlap = round(icon_w * 0.3)
    step_x = icon_w - overlap
    icon_y = y - icon_h
    for i in range(count):
        paste_icon('survivor-face.png', x + i * step_x, icon_y, icon_h)
    return icon_h


def draw_requirement_stack(draw, event, x, bottom, skip_key=False):
    req_types = get_required_types(event)
    extra = generic_survivor_extra(event, req_types)
    requires_key = bool(event.get('requiresKey') or (event.get('resolution') or {}).get('requiresKey'))
    resolution = event.get('resolution') or {}
    y = bottom
    step = round(36 * CSS)
    if resolution.get('type') == 'pay_cap':
        amount = resolution.get('amount', '?')
        icon_h = round(16 * 1.5 * CSS)
        f_amt = font(icon_h)
        amt_str = f'-{amount}'
        aw, ah = text_size(amt_str, f_amt)
        img = load_icon('bottle-cap.png')
        if img:
            iw_i, ih_i = img.size
            icon_w = round(iw_i / ih_i * icon_h)
            paste_icon('bottle-cap.png', x, y - icon_h + round(icon_h * 0.05), icon_h)
        else:
            icon_w = 0
        draw.text((x + icon_w + round(2 * CSS), y - ah - (icon_h - ah) // 2), amt_str, font=f_amt, fill=(0, 0, 0))
        y -= step
    if requires_key and not skip_key:
        f = font(round(11 * CSS))
        label = '열쇠'
        w, h = text_size(label, f)
        pad_x = round(6 * CSS)
        pad_y = round(4 * CSS)
        # 박스 하단을 y에 고정 (마진 침범 방지)
        draw.rounded_rectangle((x, y - h - pad_y * 2, x + w + pad_x * 2, y), radius=round(5 * CSS), outline=(50, 50, 50), width=2, fill=(245, 245, 245))
        draw.text((x + pad_x, y - h - pad_y), label, font=f, fill=(0, 0, 0))
        y -= step
    if extra > 0:
        draw_survivor_requirement(draw, x, y, extra)
        y -= step
    for entry in req_types:
        label = TYPE_LABELS.get(entry['type'], entry['type'][:1])
        for _ in range(entry.get('count', 1)):
            draw_type_badge(draw, x + BADGE_R, y - BADGE_R, label)
            y -= step
    return y


def _bonus_layout(event):
    recommended = event.get('recommendedParty') or []
    if not recommended:
        return None
    labels = []
    for entry in recommended:
        label = TYPE_LABELS.get(entry.get('type'), str(entry.get('type', '?'))[:1])
        count = int(entry.get('count') or 1)
        labels.extend([label] * count)
    if not labels:
        return None
    bonus = event.get('recommendedBonus') or event.get('typeBonus') or '+2'
    bonus_str = f'+{str(bonus).replace("+", "")}'
    f_bonus = font(round(9 * CSS))
    _f_badge = font(round(9 * CSS))
    _max_dim = max(max(text_size(lb, _f_badge)) for lb in labels)
    mini_r = round(_max_dim / 2) + round(1.5 * CSS)
    badge_gap = round(3 * CSS)
    badge_bonus_gap = round(5 * CSS)
    pad_x = round(5 * CSS)
    pad_x_right = round(2 * CSS)
    pad_y = round(3 * CSS)
    badges_w = len(labels) * (mini_r * 2) + max(0, len(labels) - 1) * badge_gap
    bw_text, bh_text = text_size(bonus_str, f_bonus)
    content_w = badges_w + badge_bonus_gap + bw_text
    content_h = mini_r * 2
    bw = content_w + pad_x + pad_x_right
    bh = content_h + pad_y * 2
    return labels, bonus_str, f_bonus, mini_r, badge_gap, badge_bonus_gap, pad_x, pad_y, bw, bh


def get_recommended_bonus_size(event):
    layout = _bonus_layout(event)
    if not layout:
        return None
    *_, bw, bh = layout
    return True, None, bw, bh, None, None


def draw_recommended_bonus(draw, event, x, y, box_left_x=None):
    layout = _bonus_layout(event)
    if not layout:
        return
    labels, bonus_str, f_bonus, mini_r, badge_gap, badge_bonus_gap, pad_x, pad_y, bw, bh = layout
    box_x = box_left_x if box_left_x is not None else x
    draw.rounded_rectangle((box_x, y, x + bw, y + bh), radius=round(5 * CSS), fill=(235, 235, 235), outline=(90, 90, 90), width=1)
    cy = y + pad_y + mini_r
    cursor = x + pad_x
    f_badge = font(round(9 * CSS))
    for i, label in enumerate(labels):
        cx = cursor + mini_r
        draw.ellipse((cx - mini_r, cy - mini_r, cx + mini_r, cy + mini_r),
                     fill=(210, 210, 210))
        lw, lh = text_size(label, f_badge)
        draw.text((cx - lw / 2, cy - lh / 2 - 1), label, font=f_badge, fill=(0, 0, 0))
        cursor += mini_r * 2
        if i < len(labels) - 1:
            cursor += badge_gap
    cursor += badge_bonus_gap - round(3 * CSS)
    _bb = draw.textbbox((0, 0), bonus_str, font=f_bonus)
    draw.text((cursor, cy - (_bb[1] + _bb[3]) / 2), bonus_str, font=f_bonus, fill=(0, 0, 0))

def draw_header_icon(draw, event, x, y, size):
    cat = event.get('category')
    icon_name = HEADER_ICONS.get(cat)
    if icon_name:
        img = load_icon(icon_name)
        if img:
            ico_w_src, ico_h_src = img.size
            icon_w = round(ico_w_src / ico_h_src * size)
            paste_icon(icon_name, round(x + size / 2 - icon_w / 2), round(y), size)
            return
    if cat == 'attack':
        f = font(round(15 * CSS))
        label = '검'
    elif cat == 'interaction':
        f = font(round(15 * CSS))
        label = '握'
    else:
        f = font(round(11 * CSS))
        label = CATEGORY_LABELS.get(cat, '')[:2]
    if not label:
        return
    w, h = text_size(label, f)
    draw.text((x + size / 2 - w / 2, y + size / 2 - h / 2), label, font=f, fill=(40, 40, 40))


def draw_key_artifact(draw, ix, body_top, iw, body_h):
    f = font(round(36 * CSS))
    label = '열쇠'
    w, h = text_size(label, f)
    draw.text((ix + iw / 2 - w / 2, body_top + body_h * 0.33 - h / 2), label, font=f, fill=(30, 30, 30))


def draw_clue_artifact(draw, ix, body_top, iw, body_h, event):
    f = font(round(27 * CSS))
    source = '라디오'
    if '지도' in event.get('name', '') or '약도' in event.get('description', ''):
        source = '지도'
    w, h = text_size(source, f)
    draw.text((ix + iw / 2 - w / 2, body_top + body_h * 0.30 - h / 2), source, font=f, fill=(30, 30, 30))


def draw_treasure_artifact(draw, ix, body_top, iw, body_h):
    f = font(round(25 * CSS))
    label = '보물'
    card_w = round(26 * MM)
    card_h = round(18 * MM)
    cx = ix + iw / 2
    top = body_top + body_h * 0.36 - card_h / 2
    draw.rounded_rectangle((cx - card_w / 2, top, cx + card_w / 2, top + card_h), radius=round(2 * MM), outline=(40, 40, 40), width=3, fill=(248, 248, 248))
    w, h = text_size(label, f)
    draw.text((cx - w / 2, top + card_h / 2 - h / 2), label, font=f, fill=(30, 30, 30))


def draw_dice_target_circle(draw, cx, cy, target, r=None):
    if r is None:
        r = round(6.95 * MM)
    # Flat-top hexagon (flat sides on top/bottom, vertices on left/right)
    pts = [(cx + r * math.cos(math.radians(a)),
            cy + r * math.sin(math.radians(a)))
           for a in [30, 90, 150, 210, 270, 330]]
    draw.polygon(pts, fill=(246, 246, 246), outline=None)
    for i in range(6):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % 6]
        draw.line([(x1, y1), (x2, y2)], fill=(35, 35, 35), width=3)
    scale = r / round(6.95 * MM)
    f_big = font(round(BIG_SIZE * 1.05 * scale))
    target_label = f'{target}+'
    tw, th = text_size(target_label, f_big)
    draw.text((cx - tw / 2, cy - th / 2 - round(6 * CSS * scale) - round(2 * CSS)), target_label, font=f_big, fill=(0, 0, 0))
    f_dice = font(max(MIN_SIZE, round(7.5 * CSS * scale)))
    label = '주사위'
    lw, lh = text_size(label, f_dice)
    hex_bottom = cy + r * math.sin(math.radians(60))
    draw.text((cx - lw / 2, hex_bottom - lh - round(8 * CSS * scale)), label, font=f_dice, fill=(45, 45, 45))
    return r

def draw_event_card(draw, event, x, y):
    dashed_rect(draw, (x, y, x + CARD_W, y + CARD_H))
    ix, iy, iw, ih = x, y, CARD_W, CARD_H
    radius = round(4 * MM)
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=radius, fill=(252, 252, 252), outline=None)

    margin = CARD_MARGIN
    header_h = HEADER_H
    bottom_h = CONDITION_H
    header_top = iy + margin
    header_bottom = header_top + header_h
    condition_bottom = iy + ih - margin
    condition_top = condition_bottom - bottom_h
    body_top = header_bottom + round(15 * CSS)
    body_bottom = condition_top - round(11 * CSS)
    body_h = body_bottom - body_top
    body_w = iw - margin * 2

    is_key = is_key_event(event)
    is_clue = is_clue_event(event)
    is_artifact = is_key or is_clue

    # Header bar remains full-width like the build UI; content sits inside the 14 CSS px margin.
    draw.rectangle((ix, iy, ix + iw, header_bottom), fill=(232, 232, 232))
    draw.line((ix, header_bottom, ix + iw, header_bottom), fill=(210, 210, 210), width=2)
    header_center_y = (iy + header_bottom) / 2
    if is_artifact:
        header_label = '낡은 열쇠' if is_key else '유토피아 단서'
        header_font = fit_font(header_label, body_w, ARTIFACT_HEADER_SIZE, HEADER_SIZE)
        hw, hh = text_size(header_label, header_font)
        draw.text((ix + iw / 2 - hw / 2, header_center_y - hh / 2 + round(1 * CSS)), header_label, font=header_font, fill=(0, 0, 0))
    else:
        icon_size = round(23 * CSS)
        draw_reward_summary(draw, event, ix + margin, header_center_y, iw - margin * 2 - icon_size)
        draw_header_icon(draw, event, ix + iw - margin - icon_size, header_center_y - round(11 * CSS), icon_size)

    # 조건 영역 우측 경계 — 모든 카드 타입의 설명 박스 가로폭 결정에 공유
    _resolution_pre = event.get('resolution') or {}
    _is_dice_pre = _resolution_pre.get('type') in ('roll_dice', 'roll_dice_score_bonus', 'support_roll_dice')
    _requires_key_pre = bool(event.get('requiresKey') or _resolution_pre.get('requiresKey'))
    if _is_dice_pre:
        if _requires_key_pre:
            _dice_r_pre = round(6.95 * MM * 0.7)
            _dice_cx_pre = ix + margin + _dice_r_pre - round(4 * CSS) - round(3 * CSS)
            _f_key_pre = font(round(_dice_r_pre * 1.05 * 0.8))
            _label_w_pre = text_size('열쇠', _f_key_pre)[0] + text_size('/', _f_key_pre)[0]
            _dice_right_pre = max(_dice_cx_pre + _dice_r_pre, _dice_cx_pre + _label_w_pre / 2)
        else:
            _dice_r_pre = round(6.95 * MM)
            _dice_right_pre = ix + margin + 2 * _dice_r_pre - round(3 * CSS) - round(3 * CSS)
        cond_right_x = _dice_right_pre
        _bonus_pre = _bonus_layout(event)
        if _bonus_pre:
            *_, _bw_pre, _ = _bonus_pre
            cond_right_x = max(cond_right_x, _dice_right_pre + round(2 * CSS) + _bw_pre)
        _fail_pre = fail_lines(event)
        _icon_item_pre = next((it for it in _fail_pre if isinstance(it, tuple) and it[0] == 'icon_num'), None)
        if _icon_item_pre:
            _f_fail_pre = font(PENALTY_SIZE)
            _inner_gap_pre = round(3 * CSS)
            _fail_lw_pre = text_size('실패', _f_fail_pre)[0]
            _, _iname_fp, _amt_fp = _icon_item_pre
            _img_fp = load_icon(_iname_fp)
            _fail_ico_w_pre = round(_img_fp.size[0] / _img_fp.size[1] * PENALTY_SIZE) if _img_fp else 0
            _fail_amt_w_pre = text_size(str(_amt_fp), _f_fail_pre)[0]
            _fail_total_pre = _fail_lw_pre + _inner_gap_pre + _fail_ico_w_pre + _inner_gap_pre + _fail_amt_w_pre
            cond_right_x = max(cond_right_x, _dice_right_pre + round(2 * CSS) + _fail_total_pre)
    else:
        cond_right_x = ix + margin
        if _resolution_pre.get('type') == 'pay_cap':
            _cap_icon_h = round(16 * 1.5 * CSS)
            _img_cap = load_icon('bottle-cap.png')
            _cap_icon_w = round(_img_cap.size[0] / _img_cap.size[1] * _cap_icon_h) if _img_cap else 0
            _amt_w = text_size(f'-{_resolution_pre.get("amount", "?")}', font(_cap_icon_h))[0]
            cond_right_x = max(cond_right_x, ix + margin + _cap_icon_w + round(2 * CSS) + _amt_w)
        _req_types_pre = get_required_types(event)
        _extra_pre = generic_survivor_extra(event, _req_types_pre)
        if _extra_pre > 0:
            _surv_h = round(26 * CSS)
            _img_surv = load_icon('survivor-face.png')
            if _img_surv:
                _surv_w = round(_img_surv.size[0] / _img_surv.size[1] * _surv_h)
                _step_s = _surv_w - round(_surv_w * 0.3)
                cond_right_x = max(cond_right_x, ix + margin + _surv_w + max(0, _extra_pre - 1) * _step_s)
        if _req_types_pre:
            cond_right_x = max(cond_right_x, ix + margin + BADGE_R * 2)
    _desc_gap = round(6 * CSS)
    _desc_pad = round(9 * CSS)
    _desc_max_w = max(round(body_w * 0.35), (ix + iw - margin) - cond_right_x - _desc_gap - _desc_pad * 2)

    if is_key:
        pass  # 열쇠 이미지는 직접 그림
        concept = '먼 곳의 문을 여는 낡은 증표'
        f_concept = font(BODY_SIZE)
        key_w = round(26 * MM)
        lines = wrap_text(concept, f_concept, key_w, 3)
        line_gap = round(3 * CSS)
        line_metrics = [text_size(line, f_concept) for line in lines]
        block_h = sum(h for _, h in line_metrics) + line_gap * max(0, len(lines) - 1)
        pad = round(9 * CSS)
        # 박스: 카드 마진 안쪽 우하단 기준
        bx2 = ix + iw - margin
        by2 = condition_bottom
        bx1 = bx2 - max(key_w, max(text_size(l, f_concept)[0] for l in lines)) - pad * 2
        by1 = by2 - block_h - pad * 2
        draw.rounded_rectangle((bx1, by1, bx2, by2), radius=round(9 * CSS), outline=(80, 80, 80), width=2, fill=(245, 245, 245))
        # 텍스트: 박스 내부 패딩 기준 우하단 정렬
        ty = by1 + pad
        for line, (lw, lh) in zip(lines, line_metrics):
            draw.text((bx2 - pad - lw, ty), line, font=f_concept, fill=(50, 50, 50))
            ty += lh + line_gap
    elif is_clue:
        pass  # 라디오 이미지는 직접 그림
        desc = clean_description(event)
        f_concept = font(BODY_SIZE)
        clue_line_gap = round(3 * CSS) + 2
        _, clue_fh = text_size('가', f_concept)
        lines = wrap_text(desc, f_concept, _desc_max_w)
        actual_w = max((text_size(l, f_concept)[0] for l in lines), default=0)
        box_w = min(_desc_max_w, actual_w) + _desc_pad * 2
        box_h = len(lines) * clue_fh + max(0, len(lines) - 1) * clue_line_gap + _desc_pad * 2
        cbx2 = ix + iw - margin
        cbx1 = max(cbx2 - box_w, ix + margin)
        box_w = cbx2 - cbx1
        cby2 = condition_bottom
        cby1 = cby2 - box_h
        draw.rounded_rectangle((cbx1, cby1, cbx2, cby2), radius=round(9 * CSS), fill=(245, 245, 245), outline=(180, 180, 180), width=2)
        ty = cby1 + _desc_pad
        cx = (cbx1 + cbx2) / 2
        for line in lines:
            lw, lh = text_size(line, f_concept)
            draw.text((cx - lw / 2, ty), line, font=f_concept, fill=(50, 50, 50))
            ty += clue_fh + clue_line_gap
    else:
        name = event.get('name') or ''
        f_title = fit_font(name, body_w, HEADER_SIZE, MIN_SIZE)
        nw, nh = text_size(name, f_title)
        title_y = header_bottom + round(9 * CSS)
        if is_treasure_reward(event):
            pass  # 보물 이미지는 직접 그림
        draw.text((ix + iw / 2 - nw / 2, title_y), name, font=f_title, fill=(0, 0, 0))

        desc = clean_description(event)
        f_body = font(BODY_SIZE)
        line_gap_desc = round(3 * CSS) + 2
        _, fh = text_size('가', f_body)
        bx2 = ix + iw - margin
        by2 = condition_bottom

        if any(ch in desc for ch in DESC_ICON_MAP):
            icon_h_desc = round(BODY_SIZE * 1.1)
            toks = tokenize_desc(desc)
            tok_lines = wrap_inline_tokens(toks, f_body, icon_h_desc, _desc_max_w)
            actual_w = max((line_total_width(tl, f_body, icon_h_desc) for tl in tok_lines), default=0)
            box_w = min(_desc_max_w, actual_w) + _desc_pad * 2
            line_h = max(fh, icon_h_desc)
            box_h = len(tok_lines) * line_h + max(0, len(tok_lines) - 1) * line_gap_desc + _desc_pad * 2
            bx1 = max(bx2 - box_w, ix + margin)
            box_w = bx2 - bx1
            by1 = by2 - box_h
            draw.rounded_rectangle((bx1, by1, bx2, by2), radius=round(9 * CSS), fill=(245, 245, 245), outline=(180, 180, 180), width=2)
            ty = by1 + _desc_pad
            cx = (bx1 + bx2) / 2
            for tl in tok_lines:
                draw_inline_line(draw, tl, cx, ty + (line_h - fh) / 2, f_body, icon_h_desc, fill=(25, 25, 25))
                ty += line_h + line_gap_desc
        else:
            desc_lines = wrap_text(desc, f_body, _desc_max_w)
            actual_w = max((text_size(l, f_body)[0] for l in desc_lines), default=0)
            box_w = min(_desc_max_w, actual_w) + _desc_pad * 2
            box_h = len(desc_lines) * fh + max(0, len(desc_lines) - 1) * line_gap_desc + _desc_pad * 2
            bx1 = max(bx2 - box_w, ix + margin)
            box_w = bx2 - bx1
            by1 = by2 - box_h
            draw.rounded_rectangle((bx1, by1, bx2, by2), radius=round(9 * CSS), fill=(245, 245, 245), outline=(180, 180, 180), width=2)
            ty = by1 + _desc_pad
            cx = (bx1 + bx2) / 2
            for line in desc_lines:
                lw, lh = text_size(line, f_body)
                draw.text((cx - lw / 2, ty), line, font=f_body, fill=(25, 25, 25))
                ty += lh + line_gap_desc

    resolution = event.get('resolution') or {}
    is_dice = resolution.get('type') in ('roll_dice', 'roll_dice_score_bonus', 'support_roll_dice')
    requires_key_cond = bool(event.get('requiresKey') or resolution.get('requiresKey'))
    if is_dice:
        if requires_key_cond:
            dice_r_small = round(6.95 * MM * 0.7)
            dice_cy = condition_bottom - dice_r_small
            # 열쇠 텍스트 (박스 없음)
            # 주사위: 가능한 좌측 (ix+margin 기준)
            dice_cx = ix + margin + dice_r_small - round(4 * CSS) - round(3 * CSS)
            # 열쇠/ 텍스트: 주사위 위에 중앙 정렬
            f_key = font(round(dice_r_small * 1.05 * 0.8))
            f_slash = f_key
            kw, kh = text_size('열쇠', f_key)
            sw, sh = text_size('/', f_slash)
            label_h = max(kh, sh)
            label_y = dice_cy - dice_r_small - round(4 * CSS) - label_h
            label_total_w = kw + sw
            label_x = dice_cx - label_total_w / 2
            draw.text((label_x, label_y + (label_h - kh) / 2), '열쇠', font=f_key, fill=(20, 20, 20))
            draw.text((label_x + kw, label_y + (label_h - sh) / 2), '/', font=f_slash, fill=(50, 50, 50))
            _dice_right = dice_cx + dice_r_small
            bonus_layout = _bonus_layout(event)
            if bonus_layout:
                *_, bw, bh = bonus_layout
                draw_recommended_bonus(draw, event, _dice_right - round(2 * CSS), condition_bottom - bh, box_left_x=ix)
            draw_dice_target_circle(draw, dice_cx, dice_cy, resolution.get('target', '?'), r=dice_r_small)
            stack_bottom = label_y - round(9 * CSS)
            draw_requirement_stack(draw, event, ix + margin, stack_bottom, skip_key=True)
        else:
            dice_r = round(6.95 * MM)
            dice_cx = ix + margin + dice_r - round(3 * CSS) - round(3 * CSS)
            dice_cy = condition_bottom - dice_r + round(2 * CSS)
            _dice_right = dice_cx + dice_r
            bonus_layout = _bonus_layout(event)
            if bonus_layout:
                *_, bw, bh = bonus_layout
                draw_recommended_bonus(draw, event, _dice_right - round(2 * CSS), condition_bottom - bh, box_left_x=ix)
            draw_dice_target_circle(draw, dice_cx, dice_cy, resolution.get('target', '?'))
            stack_x = ix + margin
            stack_bottom = dice_cy - dice_r - round(9 * CSS)
            draw_requirement_stack(draw, event, stack_x, stack_bottom)
    else:
        stack_x = ix + margin
        stack_bottom = condition_bottom
        draw_requirement_stack(draw, event, stack_x, stack_bottom)
        _dice_right = None
        bonus_layout = None

    fail = fail_lines(event) if is_dice else []
    if fail and _dice_right is not None:
        f_fail = font(PENALTY_SIZE)
        icon_h_fail = PENALTY_SIZE
        inner_gap = round(3 * CSS)
        fail_x = _dice_right + round(2 * CSS)
        # 보너스 박스가 있으면 그 위, 없으면 condition_bottom 기준
        if bonus_layout:
            *_, bw, bh = bonus_layout
            fail_bottom = condition_bottom - bh - round(5 * CSS)
        else:
            fail_bottom = condition_bottom
        # "실패 [icon] -N" 한 줄 인라인 표기
        icon_item = next((it for it in fail if isinstance(it, tuple) and it[0] == 'icon_num'), None)
        icon_top = fail_bottom - icon_h_fail + round(icon_h_fail * 0.05)
        _icon_cy = icon_top + icon_h_fail / 2
        _label_box = draw.textbbox((0, 0), '실패', font=f_fail)
        cursor = fail_x
        draw.text((cursor, _icon_cy - (_label_box[1] + _label_box[3]) / 2), '실패', font=f_fail, fill=(40, 40, 40))
        cursor += text_size('실패', f_fail)[0] + inner_gap
        if icon_item:
            _, iname, amt = icon_item
            img = load_icon(iname)
            if img:
                iw2, ih2 = img.size
                ico_w = round(iw2 / ih2 * icon_h_fail)
                paste_icon(iname, cursor, int(icon_top), icon_h_fail)
                cursor += ico_w + inner_gap
            amt_str = str(amt)
            _amt_box = draw.textbbox((0, 0), amt_str, font=f_fail)
            draw.text((cursor - round(3 * CSS), _icon_cy - (_amt_box[1] + _amt_box[3]) / 2), amt_str, font=f_fail, fill=(40, 40, 40))

    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=radius, outline=(15, 15, 15), width=4)

# count 반영 전체 카드 목록
all_cards = []
for event in DATA:
    for _ in range(int(event.get('count', 1))):
        all_cards.append(event)

COLS, ROWS = 3, 3
PER_PAGE = COLS * ROWS
num_pages = -(-len(all_cards) // PER_PAGE)

pages = []
for p_idx in range(num_pages):
    page = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
    d = ImageDraw.Draw(page)
    chunk = all_cards[p_idx * PER_PAGE:(p_idx + 1) * PER_PAGE]
    for idx, event in enumerate(chunk):
        row, col = divmod(idx, COLS)
        draw_event_card(d, event, START_X + col * (CARD_W + CARD_GAP), START_Y + row * (CARD_H + CARD_GAP))
    pages.append(page)

OUT_FULL = ROOT / 'event-card-print-full.pdf'
pages[0].save(OUT_FULL, 'PDF', resolution=DPI, save_all=True, append_images=pages[1:])
print(OUT_FULL)
