import { execa } from 'execa'
import { mkdir, appendFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import type { AppConfig, EngineConfig, ModuleConfig } from '../schemas/index.js'
import * as git from './git.js'
import * as pm2 from './pm2.js'
import { recordDeployment, generateDeploymentId } from './state.js'
import { APPS_LOG_DIR, LOG_DIR } from '../utils/paths.js'
import { log } from '../utils/logger.js'

// Deployment result
export interface DeployResult {
  success: boolean
  deploymentId: string
  duration: number
  commit?: string
  error?: string
}

// Ensure log directories exist
async function ensureLogDir(appName: string): Promise<string> {
  const logDir = join(APPS_LOG_DIR, appName)
  if (!existsSync(logDir)) {
    await mkdir(logDir, { recursive: true })
  }
  return logDir
}

// Log to deployment file
async function logToFile(path: string, message: string): Promise<void> {
  const timestamp = new Date().toISOString()
  await appendFile(path, `[${timestamp}] ${message}\n`)
}

// Run a shell command with logging
async function runCommand(
  cmd: string,
  options: {
    cwd: string
    env?: Record<string, string>
    logFile?: string
  }
): Promise<void> {
  log.command(cmd)

  const { stdout, stderr } = await execa('bash', ['-c', cmd], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    reject: false,
  })

  if (options.logFile) {
    if (stdout) await logToFile(options.logFile, `STDOUT: ${stdout}`)
    if (stderr) await logToFile(options.logFile, `STDERR: ${stderr}`)
  }
}

