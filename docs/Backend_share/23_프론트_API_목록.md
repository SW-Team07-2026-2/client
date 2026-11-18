# 23_프론트_API_목록

# 23. 프론트 제공 API 목록

> 2026-10-27 · ✏️ 11/01 입장 QR (N17 · §6-2 · QR 저장 폐지) · ✏️ 10/28 토스 결제 (§5) · ✏️ 10/28 배송지 (M19~M23 · §2-2 카카오 우편번호 · C9 `shipping`) · ✏️ 10/28 가입 = 카카오 싱크 → 밴드 체인 → G13 (§6-0 · 사인업 토큰 · X4) · ✏️ 11/05 **카카오 싱크 폐기 → 우리 약관 동의 화면** (M24 · G13 `agreements` · M17 · M18 구현) · 카카오 로그인만 · 본인인증 없음 · **구현된 코드 기준** (`backend/*/controller` · DTO) — 명세는 [15](15_API_명세.md) §11.1, ID(G·M·C·N·P)도 15 를 따릅니다.
✏️ 11/01 엔드포인트별 상세(타입 · 예시 JSON · 에러)는 [26 프론트 API 명세서](26_프론트_API_명세서.md) — 이 문서는 한 줄 요약표입니다.
✏️ 11/05 운영 배포 — `https://api.indig.co.kr` 가 응답합니다. 운영에 반영된 버전 · CORS · 카카오 로그인(✏️ 11/05 정규 앱 · 누구나)은 [26](26_프론트_API_명세서.md) 맨 위 🟢 표. 연동 개발은 지금처럼 **로컬 Gateway `http://localhost:8080`** — 로컬에서 운영 API 는 CORS · 쿠키 때문에 안 됩니다. 서비스 포트(8081~8084)로 직접 부르지 마세요 — 인증 헤더는 Gateway 만 붙입니다.
> 

---

## 0. 공통 규약

### 0-1. 호출 기본

| 항목 | 값 |
| --- | --- |
| Base URL | 로컬 `http://localhost:8080` · 운영 `https://api.indig.co.kr` (✏️ 11/05 배포) |
| 프론트 Origin (CORS 허용) | 로컬 `http://localhost:5173` · 운영 `https://indig.co.kr` 하나만 (`www` · `*.vercel.app` 은 403) |
| fetch 옵션 | **`credentials: 'include'`** 필수 — 인증이 전부 쿠키입니다 |
| 본문 | `Content-Type: application/json` · 최대 1 MiB |
| 날짜 | 날짜 `YYYY-MM-DD` · 시각 ISO-8601 오프셋 포함 (`2026-11-03T19:00:00+09:00`) |
| 금액 | 정수 (원) |

### 0-2. 인증 표기

| 표기 | 뜻 |
| --- | --- |
| 공개 | 로그인 없이 호출 가능 |
| 🔒 | 로그인 필요 (AT 쿠키). 없으면 401 |
| 🔒C | 로그인 + **`X-XSRF-TOKEN` 헤더** (값 = `XSRF-TOKEN` 쿠키 또는 G3 의 `xsrfToken`). 쿠키 없음 403 `CSRF_COOKIE_MISSING` · 헤더 없음 403 `CSRF_HEADER_MISSING` · 다르면 403 `CSRF_MISMATCH` (11/04) |

> POST · PUT · PATCH · DELETE 는 **전부 `X-XSRF-TOKEN`** 이 필요합니다 (로그아웃 · 재발급 포함).
> 

### 0-3. 쿠키 (Gateway 가 굽습니다)

| 쿠키 | JS 접근 | 수명 | 용도 |
| --- | --- | --- | --- |
| `AT` | ✗ HttpOnly | 30분 | 액세스 토큰 — 만료 5분 전부터 Gateway 가 **알아서 갱신** (응답 `Set-Cookie`) |
| `RT` | ✗ HttpOnly | 14일 | 리프레시 토큰 |
| `XSRF-TOKEN` | ✅ 읽기 가능 | — | CSRF 토큰 — 이 값을 `X-XSRF-TOKEN` 헤더로 되돌려 보냄 |

### 0-4. 응답 형식

```json
// 성공
{ "isSuccess": true,  "code": "OK", "message": "성공", "result": { ... } }
// 실패
{ "isSuccess": false, "code": "OUT_OF_STOCK", "message": "재고가 부족합니다", "correlationId": "..." }
```

- 아래 표의 **Response 는 `result` 의 모양**입니다.
- `204` 는 본문이 없습니다 (DELETE 일부).
- 실패 시 `code` 로 분기하고, `message` 는 그대로 사용자에게 보여줘도 됩니다. `correlationId` 는 버그 제보 때 백엔드에 전달.

### 0-5. 목록 응답 2종

| 이름 | 모양 | 요청 파라미터 | 쓰는 곳 |
| --- | --- | --- | --- |
| `PageResult<T>` | `{ items: T[], page, size, hasNext }` | `page` (0부터) · `size` (기본 20 · 최대 50) | 카탈로그 · 공연 목록 |
| `CursorPage<T>` | `{ items: T[], nextCursor, hasNext }` | `cursor` (처음엔 생략, 이후 `nextCursor`) · `size` (기본 20 · 최대 50) | 내 주문 · 예매 · 결제 · 피드 · 알림 · 팔로우 · 위시 · 보유 음반 |

### 0-6. 401 처리 순서 (권장)

```
보호 API 가 401 ─▶ POST /api/auth/refresh (1회)
                    ├─ 200 → 원래 요청 재시도
                    ├─ 401 REFRESH_INVALID · REFRESH_REUSED → 로그인 화면
                    └─ 503 → 쿠키 유지 · "잠시 후 다시" (로그아웃 아님)
```

---

## 1. 인증 — Gateway 자체 처리

