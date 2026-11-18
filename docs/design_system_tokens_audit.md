# INDIG 프론트엔드 디자인 토큰 전수 조사 및 통합 가이드

> **작성일**: 2026-11-14  
> **목적**: 프로젝트 전반에 산재된 스타일 값(색상, 폰트, 보더, 투명도, 블러, 그림자, 모션, 유체 파라미터)을 전수 조사하고, 체계적인 디자인 시스템 상수화를 위한 기초 자료를 제공합니다.

---

## 1. 개요 및 파편화 현황 분석

현재 프로젝트는 고도화된 인터랙션(Fluid Canvas, 모핑 패널, 글래스모피즘, SVG 모션 등)을 구현하는 과정에서 화면·컴포넌트 단위로 스타일이 개별 작성되어 다음과 같은 파편화가 발생해 있습니다:

1. **색상값(Color)**: 220여 종의 HEX 코드와 80여 종의 RGBA 코드가 혼재. 특히 미세하게 다른 어두운 배경색(15종 이상)과 화이트 반투명 알파값(20종 이상)이 컴포넌트별로 하드코딩됨.
2. **폰트 크기(Font Size)**: 0.01~0.03rem 단위로 쪼개진 38종 이상의 폰트 크기(`0.72rem`, `0.75rem`, `0.78rem`, `0.8125rem`, `0.85rem` 등)가 Tailwind 유틸리티(`text-sm`, `text-xs`)와 무분별하게 혼용됨.
3. **모서리 반경(Border Radius)**: 4px부터 9999px(Pill)까지 23종 이상의 반경이 2px 단위로 흩어져 있음.
4. **블러 효과(Backdrop Blur)**: `blur(7px)`부터 `blur(28px)`까지 8종 이상의 블러 수치가 혼재되어 레이어 깊이감이 체계화되지 않음.
5. **인터랙션/이징(Easing & Transitions)**: `cubic-bezier(0.16, 1, 0.3, 1)` 등 고급 베지어 곡선이 잘 적용되어 있으나, 지속시간(duration)과 타이밍이 통일되지 않음.

---

## 2. 현재 정의된 전역 CSS 변수 (`src/routes/layout.css`)

```css
:root {
  --bg: #070709;           /* 기본 페이지 배경 */
  --white: #ffffff;        /* 순수 화이트 */
  --white-2: #FAFAFA;      /* 오프화이트 */
  --surface: #1b1b1bff;    /* 1차 카드/서피스 배경 */
  --surface-2: #2e2e2eff;  /* 2차 호버/강조 서피스 */
  --line: #3b3b3bff;       /* 구분선/테두리 */
  --fg: #f0f0f0ff;         /* 기본 전경 본문 텍스트 */
  --muted: #acabadff;      /* 보조/뮤트 텍스트 */
  --accent: #ffffffff;     /* 강조 */
  --accent-weak: #3d3d3dff;/* 보조 강조 */
}
```
> **이슈 사항**: `layout.css` 17번 라인에 `--gray: # --surface: ...` 형태의 오타가 포함되어 있으며, 실제 대다수 컴포넌트에서는 위 변수 대신 인라인/컴포넌트 스코프 스타일에서 하드코딩된 HEX/RGBA를 직접 사용하고 있습니다.

---

## 3. 색상 시스템 (Color Palette) 전수 조사

### 3.1 어두운 배경/서피스 계열 (Dark Backgrounds & Surfaces)
다크 테마 기반의 배경색들이 미세한 명도 차이로 분산되어 있습니다:

