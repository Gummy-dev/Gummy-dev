import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/gummy/Dev/Gummy-dev/apocalypse-card')
OUT = ROOT / 'utopia-cards-print-all.pdf'
DATA = json.loads((ROOT / 'scripts/_dump_utopias.json').read_text('utf-8'))
FONT_PATH = '/System/Library/Fonts/AppleSDGothicNeo.ttc'

DPI = 300
MM = DPI / 25.4
CSS = DPI / 96
PAGE_W_MM, PAGE_H_MM = 210, 297
CARD_W_MM, CARD_H_MM = 56, 87
PAGE_W, PAGE_H = round(PAGE_W_MM * MM), round(PAGE_H_MM * MM)
CARD_W, CARD_H = round(CARD_W_MM * MM), round(CARD_H_MM * MM)
CARD_GAP = 0
COLS, ROWS = 3, 3
GRID_W = CARD_W * COLS
GRID_H = CARD_H * ROWS
START_X = (PAGE_W - GRID_W) // 2
START_Y = (PAGE_H - GRID_H) // 2

MIN_PX = 7.5
BODY_PX = 9
HEADER_PX = 13
BIG_PX = 26
SMALL_PX = 8

MIN_SIZE = round(MIN_PX * CSS)
BODY_SIZE = round(BODY_PX * CSS)
HEADER_SIZE = round(HEADER_PX * CSS)
BIG_SIZE = round(BIG_PX * CSS)
SMALL_SIZE = round(SMALL_PX * CSS)
BADGE_SIZE = round(13.8 * CSS)
HEADER_H = round(15 * MM)
CONDITION_H = round(20 * MM)
CARD_MARGIN = round(14 * CSS)

TYPE_LABELS = {
    '반장': '반', '용감이': '용', '분위기메이커': '분', '4차원': '4', '겁쟁이': '겁',
}

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


def wrap_text(text, f, max_w, max_lines=None):
    if not text:
        return []
    lines = []
    for para in str(text).replace('\r', '').strip().split('\n'):
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


DESC_ICON_MAP = {'🥫': 'can.png', '🪙': 'bottle-cap.png'}


def tokenize_desc(text):
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
    lines, cur_line, cur_w = [], [], 0
    for tok in expanded:
        if tok[0] == 'newline':
            lines.append(cur_line); cur_line = []; cur_w = 0; continue
        w = _token_width(tok, f, icon_h)
        if cur_w + w > max_w and tok[0] == 'text':
            words = tok[1].split(' ')
            for wi, word in enumerate(words):
                ww = text_size(('' if wi == 0 else ' ') + word, f)[0]
                if cur_line and cur_w + ww > max_w:
                    lines.append(cur_line); cur_line = [('text', word)]; cur_w = text_size(word, f)[0]
                else:
                    sep = '' if not cur_line or cur_line[-1][0] == 'icon' or wi == 0 else ' '
                    if cur_line and cur_line[-1][0] == 'text' and sep:
                        cur_line[-1] = ('text', cur_line[-1][1] + sep + word)
                    else:
                        cur_line.append(('text', sep + word if sep else word))
                    cur_w += text_size(sep + word, f)[0]
        else:
            cur_line.append(tok); cur_w += w
    if cur_line:
        lines.append(cur_line)
    return lines[:max_lines] if max_lines else lines


def line_total_width(toks, f, icon_h):
    return sum(_token_width(t, f, icon_h) for t in toks)


def draw_inline_line(draw, toks, center_x, y, f, icon_h, fill=(25, 25, 25)):
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
            icon_top = y + (fh - icon_h) / 2 + round(icon_h * 0.05)
            resized = img.resize((ico_w, max(1, int(icon_h))), Image.LANCZOS)
            page.paste(resized, (int(cursor), int(icon_top)), resized)
            cursor += ico_w


def draw_survivor_icons(draw, x, bottom_y, count, icon_h=None):
    if icon_h is None:
        icon_h = round(22 * CSS)
    img = load_icon('survivor-face.png')
    if img is None:
        return
    iw, ih = img.size
    icon_w = round(iw / ih * icon_h)
    overlap = round(icon_w * 0.3)
    step_x = icon_w - overlap
    icon_y = bottom_y - icon_h
    for i in range(count):
        paste_icon('survivor-face.png', x + i * step_x, icon_y, icon_h)