| ID | 메서드 | 엔드포인트 | 설명 | 인증 | Request | Response (`result`) |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | GET | `/oauth2/authorization/{provider}` | 소셜 로그인 시작. `provider` = `kakao` (✏️ 10/28 카카오만 · Google 제거). **fetch 가 아니라 페이지 이동** (`location.href = ...`) | 공개 | — | 302 → 카카오 → 콜백(G2) → 기존 회원: 302 `http://localhost:5173/` + 쿠키 3종 · ✏️ 10/28 처음: 302 `http://localhost:5173/signup` + `SIGNUP` · `XSRF-TOKEN` 쿠키 (§6-0) · 실패 시 302 `/login` |
| G2 | GET | `/oauth2/code/{provider}` | OAuth 콜백 — **프론트가 부르지 않음** (카카오가 리다이렉트) | 공개 | — | — |
| G3 | GET | `/api/auth/me` | **로그인 상태 확인** + 내 정보 + CSRF 토큰. 앱 시작 시 1회 | 🔒 (비로그인 401 = 정상 분기) | — | `{ userId: string, nickname, profileImageUrl, roles: string[], xsrfToken, stale? }` · `stale: true` 면 Member 장애로 `nickname` · `profileImageUrl` 이 `null` (로그인은 유지) |
| G4 | POST | `/api/auth/logout` | 로그아웃 — 쿠키 삭제. 만료된 AT 로도 호출 가능 · 항상 200 | 공개 + C | — | `{ ok: true }` |
| G5 | POST | `/api/auth/refresh` | 수동 재발급 — 401 받았을 때 1회 (§0-6) | RT 쿠키 + C | — | 200 `{ ok: true }` + 새 쿠키 · 401 `REFRESH_INVALID` / `REFRESH_REUSED` · 503 |
| 🆕 G13 | POST | `/api/auth/signup` | ✏️ 10/28 **가입 완료** — 약관 동의 → 밴드 고르기 「완료」 · 「건너뛰기」. 회원 + 고른 밴드 팔로우 + ✏️ 11/05 약관 동의 이력(`user_terms`)을 한 번에 만들고 AT · RT 쿠키 발급 | `SIGNUP` 쿠키 + C | `{ artistIds: number[], agreements: { termsId, agreed }[] }` (건너뛰기 `[]` · 최대 50 · ✏️ 11/05 `agreements` = M24 약관 전부) | `{ userId: number, nickname, newUser: true }` · 401 `SIGNUP_EXPIRED` (쿠키 없음 · 30분 지남 · 이미 사용 · 다시 로그인함) · ✏️ 11/05 400 `REQUIRED_AGREEMENT_MISSING` · 409 `TERMS_OUTDATED` (→ M24 다시 · 토큰 그대로) |
| 로컬 | GET | `/dev/login?nickname=` | **로컬 전용 가짜 로그인** — 카카오 없이 (`local` 프로필에만 존재, 운영 404) · ✏️ 10/28 처음이면 카카오와 같이 `SIGNUP` 쿠키만 → G13 | 공개 | query `nickname` (기본 `로컬유저`) | 기존 회원 `{ userId, nickname, newUser: false, xsrfToken }` + 쿠키 3종 · 처음 `{ newUser: true, xsrfToken }` |

> G3 의 `userId` 는 **문자열**, M1 의 `userId` 는 **숫자**입니다.
> 

> ~~✏️ 10/27 — 처음 로그인하면 G1 이 홈이 아니라 약관 동의 화면 `/signup/terms?provider=kakao` 로 302 합니다 (쿠키 `SIGNUP` · `XSRF-TOKEN` 만). 그 화면에서 G13 을 보내야 가입이 끝납니다.~~
✏️ **11/05 — 카카오 싱크를 그만두고 정규 앱으로 바꿨습니다.** `/signup` 에 도착하면 **① 약관 동의(M24) → ② 밴드 고르기 → G13 `{ artistIds, agreements }`** 입니다. 사인업 토큰 · 302 `/signup` 은 아래 10/28 그대로입니다.
> 

> ~~✏️ **10/28 — 약관 동의는 카카오 싱크**(카카오 로그인 동의 화면)라 우리 약관 동의 화면이 없습니다.~~ **처음이면 콜백이 회원을 만들지 않고** 사인업 토큰(`SIGNUP` 쿠키 · HttpOnly · `Path=/api/auth/signup` · 30분)만 주고 `/signup` 으로 302 합니다 — 프론트는 **도착한 주소가 `/signup` 이면 가입 화면**(✏️ 11/05 약관 동의부터)을 띄웁니다(토큰은 읽을 수 없음). 가입 화면에선 아직 회원이 아니라 G3 은 401 이고, 🔒 API 는 부를 수 없습니다(M24 · X4 는 공개). G13 이 끝나야 AT · RT 가 생깁니다. 흐름은 §6-0.
> 

---

## 2. 회원 — Member (`/api/members/**`)

| ID | 메서드 | 엔드포인트 | 설명 | 인증 | Request | Response (`result`) |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | GET | `/api/members/me` | 내 프로필 + 카운트 (마이페이지) | 🔒 | — | `{ userId: number, nickname, profileImageUrl, email, provider: KAKAO\|GOOGLE, followCount, wishlistCount, collectionCount }` |
| M2 | PATCH | `/api/members/me` | 닉네임 수정 | 🔒C | `{ nickname }` — 공백 없이 2~10자 | `{ userId, nickname }` · 400 `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` · `INVALID_NICKNAME`(공백 · 금칙어) |
| M4 | POST | `/api/members/follows/{artistId}` | 아티스트 팔로우 | 🔒C | — | `{ artistId, following: true }` |
| M5 | DELETE | `/api/members/follows/{artistId}` | 언팔로우 | 🔒C | — | 204 |
| M6 | GET | `/api/members/follows` | 팔로우 목록 | 🔒 | `?cursor=&size=` | `CursorPage<{ artistId, followedAt }>` — **이름 없음** → C2 `?ids=` 로 조회 |
| M7 | GET | `/api/members/follows/{artistId}` | 팔로우 여부 (아티스트 상세의 버튼 상태) | 🔒 | — | `{ following: boolean }` |
| M8 | GET | `/api/members/feed` | 피드 — 팔로우한 아티스트 소식 + 내 예매 | 🔒 | `?cursor=&size=` | `CursorPage<FeedItem>` (§2-1) |
| M9 | GET | `/api/members/notifications` | 알림 목록 | 🔒 | `?cursor=&size=` | `CursorPage<FeedItem + read: boolean>` |
| M10 | GET | `/api/members/notifications/badge` | 안 읽은 알림 수 | 🔒 | — | `{ count }` — 최대 99 (UI 는 `99+`) |
| M11 | POST | `/api/members/notifications/read` | 알림 **전부** 읽음 처리 | 🔒C | — | `{ ok: true }` |
| M12 | GET | `/api/members/wishlist` | 위시리스트 | 🔒 | `?cursor=&size=` | `CursorPage<{ productId, createdAt }>` — 상품 정보는 C8b `?ids=` 로 |
| M13 | POST | `/api/members/wishlist/{productId}` | 위시 추가 | 🔒C | — | `{ productId, wished: true }` |
| M14 | DELETE | `/api/members/wishlist/{productId}` | 위시 삭제 | 🔒C | — | 204 |
| M15 | GET | `/api/members/collections` | 보유 음반 목록 | 🔒 | `?cursor=&size=` | `CursorPage<CollectionItem>` (§2-1) |
| 추가 | GET | `/api/members/collections/{id}` | 보유 음반 1건 *(15 에 없음 · 구현에 추가)* | 🔒 | — | `CollectionItem` |
| M16 | POST | `/api/members/collections` | 보유 음반 직접 등록 | 🔒C | `{ albumId: number, acquiredAt?: "YYYY-MM-DD" }` | `CollectionItem` |
| 🆕 M19 | GET | `/api/members/me/addresses` | ✏️ 10/28 배송지 목록 (MY › 배송지 · 결제 화면) — 기본이 맨 앞 | 🔒 | — | `{ items: ShippingAddress[] }` (§2-1 · 최대 10개라 페이지 없음) |
| 🆕 M20 | POST | `/api/members/me/addresses` | ✏️ 10/28 배송지 추가 (MY · 결제 화면의 새 주소 — 첫 결제 때 기본으로) | 🔒C | `ShippingAddressInput` (§2-1) | `ShippingAddress` — 첫 배송지는 자동으로 `isDefault: true` · 409 `ADDRESS_LIMIT_EXCEEDED` (10개) · 400 형식 오류 |
| 🆕 M21 | PUT | `/api/members/me/addresses/{id}` | ✏️ 10/28 배송지 수정 (전체 교체) | 🔒C | `ShippingAddressInput` | `ShippingAddress` · 404 (남의 · 없는 id) |
| 🆕 M22 | POST | `/api/members/me/addresses/{id}/default` | ✏️ 10/28 기본 배송지로 지정 (다른 기본은 자동 해제) | 🔒C | — | `ShippingAddress` |
| 🆕 M23 | DELETE | `/api/members/me/addresses/{id}` | ✏️ 10/28 배송지 삭제 — 기본을 지우면 가장 최근 배송지가 기본 (M19 다시 부르기) | 🔒C | — | 204 |
| 🆕 M24 | GET | `/api/members/terms` | ✏️ 11/05 **약관 4개** (가입 ① 약관 동의) — 코드마다 현재 버전 하나 · 화면 순서 | **공개** (가입 전) | — | `{ items: { termsId, code: AGE14\|TOS\|PRIVACY\|MARKETING, version, title, content(마크다운), required }[] }` |
| 🆕 M25 | GET | `/api/members/terms/{code}` | ✏️ 11/06 **문서 하나의 현재 버전** (푸터 — 이용약관 `TOS` · 개인정보처리방침 `PRIVACY_POLICY`) | **공개** | — | `{ termsId, code, version, title, content(마크다운), required }` · 없는 code 400 `INVALID_REQUEST` · 404 `TERMS_NOT_FOUND` |
| 🆕 M17 | GET | `/api/members/me/agreements` | ✏️ 11/05 ✅ 구현 — MY › 약관 · 동의 (약관마다 마지막 기록) | 🔒 | — | `{ items: { termsId, code, version, title, required, agreed, at }[] }` |
| 🆕 M18 | PUT | `/api/members/me/agreements/marketing` | ✏️ 11/05 ✅ 구현 — 마케팅 수신 켜고 끄기 · 이력 1행 · 화면에 처리 날짜(`at`) 안내 | 🔒C | `{ agreed: boolean }` | `{ agreed, at }` |

