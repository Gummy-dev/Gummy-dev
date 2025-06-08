import math
import pygame
import sys
import Item
import SnakeBodyEditor
import SnakeControl
from pathlib import Path



# Pygame 초기화
pygame.init()
screen = pygame.display.set_mode((800, 600))
clock = pygame.time.Clock()

base_path = Path(__file__).parent
image_path = base_path / "Resources"

SnakeBodyEditor = SnakeBodyEditor.SnakeBodyEditor  # SnakeBodyEditor 클래스 임포트
Item = Item.Item  # Item 클래스 임포트
SnakeControl = SnakeControl.SnakeControl  # SnakeControl 클래스 임포트



def images_bg():
    img_bg = {
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
def images_item():
    img_item = {
        "item_Good": pygame.image.load(image_path / "Item_Good01.png"),
        "item_Bad": pygame.image.load(image_path / "Item_Bad01.png"),
    }
    return img_item


# 이미지 리소스 로드
image_BG_resources = images_bg()
image_CH_resources = images_ch()
image_Item_resources = images_item()

head_img = image_CH_resources["CH_Head"]
body_img = image_CH_resources["CH_Body"]
tail_img = image_CH_resources["CH_Tail"]

item_Good = image_Item_resources["item_Good"]
item_Bad = image_Item_resources["item_Bad"]

snake_bodies = []
position_buffer = []
gap = 12

bodyCount = 2
itemCount = 0


# 스네이크 객체 생성
snake_control = SnakeControl(400, 300, 5)
item = Item(itemCount, item_Good, item_Bad)
snake_head = SnakeBodyEditor(snake_control, head_img, body_img, tail_img)


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
                snake_control.rotate(0)
                snake_control.flip = False
                print("좌")
            elif event.key == pygame.K_UP:
                snake_control.rotate(90)
                snake_control.flip = False
                print("상")
            elif event.key == pygame.K_RIGHT:
                snake_control.rotate(180)
                snake_control.flip = True
                print("우")
            elif event.key == pygame.K_DOWN:
                snake_control.rotate(270)
                snake_control.flip = False
                print("하")

    # 스네이크 몸체가 아직 생성되지 않은 경우, 초기화
    if len(snake_bodies) == 0:
        prev = snake_control
        for i in range(bodyCount):
            body_segment = SnakeBodyEditor(prev, head_img, body_img, tail_img)
            snake_bodies.append(body_segment)
            prev = body_segment

    snake_control.move_forward()  # 스네이크 전진

    
    position_buffer.insert(0, (
        snake_control.posX,
        snake_control.posY,
        snake_control.angle,
        snake_control.flip
    ))
    
    # 몸통 따라오기
    for i, body in enumerate(snake_bodies):
        idx = min(i * gap, len(position_buffer) - 1)
        pos = position_buffer[idx]
        body.x, body.y, body.angle, body.flip = pos
        body.image = head_img if i == 0 else body_img if i < bodyCount - 1 else tail_img
        body.draw(screen)

        
    if not item.state:
       item = Item(itemCount, item_Good, item_Bad)
    item.draw(screen)


    head_colider = head_img.get_rect(center=(snake_control.posX, snake_control.posY))
    item_colider = item.item_Good.get_rect(center=(item.goodX, item.goodY))


    if head_colider.colliderect(item_colider) and item.visible:
            #기존 몸체가 있다면 그 맨 끝을 따라오고, 없다면 머리를 따라와라
            follow_Object = snake_bodies[-1] if snake_bodies else snake_control
            #따라올 새로운 몸통 생성
            new_body = SnakeBodyEditor(follow_Object, head_img, body_img, tail_img)
            #몸통 리스트에 추가
            snake_bodies.append(new_body)

            bodyCount += 1
            itemCount += 1
            item.visible = False
            item.state = False


            print("아이템 획득!", itemCount)


    for value in image_BG_resources.values():
        screen.blit(value, (0, 0))
  
    # 화면 업데이트
    pygame.display.flip()
    pygame.display.update()
    clock.tick(60)


# 종료 처리
pygame.quit()
sys.exit()