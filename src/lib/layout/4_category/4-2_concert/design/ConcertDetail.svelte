<script lang="ts">
	import { Accordion, AccordionItem } from '#lib/common/design/accordion';
	import { ChevronRightIcon } from '#lib/common/design/icon';
	import MarkdownViewer from '#lib/common/design/MarkdownViewer.svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import SpringDropdown, {
		type SpringDropdownOption
	} from '#lib/common/design/SpringDropdown.svelte';
	import ProductDetailLayout, {
		type DetailMetaItem
	} from '../../_shared/design/ProductDetailLayout.svelte';
	import {
		createWaveRectSetting,
		resolveDetailGlowColor
	} from '../../_shared/logic/detailTheme';
	import type {
		ConcertLineupArtist,
		ConcertSessionOption,
		ConcertVenueDetail
	} from '../logic/concertDetail.svelte';
	import ConcertDetailSkeleton from './ConcertDetailSkeleton.svelte';

	interface Props {
		isLoading: boolean;
		errorMessage: string | null;
		title: string;
		typeLabel: string;
		genreLabel: string;
		saleStatusLabel: string;
		isOnSale: boolean;
		isClosed: boolean;
		startsAtText: string;
		endsAtText: string;
		bookingOpenAtText: string;
		price: number | null;
		queueEnabled: boolean;
		maxSeatsPerUser: number | null;
		sessions?: readonly ConcertSessionOption[];
		selectedSessionId?: number | null;
		ctaLabel: string;
		artists: readonly ConcertLineupArtist[];
		venue: ConcertVenueDetail | null;
		description: string;
		requirements: string;
		terms: string;
		posterUrl: string;
		imageUrls: readonly string[];
		accentColor: string;
		waveActive?: boolean;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onGoToArtist: (artistId: number) => void;
		onSelectSession?: (sessionId: number) => void;
		onStartBooking: () => void;
		onShareLink: () => void;
	}

	let {
		isLoading,
		errorMessage,
		title,
		typeLabel,
		genreLabel,
		saleStatusLabel,
		isOnSale,
		isClosed,
		startsAtText,
		endsAtText,
		bookingOpenAtText,
		price,
		queueEnabled,
		maxSeatsPerUser,
		sessions = [],
		selectedSessionId = null,
		ctaLabel,
		artists,
		venue,
		description,
		requirements,
		terms,
		posterUrl,
		imageUrls,
		accentColor,
		waveActive = true,
		mobile,
		backLabel = '목록으로',
		onClose,
		onGoToArtist,
		onSelectSession,
		onStartBooking,
		onShareLink
	}: Props = $props();

	const HERO_RADIUS = 24;
	const HERO_WAVES_PER_EDGE = 2.5;

	let extractedWaveColor = $state('');
	let heroMediaWidth = $state(320);
	let ctaBtnWidth = $state(240);

	const glowColor = $derived(resolveDetailGlowColor(extractedWaveColor, accentColor));
	const heroImageSetting = $derived(
		createWaveRectSetting(heroMediaWidth, 4 / 3, HERO_RADIUS, HERO_WAVES_PER_EDGE)
	);
	const ctaSetting = $derived(createPrimaryCtaSetting(ctaBtnWidth, !isOnSale));
	const sessionOptions = $derived<SpringDropdownOption[]>(
		sessions.map((sess, idx) => ({
			value: sess.id,
			label: `${idx + 1}회차 · ${sess.startsAtText}`,
			subLabel: sess.isClosed ? '마감' : '예매 가능',
			soldOut: sess.isClosed,
			disabled: sess.isClosed
		}))
	);

	const metaItems = $derived.by<DetailMetaItem[]>(() => {
		const list: DetailMetaItem[] = [];
		if (saleStatusLabel) {
			list.push({
				label: '예매 상태',
				value: saleStatusLabel,
				tone: isOnSale ? 'accent' : isClosed ? 'muted' : 'default'
			});
		}
		if (typeLabel) {
			list.push({ label: '공연 유형', value: typeLabel });
		}
		if (genreLabel) {
			list.push({ label: '장르', value: genreLabel });
		}
		if (startsAtText) {
			list.push({
				label: '공연 일시',
				value: endsAtText ? `${startsAtText} ~ ${endsAtText}` : startsAtText
			});
		}
		if (venue?.name) {
			list.push({
				label: '공연장',
				value: venue.name,
				sub: venue.region ? `(${venue.region})` : undefined,
				note: venue.address || undefined
			});
		}
		list.push({
			label: '예매 오픈',
			value: bookingOpenAtText || '미정',
			tone: bookingOpenAtText && bookingOpenAtText !== '미정' ? 'default' : 'muted'
		});
		if (maxSeatsPerUser !== null) {
			list.push({
				label: '예매 제한',
				value: `1인 최대 ${maxSeatsPerUser}매`,
				sub: queueEnabled ? '· 대기열 운영' : undefined
			});
		}
		return list;
	});
</script>

<!-- 공연 상세 뷰 (공용 ProductDetailLayout + 3:4 FdImage 포스터 · 라인업 · 공용 메타 표 · 예매 CTA, 순수 렌더링) -->
<ProductDetailLayout
	{mobile}
	{backLabel}
	shareLabel="공연 링크 공유"
	{glowColor}
	{isLoading}
	{errorMessage}
	{title}
	{metaItems}
	visualWidth="clamp(260px, 32cqi, 370px)"
	onBack={onClose}
	onShare={onShareLink}