### 2-1. 응답 객체

| 객체 | 필드 |
| --- | --- |
| `FeedItem` | `id` · `type` · `artistId?` · `refId` · `title` · `thumbnailUrl` · `occurredAt` · (`read` — 알림 목록만) |
| `FeedItem.type` → `refId` | `ALBUM_RELEASED` → albumId · `CONCERT_OPENED` → concertId · `RESTOCKED` → productId · `BOOKING_DONE` → bookingId |
| `CollectionItem` | `id` · `albumId` · `source: MANUAL\|PURCHASE` (PURCHASE = 구매로 자동 등록) · `acquiredAt` |
| 🆕 `ShippingAddress` | `id` · `label?` (집 · 회사) · `recipientName` · `phone` · `zonecode` · `address` · `addressDetail?` · `isDefault` |
| 🆕 `ShippingAddressInput` | `label?` (20자) · `recipientName` (필수 · 20자) · `phone` (필수 · `0` 시작 · 하이픈 선택 · 예 `010-1234-5678`) · `zonecode` (필수 · 숫자 5자리) · `address` (필수 · 200자) · `addressDetail?` (100자) · `isDefault?` (true 면 기본으로) |

### 🆕 2-2. 주소 검색 — 카카오 우편번호 서비스 (10/28)

키 · 가입 없이 쓰는 무료 스크립트입니다. **주소 검색은 프론트에서 끝나고 서버로는 결과 값만 보냅니다** (서버는 형식만 검사 — 우편번호 5자리 등).

```html
<script src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
```

```jsx
new daum.Postcode({            // 스크립트가 window.daum 과 window.kakao 를 같은 객체로 둡니다
  oncomplete(data) {
    form.zonecode = data.zonecode;                                              // "04043"
    form.address  = data.userSelectedType === "J" ? data.jibunAddress : data.roadAddress;   // 사용자가 고른 쪽
    focus(addressDetail);                                                       // 상세 주소는 사용자가 입력
  },
}).open();                                                                      // 팝업 · 모바일은 .embed(el) 로 레이어
```

- `zonecode` · `address` 입력칸은 **읽기 전용**으로 두고 「주소 검색」 버튼으로만 채웁니다 (손으로 친 주소는 우편번호가 맞지 않습니다).
- 받는 분 · 연락처는 사용자가 입력합니다.
- 결제 화면은 M19 의 기본 배송지를 미리 고른 상태로 보여 주고, 「변경」 → 목록에서 고르기 · 「새 주소」 → 위 검색 + M20 (저장 체크 시) 순서입니다.

---

## 3. 카탈로그 — Catalog (`/api/catalog/**`)

