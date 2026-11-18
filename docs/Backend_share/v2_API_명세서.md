# v2_API_명세서

# v2 API 명세서

> **기준일: 2026-11-13 · 코드 기준.** 각 서비스 `main`의 컨트롤러 · DTO · ErrorCode에서 뽑았습니다. 운영 `https://api.indig.co.kr`에 배포된 버전입니다:
gateway `7aacd38` · member `db0df58` · catalog `aeebf70` · concert `b64e6b6` · payment `9ba7c72` · chatbot `c75dbc2`. Studio(`6c1d371`)는 main에만 있고 배포되지 않았습니다.
v1 문서([15](15_API_명세.md) · [23](23_프론트_API_목록.md) · [26](26_프론트_API_명세서.md))와 다르면 **이 문서가 맞습니다.** 화면별 확인 사항은 [v2_프론트_체크사항](v2_프론트_체크사항.md), 남은 일은 [v2_후속_작업](v2_후속_작업.md)에 있습니다.
서비스별 설계 근거: 각 저장소 `docs/v2_member_service_re.md` · `docs/v2_catalog_service_re.md` · `docs/v2_studio_service_re.md`, 챗봇 `docs/api.md`
> 

## 목차

1. 공통 규칙
2. 인증 (Gateway `/api/auth` · `/oauth2`)
3. 회원 (member `/api/members`)
4. 카탈로그 · 장바구니 · 주문 (catalog `/api/catalog` · `/api/cart`)
5. 공연 · 대기열 · 좌석 · 예매 (concert `/api/concerts`)
6. 결제 (payment `/api/payments`)
7. 챗봇 (`/api/chatbot`)
8. 서비스 간 내부 API (`/internal/**`)
9. 관리자 API (Studio `/api/studio/**` → 각 서비스 `/internal/admin/**`)
10. 서명 경로 (`/ingest/**`)
11. Kafka 이벤트
12. 에러 코드
13. enum 값

---

## 0. 공통 규칙

### 0-1. 주소 · 진입

| 항목 | 값 |
| --- | --- |
| 사용자 API | `https://api.indig.co.kr` — Cloudflare → ALB → Gateway. `/api/*` · `/oauth2/*` 밖은 엣지에서 403 |
| 관리자 API | Studio(KT) 직접. Gateway를 거치지 않습니다(배포 전) |
| 내부 API | 클러스터 안에서만(NetworkPolicy). 외부에서는 경로가 없습니다(404) |
| CORS | `https://indig.co.kr` + 임시 `http://localhost:5173`, `credentials: true` |

### 0-2. 인증 · CSRF

- 로그인 상태는 **쿠키**입니다: `AT`(액세스 · HttpOnly) · `RT`(리프레시 · HttpOnly) · `XSRF-TOKEN`. 모든 요청에 `credentials: 'include'`.
- 액세스 토큰이 곧 만료되면 Gateway가 응답에 새 쿠키를 붙입니다(선제 갱신). 실패했을 때만 프론트가 `POST /api/auth/refresh`를 부릅니다.
- **POST · PUT · PATCH · DELETE**는 `X-XSRF-TOKEN` 헤더가 쿠키 값과 같아야 합니다 → 아니면 403 `CSRF_*`. 토큰 값은 `GET /api/auth/me` 응답의 `xsrfToken`(또는 `GET /api/members/terms` 응답 헤더).
- 표의 “인증” 열: **공개** = 토큰 없이 됨 · **로그인** = 없으면 401 `TOKEN_INVALID` · **🔒C** = 로그인 + CSRF.
- 사용자 식별은 Gateway가 붙이는 `X-User-Id`입니다. 프론트가 보낸 `X-User-*` 헤더는 Gateway가 지웁니다.

### 0-3. 응답 봉투

```json
{ "isSuccess": true,  "code": "OK", "message": "성공", "result": { } }
{ "isSuccess": false, "code": "SEAT_TAKEN", "message": "…", "result": { "seatId": 12 }, "correlationId": "…" }
```

- 실패 응답의 `result`에는 화면이 쓸 값(예: `seatId` · `bookingId` · `checkedInAt`)이 붙을 때가 있습니다.
- 예외: 챗봇 자체 오류는 `{ "detail": "…" }`(6장), `POST /api/auth/refresh` · `/signup`은 본문 없는 응답이 있습니다(1장).

### 0-4. 목록 형식

| 형식 | 모양 | 쓰는 곳 |
| --- | --- | --- |
| 페이지 | `{ items, page, size, hasNext }` · `?page=0&size=20` (최대 50) | 카탈로그 · 공연 · 공연장 목록 |
| 커서 | `{ items, nextCursor, hasNext }` · `?cursor=&size=` | 회원(팔로우 · 콜렉션 · 알림) · 주문 · 예매 · 결제 목록 |
- 커서는 받은 `nextCursor`를 그대로 다시 보냅니다. 깨진 커서는 400 `INVALID_CURSOR`.
- enum 파라미터에 목록 밖 값을 주면 400 `INVALID_REQUEST`(12장의 값만).
- 시각은 오프셋이 붙은 ISO-8601(`2026-11-13T15:00:00+09:00`), 날짜는 `YYYY-MM-DD`, 금액은 원 단위 정수.

### 0-5. 호출 한도 (Gateway)

| 대상 | 한도 | 초과 |
| --- | --- | --- |
| `/api/chatbot/**` | 사용자당 분당 5회 | 429 |
| `POST /api/members/me/metrics` | 사용자당 분당 30회 | 429 `TOO_MANY_REQUESTS` |
| `POST /api/auth/refresh` | 사용자당 분당 10회 | 429 |
| `/oauth2/authorization/**` | IP당 분당 20회 | 429 |
| `/ingest/**` | 키당 초당 10건 | 429 |
| 본문 크기 | 1 MiB | 413 |
| 엣지(Cloudflare) | 같은 IP 10초 100회 | 429 HTML |

하위 서비스가 응답하지 않으면 Gateway가 503(`Retry-After`)을 냅니다(서킷 브레이커 폴백).

---

## 1. 인증 (Gateway)

쿠키를 굽는 주체가 Gateway라서 member로 라우팅하지 않고 Gateway가 직접 응답합니다.

