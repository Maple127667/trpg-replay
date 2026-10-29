import puppeteer from 'puppeteer-core'

const url = process.argv[2] ?? 'http://127.0.0.1:5188/demo/'
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900 },
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 4000))
const info = await page.evaluate(() => {
  const el = document.querySelector('trpg-replay')
  return {
    hasEl: !!el,
    defined: !!customElements.get('trpg-replay'),
    hasShadow: !!el?.shadowRoot,
    shadowChildren: el?.shadowRoot?.childElementCount ?? -1,
    stage: !!el?.shadowRoot?.querySelector('.stage'),
    html: (el?.shadowRoot?.innerHTML ?? '').slice(0, 600),
  }
})
console.log(JSON.stringify(info, null, 2))
console.log(logs.join('\n'))
await browser.close()
