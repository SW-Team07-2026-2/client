// GA4 측정 ID — 페이지 소스에 그대로 보이는 공개 값
export const GA_MEASUREMENT_ID = 'G-2Q1YXF43W5';

// GA4 태그를 켜는 주소 — 로컬 · Vercel 미리보기 접속은 수집하지 않는다
// sw-academy-workspace-front.vercel.app 은 indig.co.kr 연결 전 임시 운영 주소 (연결 뒤 제거)
export const GA_ENABLED_HOSTS: readonly string[] = [
	'indig.co.kr',
	'www.indig.co.kr',
	'sw-academy-workspace-front.vercel.app'
];
