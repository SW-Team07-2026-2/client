<script lang="ts">
	import FdTitle from '../../ui/FdTitle.svelte';
	import FdBgmPlayer from '../../ui/FdBgmPlayer.svelte';
</script>

<!-- 모바일 상단 고정 블러 헤더 (좌측 BGM 플레이어 + 중앙 로고 + 우측 여백 슬롯) -->
<header class="mobile-top-header">
	<!-- 좌측: BGM 플레이어 -->
	<div class="header-left">
		<div class="bgm-slot">
			<FdBgmPlayer size={34} />
		</div>
	</div>

	<!-- 중앙: 로고 -->
	<div class="header-center">
		<div class="logo-wrap">
			<FdTitle
				height={28}
				href="/"
				lpPattern={false}
				disconnectOnHover={false}
				disconnectOnClick={false}
				ariaLabel="INDIG 홈"
			/>
		</div>
	</div>

	<!-- 우측: 추후 버튼 슬롯 (현재는 비워둠) -->
	<div class="header-right"></div>
</header>

<style>
	.mobile-top-header {
		position: sticky;
		top: 0;
		z-index: 50;
		height: 60px;
		width: 100%;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 1rem;
		box-sizing: border-box;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
	}

	.header-left {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		min-width: 0;
	}

	.bgm-slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.header-center {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.logo-wrap {
		view-transition-name: indig-logo;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 28px;
		aspect-ratio: 38 / 10;
		flex-shrink: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
	}
</style>
