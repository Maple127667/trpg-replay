import type { ArtAssets, CastMember, CheckData, ReplayDoc, ReplayEvent, Scene } from './types'

export interface PlayerOptions {
  god?: boolean
  speed?: number
  autoplay?: boolean
  assets?: ArtAssets
}

/** 角色站位与配色。原 log 没有这些信息，属于表现层配置。 */
const SLOT: Record<string, 'left' | 'right' | 'center'> = {
  liangyan: 'left',
  wenkele: 'right',
  jessica: 'right',
  sisyphus: 'left',
  angelo: 'center',
  maple: 'center',
}

const PALETTE: Record<string, [string, string]> = {
  liangyan: ['#3d4a5c', '#151a22'],
  wenkele: ['#5c4a3d', '#221a15'],
  jessica: ['#3d5c4a', '#15221a'],
  sisyphus: ['#4a3d5c', '#1a1522'],
  angelo: ['#5c4f3d', '#221e15'],
  maple: ['#2b3240', '#12151b'],
}

/** 名字牌配色：比立绘底色亮，保证在深色对话框上可读。 */
const ACCENT: Record<string, string> = {
  liangyan: '#9dc4e8',
  wenkele: '#e8b98a',
  jessica: '#93d3a5',
  sisyphus: '#bba8d8',
  angelo: '#e0c48a',
  maple: '#c8d2e0',
}

/** 占位背景：没给原图时用的氛围渐变。 */
const SCENE_GRADIENT: Array<[string, string, string]> = [
  ['#1b2530', '#101820', '#2c3a48'],
  ['#14171c', '#0d0f13', '#22272e'],
  ['#221c16', '#110e0b', '#33291f'],
  ['#0e1418', '#080c0f', '#1a2a32'],
]

const LEVEL_COLOR: Record<string, string> = {
  大成功: '#f0d38a',
  极难成功: '#c9a6e8',
  困难成功: '#8fd8a8',
  普通成功: '#8fb8dd',
  成功: '#8fb8dd',
  失败: '#9aa6b8',
  大失败: '#e08b8b',
}

const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zm12 0v14l-9-7z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM6 5l9 7-9 7z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>',
}

export class Player {
  private doc: ReplayDoc
  private castById = new Map<string, CastMember>()
  private options: PlayerOptions

  private root: ShadowRoot
  private frame!: HTMLDivElement
  private stage!: HTMLDivElement
  private bgA!: HTMLDivElement
  private bgB!: HTMLDivElement
  private castEl!: HTMLDivElement
  private bodyEl!: HTMLDivElement
  private hudEl!: HTMLDivElement
  private sanEl!: HTMLDivElement
  private uiEl!: HTMLDivElement
  private progressFill!: HTMLDivElement
  private chapterMenu!: HTMLDivElement
  private overlay!: HTMLDivElement

  private visible: ReplayEvent[] = []
  private i = 0
  private playing = false
  private god = false
  private speed = 1
  private gen = 0
  private timer: number | null = null
  private wake: (() => void) | null = null
  private san: Record<string, { cur: number; max: number }> = {}
  private currentScene = -1
  private scale = 1

  constructor(root: ShadowRoot, doc: ReplayDoc, options: PlayerOptions = {}) {
    this.root = root
    this.doc = doc
    this.options = options
    this.god = !!options.god
    this.speed = options.speed && options.speed > 0 ? options.speed : 1
    for (const c of doc.cast ?? []) this.castById.set(c.id, c)
    this.rebuildVisible()
    this.mount()
    this.showScene(0, true)
  }

  /* ------------------------------------------------------------ 生命周期 */

