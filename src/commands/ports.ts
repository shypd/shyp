import chalk from 'chalk'
import { loadAppConfigs, loadEngineConfigs } from '../lib/config.js'
import { loadPortAllocations } from '../lib/state.js'
import { log } from '../utils/logger.js'

export async function portsCommand(): Promise<void> {
  log.banner()

  const [apps, engines, ports] = await Promise.all([
    loadAppConfigs(),
    loadEngineConfigs(),
    loadPortAllocations(),
  ])

  // Collect all port info
  interface PortInfo {
    port: number
    name: string
    type: 'app' | 'engine' | 'module' | 'reserved'
    domain?: string
  }

  const portList: PortInfo[] = []

  // Add reserved ports
  for (const port of ports.reserved) {
    portList.push({ port, name: '-', type: 'reserved' })
  }

  // Add app ports
  for (const [name, config] of apps) {
    const port = config.port || ports.allocations[name]
    if (port) {
      portList.push({ port, name, type: 'app', domain: config.domain })
    }
  }

  // Add engine ports
  for (const [name, config] of engines) {
    const serverPorts = config.server.ports || {}

    if (serverPorts.http) {
      portList.push({ port: serverPorts.http, name: `${name} (http)`, type: 'engine' })
    }
    if (serverPorts.websocket) {
      portList.push({ port: serverPorts.websocket, name: `${name} (ws)`, type: 'engine' })
    }

    // Add module ports
    for (const [moduleName, moduleConfig] of Object.entries(config.modules)) {
      portList.push({
        port: moduleConfig.port,
        name: `${name}/${moduleName}`,
        type: 'module',
        domain: moduleConfig.domain,
      })
    }
  }

  // Sort by port number
  portList.sort((a, b) => a.port - b.port)

  // Display
  console.log(chalk.bold.white('\nPort Allocations'))
  console.log(chalk.dim('─'.repeat(60)))

  console.log(
    chalk.dim('PORT'.padEnd(10)),
    chalk.dim('TYPE'.padEnd(12)),
    chalk.dim('NAME'.padEnd(25)),
    chalk.dim('DOMAIN')
  )

  for (const info of portList) {
    const typeColor = {
      app: chalk.blue,
      engine: chalk.magenta,
      module: chalk.cyan,
      reserved: chalk.dim,
    }[info.type]

    console.log(
      chalk.yellow(String(info.port).padEnd(10)),
      typeColor(info.type.padEnd(12)),
      chalk.white(info.name.padEnd(25)),
      chalk.dim(info.domain || '-')
    )
  }

  // Show ranges
  console.log(chalk.bold.white('\nPort Ranges'))
  console.log(chalk.dim('─'.repeat(40)))

  const ranges = ports.ranges || {
    standard: { start: 3001, end: 3099, next: 3001 },
    games: { start: 4000, end: 4099, next: 4000 },
    special: { start: 5000, end: 5099, next: 5000 },
  }

  for (const [rangeName, range] of Object.entries(ranges)) {
    const used = range.next - range.start
    const total = range.end - range.start + 1
    console.log(
      chalk.white(rangeName.padEnd(12)),
      chalk.dim(`${range.start}-${range.end}`),
      chalk.dim(`(${used}/${total} used)`)
    )
  }

  console.log()
}
