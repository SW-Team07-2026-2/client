<script lang="ts">
	// 카테고리 기본 페이지: 아티스트 목록 및 탐색
</script>

<svelte:head>
	<title>INDIG - 아티스트</title>
</svelte:head>

<main class="artist-container">
	<h1>아티스트 (Artist)</h1>
	<p>인디 밴드 및 아티스트 목록, 추천 피드가 여기에 들어갑니다.</p>
</main>

<style>
	.artist-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: calc(100dvh - 60px);
		padding: 2rem;
		text-align: center;
		color: #ffffff;
	}
</style>

