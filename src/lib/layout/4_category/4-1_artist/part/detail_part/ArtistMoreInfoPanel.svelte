<script lang="ts">
	import type { CatalogArtist } from '#lib/common/catalog/artists';

	interface Props {
		artist: CatalogArtist;
		open?: boolean;
		/** true면 넓은 PC 히어로 내부에 접힘 없이 인라인으로 바로 표시 */
		inline?: boolean;
	}

	let { artist, open = false, inline = false }: Props = $props();

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

<!-- 아티스트 상세 정보: 박스 배경 없이 텍스트와 얇은 구분선으로 정리 (순수 렌더링) -->
{#if inline}
	<div class="more-inline-wrap">
		{#if metaItems.length > 0}
			<dl class="more-meta-list">
				{#each metaItems as item (item.label)}
					<div class="more-meta-row">
						<dt class="more-meta-label">{item.label}</dt>
						<dd class="more-meta-value">{item.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}

		{#if artist.bio}
			<p class="more-bio" class:has-top-divider={metaItems.length > 0}>{artist.bio}</p>
		{:else if metaItems.length === 0}
			<p class="more-empty">등록된 상세 정보가 아직 없습니다.</p>
		{/if}
	</div>
{:else}
	<div class="more-panel-collapse" class:is-open={open} aria-hidden={!open}>
		<div class="more-panel-inner">
			<div class="more-panel-body">
				{#if metaItems.length > 0}
					<dl class="more-meta-list is-horizontal">
						{#each metaItems as item (item.label)}
							<div class="more-meta-row">
								<dt class="more-meta-label">{item.label}</dt>
								<dd class="more-meta-value">{item.value}</dd>
							</div>
						{/each}
					</dl>
				{/if}

				{#if artist.bio}
					<p class="more-bio" class:has-top-divider={metaItems.length > 0}>{artist.bio}</p>
				{:else if metaItems.length === 0}
					<p class="more-empty">등록된 상세 정보가 아직 없습니다.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.more-inline-wrap {
		width: 100%;
		padding-top: 1rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-sizing: border-box;
	}

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

	.more-panel-body {
		margin-top: 1.6rem;
		padding: 1.15rem 0;
		border-top: var(--thin-border);
		border-bottom: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.more-meta-list {
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.more-meta-row {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr);
		align-items: baseline;
		gap: 0.75rem;
		padding: 0.45rem 0;
		border-bottom: var(--thin-border);
	}

	.more-meta-row:first-child {
		padding-top: 0;
	}

	.more-meta-row:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.more-meta-list.is-horizontal {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.55rem 2rem;
	}

	.more-meta-list.is-horizontal .more-meta-row {
		padding: 0.35rem 0;
		border-bottom: var(--thin-border);
	}

	.more-meta-label {
		font-size: 0.78rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		letter-spacing: -0.01em;
	}

	.more-meta-value {
		margin: 0;
		font-size: 0.9rem;
		font-weight: var(--fw-medium);
		color: var(--fg);
		line-height: 1.45;
		word-break: keep-all;
	}

	.more-bio {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.65;
		color: var(--fg);
		white-space: pre-line;
	}

	.more-bio.has-top-divider {
		padding-top: 0.85rem;
		border-top: var(--thin-border);
	}

	.more-empty {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.more-panel-collapse {
			transition: none;
		}
	}
</style>
