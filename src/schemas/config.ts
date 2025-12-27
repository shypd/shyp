import { z } from 'zod'
import { PORT_RANGES, DEFAULT_WEBHOOK_PORT } from '../utils/paths.js'

// Port range configuration
export const PortRangeSchema = z.object({
  start: z.number(),
  end: z.number(),
})

// SSL configuration
export const SSLConfigSchema = z.object({
  enabled: z.boolean().default(true),
  email: z.string().email().optional(), // Falls back to contact@{domain}
  auto_renew: z.boolean().default(true),
})

// Default values
export const DefaultsSchema = z.object({
  node_version: z.string().default('23'),
  build_timeout: z.number().default(600),
  health_check_timeout: z.number().default(30),
  max_memory: z.string().default('512M'),
  instances: z.number().default(1),
})

// Git provider configuration
export const GitConfigSchema = z.object({
  provider: z.enum(['github', 'gitlab', 'bitbucket']).default('github'),
  ssh_key: z.string().optional(),
})

// Deployment behavior
export const DeploymentConfigSchema = z.object({
  keep_releases: z.number().default(3),
  health_check_retries: z.number().default(3),
  rollback_on_failure: z.boolean().default(true),
})

// Server configuration
export const ServerConfigSchema = z.object({
  webhook_port: z.number().default(DEFAULT_WEBHOOK_PORT),
  webhook_secret: z.string().optional(), // Can use ${SHYP_WEBHOOK_SECRET}

  port_ranges: z.object({
    standard: PortRangeSchema.default(PORT_RANGES.standard),
    games: PortRangeSchema.default(PORT_RANGES.games),
    special: PortRangeSchema.default(PORT_RANGES.special),
  }).optional(),

  ssl: SSLConfigSchema.optional(),
  defaults: DefaultsSchema.optional(),
})

// Global configuration schema
export const GlobalConfigSchema = z.object({
  version: z.number().default(1),
  server: ServerConfigSchema,
  git: GitConfigSchema.optional(),
  deployment: DeploymentConfigSchema.optional(),

  // Notifications (future)
  notifications: z.object({
    on_failure: z.object({
      webhook: z.string().url().optional(),
    }).optional(),
  }).optional(),
})

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>

// Parse and validate global config
export function parseGlobalConfig(data: unknown): GlobalConfig {
  return GlobalConfigSchema.parse(data)
}
