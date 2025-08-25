'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Copy, Video } from 'lucide-react'
import ConnectWaveLogo from '@/components/ConnectWaveLogo'
import { useTranslation } from '@/hooks/use-translation'
import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function Home() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslation()
  const [roomId, setRoomId] = useState('')
  const [newRoomId, setNewRoomId] = useState('')

  const createRoom = () => {
    const newId = Math.random().toString(36).substring(2, 9)
    setNewRoomId(newId)
    toast({
      title: t.room_created_success,
      description: `${t.room_id}: ${newId}`,
    })
  }
  
  const joinRoom = (id: string) => {
    if (id.trim()) {
      router.push(`/room/${id.trim()}`)
    } else {
      toast({
        variant: 'destructive',
        title: t.error_title,
        description: t.room_id_required,
      })
    }
  }

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
    toast({
      title: t.copied_to_clipboard,
    })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex justify-between items-center p-4 border-b">
        <ConnectWaveLogo />
        <LanguageSwitcher />
      </header>
      <main className="flex-grow flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-8">
          <Card className="shadow-2xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                  <Video className="w-8 h-8" />
                </div>
              </div>
              <CardTitle className="font-headline text-3xl">{t.join_or_create_room}</CardTitle>
              <CardDescription>{t.app_description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={createRoom} className="w-full" size="lg">
                {t.create_new_room}
              </Button>
              {newRoomId && (
                <div className="p-4 bg-muted rounded-lg flex flex-col items-center gap-4">
                  <p className="text-sm text-muted-foreground">{t.your_new_room_id}</p>
                  <div className="flex items-center gap-2">
                    <strong className="text-lg font-mono text-primary">{newRoomId}</strong>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(newRoomId)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={() => joinRoom(newRoomId)} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                    {t.join_this_room}
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col space-y-2">
               <div className="relative w-full text-center">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t.or}</span>
                </div>
              </div>
              <div className="w-full flex gap-2 pt-2">
                <Input
                  type="text"
                  placeholder={t.enter_room_id}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && joinRoom(roomId)}
                  className="text-center font-mono"
                />
                <Button onClick={() => joinRoom(roomId)} variant="outline">{t.join}</Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
      <footer className="text-center p-4 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} ConnectWave. {t.all_rights_reserved}.
      </footer>
    </div>
  )
}
