import chalk from 'chalk'
import { loadAppConfigs, loadEngineConfigs, isInitialized } from '../lib/config.js'
import { listProcesses, formatMemory, formatUptime, type PM2Process } from '../lib/pm2.js'
import { loadPortAllocations, loadDeployments } from '../lib/state.js'
import { getCertInfo, formatCertStatus, type CertInfo } from '../lib/ssl.js'
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

  // Collect all domains for cert checking
  const domains: string[] = []
  for (const [, config] of apps) {
    if (config.domain) domains.push(config.domain)
  }
  for (const [, config] of engines) {
    for (const [, mod] of Object.entries(config.modules)) {
      if (mod.domain) domains.push(mod.domain)
    }
  }

  // Get cert info for all domains
  const certMap = new Map<string, CertInfo>()
  for (const domain of domains) {
    const info = await getCertInfo(domain)
    certMap.set(domain, info)
  }

  // Display apps
  if (apps.size > 0) {
    console.log(chalk.bold.white('\nApps'))
    console.log(chalk.dim('─'.repeat(80)))

    console.log(
      chalk.dim('NAME'.padEnd(18)),
      chalk.dim('STATUS'.padEnd(12)),
      chalk.dim('PORT'.padEnd(6)),
      chalk.dim('MEM'.padEnd(8)),
      chalk.dim('UPTIME'.padEnd(10)),
      chalk.dim('SSL'.padEnd(6)),
      chalk.dim('DOMAIN')
    )

    for (const [name, config] of apps) {
      const pm2Name = config.pm2?.name || name
      const proc = processMap.get(pm2Name)
      const port = config.port || ports.allocations[name] || '-'

      const status = proc?.status || 'stopped'
      const statusColor = status === 'online' ? chalk.green : chalk.red
      const statusIcon = status === 'online' ? '●' : '○'

      // Get cert status
      const certInfo = config.domain ? certMap.get(config.domain) : null
      const cert = certInfo ? formatCertStatus(certInfo) : { text: '-', color: 'dim' as const }
      const certColor = cert.color === 'green' ? chalk.green :
                        cert.color === 'yellow' ? chalk.yellow :
                        cert.color === 'red' ? chalk.red : chalk.dim

      console.log(
        chalk.white(name.padEnd(18)),
        statusColor(`${statusIcon} ${status}`.padEnd(12)),
        chalk.cyan(String(port).padEnd(6)),
        chalk.dim((proc ? formatMemory(proc.memory) : '-').padEnd(8)),
        chalk.dim((proc ? formatUptime(proc.uptime) : '-').padEnd(10)),
        certColor(cert.text.padEnd(6)),
        chalk.yellow(config.domain || '-')
      )
    }
  }

  // Display engines
  if (engines.size > 0) {
    console.log(chalk.bold.white('\nEngines'))
    console.log(chalk.dim('─'.repeat(80)))

    for (const [name, config] of engines) {
      const pm2Name = config.server.pm2?.name || name
      const proc = processMap.get(pm2Name)

      const status = proc?.status || 'stopped'
      const statusColor = status === 'online' ? chalk.green : chalk.red
      const statusIcon = status === 'online' ? '●' : '○'

      console.log(
        chalk.white(name.padEnd(18)),
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

          // Get cert status for module
          const modCertInfo = moduleConfig.domain ? certMap.get(moduleConfig.domain) : null
          const modCert = modCertInfo ? formatCertStatus(modCertInfo) : { text: '-', color: 'dim' as const }
          const modCertColor = modCert.color === 'green' ? chalk.green :
                               modCert.color === 'yellow' ? chalk.yellow :
                               modCert.color === 'red' ? chalk.red : chalk.dim

          console.log(
            chalk.dim('  └─'),
            chalk.white(moduleName.padEnd(14)),
            moduleStatusColor(`${moduleIcon} ${moduleStatus}`.padEnd(12)),
            chalk.cyan(String(moduleConfig.port).padEnd(6)),
            modCertColor(modCert.text.padEnd(6)),
            chalk.yellow(moduleConfig.domain || '-')
          )
        }
      }
    }
  }

  if (apps.size === 0 && engines.size === 0) {
    log.dim('\nNo apps or engines configured.')
    log.dim('Add an app: shyp add <name>')
  }

  console.log()
}
