import pygame
import math

# Pygame 초기화
pygame.init()

# 화면 설정
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Pygame 방향 전환")

# 색상
WHITE = (255, 255, 255)

# 이미지 로드 및 크기 조정
image = pygame.image.load("arrow.png")  # 사용할 이미지 파일
image = pygame.transform.scale(image, (50, 50))  # 크기 조정

# 플레이어 클래스
class Player:
    def __init__(self, x, y):
        self.image = image  # 원본 이미지
        self.x = x
        self.y = y
        self.angle = 0  # 회전 각도 (0도 = 오른쪽 방향)
        self.speed = 5

    def rotate(self, direction):
        """ 방향 전환 (왼쪽: -1, 오른쪽: +1) """
        self.angle += direction * 5  # 회전 속도 조절

    def move_forward(self):
        """ 현재 각도를 기준으로 전진 """
        radians = math.radians(self.angle)
        self.x += math.cos(radians) * self.speed
        self.y -= math.sin(radians) * self.speed  # pygame 좌표계는 y축이 아래로 증가하므로 -sin 사용

    def draw(self, screen):
        """ 이미지 회전 후 화면에 그리기 """
        rotated_image = pygame.transform.rotate(self.image, -self.angle)  # pygame은 반시계 방향 회전이 기본이므로 -angle
        rect = rotated_image.get_rect(center=(self.x, self.y))  # 중심을 유지한 채 회전
        screen.blit(rotated_image, rect.topleft)

# 플레이어 객체 생성
player = Player(WIDTH // 2, HEIGHT // 2)

# 게임 루프
running = True
clock = pygame.time.Clock()

while running:
    screen.fill(WHITE)  # 배경 지우기

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # 키 입력 처리
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT]:
        player.rotate(-1)  # 왼쪽 회전
    if keys[pygame.K_RIGHT]:
        player.rotate(1)  # 오른쪽 회전
    if keys[pygame.K_UP]:
        player.move_forward()  # 전진

    # 플레이어 그리기
    player.draw(screen)

    pygame.display.flip()
    clock.tick(60)  # FPS 제한

pygame.quit()