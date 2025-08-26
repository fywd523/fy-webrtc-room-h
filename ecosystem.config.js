module.exports = {
  apps: [
    {
      name: 'connectwave',
      script: 'npm',
      args: 'run start',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      // 注意：这里的端口和主机名需要与您服务器的实际配置相匹配
      // 如果您在 `npm run start` 脚本中硬编码了端口，PM2 将会使用那个端口
    },
  ],
};
