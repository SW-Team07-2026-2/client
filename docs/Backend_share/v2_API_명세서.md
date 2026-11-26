# v2 API 명세서

> **최종본 · 기준일 2026-11-26 · 코드 기준.** 각 서비스 `main`의 컨트롤러 · DTO · ErrorCode에서 뽑았고, 지금 운영에 배포된 버전입니다.
> - 사용자 API (`https://api.indig.co.kr`): gateway `ce92e05` · member `db86528` · catalog `197d093` · concert `06373ad` · payment `8c91bf7` · chatbot `3b7b1cf`
> - 관리자 API (`https://admin.indig.co.kr` · KT): studio `eaf34a0`
>
> 11/13 이후 바뀐 내용은 모두 본문에 합쳤고, 삭제된 항목(`purchaseUrl` · Studio `otp-reset` · `/api/chatbot/artists/similar` · `/ingest/ai/documents`)은 뺐습니다. v1 문서([15](15_API_명세.md) · [23](23_프론트_API_목록.md) · [26](26_프론트_API_명세서.md))와 다르면 **이 문서가 맞습니다.**
> 화면별 확인 사항은 [v2_프론트_체크사항](v2_프론트_체크사항.md), 남은 일은 [v2_후속_작업](v2_후속_작업.md)에 있습니다. 서비스별 설계 근거는 각 저장소 `docs/v2_member_service_re.md` · `docs/v2_catalog_service_re.md` · `docs/v2_studio_service_re.md`, 챗봇 `docs/api.md`입니다.
> **아직 없는 것:** 추천 · 인기 목록(추천 서비스가 생길 때 추가).

## 목차

0. 공통 규칙
1. 인증 (Gateway `/api/auth` · `/oauth2`)
2. 회원 (member `/api/members`)
3. 카탈로그 · 장바구니 · 주문 (catalog `/api/catalog` · `/api/cart`)
4. 공연 · 대기열 · 좌석 · 예매 (concert `/api/concerts`)
5. 결제 (payment `/api/payments`)
6. 챗봇 (`/api/chatbot`)
7. 서비스 간 내부 API (`/internal/**`)
8. 관리자 API (Studio `/api/studio/**` → 각 서비스 `/internal/admin/**` · 크롤러 → Studio `/internal/crawl/**`)
9. 서명 경로 (`/ingest/**`)
10. Kafka 이벤트
11. 에러 코드
12. enum 값

---

## 0. 공통 규칙

### 0-1. 주소 · 진입

| 항목 | 값 |
|---|---|
| 사용자 API | `https://api.indig.co.kr` — Cloudflare → Gateway. `/api/*` · `/oauth2/*` 밖은 엣지에서 403 |
| 관리자 API | `https://admin.indig.co.kr` — Studio(KT) 직접. Gateway를 거치지 않습니다(8장) |
| 내부 API | 클러스터 안에서만(NetworkPolicy). 밖에서 부르면 엣지에서 403 |
| CORS | `https://indig.co.kr` + 프론트 연동 중 임시 `http://localhost:5173` · `https://sw-academy-workspace-front.vercel.app`, `credentials: true` |

### 0-2. 인증 · CSRF

- 로그인 상태는 **쿠키**입니다: `AT`(액세스 · HttpOnly) · `RT`(리프레시 · HttpOnly) · `XSRF-TOKEN`. 모든 요청에 `credentials: 'include'`. 운영 쿠키는 프론트 연동 중 임시로 `SameSite=None; Secure`입니다.
- 액세스 토큰이 곧 만료되면 Gateway가 응답에 새 쿠키를 붙입니다(만료 5분 전 선제 갱신). 실패했을 때만 프론트가 `POST /api/auth/refresh`를 부릅니다.
- **POST · PUT · PATCH · DELETE**는 `X-XSRF-TOKEN` 헤더가 쿠키 값과 같아야 합니다 → 아니면 403 `CSRF_*`. 토큰 값은 `GET /api/auth/me` 응답의 `xsrfToken`(또는 `GET /api/members/terms` 응답 헤더).
- 표의 "인증" 열: **공개** = 토큰 없이 됨 · **로그인** = 없으면 401 `TOKEN_INVALID` · **🔒C** = 로그인 + CSRF.
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
|---|---|---|
| 페이지 | `{ items, page, size, hasNext }` · `?page=0&size=20` (최대 50) | 카탈로그 · 공연 · 공연장 목록 · 검색 · 팔로우 탭 |
| 커서 | `{ items, nextCursor, hasNext }` · `?cursor=&size=` | 회원(팔로우 · 콜렉션 · 알림) · 주문 · 예매 · 결제 목록 |

- 커서는 받은 `nextCursor`를 그대로 다시 보냅니다. 깨진 커서는 400 `INVALID_CURSOR`.
- enum 파라미터에 목록 밖 값을 주면 400 `INVALID_REQUEST`(12장의 값만).
- 시각은 오프셋이 붙은 ISO-8601(`2026-11-13T15:00:00+09:00`), 날짜는 `YYYY-MM-DD`, 금액은 원 단위 정수.

### 0-5. 호출 한도 (Gateway)

| 대상 | 한도 | 초과 |
|---|---|---|
| `/api/chatbot/**` | 사용자당 분당 5회 | 429 |
| `POST /api/members/me/metrics` | 사용자당 분당 30회 | 429 `TOO_MANY_REQUESTS` |
| `POST /api/auth/refresh` | 사용자당 분당 10회 | 429 |
| `/oauth2/authorization/**` | IP당 분당 20회 | 429 |
| 검색 — `GET` 검색 · 팔로우 탭 8개(0-7) · 검색어(`q`)를 붙인 catalog · concert 조회 | 사용자(비로그인은 IP)당 분당 500회 · 한 번에 30회 | 429 `TOO_MANY_REQUESTS` |
| `/ingest/**` | 키당 초당 10건 | 429 |
| 본문 크기 | 1 MiB | 413 |
| 엣지(Cloudflare) | 같은 IP 10초 100회 | 429 HTML |

하위 서비스가 응답하지 않으면 Gateway가 503(`Retry-After`)을 냅니다(서킷 브레이커 폴백). 응답 상한은 5초이고 넘으면 504 `GATEWAY_TIMEOUT`입니다(챗봇 30초 · 결제 30초 · 예매 10초).

### 0-6. 기존 목록 API의 필터 · 정렬

검색 · 팔로우 탭 화면은 **0-7 전용 API**를 씁니다. 아래는 기존 목록 API(`GET /api/catalog/artists` · `/physical-albums` · `/goods` · `GET /api/concerts`)의 파라미터이고, 그대로 동작합니다. 추천 · 인기 탭에는 쓰지 않습니다.

- **여러 값**: 같은 이름 반복 `genre=EMO&genre=SHOEGAZE` 또는 쉼표 `genre=EMO,SHOEGAZE`. 하나라도 맞으면 나옵니다. 칩을 하나도 안 고르면 보내지 않습니다(전체). 목록 밖 값은 400.
- **아티스트 지정**: 아티스트 ID를 **`artistIds`**(아티스트 목록만 **`ids`**)로 넘깁니다. 최대 200개. 이 방식은 Catalog · Concert가 회원 팔로우를 조회하지 않으므로, 팔로우 목록을 쓰려면 프론트가 `GET /api/members/follows`(2-3)를 끝까지 받아 넘겨야 합니다(0-7 팔로우 API는 서버가 직접 읽음).
- **정렬 `sort`**:

| 화면 정렬 | 보낼 값 | `artistIds` 순서 |
|---|---|---|
| 넘긴 아티스트 순서 | `sort=ARTIST_ORDER` | 넘긴 순서 그대로 (예: 팔로우 목록 순서 · `followerCount` 내림차순으로 다시 정렬한 순서) |
| 업데이트순 | `sort=UPDATED` | 순서 무관 — 최근 수정순 (관리자 · 수집이 정보를 고친 시각 · 재고 변경은 제외) |

  `sort`를 안 보내면 목록마다 기본 순서(아티스트 가나다순 · 피지컬 발매일 최신순 · 굿즈 최신 등록순 · 공연 공연일 가까운 순). `ARTIST_ORDER`에서 같은 아티스트끼리는 그 기본 순서이고, 공연은 라인업 중 **가장 앞 순서의 아티스트** 기준입니다. `ARTIST_ORDER`인데 아티스트 ID가 없으면 400 · `artistId`(하나)와 `artistIds`를 같이 보내면 400.
- **가격대** `minPrice` · `maxPrice`(원 · 경계 포함): 목록 항목의 `minPrice`(옵션 최저가) 기준. `maxPrice`가 150000 이상이면 상한 없음. `minPrice > maxPrice`는 400.
- **검색어** `q`: 0-7과 같은 규칙(부분 일치 · 최대 100자).
- **공연 진행 현황** `saleStatus`: 고르면 지난 공연(판매종료)도 나옵니다. 안 고르면 지금 이후 공연만.
- 예: `GET /api/catalog/goods?artistIds=12,3,7&category=TSHIRT,HAT&maxPrice=50000&sort=ARTIST_ORDER&page=0&size=20` · `GET /api/concerts?artistIds=12,3&saleStatus=ON_SALE,SCHEDULED&region=SEOUL,GYEONGGI&type=SOLO&sort=UPDATED`

### 0-7. 검색 · 팔로우 탭 API

프론트 요구 문서(카테고리별 필터 · 세그먼트 · 검색) 기준입니다. 검색 범위는 **전체**와 **팔로우** 두 가지라 카테고리마다 API가 2개입니다. 검색 모드의 "전체"(추천 + 인기 합침)는 아래 전체 API를 씁니다.

