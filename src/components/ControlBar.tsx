'use client';

import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, MessageSquare, Settings, UserPlus, ScreenShareOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type Translations } from '@/lib/translations';
import { Badge } from './ui/badge';

type ControlBarProps = {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  onInvite: () => void;
  t: Translations;
  unreadMessages?: number;
};

const ControlButton = ({ tooltip, onClick, variant, size = "default", className, children }: { tooltip: string, onClick: () => void, variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | null | undefined, size?: "default" | "sm" | "lg" | "icon" | null | undefined, className?: string, children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant={variant} size={size} className={cn("rounded-full", className)} onClick={onClick}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{tooltip}</p>
    </TooltipContent>
  </Tooltip>
);

export function ControlBar({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
  onToggleChat,
  onOpenSettings,
  onInvite,
  t,
  unreadMessages = 0,
}: ControlBarProps) {
  return (
    <TooltipProvider>
      <footer className="flex h-24 items-center justify-center border-t bg-background/80 backdrop-blur-sm shrink-0 px-4 md:px-8">
        <div className="flex items-center justify-center gap-3 md:gap-4">
          <ControlButton tooltip={isMuted ? t.unmute : t.mute} onClick={onToggleAudio} variant={isMuted ? 'destructive' : 'outline'} className={cn("h-14 w-14", !isMuted && "bg-secondary")}>
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </ControlButton>

          <ControlButton tooltip={isCameraOff ? t.start_video : t.stop_video} onClick={onToggleVideo} variant={isCameraOff ? 'destructive' : 'outline'} className={cn("h-14 w-14", !isCameraOff && "bg-secondary")}>
            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </ControlButton>

          <ControlButton tooltip={isScreenSharing ? t.stop_sharing : t.share_screen} onClick={onToggleScreenShare} variant={isScreenSharing ? 'default' : 'outline'} className={cn("h-14 w-14", !isScreenSharing && "bg-secondary")}>
             {isScreenSharing ? <ScreenShareOff className="h-6 w-6" /> : <ScreenShare className="h-6 w-6" />}
          </ControlButton>

          <div className="w-4 md:w-8" />
          
          <ControlButton tooltip={t.leave_meeting} onClick={onLeave} variant="destructive" className="h-16 w-16">
            <PhoneOff className="h-8 w-8" />
          </ControlButton>

          <div className="w-4 md:w-8" />

          <ControlButton tooltip={t.invite_participants} onClick={onInvite} variant="outline" className="h-14 w-14 bg-secondary">
            <UserPlus className="h-6 w-6" />
          </ControlButton>

          <div className="relative">
            <ControlButton tooltip={t.chat} onClick={onToggleChat} variant="outline" className="h-14 w-14 bg-secondary">
              <MessageSquare className="h-6 w-6" />
            </ControlButton>
            {unreadMessages > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 p-1 h-5 w-5 flex items-center justify-center text-xs pointer-events-none">{unreadMessages}</Badge>
            )}
          </div>

          <ControlButton tooltip={t.settings} onClick={onOpenSettings} variant="outline" className="h-14 w-14 bg-secondary">
            <Settings className="h-6 w-6" />
          </ControlButton>
        </div>
      </footer>
    </TooltipProvider>
  );
}
