# 28_프론트_Vercel_배포_가이드

# 28. 프론트 Vercel 배포 가이드 — 프론트 담당 전달용

> 11/02 작성 · 결정 41B — **Vercel 계정 · 프로젝트는 프론트 담당이 갖고, 도메인 DNS(Cloudflare)는 인프라 담당이 넣습니다.**
함께 볼 문서: [26 프론트 API 명세서](26_프론트_API_명세서.md) (API · 쿠키 · 호출 래퍼)
> 

## 0. 한눈에

```
브라우저 ──▶ https://indig.co.kr        Vercel (프론트 · 이 문서)
        └─▶ https://api.indig.co.kr    Cloudflare → AWS (Gateway · API)
```

| 누가 | 할 일 |
| --- | --- |
| **프론트 담당** | Vercel 가입 · 프로젝트 생성 · 빌드 설정 · 환경변수 · 도메인 추가 · 프론트 코드(라우트 · SPA 폴백 · robots.txt) |
| **인프라 담당** | Vercel 이 알려주는 DNS 레코드를 Cloudflare 에 입력 · 토스 **클라이언트** 키 전달 |

## 1. 🔴 꼭 지킬 것

| # | 규칙 | 어기면 |
| --- | --- | --- |
| 1 | 운영 주소는 **`https://indig.co.kr` 하나**. `www.indig.co.kr` 은 여기로 **리다이렉트** | API 의 CORS 허용 출처가 `https://indig.co.kr` 하나라 `www` 에서는 모든 API 호출이 CORS 에러. 쿠키(`Domain=.indig.co.kr`)도 이 주소 기준 |
| 2 | 레포 `SW-Team07-2026-2/client` 는 **public 유지** | Vercel Hobby(무료)는 조직의 private 레포를 배포하지 못합니다 |
| 3 | 환경변수에 **비밀 값 금지** | `VITE_*` 값은 빌드 결과 JS 에 그대로 들어가 누구나 봅니다. 토스는 **클라이언트 키(`test_gck_…`)만** — 시크릿 키는 서버에만 있습니다 |
| 4 | 로그인 · API 확인은 **`https://indig.co.kr` 에서만** | 미리보기 주소(`*.vercel.app`)는 CORS 에 없어서 API 호출이 전부 막힙니다. 미리보기는 화면 확인용 · API 연동은 로컬(`localhost:5173` → 로컬 Gateway)에서 |

## 2. 준비물

- GitHub 계정 (조직 `SW-Team07-2026-2` 멤버여야 Vercel 이 레포를 봅니다 — 아니면 인프라 담당에게 초대 요청)
- `client` 레포에 **첫 커밋** (빈 레포는 가져올 수 없음) · 기본 브랜치 `main`
- 인프라 담당에게 받을 것: 토스 클라이언트 키 `test_gck_…`

## 3. 프로젝트 만들기

