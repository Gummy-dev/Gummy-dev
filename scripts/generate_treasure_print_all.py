import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/Users/gummy/Dev/Gummy-dev/apocalypse-card')
OUT = ROOT / 'treasure-cards-print-all.pdf'
DATA = json.loads((ROOT / 'scripts/_dump_treasures.json').read_text('utf-8'))
FONT_PATH = '/System/Library/Fonts/AppleSDGothicNeo.ttc'

DPI = 300
MM = DPI / 25.4
CSS = DPI / 96
PAGE_W_MM, PAGE_H_MM = 210, 297
# 가로(landscape) 카드: 87mm × 56mm
CARD_W_MM, CARD_H_MM = 87, 56
PAGE_W, PAGE_H = round(PAGE_W_MM * MM), round(PAGE_H_MM * MM)
CARD_W, CARD_H = round(CARD_W_MM * MM), round(CARD_H_MM * MM)
CARD_GAP = 0
COLS, ROWS = 2, 5
GRID_W = CARD_W * COLS + CARD_GAP * (COLS - 1)
GRID_H = CARD_H * ROWS + CARD_GAP * (ROWS - 1)
START_X = (PAGE_W - GRID_W) // 2
START_Y = (PAGE_H - GRID_H) // 2

NAME_PX = 18
SCORE_PX = 26
DESC_PX = 9
CONCEPT_PX = 7.5
SMALL_PX = 8
NAME_SIZE = round(NAME_PX * CSS)
SCORE_SIZE = round(SCORE_PX * CSS)
DESC_SIZE = round(DESC_PX * CSS)
CONCEPT_SIZE = round(CONCEPT_PX * CSS)
SMALL_SIZE = round(SMALL_PX * CSS)

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


def split_description(desc):
    """'게임 종료 시 ...' 부분을 분리해 (effect, concept) 반환."""
    m = re.search(r'게임 종료 시 .+$', desc.strip())
    if m:
        effect = desc[:m.start()].strip().rstrip('.')
        concept = m.group(0).rstrip('.')
        return effect, concept
    return desc.strip(), ''


