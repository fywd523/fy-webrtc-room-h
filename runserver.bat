@echo off
cd /d D:\codes\third\fy-webrtc-room-h
set NODE_ENV=production
npx tsx server.ts --port 5588 --hostname 0.0.0.0
