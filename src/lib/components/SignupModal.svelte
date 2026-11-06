<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { FdButton } from '#lib/components';
	import { fetchTermsList, type TermsItem } from '#lib/terms';
	import { auth, SIGNUP_AGREEMENTS_KEY, clearSignupFlow } from '#lib/auth';

	interface Props {
		onclose?: () => void;
	}

	let { onclose }: Props = $props();

	let termsList = $state<TermsItem[]>([]);
	let agreements = $state<Record<number, boolean>>({});
	let expandedTermId = $state<number | null>(null);
	let isLoading = $state(true);
	let isSubmitting = $state(false);

	async function loadTerms() {
		isLoading = true;
		termsList = await fetchTermsList();
		const initAgreed: Record<number, boolean> = {};
		for (const term of termsList) {
			initAgreed[term.termsId] = false;
		}
		agreements = initAgreed;
		isLoading = false;
	}

	onMount(() => {
		loadTerms();
	});

	// 전체 동의 여부 (선택 포함 모든 항목 체크 여부)
	let isAllAgreed = $derived(
		termsList.length > 0 && termsList.every((term) => agreements[term.termsId] === true)
	);

	// 필수 항목 모두 동의 완료 여부 (다음 버튼 활성화 조건)
	let isRequiredAllAgreed = $derived(
		termsList.length > 0 &&
			termsList
				.filter((term) => term.required)
				.every((term) => agreements[term.termsId] === true)
	);

	function toggleAllAgreements() {
		const targetState = !isAllAgreed;
		const next: Record<number, boolean> = {};
		for (const term of termsList) {
			next[term.termsId] = targetState;
		}
		agreements = next;
	}

	function toggleTerm(termsId: number) {
		agreements[termsId] = !agreements[termsId];
	}

	function toggleExpand(termsId: number) {
		expandedTermId = expandedTermId === termsId ? null : termsId;
	}

	async function handleProceed() {
		if (!isRequiredAllAgreed || isSubmitting) return;

		const agreementPayload = termsList.map((term) => ({
			termsId: term.termsId,
			agreed: Boolean(agreements[term.termsId])
		}));

		if (typeof window !== 'undefined') {
			sessionStorage.setItem(SIGNUP_AGREEMENTS_KEY, JSON.stringify(agreementPayload));
		}

		isSubmitting = true;
		try {
			// G13 POST /api/auth/signup 호출하여 회원 생성 및 AT · RT 쿠키 발급
			await auth.signup([], agreementPayload);
			await goto('/', { replaceState: true });
		} catch (err: any) {
			console.warn('G13 signup failed:', err);
			if (err?.code === 'TERMS_OUTDATED' || err?.code === 'REQUIRED_AGREEMENT_MISSING') {
				alert(err?.message || '약관이 변경되었어요. 다시 확인하고 동의해 주세요.');
				await loadTerms();
			} else if (err?.code === 'SIGNUP_EXPIRED' || err?.code === 'SIGNUP_INVALID') {
				alert(err?.message || '가입 시간이 지났어요. 다시 로그인해 주세요.');
				clearSignupFlow();
				await goto('/', { replaceState: true });
			} else {
				alert(err?.message || '가입 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
			}
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		clearSignupFlow();
		if (onclose) {
			onclose();
		} else {
			goto('/');
		}
	}
</script>

<div class="modal-backdrop">
	<div class="modal-card">
		<!-- 모달 헤더 -->
		<header class="modal-header">
			<div class="brand-badge">INDIG SIGN UP</div>
			<h2 class="modal-title">서비스 이용 동의</h2>
			<p class="modal-subtitle">
				당신을 위한 숨은 인디밴드를 만나기 위해 약관에 동의해 주세요.
			</p>
		</header>

		{#if isLoading}
			<div class="loading-box">
				<div class="spinner"></div>
				<span>약관을 불러오는 중...</span>
			</div>
		{:else}
			<!-- 전체 동의 박스 -->
			<div class="agree-all-box">
				<label class="checkbox-label" for="agree-all-checkbox">
					<input
						type="checkbox"
						id="agree-all-checkbox"
						checked={isAllAgreed}
						onchange={toggleAllAgreements}
					/>
					<span class="custom-check" aria-hidden="true">
						{#if isAllAgreed}
							<svg viewBox="0 0 16 16" fill="currentColor">
								<path
									d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
								/>
							</svg>
						{/if}
					</span>
					<span class="agree-all-text">
						<strong>약관 전체 동의</strong>
						<span class="agree-all-desc">선택 항목에 대한 동의가 포함됩니다.</span>
					</span>
				</label>
			</div>

			<!-- 개별 약관 목록 -->
			<ul class="terms-list">
				{#each termsList as term (term.termsId)}
					<li class="term-item">
						<div class="term-row">
							<label class="checkbox-label" for="term-{term.termsId}">
								<input
									type="checkbox"
									id="term-{term.termsId}"
									checked={agreements[term.termsId]}
									onchange={() => toggleTerm(term.termsId)}
								/>
								<span class="custom-check" aria-hidden="true">
									{#if agreements[term.termsId]}
										<svg viewBox="0 0 16 16" fill="currentColor">
											<path
												d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"
											/>
										</svg>
									{/if}
								</span>
								<span class="term-title">
									<span class="req-badge" class:is-required={term.required}>
										{term.required ? '[필수]' : '[선택]'}
									</span>
									{term.title}
								</span>
							</label>

							{#if term.content && term.content.trim().length > 0}
								<button
									type="button"
									class="view-btn"
									onclick={() => toggleExpand(term.termsId)}
									aria-expanded={expandedTermId === term.termsId}
								>
									{expandedTermId === term.termsId ? '접기' : '보기'}
									<svg
										class="arrow-icon"
										class:is-expanded={expandedTermId === term.termsId}
										viewBox="0 0 20 20"
										fill="currentColor"
										aria-hidden="true"
									>
										<path
											fill-rule="evenodd"
											d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							{/if}
						</div>

						<!-- 약관 본문 인라인 펼침 영역 -->
						{#if expandedTermId === term.termsId}
							<div class="term-content-box">
								<pre class="term-content">{term.content}</pre>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<!-- 하단 액션 버튼 -->
			<footer class="modal-footer">
				<div class="btn-grid">
					<button type="button" class="cancel-btn" onclick={handleCancel}>
						취소
					</button>
					<div class="submit-wrap">
						<FdButton
							color="#ffffff"
							hoverColor="#f4f4f5"
							pressColor="#e4e4e7"
							textColor="#070709"
							disabled={!isRequiredAllAgreed || isSubmitting}
							onclick={handleProceed}
						>
							<div class="submit-btn-content">
								<span>{isSubmitting ? '가입 처리 중...' : '동의하고 시작하기'}</span>
								<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
									<path
										fill-rule="evenodd"
										d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
						</FdButton>
					</div>
				</div>
			</footer>
		{/if}
	</div>
</div>

<style>
	/* 모달 백드롭 (첫 페이지 위에 오버레이) */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		width: 100vw;
		height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		box-sizing: border-box;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		background: rgba(0, 0, 0, 0.55);
		animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes modalFadeIn {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* 모달 카드 */
	.modal-card {
		width: 100%;
		max-width: 500px;
		max-height: calc(100dvh - 3rem);
		display: flex;
		flex-direction: column;
		background: rgba(14, 14, 18, 0.9);
		backdrop-filter: blur(28px);
		-webkit-backdrop-filter: blur(28px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 24px;
		box-shadow:
			0 24px 60px rgba(0, 0, 0, 0.75),
			0 0 1px 1px rgba(255, 255, 255, 0.08) inset;
		overflow: hidden;
		box-sizing: border-box;
	}

	/* 모달 헤더 */
	.modal-header {
		padding: 1.75rem 1.75rem 1.25rem;
		text-align: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.brand-badge {
		display: inline-block;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: #a1a1aa;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		margin-bottom: 0.65rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.modal-title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #ffffff;
	}

	.modal-subtitle {
		margin: 0.45rem 0 0;
		font-size: 0.875rem;
		color: #8c8c96;
		letter-spacing: -0.01em;
		word-break: keep-all;
	}

	/* 로딩 상태 */
	.loading-box {
		padding: 3rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: #8c8c96;
		font-size: 0.875rem;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 2px solid rgba(255, 255, 255, 0.12);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* 전체 동의 박스 */
	.agree-all-box {
		margin: 1.25rem 1.5rem 0.75rem;
		padding: 1rem 1.15rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 14px;
		transition: all 0.2s ease;
	}

	.agree-all-box:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.22);
	}

	.agree-all-text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.95rem;
		color: #ffffff;
	}

	.agree-all-desc {
		font-size: 0.75rem;
		color: #8c8c96;
		font-weight: 400;
	}

	/* 체크박스 공통 스타일 */
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		flex: 1;
		min-width: 0;
	}

	.checkbox-label input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	.custom-check {
		width: 20px;
		height: 20px;
		border-radius: 6px;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.04);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 0.15s ease;
		color: #070709;
	}

	.checkbox-label input[type='checkbox']:checked + .custom-check {
		background: #ffffff;
		border-color: #ffffff;
	}

	.custom-check svg {
		width: 14px;
		height: 14px;
	}

	/* 개별 약관 리스트 */
	.terms-list {
		list-style: none;
		margin: 0;
		padding: 0.25rem 1.5rem 1rem;
		overflow-y: auto;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
	}

	.term-item {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		padding-bottom: 0.65rem;
	}

	.term-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.term-title {
		font-size: 0.875rem;
		color: #e4e4e7;
		font-weight: 500;
		letter-spacing: -0.015em;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.req-badge {
		font-size: 0.78rem;
		font-weight: 600;
		color: #a1a1aa;
	}

	.req-badge.is-required {
		color: #f87171;
	}

	/* 내용 보기 버튼 */
	.view-btn {
		background: transparent;
		border: none;
		padding: 0.35rem 0.5rem;
		font-size: 0.78rem;
		color: #8c8c96;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		border-radius: 6px;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.view-btn:hover {
		color: #ffffff;
		background: rgba(255, 255, 255, 0.08);
	}

	.arrow-icon {
		width: 14px;
		height: 14px;
		transition: transform 0.2s ease;
	}

	.arrow-icon.is-expanded {
		transform: rotate(180deg);
	}

	/* 약관 펼침 영역 */
	.term-content-box {
		margin-top: 0.65rem;
		padding: 0.85rem 1rem;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		max-height: 150px;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.term-content {
		margin: 0;
		font-family: inherit;
		font-size: 0.78rem;
		line-height: 1.55;
		color: #a1a1aa;
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* 모달 푸터 버튼 */
	.modal-footer {
		padding: 1.25rem 1.75rem 1.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(10, 10, 14, 0.6);
	}

	.btn-grid {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: 0.75rem;
		align-items: center;
	}

	.cancel-btn {
		height: 44px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		color: #a1a1aa;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.18s ease;
	}

	.cancel-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.22);
	}

	.submit-wrap {
		width: 100%;
	}

	.submit-wrap :global(.lq) {
		width: 100%;
	}

	.submit-wrap :global(.lq button) {
		width: 100%;
		height: 44px !important;
		border-radius: 12px !important;
		font-size: 0.92rem !important;
		font-weight: 600 !important;
	}

	.submit-btn-content {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
	}

	.submit-btn-content svg {
		width: 16px;
		height: 16px;
	}

	@media (max-width: 640px) {
		.modal-card {
			max-height: calc(100dvh - 2rem);
			border-radius: 20px;
		}

		.modal-header {
			padding: 1.25rem 1.25rem 1rem;
		}

		.agree-all-box {
			margin: 1rem 1.25rem 0.5rem;
		}

		.terms-list {
			padding: 0.25rem 1.25rem 0.75rem;
		}

		.modal-footer {
			padding: 1rem 1.25rem 1.25rem;
		}
	}
</style>

