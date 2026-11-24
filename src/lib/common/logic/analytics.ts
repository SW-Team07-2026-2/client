import { GA_ENABLED_HOSTS, GA_MEASUREMENT_ID } from '#lib/config/analytics';

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/**
 * 운영 주소에서만 GA4 태그(gtag.js)를 한 번 불러온다.
 * 화면 이동(pushState)마다의 page_view 는 GA4 향상된 측정이 자동으로 보낸다.
 */
export function initAnalytics(): void {
	if (!GA_ENABLED_HOSTS.includes(location.hostname)) return;

	const w = window as GtagWindow;
	if (w.gtag) return;

	const dataLayer = (w.dataLayer ??= []);
	w.gtag = function () {
		// gtag.js 는 배열이 아니라 arguments 객체를 그대로 받아야 동작한다
		// eslint-disable-next-line prefer-rest-params
		dataLayer.push(arguments);
	};
	w.gtag('js', new Date());
	w.gtag('config', GA_MEASUREMENT_ID);

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
	document.head.appendChild(script);
}
