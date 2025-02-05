import pygame
import sys
from pathlib import Path

# 클래스에서 스네이크 생성, 회전, 움직임을 하나의 객체 단위로 정의
class SnakeMoveRotateDraw:
    # 필요한 부품들을 정의 / 최초 위치, 각도, 속도, 호출될 이미지 및 이미지 정보
    def __init__(self, x, y): #최초 생성시 포지션을 정의
        self.x = x
        self.y = y


# Pygame 초기화
pygame.init()

base_path = Path(__file__).parent
image_path = base_path / "Resources"

def images_bg():
    img_bg = {
        "item_good": pygame.image.load(image_path / "Item_Good01.png"),
        "item_Bad": pygame.image.load(image_path / "Item_Bad01.png"),

        "bg_deco": pygame.image.load(image_path / "BG_Deco01.png"),
        "bg_frame": pygame.image.load(image_path / "BG_Frame01.png"),

        "bar_Empty": pygame.image.load(image_path / "State_BarEmpty01.png"),
        "bar_Full": pygame.image.load(image_path / "State_BarFull01.png"),
        "bar_Frame": pygame.image.load(image_path / "State_Bar01.png"),
    }
    return img_bg

def images_ch():
    img_ch = {
        "CH_Head": pygame.image.load(image_path / "CH_Head01.png"),
        "CH_Body": pygame.image.load(image_path / "CH_Body01.png"),
        "CH_Tail": pygame.image.load(image_path / "CH_Tail01.png"),
    }
    return img_ch



# 이미지 리소스
image_BG_resources = images_bg()
image_CH_resources = images_ch()

screen = pygame.display.set_mode((800, 600))
clock = pygame.time.Clock()


# 색상 정의 (RGB)
BLACK = (25, 25, 25)
BLUE = (0, 0, 255)

posX = 0
posY = 0

image = image_CH_resources["CH_Head"]

# 게임 루프
running = True
while running:

    for event in pygame.event.get():
        if event.type == pygame.QUIT:  # 닫기 버튼 처리
            running = False

        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_LEFT:
                print("왼")
                
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_RIGHT:
                print("오")
    if 330 > posX >= -330:
        posX -= 10
    

    # 화면 채우기
    screen.fill(BLACK)

    # 이미지 영역, value
    for value in image_BG_resources.values():
        screen.blit(value, (0, 0))
    
    screen.blit(image, (posX, posY))

    
    # 화면 업데이트
    pygame.display.flip()
    pygame.display.update()
    clock.tick(60)


# 종료 처리
pygame.quit()
sys.exit()