import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:5199/articles/beihai9-replay-demo', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 4000))

const toBlock = () =>
  page.evaluate(() => {
    const el = document.querySelector('.replay-block')
    const y = el.getBoundingClientRect().top + window.scrollY - 140
    window.scrollTo({ top: y, behavior: 'instant' })
  })

await toBlock()
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: '.tmp/real-poster.png' })

await page.evaluate(() => document.querySelector('.replay-block__poster')?.click())
await new Promise((r) => setTimeout(r, 11000))
await toBlock()
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: '.tmp/real-playing.png' })

await new Promise((r) => setTimeout(r, 9000))
await page.screenshot({ path: '.tmp/real-playing-2.png' })

const info = await page.evaluate(() => {
  const s = document.querySelector('trpg-replay')?.shadowRoot
  const f = s?.querySelector('.frame')?.getBoundingClientRect()
  return {
    frame: f ? `${Math.round(f.width)}x${Math.round(f.height)}` : null,
    scene: s?.querySelector('[data-role="scene"]')?.textContent ?? null,
    characters: s?.querySelectorAll('.char').length ?? 0,
    text: (s?.querySelector('.bubble-text')?.textContent || s?.querySelector('.narration')?.textContent || '').slice(0, 50),
  }
})
console.log(JSON.stringify(info))
await browser.close()
