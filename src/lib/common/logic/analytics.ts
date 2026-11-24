import { api, auth } from '#lib/auth';
import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
import {
	ANALYTICS_HOSTS,
	GA_MEASUREMENT_ID,
	METRIC_BATCH_MAX,
	METRIC_BUFFER_MAX,
	METRIC_FLUSH_COUNT,
	METRIC_FLUSH_INTERVAL_MS,
	METRICS_PATH
} from '#lib/config/analytics';
import { parseCatalogDetailRoute } from './detailOverlayState.svelte';

/** 백엔드 Member MetricType 과 같은 값 — 주석은 value 의 뜻 */
export type MetricType =
	| 'DETAIL_VIEW' // 상세 화면 진입 — 1
	| 'DWELL' // 상세 화면에 머문 시간 — ms
	| 'PREVIEW_PLAY' // 미리듣기 재생 시간 — ms
	| 'SEARCH_CLICK' // 검색 결과 클릭 — 결과 순위 (properties.keyword)
	| 'RECOMMEND_CLICK' // 추천 카드 클릭 — 1 (properties.source)
	| 'CART_ADD' // 장바구니 담기 — 수량 (properties.optionId)
	| 'CART_REMOVE' // 장바구니 빼기 — 수량
	| 'SHARE' // 공유 — 1
	| 'EXTERNAL_LINK_CLICK'; // 외부 구매처 링크 클릭 — 1

/** 백엔드 Member MetricTargetType 과 같은 값 */
export type MetricTargetType =
	'ARTIST' | 'ALBUM' | 'TRACK' | 'PHYSICAL_ALBUM' | 'GOODS' | 'CONCERT';

type MetricProperties = Record<string, string | number | boolean>;

interface MetricEvent {
	metricId: string;
	targetType: MetricTargetType;
	targetId: number;
	metricType: MetricType;
	metricValue: number;
	properties?: MetricProperties;
	occurredAt: string;
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

// 상세 주소(/artist/12 등)의 카테고리 → 메트릭 대상 (앨범 목록의 id 는 피지컬 음반 id)
const DETAIL_TARGET: Record<CatalogCategoryKey, MetricTargetType> = {
	artist: 'ARTIST',
	concert: 'CONCERT',
	album: 'PHYSICAL_ALBUM',
	goods: 'GOODS'
};

let started: boolean | null = null; // null = 아직 시작 전
let gaUserId: string | null = null;
let buffer: MetricEvent[] = [];
let sending = false;
let detail: { targetType: MetricTargetType; targetId: number; since: number | null } | null = null;

function currentUserId(): string | null {
	return auth.user?.userId || null;
}

function gtag(...args: unknown[]): void {
	(window as GtagWindow).gtag?.(...args);
}

/**
 * 운영 주소에서 처음 한 번 GA4 태그(gtag.js)를 불러오고 메트릭 전송을 준비한다. 수집하는 주소면 true.
 * 화면 이동(pushState)마다의 page_view 는 GA4 향상된 측정이 자동으로 보낸다.
 */
function start(): boolean {
	if (started !== null) return started;
	started = typeof window !== 'undefined' && ANALYTICS_HOSTS.includes(location.hostname);
	if (!started) return false;

	const w = window as GtagWindow;
	const dataLayer = (w.dataLayer ??= []);
	w.gtag = function () {
		// gtag.js 는 배열이 아니라 arguments 객체를 그대로 받아야 동작한다
		// eslint-disable-next-line prefer-rest-params
		dataLayer.push(arguments);
	};
	gaUserId = currentUserId();
	w.gtag('js', new Date());
	w.gtag('config', GA_MEASUREMENT_ID, gaUserId ? { user_id: gaUserId } : {});

	const script = document.createElement('script');
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
	document.head.appendChild(script);

	setInterval(() => void flush(false), METRIC_FLUSH_INTERVAL_MS);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			pauseDwell();
			void flush(true);
		} else {
			resumeDwell();
		}
	});
	window.addEventListener('pagehide', () => {
		pauseDwell();
		void flush(true);
	});
	return true;
}

