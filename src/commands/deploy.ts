import { loadAppConfig, loadEngineConfig, isInitialized } from '../lib/config.js'
import { deployApp, deployEngine, deployModule } from '../lib/deploy.js'
import { log } from '../utils/logger.js'
import { createSpinner } from '../utils/spinner.js'

export async function deployCommand(
  name: string,
  options: { module?: string }
): Promise<void> {
  log.banner()

  if (!isInitialized()) {
    log.error('Shyp is not initialized. Run: shyp init')
    process.exit(1)
  }

  // Check if deploying an engine module
  if (options.module) {
    await deployEngineModule(name, options.module)
    return
  }

  // Try to find as app first
  const appConfig = await loadAppConfig(name)
  if (appConfig) {
    await deployAppByConfig(name, appConfig)
    return
  }

  // Try as engine
  const engineConfig = await loadEngineConfig(name)
  if (engineConfig) {
    await deployEngineByConfig(name, engineConfig)
    return
  }

  log.error(`App or engine not found: ${name}`)
  log.dim('Run "shyp status" to see available apps')
  process.exit(1)
}

async function deployAppByConfig(name: string, config: any): Promise<void> {
  log.info(`Deploying ${name}...`)
  console.log()

  const spinner = createSpinner('Deploying...').start()

  const result = await deployApp(config)

  if (result.success) {
    spinner.succeed(`Deployed ${name}`)
    console.log()
    log.row('Commit:', result.commit || '-')
    log.row('Duration:', `${Math.round(result.duration / 1000)}s`)
    log.row('Deployment ID:', result.deploymentId)
  } else {
    spinner.fail(`Deployment failed`)
    console.log()
    log.error(result.error || 'Unknown error')
    process.exit(1)
  }
}

async function deployEngineByConfig(name: string, config: any): Promise<void> {
  log.info(`Deploying engine ${name}...`)
  log.warn('This will restart the engine and all managed modules')
  console.log()

  const spinner = createSpinner('Deploying engine...').start()

  const result = await deployEngine(config)

  if (result.success) {
    spinner.succeed(`Deployed engine ${name}`)
    console.log()
    log.row('Commit:', result.commit || '-')
    log.row('Duration:', `${Math.round(result.duration / 1000)}s`)
    log.row('Deployment ID:', result.deploymentId)
  } else {
    spinner.fail(`Engine deployment failed`)
    console.log()
    log.error(result.error || 'Unknown error')
    process.exit(1)
  }
}

async function deployEngineModule(engineName: string, moduleName: string): Promise<void> {
  const engineConfig = await loadEngineConfig(engineName)
  if (!engineConfig) {
    log.error(`Engine not found: ${engineName}`)
    process.exit(1)
  }

  const moduleConfig = engineConfig.modules[moduleName]
  if (!moduleConfig) {
    log.error(`Module not found: ${moduleName} in engine ${engineName}`)
    log.dim('Available modules:')
    for (const name of Object.keys(engineConfig.modules)) {
      log.dim(`  - ${name}`)
    }
    process.exit(1)
  }

  log.info(`Deploying ${engineName}/${moduleName}...`)
  console.log()

  const spinner = createSpinner('Deploying module...').start()

  const result = await deployModule(engineConfig, moduleName, moduleConfig)

  if (result.success) {
    spinner.succeed(`Deployed ${engineName}/${moduleName}`)
    console.log()
    log.row('Commit:', result.commit || '-')
    log.row('Duration:', `${Math.round(result.duration / 1000)}s`)
    log.row('Deployment ID:', result.deploymentId)
  } else {
    spinner.fail(`Module deployment failed`)
    console.log()
    log.error(result.error || 'Unknown error')
    process.exit(1)
  }
}