| 색상 코드 | 시각 프리뷰 | 출현 빈도 | 주요 사용처 | 역할 및 분석 |
|:---|:---:|:---:|:---|:---|
| `#070709` | <span style="background-color:#070709;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 10회 | layout.css, FdProfileButton, SignupModal, +layout.svelte | 프로젝트 최상위 기본 배경색 (`--bg`) |
| `#000000` | <span style="background-color:#000000;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 16회 | ArtistCard, FdTitle, FdDiv, FdWelcomeDisplay | 완전한 블랙 (모바일 배경, 오버레이, 캔버스 클리어) |
| `#09090b` | <span style="background-color:#09090b;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | +page.svelte (welcome), MainPageHeader | Zinc-950 계열 극단 다크 배경 |
| `#0d0e12` | <span style="background-color:#0d0e12;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | BotArea.svelte | 챗봇 하단 앵커/덱 서피스 |
| `#0f0f14` | <span style="background-color:#0f0f14;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | ChatInput.svelte, BotArea.svelte | 입력창/프리뷰 칩 배경 |
| `#111827` | <span style="background-color:#111827;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | ChatInput.svelte, UserBubble.svelte | Gray-900 (텍스트 혹은 다크 대비 요소) |
| `#121217` | <span style="background-color:#121217;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | BotArea.svelte | 챗봇 패널 내부 서피스 |
| `#14151a` | <span style="background-color:#14151a;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | ArtistSection.svelte, SignupModal.svelte | 카드 배경 다크 틴트 |
| `#171717` | <span style="background-color:#171717;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | UserBubble.svelte, ArtistCard.svelte | Neutral-900 (유저 말풍선 텍스트/카드) |
| `#181820` | <span style="background-color:#181820;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | ChatInput.svelte, SignupModal.svelte | 드래그 오버레이/모달 백그라운드 |
| `#1a1a1a` | <span style="background-color:#1a1a1a;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | FdInput.svelte, BotArea.svelte | 입력 박스 기본 바디 배경 |
| `#1a1a1f` | <span style="background-color:#1a1a1f;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | ChatInput.svelte, BotArea.svelte | 챗봇 FdDiv 유체 기본 배경 |
| `#1b1b1b` | <span style="background-color:#1b1b1b;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | layout.css | 기존 `--surface` 정의값 |
| `#202020` | <span style="background-color:#202020;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | FdInput.svelte, BotArea.svelte | 입력 박스 호버/포커스 배경 |
| `#212127` | <span style="background-color:#212127;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | ChatInput.svelte | 챗봇 FdDiv 호버/프레스 배경 |
| `#25252b` | <span style="background-color:#25252b;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | ChatInput.svelte | 챗봇 FdDiv 액티브(포커스) 배경 |
| `#26262e` | <span style="background-color:#26262e;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | ChatInput.svelte | 유체 뒷물결 비활성 색상 |
| `#2e2e2e` | <span style="background-color:#2e2e2e;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | layout.css | 기존 `--surface-2` 정의값 |
| `#303030` | <span style="background-color:#303030;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | FdInput.svelte | FdInput 포커스 시 배경 |
| `#32323b` | <span style="background-color:#32323b;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | ChatInput.svelte | 유체 뒷물결 활성 색상 |

> **통합 권장안**: 다크 배경은 **5단계**(`bg-root: #070709`, `surface-base: #141419`, `surface-elevated: #1a1a22`, `surface-hover: #22222a`, `surface-active: #2b2b35`)로 표준화 필요.

### 3.2 텍스트 및 전경색 계열 (Text & Foreground Colors)
텍스트 가독성을 위한 화이트/그레이 계열 색상 분포입니다:

| 색상 코드 | 시각 프리뷰 | 출현 빈도 | 주요 사용처 | 역할 및 분석 |
|:---|:---:|:---:|:---|:---|
| `#ffffff` | <span style="background-color:#ffffff;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 58회 | PcHeader, MarkdownViewer, ArtistSection, BotMessage | 헤드라인, 메인 텍스트, 하이라이트 (`--white`) |
| `#fafafa` | <span style="background-color:#fafafa;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 8회 | FdPageTitle, MainPageHeader, layout.css | 오프화이트 타이틀 (`--white-2`) |
| `#f1f5f9` | <span style="background-color:#f1f5f9;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 5회 | BotArea, ChatInput, MarkdownViewer | Slate-100 (봇 대화창 기본 텍스트) |
| `#f0f0f0` | <span style="background-color:#f0f0f0;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | layout.css, FdProfileButton | 기본 본문 전경색 (`--fg`) |
| `#eee` | <span style="background-color:#eee;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | ChatInput, FdInput, BotArea | 입력창 기본 텍스트 |
| `#e4e4e7` | <span style="background-color:#e4e4e7;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 11회 | ChatMessages, MarkdownViewer, SignupModal | Zinc-200 (서브 타이틀 및 안내 텍스트) |
| `#e2e8f0` | <span style="background-color:#e2e8f0;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | ChatInput, MarkdownViewer, UserBubble | Slate-200 (첨부파일 칩, 뱃지 텍스트) |
| `#cbd5e1` | <span style="background-color:#cbd5e1;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | BotArea, MarkdownViewer | Slate-300 (추천 질문 칩 텍스트) |
| `#acabad` | <span style="background-color:#acabad;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 1회 | layout.css | 기존 `--muted` 정의값 |
| `#a1a1aa` | <span style="background-color:#a1a1aa;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 7회 | FdWelcomeDisplay, SignupModal, mypage | Zinc-400 (설명글, 비활성 텍스트) |
| `#a1a1a1` | <span style="background-color:#a1a1a1;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 5회 | FdPageTitle, MainPageHeader | 뮤트 설명글 |
| `#8c8c96` | <span style="background-color:#8c8c96;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 7회 | SignupModal, MainPageHeader, MobileBottomBar | 아이콘 기본색 및 보조 캡션 |
| `#808080` | <span style="background-color:#808080;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 4회 | ChatInput, FdInput | 플레이스홀더 텍스트 컬러 |
| `#71717a` | <span style="background-color:#71717a;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | ArtistCard, SignupModal | Zinc-500 (메타데이터 텍스트) |
| `#52525b` | <span style="background-color:#52525b;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 2회 | ArtistSection, SignupModal | Zinc-600 (구분선 및 비활성 아이콘) |
| `#3f3f46` | <span style="background-color:#3f3f46;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | 3회 | ArtistSection, SignupModal | Zinc-700 (다크 보더 라인) |

