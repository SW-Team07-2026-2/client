<script lang="ts">
	import titleLoadingSvg from '#lib/assets/title-loading.svg?raw';
	import type { SplashPhase } from '../logic/loadingSplash.svelte';
	import { BlockOrbitSpinner } from '#lib/common/design/icon/spinner';

	interface Props {
		phase: SplashPhase;
		logoTransform: string;
		logoEl?: HTMLDivElement | undefined;
	}

	let { phase, logoTransform, logoEl = $bindable(undefined) }: Props = $props();

	// 외부 CSS 번들 다운로드 전에도 즉시 렌더링되도록 핵심 오버레이 스타일을 SSR HTML에 인라인
	const CRITICAL_STYLE_TAG = `<style>
.indig-splash{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;pointer-events:all;user-select:none}
.indig-splash.is-docking,.indig-splash.is-fading{pointer-events:none}
.indig-splash .splash-backdrop{position:absolute;inset:0;background:var(--bg,#070709);opacity:1;transition:opacity .48s cubic-bezier(.22,1,.36,1)}
.indig-splash.is-docking .splash-backdrop,.indig-splash.is-fading .splash-backdrop{opacity:0}
.indig-splash .splash-logo{position:relative;z-index:1;width:min(74vw,24rem);aspect-ratio:886/239;transform-origin:center center;will-change:transform,opacity;transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .18s ease}
.indig-splash.is-fading .splash-logo{opacity:0}
.indig-splash .splash-spinner{position:absolute;z-index:1;top:calc(50% + clamp(3.75rem,10vh,5.5rem));left:50%;transform:translateX(-50%);color:var(--white-2,#fafafa);pointer-events:none;opacity:1;transition:opacity .22s ease}
.indig-splash .splash-spinner-inner{opacity:0;transform:translateY(6px);animation:indig-spinner-in .28s cubic-bezier(.22,1,.36,1) 3.48s forwards}
.indig-splash.is-docking .splash-spinner,.indig-splash.is-fading .splash-spinner{opacity:0}
@keyframes indig-spinner-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
</style>`;
</script>

<svelte:head>
	{@html CRITICAL_STYLE_TAG}
</svelte:head>

<!-- 첫 진입 스플래시 오버레이: SVG 로고 애니메이션 + 로딩 스피너 (순수 렌더링) -->
<div
	class="indig-splash"
	class:is-docking={phase === 'docking'}
	class:is-fading={phase === 'fading'}
	aria-hidden="true"
>
	<div class="splash-backdrop"></div>

	<div bind:this={logoEl} class="splash-logo" style:transform={logoTransform}>
		{@html titleLoadingSvg}
	</div>

	<!-- SSR에 포함해 JS 로드 전에도 SVG 완성 1초 후(3.48s) 순수 CSS로 자동 노출 -->
	<div class="splash-spinner" aria-hidden="true">
		<div class="splash-spinner-inner">
			<BlockOrbitSpinner size={24} />
		</div>
	</div>
</div>
