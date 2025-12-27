import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import chalk from 'chalk'
import { execa } from 'execa'
import { stringify as yamlStringify } from 'yaml'
import { isInitialized } from '../lib/config.js'
import { isPM2Available } from '../lib/pm2.js'
import { isGitAvailable } from '../lib/git.js'
import { log } from '../utils/logger.js'
import { createSpinner } from '../utils/spinner.js'
import {
  SHYP_DIR,
  CONFIG_FILE,
  APPS_DIR,
  ENGINES_DIR,
  SECRETS_DIR,
  STATE_DIR,
  LOG_DIR,
  APPS_LOG_DIR,
  DEFAULT_WEBHOOK_PORT,
} from '../utils/paths.js'

async function checkAndInstallPrereqs(): Promise<void> {
  console.log(chalk.dim('Checking prerequisites...\n'))

  // Check Git
  const hasGit = await isGitAvailable()
  if (hasGit) {
    log.success('Git is installed')
  } else {
    log.error('Git is not installed')
    log.dim('  Install: https://git-scm.com/downloads')
  }

  // Check PM2
  const hasPM2 = await isPM2Available()
  if (hasPM2) {
    log.success('PM2 is installed')
  } else {
    log.warn('PM2 is not installed')
    log.dim('  Installing PM2 globally...')
    try {
      await execa('npm', ['install', '-g', 'pm2'])
      log.success('PM2 installed successfully')
    } catch (error) {
      log.error('Failed to install PM2. Try: npm install -g pm2')
    }
  }

  // Check Nginx (just inform, don't install)
  try {
    await execa('nginx', ['-v'])
    log.success('Nginx is installed')
  } catch {
    log.dim('Nginx not found (optional - needed for domains)')
    log.dim('  Install: apt install nginx')
  }

  console.log()
}

export async function initCommand(options: { force?: boolean }): Promise<void> {
  log.banner()

  // Check and install prerequisites first
  await checkAndInstallPrereqs()

  if (isInitialized() && !options.force) {
    log.warn(`Shyp is already initialized at ${SHYP_DIR}`)
    log.dim('Use --force to reinitialize')
    return
  }

  const spinner = createSpinner('Initializing Shyp...').start()

  try {
    // Create directory structure
    const dirs = [
      SHYP_DIR,
      APPS_DIR,
      ENGINES_DIR,
      SECRETS_DIR,
      STATE_DIR,
      LOG_DIR,
      APPS_LOG_DIR,
    ]

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }
    }

    // Create default config
    const defaultConfig = {
      version: 1,
      server: {
        webhook_port: DEFAULT_WEBHOOK_PORT,
        webhook_secret: '${SHYP_WEBHOOK_SECRET}',
        port_ranges: {
          standard: { start: 3001, end: 3099 },
          games: { start: 4000, end: 4099 },
          special: { start: 5000, end: 5099 },
        },
        ssl: {
          enabled: true,
          email: 'admin@example.com',
          auto_renew: true,
        },
        defaults: {
          node_version: '23',
          build_timeout: 600,
          health_check_timeout: 30,
          max_memory: '512M',
          instances: 1,
        },
      },
      git: {
        provider: 'github',
      },
      deployment: {
        keep_releases: 3,
        health_check_retries: 3,
        rollback_on_failure: true,
      },
    }

    if (!existsSync(CONFIG_FILE)) {
      await writeFile(CONFIG_FILE, yamlStringify(defaultConfig))
    }

    // Create initial state files
    const initialPorts = {
      allocations: {},
      reserved: [4040, 8080, 9000],
      engine_managed: {},
      ranges: {
        standard: { start: 3001, end: 3099, next: 3001 },
        games: { start: 4000, end: 4099, next: 4000 },
        special: { start: 5000, end: 5099, next: 5000 },
      },
    }

    const portsFile = `${STATE_DIR}/ports.json`
    if (!existsSync(portsFile)) {
      await writeFile(portsFile, JSON.stringify(initialPorts, null, 2))
    }

    const deploymentsFile = `${STATE_DIR}/deployments.json`
    if (!existsSync(deploymentsFile)) {
      await writeFile(deploymentsFile, '{}')
    }

    spinner.succeed('Shyp initialized')

    console.log()
    console.log(chalk.dim('Created:'))
    console.log(chalk.dim(`  ${CONFIG_FILE}`))
    console.log(chalk.dim(`  ${APPS_DIR}/`))
    console.log(chalk.dim(`  ${ENGINES_DIR}/`))
    console.log(chalk.dim(`  ${STATE_DIR}/`))
    console.log()

    log.info('Next steps:')
    console.log(chalk.dim('  1. Edit config:      nano /etc/shyp/config.yaml'))
    console.log(chalk.dim('  2. Add an app:       shyp add my-app'))
    console.log(chalk.dim('  3. Start webhook:    shyp start'))
    console.log()
  } catch (error) {
    spinner.fail('Initialization failed')
    throw error
  }
}