| ID | 메서드 | 엔드포인트 | 설명 | 인증 | Request | Response (`result`) |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | GET | `/api/catalog/search` | 키워드 검색 (아티스트 · 앨범 · 수록곡) | 공개 | `?q=` (1~50자, 필수) `&size=` | `{ items: [{ type: ARTIST\|ALBUM\|TRACK, id, title, albumId?, score }] }` — `TRACK` 이면 `albumId` 로 이동 · 장애 시 `{ items: [], degraded: true }` |
| C2 | GET | `/api/catalog/artists` | 아티스트 목록 | 공개 | `?q=&genre=&ids=1,2,3&page=&size=` — `ids` 일괄 조회 (최대 50) | `PageResult<ArtistItem>` |
| C3 | GET | `/api/catalog/artists/{id}` | 아티스트 상세 — 멤버 · 앨범 · LP · 굿즈 포함 | 공개 | — | `{ id, name, genre, label, debutYear, profileUrl, members: [{ name, role }], albums: AlbumItem[], lps: LpItem[], goods: GoodsItem[] }` · 404 `ARTIST_NOT_FOUND` |
| C4 | GET | `/api/catalog/albums` | 앨범 목록 (신보순) | 공개 | `?type=ALBUM\|EP\|SINGLE&page=&size=` | `PageResult<AlbumItem>` |
| C5 | GET | `/api/catalog/albums/{id}` | 앨범 상세 — 트랙 · LP · CD 판매 정보 | 공개 | — | `{ ...AlbumItem, tracks: [{ trackNo, title }], lps: LpItem[], cd: { productId, price, purchaseUrl } \| null }` |
| C6 | GET | `/api/catalog/lps` | LP 목록 | 공개 | `?from=YYYY-MM-DD&to=YYYY-MM-DD&page=&size=` (발매일) | `PageResult<LpItem>` |
| C7 | GET | `/api/catalog/goods` | 굿즈 목록 | 공개 | `?artistId=&page=&size=` | `PageResult<GoodsItem>` |
| C8 | GET | `/api/catalog/products/{id}` | 판매 상품 — **현재 가격 · 재고** (캐시 안 함 · 구매 직전 확인용) | 공개 | — | `ProductView` · 404 `PRODUCT_NOT_FOUND` |
| C8b | GET | `/api/catalog/products` | 상품 일괄 조회 *(15 에 없음 · 위시리스트 화면용으로 추가)* | 공개 | `?ids=1,2,3` (필수 · 최대 50) | `PageResult<ProductView>` (한 페이지로 끝남) |
| C9 | POST | `/api/catalog/orders` | **주문 생성** — 재고 차감 + 결제 준비. 다음 단계는 토스 결제창 → P1 | 🔒C | `{ items: [{ productId, qty }], shipping: { recipientName, phone, zonecode, address, addressDetail? } }` — ✏️ 11/01 정정: 최대 20종 · 상품당 qty 1~10 · 같은 상품 중복 불가 (`catalog.order.max-items · max-qty`) · **금액은 보내지 않음** · ✏️ 10/28 `shipping` **필수** = 고른 `ShippingAddress` 의 값 그대로 (id 아님 · `label` · `isDefault` 빼고 · 없으면 400) | `{ orderId, amount, pgOrderId, status: PENDING, expiresAt }` — ✏️ 10/28 `pgOrderId` = 토스 SDK 의 `orderId` · 409 `OUT_OF_STOCK` · 503 `PAYMENT_UNAVAILABLE` |
| C10 | GET | `/api/catalog/orders` | 내 주문 목록 | 🔒 | `?cursor=&size=` | `CursorPage<{ orderId, status, totalPrice, createdAt }>` |
| C11 | GET | `/api/catalog/orders/{id}` | 주문 상세 (본인 것만 · 남의 주문은 404) | 🔒 | — | `{ orderId, status, totalPrice, pgOrderId, createdAt, shipping, items: [{ productId, name, qty, price }] }` — ✏️ 10/28 `shipping` = 주문 당시 배송지 (배송지를 나중에 고쳐도 그대로 · 10/28 이전 주문은 `null`) |
| C12 | POST | `/api/catalog/orders/{id}/cancel` | 주문 취소 — 재고 복구 | 🔒C | — | C11 과 같은 모양 |

### 3-1. 응답 객체

| 객체 | 필드 |
| --- | --- |
| `ArtistItem` | `id` · `name` · `genre` · `debutYear` · `profileUrl` |
| `AlbumItem` | `id` · `artistId` · `artistName` · `title` · `type: ALBUM\|EP\|SINGLE` · `releasedAt` · `thumbnailUrl` |
| `LpItem` | `id` · `albumId` · `albumTitle` · `artistId` · `artistName` · `pressType` · `releasedAt` · `thumbnailUrl` · `productId?` · `price?` — **판매 안 하면 `productId` · `price` 가 `null`** |
| `GoodsItem` | `id` · `artistId` · `artistName` · `name` · `category` · `productId?` · `price?` · `thumbnailUrl` — 판매 안 하면 `null` |
| `ProductView` | `id` · `productType: LP\|CD\|GOODS` · `refId` (LP · 앨범 · 굿즈 id) · `name` · `price` · `thumbnailUrl` · `purchaseUrl` · `qty` · `soldOut` · `stockUpdatedAt` (“n시간 전 갱신” 표시용) |
| 주문 `status` | `PENDING` (결제 대기) · `CONFIRMED` · `CANCELLED` |

---

## 4. 공연 · 예매 — Concert (`/api/concerts/**`)

