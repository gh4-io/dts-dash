module.exports = {
  apps: [
    {
      name: "cvg-dashboard",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "./",
      instances: 1, // Fork mode — SQLite is single-writer
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
