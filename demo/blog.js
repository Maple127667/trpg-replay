/**
 * 模拟博客的 markdown 管线：正文里出现 ```replay 围栏时，
 * 懒加载播放器并把它挂进文章流。这里刻意不用任何框架，
 * 只保留和 react-markdown 接管 `pre` 时等价的行为。
 */

const ARTICLE = `
# 北海九号：把一次跑团记录重排成能看的回放

上周末跑完的那场，原始 log 有 275 条消息、跨了 5 小时 8 分钟。里面混着旁白、对白、行动描写、内心独白、35 次掷骰、4 次暗骰，还有中途插进来的出戏闲聊和几条撤回。

直接导出成聊天记录，读起来很累：凌晨两点的节奏和晚上九点的节奏被压成一长条，掷骰结果和一整屏对白混在一起，还有一半的信息量藏在"谁在说话"这件事里。

所以做了个回放器，把这些东西重新排一遍。下面嵌的就是成品，直接点播放。

\`\`\`replay
{ "src": "/data/replay.json", "assets": "/data/assets.json" }
\`\`\`

## 重排时改了什么

第一件事是**给每条消息定版式**。旁白不是对话框，它应该浮在画面上；心声不该被当成台词念出来；动作描写是舞台指示，得和说话区分开。原 log 的 \`content_type\` 恰好分得够细，所以这一步几乎是白捡的。

第二件事是**掷骰结构化**。平台导出的掷骰是一段多行文本，四种格式（理智检定、属性检定、惩罚骰、暗骰）各自不同。用正则拆成 \`技能 / 目标 / 出目 / 成功等级 / 理智损失\` 之后，就能做成一张会滚动的卡片，而不是一段等宽文本。

第三件事是**时间**。真实时间不能直接用——中间有七分钟没人说话的空档。现在按字数算停留时长，倍速可调，进度条能拖。

> 顺带说：log 里被撤回的消息我没有删干净就当无事发生，而是全部丢弃——因为读者看到的应该是当时桌面上真实发生的事。

如果后面还要加背景音乐，大概会在这张 \`assets.json\` 里挂一条 \`bgm\` 映射，按幕切换。
`;

const post = document.getElementById('post')

/* ---------------------------------------------------------------- 渲染 */

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

/** 极简 markdown：标题 / 引用 / 段落 / replay 围栏。 */
function renderMarkdown(src, host) {
  const parts = src.split(/^```replay\s*$/m)
  parts.forEach((chunk, index) => {
    if (index > 0) {
      // 围栏内容在下一段里，形如 "{json}\n```\n..."
      const close = chunk.indexOf('```')
      const spec = chunk.slice(0, close).trim()
      const rest = chunk.slice(close + 3)
      host.append(buildReplayBlock(spec))
      renderProse(rest, host)
    } else {
      renderProse(chunk, host)
    }
  })
}

function renderProse(src, host) {
  const blocks = src.split(/\n{2,}/)
  for (const raw of blocks) {
    const block = raw.trim()
    if (!block) continue
    if (block.startsWith('### ')) { host.append(el('h3', null, block.slice(4))); continue }
    if (block.startsWith('## ')) { host.append(el('h2', null, block.slice(3))); continue }
    if (block.startsWith('# ')) { host.append(el('h1', null, block.slice(2))); continue }
    if (block.startsWith('> ')) {
      const q = el('blockquote')
      q.textContent = block.replace(/^> ?/gm, '')
      host.append(q)
      continue
    }
    const p = document.createElement('p')
    p.innerHTML = inline(block)
    host.append(p)
  }
}

/** 行内：**粗体** / `代码` / 换行 */
function inline(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br />')
}

/* ---------------------------------------------------------------- 播放器 */

let playerModulePromise

function loadPlayer() {
  // 与博客里 import('/vendor/trpg-replay.mjs') 等价：命中第一个回放块才加载
  playerModulePromise ??= import('../src/index')
  return playerModulePromise
}

function buildReplayBlock(specJson) {
  let spec = {}
  try { spec = JSON.parse(specJson) } catch (err) {
    return el('div', 'replay-skeleton', '配置解析失败')
  }

  const block = el('div', 'replay-block')
  const bar = el('div', 'replay-toolbar')
  const label = el('span', null, 'TRPG REPLAY')
  const group = el('div', 'group')
  const widthBtn = el('button', null, '阅读宽度')
  const fullBtn = el('button', null, '全屏')
  group.append(widthBtn, fullBtn)
  bar.append(label, group)

  const stage = el('div', 'replay-stage')
  const holder = el('div', 'replay-skeleton', 'LOADING')
  const caption = el('div', 'caption', '北海九号 · 幕 1–4 · 265 条记录')

  stage.append(holder)
  block.append(bar, stage, caption)

  // 像视频一样：默认加宽到正文之外，可切回阅读宽度
  widthBtn.addEventListener('click', () => {
    block.classList.toggle('reading')
    widthBtn.textContent = block.classList.contains('reading') ? '加宽' : '阅读宽度'
  })

  let player = null
  fullBtn.addEventListener('click', () => {
    if (!player) return
    const frame = player.shadowRoot?.querySelector('.frame') ?? player
    if (document.fullscreenElement) document.exitFullscreen?.()
    else frame.requestFullscreen?.()
  })

  loadPlayer()
    .then(() => {
      player = document.createElement('trpg-replay')
      player.setAttribute('src', spec.src)
      if (spec.assets) player.setAttribute('assets', spec.assets)
      holder.replaceWith(player)
      player.addEventListener('replay-error', () => {
        player.replaceWith(el('div', 'replay-skeleton', '回放加载失败'))
      })

      // 封面层：点一下才开始，避免文章一打开就自动播
      const poster = el('div', 'replay-poster')
      const disc = el('div', 'disc')
      const text = el('div', 'label', 'PLAY · 北海九号')
      poster.append(disc, text)
      poster.addEventListener('click', () => {
        poster.classList.add('hide')
        setTimeout(() => poster.remove(), 500)
        player.play()
      })
      stage.append(poster)
    })
    .catch(() => holder.replaceWith(el('div', 'replay-skeleton', '播放器加载失败')))

  return block
}

renderMarkdown(ARTICLE, post)
