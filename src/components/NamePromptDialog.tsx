
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Translations } from '@/lib/translations';

interface NamePromptDialogProps {
  isOpen: boolean;
  onNameSubmit: (name: string) => void;
  t: Translations;
}

export function NamePromptDialog({ isOpen, onNameSubmit, t }: NamePromptDialogProps) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onNameSubmit(name.trim());
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle>Welcome to the Room</DialogTitle>
          <DialogDescription>
            Please enter your name to join the meeting. This name will be visible to other participants.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            id="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={!name.trim()}>
            Join Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// We need to augment the DialogContentProps to accept our custom prop
declare module '@radix-ui/react-dialog' {
    interface DialogContentProps {
        hideCloseButton?: boolean;
    }
}
