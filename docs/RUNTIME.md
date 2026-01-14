# Runtime Support in Shyp

Shyp supports multiple JavaScript runtimes/package managers. This allows you to use Bun, pnpm, or yarn instead of npm for your deployments.

## Supported Runtimes

| Runtime | Install Command | Build Command | Start Command |
|---------|-----------------|---------------|---------------|
| `npm` (default) | `npm ci` | `npm ci && npm run build` | `npm start` |
| `bun` | `bun install --frozen-lockfile` | `bun install --frozen-lockfile && bun run build` | `bun start` |
| `pnpm` | `pnpm install --frozen-lockfile` | `pnpm install --frozen-lockfile && pnpm run build` | `pnpm start` |
| `yarn` | `yarn install --frozen-lockfile` | `yarn install --frozen-lockfile && yarn run build` | `yarn start` |

## Usage

### App Configuration

Add the `runtime` field to your app config:

```yaml
# /etc/shyp/apps/myapp.yaml
name: myapp
repo: git@github.com:you/myapp.git
branch: main
path: /var/www/myapp
type: nextjs
runtime: bun  # <-- specify runtime here

domain: myapp.com
port: 3000
```

### Engine Configuration

Engines and modules also support the `runtime` field:

```yaml
# /etc/shyp/engines/myengine.yaml
type: engine
name: myengine

server:
  repo: git@github.com:you/engine.git
  path: /var/www/engine
  runtime: bun  # <-- engine runtime
  pm2:
    name: myengine
    instances: 2

modules:
  api:
    name: api
    port: 3001
    runtime: bun  # <-- module runtime (can differ from engine)
```

## Overriding Commands

You can still override specific commands while using a runtime:

```yaml
name: myapp
runtime: bun

# Override just the build command
build:
  command: bun install && bun run build:production

# start will still use runtime default: bun start
```

Or override everything:

```yaml
name: myapp
runtime: bun

build:
  command: bun install && bun run typecheck && bun run build

start:
  command: bun run start:cluster
```

## Server Setup

Make sure Bun (or your chosen runtime) is installed on your VPS:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify
bun --version
```

For PM2 to work with Bun, the `bun` binary must be in the PATH for the user running shyp.

## Migration Guide

To migrate an existing app from npm to Bun:

1. Update your app config:
   ```yaml
   runtime: bun
   ```

2. Optionally commit a `bun.lockb` to your repo (Bun will create this on first install)

3. Deploy as normal:
   ```bash
   shyp deploy myapp
   ```

That's it. Shyp will use Bun commands automatically.

## Backwards Compatibility

- Configs without a `runtime` field default to `npm`
- Existing custom `build.command` and `start.command` overrides still work
- No changes required for existing deployments
