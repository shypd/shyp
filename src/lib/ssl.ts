import { execa } from 'execa'
import { existsSync } from 'fs'

export interface CertInfo {
  domain: string
  exists: boolean
  expiresAt?: Date
  daysRemaining?: number
  issuer?: string
}

const LETSENCRYPT_LIVE = '/etc/letsencrypt/live'

export async function getCertInfo(domain: string): Promise<CertInfo> {
  const certPath = `${LETSENCRYPT_LIVE}/${domain}/fullchain.pem`

  if (!existsSync(certPath)) {
    return { domain, exists: false }
  }

  try {
    // Use openssl to read cert expiry
    const { stdout } = await execa('openssl', [
      'x509', '-enddate', '-noout', '-in', certPath
    ])

    // Parse "notAfter=Mon Dec 27 00:00:00 2025 GMT"
    const match = stdout.match(/notAfter=(.+)/)
    if (match) {
      const expiresAt = new Date(match[1])
      const now = new Date()
      const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      return {
        domain,
        exists: true,
        expiresAt,
        daysRemaining,
      }
    }
  } catch {
    // Cert exists but couldn't read it (permission issue)
    return { domain, exists: true }
  }

  return { domain, exists: true }
}

export async function getAllCerts(): Promise<CertInfo[]> {
  const certs: CertInfo[] = []

  try {
    const { stdout } = await execa('ls', [LETSENCRYPT_LIVE])
    const domains = stdout.split('\n').filter(d => d && !d.startsWith('README'))

    for (const domain of domains) {
      const info = await getCertInfo(domain)
      certs.push(info)
    }
  } catch {
    // No certs or can't read directory
  }

  return certs.sort((a, b) => (a.daysRemaining || 999) - (b.daysRemaining || 999))
}

export function formatCertStatus(info: CertInfo): { text: string; color: 'green' | 'yellow' | 'red' | 'dim' } {
  if (!info.exists) {
    return { text: 'no cert', color: 'red' }
  }

  if (info.daysRemaining === undefined) {
    return { text: 'unknown', color: 'dim' }
  }

  if (info.daysRemaining <= 7) {
    return { text: `${info.daysRemaining}d`, color: 'red' }
  }

  if (info.daysRemaining <= 30) {
    return { text: `${info.daysRemaining}d`, color: 'yellow' }
  }

  return { text: `${info.daysRemaining}d`, color: 'green' }
}

export async function isCertbotAvailable(): Promise<boolean> {
  try {
    await execa('which', ['certbot'])
    return true
  } catch {
    return false
  }
}

export async function obtainCert(domain: string, emailOverride?: string): Promise<{ success: boolean; error?: string }> {
  const certPath = `${LETSENCRYPT_LIVE}/${domain}/fullchain.pem`

  // Already have cert
  if (existsSync(certPath)) {
    return { success: true }
  }

  // Get email from domain (contact@domain.com)
  const email = emailOverride || `contact@${domain}`

  try {
    await execa('certbot', [
      'certonly',
      '--nginx',
      '--non-interactive',
      '--agree-tos',
      '--email', email,
      '-d', domain,
    ], { stdio: 'inherit' })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to obtain certificate'
    }
  }
}

export async function ensureCerts(domains: string[]): Promise<Map<string, { success: boolean; error?: string }>> {
  const results = new Map<string, { success: boolean; error?: string }>()

  if (!await isCertbotAvailable()) {
    for (const domain of domains) {
      results.set(domain, { success: false, error: 'certbot not installed' })
    }
    return results
  }

  for (const domain of domains) {
    if (!domain) continue
    const result = await obtainCert(domain)
    results.set(domain, result)
  }

  return results
}
