import chalk from 'chalk'
import { loadAppConfigs, loadEngineConfigs, isInitialized } from '../lib/config.js'
import { listProcesses, formatMemory, formatUptime, type PM2Process } from '../lib/pm2.js'
import { loadPortAllocations, loadDeployments } from '../lib/state.js'
import { log } from '../utils/logger.js'

export async function statusCommand(): Promise<void> {
  log.banner()

  if (!isInitialized()) {
    log.error('Shyp is not initialized. Run: shyp init')
    process.exit(1)
  }

  // Load all data in parallel
  const [apps, engines, processes, ports, deployments] = await Promise.all([
    loadAppConfigs(),
    loadEngineConfigs(),
    listProcesses(),
    loadPortAllocations(),
    loadDeployments(),
  ])

  // Create process lookup
  const processMap = new Map<string, PM2Process>()
  for (const p of processes) {
    processMap.set(p.name, p)
  }

  // Display apps
  if (apps.size > 0) {
    console.log(chalk.bold.white('\nApps'))
    console.log(chalk.dim('─'.repeat(70)))

    console.log(
      chalk.dim('NAME'.padEnd(20)),
      chalk.dim('STATUS'.padEnd(12)),
      chalk.dim('PORT'.padEnd(8)),
      chalk.dim('MEMORY'.padEnd(10)),
      chalk.dim('UPTIME'.padEnd(12)),
      chalk.dim('DOMAIN')
    )

    for (const [name, config] of apps) {
      const pm2Name = config.pm2?.name || name
      const proc = processMap.get(pm2Name)
      const port = config.port || ports.allocations[name] || '-'

      const status = proc?.status || 'stopped'
      const statusColor = status === 'online' ? chalk.green : chalk.red
      const statusIcon = status === 'online' ? '●' : '○'

      console.log(
        chalk.white(name.padEnd(20)),
        statusColor(`${statusIcon} ${status}`.padEnd(12)),
        chalk.cyan(String(port).padEnd(8)),
        chalk.dim((proc ? formatMemory(proc.memory) : '-').padEnd(10)),
        chalk.dim((proc ? formatUptime(proc.uptime) : '-').padEnd(12)),
        chalk.yellow(config.domain || '-')
      )
    }
  }

  // Display engines
  if (engines.size > 0) {
    console.log(chalk.bold.white('\nEngines'))
    console.log(chalk.dim('─'.repeat(70)))

    for (const [name, config] of engines) {
      const pm2Name = config.server.pm2?.name || name
      const proc = processMap.get(pm2Name)

      const status = proc?.status || 'stopped'
      const statusColor = status === 'online' ? chalk.green : chalk.red
      const statusIcon = status === 'online' ? '●' : '○'

      console.log(
        chalk.white(name.padEnd(20)),
        statusColor(`${statusIcon} ${status}`.padEnd(12)),
        chalk.dim('Engine'),
        chalk.dim(proc ? formatMemory(proc.memory) : '')
      )

      // Display modules
      const modules = Object.entries(config.modules)
      if (modules.length > 0) {
        for (const [moduleName, moduleConfig] of modules) {
          const moduleProc = moduleConfig.deploy?.pm2_name
            ? processMap.get(moduleConfig.deploy.pm2_name)
            : null

          const moduleStatus = moduleProc?.status || (status === 'online' ? 'managed' : 'stopped')
          const moduleStatusColor = moduleStatus === 'online' || moduleStatus === 'managed' ? chalk.green : chalk.red
          const moduleIcon = moduleStatus === 'online' || moduleStatus === 'managed' ? '●' : '○'

          console.log(
            chalk.dim('  └─'),
            chalk.white(moduleName.padEnd(16)),
            moduleStatusColor(`${moduleIcon} ${moduleStatus}`.padEnd(12)),
            chalk.cyan(String(moduleConfig.port).padEnd(8)),
            chalk.yellow(moduleConfig.domain || '-')
          )
        }
      }
    }
  }

  if (apps.size === 0 && engines.size === 0) {
    log.dim('\nNo apps or engines configured.')
    log.dim('Add an app:    shyp add <name>')
    log.dim('Import apps:   shyp import')
  }

  console.log()
}