| 카테고리 | 전체 (공개) | 팔로우 (로그인) | 칩 |
|---|---|---|---|
| 아티스트 | `GET /api/catalog/search/artists` | `GET /api/catalog/following/artists` | `genre` · `gender` · `composition` |
| 앨범 (LP · CD · 카세트) | `GET /api/catalog/search/physical-albums` | `GET /api/catalog/following/physical-albums` | `format` · `minPrice` · `maxPrice` · `excludeSoldOut` |
| 굿즈 | `GET /api/catalog/search/goods` | `GET /api/catalog/following/goods` | `category` · `minPrice` · `maxPrice` · `excludeSoldOut` |
| 공연 | `GET /api/concerts/search` | `GET /api/concerts/following` | `saleStatus` · `type` · `region` · `genre` |

- **파라미터**: `q?` · 칩 · `page`(0부터) · `size?`(기본 20 · 최대 50). `sort?`는 팔로우 API만. **응답은 기존 목록과 같습니다** — `{ items, page, size, hasNext }` · 항목은 3-1 · 4-1 목록 항목(`ArtistItem` · 피지컬 · 굿즈 항목 · `ConcertSummary`). 무한 스크롤은 `hasNext`로, 새로고침은 같은 조건으로 `page=0`.
- **검색어 `q`**: SQL LIKE 부분 일치(`%검색어%`) · 대소문자 무시 · 최대 100자(넘으면 400 `INVALID_REQUEST` · 목록 API의 `q`도 같음 · 통합 검색 `GET /api/catalog/search`만 50자 `SEARCH_QUERY_TOO_LONG`). **비우면 칩만으로 조회**. 대상: 아티스트 = 이름 · 앨범 = 상품명 · 앨범 제목 · 아티스트 이름 · 굿즈 = 굿즈명 · 아티스트 이름 · 공연 = 제목 · 라인업 아티스트 이름 · 공연장 이름.
- **조건 결합**: 같은 칩 안에서 여러 개 = OR (`genre=EMO,SHOEGAZE` 또는 `genre=EMO&genre=SHOEGAZE`) · 서로 다른 칩 · 검색어 · 범위(팔로우) = AND. 안 고른 칩은 보내지 않습니다. 목록 밖 값 400.
- **가격대**: `minPrice` · `maxPrice`(원 · 경계 포함 · 대표가 = 옵션 최저가 = 항목 `minPrice` 기준). 슬라이더 전체(0원 ~ 15만원 이상)는 둘 다 빼기. **`maxPrice`가 150000 이상이면 상한 없음**("15만원 이상" · 보내도 되고 빼도 됨). `minPrice > maxPrice` 400.
- **품절 안 보기** `excludeSoldOut=true` — 재고가 남은 옵션이 하나라도 있는 상품만(항목 `soldOut: false`와 같은 기준). 보내지 않거나 `false`면 품절 · 판매중 전부(기본). 기존 목록 `GET /api/catalog/physical-albums` · `/goods`도 같음.
- 아티스트 **성별** `gender` (`MALE` 남자 · `FEMALE` 여자 · `MIXED` 혼성) · **구성** `composition` (`SOLO` 솔로 · `GROUP` 팀). 여러 개면 OR · 서로 다른 칩과는 AND · "전체"는 파라미터를 빼기. 값을 모르는 아티스트는 칩을 고르면 빠짐. 기존 `GET /api/catalog/artists`도 같음.
- **공연 진행 현황**: 예매 시간 기준 — 예매 오픈 전(오픈 시각 미정 포함) `SCHEDULED` 판매전 · 오픈 ~ 공연 시작 `ON_SALE` 판매중 · 공연 시작 이후 `CLOSED` 판매종료. 응답 항목의 `saleStatus`와 같은 값. 안 고르면 지금 이후 공연만 · 고르면 지난 공연(`CLOSED`)도.
- **공연 장르** `genre`: 공연 장르이거나 **출연(라인업) 아티스트 중 누군가의 대표 장르**가 고른 장르 중 하나면 포함. 대표 장르 = 아티스트 장르 목록의 첫 번째(`genres[0]`) — 두 번째 장르로는 걸리지 않음 (예: 혁오 `INDIE_ROCK, ALTERNATIVE`는 `INDIE_ROCK`으로만). 단독 공연은 공연 장르 = 아티스트 대표 장르이고, 페스티벌은 라인업 장르로도 걸림. 기존 `GET /api/concerts`도 같은 규칙입니다.
- **전체 API 정렬 (고정)**: 아티스트 가나다순 · 앨범 발매일 최신순 · 굿즈 최신 등록순 · 공연 공연일 가까운 순.
- **팔로우 `sort`** (없으면 `RECENT_FOLLOW`):

| 화면 | 값 | 아티스트 탭 | 앨범 · 굿즈 · 공연 탭 |
|---|---|---|---|
| 최근 팔로우순 (기본) | `RECENT_FOLLOW` | 최근에 팔로우한 아티스트부터 | 최근에 팔로우한 아티스트의 항목부터 |
| 팔로워순 | `FOLLOWERS` | 팔로워가 많은 아티스트부터 (지금 팔로워 수) | 팔로워가 많은 아티스트의 항목부터 |
| 업데이트순 | `UPDATED` | **새소식이 가장 최근인 아티스트부터** — 앨범 발매일 · LP/CD/카세트 발매일 · 굿즈 등록 시각 · 공연 등록 · 수정 시각 중 가장 늦은 날짜. 소식이 없으면 뒤 | 항목이 최근에 등록 · 수정된 순 |

  같은 아티스트의 항목끼리는 전체 API 정렬 순서이고, 공연은 라인업 중 가장 앞 순서의 아티스트 기준입니다.
- **팔로우 API**: 서버가 로그인 회원의 팔로우 목록을 직접 읽습니다 — 프론트는 `GET /api/members/follows`를 먼저 부르거나 `artistIds`를 넘길 필요가 없습니다. 팔로우가 0개면 `{ items: [], hasNext: false }`. 비로그인 · 토큰 만료는 401 `UNAUTHENTICATED`(재발급 뒤 다시 부르기). 회원 서비스 장애 503 `FOLLOW_UNAVAILABLE`.
- **장애**: Catalog 장애 때 `/api/catalog/search/**`는 Gateway가 200 + `{ items: [], degraded: true }`를 돌려줍니다(`hasNext` 없음 → 더 불러오지 않기).
- 예: `GET /api/catalog/search/goods?q=혁오&category=TSHIRT,HAT&minPrice=30000&maxPrice=150000&page=0` · `GET /api/concerts/following?saleStatus=ON_SALE&region=SEOUL,GYEONGGI&sort=FOLLOWERS` · `GET /api/catalog/following/artists?genre=INDIE_ROCK&sort=UPDATED`

---

## 1. 인증 (Gateway)

쿠키를 굽는 주체가 Gateway라서 member로 라우팅하지 않고 Gateway가 직접 응답합니다.

| 메서드 · 경로 | 인증 | 요청 | 응답 · 규칙 |
|---|---|---|---|
| `GET /oauth2/authorization/kakao` | 공개 | 프론트 연동 중 임시: `?frontend=local`(`http://localhost:5173`로 복귀) · `?frontend=vercel`(`https://sw-academy-workspace-front.vercel.app`로 복귀). 없으면 `https://indig.co.kr` | 카카오 로그인 화면으로 302 |
| `GET /oauth2/code/kakao` | 공개 | (카카오가 부름) | 기존 회원 → AT · RT 쿠키 + 프론트 `/`로 302 · 새 회원 → `SIGNUP` 쿠키 + `/welcome`으로 302 · 실패 · 취소 → `/?error=oauth_failed` · 가입 준비 실패 → `/?error=signup_failed` |
| `GET /api/auth/me` | 로그인 | | `{ userId, nickname, profileImageUrl, roles: ["USER"], xsrfToken, stale? }`. member가 응답하지 않으면 200 + `stale: true`(클레임만). 비로그인은 401(정상 분기) |
| `POST /api/auth/refresh` | 공개(RT 쿠키) | | 성공 시 쿠키 재발급 · 본문 없음. RT 거절 → 401 `REFRESH_INVALID` · `REFRESH_REUSED` + 쿠키 삭제 → 로그인 화면. member 불통 → 503(쿠키 유지) |
| `POST /api/auth/logout` | 공개 | | 쿠키 삭제 · 항상 200 |
| `GET /api/auth/signup` | 공개(`SIGNUP` 쿠키) | | 가입 화면에 들어와도 되는지. 있으면 200, 없으면 401 `SIGNUP_EXPIRED` |
| `POST /api/auth/signup` | 공개(`SIGNUP` 쿠키) + CSRF | `{ artistIds: [Long] (1~50개 · 필수), agreements: [{ termsId, agreed }] }` | AT · RT 쿠키 발급, `SIGNUP` 삭제. 401 `SIGNUP_EXPIRED` · `SIGNUP_INVALID`(→ 로그인 화면) · 400 `REQUIRED_AGREEMENT_MISSING` · 409 `TERMS_OUTDATED`(약관 다시 받아 재시도 · `SIGNUP` 유지) |

- `artistIds`는 **1개 이상 필수**입니다(빈 배열 400). member는 아티스트가 Catalog에 있는지 확인하지 않습니다.
- `agreements`는 `GET /api/members/terms`의 약관 4개(`AGE14` · `TOS` · `PRIVACY` 필수, `MARKETING` 선택) `termsId`를 그대로 씁니다.
- `SIGNUP` 쿠키는 30분입니다.

---

## 2. 회원 (member)

### 2-1. 내 정보 · 탈퇴

