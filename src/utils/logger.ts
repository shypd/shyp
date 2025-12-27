import chalk from 'chalk'

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),

  // Status indicators
  healthy: (name: string) => console.log(chalk.green('●'), chalk.white(name), chalk.dim('healthy')),
  stopped: (name: string) => console.log(chalk.red('●'), chalk.white(name), chalk.dim('stopped')),
  building: (name: string) => console.log(chalk.yellow('●'), chalk.white(name), chalk.dim('building')),

  // Deployment output
  step: (msg: string) => console.log(chalk.dim('  →'), msg),
  command: (cmd: string) => console.log(chalk.dim('  $'), chalk.cyan(cmd)),

  // Table-style output
  header: (text: string) => console.log(chalk.bold.white(`\n${text}\n${'-'.repeat(text.length)}`)),
  row: (label: string, value: string) => console.log(chalk.dim(label.padEnd(15)), value),

  // Raw output
  dim: (msg: string) => console.log(chalk.dim(msg)),
  bold: (msg: string) => console.log(chalk.bold(msg)),

  // Branding
  banner: () => {
    console.log(chalk.yellow.bold('\n  ⚡ shyp'), chalk.dim('- zero friction deployment\n'))
  },
}
