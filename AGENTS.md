# Frontend Development Guidelines

## 1. Responsive & Device-Aware Architecture
- **로직과 디자인 역할의 엄격한 분리 (`logic/` · `design/pc/` · `design/mobile/`)**:
  - **`logic/` (`.svelte.ts` / `.ts`)**: API 요청, 세션/인증, `localStorage`/`sessionStorage`/쿠키, 데이터 매핑, 비즈니스 계산, 상태 관리를 전담한다.
  - **`design/pc/` · `design/mobile/` (`.svelte`)**: 오직 `logic`에서 전달받은 데이터(props)와 이벤트 콜백만 받아 **렌더링만 수행**한다. API 호출, 스토리지·쿠키·세션·전역 스토어 직접 접근 및 비즈니스 로직 작성을 금지한다. (순수 UI 인터랙션/애니메이션 제어만 허용)
  - **진입점(Shell `.svelte`)**: `logic` 인스턴스를 연결하고 디바이스 판별 결과에 따라 `design/pc` 또는 `design/mobile`에 데이터를 주입해 조립한다. (단, 구조 차이가 크지 않은 소형/원자 UI 컴포넌트는 단일 파일 내 분기를 사용할 수 있다.)
- **계층 아키텍처 준수**: 최상위 레이아웃(App Shell) → 메인 레이아웃(카테고리 전환) → 카테고리 섹션(PC/모바일 하위 섹션 및 상세) 계층과 섹션 분리는 `docs/frontend_section_architecture.md`를 따른다.
- **정밀 디바이스 판별**: 단순 화면 폭(`width`)에만 의존하지 말고, 실제 디바이스 특성(터치 지원 `navigator.maxTouchPoints > 0`, `(pointer: coarse)`, 디바이스 정보 등)을 결합하여 모바일을 판별한다.
- **고사양 리소스 지연 로딩**: Canvas, WebGL, 3D 등 무거운 그래픽 컴포넌트는 모바일 환경에서 번들 다운로드를 차단하기 위해 동적 임포트(`await import(...)`)로 로드한다.

## 2. User Code Preservation (회귀 방지)
- **사용자 수정분 보존**: 사용자가 직접 조정한 스타일, 마크업, 로직을 AI 임의로 초기화하거나 기존 코드로 되돌리지(revert) 않는다.
- 기존 변경 사항의 맥락을 분석하고 이를 유지하면서 점진적으로 코드를 수정한다.

## 3. Centralized Configuration & Styling
- **하드코딩 금지**: 색상 코드, 폰트, API 엔드포인트, 시스템 상수 등을 컴포넌트 내에 리터럴로 직접 작성하지 않는다.
- **CSS 테마 변수**: 디자인/스타일 변수는 `src/routes/layout.css`에 정의된 테마 변수(`var(--bg)`, `var(--surface)`, `var(--fg)` 등)를 최우선 참조하며, 신규 전역 변수 필요 시 해당 파일에 추가해 사용한다.
- **시스템 설정 & API**: API 주소 및 시스템 상수는 `src/lib/config/` 내 기존 설정을 우선 탐색해 사용하며, 부재 시 `src/lib/config/`에 정의/추가하여 import해 사용한다.

