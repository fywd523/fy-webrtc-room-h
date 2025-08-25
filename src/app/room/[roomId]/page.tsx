'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { t } = useTranslation()
  const roomId = params.roomId as string
  const urlName = searchParams.get('name')

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [userName, setUserName] = useState(urlName || '')
  const [isMuted, setIsMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(true)
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  const createPeerConnection = useCallback((peerId: string) => {
    console.log(`Creating peer connection to ${peerId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log(`Sending ICE candidate to ${peerId}`);
        socketRef.current.emit('webrtc-ice-candidate', {
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      setRemoteStreams(prev => ({ ...prev, [peerId]: event.streams[0] }));
    };
    
    // Add tracks if local stream already exists
    localStream?.getTracks().forEach(track => {
      console.log('Adding local track to PC');
      pc.addTrack(track, localStream);
    });

    peerConnections.current[peerId] = pc;
    return pc;
  }, [localStream]);


  useEffect(() => {
    if (!urlName) {
      setIsNameModalOpen(true);
      setIsLoading(false);
      return;
    }
    if (userName !== urlName) {
        setUserName(urlName)
    }

    const socket = io()
    socketRef.current = socket

    const handleConnect = () => {
      console.log('Connected to socket server with id:', socket.id)
       if (urlName && socket.id) {
         console.log(`Emitting join-room for ${urlName} in ${roomId}`)
         socket.emit('join-room', { roomId, name: urlName, id: socket.id });
       }
    }

    const handleUpdateParticipants = (updatedParticipants: Participant[]) => {
      console.log('Received updated participants list:', updatedParticipants)
      const newParticipants = updatedParticipants.filter(p => p.id !== socket.id);
      
      // Create new peer connections for new participants
      newParticipants.forEach(p => {
        if (!peerConnections.current[p.id]) {
          createPeerConnection(p.id);
        }
      });
      
      // Clean up old peer connections for participants who left
      const newParticipantIds = newParticipants.map(p => p.id);
      Object.keys(peerConnections.current).forEach(id => {
        if (!newParticipantIds.includes(id)) {
          console.log(`Closing peer connection to ${id}`);
          peerConnections.current[id].close();
          delete peerConnections.current[id];
           setRemoteStreams(prev => {
             const newStreams = {...prev};
             delete newStreams[id];
             return newStreams;
           });
        }
      });

      // Now, for all new participants, create and send an offer
      newParticipants.forEach(p => {
          const pc = peerConnections.current[p.id];
          if (pc && pc.signalingState === 'stable') { // Avoid race conditions
              pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                  if (socketRef.current && pc.localDescription) {
                    console.log(`Sending webrtc offer to ${p.id}`);
                    socketRef.current.emit('webrtc-offer', { to: p.id, offer: pc.localDescription });
                  }
                }).catch(e => console.error("Error creating offer:", e));
          }
      });


      setParticipants(updatedParticipants);
      if (isLoading) setIsLoading(false);
    }

    const handleWebRtcOffer = async ({ from, offer }: { from: string, offer: RTCSessionDescriptionInit }) => {
      console.log(`Received webrtc offer from ${from}`);
      const pc = peerConnections.current[from] || createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (socketRef.current) {
        socketRef.current.emit('webrtc-answer', { to: from, answer });
      }
    };

    const handleWebRtcAnswer = ({ from, answer }: { from: string, answer: RTCSessionDescriptionInit }) => {
       console.log(`Received webrtc answer from ${from}`);
      const pc = peerConnections.current[from];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(e => console.error("Error setting remote description:", e));
      }
    };

    const handleWebRtcIceCandidate = ({ from, candidate }: { from: string, candidate: RTCIceCandidateInit }) => {
       console.log(`Received webrtc ice candidate from ${from}`);
      const pc = peerConnections.current[from];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate:", e));
      }
    };

    const handleReceiveMessage = (message: Omit<Message, 'isLocal'>) => {
        setMessages(prev => [...prev, {...message, isLocal: false}])
    }

    const handleUpdateMessages = (history: Omit<Message, 'isLocal'>[]) => {
        setMessages(history.map(msg => ({...msg, isLocal: msg.senderId === socket.id})));
    };
    
    const handleDisconnect = () => {
        console.log('Disconnected from server');
        localStream?.getTracks().forEach(track => track.stop());
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
    };

    socket.on('connect', handleConnect);
    socket.on('update-participants', handleUpdateParticipants)
    socket.on('webrtc-offer', handleWebRtcOffer);
    socket.on('webrtc-answer', handleWebRtcAnswer);
    socket.on('webrtc-ice-candidate', handleWebRtcIceCandidate);
    socket.on('receive-message', handleReceiveMessage)
    socket.on('update-messages', handleUpdateMessages);
    socket.on('disconnect', handleDisconnect);
  
    return () => {
      console.log('Cleaning up room page effects');
      socket.off('connect', handleConnect);
      socket.off('update-participants', handleUpdateParticipants)
      socket.off('webrtc-offer', handleWebRtcOffer);
      socket.off('webrtc-answer', handleWebRtcAnswer);
      socket.off('webrtc-ice-candidate', handleWebRtcIceCandidate);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('update-messages', handleUpdateMessages);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      localStream?.getTracks().forEach(track => track.stop());
      Object.values(peerConnections.current).forEach(pc => pc.close());
    }
  }, [roomId, urlName, userName, createPeerConnection, isLoading, toast]);


  const setupStream = async (video: boolean, audio: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      
      stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
      stream.getVideoTracks().forEach(track => track.enabled = !isCameraOff);
      
      setLocalStream(stream);

      // Add tracks to all existing peer connections
      Object.values(peerConnections.current).forEach(pc => {
        stream.getTracks().forEach(track => {
            if (!pc.getSenders().find(s => s.track === track)) {
                 pc.addTrack(track, stream);
            }
        });
      });
      // After adding tracks, we might need to renegotiate
      // This is a simplified approach; a more robust one would check signalingState
       Object.values(peerConnections.current).forEach(pc => {
          pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                 const peerId = Object.keys(peerConnections.current).find(key => peerConnections.current[key] === pc);
                  if (socketRef.current && pc.localDescription && peerId) {
                    socketRef.current.emit('webrtc-offer', { to: peerId, offer: pc.localDescription });
                  }
            });
       });

      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      toast({ variant: 'destructive', title: 'Media access failed', description: 'Could not access camera and microphone.' });
      return null;
    }
  };
  
  const toggleAudio = async () => {
    if (!localStream) {
      const stream = await setupStream(false, true);
      if (stream) setIsMuted(false);
    } else {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(prev => !prev);
    }
  };

  const toggleVideo = async () => {
    if (!localStream) {
       const stream = await setupStream(true, true);
       if (stream) setIsCameraOff(false);
    } else {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsCameraOff(prev => !prev);
    }
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleNameSubmit = (name: string) => {
    const newUrl = `${window.location.pathname}?name=${encodeURIComponent(name)}`;
    router.replace(newUrl, { scroll: false });
    // No longer setting userName here, it will be picked up by useEffect
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
            
            stream.getTracks()[0].onended = () => {
                if (socketRef.current) {
                   toggleScreenShare(); // Call again to stop sharing
                }
            };
            
            setIsCameraOff(true); // Disable camera when sharing screen
            setLocalStream(stream);
            setIsSharingScreen(true);
            socket.emit('start-sharing', { roomId, id: socket.id });

            const videoTrack = stream.getVideoTracks()[0];
            Object.values(peerConnections.current).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });

        } catch (error) {
            console.error('Error sharing screen:', error);
            toast({ variant: 'destructive', title: 'Could not share screen' });
        }
    } else {
        socket.emit('stop-sharing', { roomId, id: socket.id });
        
        localStream?.getTracks().forEach(track => track.stop());

        // Revert to camera stream (or null if camera was off)
        setIsSharingScreen(false);
        setIsCameraOff(true);
        setLocalStream(null); // Set to null, user must re-enable camera manually

        // We need to signal the track removal
        Object.values(peerConnections.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                pc.removeTrack(sender);
            }
             // Renegotiate to signal track removal
             pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    const peerId = Object.keys(peerConnections.current).find(key => peerConnections.current[key] === pc);
                    if (socketRef.current && pc.localDescription && peerId) {
                        socketRef.current.emit('webrtc-offer', { to: peerId, offer: pc.localDescription });
                    }
                });
        });
    }
  }

  const handleSendMessage = (text: string) => {
      const socket = socketRef.current;
      if (text && socket?.id) {
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
  
  const mainSpeakerStream = mainSpeaker?.isSharingScreen 
      ? (mainSpeaker.id === socketRef.current?.id ? localStream : remoteStreams[mainSpeaker.id]) 
      : (mainSpeaker?.id === socketRef.current?.id ? localStream : remoteStreams[mainSpeaker?.id]);


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
                    {mainSpeakerStream ? (
                         <video 
                          ref={el => { if (el) el.srcObject = mainSpeakerStream }} 
                          className="w-full h-full object-contain" 
                          autoPlay 
                          muted={mainSpeaker.id === socketRef.current?.id}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                           <div className="text-center">
                             <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                              <p className="mt-2 text-muted-foreground">
                                {mainSpeaker ? `${mainSpeaker.name} ${t.you}` : t.welcome_to_room}
                              </p>
                           </div>
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium">{mainSpeaker.name} {mainSpeaker.id === socketRef.current?.id && '(You)'} {mainSpeaker.isSharingScreen && `(${t.screen_sharing})`}</div>
                </div>
             )}
             <div className="flex gap-4 h-32 md:h-40 shrink-0">
                  {/* Local Video Thumbnail */}
                  <div className="relative aspect-video h-full rounded-lg overflow-hidden bg-card border shadow-md">
                     {localStream && !isCameraOff && !isSharingScreen ? (
                       <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                           <VideoOff className="h-8 w-8 text-muted-foreground" />
                        </div>
                     )}
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium">{userName} (You)</div>
                     <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full">
                        {isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
                     </div>
                  </div>

                 {otherParticipants.map((p) => {
                   const remoteStream = remoteStreams[p.id];
                   return (
                      <div key={p.id} className="relative aspect-video h-full rounded-lg overflow-hidden bg-card border shadow-md">
                          {remoteStream && !p.isCameraOff ? (
                            <video ref={el => { if (el) el.srcObject = remoteStream }} className="w-full h-full object-cover" autoPlay />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                               <VideoOff className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                           <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium">{p.name}</div>
                           <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full">
                              {p.isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
                           </div>
                      </div>
                   )
                 })}
             </div>
          </div>
          
          <ChatPanel 
            isOpen={isChatOpen}
            onOpenChange={setIsChatOpen}
            messages={messages}
            onSendMessage={handleSendMessage}
            t={t}
            userName={userName}
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
                  onClick={toggleAudio}
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
                  onClick={toggleVideo}
                >
                  {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isCameraOff ? t.start_video : t.stop_video}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={isSharingScreen ? "default" : "secondary"} size="lg" className="rounded-full w-14 h-14" onClick={toggleScreenShare}>
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
