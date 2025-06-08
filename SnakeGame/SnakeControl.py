import math
import pygame

class SnakeControl:
    def __init__(self, posX, posY, speed): 
        self.posX = posX
        self.posY = posY
        self.angle = 0
        self.flip = False
        self.speed = speed

    # 회전 함수 정의
    def rotate(self, direction):
        self.angle = direction

    def flip(self, flip):
        self.flip = flip

    # 전진 함수 정의
    def move_forward(self):
        radians = math.radians(self.angle)
        self.posX -= math.cos(radians) * self.speed
        self.posY -= math.sin(radians) * self.speed