/**
 * 로그인 · 로그아웃 때 GA4 user_id(회원 번호)를 맞춘다.
 * 회원이 바뀌면(로그아웃 포함) 아직 못 보낸 이전 회원의 메트릭은 버린다.
 */
export function setAnalyticsUser(userId: string | null): void {
	if (!start()) return;
	const id = userId || null;
	if (id === gaUserId) return;
	buffer = [];
	gaUserId = id;
	gtag('set', { user_id: id });
}

/**
 * 행동 1건을 GA4 이벤트와 Member 메트릭 API(로그인 회원만) 양쪽으로 보낸다.
 * value — 대부분 1, DWELL · PREVIEW_PLAY 는 ms, CART_* 는 수량, SEARCH_CLICK 은 결과 순위
 */
export function track(
	type: MetricType,
	targetType: MetricTargetType,
	targetId: number,
	value = 1,
	properties?: MetricProperties
): void {
	if (!start()) return;
	const metricValue = Math.max(0, Math.round(value));
	gtag('event', type.toLowerCase(), {
		target_type: targetType,
		target_id: targetId,
		metric_value: metricValue,
		...properties
	});

	if (!auth.isLoggedIn) return;
	buffer.push({
		metricId: uuidv7(),
		targetType,
		targetId,
		metricType: type,
		metricValue,
		properties,
		occurredAt: new Date().toISOString()
	});
	if (buffer.length > METRIC_BUFFER_MAX) buffer.splice(0, buffer.length - METRIC_BUFFER_MAX);
	if (buffer.length >= METRIC_FLUSH_COUNT) void flush(false);
}

/** 화면 이동마다 호출 — 상세 화면에 들어가면 DETAIL_VIEW, 떠나는 상세 화면은 머문 시간(DWELL) */
export function trackNavigation(pathname: string | null): void {
	const route = parseCatalogDetailRoute(pathname);
	const targetType = route ? DETAIL_TARGET[route.category] : null;
	if (detail && route && detail.targetType === targetType && detail.targetId === route.id) return;

	pauseDwell();
	detail = null;
	if (!route || !targetType) return;
	detail = { targetType, targetId: route.id, since: Date.now() };
	track('DETAIL_VIEW', targetType, route.id);
}

// 상세 화면을 떠나거나 탭이 가려지면 그때까지 머문 시간을 보내고, 다시 보이면 이어서 잰다
function pauseDwell(): void {
	if (!detail || detail.since === null) return;
	const ms = Date.now() - detail.since;
	detail.since = null;
	track('DWELL', detail.targetType, detail.targetId, ms);
}

function resumeDwell(): void {
	if (detail && detail.since === null) detail.since = Date.now();
}

/** 쌓인 메트릭을 50개씩 보낸다. keepalive — 화면을 떠날 때라 남은 것을 한꺼번에 보낸다 */
async function flush(keepalive: boolean): Promise<void> {
	if (!auth.isLoggedIn) {
		buffer = [];
		return;
	}
	if (keepalive) {
		while (buffer.length > 0) void send(buffer.splice(0, METRIC_BATCH_MAX), true);
		return;
	}
	if (sending || buffer.length === 0) return;
	sending = true;
	try {
		await send(buffer.splice(0, METRIC_BATCH_MAX), false);
	} finally {
		sending = false;
	}
}

async function send(events: MetricEvent[], keepalive: boolean): Promise<void> {
	try {
		await api(METRICS_PATH, { method: 'POST', body: JSON.stringify({ events }), keepalive });
	} catch (err) {
		// 형식 오류(400)는 다시 보내도 같아서 버리고, 429 · 네트워크 · 서버 오류는 같은 metricId 로 다시 보낸다
		if ((err as { status?: number }).status === 400) return;
		buffer = [...events, ...buffer].slice(-METRIC_BUFFER_MAX);
	}
}

/** UUIDv7 — 앞 48비트가 밀리초 시각이라 서버 인덱스에 시간순으로 쌓인다 */
function uuidv7(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	let ts = Date.now();
	for (let i = 5; i >= 0; i--) {
		bytes[i] = ts % 256;
		ts = Math.floor(ts / 256);
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x70; // 버전 7
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
