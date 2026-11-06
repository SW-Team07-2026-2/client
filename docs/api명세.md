# 26. 프론트 API 명세서

> 2026-11-01 · **구현된 코드 기준** (`backend/*/controller` · DTO · ErrorCode) · 사용자 화면(프론트)이 부르는 API 만 담았습니다.
엔드포인트 ID(G · M · C · N · P · X)는 15 · 23 과 같습니다. 한 줄 요약표는 23, 이 문서는 엔드포인트별 상세입니다. ✏️ 11/05 붙이는 순서 · 화면별 호출 흐름은 31 프론트 연동 플로우.
표시 — ✅ 구현됨 · 🚧 아직 없음 (호출하면 Gateway 가 503 폴백)
> 

> 🆕 **11/05 가입에 약관 동의 화면이 생겼습니다** (카카오 싱크 → 우리 화면). `/signup` 에서 **① 약관 동의 → ② 밴드 고르기 → G13** 순서입니다.
> 
> 
> 
> | 바뀐 것 | 어디 |
> | --- | --- |
> | 🆕 M24 `GET /api/members/terms` — 약관 4개 (공개) | §2-6 |
> | 🆕 11/06 M25 `GET /api/members/terms/{code}` — 푸터 약관 화면 (이용약관 · 개인정보처리방침) 문서 1개 (공개) | §2-6 |
> | ✏️ G13 요청에 **`agreements`** 추가 (필수) · 에러 `REQUIRED_AGREEMENT_MISSING` 400 · `TERMS_OUTDATED` 409 | §1 G13 |
> | ✅ M17 · M18 (MY › 약관 · 동의 · 마케팅 수신 켜고 끄기) — 🚧 에서 구현으로 | §2-6 |
> | 화면 흐름 | §6-1 |

> 🟢 **11/05 운영 배포 — `https://api.indig.co.kr` 가 응답합니다** (Cloudflare → AWS ALB → Gateway)
> 
> 
> 
> | 항목 | 운영 |
> | --- | --- |
> | 반영 버전 | ✏️ 11/06 **5개 서비스 모두 `main` 최신** — gateway `d2d9712` · member `aeed68c` · catalog `fdab981` · concert `7604152` · payment `66ff414` (위 🆕 약관 동의 가입 · M24 · M25 · M17 · M18 · 아래 77A 좌석 선점 포함) |
> | 예매 | ✏️ 11/06 **77A 좌석 선점 운영 반영** — 아래 표의 **“후 (선점)” 열**대로 동작하고, 타이머는 **8분**입니다 |
> | CORS | `https://indig.co.kr` 하나만 (`credentials: true`). `http://localhost:5173` · `www.indig.co.kr` · `*.vercel.app` 은 403 |
> | 로컬에서 운영 API | 안 됩니다 — CORS 와 쿠키(`Domain=.indig.co.kr`) 둘 다 막힙니다. 연동 개발은 로컬 Gateway, 운영 확인은 Vercel 도메인 연결 뒤 `https://indig.co.kr` 에서 |
> | 프론트 도메인 | `indig.co.kr` · `www` DNS 레코드는 아직 없습니다 — Vercel 이 주는 레코드를 인프라 담당에게 (28 §6 3번) |
> | 카카오 로그인 | ✏️ 11/05 **정규 앱 — 카카오 계정이면 누구나** (테스트 앱 · 카카오 싱크 종료). 카카오 동의 화면은 닉네임 · 이메일만, 약관은 우리 가입 화면(§6-1) · Redirect URI `https://api.indig.co.kr/oauth2/code/kakao` |
> | 챗봇 `/api/chatbot/**` | 미배포 — 503 `SERVICE_UNAVAILABLE` (`result.service: "chatbot"`) |
> | 엣지 (Cloudflare) | `/api/*` · `/oauth2/*` 밖은 403 HTML · 같은 IP 10초 100회 넘으면 429 HTML · `http://` 는 `https://` 로 301 (28 §7 ④) |
> | 결제 | 토스 **테스트** 환경 그대로 — 실제 돈이 나가지 않습니다 |

> 🔴 **11/04 변경 — 좌석 선점 (77A · 티켓링크 방식).** 좌석을 고르는 순간 한 명만 잡고 8분 안에 결제합니다. 프론트가 바꿀 것:
> 
> 
> 
> | API | 전 (경합) | 후 (선점) |
> | --- | --- | --- |
> | N7 좌석 `status` | `AVAILABLE` · `CONTESTED`(고를 수 있음) · `SOLD` | `AVAILABLE` · **`HELD`**(회색 · 고를 수 없음) · `SOLD` |
> | N10 좌석 선택 | 다른 사람이 고른 좌석도 성공 · 다른 좌석을 고르면 이전 선택 자동 취소 | 남이 잡은 좌석은 바로 409 **`SEAT_TAKEN`** · 내 선점이 있는데 다른 좌석이면 409 **`HOLD_EXISTS`** (`result.bookingId` → N13 으로 풀고 다시) |
> | 타이머 `expiresAt` · `expiresIn` | 5분 | **8분** (서버는 60초 더) |
> | N16 거절 (한도초과 등) | `status: CANCELLED` → N10 부터 다시 | **`status: PENDING` + 새 `pgOrderId`** → 같은 선점 · 타이머 그대로 결제창 다시 |
> | N16 시간 초과 | 409 `SELECTION_EXPIRED` | **410 `HOLD_EXPIRED`** (거절 + 시간 초과면 `status: EXPIRED`) |
> | N16 결과 모름 | 503 `PAYMENT_UNAVAILABLE` | **503 `PAYMENT_PENDING`** → N12 로 확인 · 다시 결제하지 않기 |
> | 에러 코드 | `SEAT_UNAVAILABLE` | **`SEAT_TAKEN`** (N10 의 `SEAT_LOCKED` · `CONFLICT` 는 더 안 나옴) |
> 
> 상세는 아래 §4-3 N7 · N10 · N16, 백엔드 규칙은 08 §8.3 · 8.4.
> 

---

## 0. 공통

### 0-1. 접속

| 항목 | 로컬 | 운영 (✏️ 11/05 배포 — 위 🟢 표) |
| --- | --- | --- |
| API Base URL | `http://localhost:8080` (Gateway) | `https://api.indig.co.kr` |
| 프론트 Origin (CORS 허용) | `http://localhost:5173` | `https://indig.co.kr` |
- **항상 Gateway 로만** 부릅니다. 서비스 포트(8081~8084)를 직접 부르면 인증 헤더가 붙지 않습니다.
- `fetch` 는 **`credentials: 'include'`** 필수 — 인증이 전부 쿠키입니다.
- 본문은 `Content-Type: application/json` · 최대 1 MiB.
- 날짜 `YYYY-MM-DD` · 시각은 ISO-8601 오프셋 포함 (`2026-11-03T19:00:00+09:00`) · 금액은 정수(원).

### 0-2. 인증 표기

| 표기 | 뜻 |
| --- | --- |
| 공개 | 로그인 없이 호출 |
| 🔒 | 로그인 필요 (AT 쿠키). 없으면 401 |
| 🔒C | 로그인 + **`X-XSRF-TOKEN` 헤더**. 쿠키 없음 403 `CSRF_COOKIE_MISSING` · 헤더 없음 403 `CSRF_HEADER_MISSING` · 다르면 403 `CSRF_MISMATCH` (11/04) |

**POST · PUT · PATCH · DELETE 는 전부 `X-XSRF-TOKEN` 이 필요합니다** (로그아웃 · 재발급 · 가입 완료 포함). 값은 G3 응답의 `xsrfToken` 또는 `XSRF-TOKEN` 쿠키입니다.

### 0-3. 쿠키 (Gateway 가 굽고 지웁니다 — 프론트는 만들지 않음)

| 쿠키 | JS 읽기 | 수명 | 용도 |
| --- | --- | --- | --- |
| `AT` | ✗ HttpOnly | 30분 | 액세스 토큰. 만료 5분 전부터 Gateway 가 응답 `Set-Cookie` 로 **알아서 갱신** |
| `RT` | ✗ HttpOnly | 14일 | 리프레시 토큰 |
| `XSRF-TOKEN` | ✅ | — | CSRF 토큰 → `X-XSRF-TOKEN` 헤더로 돌려보냄 |
| `SIGNUP` | ✗ HttpOnly | 30분 | 처음 로그인한 사람의 가입 대기 토큰 (G13 에서만 쓰임) |

### 0-4. 응답 봉투

