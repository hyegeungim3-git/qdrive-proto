import { useState } from 'react'
import MapView from '../components/MapView'
import { KpiCard, Panel, simClock } from '../components/ui'
import { engine, useSim } from '../sim/store'
import { DEFAULT_ROUTES, getBisKey, setBisKey, startBis, stopBis, useBis } from '../sim/bis'
import { ROUTES } from '../sim/routes'

export default function CityDashboard() {
  const snap = useSim()
  const [showHeat, setShowHeat] = useState(true)
  const bis = useBis()
  const [keyInput, setKeyInput] = useState(getBisKey())
  const [showKeyForm, setShowKeyForm] = useState(false)

  // 원인식별 단계 이상의 민원이 있으면 해당 노선 하이라이트
  const activeComplaint = snap.complaints.find((c) => c.status !== '해결')
  const highlightRouteId =
    activeComplaint && activeComplaint.status !== '접수' ? activeComplaint.routeId : null

  const { kpi } = snap

  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-4">
      {/* 지도 */}
      <div className="relative min-h-0">
        <MapView
          vehicles={snap.vehicles}
          events={snap.events}
          showHeat={showHeat}
          highlightRouteId={highlightRouteId}
          realBuses={bis.buses}
        />
        <button
          onClick={() => setShowHeat((s) => !s)}
          className={`absolute right-3 top-3 z-[1000] rounded-md border px-3 py-1.5 text-xs font-semibold shadow-lg ${
            showHeat
              ? 'border-red-500/40 bg-red-500/20 text-red-300'
              : 'border-gray-700 bg-gray-900/90 text-gray-400'
          }`}
        >
          🔥 위험운전 히트맵 {showHeat ? 'ON' : 'OFF'}
        </button>
        <div className="absolute bottom-3 left-3 z-[1000] flex gap-3 rounded-md border border-gray-800 bg-gray-900/90 px-3 py-2 text-[11px]">
          {ROUTES.map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 text-gray-300">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              {r.name}
            </span>
          ))}
        </div>
      </div>

      {/* 우측 패널 */}
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="운행 차량" value={String(snap.vehicles.length)} unit="대" sub="3개 노선 실증" />
          <KpiCard
            label="총 주행거리"
            value={kpi.totalDistanceKm.toFixed(1)}
            unit="km"
            sub="오늘 누적"
          />
          <KpiCard
            label="연료 절감률"
            value={kpi.fuelSavedPct.toFixed(1)}
            unit="%"
            sub="기준선 대비 (코칭 효과)"
            accent="text-emerald-400"
          />
          <KpiCard
            label="CO₂ 절감"
            value={kpi.totalCo2SavedKg.toFixed(1)}
            unit="kg"
            sub="탄소중립 기여"
            accent="text-emerald-400"
          />
        </div>

        {/* BIS 실데이터 연동 (TAGO 오픈API) */}
        <Panel
          title="📡 대구 BIS 실데이터"
          right={
            bis.status === 'ok' ? (
              <span className="text-[11px] font-bold text-sky-400">
                ● 실차 {bis.buses.length}대 수신 중
              </span>
            ) : (
              <span className="text-[11px] text-gray-500">TAGO 오픈API · 15초 갱신</span>
            )
          }
        >
          <div className="space-y-2 text-xs">
            {bis.status === 'idle' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  실제 대구 버스({DEFAULT_ROUTES.join('·')}) 위치를 지도에 오버레이
                  {!import.meta.env.DEV && ' — 프록시 경유, 키 입력 불필요'}
                </span>
                <button
                  onClick={() => (import.meta.env.DEV && !getBisKey() ? setShowKeyForm(true) : startBis())}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-500"
                >
                  연동 시작
                </button>
              </div>
            )}
            {bis.status === 'loading' && <div className="text-sky-300">⏳ {bis.message || '연결 중…'}</div>}
            {bis.status === 'ok' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">
                  {bis.matchedRoutes.join(' · ')} — 지도에서 <b className="text-sky-400">속이 빈 하늘색 마커</b>가
                  실차 (시뮬레이션과 나란히 표시)
                </span>
                <button
                  onClick={stopBis}
                  className="rounded-md border border-gray-700 px-2.5 py-1 text-[11px] text-gray-400 hover:text-gray-200"
                >
                  중지
                </button>
              </div>
            )}
            {bis.status === 'error' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-red-400">⚠ {bis.message}</span>
                {import.meta.env.DEV ? (
                  <button
                    onClick={() => setShowKeyForm(true)}
                    className="shrink-0 rounded-md border border-gray-700 px-2.5 py-1 text-[11px] text-gray-400 hover:text-gray-200"
                  >
                    키 설정
                  </button>
                ) : (
                  <button
                    onClick={() => startBis()}
                    className="shrink-0 rounded-md border border-gray-700 px-2.5 py-1 text-[11px] text-gray-400 hover:text-gray-200"
                  >
                    다시 시도
                  </button>
                )}
              </div>
            )}
            {import.meta.env.DEV && (showKeyForm || (bis.status === 'error' && !getBisKey())) && (
              <div className="flex gap-2">
                <input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="공공데이터포털 일반 인증키 (data.go.kr 발급)"
                  className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-[11px] text-gray-200 placeholder:text-gray-600 focus:border-sky-500/60 focus:outline-none"
                />
                <button
                  onClick={() => {
                    setBisKey(keyInput)
                    setShowKeyForm(false)
                    startBis()
                  }}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-500"
                >
                  저장·시작
                </button>
              </div>
            )}
          </div>
        </Panel>

        {/* 날씨/행사 기반 수요·지연·사고위험 예측 */}
        {snap.weather.condition !== '맑음' && (
          <Panel
            title={`${snap.weather.condition === '폭우' ? '🌧️' : '🥵'} ${snap.weather.condition} — AI 수요·지연 예측`}
            className="border-indigo-500/30"
          >
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-gray-800/50 py-2">
                <div className="text-lg font-bold text-amber-400">+{snap.weather.delayForecastMin}분</div>
                <div className="text-[10px] text-gray-500">노선 평균 지연 예상</div>
              </div>
              <div className="rounded-md bg-gray-800/50 py-2">
                <div className="text-lg font-bold text-sky-400">
                  {snap.weather.demandDeltaPct > 0 ? '+' : ''}
                  {snap.weather.demandDeltaPct}%
                </div>
                <div className="text-[10px] text-gray-500">수요 변동 예측</div>
              </div>
              <div className="rounded-md bg-gray-800/50 py-2">
                <div className="text-lg font-bold text-red-400">{snap.weather.condition === '폭우' ? '높음' : '보통'}</div>
                <div className="text-[10px] text-gray-500">사고위험 등급</div>
              </div>
            </div>
            {snap.weather.condition === '폭우' && (
              <div className="mt-2 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-red-300/80">
                ⚠ 사고위험 예측: 18~20시 급행1 반월당~범어 구간 — 사유: 강우 + 정체 + 과거 급감속 빈도.
                해당 구간 기사 태블릿에 감속 지침 자동 표출 · 차고지 예비차 선배정 권고
              </div>
            )}
          </Panel>
        )}

        {/* 민원 처리 — 데모 킬러 장면 */}
        {snap.complaints.length > 0 && (
          <Panel title="📢 시민 민원" className="border-violet-500/30">
            {snap.complaints.map((c) => (
              <div key={c.id} className="mb-2 last:mb-0">
                <div className="text-xs leading-relaxed text-gray-300">"{c.text}"</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-1">
                    {(['접수', '원인식별', '조치중', '해결'] as const).map((s, i) => {
                      const order = ['접수', '원인식별', '조치중', '해결']
                      const done = order.indexOf(c.status) >= i
                      return (
                        <span
                          key={s}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            done ? 'bg-violet-500/20 text-violet-300' : 'bg-gray-800 text-gray-600'
                          }`}
                        >
                          {s}
                        </span>
                      )
                    })}
                  </div>
                  {c.status !== '해결' && (
                    <button
                      onClick={() => engine.advanceComplaint(c.id)}
                      className="rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500"
                    >
                      {c.status === '접수' ? '데이터로 원인 확인 →' : '다음 단계 →'}
                    </button>
                  )}
                </div>
                {c.evidence && c.status !== '접수' && (
                  <div className="mt-2 rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-violet-300">
                        🤖 조사 에이전트 — 증빙 자동매칭
                      </span>
                      <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                        사실 가능성 {c.evidence.aiScore}%
                      </span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {c.evidence.timeline.map((t) => (
                        <div key={t.label} className="flex gap-1.5 text-[10px] leading-relaxed">
                          <span className={t.warn ? 'text-red-400' : 'text-emerald-400'}>
                            {t.warn ? '⚠' : '✓'}
                          </span>
                          <span>
                            <b className="text-gray-300">{t.label}</b>
                            <span className="text-gray-500"> — {t.detail}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 text-[10px] text-gray-500">
                      → 차량 <b className="text-gray-300">{c.evidence.vehicleId.slice(-4)}호</b> (
                      {c.evidence.driverName} 기사) 식별 · 기사 앱 실시간 코칭 발송
                    </div>
                    {(c.status === '조치중' || c.status === '해결') && (
                      <div className="mt-1.5 rounded bg-gray-800/60 px-2 py-1.5 text-[10px] leading-relaxed text-gray-400">
                        ✉️ <b className="text-gray-300">답변 초안 (담당자 검토 후 발송)</b>:{' '}
                        {c.evidence.draftReply}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Panel>
        )}

        {/* 노선 평가 (준공영제 과학행정) */}
        <Panel title="노선 평가 · 준공영제 정산 검증" right={<span className="text-[11px] text-gray-500">BMS×DTG 교차검증</span>}>
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="text-[10px] text-gray-500">
                <th className="pb-1.5 font-medium">노선</th>
                <th className="pb-1.5 font-medium">정시율</th>
                <th className="pb-1.5 font-medium">평균 안전점수</th>
                <th className="pb-1.5 font-medium">위험운전</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((r, ri) => {
                const buses = snap.vehicles.filter((v) => v.routeId === r.id)
                const avg = buses.reduce((s, v) => s + v.score, 0) / buses.length
                const ev = snap.events.filter((e) => buses.some((b) => b.id === e.vehicleId)).length
                return (
                  <tr key={r.id} className="border-t border-gray-800/50">
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                    </td>
                    <td className="py-1.5 tabular-nums text-gray-400">{[96.2, 93.8, 95.1][ri]}%</td>
                    <td className="py-1.5 tabular-nums text-gray-400">{avg.toFixed(1)}점</td>
                    <td className={`py-1.5 tabular-nums ${ev > 8 ? 'text-red-400' : 'text-gray-400'}`}>{ev}건</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {snap.trips.length > 4 && (
            <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-300/80">
              ⚠ 정산 검증 에이전트: 5563호 3회차 — BMS상 정상운행, DTG 위치이력상 인가노선{' '}
              <b>87% 운행</b>. 검토 필요 (최종 판단: 담당자)
            </div>
          )}
        </Panel>

        {/* 실시간 이벤트 피드 */}
        <Panel
          title="위험운전 실시간 피드"
          right={<span className="text-[11px] text-gray-500">공단 409 패킷 · 총 {kpi.totalEvents}건</span>}
          className="min-h-0 flex-1"
        >
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {snap.events.slice(0, 30).map((e, i) => (
              <div
                key={`${e.vehicleId}-${e.simTime}-${i}`}
                className="flex items-center justify-between rounded-md bg-gray-800/50 px-2.5 py-1.5 text-[11px]"
              >
                <span className="font-semibold text-red-400">{e.eventType}</span>
                <span className="text-gray-400">{e.vehicleId.slice(-4)}호</span>
                <span className="tabular-nums text-gray-500">{e.speedKmh} km/h</span>
                <span className="font-mono text-gray-600">{simClock(e.simTime)}</span>
              </div>
            ))}
            {snap.events.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-600">이벤트 없음</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