| 메서드 · 경로 | 인증 | 요청 | 응답 · 규칙 |
| --- | --- | --- | --- |
| `GET /oauth2/authorization/kakao` | 공개 | `?frontend=local`(임시 · 로컬 프론트로 복귀) | 카카오 로그인 화면으로 302 |
| `GET /oauth2/code/kakao` | 공개 | (카카오가 부름) | 기존 회원 → AT · RT 쿠키 + 프론트로 302 · 새 회원 → `SIGNUP` 쿠키 + `/welcome`으로 302 |
| `GET /api/auth/me` | 로그인 |  | `{ userId, nickname, profileImageUrl, roles: ["USER"], xsrfToken, stale? }`. member가 응답하지 않으면 200 + `stale: true`(클레임만). 비로그인은 401(정상 분기) |
| `POST /api/auth/refresh` | 공개(RT 쿠키) |  | 성공 시 쿠키 재발급 · 본문 없음. RT 거절 → 401 `REFRESH_INVALID` · `REFRESH_REUSED` + 쿠키 삭제 → 로그인 화면. member 불통 → 503(쿠키 유지) |
| `POST /api/auth/logout` | 공개 |  | 쿠키 삭제 · 항상 200 |
| `GET /api/auth/signup` | 공개(`SIGNUP` 쿠키) |  | 가입 화면에 들어와도 되는지. 있으면 200, 없으면 401 `SIGNUP_EXPIRED` |
| `POST /api/auth/signup` | 공개(`SIGNUP` 쿠키) + CSRF | `{ artistIds: [Long] (1~50개 · 필수), agreements: [{ termsId, agreed }] }` | AT · RT 쿠키 발급, `SIGNUP` 삭제. 401 `SIGNUP_EXPIRED` · `SIGNUP_INVALID`(→ 로그인 화면) · 400 `REQUIRED_AGREEMENT_MISSING` · 409 `TERMS_OUTDATED`(약관 다시 받아 재시도 · `SIGNUP` 유지) |
- `artistIds`는 **1개 이상 필수**입니다(11/08부터 · 빈 배열 400). member는 아티스트가 Catalog에 있는지 확인하지 않습니다.
- `agreements`는 `GET /api/members/terms`의 약관 4개(`AGE14` · `TOS` · `PRIVACY` 필수, `MARKETING` 선택) `termsId`를 그대로 씁니다.

---

## 2. 회원 (member)

### 2-1. 내 정보 · 탈퇴

| 메서드 · 경로 | 인증 | 요청 | 응답 |
| --- | --- | --- | --- |
| `GET /api/members/me` | 로그인 |  | `{ userId, nickname, profileImageUrl, email, provider, followCount, collectionCount }` |
| `PATCH /api/members/me` | 🔒C | `{ nickname }` (2~10자) | `{ userId, nickname }` · 400 `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` · `INVALID_NICKNAME` |
| `DELETE /api/members/me` | 🔒C |  | `null`. **즉시 hard delete** + `user.withdrawn` 발행. Gateway가 응답에 AT · RT · XSRF 만료 쿠키를 붙입니다. 같은 카카오 계정으로 다시 가입하면 새 회원 |

### 2-2. 배송지

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `GET /api/members/me/addresses` | 로그인 | `{ items: [ShippingAddressView] }` |
| `POST /api/members/me/addresses` | 🔒C | `{ label?, recipientName, phone, zonecode(5자리), address, addressDetail?, isDefault? }` → `ShippingAddressView`. 10개 넘으면 409 `ADDRESS_LIMIT_EXCEEDED` |
| `PUT /api/members/me/addresses/{id}` | 🔒C | 같은 본문 → `ShippingAddressView` |
| `POST /api/members/me/addresses/{id}/default` | 🔒C | 기본 배송지로 → `ShippingAddressView` |
| `DELETE /api/members/me/addresses/{id}` | 🔒C | 204. 기본을 지우면 다른 배송지가 기본을 이어받음 |

`ShippingAddressView = { id, label, recipientName, phone, zonecode, address, addressDetail, isDefault }` · 남의 배송지는 404.

### 2-3. 팔로우 · 보유 음반(콜렉션)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `POST /api/members/follows/{artistId}` | 🔒C | 멱등. `{ artistId, following: true }` |
| `DELETE /api/members/follows/{artistId}` | 🔒C | 204 |
| `GET /api/members/follows` | 로그인 | 커서 · `[{ artistId, followedAt }]` |
| `GET /api/members/follows/{artistId}` | 로그인 | `{ following }` |
| `GET /api/members/collections` | 로그인 | 커서 · `[CollectionItem]` |
| `GET /api/members/collections/{id}` | 로그인 | `CollectionItem` |
| `POST /api/members/collections` | 🔒C | `{ physicalAlbumId, optionId, acquiredAt? }` — **옵션 필수** → `CollectionItem` |
| `DELETE /api/members/collections/{id}` | 🔒C | `null` |
- `CollectionItem = { id, physicalAlbumId, optionId, source(MANUAL·PURCHASE), acquiredAt }` — 이름 · 이미지는 없습니다. `GET /api/catalog/products?ids=`로 채웁니다.
- 주문이 확정되면(`order.confirmed`) 구매한 옵션이 자동으로 추가됩니다(`source: PURCHASE`). 같은 옵션은 한 번만.

### 2-4. 알림

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `GET /api/members/notifications` | 로그인 | 커서 · `[{ id, type, target, targetId, artistId, message, isRead, createdAt }]` 최신순 |
| `GET /api/members/notifications/badge` | 로그인 | `{ count }` (안 읽은 수 · 상한 있음) |
| `POST /api/members/notifications/{id}/read` | 🔒C | 하나 읽음 → `{ notificationId, isRead: true }`. 없거나 지난 알림은 404 → 목록에서 지우기 |
| `POST /api/members/notifications/read` | 🔒C | 전체 읽음 · `null` |
- 나의 알림(주문 · 예매)과 팔로우한 아티스트 소식이 **한 목록**입니다. 푸시 없음 · 3개월 보관.
- `target` → 이동 화면: `ALBUM` 앨범 · `PHYSICAL_ALBUM` 피지컬 앨범 · `GOODS` 굿즈 · `CONCERT` 공연 · `ORDER` 내 주문 · `BOOKING` 내 예매.

