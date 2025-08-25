import { Waves } from 'lucide-react'

export default function ConnectWaveLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary text-primary-foreground p-2 rounded-lg">
        <Waves className="h-5 w-5" />
      </div>
      <h1 className="text-xl font-bold font-headline text-primary">ConnectWave</h1>
    </div>
  )
}
