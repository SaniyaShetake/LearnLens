const dotenvResult = require("dotenv").config({ quiet: true });
const config = (dotenvResult && dotenvResult.parsed) || {};

if (dotenvResult && dotenvResult.error) {
  console.warn("[ecosystem] .env not loaded (" + dotenvResult.error.message + "); relying on the process environment.");
}

const env = (name) => config[name] || process.env[name];

module.exports = {
  apps: [
    {
      name: "debe",
      // Run node directly (not through `yarn start`) so pm2 manages the real server process.
      // Requires Node >= 24 on the host (see documents/DEPLOYMENT.md).
      script: "server.js",
      args: "",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      },
      env_production: {
        ...config,
        NODE_ENV: "production"
      },
    }
  ],
  deploy: {
    production: {
      key: env("DEPLOYMENT_KEY"),
      user: env("DEPLOYMENT_USER"),
      host: [env("DEPLOYMENT_HOST")],
      ref: "origin/main",
      repo: "git@github.com:IITB-EdTech/tcherly.git",
      path: "~/debe",
      "forward-agent": true,
      // Aborts on Node < 24, installs exactly the locked dependencies (backend + Vite client),
      // builds the client into client/build and (re)starts the app.
      "post-deploy": [
        `node -e "if (+process.versions.node.split('.')[0] < 24) { console.error('Node >= 24 required, found ' + process.version); process.exit(1) }"`,
        "yarn install --frozen-lockfile",
        // the Vite build needs the client devDependencies even when NODE_ENV=production
        "yarn --cwd client install --frozen-lockfile --production=false",
        "yarn build",
        "pm2 startOrRestart ecosystem.config.js --env production --update-env",
      ].join(" && "),
    }
  }
};