### 2-5. 약관 · 동의

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `GET /api/members/terms` | 공개 | `{ items: [{ termsId, code, version, title, content, required }] }` — 가입 화면용 4개. 응답 헤더 `X-XSRF-TOKEN` |
| `GET /api/members/terms/{code}` | 공개 | 푸터 문서 1개(`TOS` · `PRIVACY_POLICY` 등) · 없으면 404 `TERMS_NOT_FOUND` |
| `GET /api/members/me/agreements` | 로그인 | `{ items: [{ termsId, code, version, title, required, agreed, at }] }` |
| `PUT /api/members/me/agreements/marketing` | 🔒C | `{ agreed }` → `{ agreed, at }` |

지금 시행 중인 버전 = `effective_at`이 지난 것 중 가장 최근. 개인정보 v3는 `2026-11-21` 시행(임시 값).

### 2-6. 행동 메트릭 · 챗봇 장기기억

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `POST /api/members/me/metrics` | 🔒C | `{ events: [MetricEvent] }` (1~50개) → `{ saved }`(새로 저장된 수 · 같은 `metricId`는 0). 분당 30회(429) |
| `GET /api/members/me/chat-history` | 로그인 | `{ messages: [{ role(USER·ASSISTANT), content(≤200자), spokenAt }] }` 최대 50개 |
| `POST /api/members/me/chat-history` | 🔒C | `{ messages: [...] }` (1~50개) → 저장 뒤 전체. 50개 넘으면 오래된 것부터 삭제 |

`MetricEvent = { metricId(UUIDv7 · 필수), sessionId?, pageViewId?, targetType, targetId, metricType, metricValue(≥0), properties?, occurredAt(오프셋 포함) }` — 같은 `metricId`는 한 번만 저장. 값 목록은 12장. 보내는 시점(버퍼 · `keepalive`)은 프론트 체크사항.

---

## 3. 카탈로그 · 장바구니 · 주문 (catalog)

### 3-1. 조회 (공개)

| 메서드 · 경로 | 파라미터 | 응답 |
| --- | --- | --- |
| `GET /api/catalog/artists` | `q?` · `genre?` · `ids?=1,2` · 페이지 | `[{ id, name, genres[], debutYear, profileUrl }]` |
| `GET /api/catalog/artists/{id}` |  | `{ id, name, genres[], label, debutYear, profileUrl, albums[], physicalAlbums[], goods[] }` |
| `GET /api/catalog/albums` | `type?`(ALBUM·EP·SINGLE) · 페이지 | `[{ id, artistId, artistName, title, type, genres[], releasedAt, thumbnailUrl }]` |
| `GET /api/catalog/albums/{id}` |  | 위 + `tracks: [{ id, trackNo, title, genres[], tempo, moods[], emotions[], styles[] }]` · `physicalAlbums[]` |
| `GET /api/catalog/physical-albums` | `format?`(LP·CD·CASSETTE) · `from?` · `to?`(발매일) · 페이지 | `[{ id, albumId, albumTitle, artistId, artistName, format, name, releasedAt, thumbnailUrl, minPrice }]` |
| `GET /api/catalog/goods` | `artistId?` · `category?` · 페이지 | `[{ id, artistId, artistName, name, category, thumbnailUrl, minPrice }]` |
| `GET /api/catalog/products/{id}` |  | `ProductDetail` |
| `GET /api/catalog/products` | `ids=1,2,3` (필수 · 최대 50) | 페이지 형식 · `[ProductDetail]` — 보유 음반 화면 · 챗봇 일괄 조회 |
| `GET /api/catalog/search` | `q`(필수) · `size?` | `{ items: [{ type(ARTIST·ALBUM·TRACK), id, title, albumId?, score }] }` · 400 `SEARCH_QUERY_EMPTY` · `SEARCH_QUERY_TOO_LONG` |

`ProductDetail = { id, productType(PHYSICAL_ALBUM·GOODS), name, thumbnailUrl, purchaseUrl, artistId, artistName, albumId?, albumTitle?, format?, releasedAt?, category?, options: [{ id, name, vinylColor?, size?, price, qty, soldOut, stockUpdatedAt }] }`

- **판매 단위는 옵션(`optionId`)입니다.** 가격 · 재고 · 장바구니 · 주문이 모두 옵션을 가리킵니다.
- 옵션 규칙: LP는 `vinylColor`(BLACK · COLOR), CD · 카세트는 이름만(“기본”), 굿즈는 `size`(XS~XXL · FREE).
- 이미지 URL(`thumbnailUrl` · `profileUrl`)은 수집기가 S3에 올린 주소입니다(11/13 결정).

### 3-2. 장바구니 (조회도 로그인)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `GET /api/cart` | 로그인 | `CartView` |
| `PUT /api/cart/items/{optionId}` | 🔒C | `{ qty }`(≥1 · 수량을 이 값으로) → `CartView`. 옵션 20가지 · 옵션당 10개 넘으면 409 `CART_FULL` · 없는 옵션 404 `OPTION_NOT_FOUND` |
| `DELETE /api/cart/items/{optionId}` | 🔒C | → `CartView` |
| `DELETE /api/cart` | 🔒C | 비우기 · `null` |

`CartView = { items: [{ optionId, productId, productType, productName, optionName, vinylColor, size, thumbnailUrl, price, qty, stockQty, soldOut, addedAt }], totalPrice }` — TTL 없음, 탈퇴 때 삭제.

