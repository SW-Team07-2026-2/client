<script lang="ts">
	import FdImage from '../../ui/FdImage.svelte';
	import { FluidSetting } from '#lib/fluid/setting';
	import type { ArtistItem } from './welcome';

	interface Props {
		/** 표시할 아티스트 데이터 */
		artist: ArtistItem;
		/** 선택 상태 여부 (true일 때 지속적으로 물결 애니메이션) */
		selected?: boolean;
		/** 원형 아티스트 이미지 지름 (px). 미지정 시 --orb-size CSS 변수(기본 112px) 따름 */
		size?: number;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 클릭 콜백 */
		onclick?: (artist: ArtistItem) => void;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		artist,
		selected = false,
		size,
		disabled = false,
		onclick,
		class: klass = ''
	}: Props = $props();

	// FluidSetting 기본값 사용 (선택 시에만 pauseWhenIdle: false로 상시 물결 유지)
	const IDLE_SETTING = new FluidSetting({
		pauseWhenIdle: true
	});

	const SELECTED_SETTING = new FluidSetting({
		pauseWhenIdle: false
	});

	const fluidSetting = $derived(selected ? SELECTED_SETTING : IDLE_SETTING);
	const resolvedSize = $derived(size !== undefined ? `${size}px` : 'var(--orb-size, 112px)');

	function handleClick() {
		if (disabled) return;
		onclick?.(artist);
	}
</script>

<button
	type="button"
	class="welcome-artist-btn {klass}"
	class:is-selected={selected}
	aria-pressed={selected}
	{disabled}
	onclick={handleClick}
	style:--artist-size={resolvedSize}
>
	<FdImage
		src={artist.image}
		alt={artist.name}
		fit="cover"
		active={selected}
		{disabled}
		setting={fluidSetting}
		bodyStyle="box-sizing: content-box; width: {resolvedSize}; height: {resolvedSize};"
	>
		<div class="artist-center-overlay" class:is-selected={selected}>
			<span class="artist-name">{artist.name}</span>
		</div>
	</FdImage>
</button>

<style>
	.welcome-artist-btn {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0;
		background: transparent;
		border: none;
		border-radius: 9999px;
		cursor: pointer;
		outline: none;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.welcome-artist-btn:hover:not(:disabled) {
		transform: translateY(-2px);
	}

	.welcome-artist-btn.is-selected {
		transform: scale(1.04);
	}

	.welcome-artist-btn:focus-visible {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.65);
	}

	.welcome-artist-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.artist-center-overlay {
		width: 100%;
		height: 100%;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.65rem;
		box-sizing: border-box;
		background: radial-gradient(
			circle at center,
			rgba(7, 7, 9, 0.64) 0%,
			rgba(7, 7, 9, 0.42) 65%,
			rgba(7, 7, 9, 0.28) 100%
		);
		transition: background 0.25s ease;
	}

	.welcome-artist-btn:hover:not(:disabled) .artist-center-overlay {
		background: radial-gradient(
			circle at center,
			rgba(7, 7, 9, 0.54) 0%,
			rgba(7, 7, 9, 0.32) 70%,
			rgba(7, 7, 9, 0.2) 100%
		);
	}

	.artist-center-overlay.is-selected {
		background: radial-gradient(
			circle at center,
			rgba(7, 7, 9, 0.48) 0%,
			rgba(7, 7, 9, 0.26) 70%,
			rgba(7, 7, 9, 0.14) 100%
		);
	}

	.artist-name {
		color: #ffffff;
		font-size: 0.92rem;
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: -0.02em;
		text-align: center;
		word-break: keep-all;
		overflow-wrap: break-word;
		text-shadow:
			0 2px 10px rgba(0, 0, 0, 0.9),
			0 1px 3px rgba(0, 0, 0, 0.85);
		transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.welcome-artist-btn.is-selected .artist-name {
		transform: scale(1.05);
	}

	@media (max-width: 768px) {
		.artist-name {
			font-size: 0.86rem;
		}
	}

	@media (max-width: 480px) {
		.artist-name {
			font-size: 0.8rem;
			padding: 0 4px;
		}
	}
</style>
