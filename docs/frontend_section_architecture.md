# Frontend 레이아웃 · 섹션 아키텍처

> **핵심 원칙**
> 1. **`logic/` (`.svelte.ts` / `.ts`)**: API 요청, 세션·인증, `localStorage`·`sessionStorage`·쿠키, 데이터 매핑, 상태 관리 전담
> 2. **`design/` (`.svelte`)**: `logic`에서 전달받은 데이터(props)와 콜백만 받아 **렌더링만 수행** (API·스토리지·전역 스토어 직접 접근 금지)
> 3. **기존 디자인·애니메이션 유지**: 내부 코드 구조 최적화·객체화 수행

---

## 1. 디렉토리 구조 (`src/lib/`)

```text
src/lib/
 ├── common/                         # 전역 공용 (기존 components/ui · utils · stores · fluid 통합)
 │    ├── type/                      # 유체 설정 · 스프링 타입/물리 유틸 (fluid.ts, spring.ts)
 │    ├── design/                    # 전역 재사용 UI 컴포넌트 (아이콘 · DynamicText 등)
 │    │    └── fluid/                # 유체(Fd*) 컴포넌트 (FdButton, FdDiv, FdImage, FdToast 등)
 │    └── logic/                     # 전역 공용 로직 (기존 stores · utils)
 │
 └── layout/                         # 화면 계층 트리 (1 → 2 → 3 → 4)
      ├── 1_app_shell/               # 최상위 레이아웃 (화면 고정 UI)
      │    ├── AppShell.svelte       # 진입점: logic 연결 + PC/MB 조립
      │    ├── logic/                # 네비게이션, 스크롤 가시성, 헤더 veil, 모바일 3-패널 히스토리
      │    ├── part/
      │    │    ├── chat_bot/        # 챗봇 전용 모듈 (ChatBot.svelte + logic/ + design/[Pc/Mb 헤더·인풋])
      │    │    └── notification/    # 알림 전용 모듈 (NotificationPanel.svelte + logic/ + design/[MbNotificationHeader])
      │    └── design/
      │         ├── PcHeader.svelte       # PC 상단 고정 헤더 (로고 · 카테고리 네비 · 프로필)
      │         ├── MbShellStage.svelte   # 모바일 3-패널(좌:챗봇 / 중:메인 / 우:알림) 수평 슬라이드 + 공유 아이콘 FLIP 모션 전담
      │         ├── MbHeader.svelte       # 모바일 스크롤 반응 헤더 (로고 · 챗봇 · 알림함)
      │         └── MbNavigationBar.svelte# 모바일 하단 네비게이션 바 (카테고리 · 마이페이지)
      │
      ├── 2_main_section/            # 메인 레이아웃 (카테고리 섹션 간 전환)
      │    ├── MainSection.svelte    # 진입점: Keep-Alive 전환 · 스와이프 스테이지
      │    └── logic/                # 카테고리 전환 슬라이드, 모바일 스와이프, 라우트·스크롤 동기화
      │
      ├── 3_content_section/         # 콘텐츠단 레이아웃 (헤더 · 옵션바 · 필터 · 정렬 영역)
      │    ├── ContentSection.svelte # 진입점: logic 연결 + PC/MB 분기
      │    ├── PcContentSection.svelte    # PC 조합 (헤더 · 옵션바 · 필터 · 정렬 영역)
      │    ├── MbContentSection.svelte    # 모바일 조합 (옵션바 · 제어센터형 필터 · 플로팅바 · 정렬 영역)
      │    ├── logic/                # 검색·필터·피드탭 상태, 스토리지 영속화, 공통 카탈로그 컨트롤러
      │    └── design/
      │         ├── PcContentHeader.svelte      # PC 다이나믹 타이틀 · 부설명
      │         ├── PcContentControl.svelte     # PC 옵션 바 (검색 · 필터 토글 · 피드/옵션 버튼)
      │         ├── PcContentFilter.svelte      # PC 필터 드로어
      │         ├── MbContentHeader.svelte      # 모바일 상단 콘텐츠 바
      │         ├── MbContentControl.svelte     # 모바일 옵션 플로팅바 (우측 하단 · 스크롤 중 우측 숨김)
      │         ├── MbContentFilter.svelte      # 모바일 제어센터형 대형 필터 오버레이
      │         ├── control_module/             # 검색창·옵션 버튼 등 공용 컨트롤 모듈
      │         └── filter_module/              # 장르·지역·가격·정렬 등 공용 필터 모듈
      │
      └── 4_category/                # 카테고리별 섹션 (데이터 + 카드 + 상세)
           ├── artist/
           │    ├── logic/           # 아티스트 목록/상세 API, 팔로우, 캐시, 상세 모핑 상태
           │    └── design/          # ArtistCard.svelte, ArtistDetail.svelte (렌더링 전용)
           ├── concert/
           │    ├── logic/           # 공연 목록/상세 API, 북마크 상태
           │    └── design/          # ConcertCard.svelte, ConcertDetail.svelte
           ├── album/
           │    ├── logic/           # 앨범 목록/상세 API, 위시리스트 상태
           │    └── design/          # AlbumCard.svelte, AlbumDetail.svelte
           ├── goods/
           │    ├── logic/           # 굿즈 목록/상세 API, 위시리스트 상태
           │    └── design/          # GoodsCard.svelte, GoodsDetail.svelte
           └── mypage/
                ├── logic/           # 마이페이지 프로필·보관함·로그아웃 로직
                └── design/          # MyPageView.svelte 등 렌더링 전용 뷰
```

