<script lang="ts">
	interface Props {
		title?: string;
		onClose?: () => void;
	}

	let { title = '알림', onClose }: Props = $props();
</script>

<!-- 모바일 알림 전용 상단 헤더 (우측은 단일 BellIcon 액터 도착 도크 슬롯, 순수 렌더링) -->
<header class="mb-notification-header">
	<button type="button" class="back-btn" onclick={onClose} aria-label="뒤로가기">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
	</button>

	<div class="title-wrap">
		<h2 class="title">{title}</h2>
	</div>

	<div class="bell-slot" data-shell-anchor="right-to" aria-hidden="true"></div>
</header>

<style>
	.mb-notification-header {
		flex-shrink: 0;
		height: 60px;
		padding: 0 var(--content-padding-x-mobile);
		display: grid;
		grid-template-columns: 34px 1fr 34px;
		align-items: center;
		gap: 0.5rem;
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		border-bottom: var(--thin-border);
		z-index: 20;
	}

	.back-btn {
		width: 34px;
		height: 34px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--white);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.back-btn:active {
		transform: scale(0.92);
	}

	.back-btn svg {
		width: 22px;
		height: 22px;
	}

	.title-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
	}

	.title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--white);
		letter-spacing: -0.01em;
	}

	.bell-slot {
		width: 34px;
		height: 34px;
		flex-shrink: 0;
	}
</style>