```json
// 성공 — 아래 각 API 의 "Response" 는 result 의 모양입니다
{ "isSuccess": true, "code": "OK", "message": "성공", "result": { /* ... */ }, "correlationId": "..." }

// 실패 — code 로 분기, message 는 그대로 사용자에게 보여도 됨
{ "isSuccess": false, "code": "OUT_OF_STOCK", "message": "재고가 부족합니다", "correlationId": "7f3c..." }   // 값이 없는 필드는 빠집니다

// 실패 + 추가 정보 — 일부 에러는 result 에 값이 실립니다 (각 API 의 에러 표에 표시)
{ "isSuccess": false, "code": "ENTRY_NOT_OPEN", "message": "아직 입장 QR 이 열리지 않았습니다", "result": { "opensAt": "2026-11-03T16:00:00+09:00" } }
```

- `204` 는 본문이 없습니다 (DELETE 일부).
- `correlationId` 는 버그 제보 때 백엔드에 전달해 주세요.

### 0-5. 목록 응답

```tsx
// 카탈로그 · 공연 목록 — 요청 ?page=0&size=20 (page 0부터 · size 기본 20 · 최대 50)
interface PageResult<T> { items: T[]; page: number; size: number; hasNext: boolean }

// 내 주문 · 예매 · 결제 · 피드 · 알림 · 팔로우 · 위시 · 보유 음반 — 요청 ?cursor=&size=
// 처음엔 cursor 생략, 다음 페이지는 응답의 nextCursor 를 그대로 · hasNext=false 면 끝
interface CursorPage<T> { items: T[]; nextCursor: string | null; hasNext: boolean }
```

### 0-6. 401 처리 (권장)

```
보호 API 가 401 ─▶ POST /api/auth/refresh (G5 · 1회만)
                    ├─ 200 → 원래 요청 재시도
                    ├─ 401 REFRESH_INVALID · REFRESH_REUSED → 로그인 화면
                    └─ 503 → 쿠키 유지 · "잠시 후 다시" (로그아웃 아님)
```

### 0-7. 호출 래퍼 예시

```tsx
const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";
let xsrf: string | null = null;                         // G3 의 xsrfToken
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (MUTATING.includes(method) && xsrf) headers.set("X-XSRF-TOKEN", xsrf);

  const res = await fetch(BASE + path, { ...init, method, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);      // 11/02 — Cloudflare 엣지 차단(429 · 403)은 HTML (28 §7 ④)
  if (!body) throw Object.assign(new Error(res.status === 429 ? "요청이 너무 많아요. 잠시 후 다시 시도해 주세요" : "요청을 처리하지 못했어요"),
                                 { code: `EDGE_${res.status}`, status: res.status });

  if (res.status === 401 && !retried && path !== "/api/auth/refresh") {
    const r = await fetch(BASE + "/api/auth/refresh", {
      method: "POST", credentials: "include", headers: xsrf ? { "X-XSRF-TOKEN": xsrf } : {},
    });
    if (r.ok) return api<T>(path, init, true);
  }
  if (!body.isSuccess) throw Object.assign(new Error(body.message), body);   // { code, message, result, correlationId }
  return body.result as T;
}
```

---

## 1. 인증 — Gateway

### G1 ✅ 소셜 로그인 시작

`GET /oauth2/authorization/kakao` · 공개

- **fetch 가 아니라 페이지 이동**: `location.href = BASE + "/oauth2/authorization/kakao"`
- 로그인은 **카카오만** 지원합니다.
- 결과 (302):
    - 기존 회원 → `{프론트}/` + 쿠키 `AT` · `RT` · `XSRF-TOKEN`
    - 처음 로그인 → `{프론트}/signup` + 쿠키 `SIGNUP` · `XSRF-TOKEN` (회원은 아직 없음 → §6-1 가입 흐름 — ✏️ 11/05 약관 동의부터)
    - 실패 → `{프론트}/login`
- 호출 한도: IP 당 분당 20회 (429 `TOO_MANY_REQUESTS`)

G2 `GET /oauth2/code/kakao` 는 카카오가 리다이렉트하는 콜백이라 **프론트가 부르지 않습니다.**

### G3 ✅ 로그인 상태 · 내 정보 · CSRF 토큰

`GET /api/auth/me` · 🔒 — 앱 시작 시 1회. **비로그인 401 은 정상 분기**입니다.

```tsx
interface AuthMe {
  userId: string;               // ⚠ 문자열 (M1 의 userId 는 숫자)
  nickname: string | null;
  profileImageUrl: string | null;
  roles: string[];              // ["USER"]
  xsrfToken: string;            // 이후 POST · PUT · PATCH · DELETE 의 X-XSRF-TOKEN
  stale?: true;                 // 회원 서비스 장애 — nickname · profileImageUrl 이 null (로그인은 유지)
}
```

### G4 ✅ 로그아웃

`POST /api/auth/logout` · 공개 + C — 만료된 AT 로도 호출 가능 · 항상 200 · 쿠키 삭제

Response `{ "ok": true }`

### G5 ✅ 토큰 재발급

`POST /api/auth/refresh` · RT 쿠키 + C — 401 을 받았을 때 1회 (§0-6). 호출 한도 사용자당 분당 10회.

| 결과 | 처리 |
| --- | --- |
| 200 `{ "ok": true }` + 새 쿠키 | 원래 요청 재시도 |
| 401 `REFRESH_INVALID` · `REFRESH_REUSED` | 로그인 화면 |
| 503 | 쿠키 유지 · “잠시 후 다시” |

### G13 ✅ 가입 완료

`POST /api/auth/signup` · `SIGNUP` 쿠키 + C — 약관 동의 → 밴드 고르기 다음의 「완료」 · 「건너뛰기」

```json
// Request — ✏️ 11/05 agreements 추가 (필수)
{
  "artistIds": [12, 40, 7],              // 고른 아티스트 id (건너뛰기는 [] · 최대 50)
  "agreements": [                         // M24 로 받은 약관 전부 · termsId 는 M24 값 그대로 (하드코딩 금지)
    { "termsId": 1, "agreed": true },     // AGE14 만 14세 이상 (필수)
    { "termsId": 2, "agreed": true },     // TOS 이용약관 (필수)
    { "termsId": 3, "agreed": true },     // PRIVACY 개인정보 수집 · 이용 (필수)
    { "termsId": 4, "agreed": false }     // MARKETING 마케팅 정보 수신 (선택)
  ]
}

// Response — 회원 생성 + 팔로우 + 약관 동의 이력 저장 · AT · RT 쿠키 발급 · SIGNUP 쿠키 삭제
{ "userId": 1024, "nickname": "새벽", "newUser": true }
```

- 선택 약관을 `agreements` 에서 빼면 “동의 안 함”으로 기록됩니다.
- 약관 에러(400 · 409)는 **사인업 토큰을 쓰지 않습니다** — 30분 안이면 고쳐서 다시 보내면 됩니다.

| 에러 | HTTP | 처리 |
| --- | --- | --- |
| `REQUIRED_AGREEMENT_MISSING` | 400 | 🆕 11/05 필수 약관에 동의하지 않음 · `agreements` 없음 — 필수를 다 체크해야 「다음」이 열리게 (나오면 화면 버그) |
| `TERMS_OUTDATED` | 409 | 🆕 11/05 보낸 `termsId` 가 현재 약관이 아님 (가입 도중 약관이 바뀜) → M24 다시 → 약관 동의부터 다시 |
| `SIGNUP_EXPIRED` | 401 | 쿠키 없음 · 30분 지남 · 이미 사용 · 다시 로그인함 → “가입 시간이 지났어요” → G1 |
| `SIGNUP_INVALID` | 401 | 🆕 11/04 위조 · 형식이 틀린 사인업 토큰 → “가입 정보를 확인할 수 없어요” → G1 |
| `INVALID_REQUEST` | 400 | `artistIds` 50개 초과 · 형식 오류 |
| (5xx) | 503 | 잠시 후 다시 |

### 로컬 전용 가짜 로그인

`GET /dev/login?nickname=로컬유저` · 공개 — 카카오 없이 로그인 (로컬 프로필에만 있음 · 운영 404)

- 기존 회원: `{ userId, nickname, newUser: false, xsrfToken }` + 쿠키 3종
- 처음: `{ newUser: true, xsrfToken }` + `SIGNUP` 쿠키 → G13

---

## 2. 회원 — Member

### 2-0. 타입

