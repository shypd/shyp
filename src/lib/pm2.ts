import { execa } from 'execa'

export interface PM2Process {
  name: string
  pm_id: number
  status: 'online' | 'stopped' | 'errored' | 'launching'
  memory: number
  cpu: number
  uptime: number
  restarts: number
}

// Get list of PM2 processes
export async function listProcesses(): Promise<PM2Process[]> {
  try {
    const { stdout } = await execa('pm2', ['jlist'])
    const processes = JSON.parse(stdout)

    return processes.map((p: any) => ({
      name: p.name,
      pm_id: p.pm_id,
      status: p.pm2_env?.status || 'stopped',
      memory: p.monit?.memory || 0,
      cpu: p.monit?.cpu || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0,
    }))
  } catch {
    return []
  }
}

// Get a specific process by name
export async function getProcess(name: string): Promise<PM2Process | null> {
  const processes = await listProcesses()
  return processes.find(p => p.name === name) || null
}

// Start a process
export async function startProcess(
  name: string,
  script: string,
  options: {
    cwd?: string
    env?: Record<string, string>
    instances?: number
    maxMemory?: string
  } = {}
): Promise<void> {
  const args = [
    'start', script,
    '--name', name,
  ]

  if (options.instances) {
    args.push('-i', String(options.instances))
  }

  if (options.maxMemory) {
    args.push('--max-memory-restart', options.maxMemory)
  }

  await execa('pm2', args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
  })
}

// Stop a process
export async function stopProcess(name: string): Promise<void> {
  try {
    await execa('pm2', ['stop', name])
  } catch {
    // Process might not exist, that's ok
  }
}

// Restart a process
export async function restartProcess(name: string): Promise<void> {
  await execa('pm2', ['restart', name])
}

// Delete a process
export async function deleteProcess(name: string): Promise<void> {
  try {
    await execa('pm2', ['delete', name])
  } catch {
    // Process might not exist, that's ok
  }
}

// Save PM2 process list
export async function saveProcessList(): Promise<void> {
  await execa('pm2', ['save'])
}

// Check if PM2 is available
export async function isPM2Available(): Promise<boolean> {
  try {
    await execa('pm2', ['--version'])
    return true
  } catch {
    return false
  }
}

// Format memory for display
export function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

// Format uptime for display
export function formatUptime(startTime: number): string {
  if (!startTime) return '-'

  const diff = Date.now() - startTime
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
