import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:5188/demo/blog.html', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 3200))

const box = async () =>
  page.evaluate(() => {
    const el = document.querySelector('trpg-replay')
    const f = el?.shadowRoot?.querySelector('.frame')?.getBoundingClientRect()
    return f ? { w: Math.round(f.width), h: Math.round(f.height) } : null
  })

console.log('默认宽度:', JSON.stringify(await box()))

// 封面态
await page.evaluate(() => document.querySelector('.replay-block')?.scrollIntoView({ block: 'center' }))
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: '.tmp/blog-poster.png' })

// 点封面开始播放
await page.evaluate(() => document.querySelector('.replay-poster')?.click())
await new Promise((r) => setTimeout(r, 9000))
await page.screenshot({ path: '.tmp/blog-playing.png' })

// 切回阅读宽度
await page.evaluate(() => document.querySelectorAll('.replay-toolbar button')[0]?.click())
await new Promise((r) => setTimeout(r, 1200))
console.log('阅读宽度:', JSON.stringify(await box()))
await page.screenshot({ path: '.tmp/blog-reading.png' })

await browser.close()