```tsx
interface MemberMe {
  userId: number; nickname: string; profileImageUrl: string | null; email: string | null;
  provider: "KAKAO"; followCount: number; wishlistCount: number; collectionCount: number;
}

type FeedType = "ALBUM_RELEASED" | "CONCERT_OPENED" | "RESTOCKED" | "BOOKING_DONE";
interface FeedItem {
  id: number; type: FeedType;
  artistId: number | null;
  refId: number | null;          // ALBUM_RELEASED → albumId · CONCERT_OPENED → concertId · RESTOCKED → productId · BOOKING_DONE → bookingId
  title: string; thumbnailUrl: string | null; occurredAt: string;
  read: boolean | null;          // 알림 목록(M9)에서만 값이 있음
}

interface FollowItem { artistId: number; followedAt: string }          // 이름 없음 → C2 ?ids= 로 조회
interface WishlistItem { productId: number; createdAt: string }        // 상품 정보는 C8b ?ids= 로 조회
interface CollectionItem { id: number; albumId: number; source: "MANUAL" | "PURCHASE"; acquiredAt: string | null }

interface ShippingAddress {
  id: number; label: string | null; recipientName: string; phone: string;
  zonecode: string; address: string; addressDetail: string | null; isDefault: boolean;
}
interface ShippingAddressInput {
  label?: string;          // 20자 (집 · 회사)
  recipientName: string;   // 필수 · 20자
  phone: string;           // 필수 · 0 으로 시작 · 하이픈 선택 (010-1234-5678)
  zonecode: string;        // 필수 · 숫자 5자리
  address: string;         // 필수 · 200자
  addressDetail?: string;  // 100자
  isDefault?: boolean;     // true 면 기본 배송지로
}

type TermsCode = "AGE14" | "TOS" | "PRIVACY" | "MARKETING" | "PRIVACY_POLICY";   // ✏️ 11/06 PRIVACY_POLICY 는 M25 전용 (동의 대상 아님 · M24 에 안 나옴)
interface Terms {                // ✏️ 11/05 M24 · 11/06 M25
  termsId: number; code: TermsCode; version: string;   // "v1"
  title: string;                                      // "이용약관 동의"
  content: string;                                    // 본문 마크다운 (**굵게** · - 목록 · 빈 줄 = 문단)
  required: boolean;                                  // [필수] · [선택]
}
interface MyAgreement {          // ✏️ 11/05 M17
  termsId: number; code: TermsCode; version: string; title: string; required: boolean;
  agreed: boolean; at: string;                        // 마지막으로 동의 · 철회한 시각
}
```

### 2-1. 내 정보

| ID | 메서드 · 경로 | 인증 | Request | Response | 에러 |
| --- | --- | --- | --- | --- | --- |
| M1 ✅ | `GET /api/members/me` | 🔒 | — | `MemberMe` | `ACCOUNT_WITHDRAWN` 409 |
| M2 ✅ | `PATCH /api/members/me` | 🔒C | `{ nickname }` — 공백 없이 2~10자 | `{ userId, nickname }` | `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` · `INVALID_NICKNAME`(공백 · 금칙어) 400 |

### 2-2. 팔로우

| ID | 메서드 · 경로 | 인증 | Request | Response |
| --- | --- | --- | --- | --- |
| M4 ✅ | `POST /api/members/follows/{artistId}` | 🔒C | — | `{ artistId, following: true }` |
| M5 ✅ | `DELETE /api/members/follows/{artistId}` | 🔒C | — | 204 |
| M6 ✅ | `GET /api/members/follows` | 🔒 | `?cursor=&size=` | `CursorPage<FollowItem>` |
| M7 ✅ | `GET /api/members/follows/{artistId}` | 🔒 | — | `{ following: boolean }` — 아티스트 상세의 버튼 상태 |

### 2-3. 피드 · 알림

| ID | 메서드 · 경로 | 인증 | Request | Response |
| --- | --- | --- | --- | --- |
| M8 ✅ | `GET /api/members/feed` | 🔒 | `?cursor=&size=` | `CursorPage<FeedItem>` — 팔로우한 아티스트 소식 + 내 예매 |
| M9 ✅ | `GET /api/members/notifications` | 🔒 | `?cursor=&size=` | `CursorPage<FeedItem>` (`read` 포함) |
| M10 ✅ | `GET /api/members/notifications/badge` | 🔒 | — | `{ count }` — 최대 99 (UI 는 `99+`) |
| M11 ✅ | `POST /api/members/notifications/read` | 🔒C | — | `{ ok: true }` — **전부** 읽음 처리 |

### 2-4. 위시리스트 · 보유 음반

| ID | 메서드 · 경로 | 인증 | Request | Response |
| --- | --- | --- | --- | --- |
| M12 ✅ | `GET /api/members/wishlist` | 🔒 | `?cursor=&size=` | `CursorPage<WishlistItem>` |
| M13 ✅ | `POST /api/members/wishlist/{productId}` | 🔒C | — | `{ productId, wished: true }` |
| M14 ✅ | `DELETE /api/members/wishlist/{productId}` | 🔒C | — | 204 |
| M15 ✅ | `GET /api/members/collections` | 🔒 | `?cursor=&size=` | `CursorPage<CollectionItem>` |
| M15b ✅ | `GET /api/members/collections/{id}` | 🔒 | — | `CollectionItem` |
| M16 ✅ | `POST /api/members/collections` | 🔒C | `{ albumId: number, acquiredAt?: "YYYY-MM-DD" }` | `CollectionItem` (`source: "MANUAL"`) |

구매한 음반은 결제가 끝나면 자동으로 `source: "PURCHASE"` 로 들어옵니다.

### 2-5. 배송지

| ID | 메서드 · 경로 | 인증 | Request | Response | 에러 |
| --- | --- | --- | --- | --- | --- |
| M19 ✅ | `GET /api/members/me/addresses` | 🔒 | — | `{ items: ShippingAddress[] }` — 기본이 맨 앞 · 최대 10개라 페이지 없음 | — |
| M20 ✅ | `POST /api/members/me/addresses` | 🔒C | `ShippingAddressInput` | `ShippingAddress` — 첫 배송지는 자동으로 기본 | `ADDRESS_LIMIT_EXCEEDED` 409 · `INVALID_REQUEST` 400 |
| M21 ✅ | `PUT /api/members/me/addresses/{id}` | 🔒C | `ShippingAddressInput` (전체 교체) | `ShippingAddress` | `NOT_FOUND` 404 (남의 · 없는 id) |
| M22 ✅ | `POST /api/members/me/addresses/{id}/default` | 🔒C | — | `ShippingAddress` — 다른 기본은 자동 해제 | `NOT_FOUND` 404 |
| M23 ✅ | `DELETE /api/members/me/addresses/{id}` | 🔒C | — | 204 — 기본을 지우면 가장 최근 배송지가 기본 (M19 다시 호출) | `NOT_FOUND` 404 |

**주소 검색은 카카오 우편번호 서비스(무료 · 키 없음)로 프론트에서 끝냅니다.** 서버는 형식만 검사합니다.

```html
<script src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
```

```jsx
new daum.Postcode({
  oncomplete(data) {
    form.zonecode = data.zonecode;                                                       // "04043"
    form.address  = data.userSelectedType === "J" ? data.jibunAddress : data.roadAddress;
    focus(addressDetail);                                                                // 상세 주소는 사용자 입력
  },
}).open();                                                                               // 모바일은 .embed(el)
```

- `zonecode` · `address` 칸은 읽기 전용으로 두고 「주소 검색」 버튼으로만 채웁니다.

### 2-6. 약관 · 동의 🆕 11/05

| ID | 메서드 · 경로 | 인증 | Request | Response |
| --- | --- | --- | --- | --- |
| M24 ✅ | `GET /api/members/terms` | **공개** (가입 화면 — 아직 회원 아님) | — | `{ items: Terms[] }` — 화면 순서(AGE14 · TOS · PRIVACY · MARKETING) · 코드마다 현재 버전 하나 |
| M25 ✅ 🆕 11/06 | `GET /api/members/terms/{code}` | **공개** (푸터) | — | `Terms` 하나 — 그 문서의 현재 버전. `code` = `TOS` · `PRIVACY_POLICY` 등 (대문자 그대로) · 없는 code 400 `INVALID_REQUEST` · 시행 중인 버전 없음 404 `TERMS_NOT_FOUND` |
| M17 ✅ | `GET /api/members/me/agreements` | 🔒 | — | `{ items: MyAgreement[] }` — MY › 약관 · 동의 |
| M18 ✅ | `PUT /api/members/me/agreements/marketing` | 🔒C | `{ agreed: boolean }` | `{ agreed, at }` — 이력 1행 추가 |

```json
// M24 Response (content 는 줄임)
{ "items": [
  { "termsId": 1, "code": "AGE14",     "version": "v1", "title": "만 14세 이상입니다",          "content": "…", "required": true },
  { "termsId": 2, "code": "TOS",       "version": "v1", "title": "이용약관 동의",               "content": "# 서비스 이용약관\n\n**제1조 (목적)** …", "required": true },
  { "termsId": 3, "code": "PRIVACY",   "version": "v1", "title": "개인정보 수집 및 이용 동의",   "content": "…", "required": true },
  { "termsId": 4, "code": "MARKETING", "version": "v1", "title": "마케팅 정보 수신 동의",        "content": "…", "required": false }
] }
```

