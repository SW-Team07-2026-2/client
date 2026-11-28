<script lang="ts">
	import type { TermsCode, TermsItem } from '#lib/auth/auth.svelte';
	import { Accordion, AccordionItem } from '#lib/common/design/accordion';
	import FdSwitch from '#lib/common/design/fluid/FdSwitch.svelte';
	import LetterLimitInput from '#lib/common/design/LetterLimitInput.svelte';
	import MarkdownViewer from '#lib/common/design/MarkdownViewer.svelte';
	import {
		formatAccountDate,
		type MemberAgreementItem
	} from '../../logic/accountPart.svelte';

	interface Props {
		email: string;
		providerLabel: string;
		followCount: number | null;
		collectionCount: number | null;
		isLoadingProfile: boolean;
		profileError: string | null;
		nicknameDraft: string;
		isNicknameDirty: boolean;
		nicknameError: string | null;
		isSavingNickname: boolean;
		marketingAgreement: MemberAgreementItem | null;
		policyAgreements: readonly MemberAgreementItem[];
		isLoadingAgreements: boolean;
		agreementsError: string | null;
		isUpdatingMarketing: boolean;
		termDocs: Partial<Record<TermsCode, TermsItem>>;
		loadingTermCodes: Partial<Record<TermsCode, boolean>>;
		onResetNickname: () => void;
		onNicknameDraftChange: (value: string) => void;
		onSaveNickname: () => void;
		onToggleMarketing: () => void;
		onLoadTerm: (code: TermsCode) => void;
		onRetryLoad: () => void;
		onOpenWithdraw: () => void;
	}

	let {
		email,
		providerLabel,
		followCount,
		collectionCount,
		isLoadingProfile,
		profileError,
		nicknameDraft,
		isNicknameDirty,
		nicknameError,
		isSavingNickname,
		marketingAgreement,
		policyAgreements,
		isLoadingAgreements,
		agreementsError,
		isUpdatingMarketing,
		termDocs,
		loadingTermCodes,
		onResetNickname,
		onNicknameDraftChange,
		onSaveNickname,
		onToggleMarketing,
		onLoadTerm,
		onRetryLoad,
		onOpenWithdraw
	}: Props = $props();

	const marketingDateLabel = $derived.by(() => {
		if (!marketingAgreement) return '수신 상태를 확인할 수 없습니다.';
		const date = formatAccountDate(marketingAgreement.at);
		if (marketingAgreement.agreed) {
			return date ? `${date} 수신 동의` : '수신 동의 중';
		}
		return date ? `${date} 수신 거부` : '수신 거부 중';
	});
</script>