### 3-3. 주문 (굿즈 · 피지컬 앨범)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `POST /api/catalog/orders` | 🔒C | `{ items: [{ optionId, qty(1~1000) }], shipping: { recipientName, phone, zonecode, address, addressDetail? } }` → `{ orderId, amount, pgOrderId, status: "PENDING", expiresAt }` |
| `GET /api/catalog/orders` | 로그인 | 커서 · `[{ orderId, status, totalPrice, createdAt }]` |
| `GET /api/catalog/orders/{id}` | 로그인 | `{ orderId, status, totalPrice, pgOrderId, createdAt, shipping, items: [{ optionId, productId, productType, productName, optionName, qty, price }] }` |
| `POST /api/catalog/orders/{id}/cancel` | 🔒C | → 주문 상세. 결제 전이면 `CANCELLED`, 결제 뒤 환불되면 `REFUNDED` |
- 흐름: 주문 생성(재고 차감 · 결제 준비) → 토스 결제창(`orderId` = `pgOrderId`, `amount`) → **`POST /api/payments/confirm`**(5장) → `payment.completed`를 받아 `CONFIRMED`.
- 오류: 409 `OUT_OF_STOCK` · 400 `INVALID_OPTION` · 503 `PAYMENT_UNAVAILABLE`(재고는 되돌림). 시간 안에 결제하지 않으면 만료(재고 복구).
- 주문 상태: `PENDING` → `CONFIRMED` / `CANCELLED` / `REFUNDED`.

---

## 4. 공연 · 대기열 · 좌석 · 예매 (concert)

### 4-1. 조회 (공개)

| 메서드 · 경로 | 파라미터 | 응답 |
| --- | --- | --- |
| `GET /api/concerts` | `from?` · `to?`(날짜) · `region?` · `genre?` · `type?`(SOLO·FESTIVAL) · `artistId?` · 페이지 | `[ConcertSummary]` |
| `GET /api/concerts/{id}` |  | `ConcertDetail` |
| `GET /api/concerts/calendar` | `month=YYYY-MM`(필수) · `artistIds?` | `{ month, days: [{ date, concerts: [ConcertSummary] }] }` |
| `GET /api/concerts/venues` | `region?` · `q?` · `hasUpcoming?` · 페이지 | `[{ id, name, region, address, capacity }]` |
| `GET /api/concerts/venues/{id}` |  | `{ id, name, region, address, capacity, upcomingConcerts: [{ id, title, type, artists, startsAt, saleStatus }] }` |
- `ConcertSummary = { id, title, type, genre, artists: [{ id, name, genre }], startsAt, price, saleStatus, venue: { id, name, region } }`
- `ConcertDetail = { id, title, type, genre, artists[], startsAt, endsAt, price, saleStatus, bookingOpenAt, queueEnabled, maxSeatsPerUser, venue: { id, name, region, address, capacity },**description, terms, requirements, posterUrl, imageUrls[]**}` — 굵은 5개는 11/13 신규(없으면 `null` · 빈 배열).
- 🔴 **`genre` 필터는 장르 목록 23개(12장)만 받습니다.** `ROCK` · `POP` · `BALLAD` 같은 값은 400입니다(11/13 · 카탈로그와 같은 목록).
- `saleStatus`: `SCHEDULED`(예매 전) · `ON_SALE` · `CLOSED`.

### 4-2. 대기열 (로그인)

| 메서드 · 경로 | 인증 | 응답 |
| --- | --- | --- |
| `POST /api/concerts/{id}/queue` | 🔒C | `QueueStatus` · 409 `ALREADY_IN_QUEUE` · `QUEUE_NOT_OPEN` · `QUEUE_DISABLED` |
| `GET /api/concerts/{id}/queue/status` | 로그인 | `QueueStatus` · 404 `NOT_IN_QUEUE` · 410 `QUEUE_CLOSED` |
| `DELETE /api/concerts/{id}/queue` | 🔒C | 204 (나가기) |

`QueueStatus = { state(WAITING·ADMITTED·EXPIRED), rank, total, etaSeconds, pollAfterMs, degraded, entryToken, expiresIn }` — `pollAfterMs`마다 다시 조회. `ADMITTED`면 `entryToken`을 좌석 · 예매 요청의 `X-Entry-Token` 헤더로 보냅니다. 대기열을 끈 공연(`queueEnabled: false`)은 토큰 없이 갑니다.

### 4-3. 좌석 · 예매 (로그인)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `GET /api/concerts/{id}/seats` | 로그인 + `X-Entry-Token` | `{ concertId, maxSeatsPerUser, total, available, expiresAt, expiresIn, floors: [{ id, name, sections: [{ id, name, shape, angle, seats: [{ id, row, number, x, y, angle, price, status }] }] }] }` — `expiresIn`(남은 초)으로 타이머 |
| `POST /api/concerts/{id}/bookings` | 🔒C + `X-Entry-Token` | `{ seatIds: [Long] }`(1~10 · `maxSeatsPerUser`까지) → `{ bookingId, amount, pgOrderId, status, expiresAt, expiresIn }`. **금액은 서버가 좌석 가격 합으로 정합니다** |
| `POST /api/concerts/bookings/{id}/confirm` | 🔒C | `{ paymentKey, amount }` → `{ bookingId, status, paymentStatus, reason, pgOrderId }`. **티켓 결제 승인은 여기로**(5장의 `/api/payments/confirm` 아님) |
| `GET /api/concerts/bookings` | 로그인 | 커서 · `[{ bookingId, status, totalPrice, createdAt, concertId, concertTitle, startsAt }]` |
| `GET /api/concerts/bookings/{id}` | 로그인 | `{ bookingId, status, totalPrice, pgOrderId, createdAt, expiresAt, expiresIn, concert: { id, title, startsAt, venueName }, seats: [{ id, floor, section, row, number, price }] }` |
| `POST /api/concerts/bookings/{id}/cancel` | 🔒C | → 예매 상세. 선점 해제 또는 환불 취소 |
| `GET /api/concerts/bookings/{id}/entry-qr` | 로그인 | `{ token, expiresAt }` — 30초 유효, 20초마다 다시 부름. 공연 3시간 전부터 |
- 타이머: 대기열 입장부터 결제하기까지 **7분 하나**(서버 유예 179초 포함).
- 예매 오류: 409 `SEAT_TAKEN`(+`seatId` · 전부 안 잡힘) · `HOLD_EXISTS`(+`bookingId` · 먼저 취소) · `SEAT_LIMIT_EXCEEDED` · `SEAT_LOCKED` · 410 `HOLD_EXPIRED`(토스 호출 없음) · 503 **`PAYMENT_PENDING`**(승인 응답이 늦음 — 실패로 보여주지 않고 상세를 다시 조회) · 409 `ALREADY_PAID` · `BOOKING_NOT_CANCELLABLE` · 403 `ENTRY_TOKEN_REQUIRED` · `ENTRY_TOKEN_INVALID` · `QUEUE_NOT_ADMITTED`.
- 예매 상태: `PENDING`(선점) → `CONFIRMED` / `CANCELLED` / `EXPIRED`. 좌석 상태: `AVAILABLE` · `HELD` · `PAYING` · `SOLD`.

