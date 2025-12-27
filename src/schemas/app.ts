import { z } from 'zod'

// App types
export const AppTypeSchema = z.enum(['nextjs', 'node', 'static', 'script'])
export type AppType = z.infer<typeof AppTypeSchema>

// Deploy modes
export const DeployModeSchema = z.enum(['pm2', 'script'])
export type DeployMode = z.infer<typeof DeployModeSchema>

// Build configuration
export const BuildConfigSchema = z.object({
  command: z.string().default('npm ci && npm run build'),
  timeout: z.number().default(600),
}).partial()

// Health check configuration
export const HealthConfigSchema = z.object({
  path: z.string().default('/'),
  port: z.number().optional(),
  interval: z.number().default(30),
  timeout: z.number().default(5),
}).partial()

// PM2 configuration
export const PM2ConfigSchema = z.object({
  name: z.string(),
  instances: z.number().default(1),
  memory: z.string().default('512M'),
}).partial()

// Nginx configuration
export const NginxConfigSchema = z.object({
  client_max_body_size: z.string().default('10M'),
  gzip: z.boolean().default(true),
  cache_static: z.boolean().default(true),
  proxy_read_timeout: z.number().default(60),
  proxy_send_timeout: z.number().default(60),
  websocket_path: z.string().optional(),
}).partial()

// Resource limits
export const ResourcesSchema = z.object({
  memory: z.string().default('512M'),
  instances: z.number().default(1),
}).partial()

// App configuration schema
export const AppConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),

  // Source
  repo: z.string(),
  branch: z.string().default('main'),
  path: z.string(),
  sshKey: z.string().optional(),

  // Type
  type: AppTypeSchema.default('nextjs'),

  // Domain
  domain: z.string().optional(),
  aliases: z.array(z.string()).default([]),

  // Port (auto-assigned if not specified)
  port: z.number().optional(),

  // Build & Run
  build: BuildConfigSchema.optional(),
  start: z.object({
    command: z.string().default('npm start'),
  }).optional(),

  // Environment
  env: z.record(z.string()).default({}),

  // Deployment mode
  deploy: z.object({
    mode: DeployModeSchema.default('pm2'),
    script: z.string().optional(), // For script mode
  }).optional(),

  // Resources
  resources: ResourcesSchema.optional(),

  // PM2 config
  pm2: PM2ConfigSchema.optional(),

  // Nginx config
  nginx: NginxConfigSchema.optional(),

  // Health check
  health: HealthConfigSchema.optional(),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

// Parse and validate app config
export function parseAppConfig(data: unknown): AppConfig {
  return AppConfigSchema.parse(data)
}
