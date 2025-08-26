
module.exports = {
  apps: [
    {
      name: 'connectwave',
      script: './node_modules/.bin/tsx',
      args: 'server.ts --port 5577 --hostname 0.0.0.0',
      instances: 1, 
      exec_mode: 'fork', // 使用 fork 模式
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
