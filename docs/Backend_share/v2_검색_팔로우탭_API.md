# v2 검색 · 팔로우 탭 API (11/19 추가분)

> **기준일: 2026-11-19 · 운영 배포됨** (`https://api.indig.co.kr` · member `42b5245` · catalog `f455e36` · concert `e89ee9e`).
> 프론트 요구 문서(카테고리별 필터 · 세그먼트 · 검색)에 맞춰 **새로 추가한 API 만** 모았습니다. 전체 명세는 [v2_API_명세서](v2_API_명세서.md) 0-7.
> 검색 범위는 **전체**와 **팔로우** 두 가지라 카테고리마다 API 가 2개입니다. **추천 · 인기 목록은 추천 서비스가 없어 아직 없습니다(미정).** 검색 모드의 "전체"(추천 + 인기 합침)는 아래 전체 검색 API 를 씁니다.

## 목차

1. API 목록
2. 항목 모양
3. 파라미터 규칙
4. 팔로우 정렬 `sort`
5. 상태 코드
6. 예시
7. 참고: 서버 간 내부 API

---

## 1. API 목록

| 메서드 · 경로 | 인증 | 파라미터 | 응답 `result` | 기본 정렬 |
|---|---|---|---|---|
| `GET /api/catalog/search/artists` | 없음 | `q?` · `genre?`(여러 개) · `page` · `size?` | `{ items: [ArtistItem], page, size, hasNext }` | 가나다순 |
| `GET /api/catalog/search/physical-albums` | 없음 | `q?` · `format?`(여러 개) · `minPrice?` · `maxPrice?` · `page` · `size?` | `{ items: [PhysicalItem], page, size, hasNext }` | 발매일 최신순 |
| `GET /api/catalog/search/goods` | 없음 | `q?` · `category?`(여러 개) · `minPrice?` · `maxPrice?` · `page` · `size?` | `{ items: [GoodsItem], page, size, hasNext }` | 최신 등록순 |
| `GET /api/concerts/search` | 없음 | `q?` · `saleStatus?` · `type?` · `region?` · `genre?`(모두 여러 개) · `page` · `size?` | `{ items: [ConcertSummary], page, size, hasNext }` | 공연일 가까운 순 |
| `GET /api/catalog/following/artists` | 로그인 | `q?` · `genre?` · `sort?` · `page` · `size?` | 내가 팔로우한 아티스트 · `[ArtistItem]` | `RECENT_FOLLOW` |
| `GET /api/catalog/following/physical-albums` | 로그인 | `q?` · `format?` · `minPrice?` · `maxPrice?` · `sort?` · `page` · `size?` | 팔로우한 아티스트의 LP · CD · 카세트 · `[PhysicalItem]` | `RECENT_FOLLOW` |
| `GET /api/catalog/following/goods` | 로그인 | `q?` · `category?` · `minPrice?` · `maxPrice?` · `sort?` · `page` · `size?` | 팔로우한 아티스트의 굿즈 · `[GoodsItem]` | `RECENT_FOLLOW` |
| `GET /api/concerts/following` | 로그인 | `q?` · `saleStatus?` · `type?` · `region?` · `genre?` · `sort?` · `page` · `size?` | 팔로우한 아티스트가 나오는 공연 · `[ConcertSummary]` | `RECENT_FOLLOW` |

- 화면과의 연결: 세그먼트 추천 · 인기에서 검색하면 **전체 검색** API, 세그먼트 팔로우에서는 검색어가 있든 없든 **팔로우** API.
- 팔로우 API 는 서버가 로그인 회원의 팔로우 목록을 직접 읽습니다. 프론트는 `GET /api/members/follows` 를 먼저 부르거나 `artistIds` 를 넘길 필요가 없습니다 — 로그인 쿠키만 함께 보내면 됩니다(`credentials: 'include'`).
- 모두 `GET` 이라 CSRF 헤더는 필요 없습니다.

## 2. 항목 모양

기존 목록 API(`/api/catalog/artists` · `/physical-albums` · `/goods` · `/api/concerts`)의 항목과 같습니다.

