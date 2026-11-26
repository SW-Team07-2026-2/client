<script lang="ts">
	import { DistortionWave } from '#lib/common/design/distortion';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import type { PaymentConfirmStatus, PaymentView } from '../logic/types';

	interface Props {
		mobile: boolean;
		status: PaymentConfirmStatus;
		payment: PaymentView | null;
		orderName: string;
		amount: number | null;
		orderRef: string;
		errorCode: string | null;
		errorMessage: string | null;
		onRetryConfirm: () => void;
		onGoToOrders: () => void;
		onGoToCart: () => void;
		onGoToCheckout: () => void;
		onGoHome: () => void;
	}

	let {
		mobile,
		status,
		payment,
		orderName,
		amount,
		orderRef,
		errorCode,
		errorMessage,
		onRetryConfirm,
		onGoToOrders,
		onGoToCart,
		onGoToCheckout,
		onGoHome
	}: Props = $props();

	const PRIMARY_BTN_SETTING = createPrimaryCtaSetting(360);

	const formattedCompletedAt = $derived.by(() => {
		const raw = payment?.completedAt || payment?.requestedAt;
		if (!raw) return '';
		return raw.replace('T', ' ').slice(0, 16);
	});
</script>

<!-- 결제 후 결과 뷰 (승인 중 -> 완료 WebGL2 DistortionWave 전환 · 확인 지연 · 실패/취소, 순수 렌더링) -->
<div class="result-page" class:is-mobile={mobile}>
	<div class="result-card" class:is-wave-shell={status === 'confirming' || status === 'succeeded'}>
		{#if status === 'confirming' || status === 'succeeded'}
			<DistortionWave
				revealed={status === 'succeeded'}
				type="center"
				palette="colorful"
				origin={{ x: 0.5, y: 0.18 }}
				duration={920}
			>
				{#snippet children()}
					<div class="wave-face is-confirming">
						<div class="result-icon is-loading" role="status" aria-live="polite">
							<LoadingSpinner size={30} />
						</div>
						<h1 class="result-title">결제를 승인하고 있습니다</h1>
						<p class="result-desc">잠시만 기다려 주세요. 창을 닫지 마세요.</p>
					</div>
				{/snippet}

				{#snippet revealedContent()}
					<div class="wave-face is-succeeded">
						<div class="result-icon is-success" aria-hidden="true">
							<svg
								width="30"
								height="30"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.4"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M20 6 9 17l-5-5" />
							</svg>
						</div>
						<h1 class="result-title">결제가 완료되었습니다</h1>
						{#if orderName}
							<p class="result-desc">{orderName}</p>
						{/if}

						<dl class="receipt-list">
							{#if orderRef}
								<div class="receipt-row">
									<dt>주문 번호</dt>
									<dd class="is-mono">{orderRef}</dd>
								</div>
							{/if}
							{#if payment?.method}
								<div class="receipt-row">
									<dt>결제 수단</dt>
									<dd>{payment.method}</dd>
								</div>
							{/if}
							{#if formattedCompletedAt}
								<div class="receipt-row">
									<dt>결제 일시</dt>
									<dd>{formattedCompletedAt}</dd>
								</div>
							{/if}
							{#if amount !== null}
								<div class="receipt-row is-total">
									<dt>결제 금액</dt>
									<dd><SlidingPrice value={amount} /></dd>
								</div>
							{/if}
						</dl>

						<div class="result-actions">
							<div class="primary-btn-wrap">
								<FdButton
									setting={PRIMARY_BTN_SETTING}
									fullWidth
									class="result-primary-fd-btn"
									onclick={onGoToOrders}
								>
									주문 내역 확인
								</FdButton>
							</div>
							<button type="button" class="secondary-btn" onclick={onGoHome}>홈으로 돌아가기</button>
						</div>
					</div>
				{/snippet}
			</DistortionWave>
		{:else if status === 'pending'}
			<div class="result-icon is-pending" aria-hidden="true">
				<LoadingSpinner size={26} />
			</div>
			<h1 class="result-title">결제 결과를 확인 중입니다</h1>
			<p class="result-desc">{errorMessage || '결제사 응답이 지연되고 있습니다.'}</p>

			<div class="result-actions">
				<div class="primary-btn-wrap">
					<FdButton
						setting={PRIMARY_BTN_SETTING}
						fullWidth
						class="result-primary-fd-btn"
						onclick={onRetryConfirm}
					>
						승인 상태 다시 확인
					</FdButton>
				</div>
				<button type="button" class="secondary-btn" onclick={onGoToOrders}>주문 내역 보기</button>
			</div>
		{:else}
			<div class="result-icon is-failed" aria-hidden="true">
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</div>
			<h1 class="result-title">결제를 완료하지 못했습니다</h1>
			<p class="result-desc">{errorMessage || '결제 처리 중 문제가 발생했습니다.'}</p>
			{#if errorCode}
				<p class="result-code">오류 코드: {errorCode}</p>
			{/if}

			<div class="result-actions">
				<div class="primary-btn-wrap">
					<FdButton
						setting={PRIMARY_BTN_SETTING}
						fullWidth
						class="result-primary-fd-btn"
						onclick={onGoToCheckout}
					>
						다시 결제하기
					</FdButton>
				</div>
				<button type="button" class="secondary-btn" onclick={onGoToCart}>장바구니로 이동</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.result-page {
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		padding: 3rem var(--content-padding-x) 4rem;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		color: var(--fg);
	}

	.result-page.is-mobile {
		min-height: 100dvh;
		padding: calc(var(--mb-detail-top-offset, 60px) + 2rem) var(--content-padding-x-mobile) 3rem;
	}

	.result-card {
		width: 100%;
		max-width: 460px;
		padding: 2.25rem 1.75rem;
		border-radius: 24px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		box-sizing: border-box;
		overflow: hidden;
	}

	.result-card.is-wave-shell {
		padding: 0;
	}

	.wave-face {
		width: 100%;
		padding: 2.25rem 1.75rem;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		box-sizing: border-box;
	}

	.wave-face.is-confirming {
		min-height: 100%;
	}

	.result-icon {
		width: 60px;
		height: 60px;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.25rem;
	}

	.result-icon.is-success {
		background: var(--white-2);
		color: var(--bg);
	}

	.result-title {
		margin: 0;
		font-size: 1.3rem;
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.025em;
		color: var(--white);
	}

	.result-desc {
		margin: 0.55rem 0 0;
		font-size: 0.92rem;
		color: var(--muted);
		line-height: 1.5;
		word-break: keep-all;
	}

	.result-code {
		margin: 0.4rem 0 0;
		font-size: 0.78rem;
		color: var(--muted);
		opacity: 0.8;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.receipt-list {
		width: 100%;
		margin: 1.75rem 0 0;
		padding: 1.15rem 0 0;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		text-align: left;
	}

	.receipt-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.88rem;
	}

	.receipt-row dt {
		color: var(--muted);
		flex-shrink: 0;
	}

	.receipt-row dd {
		margin: 0;
		color: var(--fg);
		font-weight: var(--fw-medium);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.receipt-row dd.is-mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.82rem;
	}

	.receipt-row.is-total {
		margin-top: 0.35rem;
		padding-top: 0.85rem;
		border-top: var(--thin-border);
	}

	.receipt-row.is-total dt {
		color: var(--white-2);
		font-weight: var(--fw-semibold);
	}

	.result-actions {
		width: 100%;
		margin-top: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.primary-btn-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.primary-btn-wrap :global(.fd-btn.result-primary-fd-btn) {
		width: 100%;
		height: 48px;
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
	}

	.secondary-btn {
		width: 100%;
		height: 46px;
		border: none;
		border-radius: 14px;
		background: var(--surface-2);
		color: var(--white-2);
		font: inherit;
		font-size: 0.9rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background-color 0.16s ease;
	}

	.secondary-btn:hover {
		background: var(--surface-3, var(--surface-2));
	}
</style>
