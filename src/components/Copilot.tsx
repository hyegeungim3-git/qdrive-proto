import { useRef, useState } from 'react'
import { engine, useSim } from '../sim/store'
import { RISK_EVENT_TYPES, type SimSnapshot } from '../sim/types'
import { topZones } from '../views/operator/AiReport'
import { simClock } from './ui'

/**
 * AI 관제 코파일럿 — 자연어 질문에 실시간 스냅샷을 조회해 답하고 조치까지 제안한다.
 * 노션 아이데이션의 "관제 Copilot"을 실동작화. 화면 어디서든 호출(플로팅).
 * 데모는 규칙 기반 의도 매칭 + 실데이터 조회 — 실서비스는 LLM + 도구 호출(function calling)로 교체.
 */

interface Reply {
  text: string
  evidence?: string[]
  action?: { label: string; run: () => void }
  nav?: { tab: string; label: string }
}

const fmt1 = (n: number) => Math.round(n * 10) / 10

/** 의도 매칭 → 실시간 데이터 조회 → 답변 */
function answer(qRaw: string, snap: SimSnapshot): Reply {
  const q = qRaw.replace(/\s/g, '')
  const has = (...ws: string[]) => ws.some((w) => q.includes(w))
  const vehicles = snap.vehicles

  // 특정 차량 조회 (뒤 4자리)
  const carMatch = qRaw.match(/(\d{4})호?/)
  if (carMatch && vehicles.some((v) => v.id.endsWith(carMatch[1]))) {
    const v = vehicles.find((x) => x.id.endsWith(carMatch[1]))!
    const evTotal = RISK_EVENT_TYPES.reduce((s, t) => s + v.eventCounts[t], 0)
    return {
      text: `${v.id.slice(-4)}호(${v.driverName} 기사)는 안전점수 ${Math.round(v.score)}점, 경제운전 ${Math.round(v.ecoScore)}점입니다. 현재 ${Math.round(v.speedKmh)}km/h로 ${v.nextStopName} 방면 운행 중이며 재차율 ${Math.round(v.occupancy * 100)}%, 오늘 위험운전 ${evTotal}건입니다.`,
      evidence: [`점수 ${Math.round(v.score)} · 에코 ${Math.round(v.ecoScore)}`, `주행 ${fmt1(v.distanceKm)}km · 연료 ${fmt1(v.fuelM3)}m³`],
      nav: { tab: 'operator', label: '운수사 관제' },
    }
  }

  // 고장 / 정비 ("고장 위험 차량"이 아래 위험 블록에 먼저 잡히지 않도록 앞에 배치)
  if (has('고장', '정비', '점검', '냉각', '브레이크')) {
    if (snap.fault?.predicted) {
      return {
        text: `${snap.fault.vehicleId.slice(-4)}호에서 ${snap.fault.kind} 예측이 발화했습니다(현재 ${fmt1(snap.fault.coolantTemp)}°C). 회차 종료 후 예방 정비를 권장하며, 작업지시는 운수사 관제에서 발행할 수 있습니다.`,
        evidence: [`고장 예측 1건`, `냉각수온 ${fmt1(snap.fault.coolantTemp)}°C`],
        nav: { tab: 'operator', label: '운수사 관제' },
      }
    }
    return {
      text: '현재 예측된 고장은 없습니다. 정기 점검 대상은 브레이크 패드(3742·5563호 잔여 2주)이며, 진단 스캐너에서 1초 단위 센서값을 확인할 수 있습니다.',
      evidence: [`고장 예측 0건 · 작업지시 ${snap.workOrders.length}건`],
      nav: { tab: 'operator', label: '진단 스캐너' },
    }
  }

  // 위험 차량 / 안전
  if (has('위험', '안전', '점수낮', '주의차량', '문제차량')) {
    const worst = [...vehicles].sort((a, b) => a.score - b.score)[0]
    const topType = RISK_EVENT_TYPES.map((t) => ({ t, c: worst.eventCounts[t] })).sort((a, b) => b.c - a.c)[0]
    return {
      text: `현재 안전점수 최저는 ${worst.id.slice(-4)}호(${worst.driverName} 기사) ${Math.round(worst.score)}점입니다. ${topType.c > 0 ? `${topType.t} ${topType.c}건이 주된 감점 요인으로, 해당 유형 중심 코칭을 권장합니다.` : '이벤트는 적으나 점수 회복 구간으로 관찰이 필요합니다.'}`,
      evidence: [`전체 평균 ${fmt1(snap.kpi.avgScore)}점`, `대상 ${worst.id.slice(-4)}호 ${Math.round(worst.score)}점`],
      nav: { tab: 'operator', label: '운수사에서 리포트 보기' },
    }
  }

  // 배차 몰림
  if (has('배차', '몰림', '간격', '벌어')) {
    const bunched = vehicles.filter((v) => v.headway?.status === 'bunching')
    if (bunched.length > 0) {
      const b = bunched[0]
      return {
        text: `${b.id.slice(-4)}호가 앞차와 ${fmt1(b.headway!.frontGapMin)}분 간격(이상 ${fmt1(b.headway!.idealMin)}분)으로 몰림 상태입니다. 배차 조정을 권고할까요?`,
        evidence: [`몰림 ${bunched.length}대`, `앞차 간격 ${fmt1(b.headway!.frontGapMin)}분`],
        action: {
          label: '배차 권고 생성',
          run: () => engine.forceRecommendation(),
        },
        nav: { tab: 'operator', label: '운수사에서 승인' },
      }
    }
    return {
      text: '현재 배차 몰림 없이 고른 간격을 유지 중입니다. 필요 시 배차 권고를 생성해 시뮬레이션할 수 있습니다.',
      evidence: [`운행 ${vehicles.length}대 · 몰림 0`],
      action: { label: '배차 권고 생성(시연)', run: () => engine.forceRecommendation() },
    }
  }

  // 연료 낭비 / 에코
  if (has('연료', '낭비', '연비', '에코', '절감')) {
    const agg = vehicles.reduce(
      (a, v) => ({
        habit: a.habit + v.fuelWaste.habit,
        idle: a.idle + v.fuelWaste.idle,
        harsh: a.harsh + v.fuelWaste.harsh,
        ac: a.ac + v.fuelWaste.ac,
      }),
      { habit: 0, idle: 0, harsh: 0, ac: 0 },
    )
    const total = agg.habit + agg.idle + agg.harsh + agg.ac
    const top = [
      ['운전습관', agg.habit],
      ['공회전', agg.idle],
      ['급조작', agg.harsh],
      ['냉방부하', agg.ac],
    ].sort((a, b) => (b[1] as number) - (a[1] as number))[0]
    return {
      text: `현재 코칭 절감률은 ${fmt1(snap.kpi.fuelSavedPct)}%입니다. 전 차량 연료 낭비 1위 요인은 ${total > 0 ? `${top[0]}(${Math.round(((top[1] as number) / total) * 100)}%)` : '집계 중'}이며, 예측형 에코 코칭(정류장 전 관성주행 안내)으로 발생 전에 억제하고 있습니다.`,
      evidence: [`절감률 ${fmt1(snap.kpi.fuelSavedPct)}%`, `CO₂ 절감 ${fmt1(snap.kpi.totalCo2SavedKg)}kg`],
      nav: { tab: 'operator', label: '연료·에코 AI' },
    }
  }

  // 혼잡 / 재차율
  if (has('혼잡', '재차', '승객', '붐비')) {
    const busiest = [...vehicles].sort((a, b) => b.occupancy - a.occupancy)[0]
    const avgOcc = vehicles.reduce((s, v) => s + v.occupancy, 0) / vehicles.length
    return {
      text: `현재 평균 재차율은 ${Math.round(avgOcc * 100)}%입니다. 가장 붐비는 차량은 ${busiest.id.slice(-4)}호로 ${Math.round(busiest.occupancy * 100)}%(${busiest.occupancy >= 0.7 ? '혼잡' : '보통'})입니다. 오늘 누적 탑승객은 ${snap.passengers.toLocaleString()}명입니다.`,
      evidence: [`평균 재차율 ${Math.round(avgOcc * 100)}%`, `탑승 ${snap.passengers}명`],
      nav: { tab: 'city', label: '시티 대시보드' },
    }
  }

  // 돌발 / 사고
  if (has('돌발', '사고', '공사', '이슈')) {
    const active = snap.incidents.filter((i) => i.status !== '완료')
    if (active.length > 0) {
      return {
        text: `진행 중 돌발상황 ${active.length}건: ${active.map((i) => `${i.kind}(${i.status})`).join(' · ')}. 관제·시민안내가 자동 연동되어 대응 중이며, 시티 대시보드 지도에서 위치를 확인할 수 있습니다.`,
        evidence: active.slice(0, 3).map((i) => `${i.kind} — ${i.title.slice(0, 20)}`),
        nav: { tab: 'city', label: '시티 대시보드' },
      }
    }
    return { text: '현재 진행 중인 돌발상황은 없습니다. 상시 도로 공사 1건만 처리중입니다.', evidence: ['돌발 진행 0건(공사 제외)'] }
  }

  // 민원
  if (has('민원', '불편', '컴플')) {
    const cs = snap.complaints
    if (cs.length > 0) {
      const resolved = cs.filter((c) => c.status === '해결').length
      return {
        text: `민원 ${cs.length}건 중 ${resolved}건 해결 완료, ${cs.filter((c) => c.evidence).length}건은 증빙 자동매칭(GPS·DTG·DVR)으로 처리 중입니다. 민원이 감이 아닌 데이터로 처리되고 있습니다.`,
        evidence: [`민원 ${cs.length}건 · 해결 ${resolved}`],
        nav: { tab: 'city', label: '시티 대시보드' },
      }
    }
    return { text: '금일 접수된 민원은 없습니다. 시민안내 에이전트가 정비·기상·돌발 상황을 시민 언어로 자동 공지해 사전 민원을 억제하고 있습니다.', evidence: ['민원 0건'] }
  }

  // 날씨 / 폭우 대응
  if (has('날씨', '폭우', '폭염', '비오', '기상')) {
    if (snap.weather.condition !== '맑음') {
      return {
        text: `현재 ${snap.weather.condition}(${snap.weather.tempC}°C). 전 노선 평균 +${snap.weather.delayForecastMin}분 지연 예상, 감속 계열 이벤트는 정당 판정으로 감점 제외, 예비차 선배정을 권고 중입니다.`,
        evidence: [`${snap.weather.condition} · 지연 +${snap.weather.delayForecastMin}분`],
        nav: { tab: 'city', label: '시티 대시보드' },
      }
    }
    return {
      text: '현재 맑음(정상 운행). 폭우 전환 시 지연·사고위험 예측과 예비차 권고가 자동 연동됩니다. 지금 시뮬레이션할까요?',
      evidence: ['날씨 맑음 24°C'],
      action: { label: '폭우로 전환(시연)', run: () => engine.cycleWeather() },
    }
  }

  // 다발 구간
  if (has('구간', '어디서', '지점', '핫스팟')) {
    const zones = topZones(snap, 3)
    if (zones.length > 0) {
      return {
        text: `위험운전 다발 구간은 ${zones.map((z) => `${z.name}(${z.count}건)`).join(' · ')}입니다. 개인 습관보다 도로 환경 요인 가능성이 있어 해당 구간의 시야·신호 점검을 권고합니다.`,
        evidence: zones.map((z) => `${z.name} ${z.count}건`),
        nav: { tab: 'city', label: '시티 대시보드' },
      }
    }
    return { text: '아직 다발 구간으로 집계될 만한 이벤트가 없습니다. 배속을 올리면 데이터가 쌓입니다.' }
  }

  // 운행 요약 / 현황
  if (has('요약', '현황', '전체', '상황', '오늘')) {
    return {
      text: `${simClock(snap.simTime)} 기준 ${vehicles.length}대 운행, 총 ${fmt1(snap.kpi.totalDistanceKm)}km. 평균 안전점수 ${fmt1(snap.kpi.avgScore)}점, 연료 절감률 ${fmt1(snap.kpi.fuelSavedPct)}%, 위험운전 ${snap.kpi.totalEvents}건, 탑승객 ${snap.passengers.toLocaleString()}명입니다.`,
      evidence: [`운행 ${vehicles.length}대 · ${fmt1(snap.kpi.totalDistanceKm)}km`, `절감 ${fmt1(snap.kpi.fuelSavedPct)}%`],
      action: { label: 'AI 정책 보고서 열기', run: () => {} },
      nav: { tab: 'city', label: '시티 대시보드' },
    }
  }

  // fallback
  return {
    text: '운영 데이터 기반으로 답할 수 있어요. 예를 들어 이렇게 물어보세요: "지금 가장 위험한 차량?", "배차 몰림 있어?", "연료 낭비 원인?", "고장 위험 차량?", "폭우 오면 어떻게 대응해?"',
  }
}

