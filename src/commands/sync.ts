import chalk from 'chalk'
import { loadAppConfigs, loadEngineConfigs, isInitialized } from '../lib/config.js'
import { allocatePort, loadPortAllocations, savePortAllocations } from '../lib/state.js'
import {
  generateNginxConfig,
  generateModuleConfig,
  writeNginxConfig,
  enableNginxConfig,
  testNginxConfig,
  reloadNginx,
} from '../lib/nginx.js'
import { log } from '../utils/logger.js'
import { createSpinner } from '../utils/spinner.js'

export async function syncCommand(options: { dryRun?: boolean }): Promise<void> {
  log.banner()

  if (!isInitialized()) {
    log.error('Shyp is not initialized. Run: shyp init')
    process.exit(1)
  }

  const dryRun = options.dryRun || false

  if (dryRun) {
    log.info('Dry run mode - no changes will be made')
    console.log()
  }

  const [apps, engines] = await Promise.all([
    loadAppConfigs(),
    loadEngineConfigs(),
  ])

  // Track what we're doing
  const actions: string[] = []

  // Allocate ports for apps that don't have them
  log.info('Checking port allocations...')
  for (const [name, config] of apps) {
    if (!config.port) {
      const port = await allocatePort(name, 'standard')
      config.port = port
      actions.push(`Allocated port ${port} for ${name}`)
    }
  }

  // Generate nginx configs for apps with domains
  log.info('Generating nginx configs...')
  for (const [name, config] of apps) {
    if (!config.domain) continue

    const nginxConfig = generateNginxConfig(config)
    actions.push(`Generated nginx config for ${name} (${config.domain})`)

    if (!dryRun) {
      await writeNginxConfig(name, nginxConfig)
      await enableNginxConfig(name)
    }
  }

  // Generate nginx configs for engine modules
  for (const [engineName, engine] of engines) {
    for (const [moduleName, moduleConfig] of Object.entries(engine.modules)) {
      if (!moduleConfig.domain) continue

      const nginxConfig = generateModuleConfig(engine, moduleName, moduleConfig)
      const configName = `${engineName}-${moduleName}`
      actions.push(`Generated nginx config for ${configName} (${moduleConfig.domain})`)

      if (!dryRun) {
        await writeNginxConfig(configName, nginxConfig)
        await enableNginxConfig(configName)
      }
    }
  }

  if (actions.length === 0) {
    log.dim('No changes needed')
    return
  }

  // Display actions
  console.log()
  log.header('Actions')
  for (const action of actions) {
    log.step(action)
  }
  console.log()

  if (dryRun) {
    log.info('Dry run complete. No changes were made.')
    return
  }

  // Test nginx config
  const spinner = createSpinner('Testing nginx configuration...').start()
  const testResult = await testNginxConfig()

  if (!testResult.valid) {
    spinner.fail('Nginx configuration test failed')
    log.error(testResult.error || 'Unknown error')
    process.exit(1)
  }

  spinner.succeed('Nginx configuration is valid')

  // Reload nginx
  const reloadSpinner = createSpinner('Reloading nginx...').start()
  try {
    await reloadNginx()
    reloadSpinner.succeed('Nginx reloaded')
  } catch (error) {
    reloadSpinner.fail('Failed to reload nginx')
    throw error
  }

  console.log()
  log.success(`Sync complete. Applied ${actions.length} changes.`)
}
