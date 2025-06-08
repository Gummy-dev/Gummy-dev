import math
import pygame
import sys
from pathlib import Path



# Pygame 초기화
pygame.init()
screen = pygame.display.set_mode((800, 600))
clock = pygame.time.Clock()

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


# 이미지 리소스 로드
image_BG_resources = images_bg()
image_CH_resources = images_ch()


# 클래스에서 스네이크 생성, 회전, 움직임을 하나의 객체 단위로 정의
class SnakeMoveRotateDraw:
    # 필요한 부품들을 정의 / 최초 위치, 각도, 속도, 호출될 이미지 및 이미지 정보
    def __init__(self, x, y): #최초 생성시 포지션을 정의
    #클래스가 가질 재료들 정의
        self.x = x
        self.y = y
        self.angle = 0
        self.flip = False
        self.speed = 5
        self.image = image_CH_resources["CH_Head"]
    # 회전 함수 정의
    def rotate(self, direction):
        self.angle = direction

    def flip(self, flip):
        self.flip = flip

    # 전진 함수 정의
    def move_forward(self):
        radians = math.radians(self.angle)
        self.x -= math.cos(radians) * self.speed
        self.y -= math.sin(radians) * self.speed
    # 그리기 함수 정의
    def draw(self, screen):
        rotated_image = pygame.transform.rotate(self.image, -self.angle)
        rotated_image = pygame.transform.flip(rotated_image, False, self.flip) 

        rect = rotated_image.get_rect(center=(self.x, self.y))
        screen.blit(rotated_image, rect.topleft)

class SnakeBodyGrow:
    def move_follow(self, follow_Object):

        radians = math.radians(follow_Object.angle)

        offset_x = -math.cos(radians) * -50
        offset_y = -math.sin(radians) * -50

        self.x = follow_Object.x + offset_x
        self.y = follow_Object.y + offset_y
        self.angle = follow_Object.angle
        self.flip = follow_Object.flip
        self.image = image_CH_resources["CH_Body"]

    def draw(self, screen):
        rotated_image = pygame.transform.rotate(self.image, -self.angle)
        rotated_image = pygame.transform.flip(rotated_image, False, self.flip)

        added_image = pygame.transform.scale(rotated_image, (100, 100))  # 크기 조정
        rect = rotated_image.get_rect(center=(self.x, self.y))
        screen.blit(rotated_image, rect.topleft)
        # screen.blit(added_image, rect.topleft)


# 스네이크 객체 생성
snake = SnakeMoveRotateDraw(400, 300)
snake_body = SnakeBodyGrow()



# 색상 정의 (RGB)
BLACK = (25, 25, 25)
BLUE = (0, 0, 255)


# 게임 루프
running = True
while running:
    # 화면 채우기
    screen.fill(BLACK)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:  # 닫기 버튼 처리
            running = False

        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_LEFT:
                snake.rotate(0)
                snake.flip = False
                print("좌")
            elif event.key == pygame.K_UP:
                snake.rotate(90)
                snake.flip = False
                print("상")
            elif event.key == pygame.K_RIGHT:
                snake.rotate(180)
                snake.flip = True
                print("우")
            elif event.key == pygame.K_DOWN:
                snake.rotate(270)
                snake.flip = False
                print("하")
        
        # if event.type == pygame.K_SPACE:

                
    snake.move_forward()
    snake.draw(screen)
    snake_body.move_follow(snake)  # 스네이크 몸체가 머리를 따라 움직임
    snake_body.draw(screen)


    # if 330 > posX >= -330:
    #     posX -= 10
    



    # 이미지 영역, value
    for value in image_BG_resources.values():
        screen.blit(value, (0, 0))
  

    # 화면 업데이트
    pygame.display.flip()
    pygame.display.update()
    clock.tick(60)


# 종료 처리
pygame.quit()
sys.exit()