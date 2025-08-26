
'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from '@/hooks/use-translation'
import { Camera, Mic, Monitor, Palette } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Label } from './ui/label'

interface SettingsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  localStream: MediaStream | null
  onMediaDeviceChange: (kind: 'audio' | 'video', deviceId: string) => void
}

const themes = [
    { name: 'Teal', primary: '180 100% 25.1%', accent: '195 37% 43.7%', bg: '220 20% 96%'},
    { name: 'Blue', primary: '221 83% 53%', accent: '217 91% 60%', bg: '222 47% 95%'},
    { name: 'Green', primary: '142 76% 36%', accent: '142 63% 42%', bg: '141 51% 95%'},
    { name: 'Purple', primary: '262 84% 58%', accent: '263 70% 50%', bg: '265 67% 96%'},
    { name: 'Orange', primary: '25 95% 53%', accent: '25 89% 48%', bg: '30 89% 96%'},
];

export function SettingsDialog({ isOpen, onOpenChange, localStream, onMediaDeviceChange }: SettingsDialogProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [audioLevel, setAudioLevel] = useState(0);
  const [activeTheme, setActiveTheme] = useState(themes[0].name);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');


  const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audio = devices.filter(device => device.kind === 'audioinput');
        const video = devices.filter(device => device.kind === 'videoinput');
        setAudioDevices(audio);
        setVideoDevices(video);

        if (localStream) {
            const currentAudioId = localStream.getAudioTracks()[0]?.getSettings().deviceId;
            const currentVideoId = localStream.getVideoTracks()[0]?.getSettings().deviceId;
            if(currentAudioId) setSelectedAudioDevice(currentAudioId);
            if(currentVideoId) setSelectedVideoDevice(currentVideoId);
        } else {
            if(audio.length > 0) setSelectedAudioDevice(audio[0].deviceId);
            if(video.length > 0) setSelectedVideoDevice(video[0].deviceId);
        }

      } catch (error) {
        console.error('Error enumerating devices:', error);
      }
  };


  useEffect(() => {
    if (isOpen) {
      getDevices();
    }
  }, [isOpen]);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrameId: number;

    if (isOpen && localStream) {
      if (videoRef.current) {
        videoRef.current.srcObject = localStream
      }
      
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);
        analyser.fftSize = 32;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateAudioLevel = () => {
            if(analyser) {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
                setAudioLevel(average * 2); // Scale for better visualization
            }
            animationFrameId = requestAnimationFrame(updateAudioLevel);
        };
        updateAudioLevel();
      } else {
        setAudioLevel(0);
      }
    } else {
      setAudioLevel(0);
    }

    return () => {
        if(animationFrameId) cancelAnimationFrame(animationFrameId);
        if(source) source.disconnect();
        if(analyser) analyser.disconnect();
        if(audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [isOpen, localStream])

  const applyTheme = (theme: typeof themes[0]) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--background', theme.bg);
    setActiveTheme(theme.name);
  };

  const handleVideoDeviceChange = (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    onMediaDeviceChange('video', deviceId);
  }

  const handleAudioDeviceChange = (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    onMediaDeviceChange('audio', deviceId);
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.settings}</DialogTitle>
          <DialogDescription>
            Adjust your media and appearance settings.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="media" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="media">
              <Monitor className="mr-2" />
              Media Test
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="mr-2" />
              Appearance
            </TabsTrigger>
          </TabsList>
          <TabsContent value="media" className="mt-4">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col items-center gap-4">
                         <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden relative">
                             {localStream?.getVideoTracks().find(t => t.enabled) ? (
                                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                             ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <Camera className="h-16 w-16" />
                                    <p>Camera is off</p>
                                </div>
                             )}
                         </div>
                         <div className="w-full space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="camera-select">Camera</Label>
                                    <Select value={selectedVideoDevice} onValueChange={handleVideoDeviceChange}>
                                        <SelectTrigger id="camera-select">
                                            <SelectValue placeholder="Select a camera" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {videoDevices.map(device => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mic-select">Microphone</Label>
                                     <Select value={selectedAudioDevice} onValueChange={handleAudioDeviceChange}>
                                        <SelectTrigger id="mic-select">
                                            <SelectValue placeholder="Select a microphone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {audioDevices.map(device => (
                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                    {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Mic className="text-muted-foreground" />
                                    <p className="text-sm font-medium">Microphone Level</p>
                                </div>
                                <Progress value={audioLevel} className="w-full" />
                            </div>
                         </div>
                    </div>
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="appearance" className="mt-4">
             <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <p className="font-medium">Theme Color</p>
                        <div className="grid grid-cols-5 gap-4">
                            {themes.map(theme => (
                                <div key={theme.name} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => applyTheme(theme)}>
                                    <div 
                                        className={cn("w-12 h-12 rounded-full border-2", activeTheme === theme.name ? "border-ring" : "border-transparent")}
                                        style={{ backgroundColor: `hsl(${theme.primary})`}}
                                    />
                                    <p className="text-sm">{theme.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
