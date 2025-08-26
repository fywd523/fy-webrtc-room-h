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
  UserPlus,
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
  const [isNameModalOpen, setIsNameModalOpen] = useState(!urlName);
  const [isLoading, setIsLoading] = useState(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`Creating peer connection to ${peerId}`);
    // Close existing connection if any
    if (peerConnections.current[peerId]) {
      peerConnections.current[peerId].close();
    }
    
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
      console.log(`Adding local track to PC for ${peerId}`);
      pc.addTrack(track, localStream);
    });

    peerConnections.current[peerId] = pc;
    return pc;
  }, [localStream]);

  // Effect for initializing and managing socket connection
  useEffect(() => {
    setIsLoading(false);

    const socket = io()
    socketRef.current = socket

    const handleConnect = () => {
      console.log('Connected to socket server with id:', socket.id)
       if (userName && socket.id) {
         console.log(`Emitting join-room for ${userName} in ${roomId}`)
         socket.emit('join-room', { roomId, name: userName, id: socket.id });
       }
    }
    
    const handleUpdateMessages = (history: Omit<Message, 'isLocal'>[]) => {
        setMessages(history.map(msg => ({...msg, isLocal: msg.senderId === socket.id})));
    };

    const handleReceiveMessage = (message: Omit<Message, 'isLocal'>) => {
        setMessages(prev => [...prev, {...message, isLocal: false}])
    }

    const handleDisconnect = () => {
        console.log('Disconnected from server');
        localStream?.getTracks().forEach(track => track.stop());
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
        setParticipants([]);
        setRemoteStreams({});
    };

    socket.on('connect', handleConnect);
    socket.on('receive-message', handleReceiveMessage)
    socket.on('update-messages', handleUpdateMessages);
    socket.on('disconnect', handleDisconnect);
  
    return () => {
      console.log('Cleaning up socket connection effect');
      socket.off('connect', handleConnect);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('update-messages', handleUpdateMessages);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
      localStream?.getTracks().forEach(track => track.stop());
      Object.values(peerConnections.current).forEach(pc => pc.close());
    }
  }, [roomId, userName, urlName]);

   // Effect for handling WebRTC signaling
  useEffect(() => {
      const socket = socketRef.current;
      if (!socket) return;
      
      const handleWebRtcOffer = async ({ from, offer }: { from: string, offer: RTCSessionDescriptionInit }) => {
        console.log(`Received webrtc offer from ${from}`);
        const pc = peerConnections.current[from] || createPeerConnection(from);
        
        if (pc.signalingState !== 'closed') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-answer', { to: from, answer });
          } catch(e) {
            console.error('Error handling offer:', e)
          }
        } else {
          console.warn(`Received offer from ${from}, but connection is closed.`);
        }
      };

      const handleWebRtcAnswer = ({ from, answer }: { from: string, answer: RTCSessionDescriptionInit }) => {
        console.log(`Received webrtc answer from ${from}`);
        const pc = peerConnections.current[from];
        if (pc && pc.signalingState !== 'closed') {
          pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(e => console.error("Error setting remote description:", e));
        } else {
          console.warn(`Received answer from ${from}, but connection is closed or does not exist.`);
        }
      };

      const handleWebRtcIceCandidate = ({ from, candidate }: { from: string, candidate: RTCIceCandidateInit }) => {
         console.log(`Received webrtc ice candidate from ${from}`);
        const pc = peerConnections.current[from];
        if (pc && pc.signalingState !== 'closed') {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate:", e));
        } else {
          console.warn(`Received ICE candidate from ${from}, but connection is closed or does not exist.`);
        }
      };

      socket.on('webrtc-offer', handleWebRtcOffer);
      socket.on('webrtc-answer', handleWebRtcAnswer);
      socket.on('webrtc-ice-candidate', handleWebRtcIceCandidate);

      return () => {
          socket.off('webrtc-offer', handleWebRtcOffer);
          socket.off('webrtc-answer', handleWebRtcAnswer);
          socket.off('webrtc-ice-candidate', handleWebRtcIceCandidate);
      }
  }, [createPeerConnection]);

  // Effect for managing participants and peer connections
  useEffect(() => {
      const socket = socketRef.current;
      if (!socket) return;

      const handleUpdateParticipants = (updatedParticipants: Participant[]) => {
          console.log('Received updated participants list:', updatedParticipants);
          const selfId = socket.id;
          const otherParticipants = updatedParticipants.filter(p => p.id !== selfId);

          console.log('Self ID:', selfId);
          console.log('Other Participants:', otherParticipants);

          // 修改参与者处理逻辑
          otherParticipants.forEach(p => {
            if (!peerConnections.current[p.id]) {
              console.log(`New participant ${p.name} (${p.id}) joined. Creating peer connection.`);
              const pc = createPeerConnection(p.id);
              
              // 获取当前用户的加入时间（从participants中找到自己）
              const localParticipant = participants.find(part => part.id === socketRef.current?.id);
              
              if (localParticipant && localParticipant.joinTime < p.joinTime) {
                console.log(`Local participant joined earlier (${localParticipant.joinTime} < ${p.joinTime}), initiating offer`);
                pc.createOffer()
                  .then(offer => pc.setLocalDescription(offer))
                  .then(() => {
                    if (socketRef.current && pc.localDescription) {
                      socketRef.current.emit('webrtc-offer', { to: p.id, offer: pc.localDescription });
                    }
                  })
                  .catch(e => console.error("Error creating offer:", e));
              } else {
                console.log(`Remote participant joined earlier (${p.joinTime} < ${localParticipant?.joinTime}), waiting for offer`);
              }
            }
          });

          // Handle departing participants
          const participantIds = updatedParticipants.map(p => p.id);
          Object.keys(peerConnections.current).forEach(id => {
              if (!participantIds.includes(id)) {
                  console.log(`Participant ${id} left. Closing peer connection.`);
                  peerConnections.current[id].close();
                  delete peerConnections.current[id];
                  setRemoteStreams(prev => {
                      const newStreams = { ...prev };
                      delete newStreams[id];
                      return newStreams;
                  });
              }
          });

          setParticipants(updatedParticipants);
      };

      socket.on('update-participants', handleUpdateParticipants);

      return () => {
          socket.off('update-participants', handleUpdateParticipants);
      };
  }, [createPeerConnection]);

    // This effect ensures that when localStream is set/changed, its tracks are added to all peer connections.
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }

    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];

      Object.values(peerConnections.current).forEach(pc => {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender && videoTrack) {
              videoSender.replaceTrack(videoTrack);
          } else if(videoTrack) {
              pc.addTrack(videoTrack, localStream);
          }

          const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (audioSender && audioTrack) {
              audioSender.replaceTrack(audioTrack);
          } else if (audioTrack) {
               pc.addTrack(audioTrack, localStream);
          }
      });
    }

  }, [localStream]);

  const setupStream = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      toast({ variant: 'destructive', title: 'Media access failed', description: 'Could not access camera and microphone.' });
      return null;
    }
  };
  
  const toggleAudio = async () => {
    let stream = localStream;
    if (!stream) {
      stream = await setupStream({ video: false, audio: true });
      if (stream) setLocalStream(stream); else return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = async () => {
    let stream = localStream;
    if (!stream) {
      stream = await setupStream({ video: true, audio: true });
       if (stream) setLocalStream(stream); else return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  const handleNameSubmit = (name: string) => {
    const newUrl = `${window.location.pathname}?name=${encodeURIComponent(name)}`;
    router.replace(newUrl, { scroll: false });
    setUserName(name);
    setIsNameModalOpen(false);
    // 刷新页面
    window.location.href = newUrl;
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast({
      title: t.copied_to_clipboard,
      description: `${t.room_id}: ${roomId}`,
    })
  }

  // 添加在 createPeerConnection 函数附近
  const handleStreamChange = async (newStream: MediaStream | null) => {
      const socket = socketRef.current;
      if (!socket) return;

      // 获取所有其他参与者
      const otherParticipants = participants.filter(p => p.id !== socket.id);
      
      for (const participant of otherParticipants) {
          const peerId = participant.id;
          let pc = peerConnections.current[peerId];
          
          if (!pc) {
              // 如果不存在连接，创建新的
              pc = createPeerConnection(peerId);
          }
          try {
              if (newStream) {
                  // 替换视频轨道
                  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                  const videoTrack = newStream.getVideoTracks()[0];
                  
                  if (videoSender && videoTrack) {
                      await videoSender.replaceTrack(videoTrack);
                  } else if (videoTrack) {
                      pc.addTrack(videoTrack, newStream);
                  }

                  // 替换音频轨道（如果有）
                  const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
                  const audioTrack = newStream.getAudioTracks()[0];
                  
                  if (audioSender && audioTrack) {
                      await audioSender.replaceTrack(audioTrack);
                  } else if (audioTrack) {
                      pc.addTrack(audioTrack, newStream);
                  }
              } else {
                  // 移除视频轨道
                  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                  if (videoSender) {
                      await videoSender.replaceTrack(null);
                  }
              }

              // 创建新的offer并发送给该参与者
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit('webrtc-offer', { to: peerId, offer });

          } catch (error) {
              console.error(`Error handling stream change for ${peerId}:`, error);
          }
      }
  }
  
  const toggleScreenShare = async () => {
    const socket = socketRef.current;
    if (!socket) return;

    if (!isSharingScreen) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true, 
                audio: true 
            });
            
            screenStream.getVideoTracks()[0].onended = () => {
                if (socketRef.current && peerConnections.current && isSharingScreen) {
                   toggleScreenShare();
                }
            };
            
            setIsSharingScreen(true);
            setIsCameraOff(true);
            setLocalStream(screenStream);
            socket.emit('start-sharing', { roomId, id: socket.id });

            // 关键修复：向所有参与者重新协商
            await handleStreamChange(screenStream);

        } catch (error) {
            console.error('Error sharing screen:', error);
            toast({ variant: 'destructive', title: 'Could not share screen' });
        }
    } else {
        socket.emit('stop-sharing', { roomId, id: socket.id });
        
        localStream?.getTracks().forEach(track => track.stop());
        setIsSharingScreen(false);
        setLocalStream(null);
        setIsCameraOff(true);

        // 关键修复：重新协商移除视频流
        await handleStreamChange(null);
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

  const handleInvite = () => {
    const joinLink = `${window.location.origin}/room/${roomId}`;
    const inviteTime = new Date().toLocaleString();
    const message = t.invitation_message
      .replace('{inviter}', userName)
      .replace('{time}', inviteTime)
      .replace('{roomId}', roomId)
      .replace('{link}', joinLink);
      
    navigator.clipboard.writeText(message);
    toast({
      title: t.invitation_copied_title,
      description: t.invitation_copied_description,
    });
  };

  const selfId = socketRef.current?.id;
  const mainSpeaker = participants.find(p => p.isSharingScreen) || participants[0];
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

  const getStreamForParticipant = (participant: Participant | undefined) => {
      if (!participant) return null;
      if (participant.id === selfId) return localStream;
      return remoteStreams[participant.id];
  }
  
  const mainSpeakerStream = getStreamForParticipant(mainSpeaker);

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
             {mainSpeaker ? (
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden bg-card border shadow-md">
                    {mainSpeakerStream ? (
                         <video 
                          ref={el => { if (el && el.srcObject !== mainSpeakerStream) el.srcObject = mainSpeakerStream }} 
                          className="w-full h-full object-contain" 
                          autoPlay playsInline muted
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                           <div className="text-center">
                             <VideoOff className="h-16 w-16 mx-auto text-muted-foreground" />
                              <p className="mt-2 text-muted-foreground">
                                {mainSpeaker.name}'s video is off
                              </p>
                           </div>
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium">{mainSpeaker.name} {mainSpeaker.id === selfId && '(You)'} {mainSpeaker.isSharingScreen && `(${t.screen_sharing})`}</div>
                </div>
             ) : (
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden bg-card border shadow-md flex items-center justify-center">
                    <div className="text-center">
                        <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">{t.welcome_to_room}</p>
                    </div>
                </div>
             )}
             <div className="flex gap-4 h-32 md:h-40 shrink-0">
                  {/* Local Video Thumbnail */}
                  <div className="relative aspect-video h-full rounded-lg overflow-hidden bg-card border shadow-md">
                     {localStream && !isCameraOff ? (
                       <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
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
                   const remoteStream = getStreamForParticipant(p);
                   const participantDetails = participants.find(ppt => ppt.id === p.id);
                   return (
                      <div key={p.id} className="relative aspect-video h-full rounded-lg overflow-hidden bg-card border shadow-md">
                          {remoteStream ? (
                            <video ref={el => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream }} className="w-full h-full object-cover" muted autoPlay playsInline />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                               <VideoOff className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                           <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium">{p.name}</div>
                           <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full">
                              {participantDetails?.isMuted ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-white" />}
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
                <Button variant="secondary" size="lg" className="rounded-full w-14 h-14" onClick={handleInvite}>
                  <UserPlus className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.invite_participants}</TooltipContent>
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