---

## 5. 결제 (payment)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `POST /api/payments/confirm` | 🔒C | **굿즈 · 피지컬 주문 전용.** `{ paymentKey, orderId(=pgOrderId), amount }` → `PaymentView`. 티켓이면 409 `USE_BOOKING_CONFIRM` |
| `GET /api/payments/me` | 로그인 | 커서 · `[PaymentView]` |
| `GET /api/payments/{id}` | 로그인 | `PaymentView` |
| `POST /api/payments/{id}/cancel` | 🔒C | `{ reason? }` → `PaymentView`. 티켓이면 409 `USE_BOOKING_CANCEL`(예매 취소로) |
| `POST /api/payments/webhook/{provider}` | 공개(서명) | 토스 웹훅 · 프론트는 부르지 않음 |
- `PaymentView = { paymentId, orderType(TICKET·GOODS), orderRef, amount, status, method, reason, requestedAt, completedAt }`
- 결제 준비(prepare)는 공개하지 않습니다. 주문 · 예매를 만들면 서비스가 준비합니다.
- 오류: 400 `AMOUNT_MISMATCH` · 409 `ALREADY_CONFIRMED` · `PAYMENT_EXPIRED` · `PAYMENT_NOT_PENDING` · `PAYMENT_NOT_CANCELLABLE` · 503 `PG_PROCESSING` · `PG_UNAVAILABLE` · 502 `PG_CANCEL_REJECTED`.
- 토스 **테스트** 키입니다(실제 돈이 나가지 않음). 카드 · 토스페이만 됩니다.

---

## 6. 챗봇 (`/api/chatbot`)

Gateway가 `/api/chatbot/**`를 chatbot-service로 넘깁니다. **전부 로그인**(공개 경로 없음 · 11/13 `/api/chatbot/artists/similar` 삭제). 분당 5회, 응답 30초.

| 메서드 · 경로 | 인증 | 요청 · 응답 |
| --- | --- | --- |
| `GET /api/chatbot/chat` | 로그인 | `{ count, total_count, has_truncated, messages: [{ id, role(user·bot), text, time }] }` — 기록이 없으면 첫인사 생성 |
| `POST /api/chatbot/chat/upload` | 🔒C | `multipart/form-data` `file` → `{ file_uri, file_name, media_type, url, name, type }`. **Gateway 본문 한도 1 MiB**(챗봇 문서의 20MB보다 Gateway가 먼저 막음 · 413) |
| `POST /api/chatbot/chat` | 🔒C | `{ message, attachments?: [{ file_uri, file_name, media_type }] }` → **SSE 스트림** |
- 오류 모양이 둘입니다: Gateway가 막은 것은 공통 봉투(`code`), 챗봇이 낸 것은 `{ detail }`. 401이면 `POST /api/auth/refresh` 1회 뒤 재시도.
- 상세는 chatbot-service `docs/api.md`.

---

## 7. 서비스 간 내부 API (`/internal/**`)

Gateway를 거치지 않고 클러스터 안에서만 부릅니다. 헤더 `X-Internal-Token`(HS256 · 공유 시크릿 · `{iss, aud, exp}`)이 필요하고, **경로마다 받는 발급자(`iss`)가 다릅니다.** 프론트와는 상관없습니다.

| 서비스 · 경로 | 부르는 쪽(iss) | 내용 |
| --- | --- | --- |
| member `POST /internal/auth/issue` · `/signup` · `/refresh` · `/revoke` | gateway | 로그인 · 가입 · 재발급 · 폐기 |
| member `GET /internal/members/{id}/profile` | gateway | `{ userId, nickname, profileImageUrl }` |
| member `GET /internal/members/{userId}/metrics` · `GET`/`PUT …/embedding` | gateway(서명 경로 9장) | AI용 메트릭 · 회원 벡터 |
| member `GET /.well-known/jwks.json` | gateway | 공개키(토큰 없음) |
| catalog `POST /internal/catalog/artists` · `/albums` · `/ingest/diff` | gateway(수집 토큰) | 수집 적재(9장) |
| payment `POST /internal/payments/prepare` · `/confirm` · `/cancel` · `GET /internal/payments/{orderType}/{orderRef}` | catalog · concert | 결제 준비 · 승인 · 취소 · 상태 |
| concert `POST /internal/concerts/{id}/queue/rebuild` · `GET …/queue/metrics` | 운영(ops) | 대기열 복구 · 지표 |

토큰 오류: 401 `INTERNAL_TOKEN_REQUIRED` · `INTERNAL_TOKEN_INVALID` · `INTERNAL_TOKEN_EXPIRED`.

---

## 8. 관리자 API

### 8-1. Studio (관리자 화면이 부름)

- 주소: Studio 직접(KT · **배포 전**). 응답 봉투는 0-3과 같습니다.
- 로그인 2단계: `POST /api/studio/auth/login { loginId, password }` → `{ next: "OTP" | "OTP_ENROLL", otpauthUri?, secret? }` → `POST /api/studio/auth/otp { code }` → 쿠키 `STUDIO_SESSION`.
- `GET /api/studio/me` → `{ id, loginId, name, role, menus[{key, label}], permissions[], csrfToken }`. **`menus`에 있는 탭만** 그립니다.
- 상태를 바꾸는 요청에는 `X-CSRF-Token: <me.csrfToken>`. 권한 밖 API는 없는 경로와 같은 404입니다.

