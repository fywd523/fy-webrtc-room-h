
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Copy,
  VideoOff,
  Users,
  Loader,
  Expand,
  Minimize,
  Maximize,
  Volume2,
  VolumeX,
  ChevronUp,
  X
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
import { cn } from '@/lib/utils'

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
  const [userName, setUserName] = useState(urlName || '')
  const [isMuted, setIsMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(true)
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isNameModalOpen, setIsNameModalOpen] = useState(!urlName);
  const [isLoading, setIsLoading] = useState(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [userMediaStream, setUserMediaStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  const [mediaConstraints, setMediaConstraints] = useState<MediaStreamConstraints>({
    video: true,
    audio: true,
  });

  const [maximizedParticipantId, setMaximizedParticipantId] = useState<string | null>(null);
  const [mutedParticipants, setMutedParticipants] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const selfId = socketRef.current?.id;

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`Creating peer connection to ${peerId}`);
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
      setMutedParticipants(prev => ({...prev, [peerId]: true})); // Mute remote streams by default
    };
    
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
      userMediaStream?.getTracks().forEach(track => track.stop());
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

          otherParticipants.forEach(p => {
            if (!peerConnections.current[p.id]) {
              console.log(`New participant ${p.name} (${p.id}) joined. Creating peer connection.`);
              const pc = createPeerConnection(p.id);
              
              const localParticipant = updatedParticipants.find(part => part.id === socketRef.current?.id);
              
              if (localParticipant && new Date(localParticipant.joinTime) < new Date(p.joinTime)) {
                console.log(`Local participant joined earlier, initiating offer to ${p.id}`);
                pc.createOffer()
                  .then(offer => pc.setLocalDescription(offer))
                  .then(() => {
                    if (socketRef.current && pc.localDescription) {
                      socketRef.current.emit('webrtc-offer', { to: p.id, offer: pc.localDescription });
                    }
                  })
                  .catch(e => console.error("Error creating offer:", e));
              } else if (localParticipant) {
                console.log(`Remote participant ${p.id} joined earlier, waiting for offer`);
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
                   setMutedParticipants(prev => {
                      const newMuted = { ...prev };
                      delete newMuted[id];
                      return newMuted;
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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setUserMediaStream(stream); // Keep a copy of user media stream
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
  
  const toggleAudio = async () => {
    let stream = localStream;
    if (!stream) {
      stream = await setupStream({ ...mediaConstraints, audio: true, video: mediaConstraints.video });
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
      stream = await setupStream({ ...mediaConstraints, video: true, audio: mediaConstraints.audio });
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
    window.location.href = newUrl;
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast({
      title: t.copied_to_clipboard,
      description: `${t.room_id}: ${roomId}`,
    })
  }

  const replaceStreamInPeers = async (newStream: MediaStream | null) => {
    const renegotiateNeededPcs: {pc: RTCPeerConnection, peerId: string}[] = [];
  
    for (const peerId in peerConnections.current) {
      const pc = peerConnections.current[peerId];
      if (!pc || pc.signalingState === 'closed') continue;
  
      const senders = pc.getSenders();
      const videoTrack = newStream?.getVideoTracks()[0] || null;
      const videoSender = senders.find(s => s.track?.kind === 'video');
  
      if (videoSender) {
        await videoSender.replaceTrack(videoTrack);
      } else if (videoTrack && newStream) {
        pc.addTrack(videoTrack, newStream);
      }
  
      const audioTrack = newStream?.getAudioTracks()[0] || null;
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      if (audioSender) {
        await audioSender.replaceTrack(audioTrack);
      } else if (audioTrack && newStream) {
        pc.addTrack(audioTrack, newStream);
      }
  
      renegotiateNeededPcs.push({pc, peerId});
    }
  
    // After replacing tracks, renegotiate if necessary
    for (const {pc, peerId} of renegotiateNeededPcs) {
      if (socketRef.current) {
        const localParticipant = participants.find(part => part.id === socketRef.current?.id);
        const remoteParticipant = participants.find(part => part.id === peerId);
        
        // Let the user who joined earlier create the offer.
        if (localParticipant && remoteParticipant && new Date(localParticipant.joinTime) < new Date(remoteParticipant.joinTime)) {
          console.log(`Local participant is initiator, creating offer for ${peerId}`);
          try {
            const offer = await pc.createOffer({ iceRestart: true }); // iceRestart might be useful
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('webrtc-offer', { to: peerId, offer: pc.localDescription });
          } catch(e) {
            console.error("Error creating offer during renegotiation:", e);
          }
        } else {
            console.log(`Remote participant ${peerId} is initiator, will wait for offer during renegotiation.`);
        }
      }
    }
  };
  
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
                 // Check state *inside* the onended handler, as it might have changed
                if (socketRef.current && isSharingScreen) {
                    toggleScreenShare(); // Will now handle state correctly
                }
            };
            
            // Keep user media stream audio track if it exists and audio is not muted
            if (userMediaStream && !isMuted) {
                const audioTrack = userMediaStream.getAudioTracks()[0];
                if (audioTrack) {
                    screenStream.addTrack(audioTrack.clone());
                }
            }

            setLocalStream(screenStream);
            setIsSharingScreen(true);
            setIsCameraOff(true); 
            socket.emit('start-sharing', { roomId, id: socket.id });
            await replaceStreamInPeers(screenStream);

        } catch (error) {
            console.error('Error sharing screen:', error);
            toast({ variant: 'destructive', title: t.screen_share_failed_title });
        }
    } else {
        socket.emit('stop-sharing', { roomId, id: socket.id });
        
        localStream?.getTracks().forEach(track => track.stop());
        
        setIsSharingScreen(false);
        
        // Restore the original user media stream if it exists
        const streamToRestore = userMediaStream || null;
        setLocalStream(streamToRestore);

        if (streamToRestore) {
            const videoTrack = streamToRestore.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = !isCameraOff;
            const audioTrack = streamToRestore.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = !isMuted;
        }

        await replaceStreamInPeers(streamToRestore);
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
            await replaceStreamInPeers(newStream);
        }
    }
  };

  const handleFullscreen = (participantId: string) => {
    const videoElement = videoRefs.current[participantId];
    if (videoElement && videoElement.requestFullscreen) {
      videoElement.requestFullscreen();
    }
  };

  const handleMaximize = (participantId: string) => {
    if (maximizedParticipantId === participantId) {
      setMaximizedParticipantId(null); // Restore
    } else {
      setMaximizedParticipantId(participantId); // Maximize
    }
  };
   const toggleRemoteMute = (participantId: string) => {
    setMutedParticipants(prev => ({
        ...prev,
        [participantId]: !prev[participantId]
    }));
  };
  
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

  const ParticipantVideo = ({ participant }: { participant: Participant | undefined }) => {
    if (!participant) return null;
    
    const stream = getStreamForParticipant(participant.id);
    const isLocal = participant.id === selfId;
    const isVideoOff = isLocal ? (isSharingScreen ? false : isCameraOff) : (
      !remoteStreams[participant.id] || !remoteStreams[participant.id].getVideoTracks().find(t => t.enabled)
    );
    const isMaximized = maximizedParticipantId === participant.id;
    const isParticipantMuted = isLocal || mutedParticipants[participant.id];

    useEffect(() => {
        const videoElement = videoRefs.current[participant.id];
        if (videoElement && stream) {
            if(videoElement.srcObject !== stream) {
               videoElement.srcObject = stream;
            }
        } else if (videoElement) {
            videoElement.srcObject = null;
        }
    }, [stream, participant.id]);

    return (
        <div className="relative group aspect-video rounded-lg overflow-hidden bg-card border shadow-md flex items-center justify-center">
            {stream && !isVideoOff ? (
                <video 
                    ref={(el) => { videoRefs.current[participant.id] = el; }}
                    className="w-full h-full object-cover" 
                    autoPlay 
                    playsInline 
                    muted={isParticipantMuted} 
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
                    <VideoOff className="h-8 w-8 md:h-12 md:w-12" />
                </div>
            )}
             <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isLocal && stream && (
                     <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white hover:text-white" onClick={() => toggleRemoteMute(participant.id)}>
                        {isParticipantMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white hover:text-white" onClick={() => handleMaximize(participant.id)}>
                    {isMaximized ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white hover:text-white" onClick={() => handleFullscreen(participant.id)}>
                    <Expand className="h-4 w-4" />
                </Button>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-2">
                <span>{participant.name} {isLocal && `(${t.you})`}</span>
                {participant.isSharingScreen && <span className="text-xs">({t.screen_sharing})</span>}
            </div>
        </div>
    );
  };

  const visibleParticipants = maximizedParticipantId
    ? participants.filter(p => p.id === maximizedParticipantId)
    : participants;

  const commonControlBarProps = {
    isMuted,
    isCameraOff,
    isScreenSharing: isSharingScreen,
    onToggleAudio: toggleAudio,
    onToggleVideo: toggleVideo,
    onToggleScreenShare: toggleScreenShare,
    onLeave: () => router.push('/'),
    onToggleChat: () => setIsChatOpen(!isChatOpen),
    onInvite: handleInvite,
    onOpenSettings: () => setIsSettingsOpen(true),
    t,
  };


  return (
      <div className="flex flex-col h-screen w-full bg-background text-foreground">
        <header className="h-16 flex items-center justify-between border-b px-4 shrink-0 z-10 bg-background fixed top-0 left-0 right-0">
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

        <main className="flex-1 overflow-y-auto mt-16 mb-24">
          <div className="flex-1 p-2 sm:p-4">
            <div className={`grid gap-2 sm:gap-4 w-full ${maximizedParticipantId ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}`}>
              {(visibleParticipants||[]).map((p) => (
                <ParticipantVideo key={p.id} participant={p} />
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
            <SettingsDialog 
              isOpen={isSettingsOpen} 
              onOpenChange={setIsSettingsOpen} 
              localStream={localStream}
              onMediaDeviceChange={handleMediaDeviceChange}
          />
        </main>
        
        {/* Desktop Footer */}
        <footer className="h-24 hidden md:flex items-center justify-center border-t px-4 shrink-0 z-10 bg-background fixed bottom-0 left-0 right-0">
          <ControlBar {...commonControlBarProps} isMobileView={false} />
        </footer>

        {/* Mobile FAB */}
        <div className="md:hidden fixed bottom-4 right-4 z-20">
            {isMobileControlsOpen && (
                 <div className="absolute bottom-16 right-0 flex flex-col items-end gap-2 mb-2">
                    <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-4 border shadow-lg">
                        <ControlBar {...commonControlBarProps} isMobileView={true} />
                    </div>
                 </div>
            )}
             <Button 
                size="icon" 
                className="rounded-full h-14 w-14 shadow-lg bg-primary hover:bg-primary/90"
                onClick={() => setIsMobileControlsOpen(!isMobileControlsOpen)}
            >
                {isMobileControlsOpen ? <X className="h-6 w-6" /> : <ChevronUp className="h-6 w-6" />}
            </Button>
        </div>
      </div>
  )
}
    

    
