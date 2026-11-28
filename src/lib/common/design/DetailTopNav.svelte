<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowLeftIcon, ChevronLeftIcon } from './icon';

	interface Props {
		/** 모바일 여부 (목록 복귀 시 PC: ArrowLeft, 모바일: ChevronLeft) */
		mobile?: boolean;
		/** 접근성 라벨 (예: '이전' 또는 '목록으로') */
		backLabel?: string;
		/** 다른 상세 페이지로 돌아가는 경우 여부 (미전달 시 backLabel !== '목록으로'로 판별) */
		returnToPage?: boolean;
		/** 좌측 이전/닫기 버튼 클릭 핸들러 */
		onBack: () => void;
		/** 우측 공유 버튼 클릭 핸들러 (미전달 시 공유 버튼 숨김) */
		onShare?: () => void;
		/** 공유 버튼 접근성 라벨 */
		shareLabel?: string;
		/** 우측 추가 액션 슬롯 (선택) */
		actions?: Snippet;
	}

	let {
		mobile = false,
		backLabel = '목록으로',
		returnToPage,
		onBack,
		onShare,
		shareLabel = '링크 공유',
		actions
	}: Props = $props();

	let backHovered = $state(false);
	let shareHovered = $state(false);
	/** PC에서만 다른 상세 페이지 복귀(Redo2)를 사용하며, 모바일은 항상 목록 복귀(ChevronLeft) 유지 */
	let isReturnToPage = $derived(!mobile && (returnToPage ?? backLabel !== '목록으로'));
</script>

<!-- 4_category 상세 페이지 공용 상단 네비게이션 (아이콘 전용 이전 · 공유 버튼 + SVG 호버 애니메이션) -->
<nav class="detail-top-nav" aria-label="상세 페이지 탐색">
	<button
		type="button"
		class="nav-icon-btn is-back"
		class:is-hovered={backHovered}
		onclick={onBack}
		onpointerenter={() => (backHovered = true)}
		onpointerleave={() => (backHovered = false)}
		onfocus={() => (backHovered = true)}
		onblur={() => (backHovered = false)}
		aria-label={backLabel}
		title={backLabel}
	>
		{#if isReturnToPage}
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<g class="redo-group">
					<path d="M13 20H9.5A5.5 5.5 0 0 1 4 14.5A5.5 5.5 0 0 1 9.5 9H20" />
					<path d="m15 14 5-5-5-5" />
				</g>
			</svg>
		{:else if mobile}
			<ChevronLeftIcon size={24} hovered={backHovered} />
		{:else}
			<ArrowLeftIcon size={22} hovered={backHovered} />
		{/if}
	</button>

	{#if onShare || actions}
		<div class="nav-right-actions">
			{#if actions}
				{@render actions()}
			{/if}

			{#if onShare}
				<button
					type="button"
					class="nav-icon-btn is-share"
					class:is-hovered={shareHovered}
					onclick={onShare}
					onpointerenter={() => (shareHovered = true)}
					onpointerleave={() => (shareHovered = false)}
					onfocus={() => (shareHovered = true)}
					onblur={() => (shareHovered = false)}
					aria-label={shareLabel}
					title={shareLabel}
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
						<path class="share-shaft" d="M12 15V2" pathLength="1" />
						<path class="share-head" d="m16 6-4-4-4 4" />
					</svg>
				</button>
			{/if}
		</div>
	{/if}
</nav>

<style>
	.detail-top-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.nav-right-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.nav-icon-btn {
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 0.18s ease;
	}

	.nav-icon-btn.is-back {
		margin-left: -8px;
	}

	.nav-icon-btn.is-share {
		margin-right: -8px;
	}

	.nav-icon-btn:hover,
	.nav-icon-btn:focus-visible {
		color: var(--white);
	}

	.nav-icon-btn:focus-visible {
		outline: 2px solid var(--white-2);
		outline-offset: 2px;
		border-radius: 8px;
	}

	/* 다른 페이지 복귀 Redo2 호버 애니메이션: rotate [0 -> 10deg -> 0] (0.6s ease-in-out) */
	.redo-group {
		transform-box: fill-box;
		transform-origin: center;
	}

	.nav-icon-btn.is-back.is-hovered .redo-group {
		animation: detail-redo-rotate 0.6s ease-in-out;
	}

	@keyframes detail-redo-rotate {
		0% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(10deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}

	/* Share 호버 애니메이션: shaft pathLength [0 -> 1] (0.4s) + head scale [0.3 -> 1] (0.3s, delay 0.3s) */
	.share-shaft {
		stroke-dasharray: 1;
		stroke-dashoffset: 0;
		opacity: 1;
	}

	.share-head {
		transform-box: fill-box;
		transform-origin: 50% 0%;
		opacity: 1;
		transform: scale(1);
	}

	.nav-icon-btn.is-share.is-hovered .share-shaft {
		animation: detail-share-shaft 0.4s ease-in-out both;
	}

	.nav-icon-btn.is-share.is-hovered .share-head {
		animation: detail-share-head 0.3s ease-out 0.3s both;
	}

	@keyframes detail-share-shaft {
		from {
			stroke-dashoffset: 1;
			opacity: 0;
		}
		to {
			stroke-dashoffset: 0;
			opacity: 1;
		}
	}

	@keyframes detail-share-head {
		from {
			opacity: 0;
			transform: scale(0.3);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.nav-icon-btn.is-back.is-hovered .redo-group,
		.nav-icon-btn.is-share.is-hovered .share-shaft,
		.nav-icon-btn.is-share.is-hovered .share-head {
			animation: none;
		}
	}
</style>
