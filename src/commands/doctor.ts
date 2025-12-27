import chalk from 'chalk'
import { existsSync } from 'fs'
import { isGitAvailable } from '../lib/git.js'
import { isPM2Available } from '../lib/pm2.js'
import { isNginxAvailable, testNginxConfig } from '../lib/nginx.js'
import { isInitialized } from '../lib/config.js'
import { log } from '../utils/logger.js'
import {
  SHYP_DIR,
  CONFIG_FILE,
  APPS_DIR,
  STATE_DIR,
  LOG_DIR,
  DEFAULT_SSH_KEY,
} from '../utils/paths.js'

interface Check {
  name: string
  ok: boolean
  message?: string
}

export async function doctorCommand(): Promise<void> {
  log.banner()
  console.log(chalk.bold.white('System Health Check\n'))

  const checks: Check[] = []

  // Check prerequisites
  console.log(chalk.dim('Checking prerequisites...'))

  // Git
  const gitOk = await isGitAvailable()
  checks.push({
    name: 'Git',
    ok: gitOk,
    message: gitOk ? undefined : 'Git not found in PATH',
  })

  // PM2
  const pm2Ok = await isPM2Available()
  checks.push({
    name: 'PM2',
    ok: pm2Ok,
    message: pm2Ok ? undefined : 'PM2 not found. Install with: npm install -g pm2',
  })

  // Nginx
  const nginxOk = await isNginxAvailable()
  checks.push({
    name: 'Nginx',
    ok: nginxOk,
    message: nginxOk ? undefined : 'Nginx not found. This is optional for static sites.',
  })

  // Nginx config valid
  if (nginxOk) {
    const nginxTest = await testNginxConfig()
    checks.push({
      name: 'Nginx config',
      ok: nginxTest.valid,
      message: nginxTest.valid ? undefined : nginxTest.error,
    })
  }

  // SSH key
  const sshKeyOk = existsSync(DEFAULT_SSH_KEY)
  checks.push({
    name: 'SSH key',
    ok: sshKeyOk,
    message: sshKeyOk ? DEFAULT_SSH_KEY : `Not found at ${DEFAULT_SSH_KEY}`,
  })

  // Shyp initialization
  console.log(chalk.dim('\nChecking Shyp configuration...'))

  const shypInitialized = isInitialized()
  checks.push({
    name: 'Shyp initialized',
    ok: shypInitialized,
    message: shypInitialized ? undefined : `Run: shyp init`,
  })

  // Check directories
  const dirs = [
    { name: 'Config directory', path: SHYP_DIR },
    { name: 'Apps directory', path: APPS_DIR },
    { name: 'State directory', path: STATE_DIR },
    { name: 'Log directory', path: LOG_DIR },
  ]

  for (const dir of dirs) {
    const exists = existsSync(dir.path)
    checks.push({
      name: dir.name,
      ok: exists,
      message: exists ? dir.path : `Missing: ${dir.path}`,
    })
  }

  // Display results
  console.log(chalk.bold.white('\nResults'))
  console.log(chalk.dim('─'.repeat(50)))

  let hasErrors = false
  for (const check of checks) {
    const icon = check.ok ? chalk.green('✓') : chalk.red('✗')
    const name = check.ok ? chalk.white(check.name) : chalk.red(check.name)
    console.log(`${icon} ${name}`)
    if (check.message && !check.ok) {
      console.log(chalk.dim(`  ${check.message}`))
      hasErrors = true
    }
  }

  console.log()

  if (hasErrors) {
    log.warn('Some checks failed. See above for details.')
    process.exit(1)
  } else {
    log.success('All checks passed!')
  }
}
