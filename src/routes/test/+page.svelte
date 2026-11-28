<script lang="ts">
	import BookingPageView from '#lib/dedicated/booking/design/BookingPageView.svelte';
	import type { BookingConcertMeta, QueueStatusDto } from '#lib/dedicated/booking/logic/types';
	import type { AlbumCardGroup } from '#lib/layout/4_category/4-3_album/logic/albumCategory.svelte';
	import PcAlbumItem from '#lib/layout/4_category/4-3_album/design/PcAlbumItem.svelte';
	import MbAlbumItem from '#lib/layout/4_category/4-3_album/design/MbAlbumItem.svelte';
	import PcAlbumSkeleton from '#lib/layout/4_category/4-3_album/design/PcAlbumSkeleton.svelte';
	import MbAlbumSkeleton from '#lib/layout/4_category/4-3_album/design/MbAlbumSkeleton.svelte';

	function makeCoverDataUrl(bg1: string, bg2: string, accent: string, label: string): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
			<defs>
				<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stop-color="${bg1}"/>
					<stop offset="100%" stop-color="${bg2}"/>
				</linearGradient>
			</defs>
			<rect width="400" height="400" fill="url(#g)"/>
			<circle cx="280" cy="120" r="110" fill="${accent}" opacity="0.35"/>
			<circle cx="110" cy="270" r="85" fill="${accent}" opacity="0.2"/>
			<text x="28" y="64" fill="rgba(255,255,255,0.65)" font-family="sans-serif" font-size="22" font-weight="700" letter-spacing="2">${label}</text>
		</svg>`;
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	}

	function makeMediaDataUrl(bg1: string, bg2: string, ring: string): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
			<defs>
				<radialGradient id="rg" cx="45%" cy="40%" r="65%">
					<stop offset="0%" stop-color="${bg1}"/>
					<stop offset="100%" stop-color="${bg2}"/>
				</radialGradient>
			</defs>
			<rect width="320" height="320" fill="url(#rg)"/>
			<circle cx="160" cy="160" r="118" fill="none" stroke="${ring}" stroke-width="6" opacity="0.55"/>
			<circle cx="160" cy="160" r="78" fill="none" stroke="${ring}" stroke-width="3" opacity="0.4"/>
		</svg>`;
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	}

	const SAMPLE_GROUPS: Array<{ tag: string; group: AlbumCardGroup }> = [
		{
			tag: '1. LP 단독',
			group: {
				key: 'sample-1',
				routeId: 101,
				albumId: 1,
				title: '서울병',
				artistName: '쏜애플',
				frontCoverUrl: makeCoverDataUrl('#7f1d1d', '#1c1917', '#f87171', 'LP ONLY'),
				mediaItems: [
					{
						id: 101,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#991b1b', '#171717', '#fca5a5'),
						price: 48000,
						soldOut: false
					}
				],
				formatPrices: [{ format: 'LP', minPrice: 48000, soldOut: false }],
				isSoldOut: false,
				primaryItem: { id: 101, title: '서울병', artistName: '쏜애플' }
			}
		},
		{
			tag: '2. CD 단독',
			group: {
				key: 'sample-2',
				routeId: 102,
				albumId: 2,
				title: '23',
				artistName: '혁오',
				frontCoverUrl: makeCoverDataUrl('#0f766e', '#042f2e', '#5eead4', 'CD ONLY'),
				mediaItems: [
					{
						id: 102,
						kind: 'cd',
						formatLabel: 'CD',
						imageUrl: makeMediaDataUrl('#14b8a6', '#134e4a', '#ccfbf1'),
						price: 18500,
						soldOut: false
					}
				],
				formatPrices: [{ format: 'CD', minPrice: 18500, soldOut: false }],
				isSoldOut: false,
				primaryItem: { id: 102, title: '23', artistName: '혁오' }
			}
		},
		{
			tag: '3. 카세트 단독',
			group: {
				key: 'sample-3',
				routeId: 103,
				albumId: 3,
				title: 'Tellusboutyourself',
				artistName: '백예린',
				frontCoverUrl: makeCoverDataUrl('#b45309', '#292524', '#fcd34d', 'CASSETTE'),
				mediaItems: [
					{
						id: 103,
						kind: 'cassette',
						formatLabel: '카세트',
						imageUrl: makeMediaDataUrl('#d97706', '#451a03', '#fde68a'),
						price: 22000,
						soldOut: false
					}
				],
				formatPrices: [{ format: '카세트', minPrice: 22000, soldOut: false }],
				isSoldOut: false,
				primaryItem: { id: 103, title: 'Tellusboutyourself', artistName: '백예린' }
			}
		},
		{
			tag: '4. LP 2종 (블랙 + 컬러)',
			group: {
				key: 'sample-4',
				routeId: 104,
				albumId: 4,
				title: '계몽',
				artistName: '쏜애플',
				frontCoverUrl: makeCoverDataUrl('#4c1d95', '#0f172a', '#c084fc', '2x LP'),
				mediaItems: [
					{
						id: 1041,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#27272a', '#09090b', '#a1a1aa'),
						price: 45000,
						soldOut: false
					},
					{
						id: 1042,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#9333ea', '#3b0764', '#e9d5ff'),
						price: 54000,
						soldOut: false
					}
				],
				formatPrices: [{ format: 'LP', minPrice: 45000, maxPrice: 54000, soldOut: false }],
				isSoldOut: false,
				primaryItem: { id: 1041, title: '계몽', artistName: '쏜애플' }
			}
		},
		{
			tag: '5. LP + CD 조합',
			group: {
				key: 'sample-5',
				routeId: 105,
				albumId: 5,
				title: '검정치마 201',
				artistName: '검정치마',
				frontCoverUrl: makeCoverDataUrl('#1d4ed8', '#0f172a', '#60a5fa', 'LP + CD'),
				mediaItems: [
					{
						id: 1051,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#1e3a8a', '#020617', '#93c5fd'),
						price: 52000,
						soldOut: false
					},
					{
						id: 1052,
						kind: 'cd',
						formatLabel: 'CD',
						imageUrl: makeMediaDataUrl('#38bdf8', '#0c4a6e', '#e0f2fe'),
						price: 19000,
						soldOut: false
					}
				],
				formatPrices: [
					{ format: 'LP', minPrice: 52000, soldOut: false },
					{ format: 'CD', minPrice: 19000, soldOut: false }
				],
				isSoldOut: false,
				primaryItem: { id: 1051, title: '검정치마 201', artistName: '검정치마' }
			}
		},
		{
			tag: '6. LP + CD + 카세트 (3종)',
			group: {
				key: 'sample-6',
				routeId: 106,
				albumId: 6,
				title: '사랑으로',
				artistName: '새소년',
				frontCoverUrl: makeCoverDataUrl('#be185d', '#18181b', '#f472b6', 'LP+CD+TAPE'),
				mediaItems: [
					{
						id: 1061,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#9d174d', '#1f1218', '#f9a8d4'),
						price: 49000,
						soldOut: false
					},
					{
						id: 1062,
						kind: 'cd',
						formatLabel: 'CD',
						imageUrl: makeMediaDataUrl('#ec4899', '#500724', '#fbcfe8'),
						price: 17500,
						soldOut: false
					},
					{
						id: 1063,
						kind: 'cassette',
						formatLabel: '카세트',
						imageUrl: makeMediaDataUrl('#fb7185', '#4c0519', '#ffe4e6'),
						price: 23000,
						soldOut: false
					}
				],
				formatPrices: [
					{ format: 'LP', minPrice: 49000, soldOut: false },
					{ format: 'CD', minPrice: 17500, soldOut: false },
					{ format: '카세트', minPrice: 23000, soldOut: false }
				],
				isSoldOut: false,
				primaryItem: { id: 1061, title: '사랑으로', artistName: '새소년' }
			}
		},
		{
			tag: '7. 최대 4장 (LP 2 + CD + 카세트)',
			group: {
				key: 'sample-7',
				routeId: 107,
				albumId: 7,
				title: 'POWER ANDRE 99',
				artistName: '실리카겔',
				frontCoverUrl: makeCoverDataUrl('#047857', '#052e16', '#34d399', 'MAX 4 ITEMS'),
				mediaItems: [
					{
						id: 1071,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#065f46', '#022c22', '#6ee7b7'),
						price: 58000,
						soldOut: false
					},
					{
						id: 1072,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#10b981', '#064e3b', '#d1fae5'),
						price: 64000,
						soldOut: false
					},
					{
						id: 1073,
						kind: 'cd',
						formatLabel: 'CD',
						imageUrl: makeMediaDataUrl('#34d399', '#065f46', '#ecfdf5'),
						price: 21000,
						soldOut: false
					},
					{
						id: 1074,
						kind: 'cassette',
						formatLabel: '카세트',
						imageUrl: makeMediaDataUrl('#059669', '#022c22', '#a7f3d0'),
						price: 25000,
						soldOut: false
					}
				],
				formatPrices: [
					{ format: 'LP', minPrice: 58000, maxPrice: 64000, soldOut: false },
					{ format: 'CD', minPrice: 21000, soldOut: false },
					{ format: '카세트', minPrice: 25000, soldOut: false }
				],
				isSoldOut: false,
				primaryItem: { id: 1071, title: 'POWER ANDRE 99', artistName: '실리카겔' }
			}
		},
		{
			tag: '8. 부분 품절 (LP 품절 / CD 판매중)',
			group: {
				key: 'sample-8',
				routeId: 108,
				albumId: 8,
				title: '나의 기쁨 나의 노래',
				artistName: '잔나비',
				frontCoverUrl: makeCoverDataUrl('#4338ca', '#1e1b4b', '#818cf8', 'PARTIAL'),
				mediaItems: [
					{
						id: 1081,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: makeMediaDataUrl('#312e81', '#0f172a', '#a5b4fc'),
						price: 55000,
						soldOut: true
					},
					{
						id: 1082,
						kind: 'cd',
						formatLabel: 'CD',
						imageUrl: makeMediaDataUrl('#6366f1', '#1e1b4b', '#e0e7ff'),
						price: 19500,
						soldOut: false
					}
				],
				formatPrices: [
					{ format: 'LP', minPrice: 55000, soldOut: true },
					{ format: 'CD', minPrice: 19500, soldOut: false }
				],
				isSoldOut: false,
				primaryItem: { id: 1081, title: '나의 기쁨 나의 노래', artistName: '잔나비' }
			}
		},
		{
			tag: '9. 전체 품절',
			group: {
				key: 'sample-9',
				routeId: 109,
				albumId: 9,
				title: '우리의 밤은 당신의 낮보다 아름답다 (한정판)',
				artistName: '코나',
				frontCoverUrl: makeCoverDataUrl('#3f3f46', '#18181b', '#a1a1aa', 'SOLD OUT'),
				mediaItems: [
					{
						id: 1091,
						kind: 'lp',
						formatLabel: 'LP',
						imageUrl: '',
						price: 62000,
						soldOut: true
					},
					{
						id: 1092,
						kind: 'cd',
						formatLabel: 'CD',
						imageUrl: '',
						price: 20000,
						soldOut: true
					}
				],
				formatPrices: [
					{ format: 'LP', minPrice: 62000, soldOut: true },
					{ format: 'CD', minPrice: 20000, soldOut: true }
				],
				isSoldOut: true,
				primaryItem: { id: 1091, title: '우리의 밤은 당신의 낮보다 아름답다', artistName: '코나' }
			}
		},
		{
			tag: '10. 이미지 없음 (CSS 가상 디스크 폴백)',
			group: {
				key: 'sample-10',
				routeId: 110,
				albumId: 10,
				title: '아주 긴 앨범 제목이 두 줄을 넘어가면 말줄임 처리가 자연스럽게 되는지 확인하는 테스트 앨범',
				artistName: '아주 긴 아티스트 이름 테스트 밴드 프로젝트',
				frontCoverUrl: makeCoverDataUrl('#c2410c', '#1c1917', '#fb923c', 'CSS FALLBACK'),
				mediaItems: [
					{ id: 1101, kind: 'lp', formatLabel: 'LP', imageUrl: '', price: 46000, soldOut: false },
					{ id: 1102, kind: 'cd', formatLabel: 'CD', imageUrl: '', price: 18000, soldOut: false },
					{
						id: 1103,
						kind: 'cassette',
						formatLabel: '카세트',
						imageUrl: '',
						price: 21000,
						soldOut: false
					}
				],
				formatPrices: [
					{ format: 'LP', minPrice: 46000, soldOut: false },
					{ format: 'CD', minPrice: 18000, soldOut: false },
					{ format: '카세트', minPrice: 21000, soldOut: false }
				],
				isSoldOut: false,
				primaryItem: { id: 1101, title: '테스트', artistName: '테스트' }
			}
		}
	];

	let lastClicked = $state<string>('');

	// ── 콘서트 대기열 프리뷰 상태 ──
	const MOCK_BOOKING_CONCERT: BookingConcertMeta = {
		id: 10,
		title: '아도이 (ADOY) 단독 콘서트 — HER',
		venueName: '예스24 라이브홀',
		posterUrl: '',
		startsAt: '2026-12-12T10:00:00Z',
		queueEnabled: true,
		maxSeatsPerUser: 4,
		saleStatus: 'ON_SALE',
		sessions: [
			{ id: 7, startsAt: '2026-12-12T10:00:00Z', saleStatus: 'ON_SALE', isClosed: false },
			{ id: 8, startsAt: '2026-12-13T09:00:00Z', saleStatus: 'ON_SALE', isClosed: false }
		]
	};

	let previewQueueState = $state<'WAITING' | 'SOLD_OUT' | 'EXPIRED'>('WAITING');
	let previewQueueRank = $state(128);
	const previewQueueTotal = 1200;
	const previewQueueStatus = $derived<QueueStatusDto>({
		state: previewQueueState,
		rank: previewQueueRank,
		total: previewQueueTotal,
		etaSeconds: Math.max(5, Math.round(previewQueueRank * 1.4)),
		pollAfterMs: 3000
	});
	const EMPTY_SEAT_SET = new Set<number>();
