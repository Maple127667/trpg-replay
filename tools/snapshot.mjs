/**
 * 鏈湴楠岃瘉鑴氭湰锛氱敤鏈満 Chrome 鎵撳紑 demo锛岃烦鍒版寚瀹?seq 鍚庢埅鍥?+ 瀵煎嚭 Shadow DOM銆? *
 *   node tools/snapshot.mjs --seq 7 --out .tmp/frame.png --dom .tmp/frame.html
 *   node tools/snapshot.mjs --url "?seq=69&god=1" --wait 2500 --out .tmp/check.png
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const get = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  const v = i >= 0 ? args[i + 1] : undefined
  return v === undefined || v.startsWith('--') ? fallback : v
}

const base = get('url', '')
const out = get('out', '.tmp/frame.png')
const domPath = get('dom', '')
const wait = Number(get('wait', '2500'))
const chromePath =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
})

try {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(`http://127.0.0.1:5188/demo/${base}`, { waitUntil: 'domcontentloaded' })
  let mounted = false
  for (let i = 0; i < 40 && !mounted; i++) {
    await new Promise((r) => setTimeout(r, 500))
    mounted = await page.evaluate(
      () => !!document.querySelector('trpg-replay')?.shadowRoot?.querySelector('.stage'),
    )
  }
  if (!mounted) throw new Error('播放器没有挂载（.stage 不存在）')
  await new Promise((r) => setTimeout(r, wait))

  mkdirSync(dirname(out), { recursive: true })
  await page.screenshot({ path: out })
  console.log(`screenshot -> ${out}`)

  if (domPath) {
    const html = await page.evaluate(() => {
      const root = document.querySelector('trpg-replay').shadowRoot
      return root.innerHTML
    })
    writeFileSync(domPath, html, 'utf8')
    console.log(`dom -> ${domPath} (${html.length} chars)`)
  }

  const diag = await page.evaluate(() => {
    const root = document.querySelector('trpg-replay').shadowRoot
    const q = (s) => Array.from(root.querySelectorAll(s))
    return {
      narrations: q('.narration').length,
      bubbles: q('.bubble').length,
      chars: q('.char').length,
      overlays: q('.overlay').map((o) => o.children.length),
      stageScale: getComputedStyle(q('.stage')[0]).getPropertyValue('--scale'),
      bodyChildren: q('.body').map((b) => b.children.length),
    }
  })
  console.log('diag', JSON.stringify(diag))
  if (errors.length) console.log('console errors:\n' + errors.join('\n'))
} finally {
  await browser.close()
}