>
	{#snippet skeleton()}
		<ConcertDetailSkeleton />
	{/snippet}

	{#snippet visual()}
		<div
			class="concert-hero-poster"
			class:is-closed={isClosed}
			bind:clientWidth={heroMediaWidth}
		>
			{#if posterUrl}
				<FdImage
					class="concert-poster-fd"
					src={posterUrl}
					alt={title}
					loading="eager"
					decoding="async"
					objectPosition="50% 50%"
					radius={HERO_RADIUS}
					setting={heroImageSetting}
					active={waveActive}
					disableWave={false}
					bind:extractedWaveColor
					fullWidth
				/>
			{:else}
				<div class="poster-fallback" aria-hidden="true"></div>
			{/if}
		</div>
	{/snippet}

	{#snippet artistSlot()}
		{#if artists.length > 0}
			<div class="lineup-row" aria-label="출연 아티스트">
				{#each artists as artist (artist.id)}
					<button
						type="button"
						class="artist-chip-btn"
						onclick={() => onGoToArtist(artist.id)}
					>
						<span>{artist.name}</span>
						<ChevronRightIcon size={13} />
					</button>
				{/each}
			</div>
		{/if}
	{/snippet}

	{#snippet purchase()}
		<div class="booking-bar">
			{#if sessions.length > 1}
				<div class="booking-session-wrap">
					<SpringDropdown
						options={sessionOptions}
						value={selectedSessionId}
						label="공연 회차 선택"
						placeholder="회차 선택"
						onSelect={(val) => onSelectSession?.(Number(val))}
					/>
				</div>
			{/if}

			<div class="booking-cta-wrap" bind:clientWidth={ctaBtnWidth}>
				<FdButton
					setting={ctaSetting}
					fullWidth
					disabled={!isOnSale || (sessions.length > 1 && selectedSessionId === null)}
					class="concert-booking-fd-btn"
					onclick={onStartBooking}
				>
					{ctaLabel}
				</FdButton>
			</div>

			{#if price !== null}
				<div class="booking-price">
					<SlidingPrice value={price} soldOut={isClosed} soldOutText="판매 종료" />
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet below()}
		{#if description}
			<section class="detail-section" aria-label="공연 소개">
				<h2 class="section-title">공연 소개</h2>
				<MarkdownViewer content={description} class="concert-md" />
			</section>
		{/if}

		{#if imageUrls.length > 0}
			<section class="detail-section" aria-label="공연 상세 이미지">
				<h2 class="section-title">상세 이미지</h2>
				<div class="gallery-grid">
					{#each imageUrls as url, idx (url + idx)}
						<img
							class="gallery-img"
							src={url}
							alt={`${title} 상세 이미지 ${idx + 1}`}
							loading="lazy"
							decoding="async"
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if requirements || terms}
			<section class="detail-section" aria-label="관람 안내 및 유의사항">
				<h2 class="section-title">관람 안내 · 유의사항</h2>
				<Accordion multiple={true}>
					{#if requirements}
						<AccordionItem value="requirements" title="입장 · 준비 사항">
							<MarkdownViewer content={requirements} class="concert-md" />
						</AccordionItem>
					{/if}
					{#if terms}
						<AccordionItem value="terms" title="예매 · 취소 약관">
							<MarkdownViewer content={terms} class="concert-md" />
						</AccordionItem>
					{/if}
				</Accordion>
			</section>
		{/if}
	{/snippet}
</ProductDetailLayout>

<style>
	.concert-hero-poster {
		width: 100%;
		aspect-ratio: 3 / 4;
	}

	.concert-hero-poster :global(.fd-image-wrap.concert-poster-fd) {
		width: 100%;
		height: 100%;
	}

	.concert-hero-poster.is-closed :global(.fd-image-wrap.concert-poster-fd) {
		opacity: 0.62;
	}

	.poster-fallback {
		width: 100%;
		height: 100%;
		border-radius: 24px;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	.lineup-row {
		margin-top: 0.85rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.artist-chip-btn {
		height: 32px;
		padding: 0 0.7rem 0 0.8rem;
		border: none;
		border-radius: 999px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
	}

	.artist-chip-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.booking-bar {
		width: 100%;
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.booking-session-wrap {
		flex: 1.25 1 220px;
		min-width: 190px;
	}

	.booking-cta-wrap {
		flex: 1 1 180px;
		min-width: 160px;
	}

	.booking-cta-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.booking-cta-wrap :global(.fd-btn.concert-booking-fd-btn) {
		width: 100%;
		height: 48px;
		padding: 0 1.25rem;
		font-size: 0.95rem;
		font-weight: var(--fw-bold);
	}

	.booking-price {
		margin-left: auto;
		flex-shrink: 0;
	}

	.detail-section {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.12rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.detail-section :global(.concert-md) {
		color: var(--fg);
		font-size: 0.94rem;
		line-height: 1.72;
		word-break: keep-all;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.9rem;
	}

	.gallery-img {
		width: 100%;
		border-radius: 16px;
		object-fit: cover;
		display: block;
		background: var(--surface);
	}
</style>