| ID | 메서드 | 엔드포인트 | 설명 | 인증 | Request | Response (`result`) |
| --- | --- | --- | --- | --- | --- | --- |
| N1 | GET | `/api/concerts` | 공연 목록 — 기간 · 지역 · 장르 · 유형 · 아티스트 필터 | 공개 | `?from=&to=` (YYYY-MM-DD) `&region=&genre=&type=SOLO\|FESTIVAL&artistId=&page=&size=` | `PageResult<ConcertSummary>` |
| N2 | GET | `/api/concerts/{id}` | 공연 상세 — **`queueEnabled` 로 대기열 여부 판단** | 공개 | — | `{ ...ConcertSummary, bookingOpenAt, queueEnabled, venue: VenueView }` |
| N3 | GET | `/api/concerts/calendar` | 월별 캘린더 | 공개 | `?month=YYYY-MM` (필수) `&artistIds=1,2` | `{ month, days: [{ date, concerts: ConcertSummary[] }] }` |
| N14 | GET | `/api/concerts/venues` | 공연장 목록 | 공개 | `?region=&q=&hasUpcoming=true\|false&page=&size=` | `PageResult<VenueView>` |
| N15 | GET | `/api/concerts/venues/{id}` | 공연장 상세 + 예정 공연 | 공개 | — | `{ ...VenueView, upcomingConcerts: [{ id, title, type, artistId, artistName, startsAt, saleStatus }] }` |
| N4 | POST | `/api/concerts/{id}/queue` | **대기열 진입** (`queueEnabled` 공연만) | 🔒C | — | `QueueStatus` (WAITING) · 409 `QUEUE_NOT_OPEN` / `ALREADY_IN_QUEUE` / `QUEUE_DISABLED` · 410 `QUEUE_CLOSED` · 503 `QUEUE_UNAVAILABLE` (`result.retryAfterMs` 후 재시도) |
| N5 | GET | `/api/concerts/{id}/queue/status` | 순번 조회 — **`pollAfterMs` 간격으로 폴링** (하트비트 겸용 · **15초 넘게 끊긴 채로 차례가 오면 입장 못 하고 빠짐**) | 🔒 | — | `QueueStatus` · 404 `NOT_IN_QUEUE` |
| N6 | DELETE | `/api/concerts/{id}/queue` | 대기열 이탈 (페이지 나갈 때) — 🔴 **대기 화면에 “화면을 나가면 순번이 사라집니다” 안내 필수.** 앱을 백그라운드로 보내도 폴링이 멈춰 15초 뒤 빠집니다 (FR-CON-24) | 🔒C | — | 204 |
| N7 | GET | `/api/concerts/{id}/seats` | 좌석 배치 · 상태 | 🔒 | — | `{ concertId, total, available, seats: [{ id, section, row, number, price, status: AVAILABLE\|HELD\|SOLD }] }` — ✏️ 11/04 77A **빈 좌석 · 선점(결제 중) · 판매**. `HELD` · `SOLD` 는 회색 — 고를 수 없음 (~~10/27 `CONTESTED` 경합~~ 삭제). `available` = SOLD 아닌 좌석 수 |
| ~~N8~~ · ~~N9~~ | — | `~~/api/concerts/{id}/seats/hold~~` | ✏️ 10/27 **폐지** — 좌석은 고를 때 잡지 않습니다. 좌석 선택은 N10 하나로 | — | — | — |
| N10 | POST | `/api/concerts/{id}/bookings` | **좌석 선택(선택완료 버튼)** = 예매 생성 + 결제 준비. 다음 단계는 **N16**. ✏️ 11/04 77A **좌석 선점** — 고르는 순간 한 명만 잡음 · 선점 중 **다른 좌석은 409 `HOLD_EXISTS`** (N13 으로 풀고 다시) · 같은 좌석 재요청 = 같은 선점 (멱등 · 뒤로가기 후 다시 눌러도 안전 · **`expiresAt` 그대로**) | 🔒C + `X-Entry-Token`* | `{ seatId }` — **금액은 보내지 않음** | `{ bookingId, amount, pgOrderId, status: PENDING, expiresAt, expiresIn }` — `expiresAt`(✏️ 11/04 77A 선점 뒤 8분 · 서버 +60초 · 남은 초 `expiresIn`) 안에 토스 결제창 → N16 · 409 `SEAT_TAKEN` (남이 선점 · 판매) / `HOLD_EXISTS` (`result.bookingId`) / `SEAT_LIMIT_EXCEEDED` (확정 예매가 있음) / `ALREADY_PAID` · 403 `ENTRY_TOKEN_REQUIRED` · `QUEUE_NOT_ADMITTED` · `ENTRY_TOKEN_INVALID` · 503 `PAYMENT_UNAVAILABLE` · `QUEUE_UNAVAILABLE` (✏️ 11/04 코드 대조) |
| 🆕 N16 | POST | `/api/concerts/bookings/{id}/confirm` | ✏️ 10/27 **티켓 결제 승인** (결제하기 버튼) — ✏️ 11/04 77A 서버가 내 선점을 결제 중으로 바꾼 뒤 결제를 승인. **선점 시간이 지났으면 돈이 나가기 전에 410** | 🔒C | `{ paymentKey, amount }` — ✏️ 10/28 `paymentKey` = 토스 successUrl 의 값 · `amount` = N10 의 값 | `{ bookingId, status: CONFIRMED\|PENDING\|EXPIRED, paymentStatus: APPROVED\|DECLINED, reason?, pgOrderId? }` (✏️ 11/04 80B 거절 = `PENDING` + 새 `pgOrderId` · 선점 유지) · 410 `HOLD_EXPIRED` (선점 시간 지남 → 다시 고르기 · 돈 안 나감) · 409 `BOOKING_CANCELLED` / `ALREADY_PAID` / `SEAT_LOCKED` (연타) · 400 `AMOUNT_MISMATCH` · 503 `PAYMENT_PENDING` (결과 확인 중 → N12 로 상태 확인) |
| N11 | GET | `/api/concerts/bookings` | 내 예매 목록 | 🔒 | `?cursor=&size=` | `CursorPage<{ bookingId, status, totalPrice, createdAt, concertId, concertTitle, startsAt }>` |
| N12 | GET | `/api/concerts/bookings/{id}` | 예매 상세 (본인 것만) | 🔒 | — | `{ bookingId, status, totalPrice, pgOrderId, createdAt, expiresAt, concert: { id, title, startsAt, venueName }, seats: [{ id, section, row, number, price }] }` |
| N13 | POST | `/api/concerts/bookings/{id}/cancel` | 예매 취소 — 좌석 반환 · **결제된 티켓 환불도 여기서만** (P4 는 409) | 🔒C | — | N12 와 같은 모양 · 409 `BOOKING_NOT_CANCELLABLE` |
| 🆕 N17 | GET | `/api/concerts/bookings/{id}/entry-qr` | ✏️ 11/01 **입장 QR** — 모바일 티켓을 연 동안 **20초마다** 부르고 `token` 을 그대로 QR 로 그립니다 (30초 뒤 무효 · 캡처본은 검표에서 거절). 공연 시작 3시간 전부터 | 🔒 | — | `{ token, expiresAt }` · 409 `ENTRY_NOT_OPEN`(`result.opensAt` — “HH:mm 부터 열려요”) / `ENTRY_CLOSED` / `ALREADY_CHECKED_IN`(`result.checkedInAt` — “입장 완료”) / `ENTRY_NOT_AVAILABLE` |
- `X-Entry-Token` 은 **`queueEnabled: true` 공연만** 필요합니다 — N5 가 `ADMITTED` 일 때 준 `entryToken` 값.

### 4-1. 응답 객체

| 객체 | 필드 |
| --- | --- |
| `ConcertSummary` | `id` · `title` · `type: SOLO\|FESTIVAL` · `artistId` · `artistName` · `artistGenre` · `startsAt` · `price` · `saleStatus: SCHEDULED\|ON_SALE\|CLOSED` · `venue: { id, name, region }` |
| `VenueView` | `id` · `name` · `region` · `address` · `capacity` |
| `region` 값 | `SEOUL` `BUSAN` `DAEGU` `INCHEON` `GWANGJU` `DAEJEON` `ULSAN` `SEJONG` `GYEONGGI` `GANGWON` `CHUNGBUK` `CHUNGNAM` `JEONBUK` `JEONNAM` `GYEONGBUK` `GYEONGNAM` `JEJU` |
| `QueueStatus` (WAITING) | `state: "WAITING"` · `rank` · `total` · `etaSeconds` · `pollAfterMs` · `degraded?` (true = 대기열 복구 중 · 순번은 근사치) |
| `QueueStatus` (ADMITTED) | `state: "ADMITTED"` · `entryToken` · `expiresIn` (초 · 최대 10분 — 이 안에 좌석 선택 · 결제) |
| `QueueStatus` (EXPIRED) | `state: "EXPIRED"` — 다시 N4 |
| 예매 `status` | `PENDING` (결제 대기) · `CONFIRMED` · `CANCELLED` · `EXPIRED` (결제 시간 초과) |

---

## 5. 결제 — Payment (`/api/payments/**`)

