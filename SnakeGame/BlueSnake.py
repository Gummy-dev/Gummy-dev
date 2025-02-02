import pygame
import sys
from pathlib import Path

# Pygame 초기화
pygame.init()

base_path = Path(__file__).parent
image_path = base_path / "Resources"


def load_images():
    images = {
        "CH_Head": pygame.image.load(image_path / "CH_Head01.png"),
        "CH_Body": pygame.image.load(image_path / "CH_Body01.png"),
        "CH_Tail": pygame.image.load(image_path / "CH_Tail01.png"),


        "item_good": pygame.image.load(image_path / "Item_Good01.png"),
        "item_Bad": pygame.image.load(image_path / "Item_Bad01.png"),

        "bg_deco": pygame.image.load(image_path / "BG_Deco01.png"),
        "bg_frame": pygame.image.load(image_path / "BG_Frame01.png"),

        "bar_Empty": pygame.image.load(image_path / "State_BarEmpty01.png"),
        "bar_Full": pygame.image.load(image_path / "State_BarFull01.png"),
        "bar_Frame": pygame.image.load(image_path / "State_Bar01.png"),

    }
    return images


# HP = ["Resource/State_BarEmpty01.png","Resource/State_Bar01.png", "Resource/State_BarFull01.png"]
# base_path = os.path.dirname(__file__)
# image_path = os.path.join(base_path, BG[num])


# 이미지 리소스
image_resources = load_images()
screen = pygame.display.set_mode((800, 600))

# 색상 정의 (RGB)
BLACK = (35, 35, 35)
BLUE = (0, 0, 255)


# 게임 루프
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:  # 닫기 버튼 처리
            running = False



    # 화면 채우기
    screen.fill(BLACK)

    # 이미지 영역
    for value in image_resources.values():
        screen.blit(value, (0, 0))

    # screen.blit(image_resources["bg_deco"], (0, 0))
    # screen.blit(image_resources["bg_frame"], (0, 0))
    # screen.blit(image_resources["bar_Empty"], (0, 0))
    # screen.blit(image_resources["bar_Frame"], (0, 0))


    # 화면 업데이트
    pygame.display.flip()
    pygame.display.update()



# 종료 처리
pygame.quit()
sys.exit()