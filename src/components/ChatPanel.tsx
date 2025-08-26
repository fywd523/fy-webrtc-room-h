'use client';

import { useState, useRef, useEffect, WheelEvent } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Smile } from 'lucide-react';
import { type Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import { Translations } from '@/lib/translations';
import { Avatar, AvatarFallback } from './ui/avatar';


type ChatPanelProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
  t: Translations;
  userName: string;
};

export function ChatPanel({ isOpen, onOpenChange, messages, onSendMessage, t, userName }: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaViewport = useRef<HTMLDivElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (scrollAreaViewport.current) {
        scrollAreaViewport.current.scrollTop = scrollAreaViewport.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
      setEmojiPickerOpen(false);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prevMessage => prevMessage + emojiData.emoji);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t.chat}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-6" viewportRef={scrollAreaViewport}>
            <div className="px-6 py-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex w-full", msg.isLocal ? "justify-end" : "justify-start")}>
                        <div className="flex flex-col max-w-[80%]">
                           <div className={cn("flex items-baseline gap-2", msg.isLocal && "flex-row-reverse")}>
                                <p className="text-xs text-muted-foreground">{msg.isLocal ? userName : msg.senderName}</p>
                                <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                            </div>
                            <div className={cn("mt-1 flex items-end gap-2", msg.isLocal && "flex-row-reverse")}>
                                <Avatar className="h-8 w-8">
                                <AvatarFallback>{(msg.isLocal ? userName : msg.senderName).charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className={cn(
                                "break-words rounded-lg p-3 text-sm",
                                msg.isLocal
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted border"
                                )}>
                                    <p className="whitespace-pre-wrap break-all">{msg.text}</p>
                                </div>
                            </div>
                        </div>
                   </div>
                ))}
            </div>
        </ScrollArea>
        <div className="mt-auto bg-background pb-2">
            <div className="flex items-center gap-2">
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                    <Smile className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0" onWheel={(event: WheelEvent<HTMLDivElement>) => event.stopPropagation()}>
                    <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.AUTO} />
                </PopoverContent>
                </Popover>
                <Input
                    placeholder={t.type_message_placeholder}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} size="icon">
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