const SUGGESTIONS = ['지금 가장 위험한 차량?', '배차 몰림 있어?', '연료 낭비 원인은?', '고장 위험 차량?', '오늘 운행 요약']

export default function Copilot({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const snap = useSim()
  const snapRef = useRef(snap)
  snapRef.current = snap
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string; reply?: Reply }[]>([])
  const [input, setInput] = useState('')

  const send = (text: string) => {
    if (!text.trim()) return
    const reply = answer(text, snapRef.current)
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'ai', text: reply.text, reply }])
    setInput('')
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[2500] flex items-center gap-2 rounded-full bg-gradient-to-tr from-violet-600 to-sky-500 px-4 py-3 text-sm font-bold text-white shadow-2xl hover:from-violet-500 hover:to-sky-400"
        title="AI 관제 코파일럿 — 무엇이든 물어보세요"
      >
        <span className="text-lg leading-none">{open ? '✕' : '✨'}</span>
        {!open && <span className="hidden sm:inline">AI 코파일럿</span>}
      </button>

      {/* 채팅 패널 */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[2500] flex h-[520px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-violet-500 to-sky-400 text-xs">
              ✨
            </span>
            <div>
              <div className="text-sm font-bold text-gray-100">AI 관제 코파일럿</div>
              <div className="text-[10px] text-gray-500">실시간 운영 데이터 조회 · 조치 제안</div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <div className="mt-6 text-center text-xs leading-relaxed text-gray-500">
                <div className="mb-1 text-2xl">✨</div>
                운영 전반을 자연어로 물어보세요.
                <br />
                실시간 데이터를 조회해 근거와 함께 답하고,
                <br />
                필요하면 조치까지 제안합니다.
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-sky-600/30 px-3 py-2 text-xs text-sky-100">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-2">
                  <span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-gradient-to-tr from-violet-500 to-sky-400" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="rounded-2xl rounded-tl-sm border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs leading-relaxed text-gray-300">
                      {m.text}
                    </div>
                    {m.reply?.evidence && (
                      <div className="flex flex-wrap gap-1">
                        {m.reply.evidence.map((e) => (
                          <span key={e} className="rounded border border-gray-700/60 bg-gray-800/50 px-1.5 py-0.5 text-[9px] tabular-nums text-gray-500">
                            근거 · {e}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {m.reply?.action && (
                        <button
                          onClick={() => {
                            m.reply!.action!.run()
                            setMsgs((prev) => [...prev, { role: 'ai', text: `✓ 실행했습니다: ${m.reply!.action!.label}` }])
                          }}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                        >
                          ⚡ {m.reply.action.label}
                        </button>
                      )}
                      {m.reply?.nav && (
                        <button
                          onClick={() => {
                            onNavigate(m.reply!.nav!.tab)
                            setOpen(false)
                          }}
                          className="rounded-md border border-gray-700 px-2.5 py-1 text-[10px] font-semibold text-gray-300 hover:text-gray-100"
                        >
                          {m.reply.nav.label} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>

          {/* 추천 질문 */}
          <div className="flex flex-wrap gap-1 border-t border-gray-800 px-3 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] text-gray-400 hover:border-sky-500/50 hover:text-sky-300"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="운영 현황을 물어보세요…"
              className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:border-sky-500/60 focus:outline-none"
            />
            <button onClick={() => send(input)} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500">
              →
            </button>
          </div>
          <div className="px-3 pb-2 text-center text-[9px] text-gray-600">
            데모: 규칙 기반 의도 매칭 + 실데이터 조회 · 실서비스: LLM + 도구 호출(function calling)
          </div>
        </div>
      )}
    </>
  )
}
