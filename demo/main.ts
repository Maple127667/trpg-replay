import '../src/index'
import type { TrpgReplayElement } from '../src/index'

const rp = document.getElementById('rp') as TrpgReplayElement | null
const params = new URLSearchParams(location.search)

// 静态预览模式：?seq=69 跳到某条事件并停住，方便截图 / 校对
if (params.get('seq')) {
  rp?.removeAttribute('autoplay')
  rp?.setAttribute('start', params.get('seq')!)
}
if (params.get('god') === '1') rp?.setAttribute('god', 'true')
if (params.get('speed')) rp?.setAttribute('speed', params.get('speed')!)

// 方便在控制台里调试
Object.assign(window as unknown as Record<string, unknown>, { rp })