  mount() {
    this.frame = el('div', 'frame')
    this.frame.tabIndex = 0
    this.stage = el('div', 'stage')

    this.bgA = el('div', 'bg')
    this.bgB = el('div', 'bg bg-next')
    this.bgB.classList.remove('in')

    this.castEl = el('div', 'cast')
    this.bodyEl = el('div', 'body')
    this.overlay = el('div', 'overlay')
    this.overlay.style.position = 'absolute'
    this.overlay.style.inset = '0'
    this.overlay.style.pointerEvents = 'none'

    this.hudEl = el('div', 'hud')
    const title = el('div', 'title')
    title.textContent = this.doc.meta?.title ?? 'TRPG REPLAY'
    this.sanEl = el('div', 'san')
    this.hudEl.append(title, this.sanEl)

    const vignette = el('div', 'vignette')
    const grain = el('div', 'grain')

    this.stage.append(this.bgA, this.bgB, this.castEl, grain, vignette, this.bodyEl, this.hudEl, this.overlay, this.buildUI())
    this.frame.append(this.stage)
    this.root.append(this.frame)

    new ResizeObserver(() => this.fit()).observe(this.frame)
    this.fit()

    this.frame.addEventListener('keydown', (e) => this.onKey(e))
    this.frame.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('.ui') || t.closest('.chapters') || t.closest('.progress')) return
      this.toggle()
    })
    this.frame.addEventListener('fullscreenchange', () => this.fit())

    if (this.options.autoplay) setTimeout(() => this.run(0), 400)
  }

  destroy() {
    this.gen++
    if (this.timer) clearTimeout(this.timer)
    this.root.replaceChildren()
  }

  /* ------------------------------------------------------------ 对外控制 */

  play() {
    if (this.i >= this.visible.length) this.i = 0
    void this.run(this.i)
  }

  /** 当前正在展示的事件序号（调试 / 深链用）。 */
  get currentSeq() {
    return this.visible[this.i]?.seq ?? 0
  }
  pause() {
    this.playing = false
    this.gen++
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this.wake?.()
    this.wake = null
    this.syncPlayBtn()
  }
  toggle() { this.playing ? this.pause() : this.play() }
  next() { this.pause(); this.presentIndex(Math.min(this.i + 1, this.visible.length - 1)) }
  prev() { this.pause(); this.presentIndex(Math.max(this.i - 1, 0)) }

  setGod(on: boolean) {
    if (this.god === on) return
    const anchorSeq = this.visible[this.i]?.seq ?? 0
    this.god = on
    this.rebuildVisible()
    const idx = this.visible.findIndex((e) => e.seq >= anchorSeq)
    this.pause()
    this.presentIndex(idx < 0 ? this.visible.length - 1 : idx)
    this.syncButtons()
  }

  setSpeed(s: number) {
    this.speed = s
    this.syncButtons()
  }

  jumpToScene(index: number) {
    this.pause()
    const target = this.visible.findIndex((e) => e.scene === index)
    if (target < 0) return
    this.showScene(index, false)
    this.presentIndex(target)
  }

  seek(seq: number) {
    this.pause()
    const idx = this.visible.findIndex((e) => e.seq >= seq)
    this.presentIndex(idx < 0 ? this.visible.length - 1 : idx)
  }

  /* ------------------------------------------------------------ 播放循环 */

  private rebuildVisible() {
    this.visible = (this.doc.events ?? []).filter((e) => {
      if (e.type === 'hidden_check' || e.type === 'ooc') return this.god
      return true
    })
  }

  private async run(startIndex: number) {
    this.playing = true
    this.syncPlayBtn()
    let idx = Math.max(0, Math.min(startIndex, this.visible.length - 1))
    this.i = idx

    while (idx < this.visible.length) {
      const g = ++this.gen
      this.i = idx
      this.updateProgress()
      await this.present(this.visible[idx], g)
      if (g !== this.gen || !this.playing) return
      idx++
      this.i = idx
      this.updateProgress()
    }
    this.playing = false
    this.syncPlayBtn()
    this.showEnd()
  }

  /**
   * 渲染单条并停住。索引**同步**落到 this.i，避免上一次渲染还在 await 时
   * 连点「下一句」算出同一个目标（表现为点两次才前进一条）。
   */
  private presentIndex(index: number) {
    if (!this.visible.length) return
    const target = Math.max(0, Math.min(index, this.visible.length - 1))
    const g = ++this.gen
    this.i = target
    this.updateProgress()
    void this.present(this.visible[target], g)
  }

  private async present(ev: ReplayEvent, g: number) {
    this.ensureScene(ev.scene)
    if (ev.type === 'narration' || ev.type === 'action' || ev.type === 'dialogue' || ev.type === 'thought' || ev.type === 'unknown') {
      this.overlay.replaceChildren()
    }
    switch (ev.type) {
      case 'marker':
        await this.presentMarker(ev, g)
        return
      case 'narration':
        await this.presentNarration(ev, g)
        return
      case 'action':
        await this.presentAction(ev, g)
        return
      case 'dialogue':
      case 'thought':
        await this.presentSpeech(ev, g)
        return
      case 'check':
      case 'hidden_check':
        await this.presentCheck(ev, g)
        return
      case 'ooc':
        await this.presentOoc(ev, g)
        return
      default:
        await this.presentNarration(ev, g)
    }
  }

  /* ------------------------------------------------------------ 各类渲染 */

  private async presentMarker(ev: ReplayEvent, g: number) {
    if (ev.subtype === 'scene') {
      this.applyScene(ev.scene)
      await this.showSceneCard(ev.scene, g)
      return
    }
    // [Empty] 之类：暂不渲染，仅占位（后续可绑手卡/插画）
    await this.sleep(120, g)
  }

  private async presentNarration(ev: ReplayEvent, g: number) {
    this.dimCast(true)
    const node = el('div', 'narration')
    this.bodyEl.replaceChildren(node)

    if (ev.segments?.length) {
      for (const seg of ev.segments) {
        const line = el('span', 'seg')
        const tag = el('i', '')
        tag.textContent = seg.where
        line.append(tag, document.createTextNode(seg.what))
        node.append(line)
        if (!this.alive(g)) return
        await this.sleep(260 / this.speed, g)
      }
      await this.sleep(ev.ms * 0.5 / this.speed, g)
      return
    }

    if (ev.audience?.length) {
      const tag = el('span', 'private-tag')
      tag.textContent = '仅 ' + ev.audience.map((id) => this.nameOf(id)).join(' / ') + ' 可闻'
      node.append(tag)
    }
    await this.typeInto(node, ev.text, g)
    await this.hold(ev, g)
  }

  private async presentAction(ev: ReplayEvent, g: number) {
    this.dimCast(false)
    this.highlight(ev.speaker)
    const node = el('div', 'action')
    this.bodyEl.replaceChildren(node)
    await this.typeInto(node, ev.text, g)
    await this.hold(ev, g)
  }

  private async presentSpeech(ev: ReplayEvent, g: number) {
    this.highlight(ev.speaker)
    const bubble = el('div', 'bubble' + (ev.type === 'thought' ? ' thought' : '') + (ev.channel === 'radio' ? ' radio' : ''))
    const name = el('div', 'bubble-name')
    const cast = this.castById.get(ev.speaker)
    const cname = cast?.name ?? ev.speaker
    name.style.color = this.colorOf(ev.speaker)
    const nm = document.createElement('span')
    nm.textContent = cname
    name.append(nm)
    const kindTag = el('em', '')
    kindTag.textContent = ev.type === 'thought' ? '心声' : ev.channel === 'radio' ? '无线电' : ''
    if (kindTag.textContent) name.append(kindTag)

    if (ev.audience?.length) {
      const tag = el('span', 'private-tag')
      tag.textContent = '仅 ' + ev.audience.map((id) => this.nameOf(id)).join(' / ') + ' 可闻'
      bubble.append(tag)
    }

    const text = el('div', 'bubble-text')
    bubble.append(name, text)
    this.bodyEl.replaceChildren(bubble)
    await this.typeInto(text, ev.text, g)
    await this.hold(ev, g)
  }

  private async presentCheck(ev: ReplayEvent, g: number) {
    const c: CheckData = ev.check ?? { kind: 'unparsed' }
    const wrap = el('div', 'check-wrap')
    const card = el('div', 'check')
    const badge = el('div', 'check-badge')
    badge.textContent = ev.type === 'hidden_check' ? '暗骰 · 主持人视角' : kindLabel(c.kind)
    card.append(badge)

    if (c.prompt) {
      const p = el('div', 'check-prompt')
      p.textContent = c.prompt
      card.append(p)
    }

    const skill = el('div', 'check-skill')
    if (c.kind === 'san') skill.textContent = '理智检定'
    else if (c.kind === 'skill') skill.textContent = c.skill ?? '检定'
    else if (c.kind === 'hidden') skill.textContent = c.formula ?? '暗骰'
    else if (c.kind === 'dice_pool') skill.textContent = c.pool ?? '惩罚骰'
    else skill.textContent = '检定'
    card.append(skill)

    if (typeof c.target === 'number' && c.kind !== 'hidden') {
      const t = el('div', 'check-target')
      t.textContent = `目标 ${c.target}`
      card.append(t)
    }

    const dice = el('div', 'check-dice')
    dice.textContent = '00'
    card.append(dice)

    const level = el('div', 'check-level')
    card.append(level)

    const loss = el('div', 'check-loss')
    card.append(loss)

    wrap.append(card)
    this.overlay.replaceChildren(wrap)

    // 骰子滚动
    const final = c.roll ?? c.total ?? c.value ?? 0
    const rollMs = 700 / this.speed
    const started = performance.now()
    while (this.alive(g)) {
      const t = performance.now() - started
      if (t >= rollMs) break
      dice.textContent = String(Math.floor(Math.random() * 100)).padStart(2, '0')
      await this.sleep(46, g)
    }
    if (!this.alive(g)) return
    dice.textContent = String(final)
    if (c.level) {
      dice.style.color = LEVEL_COLOR[c.level] ?? '#e8ecf2'
      level.textContent = c.level
      level.style.setProperty('--lvl', LEVEL_COLOR[c.level] ?? '#8fb8dd')
      level.classList.add('in')
    } else if (c.kind === 'hidden') {
      level.textContent = '结果 ' + String(final)
      level.classList.add('in')
    }
    if (c.kind === 'dice_pool' && c.tens && typeof c.unit === 'number') {
      level.textContent = `十位 ${c.tens.join(' / ')} → ${c.tensKeep} ＋ 个位 ${c.unit}`
      level.style.setProperty('--lvl', '#9aa6b8')
      level.classList.add('in')
    }
    if (typeof c.lossValue === 'number' && c.kind === 'san') {
      loss.textContent = c.lossValue > 0 ? `理智 −${c.lossValue}` : '理智无损'
      loss.style.color = c.lossValue > 0 ? '#e08b8b' : 'rgba(232,236,242,.38)'
      loss.classList.add('in')
      this.applySan(c.actor, c.target, c.lossValue)
    }

    await this.sleep(1100 / this.speed, g)
    if (!this.alive(g)) return
    this.overlay.replaceChildren()
  }

  private async presentOoc(ev: ReplayEvent, g: number) {
    const node = el('div', 'ooc')
    const b = document.createElement('b')
    b.textContent = this.nameOf(ev.speaker)
    node.append(b, document.createTextNode(ev.text))
    this.overlay.replaceChildren(node)
    await this.sleep(1400 / this.speed, g)
    if (this.alive(g)) this.overlay.replaceChildren()
  }

  /* ------------------------------------------------------------ 场景 */

  private ensureScene(index: number) {
    if (index === this.currentScene) return
    this.applyScene(index)
  }

  private applyScene(index: number) {
    const scene = this.doc.scenes?.[index]
    const url = this.options.assets?.scenes?.[String(index)]
    const g = SCENE_GRADIENT[index % SCENE_GRADIENT.length]

    this.bgB.style.backgroundImage = url
      ? `url("${url}")`
      : `radial-gradient(120% 90% at 50% 10%, ${g[2]} 0%, ${g[0]} 45%, ${g[1]} 100%)`
    this.bgB.classList.remove('in')
    // 强制回流后淡入，形成交叉溶解
    void this.bgB.offsetWidth
    this.bgB.classList.add('in')
    setTimeout(() => {
      this.bgA.style.backgroundImage = getComputedStyle(this.bgB).backgroundImage
      this.bgB.classList.remove('in')
    }, 920)

    this.currentScene = index
    if (scene) this.syncChapters()
  }

  private async showSceneCard(index: number, g: number) {
    const scene = this.doc.scenes?.[index]
    if (!scene) return
    const card = el('div', 'scene-card')
    const no = el('div', 'scene-no')
    no.textContent = `SCENE ${String(index + 1).padStart(2, '0')}`
    const label = el('div', 'scene-label')
    label.textContent = scene.label
    const line = el('div', 'scene-line')
    card.append(no, label, line)
    this.overlay.replaceChildren(card)
    await this.sleep(Math.min(2200, 1500 + scene.label.length * 40) / this.speed, g)
    card.classList.add('out')
    await this.sleep(420 / this.speed, g)
    if (this.overlay.contains(card)) this.overlay.replaceChildren()
  }

  private showScene(index: number, initial: boolean) {
    this.applyScene(index)
    if (initial) {
      const g = ++this.gen
      void this.showSceneCard(index, g)
      this.playing = false
      this.syncPlayBtn()
    }
  }

  /* ------------------------------------------------------------ 立绘 */

  private dimCast(dim: boolean) {
    for (const node of Array.from(this.castEl.children)) {
      node.classList.toggle('active', !dim)
    }
  }

  private highlight(id: string) {
    const slot = SLOT[id]
    const cast = this.castById.get(id)
    if (!cast || cast.role === 'kp' || !slot) return
    // 只保留当前说话人与另一位主要角色
    for (const node of Array.from(this.castEl.querySelectorAll<HTMLElement>('.char'))) {
      node.classList.toggle('active', node.dataset.id === id)
    }
    if (!this.castEl.querySelector(`.char[data-id="${id}"]`)) this.spawnChar(id, slot)
  }

  private spawnChar(id: string, slot: 'left' | 'right' | 'center') {
    const node = el('div', 'char') as HTMLDivElement
    node.dataset.id = id
    node.dataset.slot = slot
    const url = this.options.assets?.characters?.[id]?.default
    if (url) {
      const img = document.createElement('img')
      img.src = url
      img.alt = this.nameOf(id)
      node.append(img)
    } else {
      const ph = el('div', 'ph')
      const [c1, c2] = PALETTE[id] ?? ['#2a3140', '#11151c']
      ph.style.setProperty('--c1', c1)
      ph.style.setProperty('--c2', c2)
      const b = document.createElement('b')
      b.textContent = this.nameOf(id).slice(0, 1)
      const s = document.createElement('span')
      s.textContent = this.nameOf(id)
      ph.append(b, s)
      node.append(ph)
    }
    this.castEl.append(node)
    requestAnimationFrame(() => node.classList.add('show'))
  }

  /* ------------------------------------------------------------ HUD / SAN */

  private applySan(actor: string | undefined, target: number | undefined, loss: number) {
    if (!actor) return
    const id = this.idOf(actor)
    if (!id) return
    const prev = this.san[id]
    const max = prev?.max ?? target ?? 0
    const cur = Math.max(0, (prev?.cur ?? max) - loss)
    this.san[id] = { cur, max }
    this.renderSan()
  }

  private renderSan() {
    const rows = Object.entries(this.san).filter(([, v]) => v.max > 0)
    this.sanEl.replaceChildren()
    for (const [id, v] of rows) {
      const row = el('div', 'san-row')
      const name = el('div', 'san-name')
      name.textContent = this.nameOf(id)
      const bar = el('div', 'san-bar')
      const fill = el('div', 'san-fill' + (v.cur / v.max < 0.4 ? ' low' : ''))
      fill.style.width = `${Math.round((v.cur / v.max) * 100)}%`
      bar.append(fill)
      const val = el('div', 'san-val')
      val.textContent = String(v.cur)
      row.append(name, bar, val)
      this.sanEl.append(row)
    }
    this.hudEl.classList.toggle('show', rows.length > 0)
  }

  /* ------------------------------------------------------------ 控件 */

  private buildUI(): HTMLDivElement {
    this.uiEl = el('div', 'ui pinned')
    const play = btn('play', ICONS.play, () => this.toggle())
    play.dataset.role = 'play'

    const prev = btn('prev', ICONS.prev, () => this.prev())
    const next = btn('next', ICONS.next, () => this.next())

    const sceneBtn = el('button', 'scene-btn') as HTMLButtonElement
    sceneBtn.type = 'button'
    sceneBtn.textContent = this.doc.scenes?.[0]?.label ?? ''
    sceneBtn.dataset.role = 'scene'
    sceneBtn.addEventListener('click', () => {
      this.chapterMenu.classList.toggle('open')
      this.syncChapters()
    })

    const speed = btn('speed', '', () => {
      const seq = [1, 1.5, 2, 0.75]
      const idx = seq.indexOf(this.speed)
      this.setSpeed(seq[(idx + 1) % seq.length])
    })
    speed.classList.add('wide')
    speed.dataset.role = 'speed'
    speed.textContent = '1.0×'

    const god = btn('god', ICONS.eye, () => this.setGod(!this.god))
    god.dataset.role = 'god'
    god.title = '上帝视角：显示暗骰与 OOC'

    const full = btn('full', ICONS.full, () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void this.frame.requestFullscreen?.()
    })

    const list = btn('list', ICONS.list, () => {
      this.chapterMenu.classList.toggle('open')
      this.syncChapters()
    })

    const progress = el('div', 'progress')
    this.progressFill = el('div', 'progress-fill')
    progress.append(this.progressFill)
    progress.addEventListener('click', (e) => {
      const r = progress.getBoundingClientRect()
      const ratio = (e.clientX - r.left) / r.width
      const idx = Math.round(ratio * (this.visible.length - 1))
      this.pause()
      this.presentIndex(Math.max(0, Math.min(idx, this.visible.length - 1)))
    })

    this.chapterMenu = el('div', 'chapters')

    const spacer1 = el('div', 'spacer')
    this.uiEl.append(play, prev, next, spacer1, sceneBtn, speed, god, list, full)
    this.uiEl.append(this.chapterMenu, progress)
    this.syncButtons()
    return this.uiEl
  }

  private syncButtons() {
    const god = this.uiEl.querySelector<HTMLElement>('[data-role="god"]')
    god?.classList.toggle('on', this.god)
    const speed = this.uiEl.querySelector<HTMLElement>('[data-role="speed"]')
    if (speed) speed.textContent = `${this.speed.toFixed(2).replace(/0$/, '')}×`
    this.syncPlayBtn()
  }

  private syncPlayBtn() {
    const play = this.uiEl?.querySelector<HTMLElement>('[data-role="play"]')
    if (play) play.innerHTML = this.playing ? ICONS.pause : ICONS.play
  }

  private syncChapters() {
    const list = this.doc.scenes ?? []
    this.chapterMenu.replaceChildren()
    list.forEach((s: Scene) => {
      const b = document.createElement('button')
      b.type = 'button'
      const no = document.createElement('span')
      no.textContent = String(s.index + 1).padStart(2, '0')
      b.append(no, document.createTextNode(s.label))
      b.addEventListener('click', () => {
        this.chapterMenu.classList.remove('open')
        this.jumpToScene(s.index)
      })
      this.chapterMenu.append(b)
    })
    const cur = this.doc.scenes?.[this.currentScene]
    const label = this.uiEl?.querySelector<HTMLElement>('[data-role="scene"]')
    if (label && cur) label.textContent = cur.label
  }

  private updateProgress() {
    if (!this.progressFill) return
    const p = this.visible.length ? this.i / this.visible.length : 0
    this.progressFill.style.width = `${Math.round(p * 1000) / 10}%`
  }

  private showEnd() {
    const end = el('div', 'end')
    const t = el('div', 't')
    t.textContent = '— 未完待续 —'
    const s = el('div', 's')
    s.textContent = `${this.doc.meta?.startedAt ?? ''} · ${this.visible.length} 条记录`
    end.append(t, s)
    this.overlay.replaceChildren(end)
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === ' ') { e.preventDefault(); this.toggle() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev() }
  }

  /* ------------------------------------------------------------ 工具 */

  private fit() {
    const r = this.frame.getBoundingClientRect()
    if (!r.width) return
    this.scale = Math.min(r.width / 1280, r.height / 720)
    this.stage.style.setProperty('--scale', String(this.scale))
  }

  /**
   * 打字机。先把完整文本放进一个不可见的 ghost 里排好版，占住最终高度；
   * 可见文本绝对定位叠在它上面逐字显现。
   *
   * 这样换行时整段文字不会往上跳——否则每多一行，底部对齐的旁白就会
   * 整体位移一次，看起来像画面在抖。
   */
  private async typeInto(container: HTMLElement, text: string, g: number): Promise<void> {
    const box = document.createElement('div')
    box.className = 'textbox'

    const ghost = document.createElement('span')
    ghost.className = 'ghost'
    ghost.setAttribute('aria-hidden', 'true')
    ghost.textContent = text || ' '

    const typed = document.createElement('span')
    typed.className = 'typed'
    const caret = document.createElement('i')
    caret.className = 'caret'
    typed.append(caret)

    box.append(ghost, typed)
    container.append(box)

    const cps = Math.max(10, 34 * this.speed)
    const step = Math.max(1, Math.round(cps / 50))
    let i = 0
    while (i < text.length) {
      if (!this.alive(g)) return
      i = Math.min(text.length, i + step)
      typed.textContent = text.slice(0, i)
      typed.append(caret)
      await this.sleep((1000 / cps) * step, g)
    }
    caret.remove()
    typed.textContent = text
  }

  private async hold(ev: ReplayEvent, g: number) {
    const typed = (ev.text.length / Math.max(10, 34 * this.speed)) * 1000
    const rest = Math.max(280, ev.ms / this.speed - typed)
    await this.sleep(rest, g)
  }

  private sleep(ms: number, g: number): Promise<void> {
    return new Promise<void>((resolve) => {
      // 释放上一个等待者，避免被打断的 present 永久挂着
      const prev = this.wake
      this.wake = null
      if (this.timer) { clearTimeout(this.timer); this.timer = null }
      prev?.()

      if (!this.alive(g)) { resolve(); return }
      this.wake = () => {
        const t = this.timer
        this.timer = null
        this.wake = null
        if (t) clearTimeout(t)
        resolve()
      }
      this.timer = window.setTimeout(() => {
        this.timer = null
        this.wake = null
        resolve()
      }, Math.max(0, ms))
    })
  }

  private alive(g: number) {
    return g === this.gen
  }

  private nameOf(id: string) {
    return this.castById.get(id)?.name ?? id
  }

  private colorOf(id: string) {
    return ACCENT[id] ?? '#e8ecf2'
  }

  private idOf(name: string) {
    for (const [id, c] of this.castById) if (c.name === name) return id
    return undefined
  }
}

/* ---------------------------------------------------------------- helpers */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  return n
}

function btn(role: string, html: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'btn'
  b.dataset.role = role
  if (html) b.innerHTML = html
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick() })
  return b
}

function kindLabel(kind: string) {
  switch (kind) {
    case 'san': return 'SAN CHECK'
    case 'skill': return 'SKILL CHECK'
    case 'dice_pool': return 'PENALTY / BONUS'
    case 'hidden': return 'KEEPER ONLY'
    default: return 'CHECK'
  }
}