</script>

<svelte:head>
	<title>Album Item Showcase (/test)</title>
</svelte:head>

<div class="test-page">
	<header class="test-header">
		<h1>Album Item Showcase</h1>
		<p>PC · 모바일 앨범 아이템 모든 케이스(단독 · 다중 LP · LP/CD/카세트 조합 · 부분/전체 품절 · 폴백 · 스켈레톤)</p>
		{#if lastClicked}
			<p class="test-clicked">마지막 클릭: <strong>{lastClicked}</strong></p>
		{/if}
	</header>

	<!-- 0. 콘서트 예매 대기열 프리뷰 -->
	<section class="test-section">
		<div class="queue-preview-bar">
			<h2 class="section-title">Concert Booking Queue Preview (BookingPageView · phase="queue")</h2>
			<div class="queue-preview-controls">
				<button
					type="button"
					class="preview-pill"
					class:is-active={previewQueueState === 'WAITING'}
					onclick={() => (previewQueueState = 'WAITING')}
				>
					WAITING
				</button>
				<button
					type="button"
					class="preview-pill"
					class:is-active={previewQueueState === 'SOLD_OUT'}
					onclick={() => (previewQueueState = 'SOLD_OUT')}
				>
					SOLD_OUT
				</button>
				<button
					type="button"
					class="preview-pill"
					class:is-active={previewQueueState === 'EXPIRED'}
					onclick={() => (previewQueueState = 'EXPIRED')}
				>
					EXPIRED
				</button>

				{#if previewQueueState === 'WAITING'}
					<label class="rank-slider">
						<span>순번: {previewQueueRank}</span>
						<input type="range" min="1" max={previewQueueTotal} bind:value={previewQueueRank} />
					</label>
				{/if}
			</div>
		</div>

		<div class="queue-preview-frame">
			<BookingPageView
				mobile={false}
				phase="queue"
				errorMessage={null}
				concert={MOCK_BOOKING_CONCERT}
				selectedSession={MOCK_BOOKING_CONCERT.sessions[0]}
				selectedSessionId={7}
				queueStatus={previewQueueStatus}
				seatMap={null}
				isLoadingSeats={false}
				activeFloorId=""
				selectedSeats={[]}
				selectedSeatIds={EMPTY_SEAT_SET}
				maxSeats={4}
				totalPrice={0}
				isCreatingBooking={false}
				pendingBooking={null}
				remainingSec={null}
				isCancellingHold={false}
				isMountingWidget={false}
				isWidgetReady={false}
				widgetError={null}
				isRequestingPayment={false}
				onSelectFloor={() => {}}
				onChangeSession={() => {}}
				onToggleSeat={() => {}}
				onRemoveSeat={() => {}}
				onRefreshSeats={() => {}}
				onCreateBooking={() => {}}
				onRequestPayment={() => {}}
				onRetryWidget={() => {}}
				onReturnToSeats={() => {}}
				onGoBack={() => {
					lastClicked = '[Queue Preview] 공연 상세로 돌아가기';
				}}
			/>
		</div>
	</section>

	<!-- 1. PC 앨범 아이템 -->
	<section class="test-section">
		<h2 class="section-title">PC Album Items (Hover 테스트)</h2>
		<div class="pc-grid">
			{#each SAMPLE_GROUPS as item (item.group.key)}
				<div class="pc-case">
					<span class="case-tag">{item.tag}</span>
					<PcAlbumItem
						group={item.group}
						interactive={true}
						onSelect={({ group }) => {
							lastClicked = `[PC] ${group.title} (${group.artistName})`;
						}}
					/>
				</div>
			{/each}

			<div class="pc-case">
				<span class="case-tag">11. PC 스켈레톤</span>
				<PcAlbumSkeleton index={0} />
			</div>
		</div>
	</section>

	<!-- 2. 모바일 앨범 아이템 (390px 모바일 폭 프리뷰 · 스크롤 등장/퇴장 테스트) -->
	<section class="test-section">
		<h2 class="section-title">Mobile Album Items (390px 폭 · 스크롤 애니메이션 확인)</h2>
		<div class="mobile-preview-frame">
			{#each SAMPLE_GROUPS as item (item.group.key)}
				<div class="mb-case">
					<span class="case-tag">{item.tag}</span>
					<MbAlbumItem
						group={item.group}
						interactive={true}
						onSelect={({ group }) => {
							lastClicked = `[Mobile] ${group.title} (${group.artistName})`;
						}}
					/>
				</div>
			{/each}

			<div class="mb-case">
				<span class="case-tag">11. Mobile 스켈레톤</span>
				<MbAlbumSkeleton index={0} />
			</div>
		</div>
	</section>
</div>

<style>
	.test-page {
		min-height: 100dvh;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 2.5rem var(--content-padding-x) 6rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.test-header {
		margin-bottom: 2.5rem;
		padding-bottom: 1.25rem;
		border-bottom: var(--thin-border);
	}

	.test-header h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: var(--fw-extrabold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.test-header p {
		margin: 0.45rem 0 0;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.test-clicked {
		color: var(--fg) !important;
	}

	.test-section {
		margin-bottom: 4rem;
	}

	.section-title {
		margin: 0 0 1.5rem;
		font-size: 1.12rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.queue-preview-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.queue-preview-bar .section-title {
		margin: 0;
	}

	.queue-preview-controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.preview-pill {
		height: 30px;
		padding: 0 0.7rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.preview-pill.is-active {
		background: var(--white);
		border-color: var(--white);
		color: var(--bg);
		font-weight: var(--fw-semibold);
	}

	.rank-slider {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.78rem;
		color: var(--muted);
		margin-left: 0.35rem;
	}

	.queue-preview-frame {
		border: var(--thin-border);
		border-radius: 18px;
		background: var(--bg);
		overflow: hidden;
	}

	.pc-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		column-gap: 2rem;
		row-gap: 3.5rem;
		padding-top: 1.75rem;
	}

	.pc-case {
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
	}

	.case-tag {
		display: inline-block;
		font-size: 0.74rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		letter-spacing: -0.01em;
	}

	.mobile-preview-frame {
		width: 100%;
		max-width: 390px;
		padding: 1rem;
		border-radius: 18px;
		border: var(--thin-border);
		background: var(--bg);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.mb-case {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
</style>
