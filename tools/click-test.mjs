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

  // ---- 2. 逐字显现时的排版稳定性
  await page.evaluate(() => {
    const el = document.querySelector('trpg-replay')
    el.seek(9) // 60+ 字、会折成 2 行以上的旁白
  })
  const samples = []
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 70))
    const box = await page.evaluate(() => {
      const root = document.querySelector('trpg-replay').shadowRoot
      const n = root.querySelector('.narration')
      const chars = root.querySelectorAll('.narration .ch')
      if (!n || !chars.length) return null
      const rn = n.getBoundingClientRect()
      const first = chars[0].getBoundingClientRect()
      const last = chars[chars.length - 1].getBoundingClientRect()
      return {
        top: Math.round(rn.top),
        h: Math.round(rn.height),
        w: Math.round(rn.width),
        firstLeft: Math.round(first.left),
        firstTop: Math.round(first.top),
        lastLeft: Math.round(last.left),
        lastTop: Math.round(last.top),
        total: chars.length,
        on: root.querySelectorAll('.narration .ch.on').length,
      }
    })
    if (box) samples.push(box)
  }

  ok(samples.length > 10, `采集到 ${samples.length} 帧`)
  ok(samples.at(-1).on === samples.at(-1).total, `字符逐字点亮完成（${samples.at(-1).on}/${samples.at(-1).total}）`)
  ok(samples[0].on < samples.at(-1).on, '确实是逐个出现，不是一次性全出')

  const cmp = (k) => {
    const vals = samples.map((s) => s[k])
    return Math.max(...vals) - Math.min(...vals)
  }
  ok(cmp('top') === 0, `旁白块顶边恒定（波动 ${cmp('top')}px）`)
  ok(cmp('h') === 0, `旁白块高度恒定（波动 ${cmp('h')}px）`)
  ok(cmp('firstLeft') === 0, `首字横向位置恒定（波动 ${cmp('firstLeft')}px）`)
  ok(cmp('firstTop') === 0, `首字纵向位置恒定（波动 ${cmp('firstTop')}px）`)
  ok(cmp('lastLeft') === 0, `末字横向位置恒定（波动 ${cmp('lastLeft')}px）`)
  ok(cmp('lastTop') === 0, `末字纵向位置恒定（波动 ${cmp('lastTop')}px）`)
  ok(cmp('total') === 0, `字符节点数恒定（${samples[0].total} 个）`)

  if (errors.length) fail.push('页面报错：' + errors.join(' | '))
  ok(errors.length === 0, '无运行时报错')
} finally {
  await browser.close()
}

console.log(fail.length ? `\n${fail.length} 项失败` : '\n全部通过')
process.exit(fail.length ? 1 : 0)