1. [vercel.com](https://vercel.com/) → **Continue with GitHub** → 플랜 **Hobby**
2. **Add New… → Project** → Import Git Repository 에서 `SW-Team07-2026-2` 가 안 보이면 **Adjust GitHub App Permissions** → 조직 `SW-Team07-2026-2` 에 Vercel 앱 설치 → Repository access 는 **Only select repositories → `client`** 하나만
    - 조직 관리자 승인이 필요하다고 나오면 인프라 담당에게 승인 요청
3. `client` → **Import**
4. Framework Preset 은 자동 감지값 확인 (아래 4절) → 환경변수 입력 (5절) → **Deploy**

브랜치 동작 (기본값 그대로):

| 브랜치 | 결과 |
| --- | --- |
| `main` | **운영** 배포 → `indig.co.kr` |
| 그 외 (`develop` · PR) | 미리보기 배포 → `*.vercel.app` (1절 4번 — API 안 됨) |

## 4. 빌드 설정

| 항목 | Vite + Svelte (SPA) | SvelteKit |
| --- | --- | --- |
| Framework Preset | Vite | SvelteKit |
| Build Command | `npm run build` | `npm run build` |
| Output Directory | `dist` | (자동) |
| SPA 폴백 | 레포 루트에 `vercel.json` (아래) | `adapter-static` + `fallback: 'index.html'` 또는 `adapter-vercel` |
| Node 버전 | Settings → General → Node.js Version 을 로컬과 같게 | 같음 |

`vercel.json` (Vite SPA) — `/concerts/12` 같은 주소에서 새로고침해도 404 가 안 나게:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

실제 파일(`/assets/*.js` · `/robots.txt` 등)은 이 규칙보다 먼저 응답되므로 그대로 나갑니다.

## 5. 환경변수

Settings → **Environment Variables** · Environment 는 **Production** (Preview 에 넣어도 API 는 막힘 — 1절 4번)

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `VITE_API_BASE` | `https://api.indig.co.kr` | 26 §0-7 호출 래퍼가 읽는 이름 · 끝에 `/` 없이 |
| `VITE_TOSS_CLIENT_KEY` | `test_gck_…` (인프라 담당에게 받기) | 26 §5-0 의 `CLIENT_KEY` |
- 값은 **빌드할 때** 박힙니다 → 바꾼 뒤에는 Deployments → 최신 배포 **Redeploy**
- 로컬은 `.env.local` (커밋 금지 · `.gitignore` 확인) — `VITE_API_BASE=http://localhost:8080`

## 6. 도메인 연결

1. 프로젝트 → Settings → **Domains** → `indig.co.kr` 입력 → **Add**
2. `www.indig.co.kr` 도 같이 추가하겠냐고 물으면 **추천 설정 그대로** — `www` 는 **Redirect to `indig.co.kr`** (308)
    - 🔴 반대(`www` 가 메인 · apex 가 리다이렉트)로 되어 있으면 바꿔 주세요 (1절 1번)
3. 두 도메인에 **Invalid Configuration** 과 함께 넣어야 할 레코드가 나옵니다. 화면에 나온 값을 **그대로** 인프라 담당에게 보냅니다:
    
    ```
    Type   Name   Value
    A      @      (Vercel 화면 값 — 예: 216.198.79.1 또는 76.76.21.21)
    CNAME  www    (Vercel 화면 값 — 예: xxxx.vercel-dns-017.com 또는 cname.vercel-dns.com)
    TXT    _vercel  (나올 때만 — 도메인 소유 확인용)
    ```
    
4. 인프라 담당이 넣으면 몇 분 안에 **Valid Configuration** 으로 바뀌고, HTTPS 인증서는 Vercel 이 자동으로 발급합니다.

## 7. 프론트 코드에 있어야 하는 것

**① 화면 경로** — 서버(Gateway · 토스)가 이 주소로 돌려보냅니다. 경로 이름을 바꾸면 백엔드 설정도 바꿔야 하니 먼저 알려 주세요.

| 경로 | 언제 오나 |
| --- | --- |
| `/` | 로그인 성공 (기존 회원) |
| `/signup` | 처음 로그인 → ✏️ 11/05 약관 동의 → 밴드 고르기 (26 §6-1) |
| `/login` | 로그인 실패 · 취소 |
| `/payments/success` | 토스 결제 성공 (`?paymentKey&orderId&amount`) |
| `/payments/fail` | 토스 결제 실패 (`?code&message`) |

**② 로그인 시작은 페이지 이동** — `location.href = VITE_API_BASE + "/oauth2/authorization/kakao"` (`fetch` 아님)

**③ `robots.txt`** — 정적 파일(`public/` 또는 `static/`)에:

```
User-agent: *
Disallow: /api/
Disallow: /studio/
Disallow: /queue/
Disallow: /search?
```

**④ API 오류 처리 — Cloudflare 응답** 🆕 11/02

API 앞의 Cloudflare 가 직접 막을 때는 **우리 JSON 형식(`{ isSuccess, code, ... }`)이 아닌 HTML** 이 옵니다. `res.json()` 이 실패해도 화면이 죽지 않게 해 주세요 (26 §0-7 래퍼에 반영).

| 상태 | 언제 | 화면 |
| --- | --- | --- |
| `429` (HTML) | 같은 IP 에서 10초에 `/api/` 100회 넘음 → 10초 차단 | “요청이 너무 많아요. 잠시 후 다시” |
| `403` (HTML) | 허용 경로(`/api/` · `/oauth2/`) 밖 · 이상한 메서드 | 정상 화면에서는 나오지 않음 — 나오면 경로 오타 |

## 8. 확인 체크리스트

- [ ]  `https://indig.co.kr` 접속 → 화면이 뜸 · 자물쇠(HTTPS) 정상
- [ ]  `https://www.indig.co.kr` → `https://indig.co.kr` 로 이동
- [ ]  깊은 주소(예: `/concerts/1`)에서 새로고침 → 404 아님
- [ ]  `https://indig.co.kr/robots.txt` 가 7절 ③ 내용
- [ ]  개발자도구 Network: `api.indig.co.kr` 호출에 CORS 에러 없음 · 요청에 쿠키가 실림
- [ ]  카카오 로그인 → `/` 또는 `/signup` 으로 돌아옴 → 새로고침해도 로그인 유지

> ✏️ 11/05 — API 서버(`api.indig.co.kr`)는 배포가 끝나 응답합니다. 위 API 항목(CORS · 쿠키 · 카카오 로그인)은 `indig.co.kr` 도메인 연결(6절) 뒤에 확인됩니다 — ✏️ 11/05 카카오는 **정규 앱**이라 카카오 계정이면 누구나 로그인됩니다 (처음이면 `/signup` 약관 동의부터). 운영 반영 버전은 [26](26_프론트_API_명세서.md) 맨 위 🟢 표.
> 

## 9. 자주 막히는 곳

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| Import 화면에 조직 레포가 안 보임 | Vercel GitHub 앱이 조직에 없음 | 3절 2번 |
| “private repository … Hobby” 오류 | 레포가 private | 레포를 public 으로 (1절 2번) |
| 모든 API 가 CORS 에러 | `www` 나 `*.vercel.app` 에서 접속 | `https://indig.co.kr` 로 접속 (1절 1 · 4번) |
| 로그인 후 바로 401 | 쿠키를 안 실음 | `fetch(..., { credentials: "include" })` (26 §0-1) |
| 환경변수를 바꿨는데 그대로 | 빌드 때 박히는 값 | Redeploy |
| 도메인이 계속 Invalid | DNS 레코드 미입력 · 오타 | 6절 3번 값을 다시 인프라 담당에게 |

---

## 10. 인프라 담당 메모 (Cloudflare)

- 받은 레코드를 DNS → Records 에 입력 · **Proxy status 는 끔(회색 구름 · DNS only)** — Vercel 이 이미 CDN 이고, 주황으로 켜면 Vercel 의 인증서 발급 · 리다이렉트가 꼬입니다 (docs/19 §9-1 · 02)
- `@` 는 `indig.co.kr` 그 자체 — Cloudflare 는 apex CNAME 도 받지만 Vercel 이 준 **A** 를 그대로 씁니다
- 지금 Cloudflare 에 넣은 SSL · WAF · 레이트 리밋 규칙은 **주황 구름 레코드(`api`)에만** 적용 — 프론트 레코드에는 영향 없음
- 토스 클라이언트 키 `test_gck_…` 를 프론트 담당에게 전달 (공개돼도 되는 키 · 시크릿 키 `test_sk_…` · `test_gsk_…` 는 절대 전달하지 않음)