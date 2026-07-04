import { useSim } from '../sim/store'
import { DEMO_VEHICLE_ID } from '../sim/engine'
import { ROUTES } from '../sim/routes'
import { RISK_EVENT_TYPES } from '../sim/types'
import { simClock } from '../components/ui'

/**
 * 운전석 인포테인먼트 — 12.3인치 차량 거치 태블릿 상시 표출용.
 * 원칙: 주행 중 조작 없음(글랜스 UI), 큰 글씨·고대비, 경고는 화면 전체로.
 */

function ScoreGauge({ score }: { score: number }) {
  const s = Math.round(score)
  const pct = s / 100
  const r = 74
  const circ = 2 * Math.PI * r
  const color = s >= 90 ? '#34d399' : s >= 80 ? '#fbbf24' : '#f87171'
  return (
    <div className="relative flex items-center justify-center">
      <svg width="190" height="190" viewBox="0 0 190 190">
        <circle cx="95" cy="95" r={r} fill="none" stroke="#1f2937" strokeWidth="14" />
        <circle
          cx="95"
          cy="95"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform="rotate(-90 95 95)"
          style={{ transition: 'stroke-dasharray 0.5s' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-6xl font-black tabular-nums" style={{ color }}>
          {s}
        </div>
        <div className="mt-1 text-xs text-gray-500">오늘의 운전점수</div>
      </div>
    </div>
  )
}

const WEATHER_ICON = { 맑음: '☀️', 폭우: '🌧️', 폭염: '🥵' } as const

export default function DriverApp() {
  const snap = useSim()
  const v = snap.vehicles.find((x) => x.id === DEMO_VEHICLE_ID)!
  const route = ROUTES.find((r) => r.id === v.routeId)!
  const warnActive = !!v.lastEvent && !!v.lastEventWall && Date.now() - v.lastEventWall < 6000
  const co2Saved = Math.max(0, (v.baselineFuelM3 - v.fuelM3) * 2.2)
  const w = snap.weather
  const restDue = snap.simTime > 5400
  const isFaulty = snap.fault?.predicted && snap.fault.vehicleId === v.id

  return (
    <div className="flex h-full flex-col items-center justify-start gap-4 overflow-y-auto py-1">
      {/* 12.3" 태블릿 프레임 (가로형, 차량 거치) */}
      <div className="relative w-[1020px] max-w-full shrink-0 rounded-[22px] border-[10px] border-gray-800 bg-black shadow-2xl">
        <div className="absolute left-1/2 top-[3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gray-700" />
        <div className="relative h-[560px] overflow-hidden rounded-[12px] bg-gray-950">
          {/* 상단 상태바 */}
          <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-5 py-2.5">
            <div className="flex items-center gap-4">
              <span className="text-lg font-black text-gray-50">
                Q<span className="text-sky-400">drive</span>
              </span>
              <span className="flex items-center gap-2 text-sm text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: route.color }} />
                <b>{route.name}</b> · {v.id.slice(-4)}호 · {v.driverName} 기사님
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                {WEATHER_ICON[w.condition]} {w.condition} {w.tempC}°C
                {w.condition === '폭우' && <b className="ml-1 text-sky-300">노면 주의</b>}
              </span>
              <span className={`text-xs font-bold ${v.etasSubmitted ? 'text-emerald-400' : 'text-gray-600'}`}>
                eTAS {v.etasSubmitted ? '제출완료 ✓' : '자동제출 대기'}
              </span>
              <span className="font-mono text-lg font-bold text-emerald-400">{simClock(snap.simTime)}</span>
            </div>
          </div>

          {/* 본문 3열 */}
          <div className="grid h-[calc(100%-52px)] grid-cols-[250px_1fr_270px] gap-4 p-4">
            {/* 좌: 점수 */}
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-gray-900/60 py-4">
              <ScoreGauge score={v.score} />
              <div className="px-3 text-center text-[10px] leading-relaxed text-gray-600">
                ⚖ 노선 난이도·시간대·날씨 보정 적용
              </div>
              <div className="mt-auto grid w-full grid-cols-4 gap-1 px-3">
                {RISK_EVENT_TYPES.map((t) => (
                  <div key={t} className="rounded-md bg-gray-800/60 py-1 text-center">
                    <div className="text-[8px] text-gray-500">{t}</div>
                    <div className={`text-sm font-bold tabular-nums ${v.eventCounts[t] > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                      {v.eventCounts[t]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 중앙: 속도 + 다음 정류장 */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-1 items-center justify-center gap-10 rounded-2xl bg-gray-900/60">
                <div className="text-center">
                  <div className="text-[88px] font-black leading-none tracking-tighter tabular-nums text-gray-50">
                    {Math.round(v.speedKmh)}
                  </div>
                  <div className="mt-1 whitespace-nowrap text-sm text-gray-500">km/h · 차량속도 (내부)</div>
                </div>
                <div className="space-y-3 text-center">
                  <div>
                    <div className="text-3xl font-bold tabular-nums text-gray-300">{v.rpm}</div>
                    <div className="text-[10px] text-gray-600">RPM</div>
                  </div>
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full transition-all ${v.rpm > 2200 ? 'bg-red-500' : v.rpm > 1700 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (v.rpm / 2800) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {v.rpm > 2200 ? '고RPM — 연비 저하' : '경제운전 구간'}
                  </div>
                </div>
              </div>

              {/* 다음 정류장 */}
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-gray-900/60 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-gray-500">다음 정류장</div>
                  <div className="truncate text-2xl font-extrabold text-gray-100">
                    🚏 {v.nextStopName || '—'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="whitespace-nowrap text-3xl font-extrabold tabular-nums text-sky-300">
                    {v.dwellRemaining > 0 ? '정차 중' : `${Math.max(0, Math.round(v.nextStopDistM))}m`}
                  </div>
                  <div className="whitespace-nowrap text-[10px] text-gray-600">
                    {v.dwellRemaining > 0 ? '승하차 진행' : '감속 준비 130m 전'}
                  </div>
                </div>
              </div>
            </div>

            {/* 우: 알림 스택 */}
            <div className="flex flex-col gap-2.5">
              {isFaulty && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <div className="text-xs font-bold text-amber-300">🔧 차량 점검 예정</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-amber-200/70">
                    냉각계통 예방정비 — 금일 2회차 종료 후 차고지 입고. 무리한 운행 없이 정상 주행하세요.
                  </div>
                </div>
              )}
              {restDue && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <div className="text-xs font-bold text-amber-300">☕ 휴게 권장</div>
                  <div className="mt-1 text-[11px] text-amber-200/70">
                    연속운행 {Math.floor(snap.simTime / 3600)}시간 {Math.floor((snap.simTime % 3600) / 60)}분 ·
                    교대 14:00 성서차고지
                  </div>
                </div>
              )}
              {w.condition !== '맑음' && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
                  <div className="text-xs font-bold text-sky-300">
                    {WEATHER_ICON[w.condition]} {w.condition} 운행 지침
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-sky-200/70">
                    {w.condition === '폭우'
                      ? '제동거리 1.5배 — 차간거리 확보, 정류장 접근 시 조기 감속하세요.'
                      : '냉방부하 증가 — 공회전 최소화, 승객 안내방송이 자동 송출됩니다.'}
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-gray-900/60 px-4 py-3">
                <div className="text-[11px] text-gray-500">🌱 오늘 절감 기여</div>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="text-2xl font-extrabold tabular-nums text-emerald-400">{co2Saved.toFixed(2)}</span>
                  <span className="shrink-0 pb-0.5 text-[10px] text-gray-500">kg CO₂ 리워드</span>
                </div>
              </div>
              <div className="mt-auto rounded-xl bg-gray-900/60 px-4 py-3">
                <div className="text-[11px] text-gray-500">📊 오늘 운행</div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-center">
                  <div>
                    <div className="text-lg font-bold tabular-nums text-gray-200">{v.distanceKm.toFixed(1)}</div>
                    <div className="text-[9px] text-gray-600">주행 km</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums text-gray-200">{v.fuelM3.toFixed(1)}</div>
                    <div className="text-[9px] text-gray-600">CNG m³</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 전체 화면 경고 오버레이 */}
          {warnActive && v.lastEvent && (
            /* 경고 오버레이는 테마와 무관하게 고정 색상 (야간·주간 모두 동일 시인성) */
            <div
              className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px]"
              style={{ background: 'rgba(69, 10, 10, 0.88)' }}
            >
              <div className="animate-pulse text-center">
                <div className="text-7xl">⚠️</div>
                <div className="mt-2 text-6xl font-black" style={{ color: '#fca5a5' }}>
                  {v.lastEvent.eventType}
                </div>
                <div className="mt-3 text-xl" style={{ color: 'rgba(254, 202, 202, 0.85)' }}>
                  {v.lastEvent.speedKmh} km/h · 안전운전 부탁드립니다
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 설명 */}
      <div className="flex max-w-4xl gap-8 text-[11px] leading-relaxed text-gray-500">
        <span>
          <b className="text-gray-300">12.3" 차량 거치 인포테인먼트</b> — 주행 중 조작 없는 상시 표출
          글랜스 UI. 위험운전 경고는 화면 전체로 (운전석에서 즉시 인지)
        </span>
        <span>
          점수·다음 정류장·날씨 지침·차량 점검 예정까지 <b className="text-gray-300">기사에게 필요한 모든
          정보가 한 화면</b>. ⚡ 급감속 / 🌧 날씨 / 🔧 고장 버튼으로 시연하세요
        </span>
      </div>
    </div>
  )
}
