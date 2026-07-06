import { useState } from 'react'
import { Panel, simClock } from '../../components/ui'
import { useSim } from '../../sim/store'
import { ROUTES } from '../../sim/routes'
import { indexPolyline, pointAt, haversine } from '../../sim/geo'
import { RISK_EVENT_TYPES, type SimSnapshot } from '../../sim/types'

/**
 * AI 운영 리포트 — 광주 'AI+ 리포트' 벤치마킹.
 * 원칙: 모든 문장은 실시간 집계 데이터에서 자동 생성되며, 문단마다 근거 수치를 병기한다.
 * 데모는 규칙 기반 문장 생성(결정적) — 실증 단계에서 이 생성부를 LLM+검증 파이프라인으로 교체.
 */

/** 이벤트 다발 구간을 격자 클러스터링 후 최근접 정류장 이름으로 라벨링 */
function topZones(snap: SimSnapshot, n: number) {
  const cells = new Map<string, { lat: number; lng: number; count: number }>()
  for (const e of snap.events) {
    if (e.justified) continue
    const key = `${e.lat.toFixed(3)}|${e.lng.toFixed(3)}`
    const c = cells.get(key)
    if (c) c.count++
    else cells.set(key, { lat: e.lat, lng: e.lng, count: 1 })
  }
  const stops = ROUTES.flatMap((r) => {
    const idx = indexPolyline(r.points)
    return r.stops.map((s) => ({ name: s.name, pos: pointAt(idx, s.at * idx.totalM).pos }))
  })
  return [...cells.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((c) => {
      let best = stops[0]
      let bd = Infinity
      for (const s of stops) {
        const d = haversine([c.lat, c.lng], s.pos)
        if (d < bd) {
          bd = d
          best = s
        }
      }
      return { name: best.name, count: c.count }
    })
}

interface Para {
  icon: string
  title: string
  text: string
  evidence: string[]
}

function buildReport(snap: SimSnapshot): { paras: Para[]; asOf: string } {
  const { kpi } = snap
  const effective = snap.events.filter((e) => !e.justified)
  const justified = snap.events.length - effective.length
  const eff = kpi.totalFuelM3 > 0 ? kpi.totalDistanceKm / kpi.totalFuelM3 : 0

  // 유형별 최다
  const typeCounts = RISK_EVENT_TYPES.map((t) => ({ t, c: effective.filter((e) => e.eventType === t).length }))
  const topType = typeCounts.sort((a, b) => b.c - a.c)[0]
  const zones = topZones(snap, 3)

  // 기사 순위
  const sorted = [...snap.vehicles].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const worstEvents = RISK_EVENT_TYPES.map((t) => ({ t, c: worst.eventCounts[t] })).sort((a, b) => b.c - a.c)[0]

  const paras: Para[] = []

  paras.push({
    icon: '🚌',
    title: '운행 총평',
    text:
      `금일 ${simClock(snap.simTime)} 기준 ${snap.vehicles.length}대가 총 ${kpi.totalDistanceKm.toFixed(1)}km를 운행했습니다. ` +
      `평균 연비는 ${eff.toFixed(2)}km/m³로 미코칭 기준선 대비 ${kpi.fuelSavedPct.toFixed(1)}% 절감 중이며, ` +
      `누적 CO₂ 절감량은 ${kpi.totalCo2SavedKg.toFixed(1)}kg입니다. 탑승객은 ${snap.passengers.toLocaleString()}명으로 집계되었습니다.`,
    evidence: [
      `주행거리 ∑ ${kpi.totalDistanceKm.toFixed(1)}km (DTG 521)`,
      `연료 ∑ ${kpi.totalFuelM3.toFixed(1)}m³ (CAN)`,
      `승차 집계 ${snap.passengers}명 (APC 상당)`,
    ],
  })

  paras.push({
    icon: '🛡️',
    title: '안전 운행',
    text:
      `위험운전은 총 ${snap.events.length}건 감지되었고, 이 중 ${justified}건은 맥락 판정(사고 회피·정류장 접근·폭우 대응 등)으로 감점에서 제외되었습니다. ` +
      (topType && topType.c > 0
        ? `감점 대상 ${effective.length}건 중 최다 유형은 ${topType.t}(${topType.c}건)이며, ` +
          (zones[0] ? `${zones[0].name} 인근(${zones[0].count}건)에 집중되어 해당 구간 서행 안내를 권장합니다.` : '특정 구간 집중은 관찰되지 않았습니다.')
        : '감점 대상 이벤트가 없어 전반적으로 안정적인 운행입니다.'),
    evidence: [
      `409 패킷 ${snap.events.length}건`,
      `정당 판정 ${justified}건 (감점 제외)`,
      ...(zones[0] ? [`다발 구간: ${zones.map((z) => `${z.name} ${z.count}건`).join(' · ')}`] : []),
    ],
  })

  paras.push({
    icon: '👨‍✈️',
    title: '운전원 코칭 제안',
    text:
      `안전점수 최상위는 ${best.driverName} 기사(${Math.round(best.score)}점, ${best.id.slice(-4)}호)로 동료 모범사례 공유를 권장합니다. ` +
      `${worst.driverName} 기사(${Math.round(worst.score)}점)는 ` +
      (worstEvents && worstEvents.c > 0
        ? `${worstEvents.t} 빈도(${worstEvents.c}건)가 높아 해당 유형 중심의 맞춤 코칭이 필요합니다.`
        : `이벤트는 적으나 점수 회복 구간으로 지속 관찰이 필요합니다.`) +
      (snap.pleas.filter((p) => p.status === '인정').length > 0
        ? ` 금일 소명 인정 ${snap.pleas.filter((p) => p.status === '인정').length}건이 반영되어 점수가 복원되었습니다.`
        : ''),
    evidence: [
      `점수 분포 ${Math.round(worst.score)}~${Math.round(best.score)}점 (${snap.vehicles.length}명)`,
      `소명 ${snap.pleas.length}건 (인정 ${snap.pleas.filter((p) => p.status === '인정').length})`,
    ],
  })

  const activeFault = snap.fault?.predicted
  const issuedWo = snap.workOrders.filter((w) => w.status === '발행됨').length
  paras.push({
    icon: '🔧',
    title: '차량 상태·정비',
    text: activeFault
      ? `${snap.fault!.vehicleId.slice(-4)}호에서 ${snap.fault!.kind} 예측이 발화하여(현재 ${snap.fault!.coolantTemp.toFixed(1)}°C) ` +
        (issuedWo > 0 ? '작업지시가 발행되었습니다. 회차 종료 후 입고 예정으로, 운휴 없이 예방 정비로 대응 중입니다.' : '작업지시 승인 대기 중입니다. 조속한 검토를 권장합니다.')
      : `전 차량 주요 계통(전원·냉각·연료·배기) 이상 신호 없이 정상 운행 중입니다. 예방 정비 일정은 차고지·충전 탭의 자동 편성을 따릅니다.`,
    evidence: [
      `고장 예측 ${activeFault ? 1 : 0}건`,
      `작업지시 ${snap.workOrders.length}건 (발행 ${issuedWo})`,
      `돌발정보 진행 ${snap.incidents.filter((i) => i.status !== '완료').length}건`,
    ],
  })

  if (snap.weather.condition !== '맑음') {
    paras.push({
      icon: snap.weather.condition === '폭우' ? '🌧️' : '🥵',
      title: '기상 대응',
      text:
        snap.weather.condition === '폭우'
          ? `호우로 전 노선 평균 ${snap.weather.delayForecastMin}분 지연이 예상됩니다. 감속 계열 이벤트는 정당 판정으로 감점에서 제외 중이며, 예비차 선배정을 권고합니다.`
          : `폭염으로 냉방 부하가 증가해 연료 소모가 평시 대비 상승 중입니다. 공회전 최소화 안내를 권장합니다.`,
      evidence: [`기상: ${snap.weather.condition} ${snap.weather.tempC}°C`, `지연 예측 +${snap.weather.delayForecastMin}분`],
    })
  }

  return { paras, asOf: simClock(snap.simTime) }
}

export default function AiReport() {
  const snap = useSim()
  const [copied, setCopied] = useState(false)
  const { paras, asOf } = buildReport(snap)

  const copyText = () => {
    const text =
      `[Qdrive AI 운영 리포트] ${asOf} 기준 (자동 생성)\n\n` +
      paras.map((p) => `■ ${p.title}\n${p.text}\n근거: ${p.evidence.join(' / ')}`).join('\n\n')
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-3 overflow-y-auto pr-1">
      {/* 리포트 헤더 */}
      <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gradient-to-r from-gray-900 to-gray-900/40 px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-sky-400">AI OPERATIONS REPORT · AUTO-GENERATED</div>
          <h2 className="mt-0.5 text-lg font-bold text-gray-100">금일 운영 리포트 — {asOf} 기준</h2>
          <div className="mt-0.5 text-[11px] text-gray-500">
            모든 문장은 실시간 집계 데이터에서 자동 생성되며 문단마다 근거 수치를 병기합니다 · 열람 시점 기준 자동 갱신
          </div>
        </div>
        <button
          onClick={copyText}
          className="shrink-0 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:text-gray-100"
        >
          {copied ? '✓ 복사됨' : '📋 텍스트 복사'}
        </button>
      </div>

      {/* 자동 생성 문단 */}
      {paras.map((p) => (
        <Panel key={p.title} title={`${p.icon} ${p.title}`}>
          <p className="text-[13px] leading-relaxed text-gray-300">{p.text}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.evidence.map((e) => (
              <span key={e} className="rounded border border-gray-700/60 bg-gray-800/50 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-500">
                근거 · {e}
              </span>
            ))}
          </div>
        </Panel>
      ))}

      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-2.5 text-[10px] leading-relaxed text-gray-600">
        ⚠ 신뢰성 원칙: 본 리포트의 수치는 전부 DTG/CAN/APC 집계에서 산출되며, 문장 생성부는 데모에서는
        규칙 기반(결정적), 실증 단계에서는 LLM + 수치 검증 파이프라인으로 교체됩니다. AI가 생성한
        제안은 참고용이며 인사·평가 등 불이익 결정에 단독 사용할 수 없습니다.
      </div>
    </div>
  )
}
