import { createServer } from 'http'
import next from 'next'
import { Server } from 'socket.io'
import { parse } from 'url'

const dev = process.env.NODE_ENV !== 'production'

// Helper to parse command line arguments
const getArg = (argName: string) => {
    const args = process.argv.slice(2);
    const arg = args.find(a => a.startsWith(`${argName}=`));
    if (arg) {
        return arg.split('=')[1];
    }
    const argIndex = args.indexOf(argName);
    if (argIndex !== -1 && args[argIndex + 1]) {
        return args[argIndex + 1];
    }
    return null;
};


const port = parseInt(getArg('--port') || process.env.PORT || '3000', 10)
const hostname = getArg('--hostname') || 'localhost'

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

interface Participant {
  id: string;
  name: string;
  isSharingScreen?: boolean;
  joinTime: string;
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
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handler(req, res, parsedUrl);
  });

  const io = new Server(httpServer)

  io.on('connection', (socket) => {
    console.log('a user connected:', socket.id)

    socket.on('join-room', ({ roomId, name, id }) => {
      socket.join(roomId)
      if (!rooms[roomId]) {
        rooms[roomId] = []
        roomMessages[roomId] = []
      }
      if (!rooms[roomId].find(p => p.id === id)) {
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
            io.to(roomId).emit('start-sharing', { roomId, id })
        }
    })

    socket.on('stop-sharing', ({ roomId, id }) => {
        if (rooms[roomId]) {
            const participant = rooms[roomId].find(p => p.id === id)
            if (participant) {
                participant.isSharingScreen = false;
            }
            io.to(roomId).emit('update-participants', rooms[roomId].map(p => ({...p, isMuted: false, isCameraOff: false})))
            io.to(roomId).emit('stop-sharing', { roomId, id })
        }
    })

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
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })

   const handleExit = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully.`);
    io.close(() => {
        console.log('Socket.IO server closed.');
        httpServer.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
    });
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
})