| 메서드 · 경로 | 인증 | 요청 | 응답 |
|---|---|---|---|
| `GET /api/members/me` | 로그인 | | `{ userId, nickname, profileImageUrl, email, provider, followCount, collectionCount }` |
| `PATCH /api/members/me` | 🔒C | `{ nickname }` (2~10자) | `{ userId, nickname }` · 400 `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` · `INVALID_NICKNAME` |
| `DELETE /api/members/me` | 🔒C | | `null`. **즉시 hard delete** + `user.withdrawn` 발행. Gateway가 응답에 AT · RT · XSRF 만료 쿠키를 붙입니다. 같은 카카오 계정으로 다시 가입하면 새 회원 |

### 2-2. 배송지

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `GET /api/members/me/addresses` | 로그인 | `{ items: [ShippingAddressView] }` |
| `POST /api/members/me/addresses` | 🔒C | `{ label?, recipientName, phone, zonecode(5자리), address, addressDetail?, isDefault? }` → `ShippingAddressView`. 10개 넘으면 409 `ADDRESS_LIMIT_EXCEEDED` |
| `PUT /api/members/me/addresses/{id}` | 🔒C | 같은 본문 → `ShippingAddressView` |
| `POST /api/members/me/addresses/{id}/default` | 🔒C | 기본 배송지로 → `ShippingAddressView` |
| `DELETE /api/members/me/addresses/{id}` | 🔒C | 204. 기본을 지우면 다른 배송지가 기본을 이어받음 |

`ShippingAddressView = { id, label, recipientName, phone, zonecode, address, addressDetail, isDefault }` · 남의 배송지는 404.

### 2-3. 팔로우 · 보유 음반(콜렉션)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `POST /api/members/follows/{artistId}` | 🔒C | 멱등. `{ artistId, following: true }` |
| `DELETE /api/members/follows/{artistId}` | 🔒C | 204 |
| `GET /api/members/follows` | 로그인 | 커서 · `[{ artistId, followedAt, followerCount }]` 최근 팔로우순 · `followerCount` = 그 아티스트의 전체 팔로워 수 |
| `GET /api/members/follows/{artistId}` | 로그인 | `{ following }` |
| `GET /api/members/collections` | 로그인 | 커서 · `[CollectionItem]` |
| `GET /api/members/collections/{id}` | 로그인 | `CollectionItem` |
| `POST /api/members/collections` | 🔒C | `{ physicalAlbumId, optionId, acquiredAt? }` — **옵션 필수** → `CollectionItem` |
| `DELETE /api/members/collections/{id}` | 🔒C | `null` |

- `CollectionItem = { id, physicalAlbumId, optionId, source(MANUAL·PURCHASE), acquiredAt }` — 이름 · 이미지는 없습니다. `GET /api/catalog/products?ids=`로 채웁니다.
- 주문이 확정되면(`order.confirmed`) 구매한 옵션이 자동으로 추가됩니다(`source: PURCHASE`). 같은 옵션은 한 번만.

### 2-4. 알림

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `GET /api/members/notifications` | 로그인 | 커서 · `[{ id, type, target, targetId, artistId, message, isRead, createdAt }]` 최신순 |
| `GET /api/members/notifications/badge` | 로그인 | `{ count }` (안 읽은 수 · 상한 있음) |
| `POST /api/members/notifications/{id}/read` | 🔒C | 하나 읽음 → `{ notificationId, isRead: true }`. 없거나 지난 알림은 404 → 목록에서 지우기 |
| `POST /api/members/notifications/read` | 🔒C | 전체 읽음 · `null` |

- 나의 알림(주문 · 예매)과 팔로우한 아티스트 소식 · 공연 변경 공지가 **한 목록**입니다. 푸시 없음 · 3개월 보관.
- `target` → 이동 화면: `ALBUM` 앨범 · `PHYSICAL_ALBUM` 피지컬 앨범 · `GOODS` 굿즈 · `CONCERT` 공연 · `ORDER` 내 주문 · `BOOKING` 내 예매.

### 2-5. 약관 · 동의

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `GET /api/members/terms` | 공개 | `{ items: [{ termsId, code, version, title, content, required }] }` — 가입 화면용 4개. 응답 헤더 `X-XSRF-TOKEN` |
| `GET /api/members/terms/{code}` | 공개 | 푸터 문서 1개(`TOS` · `PRIVACY_POLICY` 등) · 없으면 404 `TERMS_NOT_FOUND` |
| `GET /api/members/me/agreements` | 로그인 | `{ items: [{ termsId, code, version, title, required, agreed, at }] }` |
| `PUT /api/members/me/agreements/marketing` | 🔒C | `{ agreed }` → `{ agreed, at }` |

- 지금 시행 중인 버전 = `effective_at`이 지난 것 중 가장 최근입니다. 11/26 기준 `AGE14` v1 · `TOS` v1 · `PRIVACY` v3 · `MARKETING` v1 · `PRIVACY_POLICY` v3.
- 시행 예정: `PRIVACY_POLICY` v4 (2026-12-01) · `TOS` v2 (2026-12-02). 시행일이 지나면 위 API가 새 버전을 돌려주고, 옛 `termsId`로 가입하면 409 `TERMS_OUTDATED`입니다.

### 2-6. 행동 메트릭 · 챗봇 장기기억

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `POST /api/members/me/metrics` | 🔒C | `{ events: [MetricEvent] }` (1~50개) → `{ saved }`(새로 저장된 수 · 같은 `metricId`는 0). 분당 30회(429). 서버가 남기는 종류(12장 "서버 기록")는 보내도 그 건만 버림 |
| `GET /api/members/me/chat-history` | 로그인 | `{ messages: [{ role(USER·ASSISTANT), content(≤200자), spokenAt }] }` 최대 50개 |
| `POST /api/members/me/chat-history` | 🔒C | `{ messages: [...] }` (1~50개) → 저장 뒤 전체. 50개 넘으면 오래된 것부터 삭제 |

`MetricEvent = { metricId(UUIDv7 · 필수), sessionId?, pageViewId?, targetType, targetId, metricType, metricValue(≥0), properties?, occurredAt(오프셋 포함) }` — 같은 `metricId`는 한 번만 저장. 값 목록은 12장. 보내는 시점(버퍼 · `keepalive`)은 프론트 체크사항.

장바구니 담기 · 빼기 · 검색어 · 팔로우 · 언팔로우 · 구매 · 예매는 서버가 직접 남깁니다(10장 `user.metric` · `member.activity` · `order.confirmed` · `booking.completed`).

---

## 3. 카탈로그 · 장바구니 · 주문 (catalog)

### 3-1. 조회 (공개 · 팔로우 API만 로그인)

| 메서드 · 경로 | 파라미터 | 응답 |
|---|---|---|
| `GET /api/catalog/artists` | `q?` · `genre?` · `gender?` · `composition?`(여러 개 · 0-7) · `ids?=1,2`(최대 200) · `sort?`(0-6) · 페이지 | `[ArtistItem]` 이름 가나다순 (숫자 · 영문이 먼저) |
| `GET /api/catalog/artists/{id}` | | `{ id, name, genres[], label, debutYear, profileUrl, bio, albums[], physicalAlbums[], goods[] }` |
| `GET /api/catalog/albums` | `type?`(ALBUM·EP·SINGLE) · 페이지 | `[{ id, artistId, artistName, title, type, genres[], releasedAt, thumbnailUrl }]` |
| `GET /api/catalog/albums/{id}` | | 위 + `description` · `tracks: [{ id, trackNo, title, genres[], tempo, moods[], emotions[], styles[] }]` · `physicalAlbums[]` |
| `GET /api/catalog/physical-albums` | `format?`(LP·CD·CASSETTE · 여러 개) · `from?` · `to?`(발매일) · `artistIds?` · `q?` · `minPrice?` · `maxPrice?` · `excludeSoldOut?` · `sort?`(0-6) · 페이지 | `[{ id, albumId, albumTitle, artistId, artistName, format, name, releasedAt, thumbnailUrl, minPrice, soldOut }]` 발매일 최신순 |
| `GET /api/catalog/goods` | `artistId?` · `category?`(여러 개) · `artistIds?` · `q?` · `minPrice?` · `maxPrice?` · `excludeSoldOut?` · `sort?`(0-6) · 페이지 | `[{ id, artistId, artistName, name, category, thumbnailUrl, minPrice, soldOut }]` 최신 등록순 |
| `GET /api/catalog/products/{id}` | | `ProductDetail` |
| `GET /api/catalog/products` | `ids=1,2,3` (필수 · 최대 50) | 페이지 형식 · `[ProductDetail]` — 보유 음반 화면 · 챗봇 일괄 조회 |
| `GET /api/catalog/search` | `q`(필수 · 50자) · `size?` | `{ items: [{ type(ARTIST·ALBUM·TRACK), id, title, albumId?, score }] }` · 400 `SEARCH_QUERY_EMPTY` · `SEARCH_QUERY_TOO_LONG` |
| `GET /api/catalog/search/artists` | `q?` · `genre?` · `gender?` · `composition?` · 페이지 | `[ArtistItem]` 가나다순 (0-7) |
| `GET /api/catalog/search/physical-albums` | `q?` · `format?` · `minPrice?` · `maxPrice?` · `excludeSoldOut?` · 페이지 | 피지컬 목록과 같음 · 발매일 최신순 (0-7) |
| `GET /api/catalog/search/goods` | `q?` · `category?` · `minPrice?` · `maxPrice?` · `excludeSoldOut?` · 페이지 | 굿즈 목록과 같음 · 최신 등록순 (0-7) |
| `GET /api/catalog/following/artists` | **로그인** · `q?` · `genre?` · `gender?` · `composition?` · `sort?` · 페이지 | 내가 팔로우한 아티스트 (0-7) · 503 `FOLLOW_UNAVAILABLE` |
| `GET /api/catalog/following/physical-albums` | **로그인** · `q?` · `format?` · `minPrice?` · `maxPrice?` · `excludeSoldOut?` · `sort?` · 페이지 | 팔로우한 아티스트의 LP · CD · 카세트 (0-7) |
| `GET /api/catalog/following/goods` | **로그인** · `q?` · `category?` · `minPrice?` · `maxPrice?` · `excludeSoldOut?` · `sort?` · 페이지 | 팔로우한 아티스트의 굿즈 (0-7) |