| 이름 | 필드 |
|---|---|
| `ArtistItem` | `{ id, name, genres[], debutYear, profileUrl }` |
| `PhysicalItem` | `{ id, albumId, albumTitle, artistId, artistName, format, name, releasedAt, thumbnailUrl, minPrice, soldOut }` |
| `GoodsItem` | `{ id, artistId, artistName, name, category, thumbnailUrl, minPrice, soldOut }` |
| `ConcertSummary` | `{ id, title, type, genre, artists: [{ id, name, genre }], startsAt, price, saleStatus, venue: { id, name, region }, posterUrl }` |

응답 전체 모양은 다른 API 와 같습니다: `{ isSuccess, code, message, result, correlationId }`.

## 3. 파라미터 규칙

| 항목 | 규칙 |
|---|---|
| `q` | SQL LIKE 부분 일치(`%검색어%`) · 대소문자 무시. **비우면 칩만으로 조회** |
| 검색 대상 | 아티스트 = 이름 · 앨범 = 상품명 · 앨범 제목 · 아티스트 이름 · 굿즈 = 굿즈명 · 아티스트 이름 · 공연 = 제목 · 라인업 아티스트 이름 · 공연장 이름 |
| 칩 여러 개 | `genre=EMO,SHOEGAZE` 또는 `genre=EMO&genre=SHOEGAZE`. **같은 칩 안은 OR**, 서로 다른 칩 · 검색어 · 팔로우 범위는 **AND**. 안 고른 칩은 파라미터를 빼고 보냄 |
| 가격 | `minPrice` · `maxPrice`(원 · 경계 포함 · 항목 `minPrice` = 옵션 최저가 기준). **`maxPrice` 가 150000 이상이면 상한 없음**("15만원 이상" · 보내도 되고 빼도 됨). 전체 범위(0원 ~ 15만원 이상)는 둘 다 빼기 |
| `saleStatus` | 안 고르면 지금 이후 공연만. 고르면 지난 공연(`CLOSED` 판매종료)도 포함 |
| 페이지 | `page` 0부터 · `size` 기본 20 · 최대 50. 무한 스크롤은 `hasNext` 가 `true` 면 `page+1`. 새로고침은 같은 조건으로 `page=0` |

칩 값 (명세서 12장):

| 칩 | 값 |
|---|---|
| 장르 `genre` (23개) | `INDIE_ROCK` · `ALTERNATIVE` · `GARAGE` · `PUNK` · `HARDCORE` · `EMO` · `METAL` · `POST_ROCK` · `SHOEGAZE` · `PSYCHEDELIC` · `INDIE_POP` · `DREAM_POP` · `SYNTH_POP` · `CITY_POP` · `FOLK` · `ELECTRONIC` · `RNB_SOUL` · `HIPHOP` · `JAZZ` · `BLUES` · `FUNK` · `SKA_REGGAE` · `ETC` |
| 앨범 형태 `format` | `LP` · `CD` · `CASSETTE` |
| 굿즈 형태 `category` (9개) | `TSHIRT` 티셔츠 · `OUTER` 아우터 · `KEYRING` 키링 · `PICK` 피크 · `MUFFLER` 머플러 · `SCARF` 스카프 · `BAG` 가방 · `HAT` 모자 · `ETC` 기타 |
| 공연 진행 현황 `saleStatus` | `SCHEDULED` 판매전 · `ON_SALE` 판매중 · `CLOSED` 판매종료 |
| 공연 유형 `type` | `SOLO` 단독 · `FESTIVAL` 페스티벌 |
| 지역 `region` (17개) | `SEOUL` · `BUSAN` · `DAEGU` · `INCHEON` · `GWANGJU` · `DAEJEON` · `ULSAN` · `SEJONG` · `GYEONGGI` · `GANGWON` · `CHUNGBUK` · `CHUNGNAM` · `JEONBUK` · `JEONNAM` · `GYEONGBUK` · `GYEONGNAM` · `JEJU` |

## 4. 팔로우 정렬 `sort`

팔로우 API 에만 있습니다. 없으면 `RECENT_FOLLOW`.

