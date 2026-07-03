import { engine } from '../sim/store'
import type { SimSnapshot } from '../sim/types'
import { simClock } from './ui'

const SPEEDS = [1, 5, 20, 60]

export default function DemoControls({ snap }: { snap: SimSnapshot }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 font-mono text-sm text-emerald-400">
        {simClock(snap.simTime)}
      </span>

      <div className="flex overflow-hidden rounded-md border border-gray-800">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => engine.setSpeed(s)}
            className={`px-2 py-1 text-xs font-semibold transition-colors ${
              snap.speedMultiplier === s
                ? 'bg-sky-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        onClick={() => engine.togglePause()}
        className="rounded-md border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:text-white"
      >
        {snap.running ? '⏸ 일시정지' : '▶ 재생'}
      </button>

      <div className="mx-1 h-5 w-px bg-gray-800" />

      {/* 데모 트리거 — 발표 중 시나리오 구동용 */}
      <button
        onClick={() => engine.triggerRiskEvent('급감속')}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20"
        title="주인공 차량(3742)에 급감속 이벤트 발생"
      >
        ⚡ 급감속
      </button>
      <button
        onClick={() => engine.triggerFault()}
        disabled={!!snap.fault}
        className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-40"
        title="냉각수온 상승 → 고장예측 시나리오 시작"
      >
        🔧 고장 시나리오
      </button>
      <button
        onClick={() => engine.fileComplaint()}
        className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-400 hover:bg-violet-500/20"
        title="시민 민원 접수 → 증빙 자동매칭 스토리"
      >
        📢 민원 접수
      </button>
      <button
        onClick={() => engine.forceRecommendation()}
        className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-400 hover:bg-sky-500/20"
        title="순환2 배차간격 분석 → AI 권고 생성 (운수사 탭에서 승인)"
      >
        🚌 배차 권고
      </button>
      <button
        onClick={() => engine.cycleWeather()}
        className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20"
        title="날씨 전환 (맑음 → 폭우 → 폭염) — 수요·지연 예측, 운행 지침, 예비차 권고 연동"
      >
        {snap.weather.condition === '맑음' ? '☀️' : snap.weather.condition === '폭우' ? '🌧️' : '🥵'}{' '}
        {snap.weather.condition}
      </button>
    </div>
  )
}
