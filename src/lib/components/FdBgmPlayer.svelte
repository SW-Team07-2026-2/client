<script lang="ts">
	import FdCheckButton from './FdCheckButton.svelte';
	import type { FdWave, FdWaveOptions } from '#lib/fluid';
	import { bgm } from '#lib/audio';

	interface Props {
		/** 재생할 오디오 파일 경로 (기본값: '/audio/bgm.mp3') */
		src?: string;
		/** 활성(재생) 여부. bind:checked 로 양방향 바인딩 가능 (전역 싱글톤과 자동 연동) */
		checked?: boolean;
		/** 볼륨 (0.0 ~ 1.0, 기본값: 0.5) */
		volume?: number;
		/** 반복 재생 여부 (기본값: true) */
		loop?: boolean;
		/** 버튼 원형 크기 (px 단위, 기본값: 42) */
		size?: number;
		/** 재생/정지 상태 변경 시 콜백 */
		onchange?: (playing: boolean) => void;

		/* ── FdCheckButton 스타일 커스터마이징 props ── */
		color?: string;
		hoverColor?: string;
		pressColor?: string;
		activeColor?: string;
		hoverWave?: Partial<FdWaveOptions> | FdWave;
		activeWave?: Partial<FdWaveOptions> | FdWave;
		bulge?: number;
		reach?: number;
		class?: string;
		ariaLabel?: string;
	}

	let {
		src = '/audio/bgm.mp3',
		checked = $bindable(bgm.isPlaying),
		volume = 0.5,
		loop = true,
		size = 42,
		onchange,
		color = '#fff',
		hoverColor = '#fff',
		pressColor = '#fff',
		activeColor = '#fff',
		bulge = 6,
		reach = 32,
		class: klass = '',
		ariaLabel = '배경음악 재생/정지'
	}: Props = $props();

	// 전역 싱글톤 상태를 컴포넌트 checked 상태와 양방향 동기화
	$effect(() => {
		checked = bgm.isPlaying;
	});

	$effect(() => {
		bgm.setVolume(volume);
		bgm.setLoop(loop);
	});

	function handleToggle(nextChecked: boolean) {
		if (nextChecked) {
			bgm.play(src);
		} else {
			bgm.pause();
		}
		onchange?.(bgm.isPlaying);
	}
</script>

<div class="bgm-player-wrap {klass}" style:--bgm-btn-size="{size}px">
	<FdCheckButton
		bind:checked
		onchange={handleToggle}
		radius={999}
		{reach}
		{bulge}
		{color}
		{hoverColor}
		{pressColor}
		{activeColor}
		aria-label={ariaLabel}
		class="bgm-check-btn"
	>
		<div
			class="icon-container"
			class:playing={checked}
			style:width="{size}px"
			style:height="{size}px"
		>
			<!-- 재생 아이콘 -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="currentColor"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-play icon-svg icon-play"
				aria-hidden="true"
			>
				<path
					d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
				/>
			</svg>

			<!-- 정지 아이콘 -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="currentColor"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-pause icon-svg icon-pause"
				aria-hidden="true"
			>
				<rect x="14" y="3" width="5" height="18" rx="1" />
				<rect x="5" y="3" width="5" height="18" rx="1" />
			</svg>
		</div>
	</FdCheckButton>
</div>

<style>
	.bgm-player-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	/* FdCheckButton 내부 버튼 사이즈를 정사각형으로 고정하여 완전한 원형 유지 */
	.bgm-player-wrap :global(button.bgm-check-btn) {
		box-sizing: content-box !important;
		width: var(--bgm-btn-size, 42px);
		height: var(--bgm-btn-size, 42px);
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-container {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		color: currentColor;
	}

	/* 내부에 들어갈 SVG 공통 스타일: 두 아이콘을 겹쳐서 탄성 있게 트랜지션 */
	.icon-container :global(svg) {
		position: absolute;
		width: 48%;
		height: 48%;
		display: block;
		fill: currentColor;
		transition:
			opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.36s cubic-bezier(0.34, 1.56, 0.64, 1);
		transform-origin: center;
		will-change: transform, opacity;
	}

	/* ── 1) 기본(정지) 상태 ── */
	/* 재생(▶) 아이콘: 시각적 무게중심 보정과 함께 선명하게 표시 */
	.icon-container :global(svg.icon-play),
	.icon-container :global(svg:first-child) {
		opacity: 1;
		transform: scale(1) rotate(0deg) translateX(1px);
	}

	/* 정지(||) 아이콘: 시계방향으로 비틀리며 축소 대기 */
	.icon-container :global(svg.icon-pause),
	.icon-container :global(svg:last-child) {
		opacity: 0;
		transform: scale(0.32) rotate(75deg);
		pointer-events: none;
	}

	/* ── 2) 활성화(재생 중) 상태 ── */
	/* 재생(▶) 아이콘: 반시계방향으로 비틀리며 축소 페이드아웃 */
	.icon-container.playing :global(svg.icon-play),
	.icon-container.playing :global(svg:first-child) {
		opacity: 0;
		transform: scale(0.32) rotate(-75deg) translateX(1px);
		pointer-events: none;
	}

	/* 정지(||) 아이콘: 쫀득한 스프링 곡선(cubic-bezier)으로 0도 회전하며 탄성 있게 등장 */
	.icon-container.playing :global(svg.icon-pause),
	.icon-container.playing :global(svg:last-child) {
		opacity: 1;
		transform: scale(1) rotate(0deg);
		pointer-events: auto;
	}
</style>