| 역할 | 탭(`menus.key`) | 경로 |
| --- | --- | --- |
| 전 역할 | — | `POST /api/studio/auth/login` · `/otp` · `/logout` · `GET /api/studio/me` · `PUT /api/studio/me/password` |
| `MASTER` | 전부 + `accounts` · `audit` | `GET`/`POST /api/studio/accounts` · `PATCH …/{id}` · `POST …/{id}/password-reset` · `…/otp-reset` · `GET /api/studio/audit-logs` |
| `STAGE` | `venues` | `GET`/`POST /api/studio/venues` · `GET …/{venueId}` · `…/{venueId}/layout` · `POST`/`GET …/{venueId}/stage-jobs` · `GET /api/studio/stage-jobs/{jobId}` · `…/image` · `POST …/confirm` |
| `CONCERT` | `concerts` | `GET`/`POST /api/studio/concerts` · `GET`/`PATCH …/{id}` · `PUT …/{id}/lineup` · `GET`/`POST …/{id}/seats` · `GET …/options/venues` · `…/options/venues/{venueId}/layout` · `…/options/artists` |
| `GOODS` | `products` | `GET /api/studio/products/goods` · `…/physical-albums` · `…/{id}` · `POST /api/studio/products` · `PATCH …/{id}` · `PUT …/{id}/options` · `POST …/options/{optionId}/stock` · `GET …/options/artists(/{artistId})` |
| `CS` | `cs` | `GET /api/studio/cs/members?q=` · `…/members/{userId}` · `…/{userId}/bookings` · `…/orders` · `…/payments` · `POST /api/studio/cs/bookings/{id}/cancel` · `…/orders/{id}/cancel` |
| `CHECKER` | `checkin` | `GET /api/studio/check-in/concerts` · `POST /api/studio/check-in/concerts/{id}` `{ token }` |

상세(요청 본문 · 오류 · 무대 그리기 흐름)는 studio-service `docs/v2_studio_service_re.md` 4 · 5 · 6 · 7장.

### 8-2. 각 서비스의 관리자 내부 API (`/internal/admin/**` · iss=`studio`만)

Studio가 본문을 그대로 넘기고 응답의 `result`만 꺼내 돌려줍니다. 헤더 `X-Admin-Id`(누가 시켰는지)가 붙습니다.

| 서비스 · 경로 | 요청 | 응답 · 규칙 |
| --- | --- | --- |
| member `GET /internal/admin/members?q=&size=` | `q` 1~255자 | `[{ userId, email, provider, nickname, profileImageUrl, createdAt }]` 최근 가입순 · 기본 20 · 최대 50. **이메일은 가림**(`ab***@…`). 회원 번호 · 이메일 일치 · 닉네임 부분 일치 |
| member `GET /internal/admin/members/{id}` |  | 같은 모양 · 이메일 전체 · 없으면 404 |
| catalog `POST /internal/admin/catalog/products` | `{ productType, name, thumbnailUrl?, purchaseUrl?, options: [{ name, vinylColor?, size?, price, qty? }] }` + 굿즈 `artistId` · `category` / 피지컬 `albumId` · `format` · `releasedAt?` | `ProductDetail`. `source=studio`. 굿즈는 `goods.released`, 피지컬은 발매일이 최근이거나 없을 때 `physical_album.released` |
| catalog `PATCH /internal/admin/catalog/products/{id}` | `{ name?, thumbnailUrl?, purchaseUrl?, category?, releasedAt? }` | 보낸 값만. 매체 · 앨범 · 아티스트는 못 바꿈 |
| catalog `PUT /internal/admin/catalog/products/{id}/options` | `{ options: [{ id?, name, vinylColor?, size?, price }] }` | `id`가 있으면 그 옵션을 고치고 이름도 바꿈. 없으면 이름으로 찾아 고치거나 새로(재고 0) |
| catalog `POST /internal/admin/catalog/options/{optionId}/stock` | `{ delta, reason }` | `{ optionId, qty, updatedAt }` · 0 아래로 내려가면 409 `OUT_OF_STOCK` |
| catalog `GET /internal/admin/catalog/users/{userId}/orders` | 커서 | 주문 목록 |
| catalog `POST /internal/admin/catalog/orders/{id}/cancel` | `{ reason }`(Studio 기록용) | 주문 상세. 회원 본인 취소와 같은 규칙 · 사유 `ADMIN_CANCEL` |
| concert `POST /internal/admin/concerts/venues` | `{ name, region, address, capacity }` | 공연장 |
| concert `POST /internal/admin/concerts` | `{ venueId, title, type, genre?, startsAt, endsAt, price?, bookingOpenAt, queueEnabled?, maxSeatsPerUser?, artistIds[], source?, externalId?, description?, terms?, requirements?, posterUrl?, imageUrls? }` | `ConcertDetail`. `SOLO`는 `genre`를 보내지 않음(아티스트 장르) · `source` · `externalId`는 함께 · 같은 값이 있으면 409 `CONFLICT` + `concertId` · 라인업 아티스트는 Catalog에서 복제된 아티스트여야 함 |
| concert `PATCH /internal/admin/concerts/{id}` | 위 필드 중 보낸 값만(`type` · 라인업 · 출처 제외) | `ConcertDetail` |
| concert `PUT /internal/admin/concerts/{id}/lineup` | `{ artistIds }` | 아티스트가 늘면 `concert.lineup_updated` |
| concert `PUT /internal/admin/concerts/venues/{venueId}/sections` | `{ venueId?, venueName?, floor, section: { name, shape, angle, rows, seatCount }, seats: [{ seatId, row, number, x, y, angle }] }` | `{ venueId, floorId, sectionId, seatCount }` · 쓰는 중인 구역은 409 `SECTION_IN_USE` |
| concert `GET /internal/admin/concerts/venues/{venueId}/layout` |  | `{ venueId, floors: [{ id, name, sections: [{ id, name, shape, angle, seats[] }] }] }` |
| concert `POST /internal/admin/concerts/{id}/seats` | `{ seats: [{ seatId, price }] }`(최대 20000) | `{ saved, skipped }` |
| concert `GET /internal/admin/concerts/users/{userId}/bookings` | 커서 | 예매 목록 |
| concert `POST /internal/admin/concerts/bookings/{id}/cancel` |  | 예매 상세. 회원 본인 취소와 같은 규칙 · 사유 `ADMIN_CANCEL` |
| concert `GET /internal/admin/concerts/check-in` |  | `[{ id, title, startsAt, venueName }]` 지금 검표할 수 있는 공연 |
| concert `POST /internal/admin/concerts/{id}/check-in` | `{ token, checkerId }` (Studio가 `checkerId`를 세션 관리자 id로 채움) | `{ bookingId, seats[], checkedInAt }` · 409 `WRONG_CONCERT` · `ALREADY_CHECKED_IN`(+`checkedInAt`) · `ENTRY_NOT_AVAILABLE` · 400 `ENTRY_QR_INVALID` · `ENTRY_QR_EXPIRED` |
| payment `GET /internal/admin/payments/users/{userId}` | 커서 | `[PaymentView]` |
- 관리자 토큰으로는 관리자 경로만 열립니다(결제 준비 · 토큰 발급 · 수집 경로 불가). 반대로 다른 서비스 토큰으로는 관리자 경로가 열리지 않습니다.
- 🔴 운영 NetworkPolicy가 catalog · member · payment로 가는 `app: studio`를 아직 허용하지 않습니다(KT 배포 때 · [v2_후속_작업](v2_후속_작업.md) 1-3).

