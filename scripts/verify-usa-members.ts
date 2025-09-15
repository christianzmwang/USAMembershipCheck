/*
  Script: verify-usa-members.ts
  Purpose: Log into member.usafencing.org, search for each USA member ID pulled from Pike13, and report status.

  Inputs (env):
    - USA_FENCING_EMAIL
    - USA_FENCING_PASSWORD
    - PIKE13_API_KEY
    - PIKE13_USA_MEMBER_FIELD_NAME (optional, default 'USA Fencing Member ID')

  Usage:
    pnpm verify:usa [--limit 50] [--out out/usa-status.json]

  Output formats:
    - JSON summary written to --out (default out/usa-status.json)
    - CSV sibling (same base name .csv) for quick spreadsheet use
*/

import { chromium, Browser, Page } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { getAllPeopleUSAMembers, USAProfile } from '../src/lib/pike13'
import dotenv from 'dotenv'

// Load env from .env.local first, then fallback to .env
(() => {
  const cwd = process.cwd()
  const candidates = [path.join(cwd, '.env.local'), path.join(cwd, '.env')]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) dotenv.config({ path: p, override: false })
    } catch {}
  }
})()

// Tiny CLI arg parser
function arg(name: string, def?: string) {
  const idx = process.argv.findIndex((a) => a === name || a.startsWith(name + '='))
  if (idx === -1) return def
  const v = process.argv[idx]
  if (v.includes('=')) return v.split('=')[1]
  return process.argv[idx + 1] ?? def
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// Simple structured logger that writes to console and optional file
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type Logger = {
  level: LogLevel
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

function createLogger(level: LogLevel = 'info', logPath?: string): Logger {
  const levelRank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
  const min = levelRank[level] ?? 20
  let stream: fs.WriteStream | undefined
  if (logPath) {
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true })
      stream = fs.createWriteStream(logPath, { flags: 'a' })
    } catch {}
  }
  function write(lvl: LogLevel, parts: any[]) {
    if (levelRank[lvl] < min) return
    const ts = new Date().toISOString()
    const line = `[${ts}] [${lvl.toUpperCase()}] ` + parts.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ')
    // Console
    if (lvl === 'error') console.error(line)
    else if (lvl === 'warn') console.warn(line)
    else console.log(line)
    // File
    if (stream) {
      stream.write(line + '\n')
    }
  }
  const logger: Logger = {
    level,
    debug: (...a) => write('debug', a),
    info: (...a) => write('info', a),
    warn: (...a) => write('warn', a),
    error: (...a) => write('error', a),
  }
  return logger
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

async function saveScreenshot(page: Page, filePath: string, logger: Logger) {
  try {
    ensureDir(path.dirname(filePath))
    await page.screenshot({ path: filePath, fullPage: true })
    logger.info(`Saved screenshot: ${filePath}`)
  } catch (e: any) {
    logger.warn(`Failed to save screenshot ${filePath}: ${e?.message || e}`)
  }
}

async function waitForAnySelector(page: Page, selectors: string[], timeoutMs: number): Promise<string | null> {
  const start = Date.now()
  for (;;) {
    for (const sel of selectors) {
      const loc = page.locator(sel)
      if (await loc.first().isVisible().catch(() => false)) return sel
    }
    if (Date.now() - start > timeoutMs) return null
    await sleep(100)
  }
}

