// Public uptime check for the Skills Tech Talk product sites.
// Read-only GET/HEAD requests to public pages and endpoints. No secrets.
// Exits non-zero when any check fails, so the scheduled run fails and GitHub emails the owner.
const TIMEOUT_MS = 20_000

const VERSION_CHECK = body => {
  const d = body?.data ?? body // SST, TuneHabit, GrappleTree, TradeMemoir wrap it; VibeShape returns it bare
  const ok = p => p && /^\d+\.\d+\.\d+$/.test(p.min_supported) && /^\d+\.\d+\.\d+$/.test(p.latest) && /^https:\/\//.test(p.store_url)
  if (body?.success === false || !ok(d?.ios) || !ok(d?.android)) return 'unexpected version-check shape'
  if (d?.maintenance?.active) return `maintenance is on: ${d.maintenance.message || '(no message)'}`
}

const CHECKS = [
  { name: 'Skills Tech Talk site', url: 'https://skillstechtalk.com' },
  { name: 'Skills Tech Talk app', url: 'https://app.skillstechtalk.com' },
  { name: 'Skills Tech Talk API health', url: 'https://api.skillstechtalk.com/health', json: true },
  { name: 'Skills Tech Talk API ready', url: 'https://api.skillstechtalk.com/ready', json: true },
  { name: 'Skills Tech Talk version check', url: 'https://api.skillstechtalk.com/api/app/version-check', json: VERSION_CHECK },
  { name: 'OpenThunder', url: 'https://openthunder.dev' },
  { name: 'ThunderLang', url: 'https://thunderlang.dev' }, // thunderlang.com DNS still points at GoDaddy parking; add it back once it points to Vercel,
  { name: 'IntentLang', url: 'https://intentlanguage.dev' },
  { name: 'TuneHabit', url: 'https://tunehabit.com' },
  { name: 'TuneHabit version check', url: 'https://tunehabit.com/api/app/version-check', json: VERSION_CHECK },
  { name: 'GrappleTree', url: 'https://grappletree.app' },
  { name: 'GrappleTree version check', url: 'https://grappletree.app/api/app/version-check', json: VERSION_CHECK },
  { name: 'GrappleTree Android download', apkFrom: 'https://grappletree.app/android' },
  { name: 'TradeMemoir', url: 'https://tradememoir.app' },
  { name: 'TradeMemoir version check', url: 'https://tradememoir.app/api/app/version-check', json: VERSION_CHECK },
  { name: 'VibeShape', url: 'https://vibeshape.app' },
  { name: 'VibeShape version check', url: 'https://vibeshape.app/api/app/version-check', json: VERSION_CHECK },
]

async function request(url, method = 'GET') {
  let last
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': 'skills-tech-talk-status/1.0', 'cache-control': 'no-cache' } })
      if (res.status >= 500 && attempt === 0) { last = new Error(`HTTP ${res.status}`); continue }
      return res
    } catch (e) { last = e }
  }
  throw last
}

async function run(check) {
  if (check.apkFrom) {
    const page = await request(check.apkFrom)
    if (!page.ok) return `download page returned HTTP ${page.status}`
    const href = (await page.text()).match(/href="([^"]+\.apk)"/)?.[1]
    if (!href) return 'no .apk link on the download page'
    const apk = await request(new URL(href, check.apkFrom).href, 'HEAD')
    return apk.ok ? undefined : `APK returned HTTP ${apk.status}`
  }
  const res = await request(check.url)
  if (!res.ok) return `HTTP ${res.status}`
  if (check.json) {
    let body
    try { body = await res.json() } catch { return 'response is not JSON' }
    if (typeof check.json === 'function') return check.json(body)
  }
}

let failed = 0
for (const check of CHECKS) {
  let problem
  try { problem = await run(check) } catch (e) { problem = e?.cause?.code || e?.name || String(e) }
  console.log(`${problem ? 'FAIL' : 'ok  '}  ${check.name}${problem ? ` — ${problem}` : ''}`)
  if (problem) { failed++; console.log(`::error title=${check.name}::${problem}`) }
}
console.log(failed ? `\n${failed} of ${CHECKS.length} checks failed.` : `\nAll ${CHECKS.length} checks passed.`)
process.exitCode = failed ? 1 : 0