---

## 9. 서명 경로 (`/ingest/**`)

수집기 · AI가 Gateway를 거쳐 내부 API를 부르는 경로입니다. **클러스터 안에서만**(ALB · Cloudflare 경유는 서명이 맞아도 404).

| 경로 | 키 묶음 | 넘기는 곳 |
| --- | --- | --- |
| `POST /ingest/catalog/artists` · `/albums` | 수집 키 `ingest.keys.*` | catalog `/internal/catalog/artists` · `/albums` (최대 500건) |
| `POST /ingest/catalog/diff` | 수집 키 | catalog `/internal/catalog/ingest/diff` (최대 1000건) |
| `GET /ingest/members/{userId}/metrics` | 회원 데이터 키 `ingest.member-keys.*` | member `/internal/members/{userId}/metrics` |
| `GET`/`PUT /ingest/members/{userId}/embedding` | 회원 데이터 키 | member `/internal/members/{userId}/embedding` |
- 헤더: 키 ID · 타임스탬프 · 논스 · 서명(HMAC-SHA256). 서명 문자열 = `메서드\n경로+쿼리\n타임스탬프\n논스\n본문 SHA-256(hex)`. 상세는 Gateway `IngestFilter`, [22](22_수집검증_관리자권한_감사로그.md) §1(이 절은 폐기 대상이 아닙니다).
- 오류: 401 `INGEST_*`(서명 · 키 · 논스 · 재전송 · 시각) · 408 `INGEST_BODY_TIMEOUT` · 413 · 415 · 매핑 밖 404 · 메서드 405.
- 11/13 삭제: `/ingest/ai/documents`(챗봇에 받는 곳 없음), 공연 수집 경로(공연은 Studio가 저장 · 관리자 검수 후).
- 🔴 운영 Gateway에 회원 데이터 키가 없어 `/ingest/members/**`는 전부 401입니다. 수집 키도 수집기가 생길 때 발급합니다.
- 수집 적재 본문(snake_case)은 catalog `docs/v2_catalog_service_re.md` 7.3. 이미지는 수집기가 S3에 올린 URL을 넣습니다.

---

## 10. Kafka 이벤트

운영은 토픽 자동 생성이 꺼져 있어 manifests `platform/kafka/topics-job.yaml`에 있는 토픽만 씁니다. 발행은 모두 outbox를 거칩니다.

| 토픽 | 발행 | 구독 | 용도 |
| --- | --- | --- | --- |
| `album.released` | catalog | member | 앨범 · EP · 싱글 발매 알림(발매 30일 이내만) |
| `physical_album.released` | catalog | member | 피지컬 앨범(새 옵션 포함) 알림 |
| `goods.released` | catalog | member | 굿즈 알림 |
| `order.confirmed` | catalog | member | 구매 완료 알림 · 콜렉션 자동 추가 |
| `order.refunded` | catalog | member | 환불 알림 |
| `artist.updated` | catalog | concert | 아티스트 복제(공연 라인업용) |
| `album.updated` | catalog | (없음) |  |
| `concert.created` · `concert.lineup_updated` | concert | member | 공연 · 라인업 추가 알림 |
| `booking.completed` · `booking.cancelled` | concert | member | 예매 · 취소 알림 |
| `queue.rebuild` | concert | concert | 대기열 복구 |
| `payment.completed` · `payment.failed` · `payment.cancelled` | payment | catalog · concert | 주문 · 예매 상태 반영(`payment.cancelled`의 `refunded`) |
| `user.withdrawn` | member | catalog · concert | 장바구니 · 결제 대기 주문 · 선점 정리 (챗봇은 아직 구독 안 함) |
| `member.activity` | member | (없음) | 팔로우 · 언팔로우 |

payload 필드는 member 문서 7장 “Kafka” · catalog 문서 8장.

---

## 11. 에러 코드

공통(모든 서비스): 400 `INVALID_REQUEST` · `INVALID_CURSOR` · 401 `UNAUTHENTICATED` · 404 `NOT_FOUND` · 405 `METHOD_NOT_ALLOWED` · 409 `CONFLICT` · 500 `INTERNAL_ERROR`.