async function login(page: Page, email: string, password: string, logger: Logger) {
  logger.info('Navigating to login page')
  await page.goto('https://member.usafencing.org/login', { waitUntil: 'load' })
  logger.debug('At URL', page.url())

  // Accept cookies if banner appears (best-effort)
  try {
    const cookieButton = page.locator('button:has-text("Accept")')
    if (await cookieButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      logger.debug('Cookie banner detected, accepting')
      await cookieButton.click({ timeout: 2000 }).catch(() => {})
    }
  } catch {}

  const emailSelectors = [
    'input[name="email"]', 'input#email', 'input[type="email"]',
    'input[name="username"]', 'input[name="user[email]"]', 'input[name="login"]',
    'input[placeholder*="Email" i]'
  ]
  const pwdSelectors = [
    'input[name="password"]', 'input#password', 'input[type="password"]',
    'input[placeholder*="Password" i]'
  ]
  const submitSelectors = [
    'button[type="submit"]:has-text("Sign In")',
    'button:has-text("Sign in")',
    'button:has-text("SIGN IN")',
    'button:has-text("Log In")',
    'input[type="submit"]'
  ]

  logger.info('Waiting for login form fields')
  const emailSel = await waitForAnySelector(page, emailSelectors, 15000)
  const pwdSel = await waitForAnySelector(page, pwdSelectors, 15000)
  if (!emailSel || !pwdSel) {
    await saveScreenshot(page, 'out/screenshots/login-missing-fields.png', logger)
    throw new Error('Login form fields not found')
  }

  logger.info('Filling credentials')
  await page.fill(emailSel, email)
  await page.fill(pwdSel, password)
  const submit = page.locator(submitSelectors.join(', '))
  await submit.first().click().catch(async () => {
    // Fallback: press Enter in password field
    await page.locator(pwdSel).press('Enter').catch(() => {})
  })

  // Wait for navigation to indicate logged in (presence of Sign Out or account link)
  await page.waitForLoadState('networkidle')
  const signedIn = await page.locator('text=SIGN OUT, text=Sign out, a:has-text("My Account")').first().isVisible().catch(() => false)
  if (!signedIn) {
    // A fallback check: if login form persists with error
    const err = await page.locator('.alert-danger, [role="alert"], text=Invalid').first().isVisible().catch(() => false)
    if (err) throw new Error('Login failed (invalid credentials?)')
    // If neither, still proceed but log warning
    logger.warn('Could not verify sign-in; continuing')
  } else {
    logger.info('Login successful')
  }
}