- ✏️ 11/06 **푸터 화면은 M25** — 「이용약관」 = `/api/members/terms/TOS`, 「개인정보처리방침」 = `/api/members/terms/PRIVACY_POLICY`. 🔴 가입 화면의 `PRIVACY`(개인정보 수집 · 이용 **동의서**)와 `PRIVACY_POLICY`(법정 **처리방침** · 개인정보 보호법 제30조)는 다른 문서입니다. 처리방침은 동의받지 않으므로 M24 에 나오지 않고, G13 에 보내면 409 입니다. 본문의 `【확인 필요】` 는 사업자 등록 · 법무 검토 전 빈칸이라 그대로 보여 주세요.
- 가입 화면은 M24 의 `items` 를 **그 순서 그대로** 그립니다 — `[필수]` · `[선택]` 은 `required`, 문구는 `title`.
- `content` 는 **마크다운**입니다 — 마크다운 렌더러로 그리거나, 최소한 `white-space: pre-wrap`. 「보기」는 그 자리에서 펼치기 (다른 화면으로 가면 체크가 사라짐).
- 「전체 동의」는 선택 항목까지 체크 · 하나라도 끄면 「전체 동의」도 꺼짐. **필수(`required: true`)를 다 체크해야 「다음」**.
- M18 은 정보통신망법상 처리 결과를 알려야 합니다 — 응답의 `at` 으로 “2026.11.05 마케팅 정보 수신 동의를 철회했어요” 처럼 **날짜를 함께** 보여 주세요.

---

## 3. 카탈로그 — Catalog

### 3-0. 타입

```tsx
interface ArtistItem { id: number; name: string; genre: string | null; debutYear: number | null; profileUrl: string | null }
interface ArtistDetail extends ArtistItem {
  label: string | null;
  members: { name: string; role: string | null }[];
  albums: AlbumItem[]; lps: LpItem[]; goods: GoodsItem[];
}

type AlbumType = "ALBUM" | "EP" | "SINGLE";
interface AlbumItem {
  id: number; artistId: number; artistName: string; title: string; type: AlbumType;
  releasedAt: string | null; thumbnailUrl: string | null;
}
interface AlbumDetail extends AlbumItem {
  tracks: { trackNo: number; title: string }[];
  lps: LpItem[];
  cd: { productId: number; price: number; purchaseUrl: string | null } | null;   // CD 판매 안 하면 null
}

interface LpItem {
  id: number; albumId: number; albumTitle: string; artistId: number; artistName: string;
  pressType: string | null; releasedAt: string | null; thumbnailUrl: string | null;
  productId: number | null; price: number | null;     // 판매 안 하면 null
}
interface GoodsItem {
  id: number; artistId: number; artistName: string; name: string; category: string | null;
  productId: number | null; price: number | null; thumbnailUrl: string | null;
}

// 판매 상품 — 현재 가격 · 재고 (캐시 안 함 · 구매 직전 확인용)
interface ProductView {
  id: number; productType: "LP" | "CD" | "GOODS";
  refId: number;                 // LP · 앨범 · 굿즈 id
  name: string; price: number; thumbnailUrl: string | null; purchaseUrl: string | null;
  qty: number; soldOut: boolean;
  stockUpdatedAt: string | null; // "n시간 전 갱신" 표시용
}

interface SearchHit { type: "ARTIST" | "ALBUM" | "TRACK"; id: number; title: string; albumId?: number; score: number }

type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
interface Shipping { recipientName: string; phone: string; zonecode: string; address: string; addressDetail?: string | null }
interface OrderCreated { orderId: number; amount: number; pgOrderId: string; status: "PENDING"; expiresAt: string }
interface OrderSummary { orderId: number; status: OrderStatus; totalPrice: number; createdAt: string }
interface OrderDetail extends OrderSummary {
  pgOrderId: string;
  shipping: Shipping | null;     // 주문 당시 배송지 (나중에 배송지를 고쳐도 그대로)
  items: { productId: number; name: string; qty: number; price: number }[];
}
```

### 3-1. 조회 (전부 공개)

| ID | 메서드 · 경로 | Request | Response | 에러 |
| --- | --- | --- | --- | --- |
| C1 ✅ | `GET /api/catalog/search` | `?q=` (필수 · 1~50자) `&size=` | `{ items: SearchHit[] }` — `TRACK` 이면 `albumId` 로 이동. 검색 장애 시 200 `{ items: [], degraded: true }` | `SEARCH_QUERY_EMPTY` · `SEARCH_QUERY_TOO_LONG` 400 |
| C2 ✅ | `GET /api/catalog/artists` | `?q=&genre=&ids=1,2,3&page=&size=` — `ids` 일괄 조회(최대 50) | `PageResult<ArtistItem>` | `INVALID_REQUEST` 400 (ids 50개 초과) |
| C3 ✅ | `GET /api/catalog/artists/{id}` | — | `ArtistDetail` | `ARTIST_NOT_FOUND` 404 |
| C4 ✅ | `GET /api/catalog/albums` | `?type=ALBUM\|EP\|SINGLE&page=&size=` (신보순) | `PageResult<AlbumItem>` | — |
| C5 ✅ | `GET /api/catalog/albums/{id}` | — | `AlbumDetail` | `NOT_FOUND` 404 |
| C6 ✅ | `GET /api/catalog/lps` | `?from=YYYY-MM-DD&to=YYYY-MM-DD&page=&size=` (발매일) | `PageResult<LpItem>` | — |
| C7 ✅ | `GET /api/catalog/goods` | `?artistId=&page=&size=` | `PageResult<GoodsItem>` | — |
| C8 ✅ | `GET /api/catalog/products/{id}` | — | `ProductView` | `PRODUCT_NOT_FOUND` 404 |
| C8b ✅ | `GET /api/catalog/products` | `?ids=1,2,3` (필수 · 최대 50) | `PageResult<ProductView>` (한 페이지) — 위시리스트 화면용 | `INVALID_REQUEST` 400 |

### C9 ✅ 주문 생성 (굿즈 · 음반)

`POST /api/catalog/orders` · 🔒C — 재고 차감 + 결제 준비. 다음 단계는 토스 결제창 → P1 (§6-2)

```json
// Request — 금액은 보내지 않습니다 (서버가 계산)
{
  "items": [ { "productId": 31, "qty": 1 }, { "productId": 52, "qty": 2 } ],   // 최대 20종 · 상품당 qty 1~10 · 같은 상품 중복 불가
  "shipping": {                                     // 필수 — 고른 ShippingAddress 의 값 그대로 (id · label · isDefault 빼고)
    "recipientName": "김새벽", "phone": "010-1234-5678",
    "zonecode": "04043", "address": "서울 마포구 양화로 45", "addressDetail": "3층"
  }
}

// Response
{ "orderId": 881, "amount": 59000, "pgOrderId": "GOODS-3f2b9c1e-…", "status": "PENDING", "expiresAt": "2026-11-01T15:10:00+09:00" }
```

- `pgOrderId` (`GOODS-` + UUID) 가 토스 SDK 의 `orderId` 입니다 (`orderId` 881 이 아님).

| 에러 | HTTP | 처리 |
| --- | --- | --- |
| `OUT_OF_STOCK` | 409 | 재고 부족 안내 |
| `INVALID_REQUEST` | 400 | 배송지 누락 · 형식 오류 · 20종 초과 · 상품당 10개 초과 · 같은 상품 중복 |
| `PAYMENT_UNAVAILABLE` | 503 | 잠시 후 다시 |

### 3-2. 내 주문

| ID | 메서드 · 경로 | 인증 | Request | Response | 에러 |
| --- | --- | --- | --- | --- | --- |
| C10 ✅ | `GET /api/catalog/orders` | 🔒 | `?cursor=&size=` | `CursorPage<OrderSummary>` | — |
| C11 ✅ | `GET /api/catalog/orders/{id}` | 🔒 | — | `OrderDetail` | `NOT_FOUND` 404 (남의 주문 포함) |
| C12 ✅ | `POST /api/catalog/orders/{id}/cancel` | 🔒C | — | `OrderDetail` — 재고 복구 | `NOT_FOUND` 404 · `PAYMENT_UNAVAILABLE` 503 |

---

## 4. 공연 · 예매 — Concert

### 4-0. 타입

