<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import type { TermsItem, WelcomeAgreementsMap } from './welcome';

	interface Props {
		/** 약관 목록 */
		termsList?: TermsItem[];
		/** 항목별 동의 여부 맵 (뒤로가기 시 상태 보존을 위해 부모에서 바인딩) */
		agreements?: WelcomeAgreementsMap;
		/** 제출(가입 완료) 처리 중 여부 */
		isSubmitting?: boolean;
		/** 1단계(아티스트 선택)로 돌아가기 / 모달 닫기 */
		onBack?: () => void;
		/** 최종 동의 및 가입 완료 */
		onSubmit?: () => void;
		/** 하위 호환용 콜백 */
		onNext?: () => void;
		/** 가입 취소 */
		onCancel?: () => void;
	}

	let {
		termsList = [],
		agreements = $bindable<WelcomeAgreementsMap>({}),
		isSubmitting = false,
		onBack,
		onSubmit,
		onNext,
		onCancel
	}: Props = $props();

	let expandedTermId = $state<number | null>(null);

	// 전체 동의 여부
	let isAllAgreed = $derived(
		termsList.length > 0 && termsList.every((term) => agreements[term.termsId] === true)
	);

	// 필수 항목 모두 동의 완료 여부
	let isRequiredAllAgreed = $derived(
		termsList.length > 0 &&
			termsList.filter((term) => term.required).every((term) => agreements[term.termsId] === true)
	);

	function toggleAllAgreements() {
		const targetState = !isAllAgreed;
		const next: WelcomeAgreementsMap = {};
		for (const term of termsList) {
			next[term.termsId] = targetState;
		}
		agreements = next;
	}

	function toggleTerm(termsId: number) {
		agreements = {
			...agreements,
			[termsId]: !agreements[termsId]
		};
	}

	function toggleExpand(termsId: number) {
		expandedTermId = expandedTermId === termsId ? null : termsId;
	}

	function handleSubmit() {
		if (!isRequiredAllAgreed || isSubmitting) return;
		if (onSubmit) {
			onSubmit();
		} else {
			onNext?.();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget && !isSubmitting) {
			onBack?.();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="agree-modal-backdrop"
	onclick={handleBackdropClick}
	in:fade={{ duration: 240, easing: cubicOut }}
	out:fade={{ duration: 260, easing: cubicOut }}
>
	<div
		class="agree-modal-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="welcome-agree-title"
		in:scale={{ start: 0.96, duration: 320, easing: cubicOut }}
		out:scale={{ start: 0.95, duration: 240, easing: cubicOut }}
	>
		<!-- 모달 상단 헤더 -->
		<header class="modal-header">
			<div class="header-text">
				<h2 id="welcome-agree-title" class="modal-title">서비스 이용에 동의해 주세요.</h2>
				<p class="modal-subtitle">인디그 시작을 위해 약관 확인이 필요합니다.</p>
			</div>

			{#if onBack}
				<button
					type="button"
					class="close-btn"
					disabled={isSubmitting}
					onclick={onBack}
					aria-label="아티스트 선택으로 돌아가기"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</header>

		<!-- 전체 동의 버튼 -->
		<button
			type="button"
			class="agree-all-row"
			class:is-checked={isAllAgreed}
			role="checkbox"
			aria-checked={isAllAgreed}
			onclick={toggleAllAgreements}
		>
			<span class="check-dot" class:is-checked={isAllAgreed} aria-hidden="true">
				{#if isAllAgreed}
					<svg viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
						/>
					</svg>
				{/if}
			</span>
			<span class="agree-all-copy">
				<span class="agree-all-title">전체 동의하기</span>
				<span class="agree-all-hint">선택 항목 동의 포함</span>
			</span>
		</button>

		<!-- 개별 약관 목록 -->
		<ul class="terms-list">
			{#each termsList as term (term.termsId)}
				{@const checked = Boolean(agreements[term.termsId])}
				{@const expanded = expandedTermId === term.termsId}
				<li class="term-item">
					<div class="term-row">
						<button
							type="button"
							class="term-check-btn"
							role="checkbox"
							aria-checked={checked}
							onclick={() => toggleTerm(term.termsId)}
						>
							<span class="check-dot small" class:is-checked={checked} aria-hidden="true">
								{#if checked}
									<svg viewBox="0 0 16 16" fill="currentColor">
										<path
											d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
										/>
									</svg>
								{/if}
							</span>
							<span class="term-text">
								<span class="term-req" class:is-required={term.required}>
									{term.required ? '필수' : '선택'}
								</span>
								<span class="term-name">{term.title}</span>
							</span>
						</button>

						{#if term.content && term.content.trim().length > 0}
							<button
								type="button"
								class="view-btn"
								onclick={() => toggleExpand(term.termsId)}
								aria-expanded={expanded}
							>
								{expanded ? '접기' : '보기'}
							</button>
						{/if}
					</div>

					{#if expanded}
						<div class="term-content-box">
							<pre class="term-content">{term.content}</pre>
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		<!-- 모달 하단 액션 -->
		<footer class="modal-footer">
			<FdButton
				class="modal-sub-btn"
				color="#18181d"
				hoverColor="#24242c"
				pressColor="#121216"
				waveColor="#3a3a44"
				textColor="#d4d4d8"
				disabled={isSubmitting}
				onclick={() => (onBack ? onBack() : onCancel?.())}
			>
				이전
			</FdButton>

			<div class="submit-wrap">
				<FdButton
					class="modal-submit-btn"
					fullWidth
					color={isRequiredAllAgreed ? '#ffffff' : '#18181d'}
					hoverColor={isRequiredAllAgreed ? '#f4f4f6' : '#18181d'}
					pressColor={isRequiredAllAgreed ? '#d4d4d8' : '#18181d'}
					waveColor={isRequiredAllAgreed ? '#ffffff' : '#2e2e36'}
					textColor={isRequiredAllAgreed ? '#070709' : '#63636e'}
					disabled={!isRequiredAllAgreed || isSubmitting}
					onclick={handleSubmit}
				>
					{isSubmitting ? '가입 처리 중...' : '동의하고 시작하기'}
				</FdButton>
			</div>
		</footer>
	</div>
</div>

<style>
	/* 화면 앞 오버레이 백드롭 */
	.agree-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		box-sizing: border-box;
		background: rgba(0, 0, 0, 0.45);
	}

	/* BotArea(.morph-chat-panel)와 동일한 미세한 border + 고밀도 블러 패널 */
	.agree-modal-panel {
		width: 100%;
		max-width: 460px;
		max-height: min(640px, calc(100dvh - 2.5rem));
		display: flex;
		flex-direction: column;
		background: rgba(7, 7, 9, 0.3);
		backdrop-filter: blur(28px) saturate(180%);
		-webkit-backdrop-filter: blur(28px) saturate(180%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 28px;
		box-shadow:
			0 24px 64px -12px rgba(0, 0, 0, 0.65),
			0 0 32px rgba(233, 233, 233, 0.05);
		padding: 1.75rem 1.6rem 1.5rem;
		box-sizing: border-box;
		color: #f1f5f9;
		overflow: hidden;
	}

	/* 상단 헤더 */
	.modal-header {
		flex-shrink: 0;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.35rem;
	}

	.header-text {
		min-width: 0;
	}

	.modal-title {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: -0.025em;
		color: #ffffff;
	}

	.modal-subtitle {
		margin: 0.35rem 0 0;
		font-size: 0.85rem;
		color: #a1a1aa;
		line-height: 1.45;
	}

	.close-btn {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.close-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.18);
		color: #ffffff;
	}

	.close-btn svg {
		width: 16px;
		height: 16px;
	}

	/* 전체 동의 버튼 */
	.agree-all-row {
		flex-shrink: 0;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		margin-bottom: 0.75rem;
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.05);
		color: inherit;
		text-align: left;
		cursor: pointer;
		outline: none;
		transition:
			background-color 0.18s ease,
			border-color 0.18s ease;
	}

	.agree-all-row:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.18);
	}

	.agree-all-row.is-checked {
		background: rgba(255, 255, 255, 0.09);
		border-color: rgba(255, 255, 255, 0.32);
	}

	.agree-all-copy {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.agree-all-title {
		font-size: 0.94rem;
		font-weight: 600;
		color: #ffffff;
		letter-spacing: -0.015em;
	}

	.agree-all-hint {
		font-size: 0.76rem;
		color: #8c8c96;
	}

	/* 체크 인디케이터 */
	.check-dot {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		border-radius: 9999px;
		border: 1.5px solid rgba(255, 255, 255, 0.28);
		background: transparent;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #070709;
		transition:
			background-color 0.18s ease,
			border-color 0.18s ease,
			transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.check-dot.small {
		width: 18px;
		height: 18px;
	}

	.check-dot.is-checked {
		background-color: #ffffff;
		border-color: #ffffff;
		transform: scale(1.05);
	}

	.check-dot svg {
		width: 11px;
		height: 11px;
	}

	/* 개별 약관 리스트 */
	.terms-list {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		list-style: none;
		margin: 0;
		padding: 0 0.15rem 0 0;
		display: flex;
		flex-direction: column;
	}

	.term-item {
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.term-item:last-child {
		border-bottom: none;
	}

	.term-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.2rem 0.15rem;
	}

	.term-check-btn {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.25rem;
		background: transparent;
		border: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		outline: none;
	}

	.term-text {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.term-req {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-weight: 500;
		color: #71717a;
	}

	.term-req.is-required {
		color: #f0f0f0;
		font-weight: 600;
	}

	.term-name {
		color: #d4d4d8;
		word-break: keep-all;
		transition: color 0.15s ease;
	}

	.term-check-btn:hover .term-name {
		color: #ffffff;
	}

	.view-btn {
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		padding: 0.3rem 0.6rem;
		font-size: 0.74rem;
		font-weight: 500;
		color: #a1a1aa;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.view-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	.term-content-box {
		margin: 0.1rem 0.25rem 0.75rem 2.1rem;
		padding: 0.75rem 0.9rem;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.38);
		border: 1px solid rgba(255, 255, 255, 0.07);
		max-height: 132px;
		overflow-y: auto;
	}

	.term-content {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: inherit;
		font-size: 0.76rem;
		line-height: 1.6;
		color: #a1a1aa;
	}

	/* 하단 액션 버튼 */
	.modal-footer {
		flex-shrink: 0;
		margin-top: 1.35rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.modal-footer :global(button.modal-sub-btn) {
		height: 42px !important;
		padding: 0 1.25rem !important;
		font-size: 0.875rem !important;
		font-weight: 600 !important;
		white-space: nowrap;
	}

	.submit-wrap {
		flex: 1;
		min-width: 0;
	}

	.submit-wrap :global(button.modal-submit-btn) {
		height: 42px !important;
		font-size: 0.9rem !important;
		font-weight: 600 !important;
	}

	@media (max-width: 640px) {
		.agree-modal-backdrop {
			padding: 0;
			align-items: flex-end;
		}

		.agree-modal-panel {
			max-width: 100%;
			max-height: 85dvh;
			border-radius: 28px 28px 0 0;
			border-bottom: none;
			border-left: none;
			border-right: none;
			padding: 1.5rem 1.25rem max(1.25rem, env(safe-area-inset-bottom, 0px));
			box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.75);
		}
	}
</style>
