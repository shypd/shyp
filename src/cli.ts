#!/usr/bin/env node

import { program } from 'commander'
import {
  statusCommand,
  deployCommand,
  portsCommand,
  doctorCommand,
  initCommand,
  startCommand,
  syncCommand,
  logsCommand,
  addCommand,
} from './commands/index.js'

program
  .name('shyp')
  .description('Zero friction deployment for Node.js apps')
  .version('0.1.2')

// shyp status
program
  .command('status')
  .description('Show status of all apps and engines')
  .action(statusCommand)

// shyp deploy <name>
program
  .command('deploy <name>')
  .description('Deploy an app or engine')
  .option('-m, --module <module>', 'Deploy a specific engine module')
  .action(deployCommand)

// shyp ports
program
  .command('ports')
  .description('Show port allocations')
  .action(portsCommand)

// shyp doctor
program
  .command('doctor')
  .description('Check system health and prerequisites')
  .action(doctorCommand)

// shyp init
program
  .command('init')
  .description('Initialize Shyp on this server')
  .option('-f, --force', 'Reinitialize even if already initialized')
  .action(initCommand)

// shyp start
program
  .command('start')
  .description('Start the webhook server')
  .action(startCommand)

// shyp sync
program
  .command('sync')
  .description('Apply all configs to PM2 and Nginx')
  .option('-n, --dry-run', 'Show what would be done without making changes')
  .action(syncCommand)

// shyp logs <name>
program
  .command('logs <name>')
  .description('View deployment logs for an app')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action((name, options) => logsCommand(name, { ...options, lines: parseInt(options.lines) }))

// shyp add <name>
program
  .command('add <name>')
  .description('Add a new app configuration')
  .option('-r, --repo <url>', 'Git repository URL')
  .option('-d, --domain <domain>', 'Domain name')
  .option('-t, --type <type>', 'App type (nextjs, node, static, script)')
  .option('-p, --port <port>', 'Port number')
  .action(addCommand)

// Parse arguments
program.parse()