| 서비스 | 코드 (HTTP) |
| --- | --- |
| Gateway | 401 `TOKEN_INVALID` · `TOKEN_EXPIRED` · `TOKEN_REVOKED` · `REFRESH_INVALID` · `REFRESH_REUSED` · `SIGNUP_EXPIRED` · `SIGNUP_INVALID` · 403 `CSRF_COOKIE_MISSING` · `CSRF_HEADER_MISSING` · `CSRF_MISMATCH` · 400 `REQUIRED_AGREEMENT_MISSING` · 409 `TERMS_OUTDATED` · 401 `INGEST_*` · 408 `INGEST_BODY_TIMEOUT` · 429 · 503(폴백) |
| member | 400 `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` · `INVALID_NICKNAME` · `REQUIRED_AGREEMENT_MISSING` · 404 `TERMS_NOT_FOUND` · 409 `ADDRESS_LIMIT_EXCEEDED` · `TERMS_OUTDATED` |
| catalog | 400 `INVALID_OPTION` · `SEARCH_QUERY_EMPTY` · `SEARCH_QUERY_TOO_LONG` · `BODY_DIGEST_MISMATCH` · 404 `ARTIST_NOT_FOUND` · `PRODUCT_NOT_FOUND` · `OPTION_NOT_FOUND` · 409 `OUT_OF_STOCK` · `CART_FULL` · 413 `PAYLOAD_TOO_LARGE` · 503 `PAYMENT_UNAVAILABLE` |
| concert | 409 `SEAT_TAKEN` · `SEAT_LOCKED` · `SEAT_LIMIT_EXCEEDED` · `HOLD_EXISTS` · `ALREADY_PAID` · `BOOKING_CANCELLED` · `BOOKING_NOT_CANCELLABLE` · `ALREADY_IN_QUEUE` · `QUEUE_NOT_OPEN` · `QUEUE_DISABLED` · `ENTRY_NOT_OPEN` · `ENTRY_CLOSED` · `ENTRY_NOT_AVAILABLE` · `WRONG_CONCERT` · `ALREADY_CHECKED_IN` · `SECTION_IN_USE` · 410 `HOLD_EXPIRED` · `QUEUE_CLOSED` · 403 `ENTRY_TOKEN_REQUIRED` · `ENTRY_TOKEN_INVALID` · `QUEUE_NOT_ADMITTED` · 404 `NOT_IN_QUEUE` · `SEAT_NOT_FOUND` · 400 `ENTRY_QR_INVALID` · `ENTRY_QR_EXPIRED` · 503 `PAYMENT_PENDING` · `PAYMENT_UNAVAILABLE` · `QUEUE_UNAVAILABLE` |
| payment | 400 `AMOUNT_MISMATCH` · 401 `INVALID_SIGNATURE` · 409 `ALREADY_CONFIRMED` · `PAYMENT_EXPIRED` · `PAYMENT_NOT_PENDING` · `PAYMENT_NOT_CANCELLABLE` · `IDEMPOTENCY_AMOUNT_MISMATCH` · `IDEMPOTENCY_USER_MISMATCH` · `USE_BOOKING_CONFIRM` · `USE_BOOKING_CANCEL` · 502 `PG_CANCEL_REJECTED` · 503 `PG_PROCESSING` · `PG_UNAVAILABLE` |
| Studio | 400 `PASSWORD_POLICY` · `PASSWORD_MISMATCH` · `STAGE_*` · 401 `LOGIN_FAILED` · `OTP_INVALID` · `OTP_CHALLENGE_EXPIRED` · 403 `CSRF_INVALID` · 409 `LOGIN_ID_TAKEN` · `CANNOT_CHANGE_SELF` · `STAGE_JOB_NOT_REVIEWABLE` · 413 · 502 `UPSTREAM_ERROR` · 503 `UPSTREAM_UNAVAILABLE` (Studio 문서 7장) |

---

## 12. enum 값

| 이름 | 값 |
| --- | --- |
| 장르 `Genre` (catalog · concert 공통 · 23개) | `INDIE_ROCK` · `ALTERNATIVE` · `GARAGE` · `PUNK` · `HARDCORE` · `EMO` · `METAL` · `POST_ROCK` · `SHOEGAZE` · `PSYCHEDELIC` · `INDIE_POP` · `DREAM_POP` · `SYNTH_POP` · `CITY_POP` · `FOLK` · `ELECTRONIC` · `RNB_SOUL` · `HIPHOP` · `JAZZ` · `BLUES` · `FUNK` · `SKA_REGGAE` · `ETC` |
| 지역 `Region` | `SEOUL` · `BUSAN` · `DAEGU` · `INCHEON` · `GWANGJU` · `DAEJEON` · `ULSAN` · `SEJONG` · `GYEONGGI` · `GANGWON` · `CHUNGBUK` · `CHUNGNAM` · `JEONBUK` · `JEONNAM` · `GYEONGBUK` · `GYEONGNAM` · `JEJU` |
| 공연 `type` · `saleStatus` | `SOLO` · `FESTIVAL` / `SCHEDULED` · `ON_SALE` · `CLOSED` |
| 앨범 `type` | `ALBUM` · `EP` · `SINGLE` |
| 피지컬 `format` | `LP` · `CD` · `CASSETTE` |
| 굿즈 `category` | `TSHIRT` · `OUTER` · `KEYRING` · `PICK` · `MUFFLER` · `SCARF` · `BAG` · `HAT` · `ETC` |
| 옵션 `vinylColor` · `size` | `BLACK` · `COLOR` / `XS` · `S` · `M` · `L` · `XL` · `XXL` · `FREE` |
| 트랙 `tempo` · `moods` | `SLOW` · `MID` · `FAST` · `VERY_FAST` / `DREAMY` · `DARK` · `BRIGHT` · `WARM` · `COLD` · `CALM` · `ENERGETIC` · `INTENSE` · `HEAVY` · `BOUNCY` · `GROOVY` · `URBAN` (`emotions` · `styles`는 catalog 문서 4장) |
| 주문 · 예매 상태 | `PENDING` · `CONFIRMED` · `CANCELLED` · `REFUNDED` / `PENDING` · `CONFIRMED` · `CANCELLED` · `EXPIRED` |
| 알림 `type` | `ALBUM_RELEASED` · `EP_RELEASED` · `SINGLE_RELEASED` · `PHYSICAL_ALBUM_RELEASED` · `GOODS_RELEASED` · `CONCERT_ANNOUNCED` · `PURCHASE_DONE` · `PURCHASE_REFUNDED` · `BOOKING_DONE` · `BOOKING_CANCELLED` |
| 알림 `target` | `ALBUM` · `PHYSICAL_ALBUM` · `GOODS` · `CONCERT` · `ORDER` · `BOOKING` |
| 메트릭 `targetType` | `ARTIST` · `ALBUM` · `TRACK` · `PHYSICAL_ALBUM` · `GOODS` · `CONCERT` |
| 메트릭 `metricType` | `DETAIL_VIEW` · `DWELL` · `PREVIEW_PLAY` · `SEARCH_CLICK` · `RECOMMEND_CLICK` · `CART_ADD` · `CART_REMOVE` · `SHARE` · `EXTERNAL_LINK_CLICK` |
| 약관 `code` | `AGE14` · `TOS` · `PRIVACY` · `PRIVACY_POLICY` · `MARKETING` |
| Studio 역할 | `MASTER` · `STAGE` · `CONCERT` · `GOODS` · `CS` · `CHECKER` |