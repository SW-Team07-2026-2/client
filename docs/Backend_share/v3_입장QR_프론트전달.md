# 입장 QR · 검표 · 회차 — 프론트 전달용

> 2026-11-27 작성 · 11/28 운영 코드 · 운영 데이터와 다시 대조. 사용자 화면(마이페이지 티켓 · 공연 상세 · 좌석 화면 · 탈퇴)에서 바뀌는 내용만 모았습니다.
> 상태: **운영 배포 끝 (11/27 14:18 · concert #42 · member #43 · studio #36).** 11/28 확인: 운영 concert `9ba8b88` · member `d3a47ef` · studio `2053cb1` 이 이 문서대로 동작합니다. 옛 규칙(공연 3시간 전부터 발급)은 더 이상 없습니다.
> 전체 명세는 [v3 API 명세서](v3_API_명세서.md) 4-3 · 4-4 · 4-5 · 2-1. 이 문서와 다르면 명세서가 맞습니다.
> 관리자 검표 화면(`admin.indig.co.kr`)은 이미 배포돼 있습니다. 프론트가 할 일은 **사용자 화면**뿐입니다.

## 1. 한눈에 보기

| 항목 | 값 |
| --- | --- |
| 기준 시각 | **예매한 회차의 시작 시각** 하나. 공연 끝 시각은 보지 않습니다 |
| QR 공개 · 검표 시작 | 회차 시작 **60분 전** (20:00 회차면 19:00) |
| QR 발급 · 검표 마감 | 회차 시작 **30분 뒤** (20:30) — **입장 마감**이지 공연 종료가 아닙니다 |
| QR 토큰 유효 시간 | 서버 설정 (기본 30초) · 입장 마감 시각을 넘지 않음 |
| 새 토큰 요청 | `min(expiresAt − 10초, 지금 + 20초)` 에 다시 (기본 설정이면 약 20초마다) — **화면에 열린 티켓 하나만** |
| 검표 뒤 | 같은 예매로 다시 입장 · 재발급 불가 (서버가 즉시 막음) |
| 시간 판단 | 서버 시각 기준. 서버도 발급 · 검표 때 같은 규칙을 다시 검사합니다 |

시간 경계: `entryQrOpensAt ≤ 지금 < entryQrClosesAt` 동안만 열립니다. 19:00:00 부터 되고 20:30:00 부터 막힙니다.

## 2. 티켓 조회 API 에 추가되는 필드

목록과 상세 **둘 다**에 붙습니다. 기존 필드는 그대로입니다.

- `GET /api/concerts/bookings` (목록 · 항목마다)
- `GET /api/concerts/bookings/{bookingId}` (상세)

```json
{
  "bookingId": 123,
  "status": "CONFIRMED",
  "sessionId": 41,
  "entryStatus": "NOT_OPEN",
  "serverTime": "2026-11-27T09:50:00Z",
  "entryQrOpensAt": "2026-11-27T10:00:00Z",
  "entryQrClosesAt": "2026-11-27T11:30:00Z",
  "checkedInAt": null
}
```

예시는 KST 20:00 회차를 KST 18:50 에 조회한 경우입니다 (QR 공개 KST 19:00 · 입장 마감 KST 20:30).

| 필드 | 뜻 |
| --- | --- |
| `status` | 기존 그대로 — 결제 · 취소 상태 (`PENDING` · `CONFIRMED` · `CANCELLED` · `EXPIRED`) |
| `sessionId` | 예매한 회차 (목록은 항목에 · 상세는 `concert.sessionId`) |
| `startsAt` (목록) · `concert.startsAt` (상세) | **예매한 회차** 시작 시각. 공연 첫날이 아닐 수 있습니다 |
| `entryStatus` | 입장 상태. **항상 값이 있습니다 (null 없음)** — 3장 |
| `serverTime` | 서버가 이 응답을 만든 시각. 남은 시간 계산에 씁니다 — 5장 |
| `entryQrOpensAt` · `entryQrClosesAt` | QR 공개 시각 · 입장 마감 시각 (예매 상태와 상관없이 회차 기준으로 채움) |
| `checkedInAt` | 검표된 시각. 입장 전이면 `null` |

시각은 모두 **UTC(`Z`)** ISO 8601 문자열로 옵니다 (서버 시계 · DB 모두 UTC). 예: `2026-11-27T11:00:00Z` = KST 20:00. 화면에는 KST 로 바꿔 보여 주고, 문자열을 그대로 비교하지 말고 `Date` 로 바꿔서 쓰세요.

## 3. `entryStatus` — QR 공개 전 · 중 · 후

예매 상태와 시간(전 · 중 · 후)을 보고 서버가 하나로 정합니다.

| 예매 \ 시간 | 전 (`opensAt` 이전) | 중 (`opensAt` ~ `closesAt`) | 후 (`closesAt` 이후) |
| --- | --- | --- | --- |
| `CONFIRMED` · 입장 전 | `NOT_OPEN` | `AVAILABLE` | `CLOSED` |
| `CONFIRMED` · 입장함 | (생기지 않음) | `CHECKED_IN` | `CHECKED_IN` |
| `PENDING` · `CANCELLED` · `EXPIRED` · 탈퇴 정리 중 | `UNAVAILABLE` | `UNAVAILABLE` | `UNAVAILABLE` |

| `entryStatus` | 화면 | QR |
| --- | --- | --- |
| `NOT_OPEN` | "QR 공개까지 남은 시간" 카운트다운 | 숨김 |
| `AVAILABLE` | QR + "입장 마감까지 남은 시간" | **표시** |
| `CHECKED_IN` | "입장 완료 · 관람중" (`checkedInAt` 시각) | 숨김 |
| `CLOSED` | "입장 마감" (공연 종료라고 쓰지 않습니다) | 숨김 |
| `UNAVAILABLE` | 입장 대상이 아닌 예매. 문구는 `status`(결제 전 · 취소 · 만료)로 정합니다 | 숨김 |

## 4. QR 발급 API

경로는 그대로입니다.

```
GET /api/concerts/bookings/{bookingId}/entry-qr      (로그인 필요)
→ { "token": "서버가 서명한 입장 토큰", "expiresAt": "2026-11-27T10:00:30Z" }
```

- **`token` 문자열을 그대로 QR 이미지로 그립니다.** 이름 · 좌석 등을 조합해 직접 만들면 검표에서 거절됩니다.
- 토큰 안에는 입장용 구분값 · 예매 id · 공연 id · 만료 시각 · 서버 서명만 있습니다. 개인정보는 없습니다. 좌석과 실제 예매 상태는 검표 서버가 DB 에서 확인합니다.
- `expiresAt` 은 발급 + 서버 설정 시간(기본 30초)입니다. 입장 마감 직전이면 마감 시각까지만 갑니다.
- **유효 시간은 서버가 바꿀 수 있습니다** (예: 공연장 신호가 나쁜 날 길게). 프론트는 30초 · 20초를 코드에 고정하지 말고, 매번 받은 `expiresAt` 으로 다음 요청 시각을 정합니다 — 5장.

오류 응답과 화면 처리:

| 응답 | 화면 |
| --- | --- |
| 409 `ENTRY_NOT_OPEN` (+`result.opensAt`) | QR 숨김 · `NOT_OPEN` 화면으로 |
| 409 `ENTRY_CLOSED` (+`result.closesAt`) | QR 숨김 · `CLOSED` 화면으로 |
| 409 `ALREADY_CHECKED_IN` (+`result.checkedInAt`) | QR 숨김 · `CHECKED_IN` 화면으로 (**검표 완료 확인은 이 응답으로 합니다**) |
| 409 `ENTRY_NOT_AVAILABLE` | QR 숨김 · `UNAVAILABLE` 화면으로 (QR 을 띄운 사이 취소 · 환불 · 탈퇴 정리된 경우 포함) |
| 404 `NOT_FOUND` | 없는 예매 또는 남의 예매 |
| 네트워크 오류 · 5xx | 지금 QR 은 그 `expiresAt` 까지만 보여 주고, 지나면 숨기고 "다시 시도"를 띄웁니다. 갱신은 계속 시도합니다 |

409 를 받으면 QR 갱신을 멈추고 티켓 상세를 다시 불러 `entryStatus` 대로 그립니다.

## 5. 프론트 동작 순서

```
티켓 상세 열기 → GET /api/concerts/bookings/{bookingId}
  ├─ NOT_OPEN   → 카운트다운 (서버 시각 기준) → 0 이 되면 entry-qr 호출
  ├─ AVAILABLE  → entry-qr 호출 → QR 표시 → min(expiresAt − 10초, 지금 + 20초) 에 entry-qr 다시
  │                 ├─ 409 ALREADY_CHECKED_IN → QR 숨김 · 입장 완료
  │                 ├─ 409 ENTRY_CLOSED       → QR 숨김 · 입장 마감
  │                 └─ 새 토큰을 못 받은 채 expiresAt 지남 → QR 숨김
  └─ CHECKED_IN · CLOSED · UNAVAILABLE → QR 없음 · 갱신 안 함
```

갱신 규칙:

- 마이페이지 **목록은 열 때 한 번만** 조회합니다. 항목의 남은 시간은 받은 값으로 계산합니다.
- QR 을 띄우는 동안 **현재 열린 티켓 하나만** 다시 부릅니다. 다음 요청 시각은 `min(expiresAt − 10초, 지금 + 20초)` 입니다. 기본 설정(30초)이면 약 20초마다이고, 유효 시간이 길게 설정된 날에도 20초마다 불러 검표 완료를 알아챕니다. 여러 티켓을 동시에 갱신하지 않습니다.
- 요청이 실패해도 지금 QR 은 그 `expiresAt` 까지 그대로 보여 줍니다 (4장 표).
- 다른 화면으로 가거나 앱이 백그라운드로 가면(`visibilitychange` → `hidden`) 갱신을 멈춥니다. **돌아오면 상세 조회부터** 다시 합니다.
- 티켓 상태를 따로 몇 초마다 조회할 필요는 없습니다. QR 갱신 응답이 검표 완료 여부를 함께 알려 줍니다.
- 검표 직후 화면이 바뀌는 데 최대 약 20초 걸릴 수 있습니다. 그동안 같은 QR 을 다시 찍어도 서버가 바로 거절합니다.

서버 시각 맞추기 — 기기 시계만으로 계산하지 않습니다.

```js
// 응답을 받은 순간
const offset = Date.parse(res.serverTime) - Date.now();
// 카운트다운
const now = Date.now() + offset;
const leftMs = Date.parse(res.entryQrOpensAt) - now;
```

## 6. 회차 — 공연 상세 · 좌석 화면

한 공연에 날짜 · 시각이 다른 회차가 여러 개 있을 수 있습니다. **11/28 운영 데이터: 공연 10개 중 7개가 회차 2~3개**입니다 (id 7 페퍼톤스 · 8 옥상달빛 · 9 웨이브투어스 · 10 아도이 · 12 넬 · 14 혁오 · 15 한로로). 이 공연들은 좌석 화면에 `sessionId` 를 꼭 보내야 합니다. 회차가 하나인 공연만 `sessionId` 없이 됩니다.

| 어디 | 바뀌는 것 |
| --- | --- |
| 공연 상세 `GET /api/concerts/{concertId}` | `sessions: [{ id, startsAt, saleStatus }]` (시작 순 · 1개 이상) · `lastStartsAt`(마지막 회차 시작). `startsAt` 은 첫 회차 |
| 공연 목록 · 검색 · 팔로우 | `lastStartsAt` · `sessionId`(항상 `null`) 추가. 날짜 표시는 회차가 여럿이면 `startsAt ~ lastStartsAt` |
| 캘린더 `GET /api/concerts/calendar` | **회차마다 한 줄** — 3일 공연이면 3일에 각각. 그 줄의 `startsAt` · `sessionId` · `saleStatus` 는 그 회차. 같은 공연 `id` 가 여러 줄로 옵니다 (11/28 · 12월: 공연 7 · 8 · 9 는 3줄, 10 은 2줄) — 목록 키는 `id` 하나가 아니라 `id` + `sessionId` 로 잡습니다 |
| 좌석 화면 `GET /api/concerts/{concertId}/seats?sessionId=` | 회차가 **둘 이상이면 `sessionId` 필수** (없으면 400 `SESSION_REQUIRED` · 다른 공연 회차면 404 `SESSION_NOT_FOUND`). 응답에 `sessionId` 추가 |
| 예매 `POST /api/concerts/{concertId}/bookings` | 본문 그대로 `{ seatIds }`. 회차는 좌석으로 정해집니다 — 여러 회차 좌석을 섞으면 400 `SEAT_SESSION_MISMATCH` · 시작한 회차면 409 `SESSION_CLOSED` |

화면 흐름: 공연 상세에서 회차 고르기 → 대기열(공연에 하나 · 회차와 상관없음) → 좌석 화면 `?sessionId=` → 예매 → 결제.

- 시작한 회차(`sessions[].saleStatus` 가 `CLOSED`)는 고르지 못하게 해 주세요.
- 1인 1예매는 **회차마다**입니다. 다른 회차는 따로 예매할 수 있습니다. 같은 회차를 또 고르면 409 `SEAT_LIMIT_EXCEEDED`(+`bookingId`).
- 고르는 중인 선점은 **공연에 하나**입니다. 다른 회차에서 고르던 선점이 남아 있으면 409 `HOLD_EXISTS`(+`bookingId`) — 그 선점을 취소한 뒤 다시.
- 취소 · 환불 마감(24시간 전)과 입장 QR 시간은 모두 **예매한 회차** 기준입니다.

## 7. 탈퇴 확인 모달 문구

탈퇴(`DELETE /api/members/me`)하면 공연 예매를 서버가 이렇게 정리합니다 (이용약관 v3 제5조 ③ · 기준은 탈퇴를 누른 시각). 확인 모달에 넣어 주세요.

- 결제 전 예매(좌석 선점)는 바로 취소됩니다.
- 결제한 예매 중 **회차 시작 24시간 전보다 앞**이면 자동으로 취소되고 결제 금액 전액이 환불됩니다.
- 결제한 예매 중 **회차 시작 24시간 전부터**는 환불 없이 만료되며 입장할 수 없습니다.
- 이미 입장한 예매는 환불되지 않습니다.

탈퇴 응답은 환불을 기다리지 않습니다. 결제사가 늦으면 서버가 30초마다 이어서 처리하고, 기준 시각(탈퇴를 누른 시각)은 바뀌지 않습니다.

## 8. 하지 말 것

- `token` 을 직접 만들거나 고치지 않습니다.
- **주소에 `token` 을 실어 보내는 외부 QR 이미지 생성 서비스를 쓰지 않습니다.** 입장권이 제3자 서버로 나갑니다. 브라우저 안에서 그리는 라이브러리를 씁니다.
- `token` 을 `localStorage` · `sessionStorage` 에 저장하지 않습니다. 화면 메모리에만 둡니다.
- `entryStatus` 를 받아 놓고 계속 QR 을 그리지 않습니다. 서버가 발급 · 검표 때마다 다시 검사하므로, 화면은 서버 응답대로 바꿉니다.
- 화면 캡처 방지는 프론트가 막을 수 없습니다. 동적 QR(30초)은 캡처본 재사용을 줄일 뿐, 유효 시간 안에 실시간으로 넘기는 것까지 막지는 못합니다.

## 9. 검표 (관리자 화면 — 참고)

관리자는 `admin.indig.co.kr` 검표 메뉴에서 공연을 고르고 카메라로 QR 을 읽어 문자열만 서버에 보냅니다. 서버는 QR 형식 · 서명 → 고른 공연과 같은지 → 회차 입장 시간 → QR 만료 → 결제 완료 · 중복 입장 순서로 확인하고, 성공한 경우에만 입장 기록을 남깁니다. 검표 공연 목록에는 지금 입장 시간이 열린 회차가 있는 공연만 나옵니다. 사용자 프론트가 할 일은 없습니다.

## 10. 정해진 것 (11/27)

예전 "확정 대기" 항목은 모두 정해졌습니다.

| 항목 | 결정 |
| --- | --- |
| `UNAVAILABLE` 이름 | `UNAVAILABLE` 그대로 — 결제 전 · 취소 · 만료 · 탈퇴 정리 중 예매 |
| 탈퇴 회원 티켓 | 회차 24시간 전보다 앞이면 환불 · 그 뒤면 환불 없이 만료 · 입장한 예매는 그대로 (7장) |
| 여러 날 공연 | 회차로 나눕니다. 입장 QR 시간 · 취소 마감 · 1인 1예매는 예매한 회차 기준 (6장) |
