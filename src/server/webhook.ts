import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { loadAppConfigs, loadEngineConfigs, loadGlobalConfig } from '../lib/config.js'
import { deployApp, deployModule } from '../lib/deploy.js'
import { log } from '../utils/logger.js'

// Verify GitHub webhook signature
export function verifySignature(
  secret: string,
  payload: string,
  signature: string | undefined
): boolean {
  if (!signature) return false

  const hmac = crypto.createHmac('sha256', secret)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
  } catch {
    return false
  }
}

// Deployment queue to prevent concurrent deploys
const deploymentQueue: Map<string, Promise<void>> = new Map()

async function queueDeployment(name: string, fn: () => Promise<void>): Promise<void> {
  // Wait for any existing deployment to finish
  const existing = deploymentQueue.get(name)
  if (existing) {
    await existing.catch(() => { }) // Ignore errors from previous
  }

  // Queue this deployment
  const promise = fn()
  deploymentQueue.set(name, promise)

  try {
    await promise
  } finally {
    deploymentQueue.delete(name)
  }
}

// Find app config by repository name
async function findAppByRepo(
  repoFullName: string,
  repoName: string
): Promise<{ type: 'app' | 'module'; name: string; config: any; engine?: any } | null> {
  const apps = await loadAppConfigs()
  const engines = await loadEngineConfigs()

  // Check apps first
  for (const [name, config] of apps) {
    // Extract repo name from URL (e.g., git@github.com:user/repo.git -> user/repo)
    const repoFromUrl = config.repo
      .replace(/.*github\.com[:/]/, '')
      .replace(/\.git$/, '')

    if (repoFromUrl === repoFullName || repoFromUrl.endsWith(`/${repoName}`)) {
      return { type: 'app', name, config }
    }
  }

  // Check engine modules
  for (const [engineName, engine] of engines) {
    for (const [moduleName, moduleConfig] of Object.entries(engine.modules)) {
      if (moduleConfig.repo) {
        const repoFromUrl = moduleConfig.repo
          .replace(/.*github\.com[:/]/, '')
          .replace(/\.git$/, '')

        if (repoFromUrl === repoFullName || repoFromUrl.endsWith(`/${repoName}`)) {
          return { type: 'module', name: moduleName, config: moduleConfig, engine }
        }
      }
    }
  }

  return null
}

// Webhook handler middleware
export function createWebhookHandler(secret: string) {
  return async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    const event = req.headers['x-github-event'] as string | undefined

    // Log webhook receipt
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    log.dim(`Webhook received from ${ip}`)

    // Verify signature
    const rawBody = JSON.stringify(req.body)
    if (!verifySignature(secret, rawBody, signature)) {
      log.error('Invalid webhook signature')
      res.status(401).send('Unauthorized')
      return
    }

    // Only handle push events
    if (event !== 'push') {
      log.dim(`Ignoring event: ${event}`)
      res.status(200).send(`Event ${event} ignored`)
      return
    }

    const { repository, ref } = req.body
    if (!repository || !ref) {
      res.status(400).send('Invalid payload')
      return
    }

    const repoName = repository.name
    const repoFullName = repository.full_name
    const branch = ref.split('/').pop()

    log.info(`Push to ${repoFullName} (${branch})`)

    // Find matching app or module
    const match = await findAppByRepo(repoFullName, repoName)
    if (!match) {
      log.dim(`No config found for ${repoFullName}`)
      res.status(200).send('Repository not configured')
      return
    }

    // Check branch matches
    const expectedBranch = match.config.branch || 'main'
    if (branch !== expectedBranch) {
      log.dim(`Ignoring push to ${branch}, expected ${expectedBranch}`)
      res.status(200).send(`Branch ${branch} ignored`)
      return
    }

    // Respond immediately
    res.status(200).send('Deployment started')

    // Queue deployment in background
    const deployName = match.type === 'module'
      ? `${match.engine.name}/${match.name}`
      : match.name

    queueDeployment(deployName, async () => {
      try {
        if (match.type === 'app') {
          await deployApp(match.config)
          log.success(`Deployed ${match.name}`)
        } else {
          await deployModule(match.engine, match.name, match.config)
          log.success(`Deployed module ${match.engine.name}/${match.name}`)
        }
      } catch (error) {
        log.error(`Deployment failed for ${deployName}: ${error}`)
      }
    })
  }
}

// Health check handler
export function healthHandler(req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  })
}

// Manual deploy handler
export function createManualDeployHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    const { name } = req.params

    log.info(`Manual deployment triggered for ${name}`)

    const apps = await loadAppConfigs()
    const config = apps.get(name)

    if (!config) {
      res.status(404).send(`App not found: ${name}`)
      return
    }

    res.status(200).send(`Deployment started for ${name}`)

    queueDeployment(name, async () => {
      try {
        await deployApp(config)
        log.success(`Deployed ${name}`)
      } catch (error) {
        log.error(`Deployment failed for ${name}: ${error}`)
      }
    })
  }
}