| 화면 | 값 | 아티스트 탭 | 앨범 · 굿즈 · 공연 탭 |
|---|---|---|---|
| 최근 팔로우순 (기본) | `RECENT_FOLLOW` | 최근에 팔로우한 아티스트부터 | 최근에 팔로우한 아티스트의 항목부터 |
| 팔로워순 | `FOLLOWERS` | 팔로워가 많은 아티스트부터 (지금 팔로워 수) | 팔로워가 많은 아티스트의 항목부터 |
| 업데이트순 | `UPDATED` | 새소식이 가장 최근인 아티스트부터 — 앨범 · LP/CD/카세트 발매일 · 굿즈 등록일 · 공연 등록 · 수정일 중 가장 늦은 날짜. 소식이 없으면 뒤 | 항목이 최근에 등록 · 수정된 순 |

- 같은 아티스트의 항목끼리는 1장의 기본 정렬 순서입니다. 공연은 라인업 중 가장 앞 순서의 아티스트 기준입니다.
- 전체 검색 API 는 정렬이 고정(1장 "기본 정렬")이라 `sort` 를 받지 않습니다.
- ⚪ 시연 데이터의 굿즈 · 공연은 11/18~19 에 넣어서, 아티스트 업데이트순에서는 굿즈 · 공연이 있는 팀이 위로 몰립니다.

## 5. 상태 코드

| 경우 | 응답 |
|---|---|
| 팔로우 0개 | 200 · `{ items: [], hasNext: false }` |
| 팔로우 API 를 비로그인 · 토큰 만료로 부름 | 401 `UNAUTHENTICATED` → 재발급 뒤 다시 부르기 |
| 회원 서비스 장애 (팔로우 API) | 503 `FOLLOW_UNAVAILABLE` → "잠시 후 다시 시도" |
| 목록에 없는 칩 값 · 정렬 값 · `minPrice > maxPrice` | 400 `INVALID_REQUEST` |
| Catalog 장애 (`/api/catalog/search/**`) | Gateway 가 200 · `{ items: [], degraded: true }` (`hasNext` 없음 → 더 불러오지 않기) |

## 6. 예시

```http
GET /api/catalog/search/goods?q=혁오&category=TSHIRT,HAT&minPrice=30000&maxPrice=150000&page=0
GET /api/catalog/search/artists?genre=INDIE_ROCK,SHOEGAZE&page=0&size=20
GET /api/concerts/search?q=상상마당&saleStatus=ON_SALE
GET /api/catalog/following/artists?genre=INDIE_ROCK&sort=UPDATED
GET /api/catalog/following/physical-albums?format=LP,CD&sort=FOLLOWERS
GET /api/concerts/following?saleStatus=ON_SALE,SCHEDULED&region=SEOUL,GYEONGGI&sort=FOLLOWERS
```

응답 (`GET /api/catalog/search/artists?q=혁` · 운영 실제 응답):

```json
{
  "isSuccess": true,
  "code": "OK",
  "message": "성공",
  "result": {
    "items": [{ "id": 1, "name": "혁오", "genres": ["INDIE_ROCK", "ALTERNATIVE"], "debutYear": 2014,
                "profileUrl": "https://img.indig.co.kr/artist/2026/11/c88f5ad4-7e51-4537-833e-20db4e327981.jpg" }],
    "page": 0,
    "size": 20,
    "hasNext": false
  },
  "correlationId": "..."
}
```

## 7. 참고: 서버 간 내부 API

프론트와는 상관없습니다. 팔로우 API 가 안에서 부르는 것입니다.

| 서비스 · 경로 | 부르는 쪽 | 내용 |
|---|---|---|
| member `GET /internal/members/{userId}/follows` (팔로우 전용 포트 8181) | catalog · concert | `{ items: [{ artistId, followedAt, followerCount }] }` 최근 팔로우순 · 최대 1000. 8181 은 이 경로만 응답하고, 회원 API 포트 8081 은 Gateway 전용 그대로 |
| concert `POST /internal/concerts/artists/latest` | catalog | `{ artistIds: [...] }`(최대 1000) → `{ items: [{ artistId, latestAt }] }` — 아티스트 업데이트순에 쓰는 최근 공연 날짜 |
