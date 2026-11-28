<script lang="ts">
	import { onDestroy } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import AnimatedCheckbox from '#lib/common/design/AnimatedCheckbox.svelte';
	import { ShippingAddressCard, ShippingAddressForm } from '#lib/common/design/address';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { ChevronUpDownIcon, MapPinIcon, PencilIcon, Trash2Icon } from '#lib/common/design/icon';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { SHIPPING_ADDRESS_MAX_COUNT } from '#lib/config/pay';
	import type { ShippingAddress, ShippingFormInput } from '#lib/dedicated/pay/logic/types';

	interface Props {
		mobile: boolean;
		addresses: readonly ShippingAddress[];
		isLoading: boolean;
		errorMessage: string | null;
		editingId: number | null;
		label: string;
		shipping: ShippingFormInput;
		setAsDefault: boolean;
		validationError: string | null;
		isSaving: boolean;
		isLimitReached: boolean;
		onUpdateLabel: (value: string) => void;
		onUpdateField: (field: keyof ShippingFormInput, value: string) => void;
		onSearchAddress: () => Promise<boolean>;
		onToggleDefault: (checked: boolean) => void;
		onStartEdit: (addr: ShippingAddress) => void;
		onCancelEdit: () => void;
		onSubmit: () => void;
		onDelete: (addr: ShippingAddress) => void;
		onReorder: (fromIndex: number, toIndex: number, commit?: boolean) => void;
		onNudgePosition: (index: number) => void;
		onRetry: () => void;
	}

	let {
		mobile,
		addresses,
		isLoading,
		errorMessage,
		editingId,
		label,
		shipping,
		setAsDefault,
		validationError,
		isSaving,
		isLimitReached,
		onUpdateLabel,
		onUpdateField,
		onSearchAddress,
		onToggleDefault,
		onStartEdit,
		onCancelEdit,
		onSubmit,
		onDelete,
		onReorder,
		onNudgePosition,
		onRetry
	}: Props = $props();

	let formSectionEl = $state<HTMLElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let hoveredActionKey = $state<string | null>(null);

	// ── 스냅샷 슬롯 기반 드래그 순서 변경 상태 (PC 핸들 + 모바일 롱프레스 공용) ──
	const LONG_PRESS_MS = 360;
	const LONG_PRESS_MOVE_TOLERANCE = 8;

	let draggingId = $state<number | null>(null);
	let pressingId = $state<number | null>(null);
	let dragOffsetY = $state(0);

	let activePointerId: number | null = null;
	let dragMode: 'handle' | 'longpress' = 'handle';
	let dragStartClientY = 0;
	let grabOffsetInCard = 0;
	let listGap = 0;
	let totalListHeight = 0;
	let workingOrder: number[] = [];
	let didMoveDuringDrag = false;
	let didReorderDuringDrag = false;
	const itemHeights = new Map<number, number>();
	const itemEls = new Map<number, HTMLLIElement>();

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let pendingPressId: number | null = null;
	let pendingPointerId: number | null = null;
	let pendingStartX = 0;
	let pendingStartY = 0;
	let pendingLastClientY = 0;

	function preventTouchScroll(e: TouchEvent) {
		if (draggingId !== null && e.cancelable) {
			e.preventDefault();
		}
	}

	function handleWindowPointerMove(e: PointerEvent) {
		if (draggingId === null || e.pointerId !== activePointerId) return;
		// PC 마우스 버튼이 이미 풀린 상태라면 즉시 드래그 종료 (창 밖 릴리즈 방어)
		if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
			endDrag(e.pointerId, false);
			return;
		}
		if (e.cancelable) e.preventDefault();
		e.stopPropagation();
		updateDrag(e.clientY);
	}

	function handleWindowPointerUp(e: PointerEvent) {
		if (draggingId === null || e.pointerId !== activePointerId) return;
		e.stopPropagation();
		endDrag(e.pointerId, false);
	}

	function handleWindowPointerCancel(e: PointerEvent) {
		if (draggingId === null || e.pointerId !== activePointerId) return;
		e.stopPropagation();
		endDrag(e.pointerId, true);
	}

	function handleWindowBlur() {
		clearPendingLongPress();
		if (draggingId !== null && activePointerId !== null) {
			endDrag(activePointerId, true);
		}
	}

	function setActiveDragListeners(active: boolean) {
		if (typeof window === 'undefined') return;
		if (active) {
			window.addEventListener('pointermove', handleWindowPointerMove, { capture: true, passive: false });
			window.addEventListener('pointerup', handleWindowPointerUp, true);
			window.addEventListener('pointercancel', handleWindowPointerCancel, true);
			window.addEventListener('blur', handleWindowBlur);
			window.addEventListener('touchmove', preventTouchScroll, { passive: false });
		} else {
			window.removeEventListener('pointermove', handleWindowPointerMove, true);
			window.removeEventListener('pointerup', handleWindowPointerUp, true);
			window.removeEventListener('pointercancel', handleWindowPointerCancel, true);
			window.removeEventListener('blur', handleWindowBlur);
			window.removeEventListener('touchmove', preventTouchScroll);
		}
	}

	function handlePendingPointerMove(e: PointerEvent) {
		if (pendingPointerId !== e.pointerId || longPressTimer === null) return;
		pendingLastClientY = e.clientY;
		if (Math.hypot(e.clientX - pendingStartX, e.clientY - pendingStartY) > LONG_PRESS_MOVE_TOLERANCE) {
			clearPendingLongPress();
		}
	}

	function handlePendingPointerEnd(e: PointerEvent) {
		if (pendingPointerId === e.pointerId) {
			clearPendingLongPress();
		}
	}

	function handlePendingScroll() {
		clearPendingLongPress();
	}

	function setPendingLongPressListeners(active: boolean) {
		if (typeof window === 'undefined') return;
		if (active) {
			window.addEventListener('pointermove', handlePendingPointerMove, true);
			window.addEventListener('pointerup', handlePendingPointerEnd, true);
			window.addEventListener('pointercancel', handlePendingPointerEnd, true);
			window.addEventListener('scroll', handlePendingScroll, true);
			window.addEventListener('blur', handleWindowBlur);
		} else {
			window.removeEventListener('pointermove', handlePendingPointerMove, true);
			window.removeEventListener('pointerup', handlePendingPointerEnd, true);
			window.removeEventListener('pointercancel', handlePendingPointerEnd, true);
			window.removeEventListener('scroll', handlePendingScroll, true);
			if (draggingId === null) {
				window.removeEventListener('blur', handleWindowBlur);
			}
		}
	}

	function clearPendingLongPress() {
		if (longPressTimer !== null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		setPendingLongPressListeners(false);
		pendingPressId = null;
		pendingPointerId = null;
		pressingId = null;
	}

	function computeSlotTops(order: readonly number[]): Map<number, number> {
		const tops = new Map<number, number>();
		let y = 0;
		for (const id of order) {
			tops.set(id, y);
			y += (itemHeights.get(id) ?? 0) + listGap;
		}
		return tops;
	}

	function registerItemEl(node: HTMLLIElement, id: number) {
		itemEls.set(id, node);
		return {
			destroy() {
				if (itemEls.get(id) === node) itemEls.delete(id);
			}
		};
	}

	onDestroy(() => {
		clearPendingLongPress();
		setActiveDragListeners(false);
	});

	const isEditing = $derived(editingId !== null);

	const PRIMARY_FD_SETTING = new FluidSetting({
		radius: 12,
		inset: 4,
		reach: 18,
		bulge: 2.4,
		bulgeWidth: 14,
		layers: 2,
		layerGap: 1.5,
		waveAmp: 1.3,
		waveLength: 42,
		spin: 1.1,
		pauseWhenIdle: true,
		color: 'var(--white-2)',
		hoverColor: 'var(--white)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		hoverWaveColor: 'var(--white-3)',
		textColor: 'var(--bg)',
		borderWidth: 0
	});

	const DISABLED_FD_SETTING = PRIMARY_FD_SETTING.with({
		hoverReactive: false,
		bulgeReactive: false,
		clickReactive: false,
		layerGap: 0,
		waveAmp: 0,
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-2)',
		pressColor: 'var(--surface-2)',
		waveColor: 'var(--surface-2)',
		hoverWaveColor: 'var(--surface-2)',
		textColor: 'var(--muted)'
	});

	const submitDisabled = $derived(isSaving || isLimitReached);
	const submitSetting = $derived(submitDisabled ? DISABLED_FD_SETTING : PRIMARY_FD_SETTING);

	function handleEditClick(addr: ShippingAddress) {
		onStartEdit(addr);
		requestAnimationFrame(() => {
			formSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		});
	}

	function beginDrag(
		id: number,
		pointerId: number,
		clientY: number,
		mode: 'handle' | 'longpress'
	) {
		if (!listEl || addresses.length < 2) return;

		itemHeights.clear();
		workingOrder = addresses.map((a) => a.id);
		listGap = Number.parseFloat(getComputedStyle(listEl).rowGap) || 0;

		let total = 0;
		workingOrder.forEach((itemId, idx) => {
			const h = itemEls.get(itemId)?.offsetHeight ?? 0;
			itemHeights.set(itemId, h);
			total += h + (idx > 0 ? listGap : 0);
		});
		totalListHeight = total;

		const slotTops = computeSlotTops(workingOrder);
		const initialSlotTop = slotTops.get(id) ?? 0;
		const listRect = listEl.getBoundingClientRect();
		grabOffsetInCard = clientY - (listRect.top + initialSlotTop);

		draggingId = id;
		pressingId = null;
		activePointerId = pointerId;
		dragMode = mode;
		dragStartClientY = clientY;
		dragOffsetY = 0;
		didMoveDuringDrag = false;
		didReorderDuringDrag = false;
		setActiveDragListeners(true);

		if (mode === 'longpress' && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
			navigator.vibrate(12);
		}
	}

	function updateDrag(clientY: number) {
		if (draggingId === null || !listEl) return;

		if (Math.abs(clientY - dragStartClientY) > 4) {
			didMoveDuringDrag = true;
		}

		const draggedHeight = itemHeights.get(draggingId) ?? 0;
		const listRect = listEl.getBoundingClientRect();
		const rawCardTop = clientY - listRect.top - grabOffsetInCard;
		const maxCardTop = Math.max(0, totalListHeight - draggedHeight);
		const overscroll = 10;
		const clampedCardTop = Math.max(-overscroll, Math.min(maxCardTop + overscroll, rawCardTop));
		const clampedCardBottom = clampedCardTop + draggedHeight;

		const startIdx = workingOrder.indexOf(draggingId);
		if (startIdx < 0) return;

		let nextIdx = startIdx;
		let order = workingOrder;
		let slotTops = computeSlotTops(order);

		// 위로 이동 체크: 드래그 카드의 상단 가장자리가 위 블럭의 45% 지점을 넘으면 교환 (크기가 다른 블럭 간에도 끝까지 이동 보장)
		while (nextIdx > 0) {
			const prevId = order[nextIdx - 1];
			const prevTop = slotTops.get(prevId) ?? 0;
			const prevThresholdY = prevTop + (itemHeights.get(prevId) ?? 0) * 0.45;
			if (clampedCardTop < prevThresholdY) {
				const swapped = [...order];
				const [moved] = swapped.splice(nextIdx, 1);
				swapped.splice(nextIdx - 1, 0, moved);
				order = swapped;
				nextIdx -= 1;
				slotTops = computeSlotTops(order);
			} else {
				break;
			}
		}

		// 아래로 이동 체크: 드래그 카드의 하단 가장자리가 아래 블럭의 55% 지점을 넘으면 교환
		while (nextIdx < order.length - 1) {
			const nextId = order[nextIdx + 1];
			const nextTop = slotTops.get(nextId) ?? 0;
			const nextThresholdY = nextTop + (itemHeights.get(nextId) ?? 0) * 0.55;
			if (clampedCardBottom > nextThresholdY) {
				const swapped = [...order];
				const [moved] = swapped.splice(nextIdx, 1);
				swapped.splice(nextIdx + 1, 0, moved);
				order = swapped;
				nextIdx += 1;
				slotTops = computeSlotTops(order);
			} else {
				break;
			}
		}

		if (nextIdx !== startIdx) {
			workingOrder = order;
			didReorderDuringDrag = true;
			onReorder(startIdx, nextIdx, false);
		}

		const currentSlotTop = slotTops.get(draggingId) ?? 0;
		dragOffsetY = clampedCardTop - currentSlotTop;
	}

	function endDrag(pointerId: number, cancelled = false) {
		if (draggingId === null || pointerId !== activePointerId) return;

		const finishedId = draggingId;
		const mode = dragMode;
		const reordered = didReorderDuringDrag;
		const moved = didMoveDuringDrag;

		draggingId = null;
		activePointerId = null;
		dragOffsetY = 0;
		workingOrder = [];
		didMoveDuringDrag = false;
		didReorderDuringDrag = false;
		setActiveDragListeners(false);

		if (reordered) {
			onReorder(0, 0, true);
		} else if (mode === 'handle' && !cancelled && !moved) {
			const idx = addresses.findIndex((a) => a.id === finishedId);
			if (idx >= 0) onNudgePosition(idx);
		}
	}

	// PC 이동 핸들 포인터 시작 (이동·종료는 DOM 재배치에도 끊기지 않도록 window 리스너가 전담)
	function handleMovePointerDown(id: number, e: PointerEvent) {
		if (mobile || addresses.length < 2) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;

		e.preventDefault();
		beginDrag(id, e.pointerId, e.clientY, 'handle');
	}

	// 모바일 카드 롱프레스 시작 (대기·드래그·종료 모두 window 리스너가 추적)
	function handleCardPointerDown(id: number, e: PointerEvent) {
		if (!mobile || addresses.length < 2) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if ((e.target as HTMLElement | null)?.closest('button, a, input, textarea, select')) return;

		clearPendingLongPress();
		pendingPressId = id;
		pendingPointerId = e.pointerId;
		pendingStartX = e.clientX;
		pendingStartY = e.clientY;
		pendingLastClientY = e.clientY;
		pressingId = id;
		setPendingLongPressListeners(true);

		longPressTimer = setTimeout(() => {
			longPressTimer = null;
			setPendingLongPressListeners(false);
			if (pendingPressId !== id || pendingPointerId === null) return;
			const pid = pendingPointerId;
			const lastY = pendingLastClientY;
			pendingPressId = null;
			pendingPointerId = null;
			beginDrag(id, pid, lastY, 'longpress');
		}, LONG_PRESS_MS);
	}
