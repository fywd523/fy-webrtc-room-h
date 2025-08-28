
'use client';

import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, MessageSquare, Settings, UserPlus, ScreenShareOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type Translations } from '@/lib/translations';
import { Badge } from './ui/badge';
import { useEffect, useState } from 'react';

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
  isMobileView?: boolean;
};

const ControlButton = ({ tooltip, onClick, variant = "outline", size = "default", className, children }: { tooltip: string, onClick: () => void, variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | null | undefined, size?: "default" | "sm" | "lg" | "icon" | null | undefined, className?: string, children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant={variant} size={size} className={cn("rounded-full text-foreground hover:text-foreground", className)} onClick={onClick}>
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
  isMobileView = false,
}: ControlBarProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        };
        setIsMobile(checkIsMobile());
    }, []);

    const buttonSizeClass = isMobileView ? 'h-12 w-12' : 'h-14 w-14';
    const leaveButtonSizeClass = isMobileView ? buttonSizeClass : 'h-16 w-16';

    return (
    <TooltipProvider>
        <div className={cn(
            "flex items-center justify-center gap-2",
            isMobileView ? "flex-col" : "flex-row flex-wrap"
        )}>
          <div className={cn("flex gap-2", isMobileView ? "flex-col" : "flex-row")}>
            <ControlButton tooltip={isMuted ? t.unmute : t.mute} onClick={onToggleAudio} variant={'outline'} className={cn(buttonSizeClass, "border-0 bg-card hover:bg-muted", isMuted ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground hover:text-destructive-foreground" : "")}>
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </ControlButton>

            <ControlButton tooltip={isCameraOff ? t.start_video : t.stop_video} onClick={onToggleVideo} variant={'outline'} className={cn(buttonSizeClass, "border-0 bg-card hover:bg-muted", isCameraOff ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground hover:text-destructive-foreground" : "")}>
                {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </ControlButton>

            {!isMobile && (
              <ControlButton tooltip={isScreenSharing ? t.stop_sharing : t.share_screen} onClick={onToggleScreenShare} variant={'outline'} className={cn(buttonSizeClass, "border-0 bg-card hover:bg-muted", isScreenSharing && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}>
                  {isScreenSharing ? <ScreenShareOff className="h-6 w-6" /> : <ScreenShare className="h-6 w-6" />}
              </ControlButton>
            )}
          </div>


          <div className={cn(isMobileView ? "h-2" : "w-2 md:w-8")} />
          
          <ControlButton tooltip={t.leave_meeting} onClick={onLeave} variant="destructive" className={cn(leaveButtonSizeClass, "text-destructive-foreground hover:text-destructive-foreground")}>
            <PhoneOff className={cn(isMobileView ? "h-6 w-6" : "h-8 w-8")} />
          </ControlButton>

          <div className={cn(isMobileView ? "h-2" : "w-2 md:w-8")} />

          <div className={cn("flex gap-2", isMobileView ? "flex-col" : "flex-row")}>
            <ControlButton tooltip={t.invite_participants} onClick={onInvite} variant="outline" className={cn(buttonSizeClass, "border-0 bg-card hover:bg-muted")}>
                <UserPlus className="h-6 w-6" />
            </ControlButton>

            <div className="relative">
                <ControlButton tooltip={t.chat} onClick={onToggleChat} variant="outline" className={cn(buttonSizeClass, "border-0 bg-card hover:bg-muted")}>
                <MessageSquare className="h-6 w-6" />
                </ControlButton>
                {unreadMessages > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 p-1 h-5 w-5 flex items-center justify-center text-xs pointer-events-none">{unreadMessages}</Badge>
                )}
            </div>

            <ControlButton tooltip={t.settings} onClick={onOpenSettings} variant="outline" className={cn(buttonSizeClass, "border-0 bg-card hover:bg-muted")}>
                <Settings className="h-6 w-6" />
            </ControlButton>
          </div>
        </div>
    </TooltipProvider>
  );
}
