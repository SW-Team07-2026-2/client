<script lang="ts">
	import type { CatalogArtist } from '#lib/config/artists';

	interface Props {
		artist: CatalogArtist;
		open: boolean;
	}

	let { artist, open }: Props = $props();

	const metaItems = $derived.by(() => {
		const list: { label: string; value: string }[] = [];
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
		return list;
	});
</script>

<!-- 아티스트 상세 보기 확장 패널: 상단 히어로와 하단 영역 사이에서 세로로 부드럽게 열리고 닫힘 (순수 렌더링) -->
<div class="more-panel-collapse" class:is-open={open} aria-hidden={!open}>
	<div class="more-panel-inner">
		<div class="more-panel-card">
			{#if metaItems.length > 0}
				<dl class="more-meta-grid">
					{#each metaItems as item (item.label)}
						<div class="more-meta-row">
							<dt class="more-meta-label">{item.label}</dt>
							<dd class="more-meta-value">{item.value}</dd>
						</div>
					{/each}
				</dl>
			{/if}

			{#if artist.bio}
				<p class="more-bio">{artist.bio}</p>
			{:else if metaItems.length === 0}
				<p class="more-empty">등록된 상세 정보가 아직 없습니다.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.more-panel-collapse {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transform: translate3d(0, -6px, 0);
		transition:
			grid-template-rows 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.26s ease,
			transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.more-panel-collapse.is-open {
		grid-template-rows: 1fr;
		opacity: 1;
		transform: translate3d(0, 0, 0);
	}

	.more-panel-inner {
		min-height: 0;
		overflow: hidden;
	}

	.more-panel-card {
		margin-top: 1.5rem;
		padding: 1.35rem 1.5rem;
		border-radius: 18px;
		background: color-mix(in srgb, var(--surface) 76%, transparent);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.more-meta-grid {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.9rem 1.5rem;
	}

	.more-meta-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.more-meta-label {
		font-size: 0.78rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
	}

	.more-meta-value {
		margin: 0;
		font-size: 0.92rem;
		font-weight: var(--fw-medium);
		color: var(--fg);
		line-height: 1.45;
		word-break: keep-all;
	}

	.more-bio {
		margin: 0;
		padding-top: 0.85rem;
		border-top: var(--thin-border);
		font-size: 0.9rem;
		line-height: 1.65;
		color: var(--fg);
		white-space: pre-line;
	}

	.more-empty {
		margin: 0;
		font-size: 0.88rem;
		color: var(--muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.more-panel-collapse {
			transition: none;
		}
	}
</style>