> ~~⚠️ 지금은 **모의 PG** 입니다 — 실제 PG 결제창(SDK) 없이 P1 만 부르면 승인됩니다.~~
✏️ 10/28 **토스페이먼츠 테스트 환경** — 결제창 인증은 토스 SDK 로, 승인은 P1 · N16 으로 합니다. 테스트 키라 **실제 카드 번호를 넣어도 돈이 나가지 않습니다.**
> 
> 1. SDK: `<script src="https://js.tosspayments.com/v2/standard">` · `TossPayments(clientKey)` — 클라이언트 키 `test_gck_…` (개발자센터 API 키 › 주문서형·결제창형 연동 키 · 전자결제 신청 전이라 안 보이면 [토스 주문서형 연동 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration)의 문서용 테스트 키 — 개발자센터에서 결제 내역은 못 봄). **시크릿 키는 프론트에 두지 않습니다** (`VITE_*` 등 공개 변수도 금지).
> 2. 주문서형: `widgets({ customerKey: TossPayments.ANONYMOUS })` → `setAmount({ currency: "KRW", value: amount })` → `renderPaymentMethods` · `renderAgreement` → `requestPayment({ orderId: pgOrderId, orderName, successUrl, failUrl })`. `amount` 는 C9 · N10 응답 값 그대로 (바꾸면 400 `AMOUNT_MISMATCH`). `customerKey` 에 회원 ID · 이메일을 넣지 마세요 (토스 규칙 — 서버가 customerKey 를 만들지 않으므로 `ANONYMOUS`).
> 3. successUrl 로 `?paymentKey&orderId&amount` 가 붙어 돌아옵니다 → **10분 안에** P1(굿즈) · N16(티켓). failUrl(`?code&message`)이면 승인 API 를 부르지 말고 메시지와 **다시 결제** 버튼을 보여줍니다 (같은 `pgOrderId` · `amount` 로 다시 `requestPayment`).
> 4. 가상계좌는 받지 않습니다 (입금 대기 결제는 `DECLINED`) — 결제 UI 설정에서 빼주세요.
> 5. 테스트 키로는 **카카오페이**(계약 후 상점 테스트 키만) · **페이코**(라이브 키만)가 결제되지 않습니다 — 시연은 카드 · 토스페이로.
> 
> 동작하는 예시: `backend/local/toss-test/index.html` (15 §5.1)
> 

| ID | 메서드 | 엔드포인트 | 설명 | 인증 | Request | Response (`result`) |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | POST | `/api/payments/confirm` | **결제 승인** — 서버가 준비된 금액과 대조 | 🔒C | `{ paymentKey, orderId, amount }` — ✏️ 10/28 **successUrl 쿼리 세 개 그대로** (`orderId` = C9 의 `pgOrderId` · C9 의 `orderId` 아님). ✏️ 10/27 **굿즈 전용** — 티켓은 N16 (P1 으로 보내면 409 `USE_BOOKING_CONFIRM`) | `PaymentView` (`status: APPROVED \| DECLINED` · 거절 `reason` = 토스 에러 코드) · 400 `AMOUNT_MISMATCH` · 404 (남의 · 없는 `orderId`) · 503 `PG_UNAVAILABLE` · `PG_PROCESSING` (결과 확인 중 → P2 로 상태 확인) · 409 `ALREADY_CONFIRMED` / `PAYMENT_EXPIRED` / `PAYMENT_NOT_PENDING` / `USE_BOOKING_CONFIRM` |
| P2 | GET | `/api/payments/me` | 내 결제 내역 | 🔒 | `?cursor=&size=` | `CursorPage<PaymentView>` |
| P3 | GET | `/api/payments/{id}` | 결제 상세 (본인 것만) | 🔒 | — | `PaymentView` |
| P4 | POST | `/api/payments/{id}/cancel` | 결제 취소 · 환불 (**굿즈만**) | 🔒C | `{ reason? }` (본문 생략 가능 · 100자) | `PaymentView` · 409 `USE_BOOKING_CANCEL` (티켓 → N13) / `PAYMENT_NOT_CANCELLABLE` |

| 객체 | 필드 |
| --- | --- |
| `PaymentView` | `paymentId` · `orderType: GOODS\|TICKET` · `orderRef` · `amount` · `status: PENDING\|APPROVED\|DECLINED\|CANCELLED` · `method?` · `reason?` (거절 · 취소 사유) · `requestedAt` · `completedAt?` |

> 🧪 거절 화면 테스트: P1 · N16 에 헤더 `X-Force-Decline: REJECT_CARD_PAYMENT` → `DECLINED` — ✏️ 10/28 토스가 그 에러를 재현합니다 (값은 토스 에러 코드 · 테스트 키 전용). ✏️ 11/04 **로컬 백엔드에서만** — 운영 서버는 이 헤더를 무시합니다.
> 

---

## 6. 화면 흐름

### ✏️ 6-0. 가입 (10/28 — 밴드 체인 · 사인업 토큰 · ✅ G13 구현 · ✏️ 11/05 우리 약관 동의 화면)

```
G1 (페이지 이동) → 카카오 동의 화면 (닉네임 · 이메일 — ✏️ 11/05 약관 없음) → G2
 ├─ 기존 회원 → 302 /  (AT · RT · XSRF 쿠키)
 └─ 처음     → 회원 아직 없음 → 302 /signup  (SIGNUP · XSRF 쿠키)
     ✏️ 11/05 ① 약관 동의 — M24 → [필수] 만 14세 · 이용약관 · 개인정보 · [선택] 마케팅 (필수를 다 체크해야 「다음」 · 서버 호출 없음)
     ② 밴드 고르기
     X4 첫 세트 { items }                           ← 화면에 보여 준 id 를 shown 에 모음
     밴드를 누를 때마다 (화면에서만 선택 · 서버 호출 없음 — 아직 회원이 아니라 M4 불가)
       └─ 처음 누른 밴드면 X4 ?artistId={id}&exclude={shown}&size=3 → 아래에 「○○와 비슷한 밴드」 섹션 · shown 에 추가
     「완료」 · 「건너뛰기」 → G13 POST /api/auth/signup { artistIds: [고른 id…], agreements: [{ termsId, agreed }…] }  (X-XSRF-TOKEN)
       ├─ 200 → 회원 + 팔로우 + 동의 이력 · AT · RT 쿠키 → 홈 (G3 다시 호출)
       ├─ 409 TERMS_OUTDATED → M24 다시 → ① 부터 (✏️ 11/05)
       └─ 401 SIGNUP_EXPIRED → "가입 시간이 지났어요" → G1 다시
```

- **중복 방지는 `exclude`** — 첫 세트와 지금까지 받은 비슷한 밴드 id 를 전부 보냅니다. 서버는 저장하지 않고(무상태) 요청마다 `exclude` 를 빼고 top-k 를 채웁니다. 새로고침하면 체인은 처음부터입니다.
- 같은 밴드를 껐다 켜도 섹션을 다시 받지 않습니다. 빈 배열이면 “새로 보여 드릴 비슷한 밴드가 없어요”.
- 장르는 묻지 않습니다 (MY › 취향 설정). 배송지도 묻지 않습니다 (첫 결제 때 — §6-1). 본인인증도 없습니다 (✏️ 10/28 폐기 — 결제자 확인은 결제창).
- 가입 중간에 나가면 아무것도 저장되지 않습니다. 30분 안에 다시 로그인하면 새 사인업 토큰으로 처음부터 (이전 토큰은 무효).
- 푸터(사업자 정보 · 약관 링크 · 굵은 개인정보처리방침)는 가입 단계 · 관리자 화면 말고 모든 화면에 둡니다. ~~약관 본문 정적 파일 `/terms/{tos|privacy|marketing}/{version}` 은 카카오 싱크 약관 설정에 등록하는 URL 이기도 합니다.~~ ✏️ 11/05 약관 본문은 M24 `content` (DB `member.terms`) — 정적 파일 · 카카오 등록 없음. ✏️ 11/06 푸터 「이용약관」 · 「개인정보처리방침」은 M25 (`TOS` · `PRIVACY_POLICY`) — 처리방침은 가입 동의서 `PRIVACY` 와 다른 문서입니다.
- 10/27 설계 (약관 동의 화면 · G13 { agreements } · 가입 티켓) — 카카오 싱크 · 사인업 토큰으로 대체
    
    ```
    G1 → 카카오 · Google → G2 → 처음이면 302 /signup/terms (SIGNUP · XSRF 쿠키 · 회원 아직 없음)
      약관 동의 화면 → G13 { agreements } → 200 장르 → 밴드 / 401 SIGNUP_EXPIRED / 409 TERMS_OUTDATED
    ```
    