```tsx
type Region = "SEOUL" | "BUSAN" | "DAEGU" | "INCHEON" | "GWANGJU" | "DAEJEON" | "ULSAN" | "SEJONG" | "GYEONGGI"
  | "GANGWON" | "CHUNGBUK" | "CHUNGNAM" | "JEONBUK" | "JEONNAM" | "GYEONGBUK" | "GYEONGNAM" | "JEJU";
type SaleStatus = "SCHEDULED" | "ON_SALE" | "CLOSED";

interface ConcertSummary {
  id: number; title: string; type: "SOLO" | "FESTIVAL"; artistId: number; artistName: string; artistGenre: string | null;
  startsAt: string; price: number | null; saleStatus: SaleStatus;
  venue: { id: number; name: string; region: Region };
}
interface ConcertDetail extends Omit<ConcertSummary, "venue"> {
  bookingOpenAt: string | null;
  queueEnabled: boolean;         // true 면 대기열(N4~N6)을 거쳐야 예매 가능
  venue: VenueView;
}
interface VenueView { id: number; name: string; region: Region; address: string | null; capacity: number | null }
interface VenueDetail extends VenueView {
  upcomingConcerts: { id: number; title: string; type: "SOLO" | "FESTIVAL"; artistId: number; artistName: string; startsAt: string; saleStatus: SaleStatus }[];
}

type QueueStatus =
  | { state: "WAITING"; rank: number; total: number; etaSeconds: number; pollAfterMs: number; degraded?: true }  // degraded = 복구 중 · 순번 근사치
  | { state: "ADMITTED"; entryToken: string; expiresIn: number }   // 초 · 최대 10분 안에 좌석 선택 · 결제
  | { state: "EXPIRED" };                                           // 다시 N4

interface SeatMap {
  concertId: number;
  total: number;
  available: number;             // SOLD 가 아닌 좌석 수
  seats: { id: number; section: string; row: string; number: number; price: number; status: "AVAILABLE" | "HELD" | "SOLD" }[];   // ✏️ 11/04 77A — HELD = 누가 선점 · 결제 중 (회색)
}

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
interface BookingCreated { bookingId: number; amount: number; pgOrderId: string; status: "PENDING"; expiresAt: string; expiresIn: number }   // ✏️ 11/04 expiresIn = 남은 초
interface BookingPaid { bookingId: number; status: "CONFIRMED" | "PENDING" | "EXPIRED"; paymentStatus: "APPROVED" | "DECLINED"; reason?: string; pgOrderId?: string }   // ✏️ 11/04 80B — 거절이면 PENDING + 새 pgOrderId
interface BookingSummary { bookingId: number; status: BookingStatus; totalPrice: number; createdAt: string; concertId: number; concertTitle: string; startsAt: string }
interface BookingDetail {
  bookingId: number; status: BookingStatus; totalPrice: number; pgOrderId: string | null; createdAt: string; expiresAt: string | null; expiresIn: number | null;   // expiresAt 은 PENDING 일 때만 · pgOrderId 는 결제 준비 실패면 null
  concert: { id: number; title: string; startsAt: string; venueName: string };
  seats: { id: number; section: string; row: string; number: number; price: number }[];
}
```

### 4-1. 공연 · 공연장 조회 (전부 공개)

| ID | 메서드 · 경로 | Request | Response |
| --- | --- | --- | --- |
| N1 ✅ | `GET /api/concerts` | `?from=&to=` (YYYY-MM-DD) `&region=&genre=&type=SOLO\|FESTIVAL&artistId=&page=&size=` | `PageResult<ConcertSummary>` |
| N2 ✅ | `GET /api/concerts/{id}` | — | `ConcertDetail` |
| N3 ✅ | `GET /api/concerts/calendar` | `?month=YYYY-MM` (필수) `&artistIds=1,2` | `{ month, days: { date, concerts: ConcertSummary[] }[] }` |
| N14 ✅ | `GET /api/concerts/venues` | `?region=&q=&hasUpcoming=true\|false&page=&size=` | `PageResult<VenueView>` |
| N15 ✅ | `GET /api/concerts/venues/{id}` | — | `VenueDetail` |

### 4-2. 대기열 (`queueEnabled: true` 공연만)

| ID | 메서드 · 경로 | 인증 | Response | 에러 |
| --- | --- | --- | --- | --- |
| N4 ✅ | `POST /api/concerts/{id}/queue` | 🔒C | `QueueStatus` (WAITING) | `QUEUE_NOT_OPEN` · `QUEUE_DISABLED` 409 · `ALREADY_IN_QUEUE` 409 (`result.rank` — 0 이면 이미 입장 → N5 로 토큰 받기) · `QUEUE_CLOSED` 410 · `QUEUE_UNAVAILABLE` 503 (`result.retryAfterMs` 뒤 재시도) |
| N5 ✅ | `GET /api/concerts/{id}/queue/status` | 🔒 | `QueueStatus` | `NOT_IN_QUEUE` 404 |
| N6 ✅ | `DELETE /api/concerts/{id}/queue` | 🔒C | 204 | — |
- **N5 는 `pollAfterMs` 간격으로 폴링**합니다. 폴링이 하트비트를 겸해서, **15초 넘게 끊긴 채로 차례가 오면 입장하지 못하고 빠집니다.**
- 🔴 대기 화면에 **“화면을 나가면 순번이 사라집니다”** 안내가 필요합니다. 앱을 백그라운드로 보내도 폴링이 멈춰 15초 뒤 빠집니다. 페이지를 나갈 때는 N6.
- `ADMITTED` 의 `entryToken` 은 N10 의 `X-Entry-Token` 헤더로 보냅니다.

### 4-3. 좌석 · 예매

### N7 ✅ 좌석 배치

`GET /api/concerts/{id}/seats` · 🔒 → `SeatMap`

| status | 화면 | 고를 수 있나 |
| --- | --- | --- |
| `AVAILABLE` | 빈 좌석 | ✅ |
| `HELD` | 회색 — 누가 선점 중 · 결제 중 | ✗ (409 `SEAT_TAKEN`) |
| `SOLD` | 회색 — 판매 | ✗ |

✏️ 11/04 77A — 좌석은 **고르는 순간 한 명만** 잡습니다 (선점 · 티켓링크 방식). 선점 시간이 지난 좌석은 정리를 기다리지 않고 바로 `AVAILABLE` 로 보입니다.

✏️ 11/04 매진 · 취소표 — 매진 뒤에도 대기열로 들어와 좌석도를 볼 수 있습니다. 취소 · 선점 만료로 풀린 좌석은 바로 `AVAILABLE` 로 돌아옵니다 (서버 캐시 2초). 자동 폴링 대신 **「새로고침」 버튼 + 5초 쿨다운**으로 다시 부르세요. ‘취소표’ 라는 별도 표시는 없습니다.

### N10 ✅ 좌석 선점 = 예매 생성 + 결제 준비

`POST /api/concerts/{id}/bookings` · 🔒C · 대기열 공연은 헤더 **`X-Entry-Token: {entryToken}`** 추가

```json
// Request — 금액은 보내지 않습니다
{ "seatId": 5012 }

// Response — 선점 성공. expiresAt(선점 뒤 8분 · ✏️ 11/04 77A) 안에 토스 결제창 → N16 · expiresIn = 남은 초
{ "bookingId": 3301, "amount": 88000, "pgOrderId": "TICKET-8a7d6e5f-…", "status": "PENDING", "expiresAt": "2026-11-01T15:08:00+09:00", "expiresIn": 480 }
```

- `bookingId` 가 곧 선점 ID 입니다. 선점을 풀 때는 **N13** `POST /api/concerts/bookings/{id}/cancel`.
- 같은 좌석을 다시 보내면 **같은 선점**을 돌려줍니다 (뒤로가기 · 연타 · 새로고침 안전 · `expiresAt` 그대로 — 타이머가 늘지 않음).
- 선점이 살아 있는데 **다른 좌석**을 보내면 409 `HOLD_EXISTS` + `result.bookingId` — 서버가 이전 선점을 자동으로 버리지 않습니다. N13 으로 풀고 다시 고르세요.
- 입장 토큰은 N10 에서만 봅니다. 선점한 뒤 토큰이 만료돼도 결제(N16)는 선점 시간 안이면 됩니다.

#### 🆕 선점 타이머 — 프론트 규칙 (✏️ 11/04 77A)

`expiresAt` 은 화면 마감(선점 뒤 **8분**), `expiresIn` 은 거기까지 남은 초입니다(서버 DB 시계 기준). 판정은 서버가 하고(0초 뒤 60초 유예 포함 · 서버 마감 9분) 타이머는 **표시용**입니다. 남은 시간을 서버에 묻는 API 는 없습니다 — 폴링하지 마세요.

