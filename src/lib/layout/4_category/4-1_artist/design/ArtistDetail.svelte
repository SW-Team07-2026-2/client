<script lang="ts">
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/common/catalog/artists';
	import ProductDetailLayout, {
		type DetailMetaItem
	} from '../../_shared/design/ProductDetailLayout.svelte';
	import {
		createWaveRectSetting,
		resolveDetailGlowColor
	} from '../../_shared/logic/detailTheme';
	import ArtistFollowButton from '../part/detail_part/ArtistFollowButton.svelte';

	interface Props {
		artist: CatalogArtist | null;
		isLoading: boolean;
		errorMessage: string | null;
		following: boolean;
		followLoading: boolean;
		accentColor: string;
		waveActive?: boolean;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onToggleFollow: () => void;
		onShareLink: () => void;
		onAccentColorExtracted?: (color: string) => void;
	}

	let {
		artist,
		isLoading,
		errorMessage,
		following,
		followLoading,
		accentColor,
		waveActive = true,
		mobile,
		backLabel = '목록으로',
		onClose,
		onToggleFollow,
		onShareLink,
		onAccentColorExtracted
	}: Props = $props();

	const HERO_RADIUS = 26;
	/** 정사각형 한 변당 유지할 물결 개수 (이미지 크기에 비례해 waveLength 자동 조절) */
	const HERO_WAVES_PER_EDGE = 2.5;

	let extractedWaveColor = $state('');
	let heroMediaWidth = $state(340);

	const imageSrc = $derived(artist ? resolveArtistImageUrl(artist) : '');
	const glowColor = $derived(resolveDetailGlowColor(extractedWaveColor, accentColor));
	const heroImageSetting = $derived(
		createWaveRectSetting(heroMediaWidth, 1, HERO_RADIUS, HERO_WAVES_PER_EDGE)
	);

	const metaItems = $derived.by<DetailMetaItem[]>(() => {
		if (!artist) return [];
		const list: DetailMetaItem[] = [];
		if (artist.genre) {
			list.push({ label: '장르', value: artist.genre });
		}
		if (artist.debutYear) {
			list.push({ label: '데뷔', value: `${artist.debutYear}년` });
		}
		if (artist.label) {
			list.push({ label: '레이블', value: artist.label });
		}
		if (artist.members && artist.members.length > 0) {
			list.push({
				label: '멤버',
				value: artist.members
					.map((m) => (m.role ? `${m.name} (${m.role})` : m.name))
					.join(', ')
			});
		}
		if (artist.bio) {
			list.push({ label: '소개', value: artist.bio, multiline: true });
		}
		return list;
	});

	$effect(() => {
		onAccentColorExtracted?.(glowColor);
	});
</script>

<!-- 아티스트 상세 뷰 (공용 ProductDetailLayout + 1:1 FdImage · 공용 메타 표 · 팔로우 · 하단 아티스트 소개, 순수 렌더링) -->
<ProductDetailLayout
	{mobile}
	{backLabel}
	shareLabel="아티스트 링크 공유"
	{glowColor}
	{isLoading}
	{errorMessage}
	title={artist?.name ?? ''}
	{metaItems}
	purchaseBeforeMeta={mobile}
	centerTitleOnNarrow={mobile}
	onBack={onClose}
	onShare={onShareLink}
>
	{#snippet visual()}
		<div class="artist-hero-media" bind:clientWidth={heroMediaWidth}>
			{#if imageSrc}
				<FdImage
					class="artist-hero-image"
					src={imageSrc}
					alt={artist?.name ?? ''}
					loading="eager"
					decoding="async"
					objectPosition="50% 40%"
					radius={HERO_RADIUS}
					setting={heroImageSetting}
					active={waveActive}
					disableWave={false}
					bind:extractedWaveColor
					fullWidth
				/>
			{:else}
				<div class="artist-hero-fallback" aria-hidden="true"></div>
			{/if}
		</div>
	{/snippet}

	{#snippet purchase()}
		<div
			class="artist-action-bar"
			class:is-above-meta={mobile}
			class:has-top-divider={!mobile && metaItems.length > 0}
		>
			<ArtistFollowButton {following} loading={followLoading} onToggle={onToggleFollow} />
		</div>
	{/snippet}
</ProductDetailLayout>

<style>
	.artist-hero-media {
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.artist-hero-media :global(.fd-image-wrap.artist-hero-image) {
		width: 100%;
		height: 100%;
	}

	.artist-hero-fallback {
		width: 100%;
		height: 100%;
		border-radius: 26px;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	.artist-action-bar {
		width: 100%;
		margin-top: 1.4rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.artist-action-bar.is-above-meta {
		margin-top: 1rem;
	}

	.artist-action-bar.has-top-divider {
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
	}

	@container product-detail (max-width: 740px) {
		.artist-action-bar.is-above-meta {
			justify-content: center;
		}
	}
</style>