<!-- 마이페이지 > 계정 관리 파트 (Animate UI Docs 스타일 · 공용 Accordion 약관 · 순수 렌더링) -->
<div class="account-docs" data-part="account">
	<!-- 1. 내 정보 섹션 (단일 슬림 LetterLimitInput 닉네임 + 계정 메타) -->
	<section class="docs-section" aria-label="내 정보">
		<div class="section-heading">
			<h3 class="section-title">내 정보</h3>
		</div>

		{#if profileError && !isLoadingProfile}
			<div class="docs-notice">
				<span>{profileError}</span>
				<button type="button" class="soft-btn" onclick={onRetryLoad}>다시 시도</button>
			</div>
		{/if}

		<div class="nickname-field-block">
			<LetterLimitInput
				mode="slim"
				value={nicknameDraft}
				maxLength={10}
				nearThreshold={2}
				canSubmit={isNicknameDirty && !isSavingNickname}
				disabled={isSavingNickname}
				hasError={Boolean(nicknameError)}
				placeholder="닉네임 (공백 없이 2~10자)"
				ariaLabel="닉네임"
				submitLabel={isSavingNickname ? '변경 중...' : '변경'}
				onChangeValue={onNicknameDraftChange}
				onSubmit={() => onSaveNickname()}
				onEscape={onResetNickname}
			/>

			{#if nicknameError}
				<p class="field-error" role="alert">{nicknameError}</p>
			{/if}
		</div>

		<div class="account-meta-strip">
			<div class="account-meta-left">
				<span class="soft-chip">{providerLabel}</span>
				{#if email}
					<span class="account-email">{email}</span>
				{:else if isLoadingProfile}
					<span class="account-email is-dim">불러오는 중...</span>
				{/if}
				<button type="button" class="withdraw-text-link" onclick={onOpenWithdraw}>회원탈퇴</button>
			</div>

			<div class="metric-row" aria-label="활동 요약">
				<span class="metric-text">
					팔로우 <strong>{followCount !== null ? followCount.toLocaleString('ko-KR') : '—'}</strong>
				</span>
				<span class="metric-dot" aria-hidden="true">·</span>
				<span class="metric-text">
					보유 음반
					<strong>{collectionCount !== null ? collectionCount.toLocaleString('ko-KR') : '—'}</strong>
				</span>
			</div>
		</div>
	</section>

	<!-- 2. 약관 · 동의 섹션 (공용 Accordion 기반 인라인 열람) -->
	<section class="docs-section" aria-label="약관 및 동의">
		<div class="section-heading">
			<h3 class="section-title">약관 · 동의</h3>
			<p class="section-desc">마케팅 정보 수신 설정과 동의한 약관 내역을 확인합니다.</p>
		</div>

		{#if isLoadingAgreements && !marketingAgreement && policyAgreements.length === 0}
			<div class="surface-block">
				<p class="empty-note">약관 동의 내역을 불러오는 중입니다...</p>
			</div>
		{:else if agreementsError && !marketingAgreement && policyAgreements.length === 0}
			<div class="docs-notice">
				<span>{agreementsError}</span>
				<button type="button" class="soft-btn" onclick={onRetryLoad}>다시 시도</button>
			</div>
		{:else}
			<!-- 마케팅 수신 동의 토글 -->
			<div class="surface-block setting-row is-marketing">
				<div class="setting-copy">
					<div class="label-inline">
						<span class="setting-label">마케팅 정보 수신 동의</span>
						<span class="soft-chip is-muted">선택</span>
					</div>
					<span class="setting-hint">이벤트·혜택 및 프로모션 소식을 받습니다. · {marketingDateLabel}</span>
				</div>

				<FdSwitch
					checked={Boolean(marketingAgreement?.agreed)}
					disabled={isUpdatingMarketing || !marketingAgreement}
					borderless={true}
					ariaLabel="마케팅 정보 수신 동의"
					onchange={() => onToggleMarketing()}
				/>
			</div>

			<!-- 약관 · 정책 공용 아코디언 -->
			<div class="terms-accordion-wrap">
				<Accordion multiple={false}>
					{#each policyAgreements as item (item.termsId)}
						{@const doc = termDocs[item.code]}
						{@const isLoadingDoc = Boolean(loadingTermCodes[item.code])}
						<AccordionItem
							value={item.code}
							title={item.title}
							onToggle={(expanded) => {
								if (expanded) onLoadTerm(item.code);
							}}
						>
							{#snippet header()}
								<span class="acc-head-inner">
									<span class="acc-title-row">
										<span class="acc-title-text">{item.title}</span>
										{#if item.version}
											<span class="soft-chip is-muted">{item.version}</span>
										{/if}
									</span>
									<span class="acc-sub">
										{item.agreed
											? formatAccountDate(item.at)
												? `${formatAccountDate(item.at)} 동의`
												: '동의 완료'
											: '미동의'}
									</span>
								</span>
							{/snippet}

							<div class="term-panel-body">
								{#if isLoadingDoc && !doc}
									<p class="term-loading">약관 본문을 불러오는 중입니다...</p>
								{:else if doc}
									<MarkdownViewer content={doc.content} />
								{:else}
									<p class="term-loading">약관 내용을 표시할 수 없습니다.</p>
								{/if}
							</div>
						</AccordionItem>
					{/each}

					{#if marketingAgreement}
						{@const mDoc = termDocs.MARKETING}
						{@const isLoadingM = Boolean(loadingTermCodes.MARKETING)}
						<AccordionItem
							value="MARKETING"
							title={marketingAgreement.title || '마케팅 정보 수신 동의'}
							onToggle={(expanded) => {
								if (expanded) onLoadTerm('MARKETING');
							}}
						>
							{#snippet header()}
								<span class="acc-head-inner">
									<span class="acc-title-row">
										<span class="acc-title-text">{marketingAgreement.title || '마케팅 정보 수신 동의'}</span>
										{#if marketingAgreement.version}
											<span class="soft-chip is-muted">{marketingAgreement.version}</span>
										{/if}
									</span>
									<span class="acc-sub">{marketingDateLabel}</span>
								</span>
							{/snippet}

							<div class="term-panel-body">
								{#if isLoadingM && !mDoc}
									<p class="term-loading">약관 본문을 불러오는 중입니다...</p>
								{:else if mDoc}
									<MarkdownViewer content={mDoc.content} />
								{:else}
									<p class="term-loading">약관 내용을 표시할 수 없습니다.</p>
								{/if}
							</div>
						</AccordionItem>
					{/if}

					{@const ppDoc = termDocs.PRIVACY_POLICY}
					{@const isLoadingPP = Boolean(loadingTermCodes.PRIVACY_POLICY)}
					<AccordionItem
						value="PRIVACY_POLICY"
						title="개인정보처리방침"
						onToggle={(expanded) => {
							if (expanded) onLoadTerm('PRIVACY_POLICY');
						}}
					>
						{#snippet header()}
							<span class="acc-head-inner">
								<span class="acc-title-row">
									<span class="acc-title-text acc-title-strong">개인정보처리방침</span>
									{#if ppDoc?.version}
										<span class="soft-chip is-muted">{ppDoc.version}</span>
									{/if}
								</span>
								<span class="acc-sub">개인정보 처리 항목 · 보유 기간 · 권리 안내</span>
							</span>
						{/snippet}

						<div class="term-panel-body">
							{#if isLoadingPP && !ppDoc}
								<p class="term-loading">개인정보처리방침을 불러오는 중입니다...</p>
							{:else if ppDoc}
								<MarkdownViewer content={ppDoc.content} />
							{:else}
								<p class="term-loading">문서 내용을 표시할 수 없습니다.</p>
							{/if}
						</div>
					</AccordionItem>
				</Accordion>
			</div>
		{/if}
	</section>
</div>

<style>
	.account-docs {
		container-type: inline-size;
		container-name: account-part;
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
		width: 100%;
	}

	/* ── 섹션 단위 ── */
	.docs-section {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.section-heading {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.section-title {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.section-desc {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
	}

	/* ── borderless 표면 블록 ── */
	.surface-block {
		padding: 1.15rem 1.25rem;
		border-radius: 16px;
		background: var(--surface-dim);
	}

	.docs-notice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.85rem 1.1rem;
		border-radius: 14px;
		background: var(--surface-dim);
		color: var(--muted);
		font-size: 0.84rem;
	}

	.empty-note {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
	}

	/* ── 단일 닉네임 슬림 인풋 + 하단 메타 스트립 ── */
	.nickname-field-block {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-error {
		margin: 0;
		padding-left: 0.35rem;
		font-size: 0.78rem;
		color: var(--danger);
	}

	.account-meta-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.15rem 0.25rem 0;
	}

	.account-meta-left {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}

	.account-email {
		font-size: 0.82rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account-email.is-dim {
		opacity: 0.55;
	}

	.soft-chip {
		padding: 0.16rem 0.52rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-2);
		font-size: 0.72rem;
		font-weight: var(--fw-medium);
		line-height: 1.3;
		flex-shrink: 0;
	}

	.soft-chip.is-muted {
		color: var(--muted);
	}

	.metric-row {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.metric-text strong {
		color: var(--white-2);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.metric-dot {
		opacity: 0.45;
	}

	/* ── 설정 행 ── */
	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.setting-copy {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		min-width: 0;
	}

	.label-inline {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.setting-label {
		font-size: 0.92rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.setting-hint {
		font-size: 0.8rem;
		color: var(--muted);
		line-height: 1.48;
		word-break: keep-all;
	}

	/* ── 버튼 ── */
	.soft-btn {
		height: 34px;
		padding: 0 0.9rem;
		border: none;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--white-2);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.soft-btn:hover:not(:disabled) {
		background: var(--surface-3);
		color: var(--white);
	}

	/* ── 공용 Accordion 약관 영역 (배경 없음 · 항목 간 기본 가로 구분선 유지) ── */
	.terms-accordion-wrap {
		padding: 0;
		background: transparent;
	}

	/* 호버 밑줄이 버전 캡슐(.soft-chip)과 부설명(.acc-sub)까지 번지지 않고 제목 텍스트에만 적용되도록 제한 */
	.terms-accordion-wrap :global(.accordion-trigger:hover:not(:disabled) .accordion-title) {
		text-decoration: none;
	}

	.terms-accordion-wrap :global(.accordion-trigger:hover:not(:disabled) .acc-title-text) {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.acc-head-inner {
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		min-width: 0;
	}

	.acc-title-row {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.acc-title-strong {
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.acc-sub {
		font-size: 0.76rem;
		font-weight: var(--fw-regular);
		color: var(--muted);
		text-decoration: none;
	}

	.term-panel-body {
		max-height: 360px;
		overflow-y: auto;
		padding: 0.25rem 0.65rem 0.4rem 0;
		background: transparent;
		overscroll-behavior: contain;
		color-scheme: dark;
		scrollbar-width: thin;
		scrollbar-color: var(--surface-3) transparent;
	}

	.term-panel-body::-webkit-scrollbar {
		width: 6px;
	}

	.term-panel-body::-webkit-scrollbar-track {
		background: transparent;
	}

	.term-panel-body::-webkit-scrollbar-thumb {
		background: var(--surface-3);
		border-radius: 999px;
	}

	.term-panel-body::-webkit-scrollbar-thumb:hover {
		background: color-mix(in srgb, var(--white) 26%, transparent);
	}

	.term-loading {
		margin: 0;
		font-size: 0.84rem;
		color: var(--muted);
	}

	/* ── 회원탈퇴 저강도 밑줄 텍스트 ── */
	.withdraw-text-link {
		margin-left: 0.15rem;
		padding: 0.15rem 0.1rem;
		border: none;
		background: transparent;
		color: var(--muted);
		opacity: 0.55;
		font: inherit;
		font-size: 0.75rem;
		font-weight: var(--fw-regular);
		text-decoration: underline;
		text-underline-offset: 3px;
		flex-shrink: 0;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.withdraw-text-link:hover,
	.withdraw-text-link:focus-visible {
		opacity: 0.85;
		outline: none;
	}

	/* ── 좁은 폭(모바일 스택 패널 등) 대응 ── */
	@container account-part (max-width: 520px) {
		.surface-block {
			padding: 1rem;
		}

		.setting-row.is-marketing {
			flex-direction: row;
			align-items: center;
		}
	}
</style>
