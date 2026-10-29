import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)) })
page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText))

await page.goto('http://127.0.0.1:5199/articles/beihai9-replay-demo', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 4000))

const probe = await page.evaluate(async () => {
  const el = document.querySelector('trpg-replay')
  const shadow = el?.shadowRoot
  const frame = shadow?.querySelector('.frame')
  const stage = shadow?.querySelector('.stage')
  const bg = shadow?.querySelector('.bg')
  const res = {}
  res.shadowHtml = (shadow?.innerHTML ?? '').slice(-400)
  res.bgImage = bg ? getComputedStyle(bg).backgroundImage.slice(0, 120) : null
  res.stageVars = stage ? { scale: stage.style.getPropertyValue('--scale'), f: stage.style.getPropertyValue('--f') } : null
  res.frameBox = frame ? { w: Math.round(frame.getBoundingClientRect().width), h: Math.round(frame.getBoundingClientRect().height) } : null
  try {
    const r = await fetch('/data/beihai9.json')
    res.jsonStatus = r.status
    const j = await r.json()
    res.events = j.events?.length
  } catch (e) { res.jsonError = String(e) }
  try {
    const r = await fetch('/assets/replay/beihai9/bg/scene-01-rig-overview.png')
    res.bgStatus = r.status
  } catch (e) { res.bgError = String(e) }
  return res
})
console.log(JSON.stringify(probe, null, 2))

// 点播放看看
await page.evaluate(() => document.querySelector('.replay-block__poster')?.click())
await new Promise((r) => setTimeout(r, 9000))
await page.screenshot({ path: '.tmp/blog-real-playing.png' })
const now = await page.evaluate(() => {
  const s = document.querySelector('trpg-replay')?.shadowRoot
  return { bubble: s?.querySelector('.bubble-text')?.textContent?.slice(0, 40) ?? null,
           narration: s?.querySelector('.narration')?.textContent?.slice(0, 40) ?? null,
           bg: getComputedStyle(s.querySelector('.bg')).backgroundImage.slice(0, 80) }
})
console.log(JSON.stringify(now))
await browser.close()
