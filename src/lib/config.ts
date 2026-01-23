import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { parse as parseYaml } from 'yaml'
import {
  type GlobalConfig,
  type AppConfig,
  type EngineConfig,
  parseGlobalConfig,
  parseAppConfig,
  parseEngineConfig,
} from '../schemas/index.js'
import {
  CONFIG_FILE,
  APPS_DIR,
  ENGINES_DIR,
} from '../utils/paths.js'

// Resolve environment variable references like ${VAR_NAME}
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || ''
  })
}

// Recursively resolve env vars in object
function resolveEnvVarsDeep(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVarsDeep)
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsDeep(value)
    }
    return result
  }
  return obj
}

// Load and parse a YAML file
async function loadYamlFile<T>(
  path: string,
  parser: (data: unknown) => T
): Promise<T> {
  const content = await readFile(path, 'utf-8')
  const data = parseYaml(content)
  const resolved = resolveEnvVarsDeep(data)
  return parser(resolved)
}

// Load global configuration
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error(`Config file not found: ${CONFIG_FILE}`)
  }
  return loadYamlFile(CONFIG_FILE, parseGlobalConfig)
}

// Load all app configurations
export async function loadAppConfigs(): Promise<Map<string, AppConfig>> {
  const apps = new Map<string, AppConfig>()

  if (!existsSync(APPS_DIR)) {
    return apps
  }

  const files = await readdir(APPS_DIR)
  for (const file of files) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue

    const path = join(APPS_DIR, file)
    try {
      const config = await loadYamlFile(path, parseAppConfig)
      apps.set(config.name, config)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to load ${file}:`, message)
    }
  }

  return apps
}

// Load a single app configuration
export async function loadAppConfig(name: string): Promise<AppConfig | null> {
  const yamlPath = join(APPS_DIR, `${name}.yaml`)
  const ymlPath = join(APPS_DIR, `${name}.yml`)

  const path = existsSync(yamlPath) ? yamlPath : existsSync(ymlPath) ? ymlPath : null
  if (!path) return null

  return loadYamlFile(path, parseAppConfig)
}

// Load all engine configurations
export async function loadEngineConfigs(): Promise<Map<string, EngineConfig>> {
  const engines = new Map<string, EngineConfig>()

  if (!existsSync(ENGINES_DIR)) {
    return engines
  }

  const files = await readdir(ENGINES_DIR)
  for (const file of files) {
    if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue

    const path = join(ENGINES_DIR, file)
    try {
      const config = await loadYamlFile(path, parseEngineConfig)
      engines.set(config.name, config)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to load engine ${file}:`, message)
    }
  }

  return engines
}

// Load a single engine configuration
export async function loadEngineConfig(name: string): Promise<EngineConfig | null> {
  const yamlPath = join(ENGINES_DIR, `${name}.yaml`)
  const ymlPath = join(ENGINES_DIR, `${name}.yml`)

  const path = existsSync(yamlPath) ? yamlPath : existsSync(ymlPath) ? ymlPath : null
  if (!path) return null

  return loadYamlFile(path, parseEngineConfig)
}

// Check if shyp is initialized
export function isInitialized(): boolean {
  return existsSync(CONFIG_FILE)
}

// Get app config file path
export function getAppConfigPath(name: string): string {
  return join(APPS_DIR, `${name}.yaml`)
}

// Get engine config file path
export function getEngineConfigPath(name: string): string {
  return join(ENGINES_DIR, `${name}.yaml`)
}
