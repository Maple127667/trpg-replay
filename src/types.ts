/** replay.json 的类型定义（schema: trpg-replay/1）。 */

export type EventType =
  | 'narration'
  | 'dialogue'
  | 'action'
  | 'thought'
  | 'check'
  | 'hidden_check'
  | 'ooc'
  | 'marker'
  | 'unknown'

export interface CheckData {
  kind: 'san' | 'skill' | 'dice_pool' | 'hidden' | 'unparsed' | string
  systemTag?: string | null
  prompt?: string
  actor?: string
  skill?: string
  roll?: number
  target?: number
  level?: string
  rank?: number
  lossExpr?: string
  lossValue?: number
  pool?: string
  tens?: [number, number] | number[]
  tensKeep?: number
  unit?: number
  total?: number
  formula?: string
  value?: number
  visibleToPlayers?: boolean
  raw?: string
}

export interface ReplayEvent {
  seq: number
  at: string
  t: number
  type: EventType
  speaker: string
  text: string
  raw?: string
  ms: number
  scene: number
  audience?: string[]
  channel?: string
  subtype?: string
  segments?: Array<{ where: string; what: string }>
  /** 蒙太奇段落前的引导句（不属于任何地点分行的那部分）。 */
  lead?: string
  check?: CheckData
  visibleToPlayers?: boolean
  note?: string
}

export interface CastMember {
  id: string
  name: string
  role: string
  count: number
  firstSeq: number
  lastSeq: number
  types: Record<string, number>
  presence: number[]
}

export interface Scene {
  index: number
  label: string
  startSeq: number
  endSeq: number
  eventCount: number
  labelConfidence?: string
}

export interface ReplayMeta {
  title: string
  titleConfidence?: string
  systemTag?: string
  source?: string
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  rawCount?: number
  eventCount?: number
  droppedCount?: number
}

export interface ReplayDoc {
  schema: string
  meta: ReplayMeta
  cast: CastMember[]
  scenes: Scene[]
  events: ReplayEvent[]
  /** 角色退场点：id -> seq，到达该条后立绘下场（死亡、离场等）。 */
  exits?: Record<string, number>
  anomalies?: Record<string, unknown>
}

/** 单个角色的立绘配置：表情名 -> 图片，外加可选的缩放/位移微调。 */
export interface CharArt {
  default?: string
  /** 统一基准下的额外缩放。半身像/胸像需要缩小才能和全身像对上比例。 */
  scale?: number
  /** 垂直微调（舞台像素，正数向下）。 */
  y?: number
  [expr: string]: string | number | undefined
}

/** 可选的美术资源清单（assets.json）。缺省时播放器使用内置占位图。 */
export interface ArtAssets {
  /** 场景序号 -> 背景图 URL */
  scenes?: Record<string, string>
  /** 角色 id -> 立绘配置 */
  characters?: Record<string, CharArt>
  /** 预留：BGM / 音效 */
  bgm?: Record<string, string>
}