### 6-1. 굿즈 · 음반 구매

```
C8  상품 확인 (가격 · 재고)
M19 배송지 — 기본 배송지를 미리 선택 · 「변경」 목록 · 「새 주소」 §2-2 (+ 저장하면 M20)      ← ✏️ 10/28
    (배송지가 없으면 = 첫 결제: 입력칸만 → 그 주소를 M20 { …, isDefault: true } 로 저장 · 저장 체크 없음)
 └▶ C9  주문 생성 { items, shipping } → { orderId, amount, pgOrderId, expiresAt }
     └▶ 토스 SDK requestPayment({ orderId: pgOrderId, … }) → successUrl?paymentKey&orderId&amount   (failUrl → 메시지 · 다시 결제)
         └▶ P1  { paymentKey, orderId, amount }   ← successUrl 값 그대로 · 10분 안에
          ├─ APPROVED → C11 주문 상세 (CONFIRMED)
          ├─ DECLINED → reason 표시 · 다시 결제 or C12 취소
          └─ 409 PAYMENT_EXPIRED (expiresAt 지남) → 다시 주문
```

### 6-2. 공연 예매

```
N2  공연 상세 → queueEnabled ?
 ├─ true ─▶ N4 진입 → N5 를 pollAfterMs 마다 → ADMITTED { entryToken, expiresIn }
 │          (페이지 이탈 시 N6)
 └─ false ─▶ (토큰 없이 바로)
     └▶ N7 좌석 보기 (✏️ 11/04 77A 빈 좌석만 고를 수 있음 · 선점 · 판매는 회색)
         └▶ 선택완료 → N10 { seatId }  [+ X-Entry-Token] → 선점 { bookingId, amount, pgOrderId, expiresAt, expiresIn }
             │   (409 SEAT_TAKEN → "이미 선택된 좌석입니다" · N7 새로고침)
             │   (다른 좌석으로 바꾸려면 N13 으로 선점을 풀고 N10 다시 — 안 풀면 409 HOLD_EXISTS)
             └▶ 결제하기 → 토스 SDK requestPayment({ orderId: pgOrderId, … }) → successUrl?paymentKey&…
                  └▶ N16 { paymentKey, amount }   (expiresAt 안에 — 선점 뒤 8분 · 서버 +60초)
                  ├─ CONFIRMED → N12 예매 상세
                  ├─ PENDING (DECLINED) → reason 표시 · 새 pgOrderId 로 결제창 다시 (선점 · 타이머 그대로)
                  ├─ 410 HOLD_EXPIRED · EXPIRED → "선점 시간이 끝났어요" · N7 (돈은 나가지 않음)
                  └─ 503 PAYMENT_PENDING → N12 로 결과 확인
취소 · 환불은 N13 하나로
```

✏️ **10/28 티켓은 배송이 없습니다** — 배송지를 묻지 않고, 결제 뒤 **MY › 예매 내역**(N11 → N12)에서 모바일 티켓(공연 · 좌석 · 예매번호 + QR)을 보여 줍니다.

✏️ **11/01 입장 QR (암표 방지)** — QR 은 프론트가 만들지 않고 **N17 이 준 `token` 을 그대로** 그립니다. ~~QR 은 프론트가 `bookingId` 로 만드는 표시용 · 「QR 저장」(이미지 내려받기)~~ (10/28 → 11/01 폐지)

```
모바일 티켓 열기 → N17 → QR 그리기 + "nn초 뒤 새 QR" ─┬─ 20초마다 N17 다시 (30초 뒤 무효 — 캡처본은 검표에서 ENTRY_QR_EXPIRED)
                                                      ├─ 409 ENTRY_NOT_OPEN → QR 자리에 "공연 3시간 전(result.opensAt)부터 열려요"
                                                      ├─ 409 ALREADY_CHECKED_IN → "입장 완료 HH:mm" (result.checkedInAt) · QR 없음
                                                      └─ 409 ENTRY_CLOSED → "입장 시간이 지났어요"
티켓을 닫거나 화면을 떠나면 타이머를 멈춥니다 (보이지 않을 때 부르지 않기)
```

- 「QR 저장」은 없앴습니다 — 저장본은 30초 뒤 무효입니다. 대신 **「티켓 정보 저장」**(공연 · 일시 · 좌석 · 예매번호 이미지 · QR 없음)은 둬도 됩니다.
- 검표는 관리자 대시보드의 검표 역할(`TICKET_CHECKER` · Studio S40 · S41)이 합니다 — 사용자 앱이 부를 API 는 N17 하나입니다 ([24](24_관리자_서비스.md) §5-1).

---

## 7. 아직 없는 API (호출하면 Gateway 가 503 폴백)

| ID | 메서드 | 엔드포인트 | 설명 | 상태 |
| --- | --- | --- | --- | --- |
| X1 | POST | `/api/chatbot` | chatbot-service 질의 | 서비스 미구현 (타 담당) |
| X2 | GET | `/api/chatbot/suggestions` | 추천 질문 칩 | 서비스 미구현 |
| 🆕 X4 | GET | `/api/chatbot/artists/similar` | ✏️ 10/28 가입 밴드 고르기 체인 (§6-0) · **공개** (가입 전이라 AT 없음 · Gateway 공개 경로 등록됨) · `?artistId=&exclude=1,2,3&size=` — `artistId` 없으면 **첫 세트**(인기 · 장르 고루 · `size` 기본 24) · 있으면 그 밴드와 **비슷한 밴드**(임베딩 유사도 · `size` 기본 3 · 최대 10) · `exclude` = 지금까지 보여 준 밴드 id (최대 200 · **top-k 를 고르기 전에 뺌**) → `{ items: ArtistItem[] }` (더 없으면 `[]`) | 설계 · 챗봇 담당 · 화면은 데모 |
| S1~ | — | `/api/studio/**` — ✏️ 11/04 호스트 **`admin.indig.co.kr`** (KT · Gateway 아님 · 56B · 57A) | 관리자 콘솔 (무대 사진 · 좌석 일괄 생성 · 관리자 로그인 등 · [22](22_수집검증_관리자권한_감사로그.md)) · ✏️ 10/27 콘서트장 · 공연 · 상품 등록 · 수정 · 삭제 · 조회 · 굿즈 엑셀 입고 · CS · 수집 현황 S15~S39 ([24](24_관리자_서비스.md) §9) | 서비스 미구현 · 화면은 데모 |