// Deploy a standard app
export async function deployApp(config: AppConfig): Promise<DeployResult> {
  const deploymentId = generateDeploymentId()
  const startTime = Date.now()

  // Set up logging
  const logDir = await ensureLogDir(config.name)
  const logFile = join(logDir, `${deploymentId}.log`)

  try {
    await logToFile(logFile, `=== Starting deployment for ${config.name} ===`)

    // Ensure repo is cloned
    log.step('Checking repository...')
    await git.ensureCloned(config.repo, config.path, {
      branch: config.branch,
      sshKey: config.sshKey,
    })

    // Pull latest changes
    log.step('Pulling latest changes...')
    await git.pull(config.path, config.branch, { sshKey: config.sshKey })
    const commit = await git.getShortCommit(config.path)
    await logToFile(logFile, `Pulled commit: ${commit}`)

    // Stop existing process (for PM2 deployments)
    if (config.deploy?.mode !== 'script') {
      const pm2Name = config.pm2?.name || config.name
      log.step(`Stopping ${pm2Name}...`)
      await pm2.stopProcess(pm2Name)
    }

    // Run build command
    const buildCmd = config.build?.command || 'npm ci && npm run build'
    log.step('Building...')
    await runCommand(buildCmd, {
      cwd: config.path,
      env: config.env,
      logFile,
    })

    // Start or run deploy script
    if (config.deploy?.mode === 'script' && config.deploy.script) {
      // Script-based deployment
      log.step(`Running deploy script: ${config.deploy.script}`)
      await runCommand(`chmod +x ${config.deploy.script} && ${config.deploy.script}`, {
        cwd: config.path,
        env: config.env,
        logFile,
      })
    } else {
      // PM2-based deployment
      const pm2Name = config.pm2?.name || config.name
      const startCmd = config.start?.command || 'npm start'

      log.step(`Starting ${pm2Name}...`)

      // Delete old process and start fresh
      await pm2.deleteProcess(pm2Name)

      // Build environment with PORT from config
      const processEnv: Record<string, string> = { ...config.env }
      if (config.port) {
        processEnv.PORT = String(config.port)
      }

      await pm2.startProcess(pm2Name, startCmd, {
        cwd: config.path,
        env: processEnv,
        instances: config.resources?.instances || 1,
        maxMemory: config.resources?.memory || '512M',
      })

      await pm2.saveProcessList()
    }

    const duration = Date.now() - startTime
    await logToFile(logFile, `=== Deployment complete (${duration}ms) ===`)

    // Record deployment
    await recordDeployment(config.name, {
      id: deploymentId,
      commit,
      timestamp: new Date().toISOString(),
      status: 'success',
      duration_ms: duration,
    })

    return {
      success: true,
      deploymentId,
      duration,
      commit,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    await logToFile(logFile, `=== Deployment FAILED: ${errorMessage} ===`)

    await recordDeployment(config.name, {
      id: deploymentId,
      timestamp: new Date().toISOString(),
      status: 'failed',
      duration_ms: duration,
      error: errorMessage,
    })

    return {
      success: false,
      deploymentId,
      duration,
      error: errorMessage,
    }
  }
}

// Deploy an engine module
export async function deployModule(
  engine: EngineConfig,
  moduleName: string,
  moduleConfig: ModuleConfig
): Promise<DeployResult> {
  const fullName = `${engine.name}/${moduleName}`
  const deploymentId = generateDeploymentId()
  const startTime = Date.now()

  const logDir = await ensureLogDir(fullName.replace('/', '-'))
  const logFile = join(logDir, `${deploymentId}.log`)

  try {
    await logToFile(logFile, `=== Starting module deployment for ${fullName} ===`)

    // Determine module path
    const modulePath = moduleConfig.subpath
      ? join(engine.server.path, moduleConfig.subpath)
      : engine.server.path // Module within engine directory

    // If module has its own repo, clone/pull it
    if (moduleConfig.repo) {
      log.step('Updating module repository...')
      await git.ensureCloned(moduleConfig.repo, modulePath, {
        branch: moduleConfig.branch,
      })
      await git.pull(modulePath, moduleConfig.branch)
    }

    const commit = await git.getShortCommit(modulePath)

    // Run deploy script or build
    if (moduleConfig.deploy?.mode === 'script' && moduleConfig.deploy.script) {
      log.step(`Running deploy script: ${moduleConfig.deploy.script}`)
      const scriptPath = join(modulePath, moduleConfig.deploy.script)
      await runCommand(`chmod +x ${scriptPath} && ${scriptPath}`, {
        cwd: modulePath,
        env: moduleConfig.env,
        logFile,
      })
    } else if (moduleConfig.build?.command) {
      log.step('Building module...')
      await runCommand(moduleConfig.build.command, {
        cwd: modulePath,
        env: moduleConfig.env,
        logFile,
      })
    }

    // If PM2-based, restart the process
    if (moduleConfig.deploy?.mode === 'pm2' && moduleConfig.deploy.pm2_name) {
      log.step(`Restarting ${moduleConfig.deploy.pm2_name}...`)
      await pm2.restartProcess(moduleConfig.deploy.pm2_name)
    }

    const duration = Date.now() - startTime
    await logToFile(logFile, `=== Module deployment complete (${duration}ms) ===`)

    await recordDeployment(fullName, {
      id: deploymentId,
      commit,
      timestamp: new Date().toISOString(),
      status: 'success',
      duration_ms: duration,
    })

    return {
      success: true,
      deploymentId,
      duration,
      commit,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    await logToFile(logFile, `=== Module deployment FAILED: ${errorMessage} ===`)

    await recordDeployment(fullName, {
      id: deploymentId,
      timestamp: new Date().toISOString(),
      status: 'failed',
      duration_ms: duration,
      error: errorMessage,
    })

    return {
      success: false,
      deploymentId,
      duration,
      error: errorMessage,
    }
  }
}

// Deploy the engine server itself
export async function deployEngine(engine: EngineConfig): Promise<DeployResult> {
  const deploymentId = generateDeploymentId()
  const startTime = Date.now()

  const logDir = await ensureLogDir(engine.name)
  const logFile = join(logDir, `${deploymentId}.log`)

  try {
    await logToFile(logFile, `=== Starting engine deployment for ${engine.name} ===`)

    const serverConfig = engine.server

    // Clone/pull engine repo
    log.step('Updating engine repository...')
    await git.ensureCloned(serverConfig.repo, serverConfig.path, {
      branch: serverConfig.branch,
      sshKey: serverConfig.sshKey,
    })
    await git.pull(serverConfig.path, serverConfig.branch, {
      sshKey: serverConfig.sshKey,
    })
    const commit = await git.getShortCommit(serverConfig.path)

    // Stop engine process
    const pm2Name = serverConfig.pm2?.name || engine.name
    log.step(`Stopping ${pm2Name}...`)
    await pm2.stopProcess(pm2Name)

    // Build
    const buildCmd = serverConfig.build?.command || 'npm ci'
    log.step('Building engine...')
    await runCommand(buildCmd, {
      cwd: serverConfig.path,
      logFile,
    })

    // Start engine
    const startCmd = serverConfig.start?.command || 'npm start'
    log.step(`Starting ${pm2Name}...`)
    await pm2.deleteProcess(pm2Name)
    await pm2.startProcess(pm2Name, startCmd, {
      cwd: serverConfig.path,
      instances: serverConfig.pm2?.instances || 1,
      maxMemory: serverConfig.pm2?.memory || '2G',
    })
    await pm2.saveProcessList()

    const duration = Date.now() - startTime
    await logToFile(logFile, `=== Engine deployment complete (${duration}ms) ===`)

    await recordDeployment(engine.name, {
      id: deploymentId,
      commit,
      timestamp: new Date().toISOString(),
      status: 'success',
      duration_ms: duration,
    })

    return {
      success: true,
      deploymentId,
      duration,
      commit,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    await logToFile(logFile, `=== Engine deployment FAILED: ${errorMessage} ===`)

    await recordDeployment(engine.name, {
      id: deploymentId,
      timestamp: new Date().toISOString(),
      status: 'failed',
      duration_ms: duration,
      error: errorMessage,
    })

    return {
      success: false,
      deploymentId,
      duration,
      error: errorMessage,
    }
  }
}
