<script lang="ts">
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import { MYPAGE_ROOT_CHILDREN, MyPageTreeController } from './logic/myPageTree.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	let { section, active }: Props = $props();

	const tree = new MyPageTreeController();
</script>

<!-- 4_category / mypage: 트리 구조(허브 <-> 하위 상세 옵션) 진입점 -->
<section
	class="mypage-category"
	data-category="mypage"
	data-node={tree.currentId}
	data-active={active ? 'true' : 'false'}
	aria-label={section.label}
>
	{#if tree.isRoot}
		<div class="mypage-hub-grid">
			{#each MYPAGE_ROOT_CHILDREN as node (node.id)}
				<button
					type="button"
					class="mypage-node-card"
					onclick={() => tree.pushNode(node.id)}
				>
					<div class="mypage-node-text">
						<span class="mypage-node-title">{node.label}</span>
						<span class="mypage-node-desc">{node.description}</span>
					</div>
					<svg
						class="mypage-node-arrow"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m9 18 6-6-6-6" />
					</svg>
				</button>
			{/each}
		</div>

		<footer class="mypage-footer">
			<button type="button" class="mypage-withdraw-btn" onclick={tree.openWithdrawModal}>
				회원탈퇴
			</button>
		</footer>
	{:else}
		<div class="mypage-detail-panel">
			<div class="mypage-detail-header">
				<button type="button" class="mypage-back-btn" onclick={tree.popNode}>
					← 뒤로
				</button>
				<nav class="mypage-breadcrumb" aria-label="마이페이지 경로">
					{#each tree.breadcrumbs as crumb, idx (crumb.id)}
						{#if idx > 0}
							<span class="crumb-sep" aria-hidden="true">/</span>
						{/if}
						<button
							type="button"
							class="crumb-btn"
							class:is-current={idx === tree.breadcrumbs.length - 1}
							onclick={() => tree.jumpToDepth(idx)}
						>
							{crumb.label}
						</button>
					{/each}
				</nav>
			</div>

			<div class="mypage-detail-body">
				<h2>{tree.currentNode.label}</h2>
				<p>{tree.currentNode.description}</p>
			</div>
		</div>
	{/if}
</section>

{#if tree.withdrawModalOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="mypage-modal-backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) tree.closeWithdrawModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') tree.closeWithdrawModal();
		}}
	>
		<div
			class="mypage-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="mypage-withdraw-title"
		>
			<h3 id="mypage-withdraw-title" class="mypage-modal-title">정말 탈퇴하시겠어요?</h3>
			<p class="mypage-modal-desc">
				탈퇴 시 계정 정보는 즉시 삭제되며 복구할 수 없습니다.<br />
				결제 대기 중인 주문 · 예매는 취소됩니다.
			</p>
			<div class="mypage-modal-actions">
				<button
					type="button"
					class="mypage-modal-btn is-cancel"
					disabled={tree.withdrawing}
					onclick={tree.closeWithdrawModal}
				>
					취소
				</button>
				<button
					type="button"
					class="mypage-modal-btn is-danger"
					disabled={tree.withdrawing}
					onclick={tree.confirmWithdraw}
				>
					{tree.withdrawing ? '탈퇴 처리 중...' : '탈퇴하기'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.mypage-category {
		width: 100%;
	}

	.mypage-hub-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.9rem;
	}

	.mypage-node-card {
		width: 100%;
		padding: 1.15rem 1.2rem;
		border-radius: 18px;
		background: var(--surface);
		border: var(--thin-border);
		color: var(--fg);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.18s ease,
			transform 0.16s ease;
	}

	.mypage-node-card:hover {
		background: var(--surface-2);
	}

	.mypage-node-card:active {
		transform: scale(0.99);
	}

	.mypage-node-text {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.mypage-node-title {
		font-size: 0.96rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.mypage-node-desc {
		font-size: 0.82rem;
		color: var(--muted);
	}

	.mypage-node-arrow {
		color: var(--muted);
		flex-shrink: 0;
	}

	.mypage-detail-panel {
		padding: 1.25rem;
		border-radius: 20px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.mypage-detail-header {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.mypage-back-btn {
		height: 32px;
		padding: 0 0.85rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: var(--surface-2);
		color: var(--fg);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
	}

	.mypage-breadcrumb {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.crumb-btn {
		border: none;
		background: transparent;
		padding: 0;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.crumb-btn.is-current {
		color: var(--white);
		font-weight: var(--fw-semibold);
	}

	.mypage-detail-body h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.mypage-detail-body p {
		margin: 0.4rem 0 0;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.mypage-footer {
		margin-top: 2.5rem;
		padding-top: 1.25rem;
		border-top: var(--thin-border);
		display: flex;
		justify-content: flex-end;
	}

	.mypage-withdraw-btn {
		padding: 0.5rem 0.9rem;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--toast-error-wave) 35%, transparent);
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			color 0.16s ease,
			border-color 0.16s ease,
			background-color 0.16s ease;
	}

	.mypage-withdraw-btn:hover {
		color: var(--toast-error-fg);
		border-color: color-mix(in srgb, var(--toast-error-wave) 65%, transparent);
		background: color-mix(in srgb, var(--toast-error-bg) 65%, transparent);
	}

	.mypage-withdraw-btn:active {
		transform: scale(0.98);
	}

	.mypage-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: color-mix(in srgb, var(--bg) 72%, transparent);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.mypage-modal {
		width: 100%;
		max-width: 360px;
		padding: 1.4rem;
		border-radius: 20px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mypage-modal-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.mypage-modal-desc {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.55;
		color: var(--muted);
	}

	.mypage-modal-actions {
		margin-top: 0.65rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.mypage-modal-btn {
		height: 38px;
		padding: 0 1rem;
		border-radius: 12px;
		font: inherit;
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			opacity 0.16s ease;
	}

	.mypage-modal-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.mypage-modal-btn.is-cancel {
		border: var(--thin-border);
		background: var(--surface-2);
		color: var(--fg);
	}

	.mypage-modal-btn.is-cancel:hover:not(:disabled) {
		background: var(--surface-3);
	}

	.mypage-modal-btn.is-danger {
		border: 1px solid color-mix(in srgb, var(--toast-error-wave) 65%, transparent);
		background: var(--toast-error-bg);
		color: var(--toast-error-fg);
	}

	.mypage-modal-btn.is-danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--toast-error-wave) 35%, var(--toast-error-bg));
	}
</style>
