import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname } from 'path'
import {
  type PortAllocations,
  type DeploymentsState,
  type HealthState,
  type DeploymentRecord,
  PortAllocationsSchema,
  DeploymentsStateSchema,
  HealthStateSchema,
} from '../schemas/index.js'
import {
  STATE_DIR,
  PORTS_FILE,
  DEPLOYMENTS_FILE,
  HEALTH_FILE,
  PORT_RANGES,
} from '../utils/paths.js'
import { loadAppConfigs } from './config.js'

// Ensure state directory exists
async function ensureStateDir(): Promise<void> {
  if (!existsSync(STATE_DIR)) {
    await mkdir(STATE_DIR, { recursive: true })
  }
}

// Load JSON state file
async function loadStateFile<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  defaultValue: T
): Promise<T> {
  if (!existsSync(path)) {
    return defaultValue
  }
  const content = await readFile(path, 'utf-8')
  const data = JSON.parse(content)
  return schema.parse(data)
}

// Save JSON state file
async function saveStateFile(path: string, data: unknown): Promise<void> {
  await ensureStateDir()
  await writeFile(path, JSON.stringify(data, null, 2))
}

// Default port allocations
const defaultPortAllocations: PortAllocations = {
  allocations: {},
  reserved: [4040, 8080, 9000], // Wyrt HTTP, WS, webhook
  engine_managed: {},
  ranges: {
    standard: { ...PORT_RANGES.standard, next: PORT_RANGES.standard.start },
    games: { ...PORT_RANGES.games, next: PORT_RANGES.games.start },
    special: { ...PORT_RANGES.special, next: PORT_RANGES.special.start },
  },
}

// Load port allocations
export async function loadPortAllocations(): Promise<PortAllocations> {
  return loadStateFile(PORTS_FILE, PortAllocationsSchema, defaultPortAllocations)
}

// Save port allocations
export async function savePortAllocations(state: PortAllocations): Promise<void> {
  await saveStateFile(PORTS_FILE, state)
}

// Allocate a port for an app
export async function allocatePort(
  appName: string,
  range: 'standard' | 'games' | 'special' = 'standard'
): Promise<number> {
  const state = await loadPortAllocations()

  // Check if already allocated in state
  if (state.allocations[appName]) {
    return state.allocations[appName]
  }

  // Find next available port
  const rangeConfig = state.ranges?.[range] || defaultPortAllocations.ranges![range]
  let port = rangeConfig.next

  // Collect all used ports from multiple sources
  const usedPorts = new Set([
    ...Object.values(state.allocations),
    ...state.reserved,
    ...Object.values(state.engine_managed).flat(),
  ])

  // Also check hardcoded ports in app config files
  // This prevents conflicts with ports defined directly in YAML configs
  try {
    const appConfigs = await loadAppConfigs()
    for (const [name, config] of appConfigs) {
      if (config.port && name !== appName) {
        usedPorts.add(config.port)
      }
    }
  } catch {
    // If we can't load configs, continue with state-based allocation
  }

  while (usedPorts.has(port) && port <= rangeConfig.end) {
    port++
  }

  if (port > rangeConfig.end) {
    throw new Error(`No available ports in ${range} range (${rangeConfig.start}-${rangeConfig.end})`)
  }

  // Update state
  state.allocations[appName] = port
  if (state.ranges) {
    state.ranges[range].next = port + 1
  }

  await savePortAllocations(state)
  return port
}

// Load deployments state
export async function loadDeployments(): Promise<DeploymentsState> {
  return loadStateFile(DEPLOYMENTS_FILE, DeploymentsStateSchema, {})
}

// Save deployments state
export async function saveDeployments(state: DeploymentsState): Promise<void> {
  await saveStateFile(DEPLOYMENTS_FILE, state)
}

// Record a deployment
export async function recordDeployment(
  appName: string,
  record: DeploymentRecord
): Promise<void> {
  const state = await loadDeployments()

  if (!state[appName]) {
    state[appName] = { history: [] }
  }

  state[appName].current = record.id
  state[appName].history.unshift(record)

  // Keep only recent deployments
  state[appName].history = state[appName].history.slice(0, 10)

  await saveDeployments(state)
}

// Get last successful deployment
export function getLastSuccessfulDeployment(
  state: DeploymentsState,
  appName: string
): DeploymentRecord | null {
  const history = state[appName]?.history || []
  return history.find(d => d.status === 'success') || null
}

// Load health state
export async function loadHealth(): Promise<HealthState> {
  return loadStateFile(HEALTH_FILE, HealthStateSchema, {})
}

// Save health state
export async function saveHealth(state: HealthState): Promise<void> {
  await saveStateFile(HEALTH_FILE, state)
}

// Generate deployment ID (timestamp-based)
export function generateDeploymentId(): string {
  const now = new Date()
  return now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
}