async function openSearch(page: Page, logger: Logger) {
  logger.info('Opening member search page')
  await page.goto('https://member.usafencing.org/search/members', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
}

async function searchMemberById(page: Page, memberId: string, logger: Logger): Promise<{ found: boolean; rowText?: string; profileUrl?: string }>{
  // The page has various filters; try to find an input specific to member ID if available.
  // Fallback: global search input.
  
  // Clear and set the search input
  const inputSelectors = [
    'input[name="member_id"]',
    'input[placeholder*="Member ID" i]',
    '#member_id',
    'input[type="search"]',
    'input[name="query"]',
  ]
  // Proactively clear name fields so only ID filter is active
  const firstSelectors = [
    'input[name="first_name"]',
    'input[placeholder*="First" i]',
    '#first_name',
    'input[name="fname"]',
  ]
  const lastSelectors = [
    'input[name="last_name"]',
    'input[placeholder*="Last" i]',
    '#last_name',
    'input[name="lname"]',
  ]
  for (const sel of [...firstSelectors, ...lastSelectors]) {
    const loc = page.locator(sel)
    try {
      if (await loc.isVisible({ timeout: 300 }).catch(() => false)) {
        await loc.fill('')
      }
    } catch {}
  }
  let filled = false
  for (const sel of inputSelectors) {
    const loc = page.locator(sel)
    try {
      if (await loc.isVisible({ timeout: 1000 })) {
        logger.debug(`Typing into selector: ${sel}`)
        await loc.fill('')
        await loc.type(memberId)
        filled = true
        break
      }
    } catch {}
  }
  if (!filled) {
    // Try to recover by re-opening the search page once
    await openSearch(page, logger)
    for (const sel of inputSelectors) {
      const loc = page.locator(sel)
      try {
        if (await loc.isVisible({ timeout: 1000 })) {
          logger.debug(`Typing into selector: ${sel}`)
          await loc.fill('')
          await loc.type(memberId)
          filled = true
          break
        }
      } catch {}
    }
    if (!filled) {
      logger.warn('Search input not found after refresh; skipping ID search for this record')
      return { found: false }
    }
  }

  // Hit Enter or click search
  const searchBtn = page.locator('button:has-text("Search")')
  if (await searchBtn.isVisible().catch(() => false)) {
    logger.debug('Clicking Search button')
    await searchBtn.click()
  } else {
    // Use Enter only when input was focused; pressing Enter on body is flaky
    logger.debug('Pressing Enter to trigger search')
    await page.keyboard.press('Enter').catch(() => {})
  }

  // Wait and inspect results
  await page.waitForLoadState('networkidle')
  await sleep(500)

  // Try to locate a results table/list item containing the ID
  const row = page.locator(`text=${memberId}`).first()
  const found = await row.isVisible().catch(() => false)
  let rowText: string | undefined
  let profileUrl: string | undefined
  if (found) {
    logger.debug(`Result hit contains ID ${memberId}`)
    rowText = await row.innerText().catch(() => undefined)
    const link = await row.locator('xpath=ancestor::a | xpath=ancestor::tr//a').first()
    if (await link.isVisible().catch(() => false)) {
      profileUrl = await link.getAttribute('href').catch(() => undefined) ?? undefined
      if (profileUrl && !/^https?:/i.test(profileUrl)) {
        profileUrl = new URL(profileUrl, page.url()).toString()
      }
    }
  }

  return { found, rowText, profileUrl }
}

// Utility: sanitize USA Fencing ID (digits only)
function sanitizeUsaId(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  return String(raw).replace(/\D+/g, '')
}

// Utility: validate ID length using hardcoded policy (allowed lengths = 9)
function isAllowedUsaIdLength(id: string): boolean {
  if (!id) return false
  // Only accept exactly 9 digits per requirement
  return id.length === 9
}

// Try to extract a plausible USA member id from arbitrary text
function extractUsaIdFromText(text: string): string | null {
  if (!text) return null
  const candidates = text.match(/\d{4,}/g) || []
  if (!candidates.length) return null
  // Only return candidates with exactly 9 digits
  for (const d of candidates) {
    if (d.length === 9) return d
  }
  return null
}

// Fallback: search by first+last name and verify club text if provided
async function searchMemberByNameAndClub(
  page: Page,
  firstName: string | undefined,
  lastName: string | undefined,
  expectedClubPatterns: string[] | undefined,
  logger: Logger,
): Promise<{ found: boolean; rowText?: string; profileUrl?: string; matchedClub?: string; resolvedId?: string }>{
  const fn = (firstName || '').trim()
  const ln = (lastName || '').trim()
  if (!fn && !ln) return { found: false }

  // Attempt to locate first/last name inputs
  const firstSelectors = [
    'input[name="first_name"]',
    'input[placeholder*="First" i]',
    '#first_name',
    'input[name="fname"]',
  ]
  const lastSelectors = [
    'input[name="last_name"]',
    'input[placeholder*="Last" i]',
    '#last_name',
    'input[name="lname"]',
  ]

  // Clear ID-only fields to ensure name search isn't constrained by a leftover ID
  const idOnlySelectors = [
    'input[name="member_id"]',
    'input[placeholder*="Member ID" i]',
    '#member_id',
  ]
  for (const sel of idOnlySelectors) {
    const loc = page.locator(sel)
    try {
      if (await loc.isVisible({ timeout: 300 }).catch(() => false)) {
        await loc.fill('')
      }
    } catch {}
  }

  let filled = false
  for (const sel of firstSelectors) {
    const loc = page.locator(sel)
    try {
      if (await loc.isVisible({ timeout: 1000 })) {
        await loc.fill('')
        if (fn) await loc.type(fn)
        filled = true
        break
      }
    } catch {}
  }
  for (const sel of lastSelectors) {
    const loc = page.locator(sel)
    try {
      if (await loc.isVisible({ timeout: 1000 })) {
        await loc.fill('')
        if (ln) await loc.type(ln)
        filled = true
        break
      }
    } catch {}
  }

  if (!filled) {
    // Try to recover by navigating to search page and retrying once
    logger.warn('Name inputs not found; re-opening search page')
    await openSearch(page, logger)
    for (const sel of firstSelectors) {
      const loc = page.locator(sel)
      try {
        if (await loc.isVisible({ timeout: 1000 })) {
          await loc.fill('')
          if (fn) await loc.type(fn)
          filled = true
          break
        }
      } catch {}
    }
    for (const sel of lastSelectors) {
      const loc = page.locator(sel)
      try {
        if (await loc.isVisible({ timeout: 1000 })) {
          await loc.fill('')
          if (ln) await loc.type(ln)
          filled = true
          break
        }
      } catch {}
    }
    if (!filled) return { found: false }
  }

  // Trigger search
  const searchBtn = page.locator('button:has-text("Search")')
  if (await searchBtn.isVisible().catch(() => false)) {
    await searchBtn.click()
  } else {
    await page.keyboard.press('Enter').catch(() => {})
  }

  await page.waitForLoadState('networkidle')
  await sleep(500)

  // Inspect results: prefer rows that include last name and (optionally) a matching club
  const rows = page.locator('table tr, .results .result, .list .list-item')
  const count = await rows.count().catch(() => 0)
  const clubs = (expectedClubPatterns || []).map(s => s.toLowerCase())
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i)
    const text = (await row.innerText().catch(() => '')) || ''
    const lc = text.toLowerCase()
    const nameOk = (!fn || lc.includes(fn.toLowerCase())) && (!ln || lc.includes(ln.toLowerCase()))
    if (!nameOk) continue
    let matchedClub: string | undefined
    if (clubs.length) {
      for (const c of clubs) {
        const m = text.match(new RegExp(c, 'i'))
        if (m) { matchedClub = m[0]; break }
      }
      if (!matchedClub) continue
    }
    // Try to get link
    let profileUrl: string | undefined
    const link = row.locator('a').first()
    if (await link.isVisible().catch(() => false)) {
      profileUrl = await link.getAttribute('href').catch(() => undefined) || undefined
      if (profileUrl && !/^https?:/i.test(profileUrl)) {
        profileUrl = new URL(profileUrl, page.url()).toString()
      }
    }
    const resolvedId = extractUsaIdFromText(text) || undefined
    return { found: true, rowText: text, profileUrl, matchedClub, resolvedId }
  }
  return { found: false }
}

