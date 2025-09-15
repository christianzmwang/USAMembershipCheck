import fs from 'node:fs'
import path from 'node:path'

let s3Client: any = null
async function getS3() {
  if (!process.env.S3_BUCKET) return null
  if (s3Client) return s3Client
  try {
    const { S3Client } = await import('@aws-sdk/client-s3')
    s3Client = new S3Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2',
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      } : undefined,
    })
    return s3Client
  } catch {
    return null
  }
}

const DEFAULT_PREFIX = process.env.S3_PREFIX || ''

export async function readOutputJSON<T = any>(name: string): Promise<T | null> {
  // If S3 bucket configured, prefer S3
  const s3 = await getS3()
  if (s3) {
    try {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const Key = `${DEFAULT_PREFIX}${name}`
      const out = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key }))
      const body = await (out.Body as any).transformToString()
      return JSON.parse(body)
    } catch {}
  }
  // Fallback: local filesystem under out/
  try {
    const p = path.join(process.cwd(), 'out', name)
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      return JSON.parse(raw)
    }
  } catch {}
  return null
}

export async function outputExists(name: string): Promise<boolean> {
  const s3 = await getS3()
  if (s3) {
    try {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
      const Key = `${DEFAULT_PREFIX}${name}`
      await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key }))
      return true
    } catch {}
  }
  try {
    const p = path.join(process.cwd(), 'out', name)
    return fs.existsSync(p)
  } catch { return false }
}

export async function getLastUpdated() {
  const status = await readOutputJSON('usa-status.json')
  const fetchMeta = await readOutputJSON('usa-members.json')
  const lastFetchRunAt = fetchMeta?.summary?.runAt || null
  const lastVerifyRunAt = status?.runAt || null
  return { lastFetchRunAt, lastVerifyRunAt }
}
