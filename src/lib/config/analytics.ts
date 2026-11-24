// GA4 측정 ID — 페이지 소스에 그대로 보이는 공개 값
export const GA_MEASUREMENT_ID = 'G-2Q1YXF43W5';

// GA4 태그 · 행동 메트릭을 켜는 주소 — 로컬 · Vercel 미리보기 접속은 수집하지 않는다
// sw-academy-workspace-front.vercel.app 은 indig.co.kr 연결 전 임시 운영 주소 (연결 뒤 제거)
export const ANALYTICS_HOSTS: readonly string[] = [
	'indig.co.kr',
	'www.indig.co.kr',
	'sw-academy-workspace-front.vercel.app'
];

// 행동 메트릭 전송 (Member M31 · docs/v2_프론트_체크사항 「행동 메트릭」)
export const METRICS_PATH = '/api/members/me/metrics';
export const METRIC_FLUSH_COUNT = 20; // 이만큼 모이면 보낸다
export const METRIC_FLUSH_INTERVAL_MS = 10_000; // 이 간격마다 보낸다
export const METRIC_BATCH_MAX = 50; // 한 번에 보내는 최대 개수 (서버 한도)
export const METRIC_BUFFER_MAX = 200; // 못 보낸 이벤트를 쌓아 두는 최대 개수