- `ArtistItem = { id, name, genres[], debutYear, profileUrl }`
- `ProductDetail = { id, productType(PHYSICAL_ALBUM·GOODS), name, thumbnailUrl, artistId, artistName, albumId?, albumTitle?, format?, releasedAt?, category?, description?, options: [{ id, name, vinylColor?, size?, price, qty, soldOut, stockUpdatedAt }], detailImageUrls? }` — 값이 없는 칸(`?`)은 응답에서 빠집니다.
- 목록 항목의 `soldOut` = 모든 옵션 재고 0. `minPrice` = 옵션 최저가.
- **판매 단위는 옵션(`optionId`)입니다.** 가격 · 재고 · 장바구니 · 주문이 모두 옵션을 가리킵니다.
- 옵션 규칙: LP는 `vinylColor`(BLACK · COLOR), CD · 카세트는 이름만("기본"), 굿즈는 `size`(XS~XXL · FREE · 숫자 사이즈 `0`~`6`).
- 이미지 URL(`thumbnailUrl` · `profileUrl` · `detailImageUrls`)은 우리 이미지 CDN `https://img.indig.co.kr/…`입니다 (관리자가 Studio로 올린 파일 · 크롤러 후보를 승인할 때 Studio가 옮긴 파일).

**상세 설명 칸** (아티스트 · 앨범 · 굿즈 · 판본 · 공연 공통 규칙: 한글 · 사실만 · 홍보 문구 없음 · 크롤러가 출처에서 쓰고, 못 찾으면 관리자가 Studio에서 씀)

| 응답 칸 | 모양 | 없을 때 |
|---|---|---|
| `ArtistDetail.bio` | 평문 3~4문장 (1000자까지) | `null` |
| `AlbumDetail.description` | 평문 1~3문장 (1000자까지) · 앨범 자체 소개 | `null` |
| `ProductDetail.description` (굿즈) | **마크다운** 1000자 안 — 소개 1~2문장 · `## 상품 정보` · `## 관리 · 주의` · 끝 줄 `정보 출처: 호스트` | 칸 없음 |
| `ProductDetail.description` (판본 · LP · CD · 카세트) | **마크다운** 1000자 안 — `## 판 정보` · `## 수록곡` · 끝 줄 `정보 출처: Discogs (주소)` (공식 판매 페이지에서 온 것은 굿즈와 같은 모양). 그 판(색 · 장 수 · 재발매 · 구성)의 정보로, 앨범 소개 글과 따로입니다 | 칸 없음 |
| `ProductDetail.detailImageUrls` | 상세 이미지 주소 · 보여 줄 순서 · 10개까지 | 칸 없음 |
| `ConcertDetail.description` | **마크다운** — 소개 2~4문장 · `출연진 소개` · `프로그램` · `타임테이블` · `일정` · `관람 안내` · `부대 행사` · `공연장` · `출연` · `주최 · 기획`(있는 것만) · 끝 줄 `정보 출처: 공연예술통합전산망(KOPIS)` | `null` |

### 3-2. 장바구니 (조회도 로그인)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `GET /api/cart` | 로그인 | `CartView` |
| `PUT /api/cart/items/{optionId}` | 🔒C | `{ qty }`(≥1 · 수량을 이 값으로) → `CartView`. 옵션 20가지 · 옵션당 10개 넘으면 409 `CART_FULL` · 없는 옵션 404 `OPTION_NOT_FOUND` |
| `DELETE /api/cart/items/{optionId}` | 🔒C | → `CartView` |
| `DELETE /api/cart` | 🔒C | 비우기 · `null` |

`CartView = { items: [{ optionId, productId, productType, productName, optionName, vinylColor, size, thumbnailUrl, price, qty, stockQty, soldOut, addedAt }], totalPrice }` — TTL 없음, 탈퇴 때 삭제.

### 3-3. 주문 (굿즈 · 피지컬 앨범)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `POST /api/catalog/orders` | 🔒C | `{ items: [{ optionId, qty(1~1000) }], shipping: { recipientName, phone, zonecode, address, addressDetail? } }` → `{ orderId, amount, pgOrderId, status: "PENDING", expiresAt }` |
| `GET /api/catalog/orders` | 로그인 | 커서 · `[{ orderId, status, totalPrice, createdAt }]` |
| `GET /api/catalog/orders/{id}` | 로그인 | `{ orderId, status, totalPrice, pgOrderId, createdAt, shipping, items: [{ optionId, productId, productType, productName, optionName, qty, price }] }` |
| `POST /api/catalog/orders/{id}/cancel` | 🔒C | → 주문 상세. 결제 전이면 `CANCELLED`, 결제 뒤 환불되면 `REFUNDED` |

- 흐름: 주문 생성(재고 차감 · 결제 준비) → 토스 결제창(`orderId` = `pgOrderId`, `amount`) → **`POST /api/payments/confirm`**(5장) → `payment.completed`를 받아 `CONFIRMED`.
- 오류: 409 `OUT_OF_STOCK` · 400 `INVALID_OPTION` · 503 `PAYMENT_UNAVAILABLE`(재고는 되돌림). 시간 안에 결제하지 않으면 만료(재고 복구).
- 주문 상태: `PENDING` → `CONFIRMED` / `CANCELLED` / `REFUNDED`.

---

## 4. 공연 · 대기열 · 좌석 · 예매 (concert)

### 4-1. 조회 (공개 · 팔로우 API만 로그인)

| 메서드 · 경로 | 파라미터 | 응답 |
|---|---|---|
| `GET /api/concerts` | `from?` · `to?`(날짜) · `region?` · `genre?` · `type?`(SOLO·FESTIVAL) · `saleStatus?`(모두 여러 개 · 장르는 라인업 대표 장르 포함 · 진행 현황을 고르면 지난 공연 포함) · `artistId?` · `artistIds?` · `q?`(제목 · 라인업 이름 · 공연장 이름) · `sort?`(0-6) · 페이지 | `[ConcertSummary]` 공연일 가까운 순 |
| `GET /api/concerts/search` | `q?` · `saleStatus?` · `type?` · `region?` · `genre?` · 페이지 | `[ConcertSummary]` 공연일 가까운 순 (0-7) |
| `GET /api/concerts/following` | **로그인** · 위와 같음 + `sort?` | 팔로우한 아티스트가 나오는 공연 (0-7) · 503 `FOLLOW_UNAVAILABLE` |
| `GET /api/concerts/{id}` | | `ConcertDetail` |
| `GET /api/concerts/{id}/notices` | | `[{ id, concertId, kind, title, body, createdAt, updatedAt }]` 최신순 · 공연이 없으면 404 |
| `GET /api/concerts/calendar` | `month=YYYY-MM`(필수) · `artistIds?` | `{ month, days: [{ date, concerts: [ConcertSummary] }] }` |
| `GET /api/concerts/venues` | `region?` · `q?` · `hasUpcoming?` · 페이지 | `[{ id, name, region, address, capacity }]` |
| `GET /api/concerts/venues/{id}` | | `{ id, name, region, address, capacity, upcomingConcerts: [{ id, title, type, artists, startsAt, saleStatus }] }` |

- `ConcertSummary = { id, title, type, genre, artists: [{ id, name, genre }], startsAt, price, saleStatus, venue: { id, name, region }, posterUrl }` — `posterUrl`은 목록 · 캘린더 카드 포스터(상세와 같은 값 · 없으면 `null`).
- `ConcertDetail = { id, title, type, genre, artists[], startsAt, endsAt, price, saleStatus, bookingOpenAt, queueEnabled, maxSeatsPerUser, venue: { id, name, region, address, capacity }, description, terms, requirements, posterUrl, imageUrls[] }` — 뒤 5개는 없으면 `null` · 빈 배열. `description` 모양은 3-1 "상세 설명 칸".
- 🔴 **`genre` 필터는 장르 목록 23개(12장)만 받습니다.** `ROCK` · `POP` · `BALLAD` 같은 값은 400입니다(카탈로그와 같은 목록).
- `saleStatus`: `SCHEDULED`(예매 전) · `ON_SALE` · `CLOSED` (기준은 0-7).
- 변경 공지 `kind`: `SCHEDULE`(일정) · `VENUE`(장소) · `LINEUP`(출연) · `BOOKING`(예매) · `CANCEL`(취소) · `ETC`. 공지가 올라가면 라인업 팔로워와 확정 예매자에게 알림(`CONCERT_ANNOUNCED`)이 갑니다 (10장 `concert.notice_posted`). 고치거나 지우면 알림 없음.
- `posterUrl` · `imageUrls`는 `https://img.indig.co.kr/…` (Studio가 올린 파일).

### 4-2. 대기열 (로그인)

| 메서드 · 경로 | 인증 | 응답 |
|---|---|---|
| `POST /api/concerts/{id}/queue` | 🔒C | `QueueStatus` · 409 `ALREADY_IN_QUEUE` · `QUEUE_NOT_OPEN` · `QUEUE_DISABLED` · 410 `SOLD_OUT`(모든 좌석 결제 완료 — 줄을 세우지 않음 · 취소 · 환불로 풀리면 다시 받음) |
| `GET /api/concerts/{id}/queue/status` | 로그인 | `QueueStatus` · 404 `NOT_IN_QUEUE` · 410 `QUEUE_CLOSED` |
| `DELETE /api/concerts/{id}/queue` | 🔒C | 204 (나가기) |

