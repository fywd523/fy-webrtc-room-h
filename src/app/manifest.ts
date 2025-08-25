import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ConnectWave',
    short_name: 'ConnectWave',
    description: 'A modern WebRTC online meeting room application.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0F0F0',
    theme_color: '#008080',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}