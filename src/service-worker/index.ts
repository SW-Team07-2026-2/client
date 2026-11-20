import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE_NAME = `indig-assets-${version}`;

const PRECACHE_IMMUTABLE = immutable.map((entry) => entry.path);
// 5MB가 넘는 음원(.mp3) 등은 Range 요청(206)으로 처리되므로 사전 캐시에서 제외
const PRECACHE_STATIC = assets
	.map((entry) => entry.path as string)
	.filter((path) => !path.endsWith('.mp3'));

const PRECACHE_ASSETS = [...PRECACHE_IMMUTABLE, ...PRECACHE_STATIC];
const CACHEABLE_SET = new Set<string>(PRECACHE_ASSETS);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(PRECACHE_ASSETS);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	if (request.headers.has('range')) return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/oauth2/')) return;

	// SvelteKit 빌드 청크(FluidVinyl 등 JS/CSS)와 정적 에셋은 캐시 우선 반환
	if (!CACHEABLE_SET.has(url.pathname)) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			const cached = await cache.match(url.pathname);
			if (cached) return cached;

			const response = await fetch(request);
			if (response.ok && response.status === 200) {
				await cache.put(url.pathname, response.clone());
			}
			return response;
		})()
	);
});