</script>

<!-- 마이페이지 > 배송지 관리 파트 (상단 공용 배송지 블럭 스택 + 하단 공용 배송지 입력폼, 순수 렌더링) -->
<div class="address-part" data-part="address">
	<!-- 1. 저장된 배송지 목록 블럭 스택 -->
	<section class="address-section" aria-label="저장된 배송지">
		<div class="section-head">
			<h3 class="section-title">저장된 배송지</h3>
			<span class="section-count">{addresses.length} / {SHIPPING_ADDRESS_MAX_COUNT}</span>
		</div>

		{#if isLoading && addresses.length === 0}
			<div class="empty-surface">
				<p class="empty-text">배송지 목록을 불러오는 중입니다...</p>
			</div>
		{:else if errorMessage && addresses.length === 0}
			<div class="empty-surface" role="alert">
				<p class="empty-text">{errorMessage}</p>
				<button type="button" class="soft-btn" onclick={onRetry}>다시 시도</button>
			</div>
		{:else if addresses.length === 0}
			<div class="empty-surface">
				<span class="empty-icon" aria-hidden="true">
					<MapPinIcon size={20} strokeWidth={1.8} />
				</span>
				<p class="empty-text">등록된 배송지가 없습니다. 아래에서 새 배송지를 추가해 보세요.</p>
			</div>
		{:else}
			<ul bind:this={listEl} class="address-stack" class:is-reordering={draggingId !== null}>
				{#each addresses as addr, idx (addr.id)}
					{@const moveKey = `move:${addr.id}`}
					{@const editKey = `edit:${addr.id}`}
					{@const delKey = `del:${addr.id}`}
					{@const isGrabbed = draggingId === addr.id}
					{@const isPressing = pressingId === addr.id}
					{@const canMobileLongPress = mobile && addresses.length > 1}
					<li
						class="address-stack-item"
						class:is-grabbed={isGrabbed}
						class:is-mobile-draggable={canMobileLongPress}
						use:registerItemEl={addr.id}
						animate:flip={{ duration: () => (draggingId === addr.id ? 0 : 240), easing: cubicOut }}
						onpointerdown={canMobileLongPress ? (e) => handleCardPointerDown(addr.id, e) : undefined}
						oncontextmenu={canMobileLongPress ? (e) => e.preventDefault() : undefined}
					>
						<div
							class="address-drag-layer"
							class:is-grabbed={isGrabbed}
							style:transform={isGrabbed ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined}
						>
							<div
								class="address-wobble-layer"
								class:is-pressing={isPressing}
								class:is-grabbed={isGrabbed}
							>
								{#snippet moveHandle()}
									<button
										type="button"
										class="addr-icon-btn is-move"
										class:is-grabbed={isGrabbed}
										aria-label={idx === 0 ? '배송지 순서 아래로 이동 (드래그 가능)' : '배송지 순서 위로 이동 (드래그 가능)'}
										title="드래그하거나 눌러서 위치 변경"
										onpointerenter={() => (hoveredActionKey = moveKey)}
										onpointerleave={() => {
											if (hoveredActionKey === moveKey) hoveredActionKey = null;
										}}
										onpointerdown={(e) => handleMovePointerDown(addr.id, e)}
									>
										<ChevronUpDownIcon
											size={16}
											strokeWidth={1.9}
											hovered={hoveredActionKey === moveKey || isGrabbed}
										/>
									</button>
								{/snippet}

								<ShippingAddressCard
									address={addr}
									showLabel={true}
									showDefaultBadge={true}
									highlighted={editingId === addr.id}
									leading={!mobile && addresses.length > 1 ? moveHandle : undefined}
								>
									{#snippet actions()}
										<button
											type="button"
											class="addr-icon-btn"
											class:is-active={editingId === addr.id}
											aria-label="배송지 수정"
											title="수정"
											onpointerenter={() => (hoveredActionKey = editKey)}
											onpointerleave={() => {
												if (hoveredActionKey === editKey) hoveredActionKey = null;
											}}
											onclick={() => handleEditClick(addr)}
										>
											<PencilIcon
												size={15}
												strokeWidth={1.9}
												hovered={hoveredActionKey === editKey}
											/>
										</button>

										<button
											type="button"
											class="addr-icon-btn is-danger"
											aria-label="배송지 삭제"
											title="삭제"
											onpointerenter={() => (hoveredActionKey = delKey)}
											onpointerleave={() => {
												if (hoveredActionKey === delKey) hoveredActionKey = null;
											}}
											onclick={() => onDelete(addr)}
										>
											<Trash2Icon
												size={15}
												strokeWidth={1.9}
												hovered={hoveredActionKey === delKey}
											/>
										</button>
									{/snippet}
								</ShippingAddressCard>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- 2. 하단 배송지 입력폼 & 저장 버튼 -->
	<section bind:this={formSectionEl} class="address-section" aria-label={isEditing ? '배송지 수정' : '새 배송지 추가'}>
		<div class="section-head">
			<h3 class="section-title">{isEditing ? '배송지 수정' : '새 배송지 추가'}</h3>
			{#if isEditing}
				<button type="button" class="cancel-edit-btn" onclick={onCancelEdit}>수정 취소</button>
			{/if}
		</div>

		<form
			class="address-form-wrap"
			onsubmit={(e) => {
				e.preventDefault();
				onSubmit();
			}}
		>
			<ShippingAddressForm
				{shipping}
				{label}
				showLabelField={true}
				{mobile}
				disabled={isSaving}
				onUpdateLabel={onUpdateLabel}
				onUpdateField={onUpdateField}
				onSearchAddress={onSearchAddress}
			>
				{#snippet footer()}
					<div class="form-footer-bar">
						<label class="default-addr-check">
							<AnimatedCheckbox
								checked={setAsDefault}
								ariaLabel="기본 배송지로 설정"
								onChange={onToggleDefault}
							/>
							<span>기본 배송지로 설정</span>
						</label>

						<div class="form-submit-actions">
							{#if isEditing}
								<button
									type="button"
									class="soft-btn"
									disabled={isSaving}
									onclick={onCancelEdit}
								>
									취소
								</button>
							{/if}

							<FdButton
								type="submit"
								setting={submitSetting}
								disabled={submitDisabled}
								class="addr-save-fd-btn"
							>
								{#if isSaving}
									저장 중...
								{:else if isEditing}
									수정 저장
								{:else}
									저장
								{/if}
							</FdButton>
						</div>
					</div>
				{/snippet}
			</ShippingAddressForm>

			{#if validationError}
				<p class="form-error" role="alert">{validationError}</p>
			{:else if isLimitReached}
				<p class="form-hint">
					배송지는 최대 {SHIPPING_ADDRESS_MAX_COUNT}개까지 등록할 수 있습니다. 기존 배송지를 수정하거나 삭제해 주세요.
				</p>
			{/if}
		</form>
	</section>
</div>

<style>
	.address-part {
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
		width: 100%;
	}

	.address-section {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.section-title {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.section-count {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.cancel-edit-btn {
		padding: 0.25rem 0.55rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.cancel-edit-btn:hover {
		background: var(--surface-1);
		color: var(--white);
	}

	.empty-surface {
		padding: 1.75rem 1.25rem;
		border-radius: 16px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.55rem;
	}

	.empty-icon {
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: var(--surface-1);
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.empty-text {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
		word-break: keep-all;
	}

	/* ── 배송지 블럭 스택 ── */
	.address-stack {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.address-stack.is-reordering {
		user-select: none;
		-webkit-user-select: none;
	}

	.address-stack-item {
		position: relative;
		z-index: 1;
		border-radius: 14px;
	}

	.address-stack-item.is-mobile-draggable {
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.address-stack-item.is-grabbed {
		z-index: 20;
		touch-action: none;
	}

	.address-drag-layer {
		will-change: transform;
		transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.address-drag-layer.is-grabbed {
		transition: none;
	}

	.address-wobble-layer {
		border-radius: 14px;
		transition:
			transform 0.16s ease,
			box-shadow 0.18s ease;
	}

	.address-wobble-layer.is-pressing {
		transform: scale(0.988);
	}

	.address-wobble-layer.is-grabbed {
		animation: addr-wobble 0.24s ease-in-out infinite alternate;
		box-shadow: 0 14px 30px color-mix(in srgb, var(--bg) 60%, transparent);
	}

	@keyframes addr-wobble {
		0% {
			transform: scale(1.015) rotate(-0.85deg);
		}
		100% {
			transform: scale(1.015) rotate(0.85deg);
		}
	}

	.addr-icon-btn {
		width: 30px;
		height: 30px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.addr-icon-btn.is-move {
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.addr-icon-btn.is-move:active,
	.addr-icon-btn.is-move.is-grabbed {
		cursor: grabbing;
		color: var(--white);
	}

	.addr-icon-btn:hover,
	.addr-icon-btn:focus-visible,
	.addr-icon-btn.is-active {
		background: color-mix(in srgb, var(--white) 8%, transparent);
		color: var(--white);
		outline: none;
	}

	.addr-icon-btn.is-danger:hover,
	.addr-icon-btn.is-danger:focus-visible {
		background: color-mix(in srgb, var(--toast-error-bg) 70%, transparent);
		color: var(--toast-error-fg);
	}

	/* ── 하단 입력폼 ── */
	.address-form-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-footer-bar {
		margin-top: 0.35rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.default-addr-check {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.84rem;
		color: var(--muted);
		cursor: pointer;
	}

	.form-submit-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.soft-btn {
		height: 38px;
		padding: 0 1rem;
		border: none;
		border-radius: 10px;
		background: var(--surface-dim);
		color: var(--white-2);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.soft-btn:hover:not(:disabled) {
		background: var(--surface-1);
		color: var(--white);
	}

	.address-form-wrap :global(.fd-btn.addr-save-fd-btn) {
		height: 38px;
		padding: 0 1.25rem;
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.form-error {
		margin: 0;
		font-size: 0.8rem;
		color: var(--danger);
	}

	.form-hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
