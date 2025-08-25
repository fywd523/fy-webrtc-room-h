import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '9002', 10)
const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

interface Participant {
  id: string;
  name: string;
}

const rooms: Record<string, Participant[]> = {}

app.prepare().then(() => {
  const httpServer = createServer(handler)
  const io = new Server(httpServer)

  io.on('connection', (socket) => {
    console.log('a user connected:', socket.id)

    socket.on('join-room', ({ roomId, name, id }) => {
      socket.join(roomId)
      if (!rooms[roomId]) {
        rooms[roomId] = []
      }
      // Avoid duplicate participants
      if (!rooms[roomId].find(p => p.id === id)) {
        rooms[roomId].push({ id, name })
      }
      
      console.log(`user ${name} (${id}) joined room ${roomId}`)
      console.log('current rooms', rooms)
      
      io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({...p, isMuted: false, isCameraOff: false})))
    })

    socket.on('disconnecting', () => {
      console.log('user disconnecting:', socket.id)
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          if (rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter((p) => p.id !== socket.id)
            io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({...p, isMuted: false, isCameraOff: false})))
             console.log('current rooms after disconnect', rooms)
          }
        }
      }
    })

    socket.on('disconnect', () => {
      console.log('user disconnected:', socket.id)
    })
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
