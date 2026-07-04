import { useMemo } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { useTheme } from '../theme'
import { DAEGU_CENTER, ROUTES } from '../sim/routes'
import { indexPolyline, pointAt } from '../sim/geo'
import type { RealBus } from '../sim/bis'
import type { Packet409, VehicleState } from '../sim/types'

const ROUTE_IDX = new Map(ROUTES.map((r) => [r.id, indexPolyline(r.points)]))

function busIcon(v: VehicleState, color: string, warn: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="bus-marker${warn ? ' warn' : ''}">
      <span class="dot" style="background:${color}"></span>
      <span class="label">${v.id.slice(-4)}</span>
    </div>`,
    iconSize: [0, 0],
  })
}

/** 이벤트를 ~110m 격자로 묶어 히트 서클 생성 */
function heatCells(events: Packet409[]) {
  const cells = new Map<string, { lat: number; lng: number; count: number }>()
  for (const e of events) {
    const key = `${e.lat.toFixed(3)}|${e.lng.toFixed(3)}`
    const c = cells.get(key)
    if (c) c.count++
    else cells.set(key, { lat: e.lat, lng: e.lng, count: 1 })
  }
  return [...cells.values()]
}

function realBusIcon(b: RealBus): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="bus-marker real">
      <span class="dot"></span>
      <span class="label">실 ${b.routeNo}</span>
    </div>`,
    iconSize: [0, 0],
  })
}

export default function MapView({
  vehicles,
  events,
  showHeat,
  highlightRouteId,
  realBuses = [],
}: {
  vehicles: VehicleState[]
  events: Packet409[]
  showHeat: boolean
  highlightRouteId?: string | null
  realBuses?: RealBus[]
}) {
  const cells = useMemo(() => (showHeat ? heatCells(events) : []), [events, showHeat])
  const theme = useTheme()

  return (
    <MapContainer
      center={DAEGU_CENTER}
      zoom={13}
      className="h-full w-full rounded-xl border border-gray-800"
      zoomControl={false}
    >
      <TileLayer
        key={theme}
        url={`https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`}
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />

      {ROUTES.map((r) => {
        const dim = highlightRouteId != null && highlightRouteId !== r.id
        return (
          <Polyline
            key={r.id}
            positions={r.points}
            pathOptions={{
              color: r.color,
              weight: highlightRouteId === r.id ? 6 : 3.5,
              opacity: dim ? 0.15 : 0.75,
            }}
          />
        )
      })}

      {/* 정류장 */}
      {ROUTES.flatMap((r) => {
        const idx = ROUTE_IDX.get(r.id)!
        return r.stops.map((s) => {
          const { pos } = pointAt(idx, s.at * idx.totalM)
          return (
            <CircleMarker
              key={`${r.id}-${s.name}`}
              center={pos}
              radius={3}
              pathOptions={{ color: '#6b7280', fillColor: '#111827', fillOpacity: 1, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                {s.name}
              </Tooltip>
            </CircleMarker>
          )
        })
      })}

      {/* 위험운전 히트맵 */}
      {cells.map((c, i) => (
        <CircleMarker
          key={i}
          center={[c.lat, c.lng]}
          radius={5 + Math.min(c.count * 2.2, 22)}
          pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.28 }}
        >
          <Tooltip direction="top">위험운전 {c.count}건</Tooltip>
        </CircleMarker>
      ))}

      {/* BIS 실데이터 버스 (TAGO 오픈API) */}
      {realBuses.map((b) => (
        <Marker key={`real-${b.vehicleNo}`} position={[b.lat, b.lng]} icon={realBusIcon(b)}>
          <Tooltip direction="top" offset={[0, -10]}>
            <div style={{ fontSize: 11 }}>
              <b>{b.vehicleNo}</b> · {b.routeNo}
              <br />
              대구 BIS 실데이터 (TAGO)
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* 버스 */}
      {vehicles.map((v) => {
        const route = ROUTES.find((r) => r.id === v.routeId)!
        const warn = !!v.lastEventWall && Date.now() - v.lastEventWall < 6000
        return (
          <Marker key={v.id} position={[v.lat, v.lng]} icon={busIcon(v, route.color, warn)}>
            <Tooltip direction="top" offset={[0, -10]}>
              <div style={{ fontSize: 11 }}>
                <b>{v.id}</b> · {route.name}
                <br />
                {v.driverName} 기사 · {Math.round(v.speedKmh)} km/h
              </div>
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