> **통합 권장안**: 텍스트는 **4계층**(`text-primary: #ffffff`, `text-secondary: #e4e4e7`, `text-muted: #8c8c96`, `text-placeholder: #52525b`)으로 단일화 권장.

### 3.3 포인트 및 상태/기능성 컬러 (Accent & Functional Colors)
인터랙션 피드백, 장르 뱃지, 미디어 타입, 상태 표시 등에 사용된 유채색 계열입니다:

| 색상 코드 | 시각 프리뷰 | 계열 / 역할 | 주요 사용처 |
|:---|:---:|:---|:---|
| `#fb7185` | <span style="background-color:#fb7185;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Rose / 핑크 (음악 볼륨/파동 펄스, 아티스트 태그) | FdWelcomeDisplay, ArtistSection, Bot.svelte |
| `#f43f5e` | <span style="background-color:#f43f5e;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Rose / 레드 (좋아요 하트 활성화) | ArtistCard.svelte |
| `#ef4444` | <span style="background-color:#ef4444;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Red / 경고/에러 (삭제 버튼 호버, 업로드 제한, 오류 알림) | ChatInput, BotMessage, SignupModal |
| `#60a5fa` | <span style="background-color:#60a5fa;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Blue / 링크/정보 (마크다운 외부 링크, 안내 아이콘) | MarkdownViewer, FdWelcomeDisplay |
| `#38bdf8` | <span style="background-color:#38bdf8;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Sky / 비디오 (첨부파일 비디오 아이콘/뱃지) | ChatInput.svelte |
| `#818cf8` | <span style="background-color:#818cf8;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Indigo / 코드/도큐먼트 (문서 첨부 아이콘, 코드 블록 인디케이터) | ChatInput.svelte, MarkdownViewer |
| `#6366f1` | <span style="background-color:#6366f1;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Indigo / 포커스/브랜드 (추천 칩 호버 보더, 카카오 로그인 보조) | BotArea.svelte, SignupModal.svelte |
| `#a855f7` | <span style="background-color:#a855f7;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Purple / 장르 (힙합/R&B 장르 태그 및 앰비언트 글로우) | ArtistSection.svelte |
| `#c084fc` | <span style="background-color:#c084fc;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Purple / 오디오 (첨부파일 음원 아이콘) | ChatInput.svelte |
| `#a78bfa` | <span style="background-color:#a78bfa;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Violet / 아티스트 (아티스트 카드 도트, 동적 파동) | ArtistCard.svelte, BotArea.svelte |
| `#22c55e` | <span style="background-color:#22c55e;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Green / 성공/재생 (재생 중 인디케이터, 성공 뱃지) | FdBgmPlayer.svelte, BotMessage.svelte |
| `#10b981` | <span style="background-color:#10b981;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Emerald / 라이브 (라이브 활동 표시등) | ArtistSection.svelte |
| `#fee500` | <span style="background-color:#fee500;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Kakao Yellow (카카오 로그인 버튼 공식 컬러) | SignupModal.svelte, BotArea.svelte |
| `#f59e0b` | <span style="background-color:#f59e0b;display:inline-block;width:20px;height:20px;border:1px solid #444;border-radius:4px;"></span> | Amber / 주의 (서비스 지연/경고 배너) | BotMessage.svelte, ChatMessages.svelte |

### 3.4 반투명 화이트 글래스모피즘 계열 (`rgba(255, 255, 255, alpha)`)
글래스모피즘 및 다크 모드 투과 효과를 위해 사용된 알파값들입니다. **0.04부터 0.85까지 18종 이상 파편화**되어 있습니다:

| RGBA 값 | 출현 빈도 | 주 용도 | 사용 컴포넌트 |
|:---|:---:|:---|:---|
| `rgba(255, 255, 255, 0.04)` | 4회 | 최상단 알림 뱃지, 극저대비 카드 배경 | ChatMessages, MarkdownViewer, SignupModal |
| `rgba(255, 255, 255, 0.06)` | 7회 | 테이블 헤더, 보조 버튼 배경 | MarkdownViewer, SignupModal, mypage |
| `rgba(255, 255, 255, 0.08)` | 19회 | 첨부파일 칩, 카드 기본 배경 (가장 빈번) | ChatInput, ChatMessages, FdProfileButton |
| `rgba(255, 255, 255, 0.1)` | 5회 | 패널 테두리, 버튼 호버 배경 | BotArea, ChatHeader, SignupModal |
| `rgba(255, 255, 255, 0.12)` | 11회 | 서브 카드 보더, 인풋창 드래그 활성 배경 | ChatMessages, MarkdownViewer, ArtistSection |
| `rgba(255, 255, 255, 0.14)` | 5회 | 버튼 호버 강조, 첨부 확장 칩 | ChatInput, MarkdownViewer, SignupModal |
| `rgba(255, 255, 255, 0.15)` | 3회 | 아이콘 버튼 호버 배경 | BotArea, ChatInput |
| `rgba(255, 255, 255, 0.18)` | 3회 | 삭제 버튼, 중간 강조 칩 | ChatInput, SignupModal |
| `rgba(255, 255, 255, 0.22)` | 4회 | 카드 보더 강조, 모달 내부 디바이더 | ArtistCard, SignupModal, ArtistSection |
| `rgba(255, 255, 255, 0.25)` | 2회 | 화이트 글로우 섀도우 | ChatInput, BotMessage |
| `rgba(255, 255, 255, 0.45)` | 6회 | 뮤트 텍스트/아이콘 오버레이 | Bot, BotMessage, MarkdownViewer |
| `rgba(255, 255, 255, 0.55)` | 4회 | 포커스 링, 반투명 화이트 보더 | Bot, FdProfileButton, ArtistSection |
| `rgba(255, 255, 255, 0.72)` | 2회 | 유체 캔버스 외부 물결 오버레이 | FdDiv, FdImage |
| `rgba(255, 255, 255, 0.82)` | 2회 | 아이콘 기본 투명도 | ChatInput, BotArea |

> **통합 권장안**: 화이트 투명도는 **5단계**(`glass-subtle: 0.04`, `glass-card: 0.08`, `glass-border: 0.12`, `glass-hover: 0.16`, `glass-strong: 0.25`)로 통일 권장.

### 3.5 반투명 블랙 딤 및 그림자 계열 (`rgba(0, 0, 0, alpha)`)

| RGBA 값 | 출현 빈도 | 주 용도 | 사용 컴포넌트 |
|:---|:---:|:---|:---|
| `rgba(0, 0, 0, 0.15)` | 2회 | 말풍선 소프트 그림자 | UserBubble.svelte |
| `rgba(0, 0, 0, 0.25)` | 2회 | 카드 리프트 그림자 | UserBubble.svelte |
| `rgba(0, 0, 0, 0.3)` | 3회 | 마크다운 블록/메시지 섀도우 | MarkdownViewer, BotMessage |
| `rgba(0, 0, 0, 0.35)` | 4회 | 추천 칩 섀도우, 입력창 팝 버튼 섀도우 | ChatInput, ChatMessages, BotArea |
| `rgba(0, 0, 0, 0.5)` | 2회 | 플로팅 봇 드롭섀도우 | BotArea.svelte |
| `rgba(0, 0, 0, 0.65)` | 3회 | 모바일 전체 화면 딤, 모핑 패널 베이스 섀도우 | BotArea.svelte |
| `rgba(0, 0, 0, 0.75)` | 3회 | 모바일 모핑 패널 상단 깊은 섀도우 | BotArea.svelte, FdWelcomeDisplay |
| `rgba(0, 0, 0, 0.85)` | 2회 | 이미지 삭제 버튼 배경 | ChatInput.svelte |

---

## 4. 타이포그래피 (Typography) 전수 조사