def draw_card(draw, card, x, y):
    dashed_rect(draw, (x, y, x + CARD_W, y + CARD_H))

    ix, iy = x, y
    iw, ih = CARD_W, CARD_H
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=round(4 * MM), outline=None, fill=(252, 252, 252))

    header_h = round(9 * MM)
    header_top = iy
    header_bottom = iy + header_h

    # 좌: 점수
    f_score = font(SCORE_SIZE)
    score = str(card.get('score', 0))
    sb = d.textbbox((0, 0), score, font=f_score)
    score_y = header_top + header_h / 2 - (sb[1] + sb[3]) / 2
    draw.text((ix + round(3 * MM), score_y), score, font=f_score, fill=(0, 0, 0))

    # 중앙: 이름
    name = card.get('name', '')
    f_name = fit_font(name, iw - round(18 * MM), NAME_SIZE, round(11 * CSS))
    nb = d.textbbox((0, 0), name, font=f_name)
    name_y = header_top + header_h / 2 - (nb[1] + nb[3]) / 2
    draw.text((ix + iw / 2 - (nb[2] - nb[0]) / 2, name_y), name, font=f_name, fill=(0, 0, 0))

    # 헤더 구분선
    draw.line((ix, header_bottom, ix + iw, header_bottom), fill=(200, 200, 200), width=2)

    raw_desc = card.get('description', '') or ''
    effect_text, concept_text = split_description(raw_desc)

    f_desc = font(DESC_SIZE)
    f_concept = font(CONCEPT_SIZE)
    effect_margin = round(9 * CSS)
    effect_line_gap = round(1.5 * CSS) + round(2 * CSS)
    concept_line_gap = round(2 * CSS)
    MIN_GAP = round(7.5 * CSS) - 2
    OUTER_MARGIN = 12

    # 컨셉 (하단 이탤릭)
    concept_lines = wrap_text(concept_text, f_concept, iw - OUTER_MARGIN * 2)
    _, cfh = text_size('가', f_concept)
    concept_h = len(concept_lines) * cfh + max(0, len(concept_lines) - 1) * concept_line_gap
    concept_bottom = iy + ih - OUTER_MARGIN - 12
    concept_top = concept_bottom - concept_h

    # 효과 박스 - 좌우 12px 마진
    eff_box_x1 = ix + OUTER_MARGIN + 60
    eff_box_x2 = ix + iw - OUTER_MARGIN - 60
    eff_max_w = eff_box_x2 - eff_box_x1 - effect_margin * 2

    effect_has_icon = any(ch in effect_text for ch in DESC_ICON_MAP)
    icon_h_eff = round(DESC_SIZE * 1.1)
    _, fh_desc = text_size('가', f_desc)

    if effect_has_icon:
        toks = tokenize_desc(effect_text)
        effect_token_lines = wrap_inline_tokens(toks, f_desc, icon_h_eff, eff_max_w, max_lines=5)
        line_h = max(fh_desc, icon_h_eff)
        effect_text_h = len(effect_token_lines) * line_h + max(0, len(effect_token_lines) - 1) * effect_line_gap
    else:
        effect_lines = wrap_text(effect_text, f_desc, eff_max_w, max_lines=5)
        effect_line_heights = [text_size(line, f_desc)[1] for line in effect_lines]
        effect_text_h = sum(effect_line_heights) + max(0, len(effect_lines) - 1) * effect_line_gap
        line_h = fh_desc

    # 박스: 내용에 맞게 크기 조정, 하단 정렬
    required_h = effect_text_h + effect_margin * 2
    eff_box_bottom = (concept_top - MIN_GAP) if concept_lines else (iy + ih - OUTER_MARGIN)
    eff_box_top = max(eff_box_bottom - required_h, header_bottom + OUTER_MARGIN)

    draw.rounded_rectangle((eff_box_x1, eff_box_top, eff_box_x2, eff_box_bottom),
                           radius=round(2.5 * MM), outline=(115, 115, 115), width=2, fill=(248, 248, 248))

    effect_cx = (eff_box_x1 + eff_box_x2) / 2
    effect_centered_top = eff_box_top + (eff_box_bottom - eff_box_top - effect_text_h) / 2

    if effect_has_icon:
        ty = effect_centered_top
        for tl in effect_token_lines:
            draw_inline_line(page, draw, tl, effect_cx, ty + (line_h - fh_desc) / 2, f_desc, icon_h_eff, fill=(20, 20, 20))
            ty += line_h + effect_line_gap
    else:
        draw_centered_lines(draw, effect_lines, effect_cx, effect_centered_top, f_desc, (20, 20, 20), line_gap=effect_line_gap)

    if concept_lines:
        draw_centered_italic_lines(page, concept_lines, ix + iw / 2, concept_top, f_concept, (70, 70, 70), line_gap=concept_line_gap)

    # 외곽선 (가장 마지막)
    draw.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=round(4 * MM), outline=(20, 20, 20), width=4)


def expand_cards_by_count(cards):
    expanded = []
    for card in cards:
        count = int(card.get('count') or 1)
        for _ in range(max(1, count)):
            expanded.append(dict(card))
    return expanded


note = 'A4 print · treasure/item cards · 87mm x 56mm (landscape) · cut on dashed lines'
PER_PAGE = COLS * ROWS

all_cards = expand_cards_by_count(DATA)
pages = []
num_pages = max(1, (len(all_cards) + PER_PAGE - 1) // PER_PAGE)
for page_index in range(num_pages):
    page = Image.new('RGB', (PAGE_W, PAGE_H), 'white')
    d = ImageDraw.Draw(page)
    d.text((START_X, 18), f"{note} · page {page_index + 1}", font=font(SMALL_SIZE), fill=(80, 80, 80))
    for local_index, card in enumerate(all_cards[page_index * PER_PAGE:(page_index + 1) * PER_PAGE]):
        row, col = divmod(local_index, COLS)
        draw_card(d, card, START_X + col * (CARD_W + CARD_GAP), START_Y + row * (CARD_H + CARD_GAP))
    pages.append(page)

pages[0].save(OUT, 'PDF', resolution=DPI, save_all=True, append_images=pages[1:])
print(f"{OUT} ({len(all_cards)} cards from {len(DATA)} types, {len(pages)} pages)")