`QueueStatus = { state(WAITING·ADMITTED·EXPIRED·SOLD_OUT), rank, total, etaSeconds, pollAfterMs, degraded, entryToken, expiresIn }`

- **`pollAfterMs`마다 다시 조회합니다 — 고정 2초로 부르지 말고 꼭 이 값대로.** 순번이 멀수록 깁니다(예상 대기의 1/3 · 2 ~ 15초 · 남은 좌석이 전부 선점 중이라 입장이 멈추면 15초).
- `pollAfterMs`(최대 15초)를 세 번 넘게 안 부르면(45초) 줄에서 빠집니다.
- 기다리다 매진되면 `SOLD_OUT`(다른 필드 없음) — 조회를 멈추고 매진 안내.
- `ADMITTED`면 `entryToken`을 좌석 · 예매 요청의 `X-Entry-Token` 헤더로 보냅니다. 대기열을 끈 공연(`queueEnabled: false`)은 토큰 없이 갑니다.

### 4-3. 좌석 · 예매 (로그인)

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
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
|---|---|---|
| `POST /api/payments/confirm` | 🔒C | **굿즈 · 피지컬 주문 전용.** `{ paymentKey, orderId(=pgOrderId), amount }` → `PaymentView`. 티켓이면 409 `USE_BOOKING_CONFIRM` |
| `GET /api/payments/me` | 로그인 | 커서 · `[PaymentView]` |
| `GET /api/payments/{id}` | 로그인 | `PaymentView` |
| `POST /api/payments/{id}/cancel` | 🔒C | `{ reason? }` → `PaymentView`. 티켓이면 409 `USE_BOOKING_CANCEL`(예매 취소로) |
| `POST /api/payments/webhook/{provider}` | 공개(서명) | 토스 웹훅 · 프론트는 부르지 않음 |

- `PaymentView = { paymentId, orderType(TICKET·GOODS), orderRef, amount, status, method, reason, requestedAt, completedAt }`
- 결제 준비(prepare)는 공개하지 않습니다. 주문 · 예매를 만들면 서비스가 준비합니다.
- 오류: 400 `AMOUNT_MISMATCH` · 409 `ALREADY_CONFIRMED` · `PAYMENT_EXPIRED` · `PAYMENT_NOT_PENDING` · `PAYMENT_NOT_CANCELLABLE` · 503 `PG_PROCESSING` · `PG_UNAVAILABLE` · 502 `PG_CANCEL_REJECTED`.
- 취소 · 환불이 503(`PG_UNAVAILABLE` · `PG_PROCESSING`)이면 실패로 보여주지 말고 "환불 처리 중"으로 안내한 뒤 결제 · 주문 · 예매 상세를 다시 조회합니다. 서버가 환불 요청을 남겨 두고 1~2분 안에 이어서 끝냅니다(다시 눌러도 환불은 한 번). 502 `PG_CANCEL_REJECTED`는 결제사가 거절한 것이라 다시 눌러도 같습니다.
- 토스 **테스트** 키입니다(실제 돈이 나가지 않음). 카드 · 토스페이만 됩니다.

---

## 6. 챗봇 (`/api/chatbot`)

Gateway가 `/api/chatbot/**`를 chatbot-service로 넘깁니다. **전부 로그인**(공개 경로 없음). 분당 5회, 응답 30초.

| 메서드 · 경로 | 인증 | 요청 · 응답 |
|---|---|---|
| `GET /api/chatbot/chat` | 로그인 | `{ count, total_count, has_truncated, messages: [{ id, role(user·bot), text, time }] }` — 기록이 없으면 첫인사 생성 |
| `POST /api/chatbot/chat/upload` | 🔒C | `multipart/form-data` `file`(PDF · 이미지 · 텍스트) → `{ file_uri, file_name, media_type, url, name, type }` (48시간 보관). **Gateway 본문 한도 1 MiB**(챗봇 한도보다 Gateway가 먼저 막음 · 413) |
| `POST /api/chatbot/chat` | 🔒C | `{ message, attachments?: [{ file_uri, file_name, media_type }] }` → **SSE 스트림** |

- SSE 이벤트: `status`(`{ status: thinking·tool_calling, message, tool? }`) · `text_delta`(`{ content }`) · `action`(`{ action, … }`) · `done`(`{ status: "completed" }`) · `error`(`{ error, code }`).
- 오류 모양이 둘입니다: Gateway가 막은 것은 공통 봉투(`code`), 챗봇이 낸 것은 `{ detail }`. 401이면 `POST /api/auth/refresh` 1회 뒤 재시도.
- 상세는 chatbot-service `docs/api.md`.

---

## 7. 서비스 간 내부 API (`/internal/**`)

Gateway를 거치지 않고 클러스터 안에서만 부릅니다. 헤더 `X-Internal-Token`(HS256 · 공유 시크릿 · `{iss, aud, exp}`)이 필요하고, **경로마다 받는 발급자(`iss`)가 다릅니다.** 프론트와는 상관없습니다.

| 서비스 · 경로 | 부르는 쪽(iss) | 내용 |
|---|---|---|
| member `POST /internal/auth/issue` · `/signup` · `/refresh` · `/revoke` | gateway | 로그인 · 가입 · 재발급 · 폐기 |
| member `GET /internal/members/{id}/profile` | gateway | `{ userId, nickname, profileImageUrl }` |
| member `GET /internal/members/{userId}/metrics` · `GET`/`PUT …/embedding` | gateway(서명 경로 9장) | AI용 메트릭 · 회원 벡터 |
| member `GET /.well-known/jwks.json` | gateway | 공개키(토큰 없음) |
| member `GET /internal/members/{userId}/follows` — **팔로우 전용 포트 8181** | catalog · concert | `{ items: [{ artistId, followedAt, followerCount }] }` 최근 팔로우순 · 최대 1000 · 팔로우 탭(0-7). 8181은 팔로우 경로만 응답하고, 8081(회원 API)은 Gateway 전용(NetworkPolicy) |
| member `GET /internal/artists/follower-counts?artistIds=1,2` — **팔로우 전용 포트 8181** | catalog · concert | `{ items: [{ artistId, followerCount }] }` 요청 순서 · 팔로워 없으면 0 · 1~500개(넘으면 400). Catalog `artist.follower_count`(인기순 정렬용 사본) 갱신 — `member.activity` FOLLOW · UNFOLLOW 때 그 아티스트 · 1시간마다 전체 |
| catalog `POST /internal/catalog/artists` · `/albums` · `/ingest/diff` | gateway(수집 토큰 · 9장) | 수집 적재 |
| concert `POST /internal/concerts/artists/latest` | catalog | `{ artistIds: [...] }`(최대 1000) → `{ items: [{ artistId, latestAt }] }` 아티스트별 가장 최근 공연 등록 · 수정 시각 · 팔로우 탭 업데이트순(0-7). Concert 불통이면 Catalog는 공연 없이 정렬 |
| concert `POST /internal/concerts/{id}/queue/rebuild` · `GET …/queue/metrics` | 운영(ops) | 대기열 복구 · 지표 |
| payment `POST /internal/payments/prepare` · `/confirm` · `/cancel` · `GET /internal/payments/{orderType}/{orderRef}` | catalog · concert | 결제 준비 · 승인 · 취소 · 상태 |

토큰 오류: 401 `INTERNAL_TOKEN_REQUIRED` · `INTERNAL_TOKEN_INVALID` · `INTERNAL_TOKEN_EXPIRED`.

---

## 8. 관리자 API

### 8-1. Studio (관리자 화면이 부름)

- 주소: `https://admin.indig.co.kr` (Studio · KT). 응답 봉투는 0-3과 같습니다.
- 로그인 2단계 (메일 인증 코드): `POST /api/studio/auth/login { loginId, password }` → 계정에 등록된 메일로 6자리 코드 발송 · `{ next: "OTP", sentTo: ["ab***@gmail.com"] }`(가린 주소) → `POST /api/studio/auth/otp { code }` → 쿠키 `STUDIO_SESSION`. 코드는 5분 · 한 번만 통과 · 5번 틀리면 1차부터. 코드를 다시 받으려면 1차를 다시 부릅니다. 메일을 못 보내면 503 `OTP_MAIL_FAILED`.
- `GET /api/studio/me` → `{ id, loginId, name, role, menus[{key, label}], permissions[], csrfToken }`. **`menus`에 있는 탭만** 그립니다.
- 상태를 바꾸는 요청에는 `X-CSRF-Token: <me.csrfToken>`. 권한 밖 API는 없는 경로와 같은 404입니다.

| 역할 | 탭(`menus.key`) | 경로 |
|---|---|---|
| 전 역할 | — | `POST /api/studio/auth/login` · `/otp` · `/logout` · `GET /api/studio/me` · `PUT /api/studio/me/password` |
| `MASTER` | 전부 + `accounts` · `audit` | `GET`/`POST /api/studio/accounts` · `PATCH …/{id}` · `POST …/{id}/password-reset` · `GET /api/studio/audit-logs`. 계정 생성에 `otpEmails[]` 필수(1~5개) · 수정에 `otpEmails?` · 목록 항목에 `otpEmails[]` |
| `STAGE` | `venues` | `GET`/`POST /api/studio/venues` · `GET …/{venueId}` · `…/{venueId}/layout` · `PUT …/{venueId}/sections` · `POST`/`GET …/{venueId}/stage-jobs` · `GET /api/studio/stage-jobs/{jobId}` · `…/image` · `POST …/confirm` |
| `CONCERT` | `concerts` | 아래 "공연" |
| `GOODS` | `products` | 아래 "상품" |
| `CS` | `cs` | `GET /api/studio/cs/members?q=` · `…/members/{userId}` · `…/{userId}/bookings` · `…/orders` · `…/payments` · `POST /api/studio/cs/bookings/{id}/cancel` · `…/orders/{id}/cancel` |
| `CHECKER` | `checkin` | `GET /api/studio/check-in/concerts` · `POST /api/studio/check-in/concerts/{id}` `{ token }` |

