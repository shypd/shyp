import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'
import { log } from '../utils/logger.js'
import { APPS_LOG_DIR } from '../utils/paths.js'

export async function logsCommand(
  name: string,
  options: { follow?: boolean; lines?: number }
): Promise<void> {
  const logDir = join(APPS_LOG_DIR, name)

  if (!existsSync(logDir)) {
    log.error(`No logs found for ${name}`)
    log.dim(`Log directory: ${logDir}`)
    return
  }

  // Get latest log file
  const files = await readdir(logDir)
  const logFiles = files
    .filter(f => f.endsWith('.log'))
    .sort()
    .reverse()

  if (logFiles.length === 0) {
    log.info('No deployment logs yet')
    return
  }

  const latestLog = join(logDir, logFiles[0])
  const content = await readFile(latestLog, 'utf-8')
  const lines = content.split('\n')

  // Limit lines if specified
  const limit = options.lines || 50
  const displayLines = lines.slice(-limit)

  console.log(chalk.dim(`=== ${logFiles[0]} ===`))
  console.log()

  for (const line of displayLines) {
    // Color code log lines
    if (line.includes('STDERR')) {
      console.log(chalk.red(line))
    } else if (line.includes('===')) {
      console.log(chalk.bold.white(line))
    } else if (line.includes('ERROR') || line.includes('FAILED')) {
      console.log(chalk.red(line))
    } else {
      console.log(chalk.dim(line))
    }
  }

  if (options.follow) {
    log.dim('\n--follow not yet implemented. Use: tail -f ' + latestLog)
  }

  // Show available log files
  if (logFiles.length > 1) {
    console.log()
    log.dim(`${logFiles.length} deployment logs available in ${logDir}`)
  }
}
