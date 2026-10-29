/**
 * 交互回归测试：
 *   1. 连点「下一句」是否每次只前进一条（bug: 需要点两次）
 *   2. 旁白打字过程中，文本块位置是否抖动（bug: 换行导致整体位移）
 *
 *   node tools/click-test.mjs
 */
import puppeteer from 'puppeteer-core'

const chromePath =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900 },
})

const fail = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fail.push(msg)
}

try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:5188/demo/?seq=7', { waitUntil: 'domcontentloaded' })
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const mounted = await page.evaluate(
      () => !!document.querySelector('trpg-replay')?.shadowRoot?.querySelector('.stage'),
    )
    if (mounted) break
  }
  await new Promise((r) => setTimeout(r, 1500))

  const seqOf = () =>
    page.evaluate(() => document.querySelector('trpg-replay').currentSeq)

  const nextBtn = async () => {
    await page.evaluate(() => {
      const root = document.querySelector('trpg-replay').shadowRoot
      root.querySelector('[data-role="next"]').click()
    })
  }

  // ---- 1. 连点前进
  const start = await seqOf()
  const seen = [start]
  for (let i = 0; i < 3; i++) {
    await nextBtn()
    await new Promise((r) => setTimeout(r, 220))
    seen.push(await seqOf())
  }
  ok(seen[1] !== seen[0], `第一次点「下一句」前进：${seen.join(' -> ')}`)
  ok(seen[2] !== seen[1], `第二次点「下一句」前进：${seen[1]} -> ${seen[2]}`)
  ok(seen[3] !== seen[2], `第三次点「下一句」前进：${seen[2]} -> ${seen[3]}`)

  // 间隔更短也不该吞掉点击
  const before = await seqOf()
  await nextBtn()
  await nextBtn()
  await new Promise((r) => setTimeout(r, 250))
  const after = await seqOf()
  ok(after >= before + 2 - 1, `快速连点两次至少前进一条（${before} -> ${after}）`)

  // ---- 2. 打字机排版稳定性
  await page.evaluate(() => {
    const el = document.querySelector('trpg-replay')
    el.seek(8) // 一条 20+ 字的旁白
  })
  const samples = []
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 90))
    const box = await page.evaluate(() => {
      const root = document.querySelector('trpg-replay').shadowRoot
      const n = root.querySelector('.narration')
      if (!n) return null
      const r = n.getBoundingClientRect()
      return { top: Math.round(r.top), h: Math.round(r.height) }
    })
    if (box) samples.push(box)
  }
  const tops = samples.map((s) => s.top)
  const spread = Math.max(...tops) - Math.min(...tops)
  ok(samples.length > 4, `采集到 ${samples.length} 帧旁白布局`)
  ok(spread <= 2, `旁白顶边在打字过程中稳定（波动 ${spread}px，样本 ${[...new Set(tops)].join(',')}）`)

  if (errors.length) fail.push('页面报错：' + errors.join(' | '))
  ok(errors.length === 0, '无运行时报错')
} finally {
  await browser.close()
}

console.log(fail.length ? `\n${fail.length} 项失败` : '\n全部通过')
process.exit(fail.length ? 1 : 0)
