import { z } from 'zod'

// Port allocation state
export const PortAllocationsSchema = z.object({
  allocations: z.record(z.number()), // app name -> port
  reserved: z.array(z.number()).default([]),
  engine_managed: z.record(z.array(z.number())).default({}), // engine name -> ports

  ranges: z.object({
    standard: z.object({
      start: z.number(),
      end: z.number(),
      next: z.number(),
    }),
    games: z.object({
      start: z.number(),
      end: z.number(),
      next: z.number(),
    }),
    special: z.object({
      start: z.number(),
      end: z.number(),
      next: z.number(),
    }),
  }).optional(),
})

export type PortAllocations = z.infer<typeof PortAllocationsSchema>

// Deployment record
export const DeploymentRecordSchema = z.object({
  id: z.string(), // Timestamp-based ID
  commit: z.string().optional(),
  timestamp: z.string().datetime(),
  status: z.enum(['success', 'failed', 'in_progress']),
  duration_ms: z.number().optional(),
  error: z.string().optional(),
})

export type DeploymentRecord = z.infer<typeof DeploymentRecordSchema>

// App deployment history
export const AppDeploymentSchema = z.object({
  current: z.string().optional(), // Current deployment ID
  history: z.array(DeploymentRecordSchema).default([]),
})

// Full deployments state
export const DeploymentsStateSchema = z.record(AppDeploymentSchema)
export type DeploymentsState = z.infer<typeof DeploymentsStateSchema>

// Health status
export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'unknown']),
  last_check: z.string().datetime().optional(),
  consecutive_failures: z.number().default(0),
  last_response_time_ms: z.number().optional(),
  error: z.string().optional(),
})

export type HealthStatus = z.infer<typeof HealthStatusSchema>

// Engine health (with modules)
export const EngineHealthSchema = z.object({
  server: z.record(HealthStatusSchema).optional(), // port name -> status
  modules: z.record(HealthStatusSchema).optional(), // module name -> status
})

// Full health state
export const HealthStateSchema = z.record(
  z.union([HealthStatusSchema, EngineHealthSchema])
)
export type HealthState = z.infer<typeof HealthStateSchema>