### 4.1 폰트 패밀리 (Font Families)
- **기본 Sans**: `'Noto Sans KR', 'Pretendard Variable', Pretendard, 'IBM Plex Sans KR', sans-serif` (`--font-sans`)
- **모노스페이스**: `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace` (`--font-mono`, 코드 블록 전용)
- **디스플레이/타이틀**: `'Black Han Sans', 'IBM Plex Sans KR', sans-serif` (`--font-display`, 브랜드 로고 및 웰컴 메인 타이틀)

### 4.2 폰트 크기 (`font-size`) 파편화 분석
컴포넌트 내 `font-size` 속성에 **38종 이상의 상이한 수치**가 하드코딩되어 있습니다:

| 폰트 크기 (CSS) | 픽셀 환산 (16px 기준) | 출현 횟수 | 주요 사용처 | 역할 |
|:---|:---:|:---:|:---|:---|
| `0.6rem` | ~9.6px | 1회 | ChatInput.svelte | 파일 확장자 미니 뱃지 |
| `0.7rem` | ~11.2px | 1회 | ChatMessages.svelte | 타임스탬프 텍스트 |
| `0.72rem` | ~11.5px | 5회 | ChatMessages, FdWelcomeDisplay | 최근 대화 안내 문구, 메타 캡션 |
| `0.75rem (text-xs)` | ~12px | 4회 | ChatInput, SignupModal | 첨부파일 칩, 헬퍼 텍스트 |
| `0.78rem` | ~12.5px | 5회 | ChatMessages, SignupModal | 에러 코드 안내, 인풋 서브 텍스트 |
| `0.8rem` | ~12.8px | 3회 | BotMessage, FdWelcomeDisplay | 액션 알약 칩 문구 |
| `0.8125rem` | ~13px | 6회 | ChatInput, FdProfileButton | 드래그 오버레이, 추천 칩 텍스트 |
| `0.85rem` | ~13.6px | 2회 | ChatMessages, ArtistSection | 모달 필드 라벨 |
| `0.875rem (text-sm)` | ~14px | 10회 | FdProfileButton, SignupModal, FdInput | 기본 UI 버튼, 일반 라벨 (최다 사용) |
| `0.88rem` | ~14px | 4회 | MarkdownViewer, ArtistSection | 마크다운 리스트, 아티스트 설명 |
| `0.925rem` | ~14.8px | 1회 | ChatInput.svelte | 채팅 인풋 필드 입력 텍스트 |
| `0.9375rem` | ~15px | 2회 | UserBubble.svelte | 유저 말풍선 본문 |
| `0.95rem` | ~15.2px | 4회 | PcHeader, FdInput, SignupModal | 네비게이션 메뉴, 인풋 미디엄 |
| `1rem (text-base)` | ~16px | 2회 | ChatHeader, mypage | 챗봇 헤더 타이틀, 마이페이지 서브헤더 |
| `1.05rem` | ~16.8px | 3회 | MarkdownViewer, FdInput, welcome | 마크다운 h4/인풋 라지 |
| `1.125rem (text-lg)` | ~18px | 2회 | MarkdownViewer, ArtistCard | 마크다운 h3, 카드 타이틀 |
| `1.25rem (text-xl)` | ~20px | 2회 | MarkdownViewer, SignupModal | 마크다운 h2, 모달 타이틀 |
| `1.5rem (text-2xl)` | ~24px | 2회 | MarkdownViewer, MainPageHeader | 마크다운 h1, 메인 헤더 타이틀 |
| `clamp(2rem, 5vw, 3.5rem)` | ~32~56px | 2회 | FdPageTitle.svelte | 반응형 메인 페이지 빅 타이틀 |

> **통합 권장안 (타입 스케일)**:  
> `text-2xs(0.65rem/10px)` → `text-xs(0.75rem/12px)` → `text-sm(0.875rem/14px)` → `text-base(0.9375rem~1rem/15~16px)` → `text-lg(1.125rem/18px)` → `text-xl(1.25rem/20px)` → `text-2xl(1.5rem/24px)` 7단계로 수렴.

### 4.3 폰트 두께 (`font-weight`)

| 두께 값 | Tailwind 매핑 | 출현 횟수 | 주요 사용처 |
|:---|:---:|:---:|:---|
| `300` | `font-light` | 1회 | MarkdownViewer.svelte (코드 블록 주석) |
| `400 / normal` | `font-normal` | 4회 | 마크다운 본문, 일반 단락, 플레이스홀더 |
| `500` | `font-medium` | 13회 | 유저 말풍선, 뱃지, 추천 칩, 인풋 입력값 (기본 전경 강조) |
| `600` | `font-semibold` | 18회 | 챗봇 헤더, 카드 타이틀, 액션 버튼, 네비게이션 링크 |
| `700 / bold` | `font-bold` | 8회 | 파일 확장자 뱃지, 마크다운 볼드/헤딩, 모달 헤더 |
| `800` | `font-extrabold` | 2회 | 웰컴 타이틀, 아티스트 랭킹 넘버 |