function toCsvCell(s: any): string {
  if (s === null || s === undefined) return ''
  const str = String(s)
  if (str.includes(',') || str.includes('"') || /\s/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

async function main() {
  const email = requireEnv('USA_FENCING_EMAIL')
  const password = requireEnv('USA_FENCING_PASSWORD')
  // Hardcoded Pike13 field name (no env required)
  const fieldName = 'USA Fencing Membership number'

  const limit = Number(arg('--limit', '0')!)
  const concurrency = Math.max(1, Number(arg('--concurrency', process.env.USA_VERIFIER_CONCURRENCY || '1')!))
  const retryIdSearch = Math.max(0, Number(arg('--retry', process.env.USA_VERIFIER_RETRY || '2')!))
  const outPath = arg('--out', 'out/usa-status.json')!
  const outCsv = outPath.replace(/\.json$/i, '.csv')
  const outPartial = outPath.replace(/\.json$/i, '.partial.json')
  const noResume = process.argv.includes('--no-resume') || process.argv.includes('--fresh') || /--resume=(false|0)/i.test(process.argv.join(' '))
  const logPath = arg('--log', 'out/usa-status.log')
  const inPath = arg('--in', 'out/usa-members.json')
  const useApi = process.argv.includes('--from-api')
  // Verbosity: --verbose or --log-level
  const logLevelArg = (arg('--log-level') as LogLevel | undefined) || (process.argv.includes('--verbose') ? 'debug' : 'info')
  const logger = createLogger(logLevelArg, logPath)

  logger.info('Starting USA Fencing membership verification run')
  logger.info('Parameters', { limit, outPath, outCsv, logPath, fieldName, inPath, fromApi: useApi, concurrency, retryIdSearch })
  logger.info('Env present', {
    USA_FENCING_EMAIL: Boolean(process.env.USA_FENCING_EMAIL),
    USA_FENCING_PASSWORD: Boolean(process.env.USA_FENCING_PASSWORD),
  })

  // Ensure out dir
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  let people: USAProfile[] = []
  if (!useApi && inPath && fs.existsSync(inPath)) {
    logger.info(`Loading USA members from cache file: ${inPath}`)
    try {
      const raw = fs.readFileSync(inPath, 'utf8')
      const parsed = JSON.parse(raw)
      const arr: USAProfile[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.people) ? parsed.people : []
      people = arr
    } catch (e: any) {
      logger.warn(`Failed to read ${inPath}: ${e?.message || e}; falling back to API`)
    }
  }
  if (!people.length) {
    const apiKey = requireEnv('PIKE13_API_KEY')
    logger.info('Fetching Pike13 people with USA IDs from Pike13 Desk API...')
    people = await getAllPeopleUSAMembers({ apiKey, fieldName })
  }
  people = people.filter(p => !!p.usa_member_id)

  // RESUME: load prior results and compute remaining to process
  let priorResults: Array<any> = []
  if (!noResume) {
    try {
      if (fs.existsSync(outPath)) {
        const rawPrev = fs.readFileSync(outPath, 'utf8')
        const parsedPrev = JSON.parse(rawPrev)
        const arrPrev = Array.isArray(parsedPrev) ? parsedPrev : Array.isArray(parsedPrev?.results) ? parsedPrev.results : []
        if (Array.isArray(arrPrev)) priorResults = arrPrev
      } else if (fs.existsSync(outPartial)) {
        const rawPrev = fs.readFileSync(outPartial, 'utf8')
        const parsedPrev = JSON.parse(rawPrev)
        const arrPrev = Array.isArray(parsedPrev) ? parsedPrev : Array.isArray(parsedPrev?.results) ? parsedPrev.results : []
        if (Array.isArray(arrPrev)) priorResults = arrPrev
      }
    } catch (e: any) {
      logger.warn(`Resume: failed to parse prior results: ${e?.message || e}`)
    }
  } else {
    logger.info('Resume disabled by flag (--no-resume/--fresh/--resume=false)')
  }

  const doneById = new Set(priorResults.map(r => Number(r?.person_id)))
  const pending = people.filter(p => !doneById.has(Number(p.person_id)))
  const slice = limit > 0 ? pending.slice(0, limit) : pending
  logger.info(`Total with USA IDs: ${people.length}; already checked: ${doneById.size}; remaining: ${pending.length}; will check now: ${slice.length}`)

  // Early exit if there's nothing to do
  if (slice.length === 0) {
    const results = priorResults
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify({
      runAt: new Date().toISOString(),
      total: 0,
      found: results.filter(r => r.found).length,
      notFound: results.filter(r => !r.found).length,
      results,
    }, null, 2))
    // CSV sibling
    const headers = ['person_id','usa_member_id','sanitized_id','was_sanitized','id_length_ok','match_method','fallback_used','club_matched','matched_club','resolved_member_id','first_name','last_name','email','found','profileUrl','rowText','error']
    const lines = [headers.join(',')]
    for (const r of results) {
      lines.push([
        toCsvCell(r.person_id),
        toCsvCell(r.usa_member_id),
        toCsvCell(r.sanitized_id ?? ''),
        toCsvCell(r.was_sanitized ?? false),
        toCsvCell(r.id_length_ok ?? false),
        toCsvCell(r.match_method ?? ''),
        toCsvCell(r.fallback_used ?? false),
        toCsvCell(r.club_matched ?? false),
        toCsvCell(r.matched_club ?? ''),
        toCsvCell(r.resolved_member_id ?? ''),
        toCsvCell(r.first_name ?? ''),
        toCsvCell(r.last_name ?? ''),
        toCsvCell(r.email ?? ''),
        toCsvCell(r.found),
        toCsvCell(r.profileUrl ?? ''),
        toCsvCell(r.rowText ?? ''),
        toCsvCell(r.error ?? ''),
      ].join(','))
    }
    fs.writeFileSync(outCsv, lines.join('\n'))
    logger.info('No pending people to verify; wrote existing results and exiting.')
    console.log(`Done. Nothing to verify. Wrote ${outPath} and ${outCsv}`)
    return
  }

  const headless = !process.argv.includes('--headful')
  logger.info(`Launching browser (headless=${headless})`)
  const browser: Browser = await chromium.launch({ headless })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const tLoginStart = Date.now()
  await login(page, email, password, logger)
  logger.info(`Login step took ${Math.round((Date.now() - tLoginStart)/1000)}s`)
  await openSearch(page, logger)

  const results: Array<{
    person_id: number
    usa_member_id: string
    sanitized_id?: string
    first_name?: string
    last_name?: string
    email?: string | null
    found: boolean
    match_method?: 'id' | 'name+club'
    fallback_used?: boolean
    id_length_ok?: boolean
    was_sanitized?: boolean
    club_matched?: boolean
    matched_club?: string
    resolved_member_id?: string
    rowText?: string
    profileUrl?: string
    error?: string
  }> = []

  // Seed with prior results if resuming
  if (priorResults.length) {
    results.push(...priorResults)
    logger.info(`Seeded current run with ${priorResults.length} prior results`)
  }

  // Helper: write results to disk (JSON and CSV)
  function flushResults(label: string) {
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, JSON.stringify({
        runAt: new Date().toISOString(),
        total: slice.length,
        found: results.filter(r => r.found).length,
        notFound: results.filter(r => !r.found).length,
        results,
      }, null, 2))

      // CSV
  const headers = ['person_id','usa_member_id','sanitized_id','was_sanitized','id_length_ok','match_method','fallback_used','club_matched','matched_club','resolved_member_id','first_name','last_name','email','found','profileUrl','rowText','error']
      const lines = [headers.join(',')]
      for (const r of results) {
        lines.push([
          toCsvCell(r.person_id),
          toCsvCell(r.usa_member_id),
          toCsvCell(r.sanitized_id ?? ''),
          toCsvCell(r.was_sanitized ?? false),
          toCsvCell(r.id_length_ok ?? false),
          toCsvCell(r.match_method ?? ''),
          toCsvCell(r.fallback_used ?? false),
          toCsvCell(r.club_matched ?? false),
          toCsvCell(r.matched_club ?? ''),
          toCsvCell(r.resolved_member_id ?? ''),
          toCsvCell(r.first_name ?? ''),
          toCsvCell(r.last_name ?? ''),
          toCsvCell(r.email ?? ''),
          toCsvCell(r.found),
          toCsvCell(r.profileUrl ?? ''),
          toCsvCell(r.rowText ?? ''),
          toCsvCell(r.error ?? ''),
        ].join(','))
      }
      fs.writeFileSync(outCsv, lines.join('\n'))
    } catch (e: any) {
      console.warn(`[flushResults] Failed (${label}):`, e?.message || e)
    }
  }

  // Graceful shutdown to persist partial results on interrupt
  function setupSignalHandlers() {
    const handler = (sig: NodeJS.Signals) => {
      console.log(`\nReceived ${sig}. Saving partial results to ${outPath}...`)
      flushResults(`signal:${sig}`)
      process.exit(130)
    }
    process.on('SIGINT', handler)
    process.on('SIGTERM', handler)
  }
  setupSignalHandlers()

  let i = 0
  // Prepare expected club filters from env
  // Hardcoded expected club(s)
  const expectedClubs = ['Bay Area Fencing Club']

  // Shared index for work distribution
  let nextIndex = 0

  async function worker(workerId: number, initialPage: Page) {
    let workerPage: Page | null = initialPage
    // Ensure we are on the search page
    if (workerPage && !/member\.usafencing\.org\/search\/members/.test(workerPage.url())) {
      await openSearch(workerPage, logger)
    }
    for (;;) {
      const idx = nextIndex++
      if (idx >= slice.length) break
      const p = slice[idx]
      const ordinal = ++i
      const rawId = String(p.usa_member_id)
      const sanitized = sanitizeUsaId(rawId)
      const idLenOk = isAllowedUsaIdLength(sanitized)
      const label = `${ordinal}/${slice.length} [w${workerId}] ID=${sanitized || rawId} (${p.first_name ?? ''} ${p.last_name ?? ''})`
      logger.info(`Checking ${label}`)
      const tStart = Date.now()
      try {
        let usedFallback = false
        let matchMethod: 'id' | 'name+club' | undefined
        let r: { found: boolean; rowText?: string; profileUrl?: string; matchedClub?: string; resolvedId?: string } = { found: false }

        if (idLenOk) {
          if (!workerPage) throw new Error('worker page missing')
          r = await searchMemberById(workerPage, sanitized, logger)
          if (!r.found) {
            for (let attempt = 1; attempt <= retryIdSearch && !r.found; attempt++) {
              const backoff = attempt * 800
              logger.debug(`Not found by ID, retry attempt ${attempt} after ${backoff}ms`)
              await sleep(backoff)
              if (!workerPage) throw new Error('worker page missing')
              r = await searchMemberById(workerPage, sanitized, logger)
            }
          }
          matchMethod = r.found ? 'id' : undefined
        } else {
          logger.info(`ID failed length check (len=${sanitized.length}); skipping ID search and using fallback`)
        }

        if (!r || !r.found) {
          usedFallback = true
          if (!workerPage) throw new Error('worker page missing')
          const nf = await searchMemberByNameAndClub(workerPage, p.first_name, p.last_name, expectedClubs, logger)
          r = nf
          if (r.found) matchMethod = 'name+club'
        }

        const dur = Date.now() - tStart
        logger.info(`Done ${label} -> ${r.found ? 'FOUND' : 'NOT FOUND'} via ${matchMethod || 'none'} in ${dur}ms`)
        results.push({
          person_id: p.person_id,
          usa_member_id: rawId,
          sanitized_id: sanitized,
          was_sanitized: sanitized !== rawId,
          id_length_ok: idLenOk,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email ?? null,
          found: r.found,
          match_method: matchMethod,
          fallback_used: usedFallback,
          club_matched: Boolean(r.matchedClub),
          matched_club: r.matchedClub,
          resolved_member_id: matchMethod === 'id' ? sanitized : (r.resolvedId || undefined),
          rowText: r.rowText,
          profileUrl: r.profileUrl,
        })
        // Snapshot after each record to avoid data loss on interruption
        try {
          fs.writeFileSync(outPartial, JSON.stringify({ runAt: new Date().toISOString(), progress: `${ordinal}/${slice.length}`, results }, null, 2))
        } catch {}
      } catch (e: any) {
        const dur = Date.now() - tStart
        results.push({
          person_id: p.person_id,
          usa_member_id: rawId,
          sanitized_id: sanitized,
          was_sanitized: sanitized !== rawId,
          id_length_ok: idLenOk,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email ?? null,
          found: false,
          error: e?.message || String(e),
        })
        logger.error(`Error while checking ${label} after ${dur}ms: ${e?.message || e}`)
        // If page or context got closed, try to respawn a new page from context and continue
        const msg = String(e?.message || e)
        if (/closed/i.test(msg)) {
          try {
            workerPage = await ctx.newPage()
            await openSearch(workerPage, logger)
            logger.warn(`[worker ${workerId}] Recovered by creating a fresh page after closure`)
          } catch (spawnErr: any) {
            logger.error(`[worker ${workerId}] Failed to respawn page: ${spawnErr?.message || spawnErr}`)
            break
          }
        }
      }
      // Polite throttle between checks
      await sleep(300)
    }
  }

  // Build worker pages: reuse the same authenticated context for all
  const workerPages: Page[] = [page]
  for (let w = 1; w < concurrency; w++) {
    const wp = await ctx.newPage()
    await openSearch(wp, logger)
    workerPages.push(wp)
  }
  logger.info(`Spawned ${workerPages.length} worker page(s) for verification`)

  // Run workers
  await Promise.all(workerPages.map((wp, idx) => worker(idx + 1, wp)))

  await browser.close()

  // Final flush
  flushResults('final')

  const foundCount = results.filter(r => r.found).length
  const notFoundCount = results.length - foundCount
  const doneMsg = `Done. Checked ${results.length}. FOUND=${foundCount}, NOT_FOUND=${notFoundCount}. Wrote ${outPath} and ${outCsv}`
  console.log(doneMsg)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
