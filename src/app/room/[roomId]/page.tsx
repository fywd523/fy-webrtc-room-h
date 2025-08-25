'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Copy,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  MessageSquare,
  PhoneOff,
  Users,
  Loader,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import ConnectWaveLogo from '@/components/ConnectWaveLogo'
import { useTranslation } from '@/hooks/use-translation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import io, { Socket } from 'socket.io-client'
import { type Message, type Participant } from '@/lib/types'
import { ChatPanel } from '@/components/ChatPanel'
import { NamePromptDialog } from '@/components/NamePromptDialog'


export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { t } = useTranslation()
  const roomId = params.roomId as string
  const urlName = searchParams.get('name')

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [userName, setUserName] = useState(urlName || '')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!urlName) {
      setIsNameModalOpen(true);
      setIsLoading(false);
      return;
    }
    if (!userName) {
        setUserName(urlName)
    }

    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('connected to socket server', socket.id)
       if (urlName) {
         socket.emit('join-room', { roomId, name: urlName, id: socket.id });
       }
    })

    socket.on('update-participants', (updatedParticipants: Participant[]) => {
      setParticipants(updatedParticipants)
      const me = updatedParticipants.find(p => p.id === socketRef.current?.id)
      
      if (me) {
        const currentlySharing = me.isSharingScreen || false;
        if (isSharingScreen !== currentlySharing) {
          setIsSharingScreen(currentlySharing);
        }
      }
      
      if (isLoading) {
        setIsLoading(false);
      }
    })

    socket.on('receive-message', (message: Omit<Message, 'isLocal'>) => {
        setMessages(prev => [...prev, {...message, isLocal: false}])
    })

    socket.on('update-messages', (history: Omit<Message, 'isLocal'>[]) => {
        setMessages(history.map(msg => ({...msg, isLocal: msg.senderId === socket.id})));
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    return () => {
      socket.disconnect()
    }
  }, [roomId, urlName])
  

  useEffect(() => {
    if (isSharingScreen && screenStream && videoRef.current) {
        videoRef.current.srcObject = screenStream;
    }
  }, [isSharingScreen, screenStream]);


  const handleNameSubmit = (name: string) => {
    const newUrl = `${window.location.pathname}?name=${encodeURIComponent(name)}`;
    router.replace(newUrl, { scroll: false });
    setUserName(name)
    setIsLoading(true); // Start loading for joining room
    setIsNameModalOpen(false);
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast({
      title: t.copied_to_clipboard,
      description: `${t.room_id}: ${roomId}`,
    })
  }
  
  const toggleScreenShare = async () => {
    const socket = socketRef.current;
    if (!socket) return;

    if (!isSharingScreen) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setScreenStream(stream);
            stream.getTracks()[0].onended = () => {
                // This event is fired when the user stops sharing from the browser's native UI
                if (socketRef.current && isSharingScreen) {
                   socketRef.current.emit('stop-sharing', { roomId, id: socketRef.current.id });
                   setIsSharingScreen(false);
                   setScreenStream(null);
                }
            };
            socket.emit('start-sharing', { roomId, id: socket.id });
            setIsSharingScreen(true);
        } catch (error) {
            console.error('Error sharing screen:', error);
            toast({ variant: 'destructive', title: 'Could not share screen' });
        }
    } else {
        socket.emit('stop-sharing', { roomId, id: socket.id });
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }
        setIsSharingScreen(false);
    }
  }

  const handleSendMessage = (text: string) => {
      const socket = socketRef.current;
      if (text && socket) {
          const message: Omit<Message, 'isLocal'> = {
              id: Date.now().toString(),
              senderId: socket.id,
              senderName: userName,
              text: text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
          socket.emit('send-message', { roomId, message });
          setMessages(prev => [...prev, {...message, isLocal: true}])
      }
  }

  const mainSpeaker = participants.find(p => p.isSharingScreen) || participants.find(p => p.id === socketRef.current?.id) || participants[0];
  const otherParticipants = participants.filter(p => p.id !== mainSpeaker?.id);
  const isViewingScreenShare = mainSpeaker && mainSpeaker.isSharingScreen && mainSpeaker.id !== socketRef.current?.id;
  
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-background text-foreground gap-4">
        <Loader className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">{t.joining_meeting_loading}</p>
      </div>
    );
  }

  if (isNameModalOpen) {
    return <NamePromptDialog isOpen={isNameModalOpen} onNameSubmit={handleNameSubmit} t={t} />;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <header className="flex h-16 items-center justify-between border-b px-4 shrink-0">
          <ConnectWaveLogo />
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-sm font-semibold">{roomId}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyRoomId}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col p-4 gap-4">
             {mainSpeaker && (
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden bg-card border shadow-md">
                    {isSharingScreen && mainSpeaker.id === socketRef.current?.id ? (
                        <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted />
                    ) : isViewingScreenShare ? (
                        <Image src={`https://placehold.co/1280x720.png`} alt={`${mainSpeaker.name}'s screen share`} layout="fill" objectFit="contain" data-ai-hint="screen sharing" />
                    ) : (
                        <Image src={`https://placehold.co/1280x720.png`} alt={mainSpeaker.name} layout="fill" objectFit="cover" data-ai-hint="person talking" />
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium">{mainSpeaker.name} {mainSpeaker.id === socketRef.current?.id && '(You)'} {mainSpeaker.isSharingScreen && `(${t.screen_sharing})`}</div>
                </div>
             )}
             <div className="flex gap-4 h-32 md:h-40 shrink-0">
                 {otherParticipants.map((p) => (
                    <div key={p.id} className="relative aspect-video h-full rounded-lg overflow-hidden bg-card border shadow-md">
                        <Image src={`https://placehold.co/320x180.png`} alt={p.name} layout="fill" objectFit="cover" data-ai-hint="person portrait" />
                         <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium">{p.name} {p.id === socketRef.current?.id && '(You)'}</div>
                         <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full">
                            {p.isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
                         </div>
                         {p.isCameraOff && (
                             <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                 <VideoOff className="h-8 w-8 text-white" />
                             </div>
                         )}
                    </div>
                 ))}
             </div>
          </div>
          
          <ChatPanel 
            isOpen={isChatOpen}
            onOpenChange={setIsChatOpen}
            messages={messages}
            onSendMessage={handleSendMessage}
            t={t}
          />

        </main>

        <footer className="flex h-20 items-center justify-center border-t bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMuted ? 'destructive' : 'secondary'}
                  size="lg"
                  className="rounded-full w-14 h-14"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isMuted ? t.unmute : t.mute}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isCameraOff ? 'destructive' : 'secondary'}
                  size="lg"
                  className="rounded-full w-14 h-14"
                  onClick={() => setIsCameraOff(!isCameraOff)}
                >
                  {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isCameraOff ? t.start_video : t.stop_video}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={isSharingScreen ? "default" : "secondary"} size="lg" className="rounded-full w-14 h-14" onClick={toggleScreenShare} disabled={isViewingScreenShare}>
                  {isSharingScreen ? <ScreenShareOff className="h-6 w-6" /> : <ScreenShare className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isSharingScreen ? t.stop_sharing : t.share_screen}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="lg" className="rounded-full w-14 h-14 relative" onClick={() => setIsChatOpen(true)}>
                  <MessageSquare className="h-6 w-6" />
                  {messages.filter(m => !m.isLocal).length > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 p-1 h-5 w-5 flex items-center justify-center text-xs">!</Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.chat}</TooltipContent>
            </Tooltip>

             <div className="w-8" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={() => router.push('/')}
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.leave_meeting}</TooltipContent>
            </Tooltip>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}

    