### 4.4 줄간격 (`line-height`) & 자간 (`letter-spacing`)
- **Line Height**: `1.2`(타이틀/헤딩), `1.4`(컴팩트 인풋/칩), `1.45`(말풍선 대화), `1.6~1.7`(마크다운 본문)
- **Letter Spacing**: `-0.02em` ~ `-0.01em`(타이틀 및 헤더 자간 축소), `0.02em` ~ `0.05em`(영문 뱃지/확장자)

---

## 5. 테두리 및 모서리 반경 (Borders & Radius) 전수 조사

### 5.1 테두리 두께 및 형태 (`border`)
- `1px solid rgba(255, 255, 255, 0.1)`: 모핑 패널, 글래스 카드 기본 경계선
- `1px solid rgba(255, 255, 255, 0.08)`: 서브 칩, 알림 뱃지
- `1px solid rgba(255, 255, 255, 0.12~0.14)`: 추천 칩, 마크다운 코드블록
- `border: none` / `borderWidth: 0`: 플로팅 덱, FdDiv 인풋창, 모바일 드로어 하단
- `2px solid ...`: 포커스 링, 체크 버튼 아웃라인

### 5.2 모서리 반경 (`border-radius`) 파편화
무려 **23종류**의 반경이 사용 중입니다:

| 반경 값 | 출현 횟수 | 주요 컴포넌트 | 용도 |
|:---|:---:|:---|:---|
| `4px` | 5회 | ChatMessages, MarkdownViewer | 마크다운 인라인 코드, 스크롤바 썸 |
| `5px` | 2회 | ChatInput.svelte | 파일 확장자 미니 뱃지 |
| `6px` | 1회 | SignupModal.svelte | 약관 체크박스 |
| `8px` | 3회 | FdTitle, UserBubble, mypage | 첨부파일 카드, 오디오 컨트롤러 |
| `10px` | 2회 | ChatHeader, BotMessage | 닫기 버튼, 액션 알약 칩 |
| `12px` | 8회 | ChatInput, FdProfileButton, SignupModal | 첨부 칩, 추천 질문 칩, 일반 카드 (소형) |
| `14px` | 4회 | UserBubble, SignupModal | 미디어 프리뷰 썸네일, 모달 내부 블록 |
| `16px` | 2회 | ArtistCard, SignupModal | 아티스트 카드, 모달 폼 박스 |
| `18px` | 3회 | UserBubble.svelte | 유저 말풍선 캡슐 |
| `20px` | 2회 | FdInput.svelte | 기본 FdInput 모서리 |
| `22px` | 2회 | ChatInput.svelte | FdDiv 인풋창 본체 및 드래그 오버레이 |
| `24px` | 1회 | ArtistSection.svelte | 섹션 래퍼 박스 |
| `28px` | 2회 | BotArea.svelte | 모핑 대화창 데스크톱 패널 |
| `28px 28px 0 0` | 2회 | BotArea.svelte | 모핑 대화창 모바일 바텀시트 상단 |
| `40px` | 2회 | BotArea.svelte | 모핑 축소 시 80px 원형 클립패스 반경 |
| `9999px / full` | 11회 | ChatInput, FdProfileButton, BotArea | 원형 버튼, 알약 캡슐 전송 버튼, 봇 트리거 |
| `50%` | 4회 | BotArea, FdWelcomeDisplay | 원형 봇 캐릭터, 프로필 아바타 |

> **통합 권장안 (Radius 스케일)**:  
> `r-xs(4px)` → `r-sm(8px)` → `r-md(12px)` → `r-lg(16px)` → `r-xl(22px)` → `r-2xl(28px)` → `r-full(9999px)` 7단계로 규격화.

---

## 6. 투명도 및 블러 효과 (Opacity & Blur)

### 6.1 불투명도 (`opacity`) 단계
- `0.45 ~ 0.55`: 비활성(disabled) 상태, 부가 정보 아이콘
- `0.65`: 서브 텍스트, 접힌 상태 힌트
- `0.7 ~ 0.82`: 인라인 액션 버튼 기본 상태
- `0.95 ~ 1.0`: 호버 시 완전 활성화