**공연 (`CONCERT`)**

- 공연: `GET`/`POST /api/studio/concerts` · `GET`/`PATCH …/{id}` · `PUT …/{id}/lineup` · `GET`/`POST …/{id}/seats` · 선택지 `GET …/options/venues` · `…/options/venues/{venueId}/layout` · `…/options/artists`. 본문은 8-2 concert와 같습니다.
- 변경 공지: `GET`/`POST /api/studio/concerts/{id}/notices` `{ kind, title, body }` · `PATCH`/`DELETE …/notices/{noticeId}` (올리면 알림 · 고치거나 지우면 알림 없음).
- 이미지 업로드 주소: `POST /api/studio/concerts/images` `{ kind: POSTER·CONCERT, contentType, size }`.
- 수집 대기(크롤러 후보): `GET /api/studio/crawl/concerts?status=&beforeId=&size=` · `POST …/{id}/approve`(본문 = 공연 등록 · KOPIS 포스터 · 소개 이미지는 Studio가 우리 버킷으로 옮겨 등록) · `POST …/{id}/reject` (409 `CRAWL_CONCERT_REVIEWED`) · `POST …/{id}/change-checked`(`CHANGED` → `APPROVED`). 상태 `PENDING` · `APPROVED` · `REJECTED` · `CHANGED`(등록한 공연이 출처에서 바뀜 · 후보에 `previous` = 등록 때 값).

**상품 (`GOODS`)**

- 상품: `GET /api/studio/products/goods` · `…/physical-albums` · `…/{id}` · `POST /api/studio/products` · `PATCH …/{id}` · `PUT …/{id}/options` · 재고 더하기 `POST /api/studio/products/options/{optionId}/stock` `{ delta, reason }` · 재고 설정 `PUT /api/studio/products/options/{optionId}/stock` `{ qty, reason }` · 선택지 `GET …/options/artists(/{artistId})`. 등록 · 수정 본문은 8-2 catalog와 같고, 상세 설명 `description` · 상세 이미지 `detailImageUrls`(우리 버킷 주소만 · Studio가 확인)를 함께 받습니다.
- 아티스트: `PATCH /api/studio/products/artists/{artistId}` `{ profileUrl?, gender?, composition?, bio? }` (보낸 값만 · `bio` `""` = 지움).
- 앨범: `GET`/`PATCH /api/studio/products/albums/{albumId}` `{ thumbnailUrl?, description?, tracks?: [{ trackNo, genres?, tempo?, moods?, emotions?, styles? }] }` (트랙 태그 null은 그대로 · `[]`은 지움 · `description` `""` = 지움).
- 이미지 업로드 주소: `POST /api/studio/products/images` `{ kind: ARTIST·ALBUM·GOODS·PHYSICAL, contentType, size }`.
- 수집 대기(아티스트 · 앨범 · 피지컬 · 굿즈): `GET /api/studio/crawl/catalog?status=&type=&beforeId=&size=` · `POST …/{id}/approve`(본문 비우면 받은 값 · 넣으면 고친 항목) · `POST …/approve` `{ ids }` · `POST …/{id}/reject`. 승인할 때 굿즈 · 판본 상세 이미지는 Studio가 우리 버킷으로 옮기고, 못 가져온 이미지는 빼고 넘깁니다. 후보의 `evidence`(출처)는 Catalog로 가지 않습니다. 오류 409 `CRAWL_CATALOG_REVIEWED` · `CRAWL_ARTIST_NOT_APPROVED` · 422 `CRAWL_CATALOG_FAILED` · `CRAWL_PRICE_REQUIRED`(피지컬 · 굿즈 옵션 가격 0 이하).

**이미지 올리기** (상품 · 공연 공통)

1. `POST …/images { kind, contentType, size }` → `{ uploadUrl, method: "PUT", headers: { "Content-Type", … }, imageUrl, expiresAt }` (형식 `image/jpeg` · `png` · `gif` · `webp` · 최대 5MB · 5분)
2. 브라우저가 `uploadUrl`로 파일을 그대로 `PUT` (받은 `headers` 그대로 · 쿠키 · CSRF 없음)
3. 저장 요청(상품 등록 · 수정 · 아티스트 · 앨범 · 공연 등록 · 수정)에 `imageUrl`을 넣음 — Studio가 버킷에 실제로 있는지 확인하고, 아니면 400 `IMAGE_NOT_UPLOADED` (우리 주소가 아니면 `IMAGE_URL_NOT_ALLOWED`). 버킷이 설정되지 않은 환경은 503 `IMAGE_STORE_DISABLED`.

상세(요청 본문 · 오류 · 무대 그리기 흐름)는 studio-service `docs/v2_studio_service_re.md` 4 · 5 · 6 · 7장.

### 8-2. 각 서비스의 관리자 내부 API (`/internal/admin/**` · iss=`studio`만)

Studio가 본문을 그대로 넘기고 응답의 `result`만 꺼내 돌려줍니다. 헤더 `X-Admin-Id`(누가 시켰는지)가 붙습니다. Studio(KT)는 관리자 터널(`studio-link` · PC는 `https://link-onprem.indig.co.kr`)을 거쳐 들어오고, 서비스 NetworkPolicy가 `app: studio-link`를 허용합니다.

| 서비스 · 경로 | 요청 | 응답 · 규칙 |
|---|---|---|
| member `GET /internal/admin/members?q=&size=` | `q` 1~255자 | `[{ userId, email, provider, nickname, profileImageUrl, createdAt }]` 최근 가입순 · 기본 20 · 최대 50. **이메일은 가림**(`ab***@…`). 회원 번호 · 이메일 일치 · 닉네임 부분 일치 |
| member `GET /internal/admin/members/{id}` | | 같은 모양 · 이메일 전체 · 없으면 404 |
| catalog `POST /internal/admin/catalog/products` | `{ productType, name, thumbnailUrl?, description?, detailImageUrls?, options: [{ name, vinylColor?, size?, price, qty? }] }` + 굿즈 `artistId` · `category` / 피지컬 `albumId` · `format` · `releasedAt?`. `description`은 1000자까지 · `detailImageUrls`는 10개까지 | `ProductDetail`. `source=studio`. 굿즈는 `goods.released`, 피지컬은 발매일이 최근이거나 없을 때 `physical_album.released` |
| catalog `PATCH /internal/admin/catalog/products/{id}` | `{ name?, thumbnailUrl?, category?, releasedAt?, description?, detailImageUrls? }` | 보낸 값만 (null은 그대로). `description` `""` = 지움 · `detailImageUrls`는 보낸 목록으로 바꿈(`[]` = 지움). 매체 · 앨범 · 아티스트는 못 바꿈 |
| catalog `PUT /internal/admin/catalog/products/{id}/options` | `{ options: [{ id?, name, vinylColor?, size?, price }] }` | `id`가 있으면 그 옵션을 고치고 이름도 바꿈. 없으면 이름으로 찾아 고치거나 새로(재고 0) |
| catalog `POST /internal/admin/catalog/options/{optionId}/stock` | `{ delta, reason }` | `{ optionId, qty, updatedAt }` · 0 아래로 내려가면 409 `OUT_OF_STOCK` |
| catalog `PUT /internal/admin/catalog/options/{optionId}/stock` | `{ qty, reason }` (qty 0 이상) | `{ optionId, qty, updatedAt }` · 재고를 qty 개로 맞춤 |
| catalog `PATCH /internal/admin/catalog/artists/{id}` | `{ profileUrl?, gender?, composition?, bio? }` (보낸 값만 · `bio` 1000자까지 · `""` = 지움) | `ArtistDetail` · `artist.updated` 발행 |
| catalog `PATCH /internal/admin/catalog/albums/{id}` | `{ thumbnailUrl?, description?, tracks?: [{ trackNo, genres?, tempo?, moods?, emotions?, styles? }] }` (`description` 1000자까지 · `""` = 지움) | `AlbumDetail` · 없는 `trackNo`는 400 · `album.updated` 발행 |
| catalog `GET /internal/admin/catalog/users/{userId}/orders` | 커서 | 주문 목록 |
| catalog `POST /internal/admin/catalog/orders/{id}/cancel` | `{ reason }`(Studio 기록용) | 주문 상세. 회원 본인 취소와 같은 규칙 · 사유 `ADMIN_CANCEL` |
| catalog `POST /internal/admin/catalog/ingest/artists` · `/albums` · `/diff` | 수집 적재와 같은 본문(snake_case · catalog 문서 7.3) | 항목별 `CREATED` · `UPDATED` · `UNCHANGED` · `FAILED`. 크롤러 후보를 Studio가 승인할 때 넘김(8-3 · `X-Admin-Id` 없음). 이미지 · 트랙 태그 · 옵션 판매가 · 재고가 **null이면 저장된 값 유지**(새 옵션은 판매가 필수). 상세 설명 · 상세 이미지 · 소개 글은 **저장된 값이 비어 있을 때만** 채움 |
| concert `POST /internal/admin/concerts/venues` | `{ name, region, address, capacity }` | 공연장 |
| concert `POST /internal/admin/concerts` | `{ venueId, title, type, genre?, startsAt, endsAt, price?, bookingOpenAt, queueEnabled?, maxSeatsPerUser?, artistIds[], source?, externalId?, description?, terms?, requirements?, posterUrl?, imageUrls? }` | `ConcertDetail`. `SOLO`는 `genre`를 보내지 않음(아티스트 장르) · `source` · `externalId`는 함께 · 같은 값이 있으면 409 `CONFLICT` + `concertId` · 라인업 아티스트는 Catalog에서 복제된 아티스트여야 함 |
| concert `PATCH /internal/admin/concerts/{id}` | 위 필드 중 보낸 값만(`type` · 라인업 · 출처 제외) | `ConcertDetail` |
| concert `PUT /internal/admin/concerts/{id}/lineup` | `{ artistIds }` | 아티스트가 늘면 `concert.lineup_updated` |
| concert `GET`/`POST /internal/admin/concerts/{id}/notices` | `{ kind, title(≤200), body }` | 공지 · 올리면 `concert.notice_posted` (라인업 팔로워 + 확정 예매자) |
| concert `PATCH`/`DELETE /internal/admin/concerts/{id}/notices/{noticeId}` | `{ kind?, title?, body? }` | 공지 · 알림 다시 보내지 않음 |
| concert `PUT /internal/admin/concerts/venues/{venueId}/sections` | `{ venueId?, venueName?, floor, section: { name, shape, angle, rows, seatCount }, seats: [{ seatId, row, number, x, y, angle }] }` | `{ venueId, floorId, sectionId, seatCount }` · 쓰는 중인 구역은 409 `SECTION_IN_USE` |
| concert `GET /internal/admin/concerts/venues/{venueId}/layout` | | `{ venueId, floors: [{ id, name, sections: [{ id, name, shape, angle, seats[] }] }] }` |
| concert `POST /internal/admin/concerts/{id}/seats` | `{ seats: [{ seatId, price }] }`(최대 20000) | `{ saved, skipped }` |
| concert `GET /internal/admin/concerts/users/{userId}/bookings` | 커서 | 예매 목록 |
| concert `POST /internal/admin/concerts/bookings/{id}/cancel` | | 예매 상세. 회원 본인 취소와 같은 규칙 · 사유 `ADMIN_CANCEL` |
| concert `GET /internal/admin/concerts/check-in` | | `[{ id, title, startsAt, venueName }]` 지금 검표할 수 있는 공연 |
| concert `POST /internal/admin/concerts/{id}/check-in` | `{ token, checkerId }` (Studio가 `checkerId`를 세션 관리자 id로 채움) | `{ bookingId, seats[], checkedInAt }` · 409 `WRONG_CONCERT` · `ALREADY_CHECKED_IN`(+`checkedInAt`) · `ENTRY_NOT_AVAILABLE` · 400 `ENTRY_QR_INVALID` · `ENTRY_QR_EXPIRED` |
| payment `GET /internal/admin/payments/users/{userId}` | 커서 | `[PaymentView]` |

