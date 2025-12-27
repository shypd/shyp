import chalk from 'chalk'
import { loadAppConfigs, loadEngineConfigs, loadGlobalConfig, isInitialized } from '../lib/config.js'
import { allocatePort, loadPortAllocations, savePortAllocations } from '../lib/state.js'
import {
  generateNginxConfig,
  generateModuleConfig,
  writeNginxConfig,
  enableNginxConfig,
  testNginxConfig,
  reloadNginx,
} from '../lib/nginx.js'
import { getCertInfo, obtainCert, isCertbotAvailable } from '../lib/ssl.js'
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

  const [apps, engines, globalConfig] = await Promise.all([
    loadAppConfigs(),
    loadEngineConfigs(),
    loadGlobalConfig(),
  ])

  // Get SSL email from config (fallback to contact@domain per-domain)
  const sslEmail = globalConfig?.server?.ssl?.email

  // Track what we're doing
  const actions: string[] = []

  // Collect all domains for SSL
  const domains: string[] = []

  // Allocate ports for apps that don't have them
  log.info('Checking port allocations...')
  for (const [name, config] of apps) {
    if (!config.port) {
      const port = await allocatePort(name, 'standard')
      config.port = port
      actions.push(`Allocated port ${port} for ${name}`)
    }
    if (config.domain) {
      domains.push(config.domain)
    }
  }

  // Collect engine module domains
  for (const [, engine] of engines) {
    for (const [, moduleConfig] of Object.entries(engine.modules)) {
      if (moduleConfig.domain) {
        domains.push(moduleConfig.domain)
      }
    }
  }

  // Provision SSL certs for domains that need them
  if (domains.length > 0 && !dryRun) {
    log.info('Checking SSL certificates...')
    const hasCertbot = await isCertbotAvailable()

    if (hasCertbot) {
      for (const domain of domains) {
        const certInfo = await getCertInfo(domain)
        if (!certInfo.exists) {
          const spinner = createSpinner(`Obtaining cert for ${domain}...`).start()
          const result = await obtainCert(domain, sslEmail)
          if (result.success) {
            spinner.succeed(`Obtained cert for ${domain}`)
            actions.push(`Obtained SSL cert for ${domain}`)
          } else {
            spinner.fail(`Failed to obtain cert for ${domain}`)
            log.dim(`  ${result.error}`)
          }
        }
      }
    } else {
      log.dim('  certbot not installed - skipping SSL provisioning')
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
