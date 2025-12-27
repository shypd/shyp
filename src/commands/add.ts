import { writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { stringify as yamlStringify } from 'yaml'
import chalk from 'chalk'
import { isInitialized, getAppConfigPath } from '../lib/config.js'
import { allocatePort } from '../lib/state.js'
import { log } from '../utils/logger.js'

interface AddOptions {
  repo?: string
  domain?: string
  type?: string
  port?: number
}

export async function addCommand(name: string, options: AddOptions): Promise<void> {
  log.banner()

  if (!isInitialized()) {
    log.error('Shyp is not initialized. Run: shyp init')
    process.exit(1)
  }

  const configPath = getAppConfigPath(name)

  if (existsSync(configPath)) {
    log.error(`App already exists: ${name}`)
    log.dim(`Config: ${configPath}`)
    process.exit(1)
  }

  // Allocate port if not specified
  const port = options.port || await allocatePort(name, 'standard')

  // Build config
  const config: Record<string, any> = {
    name,
    description: `${name} application`,
    repo: options.repo || `git@github.com:YOUR_ORG/${name}.git`,
    branch: 'main',
    path: `/var/www/${name}`,
    type: options.type || 'nextjs',
    port,
  }

  if (options.domain) {
    config.domain = options.domain
  }

  config.build = {
    command: 'npm ci && npm run build',
    timeout: 600,
  }

  config.start = {
    command: 'npm start',
  }

  config.env = {
    NODE_ENV: 'production',
  }

  config.resources = {
    memory: '512M',
    instances: 1,
  }

  config.pm2 = {
    name,
  }

  // Write config file
  const yaml = yamlStringify(config)
  await writeFile(configPath, yaml)

  log.success(`Created app config: ${name}`)
  console.log()
  console.log(chalk.dim('Config file:'))
  console.log(chalk.dim(`  ${configPath}`))
  console.log()
  console.log(chalk.dim('Configuration:'))
  console.log(chalk.cyan(yaml))
  console.log()

  log.info('Next steps:')
  console.log(chalk.dim(`  1. Edit the config:  nano ${configPath}`))
  console.log(chalk.dim(`  2. Apply changes:    shyp sync`))
  console.log(chalk.dim(`  3. Deploy:           shyp deploy ${name}`))
  console.log()
}