def draw_dice_target_circle(draw, cx, cy, target, r=None):
    if r is None:
        r = round(6.95 * MM)
    pts = [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
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


def draw_bonus_pill(draw, card, x, bottom_y):
    recommended = card.get('recommendedParty') or []
    if not recommended:
        return
    check = card.get('check') or {}
    bonus_val = check.get('recommendedPartyBonus', 0)
    bonus_str = f'+{bonus_val}'
    labels = []
    for entry in recommended:
        lbl = TYPE_LABELS.get(entry.get('type'), str(entry.get('type', '?'))[:1])
        labels.extend([lbl] * int(entry.get('count') or 1))
    if not labels:
        return
    f_badge = font(round(9 * CSS))
    f_bonus = font(round(9 * CSS))
    _max_dim = max(max(text_size(lb, f_badge)) for lb in labels)
    mini_r = round(_max_dim / 2) + round(1.5 * CSS)
    badge_gap = round(3 * CSS)
    badge_bonus_gap = round(5 * CSS)
    pad_x = round(5 * CSS)
    pad_x_right = round(2 * CSS)
    pad_y = round(3 * CSS)
    badges_w = len(labels) * (mini_r * 2) + max(0, len(labels) - 1) * badge_gap
    bw_text, _ = text_size(bonus_str, f_bonus)
    bw = badges_w + badge_bonus_gap + bw_text + pad_x + pad_x_right
    bh = mini_r * 2 + pad_y * 2
    bx1, by1, bx2, by2 = x, bottom_y - bh, x + bw, bottom_y
    draw.rounded_rectangle((bx1, by1, bx2, by2), radius=round(5 * CSS), fill=(235, 235, 235), outline=(90, 90, 90), width=1)
    cy = (by1 + by2) / 2
    cursor = bx1 + pad_x
    for i, label in enumerate(labels):
        cx = cursor + mini_r
        draw.ellipse((cx - mini_r, cy - mini_r, cx + mini_r, cy + mini_r), fill=(210, 210, 210))
        lw, lh = text_size(label, f_badge)
        draw.text((cx - lw / 2, cy - lh / 2 - 1), label, font=f_badge, fill=(0, 0, 0))
        cursor += mini_r * 2
        if i < len(labels) - 1:
            cursor += badge_gap
    cursor += badge_bonus_gap - round(3 * CSS)
    _bb = draw.textbbox((0, 0), bonus_str, font=f_bonus)
    draw.text((cursor, cy - (_bb[1] + _bb[3]) / 2), bonus_str, font=f_bonus, fill=(0, 0, 0))


def draw_utopia_card(draw, card, x, y):
    dashed_rect(draw, (x, y, x + CARD_W, y + CARD_H))
    ix, iy, iw, ih = x, y, CARD_W, CARD_H
    radius = round(4 * MM)
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=radius, fill=(252, 252, 252), outline=None)

    margin = CARD_MARGIN
    header_bottom = iy + margin + HEADER_H
    condition_bottom = iy + ih - margin
    condition_top = condition_bottom - CONDITION_H
    body_top = header_bottom + round(15 * CSS)
    body_bottom = condition_top - round(11 * CSS)
    body_w = iw - margin * 2

    # Header: golden background
    draw.rectangle((ix, iy, ix + iw, header_bottom), fill=(255, 240, 155))
    draw.line((ix, header_bottom, ix + iw, header_bottom), fill=(200, 175, 60), width=2)
    hcy = (iy + header_bottom) / 2

    # Left: leaderType badge
    lt_label = TYPE_LABELS.get(card.get('leaderType', ''), '?')
    br = round(15 * CSS)
    bcx = ix + margin + br
    draw.ellipse((bcx - br, hcy - br, bcx + br, hcy + br), fill=(245, 220, 80), outline=(160, 125, 10), width=2)
    f_lt = font(BADGE_SIZE)
    bw2, bh2 = text_size(lt_label, f_lt)
    draw.text((bcx - bw2 / 2, hcy - bh2 / 2 - 1), lt_label, font=f_lt, fill=(80, 55, 0))

    # Center: "유토피아"
    f_h = font(HEADER_SIZE)
    uw, uh = text_size('유토피아', f_h)
    draw.text((ix + iw / 2 - uw / 2, hcy - uh / 2 + round(1 * CSS)), '유토피아', font=f_h, fill=(100, 70, 0))

    # Right: emoji
    emoji = card.get('emoji', '')
    if emoji:
        f_em = font(round(16 * CSS))
        ew, eh = text_size(emoji, f_em)
        draw.text((ix + iw - margin - ew, hcy - eh / 2 + round(1 * CSS)), emoji, font=f_em, fill=(100, 70, 0))

    # Body: card name
    name = card.get('name', '')
    f_name = fit_font(name, body_w, HEADER_SIZE, MIN_SIZE)
    nb = draw.textbbox((0, 0), name, font=f_name)
    nw, nh = nb[2] - nb[0], nb[3] - nb[1]
    draw.text((ix + iw / 2 - nw / 2, body_top), name, font=f_name, fill=(0, 0, 0))

    # Description box (below name, full width) — inline icon rendering for 🥫/🪙
    desc = card.get('description', '')
    f_body = font(BODY_SIZE)
    line_gap = round(3 * CSS) + 2
    _, fh = text_size('가', f_body)
    desc_pad = round(9 * CSS)
    inner_w = body_w - desc_pad * 2
    icon_h_desc = round(BODY_SIZE * 1.1)
    has_icon = any(ch in desc for ch in DESC_ICON_MAP)
    if has_icon:
        toks = tokenize_desc(desc)
        tok_lines = wrap_inline_tokens(toks, f_body, icon_h_desc, inner_w)
        line_h = max(fh, icon_h_desc)
        desc_total_h = len(tok_lines) * line_h + max(0, len(tok_lines) - 1) * line_gap
    else:
        desc_lines = wrap_text(desc, f_body, inner_w)
        desc_total_h = len(desc_lines) * fh + max(0, len(desc_lines) - 1) * line_gap
    box_top = body_top + nh + round(12 * CSS)
    box_bottom = body_bottom
    draw.rounded_rectangle((ix + margin, box_top, ix + iw - margin, box_bottom),
                            radius=round(9 * CSS), fill=(245, 245, 245), outline=(180, 180, 180), width=2)
    desc_y = box_top + (box_bottom - box_top - desc_total_h) / 2
    cx_desc = ix + iw / 2
    if has_icon:
        for tl in tok_lines:
            draw_inline_line(draw, tl, cx_desc, desc_y + (max(fh, icon_h_desc) - fh) / 2, f_body, icon_h_desc)
            desc_y += max(fh, icon_h_desc) + line_gap
    else:
        for line in desc_lines:
            lw, lh = text_size(line, f_body)
            draw.text((cx_desc - lw / 2, desc_y), line, font=f_body, fill=(25, 25, 25))
            desc_y += lh + line_gap

    # Condition: dice circle (left)
    check = card.get('check') or {}
    target = check.get('target', 23)
    dice_r = round(6.95 * MM)
    dice_cx = ix + margin + dice_r - round(3 * CSS) - round(3 * CSS)
    dice_cy = condition_bottom - dice_r + round(2 * CSS)
    draw_dice_target_circle(draw, dice_cx, dice_cy, target)
    _dice_right = dice_cx + dice_r

    # Condition: extra requirement above dice
    stack_y = dice_cy - dice_r - round(6 * CSS)
    pay_can = check.get('payCan')
    if pay_can:
        icon_h_cost = round(20 * CSS)
        img_can = load_icon('can.png')
        if img_can:
            iw_c, ih_c = img_can.size
            icon_w_c = round(iw_c / ih_c * icon_h_cost)
            paste_icon('can.png', ix + margin, stack_y - icon_h_cost + round(icon_h_cost * 0.05), icon_h_cost)
            f_amt = font(round(icon_h_cost * 0.85))
            amt_str = f'-{pay_can}'
            aw, ah = text_size(amt_str, f_amt)
            draw.text((ix + margin + icon_w_c + round(3 * CSS),
                       stack_y - icon_h_cost + (icon_h_cost - ah) / 2),
                      amt_str, font=f_amt, fill=(20, 20, 20))
    if check.get('requireAllSurvivors'):
        draw_survivor_icons(draw, ix + margin, stack_y, 5)

    # Condition: bonus pill (right of dice)
    draw_bonus_pill(draw, card, _dice_right + round(4 * CSS), condition_bottom)

    # Outer border
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=radius, outline=(15, 15, 15), width=4)


note = 'A4 print · utopia cards · 56mm x 87mm · cut on dashed lines'
PER_PAGE = COLS * ROWS
pages = []
num_pages = max(1, (len(DATA) + PER_PAGE - 1) // PER_PAGE)
for page_index in range(num_pages):
    page = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
    d = ImageDraw.Draw(page)
    d.text((START_X, 18), f"{note} · page {page_index + 1}", font=font(SMALL_SIZE), fill=(80, 80, 80))
    for local_index, card in enumerate(DATA[page_index * PER_PAGE:(page_index + 1) * PER_PAGE]):
        row, col = divmod(local_index, COLS)
        draw_utopia_card(d, card, START_X + col * (CARD_W + CARD_GAP), START_Y + row * (CARD_H + CARD_GAP))
    pages.append(page)

pages[0].save(OUT, 'PDF', resolution=DPI, save_all=True, append_images=pages[1:])
print(f"{OUT} ({len(DATA)} utopia cards, {len(pages)} pages)")
