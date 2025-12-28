import chalk from 'chalk'
import * as pm2 from '../lib/pm2.js'
import { loadAppConfigs, loadEngineConfigs } from '../lib/config.js'
import { log } from '../utils/logger.js'
import { deployApp, deployEngine } from '../lib/deploy.js'
import type { AppConfig, EngineConfig } from '../schemas/index.js'

// Start all stopped apps
export async function upCommand(): Promise<void> {
  log.banner()

  const appsMap = await loadAppConfigs()
  const enginesMap = await loadEngineConfigs()
  const apps = Array.from(appsMap.values())
  const engines = Array.from(enginesMap.values())
  const pm2Processes = await pm2.listProcesses()

  // Find stopped apps
  const stoppedApps: AppConfig[] = []
  for (const app of apps) {
    const pm2Name = app.pm2?.name || app.name
    const process = pm2Processes.find(p => p.name === pm2Name)
    if (!process || process.status !== 'online') {
      stoppedApps.push(app)
    }
  }

  // Find stopped engines
  const stoppedEngines: EngineConfig[] = []
  for (const engine of engines) {
    const pm2Name = engine.server.pm2?.name || `${engine.name}-server`
    const process = pm2Processes.find(p => p.name === pm2Name)
    if (!process || process.status !== 'online') {
      stoppedEngines.push(engine)
    }
  }

  const total = stoppedApps.length + stoppedEngines.length

  if (total === 0) {
    log.success('All apps are already running')
    return
  }

  console.log(chalk.cyan(`\nStarting ${total} stopped app${total > 1 ? 's' : ''}...\n`))

  let started = 0
  let failed = 0

  // Start engines first
  for (const engine of stoppedEngines) {
    try {
      console.log(chalk.dim(`  → Starting ${engine.name}...`))
      const result = await deployEngine(engine)
      if (result.success) {
        started++
        console.log(chalk.green(`  ✓ ${engine.name} started`))
      } else {
        failed++
        console.log(chalk.red(`  ✗ ${engine.name} failed: ${result.error}`))
      }
    } catch (error) {
      failed++
      const msg = error instanceof Error ? error.message : String(error)
      console.log(chalk.red(`  ✗ ${engine.name} failed: ${msg}`))
    }
  }

  // Start apps
  for (const app of stoppedApps) {
    try {
      console.log(chalk.dim(`  → Starting ${app.name}...`))
      const result = await deployApp(app)
      if (result.success) {
        started++
        console.log(chalk.green(`  ✓ ${app.name} started`))
      } else {
        failed++
        console.log(chalk.red(`  ✗ ${app.name} failed: ${result.error}`))
      }
    } catch (error) {
      failed++
      const msg = error instanceof Error ? error.message : String(error)
      console.log(chalk.red(`  ✗ ${app.name} failed: ${msg}`))
    }
  }

  console.log()
  if (failed === 0) {
    log.success(`All ${started} app${started > 1 ? 's' : ''} started successfully`)
  } else {
    console.log(chalk.yellow(`Started ${started}, failed ${failed}`))
  }

  // Save PM2 process list
  await pm2.saveProcessList()
}
