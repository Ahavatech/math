// PM2 ecosystem file for the OAU Mathematics website.
//
// Usage:
//   pm2 start deploy/process-manager/ecosystem.config.cjs
//   pm2 save          # persist across reboots
//   pm2 startup       # generate systemd service (run the printed command)
//
// The Next.js standalone server runs from .next/standalone/server.js
// after `npm run build`. Copy .next/static and public/ into the
// standalone folder before starting — see deploy/DEPLOY.md.

module.exports = {
  apps: [
    {
      name: "maths-oau",
      script: ".next/standalone/server.js",
      cwd: "/opt/maths-oau",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
      // Restart on crash, max 10 restarts in 60s before stopping
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      // Log rotation — PM2 logrotate module handles this
      error_file: "/var/log/maths-oau/error.log",
      out_file: "/var/log/maths-oau/out.log",
      merge_logs: true,
      time: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Memory limit — restart if exceeding 512 MB (tune to the VPS RAM)
      max_memory_restart: "512M",
    },
  ],
};
