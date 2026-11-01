"""Render a review-only sheet using the current exploration card information order."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'design' / 'exploration-six-types.png'
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
S = 2
W, H = 1680, 1510

def font(n, bold=False):
    return ImageFont.truetype(FONT, n * S, index=2 if bold else 0)

im = Image.new('RGB', (W*S, H*S), '#efe7d5')
d = ImageDraw.Draw(im)
def box(xy, fill, radius=0, outline=None, width=1):
    xy = tuple(round(v*S) for v in xy)
    d.rounded_rectangle(xy, radius*S, fill=fill, outline=outline, width=width*S)
def line(points, fill, width=1):
    d.line([(round(x*S), round(y*S)) for x,y in points], fill=fill, width=width*S, joint='curve')
def txt(xy, value, size, fill='#29362d', bold=False, anchor=None):
    d.text((xy[0]*S, xy[1]*S), value, font=font(size,bold), fill=fill, anchor=anchor)
def ellipse(xy, fill, outline=None, width=1):
    d.ellipse(tuple(round(v*S) for v in xy), fill=fill, outline=outline, width=width*S)

icons = {}
for kind, filename in [('can','can.png'),('cap','bottle-cap.png'),('clue','clue.png'),('survivor','survivor-face.png')]:
    icons[kind] = Image.open(ROOT / 'src/assets/personal-icons' / filename).convert('RGBA')
def icon(kind,x,y,size=25):
    tile = icons[kind].resize((size*S,size*S),Image.Resampling.LANCZOS)
    im.paste(tile,(int(x*S),int(y*S)),tile)
def reward(x,y,kind,num):
    icon(kind,x,y,28)
    txt((x+35,y+1),str(num),25,{'can':'#a44b35','cap':'#8b671d','clue':'#2b7773','survivor':'#a55565'}[kind],True)
def glyph(kind,x,y,color,scale=1):
    # Each pictogram remains recognizable in monochrome or when color is hard to see.
    a=scale
    if kind=='supply':
        box((x+2*a,y+16*a,x+42*a,y+42*a),None,2,color,3)
        line([(x+2*a,y+16*a),(x+22*a,y+7*a),(x+42*a,y+16*a)],color,3)
        line([(x+22*a,y+8*a),(x+22*a,y+42*a)],color,3)
        line([(x+15*a,y+28*a),(x+29*a,y+28*a)],color,3)
    elif kind=='scout':
        box((x+3*a,y+5*a,x+29*a,y+37*a),None,2,color,3)
        line([(x+11*a,y+12*a),(x+20*a,y+19*a),(x+11*a,y+27*a)],color,3)
        ellipse((x+23*a,y+23*a,x+42*a,y+42*a),None,color,3)
        line([(x+37*a,y+38*a),(x+46*a,y+47*a)],color,3)
    elif kind=='large':
        for dx,dy in [(4,17),(19,7),(34,17)]:
            ellipse((x+dx*a,y+dy*a,x+(dx+9)*a,y+(dy+9)*a),color)
            box((x+(dx-2)*a,y+(dy+12)*a,x+(dx+11)*a,y+(dy+31)*a),color,5)
    elif kind=='contest':
        line([(x+2*a,y+12*a),(x+18*a,y+23*a),(x+2*a,y+34*a)],color,5)
        line([(x+46*a,y+12*a),(x+30*a,y+23*a),(x+46*a,y+34*a)],color,5)
        box((x+19*a,y+13*a,x+29*a,y+32*a),None,2,color,3)
    elif kind=='first':
        for i,dx in enumerate((1,17,33)):
            ellipse((x+dx*a,y+(21-i*7)*a,x+(dx+11)*a,y+(32-i*7)*a),color)
            txt((x+(dx+5)*a,y+(27-i*7)*a),str(i+1),8,'#fffaf0',True,'mm')
        line([(x+4*a,y+42*a),(x+42*a,y+42*a)],color,3)
    else:
        ellipse((x+20*a,y+2*a,x+34*a,y+16*a),color)
        box((x+19*a,y+19*a,x+36*a,y+36*a),color,6)
        line([(x+0*a,y+23*a),(x+17*a,y+32*a),(x+30*a,y+28*a)],color,5)
        line([(x+2*a,y+40*a),(x+23*a,y+40*a),(x+38*a,y+31*a)],color,5)

cards=[
 dict(type='보급',name='버려진 편의점',color='#267b70',pale='#dcece5',glyph='supply',tier='Ⅰ',people='2명 이상',need=[],cost=[],reward=[('can',5),('cap',2)],rule='주사위 순서대로 한 묶음씩 선택',scene='store'),
 dict(type='정찰',name='침수된 연구소',color='#4975a6',pale='#dfe8f2',glyph='scout',tier='Ⅱ',people='3명 이상',need=['4차원'],cost=[('can',1)],reward=[('clue',4),('cap',1)],rule='주사위 순서대로 한 묶음씩 선택',scene='lab'),
 dict(type='대규모 탐색',name='무너지는 방벽',color='#615887',pale='#e7e2ef',glyph='large',tier='Ⅲ',people='6명 이상',need=['용감이'],cost=[('can',2)],reward=[('clue',3),('can',6),('cap',3)],rule='주사위 순서대로 한 묶음씩 선택',scene='wall'),
 dict(type='쟁탈',name='군용 창고',color='#aa533f',pale='#f1e0d8',glyph='contest',tier='Ⅱ',people='4명 이상',need=['돌격대장'],cost=[('can',1),('cap',1)],reward=[('clue',3),('can',4)],rule='1위 파티가 전부 획득',scene='warehouse'),
 dict(type='선착순',name='떠내려온 보급품',color='#b27c27',pale='#f1e7d0',glyph='first',tier='Ⅰ',people='3명 이상',need=[],cost=[],reward=[('can',3),('cap',2),('clue',1)],rule='조건 충족 → 배치한 순서대로 획득',scene='river'),
 dict(type='구조',name='고립된 쉼터',color='#b56878',pale='#f2e2e5',glyph='rescue',tier='Ⅱ',people='3명 이상',need=['분위기메이커'],cost=[('can',1)],reward=[('survivor',1),('survivor',1)],rule='공개된 생존자 중 1명씩 선택',scene='shelter'),
]

def scene(x,y,w,h,c):
    d.rectangle((x*S,y*S,(x+w)*S,(y+h)*S),fill=c['pale'])
    ellipse((x+w-91,y+71,x+w-43,y+119),'#e6cd87')
    d.polygon([(x*S,(y+h-49)*S),((x+68)*S,(y+h-118)*S),((x+143)*S,(y+h-49)*S)],fill='#b4c4a7')
    d.polygon([((x+104)*S,(y+h-48)*S),((x+204)*S,(y+h-126)*S),((x+w)*S,(y+h-48)*S)],fill='#a1b89f')
    if c['scene'] in ('store','warehouse','shelter'):
        d.polygon([((x+22)*S,(y+h-113)*S),((x+97)*S,(y+h-153)*S),((x+174)*S,(y+h-113)*S)],fill=c['color'])
        box((x+35,y+h-113,x+159,y+h-18),'#f4ecd2',1)
        box((x+87,y+h-92,x+112,y+h-18),c['color'])
        if c['scene']=='warehouse':
            for dx in (45,123): box((x+dx,y+h-93,x+dx+21,y+h-70),c['color'])
        if c['scene']=='shelter':
            ellipse((x+194,y+h-93,x+207,y+h-80),c['color'])
            box((x+193,y+h-78,x+208,y+h-50),c['color'],5)
    elif c['scene']=='river':
        for yy in (y+h-75,y+h-54,y+h-34):
            line([(x+4,yy),(x+54,yy+7),(x+110,yy),(x+177,yy+8),(x+w-4,yy)],c['color'],3)
        box((x+95,y+h-123,x+157,y+h-86),'#c79a58',2)
        line([(x+94,y+h-123),(x+126,y+h-140),(x+157,y+h-123)],'#936638',3)
    else:
        for dx,ht in ((31,107),(94,155),(172,123)):
            box((x+dx,y+h-18-ht,x+dx+50,y+h-18),c['color'])
            for wy in range(y+h-ht+2,y+h-27,26):
                box((x+dx+11,wy,x+dx+19,wy+10),'#f5ebcb')
    box((x,y+h-20,x+w,y+h),c['color'])

def card(x,y,c):
    cw,ch=309,548
    box((x+4,y+7,x+cw+4,y+ch+7),'#c9b896',11)
    box((x,y,x+cw,y+ch),'#fffcf0',11)
    # Preserve the prototype's soft flat scene, but use the reference's large
    # upper-right type seal and two clear information bands.
    box((x,y,x+cw,y+10),c['color'],7)
    scene(x+9,y+17,cw-18,312,c)
    box((x+15,y+25,x+201,y+61),'#fffcf0',4)
    txt((x+23,y+32),c['name'],19,c['color'],True)
    ellipse((x+198,y+15,x+301,y+118),c['color'])
    ellipse((x+206,y+23,x+293,y+110),None,'#fff8e7',2)
    glyph(c['glyph'],x+220,y+32,'#fff8e7',1.08)
    txt((x+250,y+91),c['type'],14,'#fff8e7',True,'mm')
    box((x+18,y+286,x+55,y+315),'#fffaf0',4)
    txt((x+36,y+301),c['tier']+'단계',11,c['color'],True,'mm')
    box((x+9,y+330,x+cw-9,y+438),'#fffcf0')
    line([(x+9,y+330),(x+cw-9,y+330)],c['color'],2)
    txt((x+18,y+341),'출발 조건',11,'#645f51',True)
    glyph('large',x+18,y+365,'#334237',0.31)
    txt((x+41,y+366),c['people'],18,'#29372d',True)
    if c['need']:
        txt((x+172,y+341),'필수 타입',10,'#645f51',True)
        box((x+169,y+363,x+291,y+390),c['pale'],5)
        txt((x+230,y+376),c['need'][0],13,c['color'],True,'mm')
    if c['cost']:
        txt((x+18,y+400),'추가 재화',10,'#645f51',True)
        cx=x+89
        for kind,num in c['cost']:
            icon(kind,cx,y+396,22)
            txt((cx+27,y+399),str(num),16,'#a04f36' if kind=='can' else '#987023',True)
            cx+=70
    if c['type']=='대규모 탐색':
        txt((x+18,y+416),'위험 · 주사위 1이면 첫 파견자 실종',10,'#965641')
    elif c['type']=='쟁탈':
        txt((x+18,y+416),'경쟁 · 여러 파티 참가 가능',10,'#965641')
    elif c['type']=='선착순':
        txt((x+18,y+416),'주사위 판정 없음',10,c['color'],True)
    box((x+9,y+439,x+cw-9,y+ch-9),c['pale'])
    box((x+9,y+439,x+83,y+462),c['color'],2)
    txt((x+46,y+450),'보상',12,'#fff9e8',True,'mm')
    cx=x+18
    for kind,num in c['reward']:
        reward(cx,y+468,kind,num)
        cx += 86 if kind!='survivor' else 108
    line([(x+18,y+503),(x+cw-18,y+503)],c['color'],1)
    txt((x+18,y+511),c['rule'],12,'#494b3e',True)

txt((74,49),'탐색 카드 · 6가지 타입',34,'#2d392e',True)
txt((75,100),'기존 카드의 정보 순서와 206 × 365 비율 유지  ·  타입은 색 띠 + 기호 + 이름으로 구분',17,'#6b604a')
for i,c in enumerate(cards):
    col,row=i%3,i//3
    x=74+col*535; y=164+row*638
    card(x,y,c)
    txt((x,y+562),c['type']+'  /  '+{'보급':'물자 확보','정찰':'단서 찾기','대규모 탐색':'많은 동료 필요','쟁탈':'1위 파티 독식','선착순':'배치 순서로 획득','구조':'생존자 데려오기'}[c['type']],16,'#454b3d',True)
line([(74,1465),(1605,1465)],'#c5b89e',1)
txt((74,1475),'시안 · 게임 미적용 / 카드마다 장소·조건·보상 수량은 달라짐 / 색만으로 구분하지 않도록 기호 병기',13,'#6f6655')
im.resize((W,H),Image.Resampling.LANCZOS).save(OUT)
print(OUT)