1. N10 응답을 받으면 `sessionStorage["booking:{bookingId}"] = Date.now() + expiresIn * 1000` — 기기 시계가 틀려도 맞도록 `expiresAt` 이 아니라 `expiresIn` 기준.
2. 1초마다 화면만 갱신합니다.
3. 🔴 토스 결제창으로 넘어갈 때 **지우지 않습니다.** `beforeunload` · `pagehide` 에서 지우면 successUrl 로 돌아왔을 때 타이머가 없습니다. 탭을 닫으면 브라우저가 지웁니다.
4. 값이 없으면 (새 탭 · 직접 들어옴) N12 `GET /api/concerts/bookings/{id}` 의 `expiresIn` 으로 한 번 복구합니다.
5. 0초가 되면 「결제하기」를 막습니다. 토스 결제창 안에 있던 사람은 돌아와서 N16 을 불러도 됩니다 (서버가 60초 더 받음 · 넘으면 410).
6. 지우는 때

| 상황 | 할 일 |
| --- | --- |
| 결제 완료 (N16 `CONFIRMED`) | 삭제 |
| 결제 거절 (N16 `PENDING`) | **지우지 않음** — 선점 · 타이머 그대로 · 새 `pgOrderId` 로 결제창 다시 |
| 0초 | 삭제 · “선점 시간이 끝났어요” → N7 (서버 호출 없음 — 서버가 정리) |
| 410 `HOLD_EXPIRED` · N16 `EXPIRED` · 409 `BOOKING_CANCELLED` | 삭제 · N7 |
| 「취소」 · 「좌석 다시 고르기」 버튼 | **N13 `POST /api/concerts/bookings/{id}/cancel`** 후 삭제 — 안 부르면 그 좌석이 서버 마감(9분)까지 다른 사람에게 `HELD`(회색)로 보이고, 내가 다른 좌석을 고르면 409 `HOLD_EXISTS` |

| 에러 | HTTP | 처리 |
| --- | --- | --- |
| `SEAT_TAKEN` | 409 | **“이미 선택된 좌석입니다”** — 남이 선점 · 결제 중 · 판매 → N7 새로고침 · 다른 좌석 |
| `HOLD_EXISTS` | 409 | 🆕 내 선점이 다른 좌석에 있음 → `result.bookingId` 로 N13 후 다시 (또는 그 선점으로 결제 이어가기 — N12) |
| `SEAT_LIMIT_EXCEEDED` | 409 | 이 공연은 1인 1석 (이미 확정 예매 있음) |
| `SEAT_NOT_FOUND` | 404 | — |
| `ENTRY_TOKEN_REQUIRED` | 403 | 대기열 입장부터 |
| `QUEUE_NOT_ADMITTED` | 403 | 🆕 11/04 입장 10분 지남 · 입장 전 → 대기열 다시 |
| `ENTRY_TOKEN_INVALID` | 403 | 🆕 11/04 다른 입장 토큰 → N5 로 토큰 다시 받기 |
| `QUEUE_NOT_OPEN` · `QUEUE_CLOSED` | 409 · 410 | 대기열을 끈 공연의 예매 오픈 전 · 판매 끝 |
| `QUEUE_UNAVAILABLE` | 503 | 입장 확인 불가 (대기열 Redis 장애) — `result.retryAfterMs` 뒤 재시도 |
| `ALREADY_PAID` | 409 | 지난 선점이 정리 직전에 결제됨 → N12 |
| `PAYMENT_UNAVAILABLE` | 503 | 결제 준비 실패 — 선점은 풀림 · 잠시 후 다시 |

### N16 ✅ 티켓 결제 승인

`POST /api/concerts/bookings/{id}/confirm` · 🔒C — 「결제하기」 → 토스 결제창 → successUrl 에 돌아온 뒤 호출. 서버가 내 선점을 **결제 중**으로 바꾼 뒤에만 토스 승인을 부릅니다 (선점 시간이 지났으면 토스를 부르지 않음 — 돈이 나가지 않음). 입장 토큰은 보내지 않습니다.

```json
// Request — paymentKey = successUrl 쿼리 값 · amount = N10 의 amount
{ "paymentKey": "tgen_20261101150212abcd", "amount": 88000 }

// Response
{ "bookingId": 3301, "status": "CONFIRMED", "paymentStatus": "APPROVED" }
{ "bookingId": 3301, "status": "PENDING", "paymentStatus": "DECLINED", "reason": "REJECT_CARD_PAYMENT", "pgOrderId": "TICKET-…" }   // ✏️ 11/04 80B 거절 — 선점 유지 · 이 pgOrderId 로 결제창 다시
{ "bookingId": 3301, "status": "EXPIRED", "paymentStatus": "DECLINED", "reason": "REJECT_CARD_PAYMENT" }   // 거절됐고 선점 시간도 끝남 → N7
```

| 에러 | HTTP | 처리 |
| --- | --- | --- |
| `HOLD_EXPIRED` | 410 | 🆕 선점 시간(서버 9분) 지남 · 남이 가져감 — **돈은 나가지 않음** → 좌석 다시 고르기 |
| `BOOKING_CANCELLED` | 409 | 취소된 예매 → 좌석 다시 고르기 |
| `ALREADY_PAID` | 409 | 이미 결제됨 → N12 |
| `SEAT_LOCKED` | 409 | 같은 결제를 처리 중 (연타) — 잠시 후 N12 |
| `AMOUNT_MISMATCH` | 400 | 금액 변조 (선점은 그대로) |
| `PAYMENT_PENDING` | 503 | 🆕 결과 확인 중 — 좌석은 내 것으로 잡혀 있음 · 1분쯤 뒤 서버가 확정 또는 반환 → N12 로 상태 확인 (다시 결제하지 않기) |

### 4-4. 내 예매 · 입장 QR

| ID | 메서드 · 경로 | 인증 | Response | 에러 |
| --- | --- | --- | --- | --- |
| N11 ✅ | `GET /api/concerts/bookings?cursor=&size=` | 🔒 | `CursorPage<BookingSummary>` | — |
| N12 ✅ | `GET /api/concerts/bookings/{id}` | 🔒 | `BookingDetail` | `NOT_FOUND` 404 (남의 예매 포함) |
| N13 ✅ | `POST /api/concerts/bookings/{id}/cancel` | 🔒C | `BookingDetail` — 좌석 반환 · **결제된 티켓 환불도 여기서만** | `BOOKING_NOT_CANCELLABLE` 409 |
| N17 ✅ | `GET /api/concerts/bookings/{id}/entry-qr` | 🔒 | `{ token, expiresAt }` | 아래 |

### N17 입장 QR

모바일 티켓을 연 동안 **20초마다** 부르고, `token` 문자열을 **그대로** QR 로 그립니다 (프론트가 QR 내용을 만들지 않음). 토큰은 30초 뒤 무효라 캡처본은 검표에서 거절됩니다. 티켓을 닫거나 화면이 안 보이면 타이머를 멈춥니다.

| 에러 (409) | `result` | 화면 |
| --- | --- | --- |
| `ENTRY_NOT_OPEN` | `{ opensAt }` | QR 자리에 “HH:mm 부터 열려요” (공연 3시간 전) |
| `ALREADY_CHECKED_IN` | `{ checkedInAt }` | “입장 완료 HH:mm” · QR 없음 |
| `ENTRY_CLOSED` | — | “입장 시간이 지났어요” |
| `ENTRY_NOT_AVAILABLE` | — | 결제 전 · 취소된 예매 |
- 「QR 저장」 버튼은 두지 않습니다 (저장본은 30초 뒤 무효). 「티켓 정보 저장」(QR 없는 이미지)은 괜찮습니다.
- 티켓은 배송이 없습니다 — 배송지를 묻지 않습니다.

---

## 5. 결제 — Payment (토스페이먼츠 테스트 환경)

### 5-0. 토스 SDK 연동

```html
<script src="https://js.tosspayments.com/v2/standard"></script>
```

```jsx
const toss = TossPayments(CLIENT_KEY);                         // test_gck_… (클라이언트 키만 · 시크릿 키는 프론트에 두지 않음)
const widgets = toss.widgets({ customerKey: TossPayments.ANONYMOUS });   // 회원 id · 이메일 넣지 않기
await widgets.setAmount({ currency: "KRW", value: amount });   // C9 · N10 응답의 amount 그대로
await widgets.renderPaymentMethods({ selector: "#payment-method" });
await widgets.renderAgreement({ selector: "#agreement" });
await widgets.requestPayment({
  orderId: pgOrderId,                                          // C9 · N10 응답의 pgOrderId
  orderName: "…",
  successUrl: location.origin + "/payments/success",           // ?paymentKey&orderId&amount 가 붙어 돌아옴
  failUrl: location.origin + "/payments/fail",                 // ?code&message
});
```

