<p align="center">
  <img src="https://shyp.now/assets/shyp.png" alt="Shyp" width="120" height="120">
</p>

<h1 align="center">Shyp</h1>

<p align="center">
  <strong>Zero Friction Deployment</strong>
</p>

<p align="center">
  From code to production. Shyp now.<br>
  AI-native deployment for Node.js apps on Linux.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/shyp"><img src="https://img.shields.io/npm/v/shyp.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/shyp"><img src="https://img.shields.io/npm/dm/shyp.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/shypd/shyp/blob/main/LICENSE"><img src="https://img.shields.io/github/license/shypd/shyp?style=flat-square" alt="license"></a>
  <img src="https://img.shields.io/badge/platform-linux-blue?style=flat-square" alt="platform">
</p>

<p align="center">
  <a href="https://shyp.now">Website</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#commands">Commands</a>
</p>

---

## Requirements

- **Linux/Unix** (Debian, Ubuntu, etc.)
- Node.js 20+
- PM2 (auto-installed)
- Nginx (optional, for domains)
- Git

> ⚠️ **Windows is not supported.** Shyp is designed for Linux deployment.

## Installation

```bash
npm install -g shyp
```

## Quick Start

```bash
# Initialize shyp (checks/installs prerequisites)
shyp init

# Add an app
shyp add my-app --repo git@github.com:you/my-app.git --domain my-app.com

# Apply configuration (generates nginx configs)
shyp sync

# Deploy
shyp deploy my-app

# Start webhook server for auto-deploys
shyp start
```

## Why Shyp

Modern deployment tools are either too simplistic (manual PM2 + nginx) or too complex (Kubernetes, Docker Swarm).

Shyp is the sweet spot:
- **File-based config** - YAML files an AI can read and write
- **No Docker required** - Direct PM2 + Nginx, no container overhead
- **Webhook auto-deploy** - Push to GitHub, deploy automatically
- **Multi-app management** - One server, many apps, one tool

```bash
$ shyp status

Apps
──────────────────────────────────────────────────────────────────────
NAME                 STATUS       PORT     MEMORY     UPTIME       DOMAIN
my-app               ● online     3001     156MB      2d 4h        my-app.com
api-server           ● online     3002     89MB       5d 12h       api.example.com
landing-page         ● online     3003     45MB       12d 3h       example.com
```

## Commands

| Command | Description |
|---------|-------------|
| `shyp init` | Initialize shyp, install prerequisites |
| `shyp status` | Show status of all apps |
| `shyp deploy <name>` | Deploy an app |
| `shyp add <name>` | Add a new app configuration |
| `shyp sync` | Sync configs, provision SSL certs, reload Nginx |
| `shyp ports` | Show port allocations |
| `shyp logs <name>` | View deployment logs |
| `shyp doctor` | Check system health |
| `shyp start` | Start webhook server |

## Configuration

Shyp uses YAML files in `/etc/shyp/`:

```
/etc/shyp/
├── config.yaml          # Global configuration
├── apps/                # App configurations
│   ├── my-app.yaml
│   └── ...
├── engines/             # Engine configurations (modular apps)
└── state/               # Runtime state (ports, deployments)
```

### App Configuration

```yaml
name: my-app
repo: git@github.com:you/my-app.git
branch: main
path: /var/www/my-app
type: nextjs
domain: my-app.com

build:
  command: npm ci && npm run build

start:
  command: npm start

env:
  NODE_ENV: production

resources:
  memory: 512M
  instances: 1
```

### Engine Configuration (Modular Apps)

For apps with multiple modules (like game engines):

```yaml
type: engine
name: my-engine

server:
  repo: git@github.com:you/my-engine.git
  path: /var/www/my-engine
  pm2:
    name: my-engine
    memory: 2G

modules:
  game-frontend:
    domain: game.example.com
    port: 8000
    deploy:
      mode: script
      script: deploy.sh
```

## Webhook Auto-Deploy

Set up GitHub webhooks to auto-deploy on push:

1. Go to your repo → Settings → Webhooks → Add webhook
2. **Payload URL:** `http://your-server:9000/`
3. **Content type:** `application/json`
4. **Secret:** Your `SHYP_WEBHOOK_SECRET`
5. **Events:** Just the push event

Set the secret on your server:

```bash
export SHYP_WEBHOOK_SECRET=your-secret-here
```

Start the webhook server:

```bash
shyp start
```

## AI-Native Design

Shyp is designed for AI coding assistants like Claude Code:

- **File-based** - All config in readable YAML files
- **Predictable paths** - `/etc/shyp/apps/*.yaml`
- **Idempotent** - Run `shyp sync` safely anytime
- **Clear output** - Structured status for easy parsing

```bash
# AI can easily add a new app
cat > /etc/shyp/apps/new-project.yaml << 'EOF'
name: new-project
repo: git@github.com:you/new-project.git
path: /var/www/new-project
type: nextjs
domain: new-project.com
EOF

shyp sync
shyp deploy new-project
```

## Links

- **Website:** [shyp.now](https://shyp.now)
- **GitHub:** [github.com/shypd/shyp](https://github.com/shypd/shyp)
- **Issues:** [github.com/shypd/shyp/issues](https://github.com/shypd/shyp/issues)
- **npm:** [npmjs.com/package/shyp](https://www.npmjs.com/package/shyp)

## License

MIT
