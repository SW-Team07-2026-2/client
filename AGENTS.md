# Frontend Development Guidelines

## 1. Responsive & Device-Aware Architecture
- **단일 파일 내 분기**: 컴포넌트는 단일 파일로 작성하되, PC와 모바일 뷰/인터랙션은 내부에서 명확히 분기한다.
- **정밀 디바이스 판별**: 단순 화면 폭(`width`)에만 의존하지 말고, 실제 디바이스 특성(터치 지원 `navigator.maxTouchPoints > 0`, `(pointer: coarse)`, 디바이스 정보 등)을 결합하여 모바일을 판별한다.
- **고사양 리소스 지연 로딩**: Canvas, WebGL, 3D 등 무거운 그래픽 컴포넌트는 모바일 환경에서 번들 다운로드를 차단하기 위해 동적 임포트(`await import(...)`)로 로드한다.

## 2. User Code Preservation (회귀 방지)
- **사용자 수정분 보존**: 사용자가 직접 조정한 스타일, 마크업, 로직을 AI 임의로 초기화하거나 기존 코드로 되돌리지(revert) 않는다.
- 기존 변경 사항의 맥락을 분석하고 이를 유지하면서 점진적으로 코드를 수정한다.

## 3. Centralized Configuration & Styling
- **하드코딩 금지**: 색상 코드, 폰트, API 엔드포인트, 시스템 상수 등을 컴포넌트 내에 리터럴로 직접 작성하지 않는다.
- **CSS 테마 변수**: 디자인/스타일 변수는 `src/routes/layout.css`에 정의된 테마 변수(`var(--bg)`, `var(--surface)`, `var(--fg)` 등)를 최우선 참조하며, 신규 전역 변수 필요 시 해당 파일에 추가해 사용한다.
- **시스템 설정 & API**: API 주소 및 시스템 상수는 `src/lib/config/` 내 기존 설정을 우선 탐색해 사용하며, 부재 시 `src/lib/config/`에 정의/추가하여 import해 사용한다.

