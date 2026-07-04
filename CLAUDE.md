# Qdrive 프로토타입 — 프로젝트 컨텍스트

## 개요
대구 시내버스 통합 플랫폼의 사업 제안용 라이브 데모. 4개 이해관계자(대구시·버스회사·운전자·승객)를
탭으로 커버. 실차·실단말 없이 공단 DTG 패킷(409 위험운전/521 운행기록) 스키마 그대로 시뮬레이션.
- 라이브: https://hyegeungim3-git.github.io/qdrive-proto/ (master push 시 자동 배포)
- 데모 대본·화면 구성: README.md 참조

## 아키텍처 (핵심만)
- `src/sim/engine.ts` — 시뮬레이터 심장. 250ms 실틱 × 배속, 1초 서브스텝. 버스 9대(3노선),
  기사 페르소나 A모범/B평균/C개선필요, 연비→CO₂ 모델, 데모 트리거(triggerRiskEvent/
  triggerFault/fileComplaint/forceRecommendation/cycleWeather), 하차예약(reservation)
- `src/sim/store.ts` — 엔진 싱글턴 + useSyncExternalStore. DEV에서 window.__engine 노출
- `src/sim/types.ts` — **실데이터 교체 지점**: PacketSource 인터페이스. 실단말 연동 시
  SimEngine 대신 RealPacketSource 구현으로 스왑
- `src/sim/bis.ts` — 대구 BIS 실차 오버레이 (TAGO 오픈API, vite 프록시 /tago 경유,
  **로컬 dev에서만 동작**. 키는 localStorage 'qdrive-bis-key', 절대 커밋 금지)
- `src/sim/routes.ts` — 노선 폴리라인(주요 간선 근사). 정밀화하려면 대구 버스노선 공간정보
  파일데이터(data.go.kr 15070487)로 교체
- `src/views/` — 탭당 1파일. OperatorView는 서브탭(관제/진단스캐너/AI정비챗/차고지)
- 테마: `src/theme.ts` + index.css의 html.light 변수 반전. 기본 라이트
- 폰트: Paperlogy 7웨이트, public/fonts, url('../fonts/...') 상대경로 (Pages 서브경로 호환)

## 도메인 요점
- 주인공 차량 = 대구70자3742 (김성호 기사, 급행1) — 모든 데모 시나리오의 중심
- 반월당 = 3개 노선이 모두 지나는 기준 정류장 (승객 앱 ETA·탑승 기준점)
- 위험운전 8종(공단 기준), eTAS 자동제출, 준공영제 정산 검증(BMS×DTG 교차) 개념 사용
- 전략 배경: 노션 "Qdrive 인수인계 & 사업 분석" 페이지들 + 광주 완료보고 PDF(C:\Qdrive) 참고

## 결정사항 (뒤집으려면 사용자 확인)
- 백엔드 없음 (데모는 오프라인 생존이 우선) / 기본 테마 라이트 / 저장소 공개(Public)
- 커밋 메시지 한국어, PowerShell here-string, 쌍따옴표 금지
- 배포: GitHub Actions → Pages. 워크플로는 npm install 사용 (npm ci는 lockfile 크로스플랫폼 문제)

## 남은 일 후보
- 노선 폴리라인 실좌표 교체 / 진단 스캐너·정비챗 심화 / 모바일 반응형+PWA (/multi-platform)
- README 사업 전략 문구 정리 (공개 저장소 노출 중)
