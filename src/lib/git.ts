import { execa } from 'execa'
import { existsSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SSH_KEY } from '../utils/paths.js'

// Git operations with SSH key support
function gitEnv(sshKey?: string): Record<string, string> {
  const key = sshKey || DEFAULT_SSH_KEY
  return {
    ...process.env as Record<string, string>,
    GIT_SSH_COMMAND: `ssh -i ${key} -o StrictHostKeyChecking=no`,
  }
}

// Check if a directory is a git repository
export function isGitRepo(path: string): boolean {
  return existsSync(join(path, '.git'))
}

// Clone a repository
export async function clone(
  repo: string,
  path: string,
  options: {
    branch?: string
    sshKey?: string
  } = {}
): Promise<void> {
  const args = ['clone', repo, path]

  if (options.branch) {
    args.push('--branch', options.branch)
  }

  await execa('git', args, {
    env: gitEnv(options.sshKey),
  })
}

// Fetch from remote
export async function fetch(
  path: string,
  options: {
    sshKey?: string
  } = {}
): Promise<void> {
  await execa('git', ['fetch', 'origin'], {
    cwd: path,
    env: gitEnv(options.sshKey),
  })
}

// Reset to a branch/commit (hard reset)
export async function reset(
  path: string,
  target: string,
  options: {
    sshKey?: string
  } = {}
): Promise<void> {
  await execa('git', ['reset', '--hard', target], {
    cwd: path,
    env: gitEnv(options.sshKey),
  })
}

// Pull latest changes (fetch + reset)
export async function pull(
  path: string,
  branch: string = 'main',
  options: {
    sshKey?: string
  } = {}
): Promise<void> {
  await fetch(path, options)
  await reset(path, `origin/${branch}`, options)
}

// Get current commit hash
export async function getCurrentCommit(path: string): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd: path })
  return stdout.trim()
}

// Get current commit hash (short)
export async function getShortCommit(path: string): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: path })
  return stdout.trim()
}

// Get current branch
export async function getCurrentBranch(path: string): Promise<string> {
  const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: path })
  return stdout.trim()
}

// Check if git is available
export async function isGitAvailable(): Promise<boolean> {
  try {
    await execa('git', ['--version'])
    return true
  } catch {
    return false
  }
}

// Get commit message
export async function getCommitMessage(path: string): Promise<string> {
  const { stdout } = await execa('git', ['log', '-1', '--pretty=%B'], { cwd: path })
  return stdout.trim()
}

// Ensure repository is cloned
export async function ensureCloned(
  repo: string,
  path: string,
  options: {
    branch?: string
    sshKey?: string
  } = {}
): Promise<void> {
  if (!isGitRepo(path)) {
    await clone(repo, path, options)
  }
}
