<script lang="ts">
	import { onMount } from 'svelte';
	import { LoadingSplashController } from './logic/loadingSplash.svelte';
	import LoadingSplashView from './design/LoadingSplashView.svelte';

	interface Props {
		/** 로딩 종료 시 로고가 이동해 안착할 대상 엘리먼트 (예: .title-wrap) */
		targetEl?: Element | null;
		/** targetEl 폭 대비 실제 글리프 폭 비율 (기본: FdTitle 내부 여백 비율 10/11.2, 꽉 찬 SVG: 1) */
		targetGlyphRatio?: number;
		/** 실제 페이지의 타이틀을 드러낼 시점 콜백 (도착 직후) */
		onreveal?: () => void;
		/** 오버레이가 완전히 사라진 뒤 언마운트용 콜백 */
		ondone?: () => void;
	}

	let { targetEl = null, targetGlyphRatio, onreveal, ondone }: Props = $props();

	const ctrl = new LoadingSplashController();
	let logoEl = $state<HTMLDivElement | undefined>(undefined);

	onMount(() => {
		return ctrl.attachLifecycle({
			getLogoEl: () => logoEl,
			getTargetEl: () => targetEl,
			getTargetGlyphRatio: () => targetGlyphRatio,
			onreveal,
			ondone
		});
	});
</script>

<LoadingSplashView phase={ctrl.phase} logoTransform={ctrl.logoTransform} bind:logoEl />
