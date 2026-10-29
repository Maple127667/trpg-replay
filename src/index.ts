import { Player, type PlayerOptions } from './player'
import { STYLE } from './style'
import type { ArtAssets, ReplayDoc } from './types'

export type { ArtAssets, ReplayDoc, ReplayEvent } from './types'

/**
 * <trpg-replay src="replay.json"></trpg-replay>
 *
 * 属性：
 *   src        replay.json 的地址（必填，或用 data 属性直接塞对象）
 *   assets     assets.json 地址（可选，缺省用内置占位美术）
 *   god        "true" 时默认打开上帝视角（显示暗骰 / OOC）
 *   speed      播放倍速，默认 1
 *   autoplay   "true" 时自动开始
 *   start      从某个 seq 开始
 */
export class TrpgReplayElement extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'assets', 'god', 'speed', 'autoplay']
  }

  private shadow: ShadowRoot
  private player: Player | null = null
  private ready = false

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = STYLE
    this.shadow.append(style)
  }

  /** 直接注入数据（SSR / 内联场景），优先于 src */
  data: ReplayDoc | null = null
  assets: ArtAssets | null = null

  connectedCallback() {
    void this.boot()
  }

  disconnectedCallback() {
    this.player?.destroy()
    this.player = null
  }

  attributeChangedCallback(_name: string, oldV: string | null, newV: string | null) {
    if (!this.ready || oldV === newV) return
    if (_name === 'god' || _name === 'speed') {
      this.player?.setGod(this.boolAttr('god'))
      const s = Number(this.getAttribute('speed'))
      if (s > 0) this.player?.setSpeed(s)
    } else {
      void this.boot()
    }
  }

  /* -------------------------------------------------------- 对外 API */

  play() { this.player?.play() }
  pause() { this.player?.pause() }
  toggle() { this.player?.toggle() }
  next() { this.player?.next() }
  prev() { this.player?.prev() }
  setGod(on: boolean) { this.player?.setGod(on) }
  setSpeed(s: number) { this.player?.setSpeed(s) }
  goToScene(index: number) { this.player?.jumpToScene(index) }
  seek(seq: number) { this.player?.seek(seq) }

  /** 当前展示到的事件 seq。 */
  get currentSeq() { return this.player?.currentSeq ?? 0 }

  /* -------------------------------------------------------- 内部 */

  private boolAttr(name: string) {
    const v = this.getAttribute(name)
    return v !== null && v !== 'false'
  }

  private async boot() {
    try {
      // 框架（React/Vue）对自定义元素会把未知 prop 直接赋成 property，
      // 所以 data / assets 既可能是对象，也可能是 URL 字符串，两种都认。
      const inlineData = this.data
      const doc = typeof inlineData === 'string'
        ? await this.load<ReplayDoc>(inlineData)
        : inlineData ?? (await this.load<ReplayDoc>(this.getAttribute('src')))
      if (!doc) throw new Error('trpg-replay: 缺少 src 或 data')

      const assetsAttr = this.getAttribute('assets')
      const inlineAssets = this.assets
      const assets = typeof inlineAssets === 'string'
        ? await this.load<ArtAssets>(inlineAssets)
        : inlineAssets ?? (assetsAttr ? await this.load<ArtAssets>(assetsAttr) : undefined)

      const opts: PlayerOptions = {
        god: this.boolAttr('god'),
        speed: Number(this.getAttribute('speed')) || 1,
        autoplay: this.boolAttr('autoplay'),
        assets: assets ?? undefined,
      }

      this.shadow.querySelector('.frame')?.remove()
      this.player?.destroy()
      const host = document.createElement('div')
      this.shadow.append(host)
      const sub = document.createElement('div')
      host.append(sub)

      // Player 需要一个 ShadowRoot 来挂载；这里用外层 shadow 直接挂，避免多层包装
      host.remove()
      this.player = new Player(this.shadow, doc, opts)
      this.ready = true

      const start = Number(this.getAttribute('start'))
      if (start > 0) this.player.seek(start)

      this.dispatchEvent(new CustomEvent('replay-ready', { detail: { doc } }))
    } catch (err) {
      const msg = document.createElement('div')
      msg.style.cssText = 'padding:18px;font:14px/1.6 system-ui;color:#c66;background:#1a1012;border-radius:8px'
      msg.textContent = `回放加载失败：${(err as Error).message}`
      this.shadow.append(msg)
      this.dispatchEvent(new CustomEvent('replay-error', { detail: err }))
    }
  }

  private async load<T>(url: string | null): Promise<T | null> {
    if (!url) return null
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
    return (await res.json()) as T
  }
}

export function defineTrpgReplay(tag = 'trpg-replay') {
  if (!customElements.get(tag)) customElements.define(tag, TrpgReplayElement)
}

defineTrpgReplay()

export default TrpgReplayElement
