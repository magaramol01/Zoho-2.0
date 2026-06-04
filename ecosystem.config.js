module.exports = {
  apps: [
    {
      name: 'zoho-api',
      script: 'npm',
      args: 'run start',
      cwd: './apps/api',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'zoho-web',
      script: 'npm',
      args: 'run start',
      cwd: './apps/web',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
