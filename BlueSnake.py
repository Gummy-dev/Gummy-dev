import pygame
import sys
import os

# Pygame 초기화
pygame.init()

snake = "Resources\\State_BarFull01.png"
item_good = "Resources\\Item_Good01.png"
bg_deco = "Resources\\BG_Deco01.png"
bg_frame = "Resources\\BG_Frame01.png"


BG = [item_good, bg_deco, bg_frame]

base_path = os.path.dirname(__file__)
image_path = os.path.join(base_path, BG[1])


# 화면 크기 설정
screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("Pygame Tutorial")

# 이미지 리소스
image = pygame.image.load(image_path)


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
    screen.blit(image,(0,0))
    # pygame.draw.rect(screen, BLUE, (100, 100, 200, 150))

    # 화면 업데이트
    pygame.display.flip()


# 종료 처리
pygame.quit()
sys.exit()