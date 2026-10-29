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
  anomalies?: Record<string, unknown>
}

/** 可选的美术资源清单（assets.json）。缺省时播放器使用内置占位图。 */
export interface ArtAssets {
  /** 场景序号 -> 背景图 URL */
  scenes?: Record<string, string>
  /** 角色 id -> { default, 表情名 } -> 立绘 URL */
  characters?: Record<string, Record<string, string>>
  /** 预留：BGM / 音效 */
  bgm?: Record<string, string>
}
