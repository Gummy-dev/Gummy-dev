import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/gummy/Dev/Gummy-dev/apocalypse-card')
OUT = ROOT / 'leader-cards-print-all.pdf'
DATA = json.loads((ROOT / 'scripts/_dump_leaders.json').read_text('utf-8'))
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

HEADER_PX = 13
NAME_PX = 18
SCORE_PX = 26
DESC_PX = 9
CONCEPT_PX = 7.5
HEADER_SIZE = round(HEADER_PX * CSS)
NAME_SIZE = round(NAME_PX * CSS)
SCORE_SIZE = round(SCORE_PX * CSS)
DESC_SIZE = round(DESC_PX * CSS)
CONCEPT_SIZE = round(CONCEPT_PX * CSS)
SMALL_SIZE = round(8 * CSS)

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


def font(size):
    size = int(size)
    if size not in font_cache:
        font_cache[size] = ImageFont.truetype(FONT_PATH, size)
    return font_cache[size]


def text_size(text, f):
    box = d.textbbox((0, 0), str(text), font=f)
    return box[2] - box[0], box[3] - box[1]


def fit_font(text, max_w, start, minimum):
    size = start
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


def draw_inline_line(base_image, draw, toks, center_x, y, f, icon_h, fill=(20, 20, 20)):
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
            resized = img.resize((ico_w, max(1, int(icon_h))), Image.LANCZOS)
            base_image.paste(resized, (int(cursor), int(icon_top)), resized)
            cursor += ico_w


def draw_centered_lines(draw, lines, center_x, top, f, fill, line_gap):
    y = top
    for line in lines:
        w, h = text_size(line, f)
        draw.text((center_x - w / 2, y), line, font=f, fill=fill)
        y += h + line_gap
    return y


