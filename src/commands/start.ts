import { isInitialized } from '../lib/config.js'
import { startServer } from '../server/index.js'
import { log } from '../utils/logger.js'

export async function startCommand(): Promise<void> {
  if (!isInitialized()) {
    log.error('Shyp is not initialized. Run: shyp init')
    process.exit(1)
  }

  await startServer()
}