- successUrl 에 돌아오면 승인 API — 굿즈는 **P1**(결제 준비 후 10분 안), 티켓은 **N16**(N10 의 `expiresAt` · 선점 뒤 8분 안 · 서버는 60초 더 — ✏️ 11/04 77A 토스의 인증 뒤 10분보다 먼저 끝남).
- failUrl 이면 승인 API 를 부르지 않고 `message` 와 「다시 결제」(같은 `pgOrderId` · `amount` 로 `requestPayment`)를 보여줍니다.
- 가상계좌는 받지 않습니다 (결제 UI 설정에서 빼기). 테스트 키로는 카카오페이 · 페이코가 결제되지 않으니 시연은 카드 · 토스페이로.
- 동작하는 예시: `backend/local/toss-test/index.html`

### 5-1. 타입

```tsx
interface PaymentView {
  paymentId: number;
  orderType: "GOODS" | "TICKET";
  orderRef: string;              // 굿즈 = orderId · 티켓 = bookingId
  amount: number;
  status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
  method?: string;
  reason?: string;               // 거절 · 취소 사유 (토스 에러 코드)
  requestedAt: string;
  completedAt?: string;
}
```

### P1 ✅ 결제 승인 (굿즈 전용)

`POST /api/payments/confirm` · 🔒C

```json
// Request — successUrl 쿼리 세 개 그대로 (orderId = C9 의 pgOrderId)
{ "paymentKey": "tgen_20261101150212abcd", "orderId": "GOODS-3f2b9c1e-…", "amount": 59000 }
```

Response `PaymentView` — `status: APPROVED` 면 C11 주문 상세(CONFIRMED) · `DECLINED` 면 `reason` 표시 후 다시 결제 또는 C12 취소

| 에러 | HTTP | 처리 |
| --- | --- | --- |
| `AMOUNT_MISMATCH` | 400 | 금액 변조 |
| `NOT_FOUND` | 404 | 남의 · 없는 `orderId` |
| `ALREADY_CONFIRMED` | 409 | 이미 승인 → 주문 상세 |
| `PAYMENT_EXPIRED` | 409 | 시간 초과 → 다시 주문 |
| `PAYMENT_NOT_PENDING` | 409 | 진행 불가 |
| `USE_BOOKING_CONFIRM` | 409 | 티켓은 N16 으로 |
| `PG_UNAVAILABLE` · `PG_PROCESSING` | 503 | 결과 확인 중 (토스 불통 · 토스가 아직 처리 중) → P2 로 상태 확인 |

### 5-2. 내 결제

| ID | 메서드 · 경로 | 인증 | Request | Response | 에러 |
| --- | --- | --- | --- | --- | --- |
| P2 ✅ | `GET /api/payments/me` | 🔒 | `?cursor=&size=` | `CursorPage<PaymentView>` | — |
| P3 ✅ | `GET /api/payments/{id}` | 🔒 | — | `PaymentView` | `NOT_FOUND` 404 |
| P4 ✅ | `POST /api/payments/{id}/cancel` | 🔒C | `{ reason? }` (100자 · 본문 생략 가능) | `PaymentView` — **굿즈만** 취소 · 환불 | `USE_BOOKING_CANCEL` 409 (티켓 → N13) · `PAYMENT_NOT_CANCELLABLE` 409 (거절된 결제) · `PG_CANCEL_REJECTED` 502 |

> 🧪 거절 화면 테스트 — P1 · N16 에 헤더 `X-Force-Decline: REJECT_CARD_PAYMENT` 를 붙이면 토스가 그 에러를 재현해 `DECLINED` 가 됩니다 (테스트 키 전용). ✏️ 11/04 **로컬 백엔드에서만** — 운영 서버는 이 헤더를 무시합니다.
> 

---

## 6. 화면 흐름

### 6-1. 로그인 · 가입

```
G1 (페이지 이동) → 카카오 로그인 (동의 항목 닉네임 · 이메일) → 콜백
 ├─ 기존 회원 → 302 /        → G3
 └─ 처음     → 302 /signup   (아직 회원 아님 · G3 은 401 · 🔒 API 불가)
     ① 약관 동의 ✏️ 11/05 — M24 → 전체 동의 · [필수] 만 14세 이상 · [필수] 이용약관 · [필수] 개인정보 · [선택] 마케팅
        필수를 다 체크해야 「다음」 · 체크 상태는 화면에만 (서버 호출 없음)
     ② 밴드 고르기 — X4 첫 세트                    ← 보여 준 id 를 shown 에 모음
        밴드를 처음 누르면 X4 ?artistId={id}&exclude={shown}&size=3 → 「○○와 비슷한 밴드」 섹션 (선택은 화면에서만)
     ③ 「완료」 · 「건너뛰기」 → G13 { artistIds, agreements }
       ├─ 200 → 홈 (G3 다시)
       ├─ 409 TERMS_OUTDATED → M24 다시 → ① 부터
       └─ 401 SIGNUP_EXPIRED · SIGNUP_INVALID → "가입 시간이 지났어요" · "가입 정보를 확인할 수 없어요" → G1
```

- 가입 중간에 나가면 아무것도 저장되지 않습니다. 장르 · 배송지 · 본인인증은 묻지 않습니다.
- ②에서 새로고침하면 ①의 체크가 사라집니다 — ①부터 다시 보여 주세요.

### 6-2. 굿즈 · 음반 구매

```
C8 상품 확인 (가격 · 재고)
M19 배송지 — 기본 배송지 미리 선택 · 「변경」 목록 · 「새 주소」 (§2-5 검색 + 저장하면 M20)
    배송지가 하나도 없으면(첫 결제) 입력칸만 → M20 { …, isDefault: true }
 └▶ C9 { items, shipping } → { orderId, amount, pgOrderId, expiresAt }
     └▶ 토스 requestPayment({ orderId: pgOrderId }) → successUrl ?paymentKey&orderId&amount
         └▶ P1 (10분 안에)
             ├─ APPROVED → C11 (CONFIRMED)
             ├─ DECLINED → reason · 다시 결제 or C12
             └─ 409 PAYMENT_EXPIRED → 다시 주문
```

### 6-3. 공연 예매

```
N2 → queueEnabled ?
 ├─ true  → N4 → N5 를 pollAfterMs 마다 → ADMITTED { entryToken } (나갈 때 N6)
 └─ false → 바로
     └▶ N7 좌석 → N10 { seatId } [+ X-Entry-Token] → 선점 { bookingId, amount, pgOrderId, expiresAt, expiresIn }  (409 SEAT_TAKEN → N7)
          └▶ 결제하기 → 토스 requestPayment({ orderId: pgOrderId }) → successUrl
               └▶ N16 { paymentKey, amount } (expiresAt 안에 · 서버 60초 유예)
                   ├─ CONFIRMED → N12 → 모바일 티켓 (N17 QR)
                   ├─ PENDING (DECLINED) → reason · 새 pgOrderId 로 결제창 다시 (선점 · 타이머 그대로)
                   ├─ 410 HOLD_EXPIRED · EXPIRED → "선점 시간이 끝났어요" → N7
                   └─ 503 PAYMENT_PENDING → N12 로 결과 확인
     선점 풀기 · 좌석 바꾸기 → N13 후 N10
취소 · 환불은 N13 하나로
```

---

## 7. 아직 없는 API 🚧

호출하면 Gateway 가 503 `SERVICE_UNAVAILABLE` 폴백을 돌려줍니다. 화면은 데모 데이터로 먼저 만들어 주세요.

| ID | 메서드 · 경로 | 인증 | 설명 | 담당 |
| --- | --- | --- | --- | --- |
| X1 | `POST /api/chatbot` | 🔒C | 챗봇 질의 — 응답이 길어 타임아웃 30초 · 사용자당 분당 5회 (429) | chatbot-service (다른 분) |
| X2 | `GET /api/chatbot/suggestions` | 🔒 | 추천 질문 칩 | chatbot-service |
| X4 | `GET /api/chatbot/artists/similar` | **공개** | 가입 밴드 고르기 (§6-1) · `?artistId=&exclude=1,2,3&size=` — `artistId` 없으면 첫 세트(기본 24) · 있으면 비슷한 밴드(기본 3 · 최대 10) · `exclude` 최대 200 → `{ items: ArtistItem[] }` (더 없으면 `[]`) | chatbot-service |

관리자 화면(Studio `/api/studio/**` · 관리자 AI `/api/admin-ai/**`)은 사용자 앱이 아니라 관리자 대시보드용이라 24 를 봐 주세요. ✏️ 11/04 — 관리자 API 는 **`https://admin.indig.co.kr`** (KT) 에서 받습니다. `api.indig.co.kr` 로 부르면 404 이고, 관리자 로그인 쿠키도 `admin.` 호스트에만 굽습니다 (결정 56B · 57A).

