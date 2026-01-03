import { z } from 'zod'
import { DeployModeSchema, NginxConfigSchema, PM2ConfigSchema, HealthConfigSchema, RuntimeSchema } from './app.js'

// Module configuration (generic - works for Wyrt, or any modular system)
export const ModuleConfigSchema = z.object({
  name: z.string(),

  // Source - can be separate repo or subpath of engine repo
  repo: z.string().optional(),
  path: z.string().optional(), // Absolute path to module (overrides subpath)
  subpath: z.string().optional(), // Path relative to engine directory
  branch: z.string().default('main'),

  // Domain mapping
  domain: z.string().optional(),
  aliases: z.array(z.string()).default([]),

  // Port (typically assigned by engine's module manager)
  port: z.number(),

  // Deployment
  deploy: z.object({
    mode: DeployModeSchema.default('script'),
    script: z.string().optional(),
    pm2_name: z.string().optional(),
  }).optional(),

  // Build (optional - engine may handle this)
  build: z.object({
    command: z.string(),
    timeout: z.number().default(600),
  }).optional(),

  // Start command (for pm2 mode, default is runtime-dependent)
  start: z.object({
    command: z.string().optional(),
  }).optional(),

  // Runtime / package manager
  runtime: RuntimeSchema,

  // Environment
  env: z.record(z.string()).default({}),

  // Nginx customization
  nginx: NginxConfigSchema.extend({
    // For engines with shared services (WebSocket, API, etc.)
    websocket_path: z.string().optional(),
    websocket_port: z.number().optional(),
    api_path: z.string().optional(),
    api_port: z.number().optional(),
  }).optional(),
})

export type ModuleConfig = z.infer<typeof ModuleConfigSchema>

// Engine ports configuration
export const EnginePortsSchema = z.object({
  http: z.number().optional(),
  websocket: z.number().optional(),
  module_start: z.number().optional(), // Starting port for module auto-assignment
  module_end: z.number().optional(),
}).partial()

// Engine server configuration
export const EngineServerSchema = z.object({
  repo: z.string(),
  branch: z.string().default('main'),
  path: z.string(),
  sshKey: z.string().optional(),

  // Engine's fixed ports
  ports: EnginePortsSchema.optional(),

  // PM2 config for engine process
  pm2: PM2ConfigSchema,

  // Config files
  config: z.object({
    file: z.string().optional(),
    env_file: z.string().optional(),
  }).optional(),

  // Database migrations
  database: z.object({
    type: z.string().optional(),
    migrations: z.string().optional(),
    module_migrations: z.string().optional(),
  }).optional(),

  // Runtime / package manager
  runtime: RuntimeSchema,

  // Build & start (defaults are runtime-dependent, applied in deploy.ts)
  build: z.object({
    command: z.string().optional(),
  }).optional(),

  start: z.object({
    command: z.string().optional(),
  }).optional(),

  // Health check
  health: HealthConfigSchema.optional(),
})

// Full engine configuration
export const EngineConfigSchema = z.object({
  type: z.literal('engine'),
  name: z.string(),
  description: z.string().optional(),

  // Main engine server
  server: EngineServerSchema,

  // Modules managed by this engine
  modules: z.record(ModuleConfigSchema).default({}),
})

export type EngineConfig = z.infer<typeof EngineConfigSchema>

// Parse and validate engine config
export function parseEngineConfig(data: unknown): EngineConfig {
  return EngineConfigSchema.parse(data)
}