- 관리자 토큰으로는 관리자 경로만 열립니다(결제 준비 · 토큰 발급 · 수집 경로 불가). 반대로 다른 서비스 토큰으로는 관리자 경로가 열리지 않습니다.

### 8-3. 크롤러 → Studio (`/internal/crawl/**`)

크롤러(KT)가 찾은 공연 · 아티스트 · 앨범 · 상품을 Studio 수집 대기열에 넣는 경로입니다. 관리자가 8-1 "수집 대기"에서 승인해야 서비스로 들어갑니다. 헤더 `X-Internal-Token`(`{iss: crawler, aud: studio, exp}` · HS256 · 시크릿 `crawler.shared-secret` · 없으면 이 경로만 401).

| 경로 | 내용 |
|---|---|
| `POST /internal/crawl/concerts` | 공연 후보 → `{ items: [{ externalId, id, result }] }` |
| `POST /internal/crawl/catalog/artists` · `/albums` | 아티스트 · 앨범(피지컬 · 굿즈 포함) 후보 → 같은 모양 |
| `POST /internal/crawl/catalog/diff` | Catalog `/internal/admin/catalog/ingest/diff`로 그대로 넘김 (이미 있는 것 확인) |
| `GET /internal/crawl/reviewed` | `{ concerts, artists, albums }` 관리자가 처리한 후보 (다시 보내지 않음) |

본문(snake_case) · 상세 설명 규칙 · 재시도는 [v2_크롤러_전송_계약](v2_크롤러_전송_계약.md).

---

## 9. 서명 경로 (`/ingest/**`)

외부 수집기 · AI가 Gateway를 거쳐 내부 API를 부르는 경로입니다. **클러스터 안에서만**(외부 경유는 서명이 맞아도 막힘).

| 경로 | 키 묶음 | 넘기는 곳 |
|---|---|---|
| `POST /ingest/catalog/artists` · `/albums` | 수집 키 `ingest.keys.*` | catalog `/internal/catalog/artists` · `/albums` (최대 500건) |
| `POST /ingest/catalog/diff` | 수집 키 | catalog `/internal/catalog/ingest/diff` (최대 1000건) |
| `GET /ingest/members/{userId}/metrics` | 회원 데이터 키 `ingest.member-keys.*` | member `/internal/members/{userId}/metrics` |
| `GET`/`PUT /ingest/members/{userId}/embedding` | 회원 데이터 키 | member `/internal/members/{userId}/embedding` |

- 헤더: 키 ID · 타임스탬프 · 논스 · 서명(HMAC-SHA256). 서명 문자열 = `메서드\n경로+쿼리\n타임스탬프\n논스\n본문 SHA-256(hex)`. 상세는 Gateway `IngestFilter`, [22](22_수집검증_관리자권한_감사로그.md) §1(이 절은 폐기 대상이 아닙니다).
- 오류: 401 `INGEST_*`(서명 · 키 · 논스 · 재전송 · 시각) · 408 `INGEST_BODY_TIMEOUT` · 413 · 415 · 매핑 밖 404 · 메서드 405 · 하위 서비스 30초 넘으면 504.
- 수집 키는 발급하지 않습니다 — 크롤러는 이 경로 대신 8-3 Studio 경로를 씁니다(관리자 승인 후 적재). 경로는 Gateway에 남아 있습니다.
- 🔴 운영 Gateway에 회원 데이터 키가 없어 `/ingest/members/**`는 전부 401입니다([v2_후속_작업](v2_후속_작업.md) 3-3).

---

## 10. Kafka 이벤트

운영은 토픽 자동 생성이 꺼져 있어 manifests `platform/kafka/topics-job.yaml`에 있는 토픽만 씁니다. 발행은 모두 outbox를 거칩니다.

| 토픽 | 발행 | 구독 | 용도 |
|---|---|---|---|
| `album.released` | catalog | member | 앨범 · EP · 싱글 발매 알림(발매 30일 이내만) |
| `physical_album.released` | catalog | member | 피지컬 앨범(새 옵션 포함) 알림 |
| `goods.released` | catalog | member | 굿즈 알림 |
| `order.confirmed` | catalog | member | 구매 완료 알림 · 콜렉션 자동 추가 · PURCHASE 메트릭(`member-metric` 그룹) |
| `order.refunded` | catalog | member | 환불 알림 |
| `artist.updated` | catalog | concert | 아티스트 복제(공연 라인업용) |
| `album.updated` | catalog | (없음) | |
| `concert.created` · `concert.lineup_updated` | concert | member | 공연 · 라인업 추가 알림 |
| `concert.notice_posted` | concert | member | 공연 변경 공지 알림 — 라인업 팔로워 + 확정 예매자 (`CONCERT_ANNOUNCED` · payload `concertId` · `noticeId` · `kind` · `noticeTitle` · `title` · `startsAt` · `venueName` · `artistIds` · `bookerUserIds`) |
| `booking.completed` · `booking.cancelled` | concert | member | 예매 · 취소 알림 · `booking.completed`는 BOOKING 메트릭도(`member-metric` 그룹) |
| `queue.rebuild` | concert | concert | 대기열 복구 |
| `payment.completed` · `payment.failed` · `payment.cancelled` | payment | catalog · concert | 주문 · 예매 상태 반영(`payment.cancelled`의 `refunded`) |
| `user.withdrawn` | member | catalog · concert | 장바구니 · 결제 대기 주문 · 선점 정리 (챗봇은 구독 안 함) |
| `member.activity` | member | catalog · member | 팔로우 · 언팔로우 — catalog는 `artist.follower_count` 갱신 · member는 FOLLOW · UNFOLLOW 메트릭(`member-metric` 그룹) |
| `user.metric` | catalog · concert | member | 회원 행동 메트릭 — 장바구니 담기 · 빼기(catalog) · 검색어(catalog · concert 검색 API) → `user_metric`. payload `userId` · `metricId` · `targetType` · `targetId`(검색어는 null) · `metricType` · `metricValue` · `properties` |

payload 필드는 member 문서 7장 "Kafka" · catalog 문서 8장.

---

## 11. 에러 코드

공통(모든 서비스): 400 `INVALID_REQUEST` · `INVALID_CURSOR` · 401 `UNAUTHENTICATED` · 404 `NOT_FOUND` · 405 `METHOD_NOT_ALLOWED` · 409 `CONFLICT` · 500 `INTERNAL_ERROR`.