프론트가 **부르지 않는** 것: G2 OAuth 콜백 · `/api/payments/webhook/*` (토스 서버 전용) · `/internal/**` · `/ingest/**`.

---

## 8. 에러 코드

### 8-1. 공통

| code | HTTP | 언제 | 처리 |
| --- | --- | --- | --- |
| `TOKEN_INVALID` · `TOKEN_EXPIRED` · `TOKEN_REVOKED` · `UNAUTHENTICATED` | 401 | 로그인 안 됨 · 만료 | §0-6 (G5 1회 → 로그인 화면) |
| `REFRESH_INVALID` · `REFRESH_REUSED` | 401 | RT 무효 · 재사용 탐지 | 로그인 화면 |
| `CSRF_COOKIE_MISSING` · `CSRF_HEADER_MISSING` · `CSRF_MISMATCH` | 403 | `XSRF-TOKEN` 쿠키 없음 · `X-XSRF-TOKEN` 헤더 없음 · 불일치 (11/04 분리) | G3 로 토큰 다시 받고 재시도 |
| `FORBIDDEN` | 403 | 권한 없음 | 안내 |
| `INVALID_REQUEST` · `BAD_REQUEST` · `INVALID_CURSOR` | 400 | 파라미터 · 본문 오류 | `message` 표시 |
| `NOT_FOUND` | 404 | 없음 · **남의 주문 · 예매 · 결제** | 404 화면 |
| `METHOD_NOT_ALLOWED` | 405 | 메서드 오류 | — |
| `PAYLOAD_TOO_LARGE` | 413 | 본문 1 MiB 초과 | — |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | JSON 아님 | — |
| `TOO_MANY_REQUESTS` | 429 | 호출 과다 | 잠시 후 재시도 |
| `HEADER_TOO_LARGE` | 431 | 헤더 · 쿠키 과다 | — |
| `INTERNAL_ERROR` | 500 | 서버 오류 | `correlationId` 와 함께 제보 |
| `SERVICE_UNAVAILABLE` · `GATEWAY_TIMEOUT` | 503 · 504 | 서비스 장애 · 지연 | “잠시 후 다시” |

### 8-2. 도메인

| 서비스 | code | HTTP | 기본 메시지 |
| --- | --- | --- | --- |
| 가입 | `SIGNUP_EXPIRED` | 401 | 가입 시간이 지났어요. 다시 로그인해주세요 |
| 가입 | `SIGNUP_INVALID` | 401 | 가입 정보를 확인할 수 없어요. 다시 로그인해주세요 |
| 가입 | `REQUIRED_AGREEMENT_MISSING` | 400 | 필수 약관에 동의해주세요 (✏️ 11/05) |
| 가입 | `TERMS_OUTDATED` | 409 | 약관이 바뀌었어요. 다시 확인하고 동의해주세요 (✏️ 11/05) |
| 약관 | `TERMS_NOT_FOUND` | 404 | 약관을 찾을 수 없어요 (✏️ 11/06 M25 · 시행 중인 버전 없음) |
| 회원 | `INVALID_NICKNAME` | 400 | 닉네임은 공백 없이 2~10자입니다 (공백 · 제어문자 · 금칙어) |
| 회원 | `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` | 400 | 닉네임은 2자 이상입니다 · 닉네임은 10자까지입니다 |
| 회원 | `ACCOUNT_WITHDRAWN` | 409 | 탈퇴한 계정입니다 |
| 배송지 | `ADDRESS_LIMIT_EXCEEDED` | 409 | 배송지는 최대 10개까지 저장할 수 있습니다 |
| 카탈로그 | `ARTIST_NOT_FOUND` · `PRODUCT_NOT_FOUND` | 404 | 아티스트를 · 상품을 찾을 수 없습니다 |
| 검색 | `SEARCH_QUERY_EMPTY` · `SEARCH_QUERY_TOO_LONG` | 400 | 검색어를 입력해주세요 · 검색어는 50자까지입니다 |
| 주문 | `OUT_OF_STOCK` | 409 | 재고가 부족합니다 |
| 주문 · 예매 | `PAYMENT_UNAVAILABLE` | 503 | 결제를 처리하지 못했습니다. 잠시 후 다시 시도해주세요 |
| 대기열 | `QUEUE_NOT_OPEN` | 409 | 아직 예매가 열리지 않았습니다 |
| 대기열 | `QUEUE_DISABLED` | 409 | 대기열 없이 예매하는 공연입니다 |
| 대기열 | `ALREADY_IN_QUEUE` | 409 | 이미 대기 중입니다 (`result.rank`) |
| 대기열 | `QUEUE_CLOSED` | 410 | 판매가 끝난 공연입니다 |
| 대기열 | `ENTRY_TOKEN_REQUIRED` | 403 | 대기열 입장 후 이용할 수 있습니다 |
| 대기열 | `QUEUE_NOT_ADMITTED` | 403 | 입장 시간(10분)이 지났거나 아직 입장 전입니다. 대기열에 다시 들어가주세요 |
| 대기열 | `ENTRY_TOKEN_INVALID` | 403 | 입장 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해주세요 |
| 대기열 | `NOT_IN_QUEUE` | 404 | 대기열에 없습니다 |
| 대기열 | `QUEUE_UNAVAILABLE` | 503 | 대기열을 잠시 사용할 수 없습니다 (`result.retryAfterMs`) |
| 좌석 | `SEAT_TAKEN` | 409 | 이미 선택된 좌석입니다 (✏️ 11/04 77A · `SEAT_UNAVAILABLE` 대체) |
| 좌석 | `SEAT_LIMIT_EXCEEDED` | 409 | 이 공연은 1인 1석만 예매할 수 있습니다 |
| 좌석 | `SEAT_LOCKED` | 409 | 결제를 처리하고 있습니다. 잠시 후 다시 시도해주세요 |
| 좌석 | `SEAT_NOT_FOUND` | 404 | 좌석을 찾을 수 없습니다 |
| 예매 | `HOLD_EXISTS` | 409 | 이미 선택한 좌석이 있습니다. 이전 단계에서 선택을 취소한 뒤 다시 골라주세요 (`result.bookingId`) |
| 예매 | `HOLD_EXPIRED` | 410 | 좌석 선점 시간이 지났습니다. 좌석을 다시 선택해주세요 (`SELECTION_EXPIRED` 대체) |
| 예매 | `PAYMENT_PENDING` | 503 | 결제 결과를 확인하고 있습니다. 잠시 후 예매 내역을 확인해주세요 |
| 예매 | `BOOKING_CANCELLED` | 409 | 취소된 예매입니다. 좌석을 다시 선택해주세요 |
| 예매 | `ALREADY_PAID` | 409 | 이미 결제된 예매입니다 — 예매 취소를 이용해주세요 |
| 예매 | `BOOKING_NOT_CANCELLABLE` | 409 | 취소할 수 없는 예매입니다 |
| 입장 | `ENTRY_NOT_OPEN` | 409 | 아직 입장 QR 이 열리지 않았습니다 (`result.opensAt`) |
| 입장 | `ENTRY_CLOSED` | 409 | 입장 시간이 지났습니다 |
| 입장 | `ALREADY_CHECKED_IN` | 409 | 이미 입장한 티켓입니다 (`result.checkedInAt`) |
| 입장 | `ENTRY_NOT_AVAILABLE` | 409 | 결제가 끝난 예매만 입장할 수 있습니다 |
| 결제 | `AMOUNT_MISMATCH` | 400 | 결제 금액이 주문 금액과 다릅니다 |
| 결제 | `ALREADY_CONFIRMED` | 409 | 이미 승인된 결제입니다 |
| 결제 | `PAYMENT_NOT_PENDING` | 409 | 진행할 수 없는 결제입니다 |
| 결제 | `PAYMENT_EXPIRED` | 409 | 결제 가능 시간이 지났습니다. 다시 주문해주세요 |
| 결제 | `USE_BOOKING_CONFIRM` | 409 | 티켓은 예매의 결제 승인으로만 결제할 수 있습니다 |
| 결제 | `USE_BOOKING_CANCEL` | 409 | 티켓은 예매 취소에서만 환불할 수 있습니다 |
| 결제 | `PAYMENT_NOT_CANCELLABLE` | 409 | 거절된 결제는 취소할 수 없습니다 |
| 결제 | `PG_UNAVAILABLE` | 503 | 결제사 응답이 없습니다. 잠시 후 결제 내역을 확인해주세요 |
| 결제 | `PG_PROCESSING` | 503 | 결제사가 아직 처리 중입니다. 잠시 후 결제 내역을 확인해주세요 |
| 결제 | `PG_CANCEL_REJECTED` | 502 | 결제사가 취소를 거절했습니다 |