import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRoomService } from './server/rooms.js'

export default defineConfig({
  plugins: [react(), {
    name: 'tabletop-rooms',
    configureServer(server) {
      const rooms = createRoomService()
      server.middlewares.use(rooms.handle)
      server.httpServer?.once('close', () => rooms.close())
    },
  }],
})
