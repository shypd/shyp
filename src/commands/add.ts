import { writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { stringify as yamlStringify } from 'yaml'
import chalk from 'chalk'
import { input, select, confirm } from '@inquirer/prompts'
import { isInitialized, getAppConfigPath } from '../lib/config.js'
import { allocatePort } from '../lib/state.js'
import { log } from '../utils/logger.js'

interface AddOptions {
  repo?: string
  domain?: string
  type?: string
  port?: number
}

function showPrerequisites(): void {
  console.log()
  console.log(chalk.bold.cyan('Before You Deploy'))
  console.log(chalk.dim('─'.repeat(60)))
  console.log()
  console.log(chalk.yellow('Complete this checklist before adding your app:'))
  console.log()

  // 1. DNS
  console.log(chalk.bold('1. DNS Configuration'))
  console.log(chalk.dim('   Point your domain to your server\'s IP address:'))
  console.log()
  console.log(chalk.dim('   Go to your domain registrar (Namecheap, Cloudflare, etc.)'))
  console.log(chalk.dim('   → DNS settings → Add record:'))
  console.log(chalk.white('     Type: A'))
  console.log(chalk.white('     Host: @ (or leave blank for root domain)'))
  console.log(chalk.white('     Value: YOUR_SERVER_IP'))
  console.log(chalk.white('     TTL: Automatic'))
  console.log()

  // 2. Email
  console.log(chalk.bold('2. Email Forwarding (for SSL notifications)'))
  console.log(chalk.dim('   Let\'s Encrypt sends certificate expiry warnings to contact@yourdomain.com'))
  console.log()
  console.log(chalk.dim('   Option A: Domain registrar email forwarding'))
  console.log(chalk.dim('   → Email settings → Add forwarder:'))
  console.log(chalk.white('     contact@yourdomain.com → your-real-email@gmail.com'))
  console.log()
  console.log(chalk.dim('   Option B: Use a different email in the wizard below'))
  console.log()

  // 3. SSH Key
  console.log(chalk.bold('3. GitHub Deploy Key'))
  console.log(chalk.dim('   Your server needs permission to pull from your GitHub repo.'))
  console.log()
  console.log(chalk.dim('   On your server, run:'))
  console.log(chalk.white('     ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""'))
  console.log(chalk.white('     cat ~/.ssh/deploy_key.pub'))
  console.log()
  console.log(chalk.dim('   Copy the public key, then in GitHub:'))
  console.log(chalk.dim('   → Your repo → Settings → Deploy keys → Add deploy key'))
  console.log(chalk.white('     Title: "My Server"'))
  console.log(chalk.white('     Key: (paste the public key)'))
  console.log(chalk.white('     Allow write access: No (leave unchecked)'))
  console.log()

  // 4. Webhook
  console.log(chalk.bold('4. GitHub Webhook (optional - for auto-deploy on push)'))
  console.log(chalk.dim('   Automatically deploy when you push to GitHub.'))
  console.log()
  console.log(chalk.dim('   First, generate a secret on your server:'))
  console.log(chalk.white('     openssl rand -hex 32'))
  console.log(chalk.dim('   Save this secret! Add it to your server environment:'))
  console.log(chalk.white('     export SHYP_WEBHOOK_SECRET=your-generated-secret'))
  console.log()
  console.log(chalk.dim('   Then in GitHub:'))
  console.log(chalk.dim('   → Your repo → Settings → Webhooks → Add webhook'))
  console.log(chalk.white('     Payload URL: http://YOUR_SERVER_IP:9000/'))
  console.log(chalk.white('     Content type: application/json'))
  console.log(chalk.white('     Secret: (paste your SHYP_WEBHOOK_SECRET)'))
  console.log(chalk.white('     Events: Just the push event'))
  console.log(chalk.white('     Active: Yes'))
  console.log()
  console.log(chalk.dim('   After setup, run: shyp start'))
  console.log()
}

async function runWizard(name: string): Promise<{
  repo: string
  domain: string | undefined
  email: string | undefined
  type: string
}> {
  showPrerequisites()

  const proceed = await confirm({
    message: 'Have you completed the prerequisites above?',
    default: true
  })

  if (!proceed) {
    console.log()
    log.info('Complete the prerequisites first, then run shyp add again')
    process.exit(0)
  }

  console.log()
  console.log(chalk.bold.cyan(`Adding new app: ${name}`))
  console.log(chalk.dim('─'.repeat(50)))
  console.log()

  // Repository URL
  const repo = await input({
    message: 'GitHub repository URL:',
    default: `git@github.com:YOUR_ORG/${name}.git`,
    validate: (value) => {
      if (!value.includes('github.com') && !value.startsWith('git@')) {
        return 'Please enter a valid GitHub repository URL'
      }
      return true
    }
  })

  // Domain
  const domain = await input({
    message: 'Domain name (leave empty for no domain):',
    default: ''
  })

  // Email for SSL (only if domain provided)
  let email: string | undefined
  if (domain) {
    email = await input({
      message: 'Email for SSL certificates:',
      default: `contact@${domain}`
    })
  }

  // App type
  const type = await select({
    message: 'Application type:',
    choices: [
      { name: 'Next.js', value: 'nextjs', description: 'Next.js application with npm start' },
      { name: 'Node.js', value: 'node', description: 'Standard Node.js application' },
      { name: 'Static', value: 'static', description: 'Static files served by Nginx' },
      { name: 'Script', value: 'script', description: 'Custom deploy script' }
    ],
    default: 'nextjs'
  })

  return { repo, domain: domain || undefined, email, type }
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

  // Check if we should run the wizard (no options provided)
  const hasOptions = options.repo || options.domain || options.type || options.port

  let repo = options.repo
  let domain = options.domain
  let type = options.type || 'nextjs'
  let email: string | undefined

  if (!hasOptions) {
    // Run interactive wizard
    const wizardResult = await runWizard(name)
    repo = wizardResult.repo
    domain = wizardResult.domain
    type = wizardResult.type
    email = wizardResult.email
  }

  // Allocate port if not specified
  const port = options.port || await allocatePort(name, 'standard')

  // Build config
  const config: Record<string, any> = {
    name,
    description: `${name} application`,
    repo: repo || `git@github.com:YOUR_ORG/${name}.git`,
    branch: 'main',
    path: `/var/www/${name}`,
    type,
    port,
  }

  if (domain) {
    config.domain = domain
  }

  if (email) {
    config.ssl = { email }
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

  console.log()
  log.success(`Created app config: ${name}`)
  console.log()
  console.log(chalk.dim('Config file:'))
  console.log(chalk.dim(`  ${configPath}`))
  console.log()
  console.log(chalk.dim('Configuration:'))
  console.log(chalk.cyan(yaml))
  console.log()

  log.info('Next steps:')
  console.log(chalk.dim(`  1. Review the config: nano ${configPath}`))
  console.log(chalk.dim(`  2. Apply changes:     shyp sync`))
  console.log(chalk.dim(`  3. Deploy:            shyp deploy ${name}`))
  console.log()
}
