import express from 'express'
import { loadGlobalConfig } from '../lib/config.js'
import { createWebhookHandler, healthHandler, createManualDeployHandler } from './webhook.js'
import { log } from '../utils/logger.js'
import { DEFAULT_WEBHOOK_PORT } from '../utils/paths.js'

export async function startServer(): Promise<void> {
  const config = await loadGlobalConfig()
  const port = config.server.webhook_port || DEFAULT_WEBHOOK_PORT

  // Get webhook secret from config or environment
  let secret = config.server.webhook_secret || ''
  if (secret.includes('${')) {
    // Resolve env var reference
    const envVar = secret.replace(/\$\{([^}]+)\}/, '$1')
    secret = process.env[envVar] || ''
  }

  if (!secret) {
    log.warn('SHYP_WEBHOOK_SECRET not set - webhooks will be rejected')
    log.dim('Set it with: export SHYP_WEBHOOK_SECRET=your-secret')
  }

  const app = express()

  // Parse JSON bodies
  app.use(express.json())

  // Health check
  app.get('/health', healthHandler)

  // Webhook endpoint
  app.post('/', createWebhookHandler(secret))
  app.post('/webhook', createWebhookHandler(secret))

  // Manual deploy endpoint
  app.post('/deploy/:name', createManualDeployHandler())

  // Start server
  app.listen(port, () => {
    log.banner()
    log.success(`Webhook server running on port ${port}`)
    console.log()
    log.row('Health:', `http://localhost:${port}/health`)
    log.row('Webhook:', `http://localhost:${port}/`)
    log.row('Deploy:', `POST http://localhost:${port}/deploy/:name`)
    console.log()
    log.dim('Press Ctrl+C to stop')
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log.info('Shutting down...')
    process.exit(0)
  })

  process.on('SIGINT', () => {
    log.info('Shutting down...')
    process.exit(0)
  })
}
