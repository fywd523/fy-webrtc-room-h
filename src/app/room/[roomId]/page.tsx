'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Send,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import ConnectWaveLogo from '@/components/ConnectWaveLogo'
import { useTranslation } from '@/hooks/use-translation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Participant {
  id: number
  name: string
  isMuted: boolean
  isCameraOff: boolean
  isSharingScreen?: boolean
}

interface Message {
  id: number
  name: string
  text: string
  timestamp: string
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslation()
  const roomId = params.roomId as string

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([
    { id: 1, name: 'You', isMuted: false, isCameraOff: false },
    { id: 2, name: 'Alex', isMuted: true, isCameraOff: false },
    { id: 3, name: 'Jordan', isMuted: false, isCameraOff: true },
    { id: 4, name: 'Taylor', isMuted: false, isCameraOff: false },
  ])
  
  const [messages, setMessages] = useState<Message[]>([
      {id: 1, name: "Alex", text: "Hey everyone!", timestamp: "10:30 AM"},
      {id: 2, name: "Jordan", text: "Hi Alex! Glad you could make it.", timestamp: "10:31 AM"},
  ])
  const [newMessage, setNewMessage] = useState("")

  useEffect(() => {
    // Simulate someone starting to share their screen
    const timer = setTimeout(() => {
        setParticipants(prev => prev.map(p => p.id === 4 ? {...p, isSharingScreen: true} : p))
    }, 5000);
    return () => clearTimeout(timer);
  }, [])


  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast({
      title: t.copied_to_clipboard,
      description: `${t.room_id}: ${roomId}`,
    })
  }

  const sendMessage = () => {
      if (newMessage.trim()) {
          const message: Message = {
              id: messages.length + 1,
              name: 'You',
              text: newMessage,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
          setMessages(prev => [...prev, message]);
          setNewMessage("")
      }
  }

  const mainSpeaker = participants.find(p => p.isSharingScreen) || participants[0];
  const otherParticipants = participants.filter(p => p.id !== mainSpeaker.id);

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
             <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden bg-card border shadow-md">
                 <Image src={`https://placehold.co/1280x720.png`} alt={mainSpeaker.name} layout="fill" objectFit="cover" data-ai-hint={mainSpeaker.isSharingScreen ? "code screen" : "person talking"} />
                 <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium">{mainSpeaker.name} {mainSpeaker.isSharingScreen && `(${t.screen_sharing})`}</div>
             </div>
             <div className="flex gap-4 h-32 md:h-40 shrink-0">
                 {otherParticipants.map((p) => (
                    <div key={p.id} className="relative aspect-video h-full rounded-lg overflow-hidden bg-card border shadow-md">
                        <Image src={`https://placehold.co/320x180.png`} alt={p.name} layout="fill" objectFit="cover" data-ai-hint="person portrait" />
                         <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium">{p.name}</div>
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
          
          <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
             <div className="hidden">
                <SheetTrigger asChild>
                    <Button variant="outline" onClick={() => setIsChatOpen(true)}>{t.chat}</Button>
                </SheetTrigger>
             </div>
            <SheetContent className="flex flex-col w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{t.chat}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="flex-1 -mx-6">
                <div className="px-6 py-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      <Avatar>
                         <AvatarFallback>{msg.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="font-semibold text-sm">{msg.name}</p>
                            <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                          </div>
                          <p className="text-sm bg-muted p-2 rounded-lg mt-1">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="mt-auto bg-background pb-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t.type_message_placeholder}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <Button onClick={sendMessage} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
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
                <Button variant="secondary" size="lg" className="rounded-full w-14 h-14" onClick={() => setIsSharingScreen(!isSharingScreen)}>
                  {isSharingScreen ? <ScreenShareOff className="h-6 w-6 text-primary" /> : <ScreenShare className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isSharingScreen ? t.stop_sharing : t.share_screen}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="lg" className="rounded-full w-14 h-14 relative" onClick={() => setIsChatOpen(true)}>
                  <MessageSquare className="h-6 w-6" />
                  {messages.length > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 p-1 h-5 w-5 flex items-center justify-center text-xs">{messages.length}</Badge>
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
