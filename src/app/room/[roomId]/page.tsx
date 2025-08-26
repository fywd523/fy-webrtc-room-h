
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Copy,
  Video,
  VideoOff,
  Users,
  Loader,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import ConnectWaveLogo from '@/components/ConnectWaveLogo'
import { useTranslation } from '@/hooks/use-translation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import io, { Socket } from 'socket.io-client'
import { type Message, type Participant } from '@/lib/types'
import { ChatPanel } from '@/components/ChatPanel'
import { NamePromptDialog } from '@/components/NamePromptDialog'
import { ControlBar } from '@/components/ControlBar'
import { SettingsDialog } from '@/components/SettingsDialog'

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isNameModalOpen, setIsNameModalOpen] = useState(!urlName);
  const [isLoading, setIsLoading] = useState(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  const [mediaConstraints, setMediaConstraints] = useState<MediaStreamConstraints>({
    video: true,
    audio: true,
  });

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
  }, [createPeerConnection, participants]);

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
      // stop previous stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      toast({ 
        variant: 'destructive', 
        title: t.media_access_failed_title, 
        description: t.media_access_failed_description 
      });
      return null;
    }
  };

  useEffect(() => {
    // Initial stream setup
    if(userName && !localStream) {
        setupStream(mediaConstraints).then(stream => {
            if (stream) {
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) {
                  audioTrack.enabled = !isMuted;
                }
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                  videoTrack.enabled = !isCameraOff;
                }
            }
        });
    }
  }, [userName]);
  
  const toggleAudio = async () => {
    let stream = localStream;
    if (!stream) {
      stream = await setupStream({ ...mediaConstraints, audio: true });
      if (stream) {
         setIsMuted(false);
         return;
      }
      return;
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
      stream = await setupStream({ ...mediaConstraints, video: true });
       if (stream) {
         setIsCameraOff(false);
         return;
       }
       return;
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
    if (socketRef.current?.id) {
      socketRef.current.emit('join-room', { roomId, name: name, id: socketRef.current.id });
    }
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
            toast({ variant: 'destructive', title: t.screen_share_failed_title });
        }
    } else {
        socket.emit('stop-sharing', { roomId, id: socket.id });
        
        localStream?.getTracks().forEach(track => track.stop());
        setIsSharingScreen(false);
        const newStream = await setupStream(mediaConstraints);
        if (newStream) {
            const videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = !isCameraOff;
            const audioTrack = newStream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = !isMuted;
        }

        await handleStreamChange(newStream);
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

  const handleMediaDeviceChange = async (kind: 'audio' | 'video', deviceId: string) => {
    const newConstraints = { ...mediaConstraints };
    if (kind === 'video') {
      newConstraints.video = { deviceId: { exact: deviceId } };
    } else {
      newConstraints.audio = { deviceId: { exact: deviceId } };
    }
    setMediaConstraints(newConstraints);

    if(!isSharingScreen) {
        const newStream = await setupStream(newConstraints);
        if (newStream) {
            await handleStreamChange(newStream);
        }
    }
  };

  const selfId = socketRef.current?.id;
  const mainSpeaker = participants.find(p => p.isSharingScreen) || participants.find(p => p.id !== selfId) || participants[0];
  const otherParticipants = participants.filter(p => p.id !== mainSpeaker?.id && p.id !== selfId);
  const selfParticipant = participants.find(p => p.id === selfId);

  
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

  const getStreamForParticipant = (participantId: string | undefined) => {
      if (!participantId) return null;
      if (participantId === selfId) return localStream;
      return remoteStreams[participantId];
  }
  
  const mainSpeakerStream = getStreamForParticipant(mainSpeaker?.id);

  const ParticipantVideo = ({ participant, stream, isMuted, isCameraOff, isLocal = false, className = '' }: { participant: Participant | undefined, stream: MediaStream | null, isMuted: boolean, isCameraOff: boolean, isLocal?: boolean, className?: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        } else if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, [stream]);

    if (!participant) return null;

    return (
        <div className={`relative aspect-video rounded-lg overflow-hidden bg-card border shadow-md ${className}`}>
            {stream && (isLocal ? !isCameraOff : !participant.isCameraOff) ? (
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted={isLocal} />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                    <VideoOff className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium">{participant.name} {isLocal && `(${t.you})`}</div>
        </div>
    );
  };


  return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <header className="flex h-16 items-center justify-between border-b px-4 shrink-0">
          <ConnectWaveLogo />
          <div className="hidden md:flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-mono text-sm font-semibold">{roomId}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyRoomId}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col p-2 sm:p-4 gap-2 sm:gap-4">
             {mainSpeaker ? (
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden bg-card border shadow-md">
                    {mainSpeakerStream && !mainSpeaker.isCameraOff ? (
                         <video 
                          ref={el => { if (el && el.srcObject !== mainSpeakerStream) el.srcObject = mainSpeakerStream }} 
                          className="w-full h-full object-contain" 
                          autoPlay playsInline muted={mainSpeaker.id === selfId}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                           <div className="text-center">
                             <VideoOff className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground" />
                              <p className="mt-2 text-muted-foreground">
                                {mainSpeaker.name}'s video is off
                              </p>
                           </div>
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-medium">{mainSpeaker.name} {mainSpeaker.id === selfId && `(${t.you})`} {mainSpeaker.isSharingScreen && `(${t.screen_sharing})`}</div>
                </div>
             ) : (
                <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden bg-card border shadow-md flex items-center justify-center">
                    <div className="text-center p-4">
                        <Users className="h-12 w-12 md:h-16 md:w-16 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">{t.welcome_to_room}</p>
                        <p className="text-sm text-muted-foreground">Invite others to join!</p>
                    </div>
                </div>
             )}
             <div className="flex gap-2 sm:gap-4 h-[100px] md:h-40 shrink-0">
                  {/* Local Video Thumbnail */}
                  {selfParticipant && (
                    <ParticipantVideo
                        participant={selfParticipant}
                        stream={localStream}
                        isMuted={isMuted}
                        isCameraOff={isCameraOff}
                        isLocal={true}
                        className="w-1/3"
                    />
                  )}
                 {otherParticipants.map((p) => (
                    <ParticipantVideo
                        key={p.id}
                        participant={p}
                        stream={getStreamForParticipant(p.id)}
                        isMuted={p.isMuted}
                        isCameraOff={p.isCameraOff}
                        className="w-1/3"
                    />
                 ))}
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
        <SettingsDialog 
            isOpen={isSettingsOpen} 
            onOpenChange={setIsSettingsOpen} 
            localStream={localStream}
            onMediaDeviceChange={handleMediaDeviceChange}
        />
        <ControlBar
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isSharingScreen}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onLeave={() => router.push('/')}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onInvite={handleInvite}
          onOpenSettings={() => setIsSettingsOpen(true)}
          t={t}
        />
      </div>
  )
}

    
