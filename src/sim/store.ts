import { useSyncExternalStore } from 'react'
import { SimEngine } from './engine'
import type { SimSnapshot } from './types'

/**
 * 시뮬레이터 싱글턴.
 * 실단말 연동 시 이 파일에서 SimEngine 대신
 * RealPacketSource(WebSocket)를 노출하면 뷰 레이어는 무변경.
 */
export const engine = new SimEngine()
engine.start()

export function useSim(): SimSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot)
}