def draw_centered_italic_lines(base_image, lines, center_x, top, f, fill, line_gap, shear=0.16):
    y = top
    for line in lines:
        w, h = text_size(line, f)
        pad = 10
        layer = Image.new('RGBA', (max(1, w + pad * 2), max(1, h + pad * 2)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((pad, pad), line, font=f, fill=fill + (255,))
        skew = abs(shear)
        new_w = int(layer.width + layer.height * skew)
        transformed = layer.transform(
            (new_w, layer.height),
            Image.Transform.AFFINE,
            (1, shear, layer.height * skew if shear < 0 else 0, 0, 1, 0),
            resample=Image.Resampling.BICUBIC,
        )
        base_image.paste(transformed, (int(center_x - transformed.width / 2), int(y - pad)), transformed)
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


def draw_resource_row(base_image, draw, leader, cx, y, icon_h):
    """시작자원 / 수입 / 파티크기 한 줄로 표시."""
    init = leader.get('initialResources') or {}
    income = leader.get('passiveIncome') or {}
    max_party = leader.get('maxPartySize', 5)
    f_small = font(round(8.5 * CSS))
    f_sep = font(round(8 * CSS))
    inner_gap = round(2 * CSS)
    item_gap = round(4 * CSS)
    sep_pad = round(3 * CSS)

    # items: ('icon', filename, label) | ('sep',) | ('text', label)
    items = [
        ('icon', 'bottle-cap.png', str(init.get('bottleCap', 0))),
        ('icon', 'can.png', str(init.get('can', 0))),
        ('sep',),
        ('icon', 'bottle-cap.png', f'+{income.get("bottleCap", 0)}'),
        ('icon', 'can.png', f'+{income.get("can", 0)}'),
        ('sep',),
        ('text', f'파티{max_party}'),
    ]

    def item_w(it):
        if it[0] == 'sep':
            return text_size('/', f_sep)[0] + sep_pad * 2
        if it[0] == 'icon':
            img = load_icon(it[1])
            ico_w = round(img.size[0] / img.size[1] * icon_h) if img else 0
            return ico_w + inner_gap + text_size(it[2], f_small)[0]
        return text_size(it[1], f_small)[0]

    # gaps between adjacent non-sep items
    gaps = []
    for i, it in enumerate(items):
        if i == 0 or it[0] == 'sep' or items[i - 1][0] == 'sep':
            gaps.append(0)
        else:
            gaps.append(item_gap)

    total_w = sum(item_w(it) for it in items) + sum(gaps)
    cursor = cx - total_w / 2
    _, fh_s = text_size('가', f_small)

    for i, it in enumerate(items):
        cursor += gaps[i]
        if it[0] == 'sep':
            sw, sh = text_size('/', f_sep)
            draw.text((cursor + sep_pad, y + (icon_h - sh) / 2), '/', font=f_sep, fill=(150, 150, 150))
            cursor += item_w(it)
        elif it[0] == 'icon':
            img = load_icon(it[1])
            if img:
                iw2, ih2 = img.size
                ico_w = round(iw2 / ih2 * icon_h)
                drop = round(icon_h * 0.05)
                resized = img.resize((ico_w, max(1, int(icon_h))), Image.LANCZOS)
                base_image.paste(resized, (int(cursor), int(y + drop)), resized)
                cursor += ico_w + inner_gap
            else:
                cursor += inner_gap
            amt_w, amt_h = text_size(it[2], f_small)
            draw.text((cursor, y + (icon_h - amt_h) / 2), it[2], font=f_small, fill=(30, 30, 30))
            cursor += amt_w
        else:
            tw, th = text_size(it[1], f_small)
            draw.text((cursor, y + (icon_h - th) / 2), it[1], font=f_small, fill=(30, 30, 30))
            cursor += tw


def draw_card(draw, card, x, y):
    dashed_rect(draw, (x, y, x + CARD_W, y + CARD_H))

    ix, iy = x, y
    iw, ih = CARD_W, CARD_H
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=round(4 * MM), outline=None, fill=(252, 252, 252))

    header_h = round(11 * MM)
    header_top = iy
    header_bottom = iy + header_h

    f_score = font(SCORE_SIZE)
    max_party = str(card.get('maxPartySize', 5))
    sw, sh = text_size(max_party, f_score)
    draw.text((ix + round(3 * MM), header_top + (header_bottom - header_top - sh) / 2), max_party, font=f_score, fill=(0, 0, 0))

    name = card.get('name', '')
    f_name = fit_font(name, iw - round(18 * MM), NAME_SIZE, round(11 * CSS))
    nw, nh = text_size(name, f_name)
    draw.text((ix + iw / 2 - nw / 2, header_top + (header_bottom - header_top - nh) / 2 + round(8 * CSS)), name, font=f_name, fill=(0, 0, 0))

    # 초상화 영역 (비워둠)
    separator_y = iy + round(62 * MM)

    # 자원 통계 행 (separator 위 7mm)
    stats_h = round(7 * MM)
    stats_top = separator_y - stats_h
    stats_icon_h = round(DESC_SIZE * 1.05)
    draw_resource_row(page, draw, card, ix + iw / 2, stats_top + (stats_h - stats_icon_h) / 2, stats_icon_h)

    bottom_h = round(8 * MM)
    by = iy + ih - bottom_h

    skill = card.get('uniqueSkill') or {}
    skill_name = (skill.get('name') or '').strip()
    skill_desc = (skill.get('description') or '').strip()
    effect = f'{skill_name}\n{skill_desc}' if skill_name else skill_desc

    win = card.get('specialWin') or {}
    win_name = (win.get('name') or '').strip()
    win_desc = (win.get('description') or '').strip()
    desc = f'{win_name}: {win_desc}' if win_name else win_desc

    effect_top = separator_y + round(5 * CSS)
    f_desc = font(DESC_SIZE)
    f_concept = font(CONCEPT_SIZE)
    effect_margin = round(9 * CSS)
    effect_line_gap = round(1.5 * CSS) + round(2 * CSS)
    concept_line_gap = round(2 * CSS)
    MIN_GAP = round(7.5 * CSS) - 2

    concept_lines = wrap_text(desc, f_concept, iw - round(13 * MM))
    _, cfh = text_size('가', f_concept)
    concept_h = len(concept_lines) * cfh + max(0, len(concept_lines) - 1) * concept_line_gap
    concept_bottom = by - round(1 * MM) - 4.5
    concept_top = concept_bottom - concept_h

    effect_has_icon = any(ch in effect for ch in DESC_ICON_MAP)
    icon_h_eff = round(DESC_SIZE * 1.1)
    _, fh_desc = text_size('가', f_desc)
    if effect_has_icon:
        toks = tokenize_desc(effect)
        effect_token_lines = wrap_inline_tokens(toks, f_desc, icon_h_eff, iw - round(14 * MM), max_lines=6)
        line_h = max(fh_desc, icon_h_eff)
        effect_text_h = len(effect_token_lines) * line_h + max(0, len(effect_token_lines) - 1) * effect_line_gap
        n_effect_lines = len(effect_token_lines)
    else:
        effect_lines = wrap_text(effect, f_desc, iw - round(14 * MM), max_lines=6)
        effect_line_heights = [text_size(line, f_desc)[1] for line in effect_lines]
        effect_text_h = sum(effect_line_heights) + max(0, len(effect_lines) - 1) * effect_line_gap
        n_effect_lines = len(effect_lines)
        line_h = fh_desc

    default_box_top = effect_top - round(2 * CSS)
    default_box_bottom = effect_top + round(13 * MM)
    default_box_h = default_box_bottom - default_box_top - round(10 * CSS)
    required_box_h = effect_text_h + effect_margin * 2
    box_h_final = default_box_h if n_effect_lines <= 3 else max(default_box_h, required_box_h)
    max_box_bottom = concept_top - MIN_GAP
    effect_box_bottom = min(default_box_bottom, max_box_bottom)
    effect_box_top = effect_box_bottom - box_h_final
    effect_box = (ix + round(7 * MM), effect_box_top, ix + iw - round(7 * MM), effect_box_bottom)
    draw.rounded_rectangle(effect_box, radius=round(2.5 * MM), outline=(115, 115, 115), width=2, fill=(248, 248, 248))
    effect_centered_top = effect_box_top + (effect_box_bottom - effect_box_top - effect_text_h) / 2

    if effect_has_icon:
        ty = effect_centered_top
        for tl in effect_token_lines:
            draw_inline_line(page, draw, tl, ix + iw / 2, ty + (line_h - fh_desc) / 2, f_desc, icon_h_eff, fill=(20, 20, 20))
            ty += line_h + effect_line_gap
    else:
        draw_centered_lines(draw, effect_lines, ix + iw / 2, effect_centered_top, f_desc, (20, 20, 20), line_gap=effect_line_gap)

    draw_centered_italic_lines(page, concept_lines, ix + iw / 2, concept_top, f_concept, (70, 70, 70), line_gap=concept_line_gap)

    draw.rectangle((ix, by, ix + iw, iy + ih), outline=None, fill=(232, 232, 232))
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=round(4 * MM), outline=(20, 20, 20), width=4)

    f_bottom = font(HEADER_SIZE)
    type_label = card.get('type', '')
    tw, th = text_size(type_label, f_bottom)
    draw.text((ix + iw / 2 - tw / 2, by + (bottom_h - th) / 2), type_label, font=f_bottom, fill=(0, 0, 0))


note = 'A4 print · leader cards · 56mm x 87mm · image blank · cut on dashed lines'

pages = []
num_pages = max(1, (len(DATA) + 8) // 9)
for page_index in range(num_pages):
    page = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
    d = ImageDraw.Draw(page)
    d.text((START_X, 18), f"{note} · page {page_index + 1}", font=font(SMALL_SIZE), fill=(80, 80, 80))
    for local_index, card in enumerate(DATA[page_index * 9:(page_index + 1) * 9]):
        row, col = divmod(local_index, 3)
        draw_card(d, card, START_X + col * (CARD_W + CARD_GAP), START_Y + row * (CARD_H + CARD_GAP))
    pages.append(page)

pages[0].save(OUT, 'PDF', resolution=DPI, save_all=True, append_images=pages[1:])
print(f"{OUT} ({len(DATA)} leaders, {len(pages)} pages)")
