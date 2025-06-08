import math
import pygame

class SnakeBodyEditor:
    def __init__(self, follow_Object, head, body, tail):
        self.follow_Object = follow_Object

        self.posX = follow_Object.posX
        self.posY = follow_Object.posY
        self.angle = follow_Object.angle
        self.flip = follow_Object.flip

        self.head = head
        self.body = body
        self.tail = tail
        self.image = self.head

    def snakeBodyCount(self, bodyCount, bodyCountMax, delay, gap):
        self.bodyCountMax = bodyCountMax
        self.bodyCount = bodyCount

        if self.bodyCount == 0:
            self.image = self.head
        elif 0 < self.bodyCount < bodyCountMax:
            self.image = self.body
        elif self.bodyCount == bodyCountMax:
            self.image = self.tail
            
    def draw(self, screen):
        rotated_image = pygame.transform.rotate(self.image, -self.angle)
        rotated_image = pygame.transform.flip(rotated_image, False, self.flip)

        rect = rotated_image.get_rect(center=(self.x, self.y))
        screen.blit(rotated_image, rect.topleft)
        
    
    # def bodyAdd(self, follow_Object):
    #     radians = math.radians(follow_Object.angle)
    #     offset_x = -math.cos(radians) * -40
    #     offset_y = -math.sin(radians) * -40

    #     self.x = follow_Object.x + offset_x
    #     self.y = follow_Object.y + offset_y

    #     self.angle = follow_Object.angle
    #     self.flip = follow_Object.flip


