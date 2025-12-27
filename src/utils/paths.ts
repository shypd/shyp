import { homedir } from 'os'
import { join } from 'path'

// Shyp configuration directory
export const SHYP_DIR = process.env.SHYP_DIR || '/etc/shyp'

// Configuration paths
export const CONFIG_FILE = join(SHYP_DIR, 'config.yaml')
export const APPS_DIR = join(SHYP_DIR, 'apps')
export const ENGINES_DIR = join(SHYP_DIR, 'engines')
export const SECRETS_DIR = join(SHYP_DIR, 'secrets')
export const TEMPLATES_DIR = join(SHYP_DIR, 'templates')
export const STATE_DIR = join(SHYP_DIR, 'state')

// State files
export const PORTS_FILE = join(STATE_DIR, 'ports.json')
export const DEPLOYMENTS_FILE = join(STATE_DIR, 'deployments.json')
export const HEALTH_FILE = join(STATE_DIR, 'health.json')

// Log paths
export const LOG_DIR = '/var/log/shyp'
export const MAIN_LOG = join(LOG_DIR, 'shyp.log')
export const WEBHOOK_LOG = join(LOG_DIR, 'webhooks.log')
export const APPS_LOG_DIR = join(LOG_DIR, 'apps')

// Nginx paths
export const NGINX_AVAILABLE = '/etc/nginx/sites-available'
export const NGINX_ENABLED = '/etc/nginx/sites-enabled'

// Default SSH key
export const DEFAULT_SSH_KEY = join(homedir(), '.ssh', 'id_ed25519')

// Webhook server
export const DEFAULT_WEBHOOK_PORT = 9000

// Port ranges
export const PORT_RANGES = {
  standard: { start: 3001, end: 3099 },
  games: { start: 4000, end: 4099 },
  special: { start: 5000, end: 5099 },
  wyrt: { start: 8000, end: 8099 }, // Reserved for Wyrt WebManager
} as const
