import random
import pygame

class Item:
    def __init__(self, itemCount, item_Good, item_Bad):
        self.itemCount = itemCount
        self.visible = True
        self.state = True

        self.goodX = random.randint(0, 800)
        self.goodY = random.randint(0, 600)
        self.item_Good = item_Good

        self.badX = random.randint(0, 800)
        self.badY = random.randint(0, 600)
        self.item_Bad = item_Bad

    def draw(self, screen):
        if self.visible:
            rect = self.item_Good.get_rect(center=(self.goodX, self.goodY))
            screen.blit(self.item_Good, rect.center)
            self.item_colider = pygame.Rect(9,9, 50, 50)
            self.item_colider.center = (self.goodX, self.goodY)
        else:
            self.item_colider = pygame.Rect(0, 0, 0, 0)

        rect = self.item_Bad.get_rect(center=(self.badX, self.badY))
        screen.blit(self.item_Bad, rect.center)       
        