---

## 2. 계층별 책임 요약

| 계층 | 담당 역할 | PC 구성 | 모바일 구성 |
| :--- | :--- | :--- | :--- |
| **1. `1_app_shell`** | 화면 고정 최상위 프레임 | `PcHeader`, `PcBotArea` | `MbHeader`, `MbNavigationBar`, `MbOverlayPage` |
| **2. `2_main_section`** | 5개 카테고리 간 화면 전환 | Keep-Alive 슬라이드 | Keep-Alive + 좌우 스와이프 |
| **3. `3_content_section`** | 콘텐츠 헤더·옵션·필터·정렬 틀 | 헤더 + 옵션바 + 필터 드로어 + 정렬 영역 | 옵션바 + 제어센터형 필터 + 플로팅바 + 정렬 영역 |
| **4. `4_category`** | 도메인 데이터 + 카드 + 상세 | `logic/`(API·상태) + `design/`(카드·상세) | `logic/` 공유 + `design/`(카드·상세) |

---

## 3. 카테고리별 섹션 조합

| 구성 요소 | 아티스트 | 공연 | 앨범 | 굿즈 | 마이페이지 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **콘텐츠 헤더 (PC)** | O | O | O | O | O |
| **옵션 바 · 필터 · 플로팅바** | O | O | O | O | X |
| **정렬 영역 아이템 (`design/`)** | `ArtistCard` | `ConcertCard` | `AlbumCard` | `GoodsCard` | `MyPageView` |
| **상세 컴포넌트 (`design/`)** | `ArtistDetail` | `ConcertDetail` | `AlbumDetail` | `GoodsDetail` | (필요 시 확장) |

---

## 4. 컴포넌트 분류 규칙

- **`src/lib/common/type/`**: 유체 설정·스프링 물리 모델 (`fluid.ts`, `spring.ts`)
- **`src/lib/common/design/`**: 전역 재사용 UI (`BellIcon`, `CheckIcon`, `DynamicText`, `fluid/Fd*` 등)
- **`src/lib/common/logic/`**: 전역 공용 스토어 (`isMobile`, `toast`, `bgmManager` 등) 및 유틸리티 (`scroll`, `directionalBlur` 등)
- **`src/lib/layout/**/design/`**: 해당 계층/카테고리의 순수 렌더링 컴포넌트 (`ArtistCard`, `ArtistDetail`, `PcHeader` 등)
- **`src/lib/layout/**/part/`**: 해당 계층 한 곳에서만 쓰는 내부 보조 조각
- **`src/lib/layout/**/logic/`**: 순수 `.ts` / `.svelte.ts` 로직 (UI 마크업·스타일 금지)