### 6.2 백드롭 블러 (`backdrop-filter: blur(...)`) 계층
글래스모피즘 효과의 깊이감을 담당하는 블러 수치입니다:

| 블러 수치 | 출현 횟수 | 사용처 | 효과 계층 및 체감 깊이 |
|:---|:---:|:---|:---|
| `blur(7px) ~ blur(8px)` | 11회 | PcHeader, ChatMessages, MarkdownViewer | 가벼운 배경 오버레이 (헤더, 알림 뱃지) |
| `blur(10px)` | 1회 | ChatInput.svelte | 인풋 드래그 앤 드롭 오버레이 |
| `blur(12px)` | 6회 | ChatMessages, SignupModal | 중간 깊이 카드 및 모달 서피스 |
| `blur(14px)` | 4회 | MobileHeader, welcome | 모바일 상단 헤더, 추천 질문 칩 |
| `blur(16px)` | 4회 | MobileBottomBar, welcome | 모바일 하단 탭 내비게이션 바 |
| `blur(28px) saturate(180%)` | 4회 | BotArea (모핑 패널), SignupModal | 최상위 플로팅 대화창 / 모달 (고밀도 극저투과) |

> **통합 권장안 (Blur 4단계)**:  
> `blur-sm: 8px` (헤더/인라인 뱃지) → `blur-md: 14px` (모바일 바/카드) → `blur-lg: 20px` (서브 패널) → `blur-xl: 28px` (메인 대화창/모달).

---

## 7. 그림자 시스템 (Box Shadow & Elevation)

| 그림자 수치 | 출현 횟수 | 주요 사용처 | 역할 |
|:---|:---:|:---|:---|
| `none` | 5회 | ChatInput, FdWelcomeDisplay | 그림자 완전 제거 (플랫 처리) |
| `0 2px 8px rgba(0, 0, 0, 0.35)` | 1회 | ChatInput.svelte | 전송 버튼 팝업 그림자 |
| `0 2px 10px rgba(0, 0, 0, 0.15)` | 1회 | UserBubble.svelte | 유저 말풍선 부유 그림자 |
| `0 4px 12px rgba(0, 0, 0, 0.3)` | 1회 | BotMessage.svelte | 봇 액션 알약 버튼 그림자 |
| `0 4px 12px rgba(255, 255, 255, 0.25)` | 1회 | ChatInput.svelte | 전송 버튼 호버 화이트 글로우 |
| `0 4px 14px rgba(0, 0, 0, 0.25~0.3)` | 3회 | UserBubble.svelte | 미디어 썸네일 카드 그림자 |
| `0 4px 16px rgba(0, 0, 0, 0.3)` | 1회 | MarkdownViewer.svelte | 마크다운 코드 블록 그림자 |
| `0 -16px 48px rgba(0, 0, 0, 0.75)` | 1회 | BotArea.svelte | 모바일 모핑 시트 상단 방향 깊은 그림자 |
| `0 24px 64px -12px rgba(0, 0, 0, 0.65)` | 1회 | BotArea.svelte | 데스크톱 모핑 패널 플로팅 고도 그림자 |
| `drop-shadow(0 8px 24px rgba(0, 0, 0, 0.5))` | 1회 | BotArea.svelte | 3D 날아다니는 봇 액터 본체 그림자 |

---

## 8. 모션, 애니메이션 및 이징 (Motion & Easing)

### 8.1 시그니처 베지어 곡선 (`cubic-bezier`)

| 베지어 곡선 정의 | 사용 횟수 | 주요 컴포넌트 | 특성 및 사용 목적 |
|:---|:---:|:---|:---|
| `cubic-bezier(0.16, 1, 0.3, 1)` | 12회 | BotArea, BotMessage, UserBubble, Logo | INDIG 시그니처 감속 곡선: 매우 빠르고 쫀득하게 안착 (창 오픈, 말풍선 상승, 뷰 트랜지션) |
| `cubic-bezier(0.22, 1, 0.36, 1)` | 17회 | FdProfileButton, FdWelcomeDisplay | 스탠다드 UI 인터랙션: 부드러운 감속 호버/클릭 반응 |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | 4회 | ChatInput, BotArea | 오버슈트 스프링: 버튼 팝업, 봇 호버 바운스 텐션 |
| `cubic-bezier(0.32, 0.72, 0, 1)` | 2회 | BotArea.svelte | 닫힘/복귀 전용: 튀지 않고 자연스럽게 수축하는 곡선 |

