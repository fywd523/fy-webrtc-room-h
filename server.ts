import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '9002', 10)
const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

// 修改join-room事件处理逻辑
interface Participant {
  id: string;
  name: string;
  isSharingScreen?: boolean;
  joinTime: string; // 添加服务器端类型定义
}

interface Message {
  id: string
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

const rooms: Record<string, Participant[]> = {}
const roomMessages: Record<string, Message[]> = {}

app.prepare().then(() => {
  const httpServer = createServer(handler)
  const io = new Server(httpServer)

  io.on('connection', (socket) => {
    console.log('a user connected:', socket.id)

    socket.on('join-room', ({ roomId, name, id }) => {
      socket.join(roomId)
      if (!rooms[roomId]) {
        rooms[roomId] = []
        roomMessages[roomId] = []
      }
      // Avoid duplicate participants
      if (!rooms[roomId].find(p => p.id === id)) {
        // 记录加入时间（ISO格式）
        rooms[roomId].push({
          id, 
          name, 
          isSharingScreen: false, 
          joinTime: new Date().toISOString()
        })
      }
      
      console.log(`user ${name} (${id}) joined room ${roomId}`)
      
      io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({
        ...p, 
        isMuted: false, 
        isCameraOff: false
      })))
      socket.emit('update-messages', roomMessages[roomId])
    })

    socket.on('send-message', ({ roomId, message }: { roomId: string; message: Message }) => {
      if (roomMessages[roomId]) {
        roomMessages[roomId].push(message)
      }
      socket.to(roomId).emit('receive-message', message)
    })
    
    socket.on('start-sharing', ({ roomId, id }) => {
        if (rooms[roomId]) {
            const participant = rooms[roomId].find(p => p.id === id)
            if (participant) {
                participant.isSharingScreen = true;
            }
            io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({...p, isMuted: false, isCameraOff: false})))
        }
    })

    socket.on('stop-sharing', ({ roomId, id }) => {
        if (rooms[roomId]) {
            const participant = rooms[roomId].find(p => p.id === id)
            if (participant) {
                participant.isSharingScreen = false;
            }
            io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({...p, isMuted: false, isCameraOff: false})))
        }
    })

    // WebRTC Signaling
    socket.on('webrtc-offer', ({ to, offer }) => {
      if (socket.id !== to) {
        console.log('sending webrtc-offer to...', to)
        socket.to(to).emit('webrtc-offer', { from: socket.id, offer });
      }
    });

    socket.on('webrtc-answer', ({ to, answer }) => {
      if (socket.id !== to) {
        socket.to(to).emit('webrtc-answer', { from: socket.id, answer });
      }
    });

    socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
    });


    socket.on('disconnecting', () => {
      console.log('user disconnecting:', socket.id)
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          if (rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter((p) => p.id !== socket.id)
            io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({...p, isMuted: false, isCameraOff: false})))
             console.log('current rooms after disconnect', rooms)
             if (rooms[roomId].length === 0) {
               delete rooms[roomId]
               delete roomMessages[roomId]
             }
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