프론트가 **부르지 않는** 것: G2 (OAuth 콜백) · P5 `/api/payments/webhook/{provider}` (PG 서버 전용) · `/internal/**` · `/ingest/**` (외부 404).

---

## 8. 에러 코드

### 8-1. 공통

| code | HTTP | 언제 | 프론트 처리 |
| --- | --- | --- | --- |
| `TOKEN_INVALID` · `TOKEN_EXPIRED` · `TOKEN_REVOKED` · `UNAUTHENTICATED` | 401 | 로그인 안 됨 · 만료 | §0-6 (refresh 1회 → 로그인 화면) |
| `REFRESH_INVALID` · `REFRESH_REUSED` | 401 | RT 무효 · 재사용 탐지 | 로그인 화면 |
| `CSRF_COOKIE_MISSING` · `CSRF_HEADER_MISSING` · `CSRF_MISMATCH` | 403 | `XSRF-TOKEN` 쿠키 없음 · `X-XSRF-TOKEN` 헤더 없음 · 불일치 (11/04 분리) | G3 다시 호출해 토큰 갱신 후 재시도 |
| `FORBIDDEN` | 403 | 권한 없음 | 안내 |
| `INVALID_REQUEST` · `BAD_REQUEST` · `INVALID_CURSOR` | 400 | 파라미터 · 본문 오류 | `message` 표시 |
| `NOT_FOUND` | 404 | 없음 · **남의 주문/예매/결제** | 404 화면 |
| `PAYLOAD_TOO_LARGE` | 413 | 본문 1 MiB 초과 | — |
| `TOO_MANY_REQUESTS` | 429 | 요청 과다 | 잠시 후 재시도 |
| `INTERNAL_ERROR` | 500 | 서버 오류 | `correlationId` 와 함께 제보 |
| `SERVICE_UNAVAILABLE` · `GATEWAY_TIMEOUT` | 503 · 504 | 서비스 장애 · 지연 | “잠시 후 다시” |

### 8-2. 도메인

| 서비스 | code | HTTP | 메시지 |
| --- | --- | --- | --- |
| Member | `INVALID_NICKNAME` · `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` | 400 | 공백 · 금칙어 · 2자 미만 · 10자 초과 (11/04 길이 분리) |
| Member | `ACCOUNT_WITHDRAWN` | 409 | 탈퇴한 계정입니다 |
| 🆕 Member 배송지 | `ADDRESS_LIMIT_EXCEEDED` | 409 | 배송지는 최대 10개까지 저장할 수 있습니다 |
| 🆕 Gateway · Member 가입 | `SIGNUP_EXPIRED` · `SIGNUP_INVALID` | 401 | 가입 시간이 지났어요 · 가입 정보를 확인할 수 없어요 (✏️ 10/28 30분 · G13 · 11/04 위조 · 형식 오류 분리) |
| 🆕 Member 가입 | `REQUIRED_AGREEMENT_MISSING` | 400 | ✏️ 11/05 필수 약관에 동의해주세요 (G13) |
| 🆕 Member 가입 | `TERMS_OUTDATED` | 409 | ✏️ 11/05 약관이 바뀌었어요. 다시 확인하고 동의해주세요 (G13 → M24 다시) |
| 🆕 Member 약관 | `TERMS_NOT_FOUND` | 404 | ✏️ 11/06 약관을 찾을 수 없어요 (M25 · 시행 중인 버전 없음) |
| Catalog | `ARTIST_NOT_FOUND` · `PRODUCT_NOT_FOUND` | 404 | 찾을 수 없습니다 |
| Catalog | `OUT_OF_STOCK` | 409 | 재고가 부족합니다 |
| Catalog · Concert | `PAYMENT_UNAVAILABLE` | 503 | 결제를 준비/처리하지 못했습니다 |
| Concert 대기열 | `QUEUE_NOT_OPEN` · `ALREADY_IN_QUEUE` · `QUEUE_DISABLED` | 409 | 예매 전 · 이미 대기 중 · 대기열 없는 공연 |
| Concert 대기열 | `QUEUE_CLOSED` | 410 | 판매가 끝난 공연입니다 |
| Concert 대기열 | `ENTRY_TOKEN_REQUIRED` · `QUEUE_NOT_ADMITTED` · `ENTRY_TOKEN_INVALID` | 403 | 입장 토큰 없음 · 입장 10분 지남(입장 전) · 다른 토큰 (11/04 분리) |
| Concert 대기열 | `NOT_IN_QUEUE` | 404 | 대기열에 없습니다 |
| Concert 대기열 | `QUEUE_UNAVAILABLE` | 503 | 잠시 후 다시 (`result.retryAfterMs`) |
| Concert 좌석 | `SEAT_TAKEN` · `SEAT_LIMIT_EXCEEDED` · `SEAT_LOCKED` | 409 | 이미 선택됨 (✏️ 11/04 77A) · 1인 1석 · 결제 처리 중 |
| Concert 좌석 | `SEAT_NOT_FOUND` | 404 | 좌석을 찾을 수 없습니다 |
| Concert 예매 | `HOLD_EXISTS` · `BOOKING_CANCELLED` · `ALREADY_PAID` · `BOOKING_NOT_CANCELLABLE` | 409 | 내 선점이 다른 좌석에 (✏️ 11/04 77A) · 취소된 예매 · 이미 결제됨 · 취소 불가 |
| Concert 예매 | `HOLD_EXPIRED` | 410 | 선점 시간(서버 9분) 지남 — `SELECTION_EXPIRED` 대체 |
| Concert 예매 | `PAYMENT_PENDING` | 503 | 결제 결과 확인 중 — 좌석은 결제 중 그대로 |
| 🆕 Concert 입장 | `ENTRY_NOT_OPEN` · `ENTRY_CLOSED` · `ALREADY_CHECKED_IN` · `ENTRY_NOT_AVAILABLE` | 409 | 공연 3시간 전부터(`result.opensAt`) · 입장 시간 지남 · 입장 완료(`result.checkedInAt`) · 결제 전 · 취소됨 (N17 · 11/01) |
| Payment | `AMOUNT_MISMATCH` | 400 | 금액 불일치 (✏️ 10/28 `ORDER_MISMATCH` 삭제 — 주문번호로 찾으므로 불일치가 없음) |
| Payment | `PG_UNAVAILABLE` | 503 | 결제사 응답 없음 — 결과 확인 중 (P2 · N12 로 상태 확인) |
| Payment | `ALREADY_CONFIRMED` · `PAYMENT_NOT_PENDING` · `PAYMENT_EXPIRED` | 409 | 이미 승인 · 진행 불가 · 시간 초과 |
| Payment | `USE_BOOKING_CANCEL` · `USE_BOOKING_CONFIRM` · `PAYMENT_NOT_CANCELLABLE` | 409 | 티켓은 예매 취소로 · 티켓은 N16 으로 · 거절된 결제 |