### 8.2 애니메이션 지속시간 (`duration`) 단계
- **초단기 (120ms ~ 150ms)**: 드래그 오버레이 fade, 버튼 배경색 전환 (`0.15s ease`)
- **단기 (180ms ~ 220ms)**: 아이콘 호버 트랜스폼, 첨부 슬라이드 접힘/펼침 (`slide 220ms`)
- **중기 (280ms ~ 360ms)**: 전송 버튼 스프링 전개(`0.28s`), 유저 말풍선 상승(`0.36s`)
- **장기 (460ms ~ 520ms)**: 모핑 대화창 오픈/닫힘 (`0.46s` / `0.52s`), 비행 봇 도킹 이동
- **루프/주기 (3.2s ~ 4.2s)**: 첨부 칩 부유 애니메이션 (`chipFloatBob 3.2s infinite`)

---

## 9. 유체 캔버스 물리 파라미터 (Fluid & Canvas Tokens)

`FluidSetting` 및 Fd 시리즈 컴포넌트 내부에서 캔버스 파동 시뮬레이션에 사용하는 물리 수치입니다:

| 파라미터 | 기본값 | 주요 컴포넌트별 커스텀 수치 | 의미 |
|:---|:---:|:---|:---|
| `radius` | `999 (Pill)` | `인풋: 22 / 버튼: 999 / 카드: 16~28` | 도형 기본 모서리 곡률 (px) |
| `reach` | `40` | `버튼: 40 / 인풋: 0 (고정) / 웰컴: 34` | 마우스 포인터 근접 감지 반경 (px) |
| `bulge` | `8` | `버튼: 8 / 인풋: 0 (돌출 억제) / 웰컴: 5` | 포인터 근접 시 테두리가 솟아오르는 높이 (px) |
| `bulgeWidth` | `22` | `22 ~ 24` | 근접 돌출 가우시안 폭 (px) |
| `layers` | `2` | `2 (바깥 물결 2겹)` | 뒤쪽 렌더링 물결 겹 수 (0~2) |
| `layerGap` | `3` | `버튼: 3 / 인풋: 2.0 / 웰컴: 2.6` | 물결 겹 사이 간격 (px) |
| `waveAmp` | `3` | `버튼: 3.0 / 인풋: 1.4 / 웰컴: 2.0` | 물결 요동 진폭 (px) |
| `waveLength` | `70` | `70 ~ 74` | 물결 1파장 길이 (px) |
| `spin` | `1.2` | `버튼: 1.2 / 인풋: 0.72 / 웰컴: 0.95` | 물결 회전 속도 (rad/s) |
| `pressDeform` | `{x:1.5, y:-2.5}` | `버튼: 기본값 / 인풋: {x:0, y:0} (변형 방지)` | 클릭 누름 시 가로/세로 탄성 텐션량 |

---

## 10. 향후 통합 및 상수화(Standardization) 제안 방향

현재의 파도풀 방식 하드코딩을 제거하고 유지보수성을 극대화하기 위한 단계별 로드맵입니다:

### 1단계: CSS 전역 변수 확장 (`src/routes/layout.css`)
- 현재 10개 남짓한 변수에 **Glass 투명도 단계, Backdrop Blur 단계, Radius 단계, Elevation 그림자 단계**를 추가 정의합니다.
- `@theme` 블록에 Tailwind v4 호환 디자인 토큰을 등록하여 `bg-surface-elevated`, `backdrop-blur-md` 등의 유틸리티를 프로젝트 표준으로 삼습니다.

### 2단계: TypeScript 디자인 토큰 정의 (`src/lib/config/tokens.ts`)
- 캔버스, SVG, 애니메이션 타이밍 등 CSS 변수로 직접 제어하기 어려운 영역을 위해 TS 상수를 생성합니다:
  - `EASING`: `SIGNATURE_DECEL`, `BOUNCE_OVERSHOOT`, `SMOOTH_RETURN`
  - `DURATION`: `INSTANT(120ms)`, `FAST(180ms)`, `NORMAL(280ms)`, `SLOW(460ms)`
  - `FLUID_PRESETS`: `BUTTON_FLUID`, `INPUT_FLUID`, `CARD_FLUID`

### 3단계: 점진적 리팩토링 (회귀 방지)
- `ChatInput.svelte`, `BotArea.svelte`, `SignupModal.svelte` 등 복잡한 인터랙션이 들어간 컴포넌트부터 인라인 값을 상수로 치환합니다.

---
*이 문서는 자동화 스크립트로 추출된 `token_audit_raw.json`을 기반으로 생성되었습니다.*