| 서비스 | 코드 (HTTP) |
|---|---|
| Gateway | 400 `BAD_REQUEST` · `REQUIRED_AGREEMENT_MISSING` · 401 `TOKEN_INVALID` · `TOKEN_EXPIRED` · `TOKEN_REVOKED` · `REFRESH_INVALID` · `REFRESH_REUSED` · `SIGNUP_EXPIRED` · `SIGNUP_INVALID` · `INGEST_*` · 403 `FORBIDDEN` · `CSRF_COOKIE_MISSING` · `CSRF_HEADER_MISSING` · `CSRF_MISMATCH` · 408 `INGEST_BODY_TIMEOUT` · 409 `TERMS_OUTDATED` · 413 · 415 `UNSUPPORTED_MEDIA_TYPE` · 429 `TOO_MANY_REQUESTS` · 431 `HEADER_TOO_LARGE` · 503 `SERVICE_UNAVAILABLE`(폴백) · 504 `GATEWAY_TIMEOUT` |
| member | 400 `NICKNAME_TOO_SHORT` · `NICKNAME_TOO_LONG` · `INVALID_NICKNAME` · `REQUIRED_AGREEMENT_MISSING` · 404 `TERMS_NOT_FOUND` · 409 `ADDRESS_LIMIT_EXCEEDED` · `TERMS_OUTDATED` |
| catalog | 400 `INVALID_OPTION` · `SEARCH_QUERY_EMPTY` · `SEARCH_QUERY_TOO_LONG` · `BODY_DIGEST_MISMATCH` · 404 `ARTIST_NOT_FOUND` · `PRODUCT_NOT_FOUND` · `OPTION_NOT_FOUND` · 409 `OUT_OF_STOCK` · `CART_FULL` · 413 `PAYLOAD_TOO_LARGE` · 503 `PAYMENT_UNAVAILABLE` · `FOLLOW_UNAVAILABLE` |
| concert | 409 `SEAT_TAKEN` · `SEAT_LOCKED` · `SEAT_LIMIT_EXCEEDED` · `HOLD_EXISTS` · `ALREADY_PAID` · `BOOKING_CANCELLED` · `BOOKING_NOT_CANCELLABLE` · `ALREADY_IN_QUEUE` · `QUEUE_NOT_OPEN` · `QUEUE_DISABLED` · `ENTRY_NOT_OPEN` · `ENTRY_CLOSED` · `ENTRY_NOT_AVAILABLE` · `WRONG_CONCERT` · `ALREADY_CHECKED_IN` · `SECTION_IN_USE` · 410 `HOLD_EXPIRED` · `QUEUE_CLOSED` · `SOLD_OUT` · 403 `ENTRY_TOKEN_REQUIRED` · `ENTRY_TOKEN_INVALID` · `QUEUE_NOT_ADMITTED` · 404 `NOT_IN_QUEUE` · `SEAT_NOT_FOUND` · 400 `ENTRY_QR_INVALID` · `ENTRY_QR_EXPIRED` · 503 `PAYMENT_PENDING` · `PAYMENT_UNAVAILABLE` · `QUEUE_UNAVAILABLE` · `FOLLOW_UNAVAILABLE` |
| payment | 400 `AMOUNT_MISMATCH` · 401 `INVALID_SIGNATURE` · 409 `ALREADY_CONFIRMED` · `PAYMENT_EXPIRED` · `PAYMENT_NOT_PENDING` · `PAYMENT_NOT_CANCELLABLE` · `IDEMPOTENCY_AMOUNT_MISMATCH` · `IDEMPOTENCY_USER_MISMATCH` · `USE_BOOKING_CONFIRM` · `USE_BOOKING_CANCEL` · 502 `PG_CANCEL_REJECTED` · 503 `PG_PROCESSING` · `PG_UNAVAILABLE` |
| Studio | 400 `PASSWORD_POLICY` · `PASSWORD_MISMATCH` · `STAGE_IMAGE_INVALID` · `STAGE_DRAWING_INVALID` · `STAGE_VALUES_INVALID` · `IMAGE_TYPE_NOT_ALLOWED` · `IMAGE_TOO_LARGE` · `IMAGE_URL_NOT_ALLOWED` · `IMAGE_NOT_UPLOADED` · 401 `LOGIN_FAILED` · `OTP_INVALID` · `OTP_CHALLENGE_EXPIRED` · 403 `CSRF_INVALID` · 404 `ACCOUNT_NOT_FOUND` · `STAGE_JOB_NOT_FOUND` · `STAGE_IMAGE_NOT_FOUND` · `CRAWL_CONCERT_NOT_FOUND` · `CRAWL_CATALOG_NOT_FOUND` · 409 `LOGIN_ID_TAKEN` · `CANNOT_CHANGE_SELF` · `STAGE_JOB_NOT_REVIEWABLE` · `CRAWL_CONCERT_REVIEWED` · `CRAWL_CATALOG_REVIEWED` · `CRAWL_ARTIST_NOT_APPROVED` · 413 `PAYLOAD_TOO_LARGE` · 422 `CRAWL_CATALOG_FAILED` · `CRAWL_PRICE_REQUIRED` · 502 `UPSTREAM_ERROR` · `IMAGE_IMPORT_FAILED` · 503 `UPSTREAM_UNAVAILABLE` · `OTP_MAIL_FAILED` · `IMAGE_STORE_DISABLED` (Studio 문서 7장) |

---

## 12. enum 값

| 이름 | 값 |
|---|---|
| 장르 `Genre` (catalog · concert 공통 · 23개) | `INDIE_ROCK` · `ALTERNATIVE` · `GARAGE` · `PUNK` · `HARDCORE` · `EMO` · `METAL` · `POST_ROCK` · `SHOEGAZE` · `PSYCHEDELIC` · `INDIE_POP` · `DREAM_POP` · `SYNTH_POP` · `CITY_POP` · `FOLK` · `ELECTRONIC` · `RNB_SOUL` · `HIPHOP` · `JAZZ` · `BLUES` · `FUNK` · `SKA_REGGAE` · `ETC` |
| 아티스트 성별 `ArtistGender` (catalog) | `MALE` 남자 · `FEMALE` 여자 · `MIXED` 혼성 |
| 아티스트 구성 `ArtistComposition` (catalog) | `SOLO` 솔로 · `GROUP` 팀 |
| 지역 `Region` | `SEOUL` · `BUSAN` · `DAEGU` · `INCHEON` · `GWANGJU` · `DAEJEON` · `ULSAN` · `SEJONG` · `GYEONGGI` · `GANGWON` · `CHUNGBUK` · `CHUNGNAM` · `JEONBUK` · `JEONNAM` · `GYEONGBUK` · `GYEONGNAM` · `JEJU` |
| 공연 `type` · `saleStatus` | `SOLO` · `FESTIVAL` / `SCHEDULED` · `ON_SALE` · `CLOSED` |
| 공연 공지 `kind` | `SCHEDULE` · `VENUE` · `LINEUP` · `BOOKING` · `CANCEL` · `ETC` |
| 목록 `sort` (0-6) | `ARTIST_ORDER`(넘긴 아티스트 순서) · `UPDATED`(최근 수정순) |
| 팔로우 API `sort` (0-7) | `RECENT_FOLLOW`(최근 팔로우순 · 기본) · `FOLLOWERS`(팔로워순) · `UPDATED`(업데이트순) |
| 앨범 `type` | `ALBUM` · `EP` · `SINGLE` |
| 피지컬 `format` | `LP` · `CD` · `CASSETTE` |
| 굿즈 `category` | `TSHIRT` · `OUTER` · `KEYRING` · `PICK` · `MUFFLER` · `SCARF` · `BAG` · `HAT` · `ETC` |
| 옵션 `vinylColor` · `size` | `BLACK` · `COLOR` / `XS` · `S` · `M` · `L` · `XL` · `XXL` · `FREE` · `0` · `1` · `2` · `3` · `4` · `5` · `6` |
| 트랙 `tempo` · `moods` | `SLOW` · `MID` · `FAST` · `VERY_FAST` / `DREAMY` · `DARK` · `BRIGHT` · `WARM` · `COLD` · `CALM` · `ENERGETIC` · `INTENSE` · `HEAVY` · `BOUNCY` · `GROOVY` · `URBAN` (`emotions` · `styles`는 catalog 문서 4장) |
| 주문 · 예매 상태 | `PENDING` · `CONFIRMED` · `CANCELLED` · `REFUNDED` / `PENDING` · `CONFIRMED` · `CANCELLED` · `EXPIRED` |
| 대기열 `state` | `WAITING` · `ADMITTED` · `EXPIRED` · `SOLD_OUT` |
| 알림 `type` | `ALBUM_RELEASED` · `EP_RELEASED` · `SINGLE_RELEASED` · `PHYSICAL_ALBUM_RELEASED` · `GOODS_RELEASED` · `CONCERT_ANNOUNCED` · `PURCHASE_DONE` · `PURCHASE_REFUNDED` · `BOOKING_DONE` · `BOOKING_CANCELLED` |
| 알림 `target` | `ALBUM` · `PHYSICAL_ALBUM` · `GOODS` · `CONCERT` · `ORDER` · `BOOKING` |
| 메트릭 `targetType` | `ARTIST` · `ALBUM` · `TRACK` · `PHYSICAL_ALBUM` · `GOODS` · `CONCERT` |
| 메트릭 `metricType` | 프론트: `DETAIL_VIEW` · `DWELL` · `PREVIEW_PLAY` · `SEARCH_CLICK` · `RECOMMEND_CLICK` · `SHARE` · `EXTERNAL_LINK_CLICK` · 서버 기록: `CART_ADD` · `CART_REMOVE` · `SEARCH` · `FOLLOW` · `UNFOLLOW` · `PURCHASE` · `BOOKING` (member 문서 6.5) |
| 약관 `code` | `AGE14` · `TOS` · `PRIVACY` · `PRIVACY_POLICY` · `MARKETING` |
| Studio 역할 | `MASTER` · `STAGE` · `CONCERT` · `GOODS` · `CS` · `CHECKER` |
| 이미지 `kind` (Studio) | 상품 `ARTIST` · `ALBUM` · `GOODS` · `PHYSICAL` / 공연 `POSTER` · `CONCERT` |
