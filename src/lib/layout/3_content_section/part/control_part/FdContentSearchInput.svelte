<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { createLetterLimitMotion } from '#lib/common/logic/letterLimitMotion';
	import { FluidSetting } from '#lib/common/type/fluid';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import SearchIcon from '#lib/common/design/icon/SearchIcon.svelte';

	type Modifier = 'mod' | 'ctrl' | 'alt' | 'shift';

	interface Props {
		/** 검색창 입력 값 (양방향 바인딩) */
		value?: string;
		/** 검색창 열림(활성화) 상태 (양방향 바인딩) */
		open?: boolean;
		/** 닫힘 상태에서 버튼에 표시할 라벨 */
		label?: string;
		/** 검색 열기 단축키 ('mod+k', 'ctrl+k' 등) */
		shortcut?: string;
		/** 검색창 플레이스홀더 */
		placeholder?: string;
		/** placeholder 텍스트 변경 시 부드러운 크로스페이드/슬라이드 전환 여부 */
		animatePlaceholder?: boolean;
		/** 입력창/버튼 높이 (px 또는 'sm' | 'md' | 'lg', 기본값: 38) */
		size?: 'sm' | 'md' | 'lg' | number;
		/** 열렸을 때의 가로 폭 (px, 기본값: 300) */
		width?: number;
		/** 열림 스프링 바운스 강도 (0 ~ 100, 기본값: 30) */
		bounce?: number;
		/** 최대 입력 글자 수 */
		maxlength?: number;
		/** 검색어 입력 변경 콜백 */
		oninput?: (value: string) => void;
		/** Enter 키 입력 콜백 */
		onenter?: (value: string | number) => void;
		/** Enter 키 입력 콜백 (CommandButton 호환) */
		onSearch?: (query: string) => void;
		/** 추가 클래스 */
		class?: string;
		/** 접근성 라벨 */
		'aria-label'?: string;
	}

	let {
		value = $bindable(''),
		open = $bindable(false),
		label = '아티스트 검색',
		shortcut = 'mod+k',
		placeholder = '검색어를 입력하세요...',
		animatePlaceholder = true,
		size = 38,
		width = 300,
		bounce = 30,
		maxlength,
		oninput,
		onenter,
		onSearch,
		class: klass = '',
		'aria-label': ariaLabel = '검색'
	}: Props = $props();

	const MODIFIERS: Modifier[] = ['mod', 'ctrl', 'alt', 'shift'];

	function parseShortcut(raw: string) {
		const parts = raw
			.toLowerCase()
			.split('+')
			.map((p) => p.trim())
			.filter(Boolean);
		const modifiers = parts.filter((p): p is Modifier => MODIFIERS.includes(p as Modifier));
		const key = parts.find((p) => !MODIFIERS.includes(p as Modifier)) ?? 'k';
		return { modifiers, key };
	}

	function isKeyMatch(e: KeyboardEvent, key: string): boolean {
		return (
			e.key.toLowerCase() === key ||
			e.code === `Key${key.toUpperCase()}` ||
			e.code === `Digit${key}`
		);
	}

	function isModDown(m: Modifier, e: KeyboardEvent, isMac: boolean): boolean {
		if (m === 'mod') return isMac ? e.metaKey : e.ctrlKey;
		if (m === 'ctrl') return e.ctrlKey;
		if (m === 'alt') return e.altKey;
		return e.shiftKey;
	}

	function isTypingTarget(t: EventTarget | null): boolean {
		return (
			t instanceof HTMLElement &&
			(t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
		);
	}

	function readIsMac(): boolean {
		const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
		return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform ?? navigator.platform);
	}

	const parsedShortcut = $derived(parseShortcut(shortcut));
	const resolvedHeight = $derived(
		typeof size === 'number' ? size : size === 'sm' ? 34 : size === 'lg' ? 46 : 38
	);

	let rootEl: HTMLDivElement | undefined = $state(undefined);
	let measureEl: HTMLSpanElement | undefined = $state(undefined);
	let measurePrefixEl: HTMLSpanElement | undefined = $state(undefined);
	let inputEl: HTMLInputElement | undefined = $state(undefined);
	let mirrorEl: HTMLDivElement | undefined = $state(undefined);
	let pileEl: HTMLDivElement | undefined = $state(undefined);
	let closedIconRef: ReturnType<typeof SearchIcon> | undefined = $state(undefined);
	let openIconRef: ReturnType<typeof SearchIcon> | undefined = $state(undefined);

	const letterMotion = createLetterLimitMotion({
		getInput: () => inputEl,
		getMirror: () => mirrorEl,
		getFillCircle: () => undefined,
		getMeterSvg: () => undefined,
		getCountEl: () => undefined,
		getSendWrap: () => undefined,
		getPileEl: () => pileEl
	});

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	onDestroy(() => {
		letterMotion.destroy();
	});

	let mac = $state(false);
	let hovered = $state(false);
	let closedWidth = $state(132);
	let prefixTargetWidth = $state(60);
	let prefersReducedMotion = false;

	const isEmpty = $derived(value === '' || value === undefined || value === null);

	/** 라벨을 바뀌는 접두어(카테고리)와 고정 접미어('검색')로 분리해 좌우 이동을 동기화 */
	const labelParts = $derived.by(() => {
		const trimmed = label.trim();
		if (trimmed.endsWith(' 검색')) {
			return { prefix: `${trimmed.slice(0, -3)} `, suffix: '검색' };
		}
		return { prefix: trimmed, suffix: '' };
	});

	// ── Spring 물리 엔진 (열림 폭 + 라벨 폭 + 누름 스케일) ──
	interface SpringState {
		x: number;
		v: number;
		t: number;
		k: number;
		c: number;
	}

	// PRESS = { stiffness: 520, damping: 34, mass: 0.6 } => k = 866.67, c = 56.67
	const PRESS_K = 520 / 0.6;
	const PRESS_C = 34 / 0.6;
	// 카테고리 전환 시 좌우 너비 보간 시간(ms)
	const LABEL_GROW_MS = 220;
	const LABEL_SHRINK_MS = 230;

	const widthSpring: SpringState = { x: 132, v: 0, t: 132, k: 300, c: 28 };
	const prefixSpring: SpringState = { x: 60, v: 0, t: 60, k: 340, c: 37 };
	const scaleSpring: SpringState = { x: 1, v: 0, t: 1, k: PRESS_K, c: PRESS_C };

	interface LabelTweenState {
		active: boolean;
		startTime: number;
		duration: number;
		fromWidth: number;
		toWidth: number;
		fromPrefix: number;
		toPrefix: number;
		growing: boolean;
	}

	const labelTween: LabelTweenState = {
		active: false,
		startTime: 0,
		duration: LABEL_GROW_MS,
		fromWidth: 132,
		toWidth: 132,
		fromPrefix: 60,
		toPrefix: 60,
		growing: true
	};

	let currentWidth = $state(132);
	let currentPrefixWidth = $state(60);
	let currentScale = $state(1);
	let springRafId = 0;
	let springLastTime = 0;
	let widthInitialized = false;

	function easeOutCubic(p: number): number {
		return 1 - Math.pow(1 - p, 3);
	}

	function easeInOutCubic(p: number): number {
		return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
	}

	function getOpenDamping(): number {
		const clampedBounce = Math.min(100, Math.max(0, bounce));
		return 34 - (clampedBounce / 100) * 20;
	}

	function stepSpring(s: SpringState, dt: number) {
		const a = -s.k * (s.x - s.t) - s.c * s.v;
		s.v += a * dt;
		s.x += s.v * dt;
	}

	function tickSprings(now: number) {
		springRafId = 0;
		const dt = Math.min((now - springLastTime) / 1000, 1 / 30) || 1 / 60;
		springLastTime = now;

		const sub = 4;
		const subDt = dt / sub;
		for (let i = 0; i < sub; i++) {
			if (!labelTween.active) {
				stepSpring(widthSpring, subDt);
				stepSpring(prefixSpring, subDt);
			}
			stepSpring(scaleSpring, subDt);
		}

		if (labelTween.active) {
			const raw = Math.min(1, Math.max(0, (now - labelTween.startTime) / labelTween.duration));
			const eased = labelTween.growing ? easeOutCubic(raw) : easeInOutCubic(raw);
			const nextW = labelTween.fromWidth + (labelTween.toWidth - labelTween.fromWidth) * eased;
			const nextP = labelTween.fromPrefix + (labelTween.toPrefix - labelTween.fromPrefix) * eased;

			widthSpring.x = nextW;
			widthSpring.v = 0;
			widthSpring.t = labelTween.toWidth;
			prefixSpring.x = nextP;
			prefixSpring.v = 0;
			prefixSpring.t = labelTween.toPrefix;

			if (raw >= 1) {
				labelTween.active = false;
				widthSpring.x = labelTween.toWidth;
				prefixSpring.x = labelTween.toPrefix;
			}
		}

		const widthSettled =
			!labelTween.active &&
			Math.abs(widthSpring.x - widthSpring.t) < 0.08 &&
			Math.abs(widthSpring.v) < 0.35;
		const prefixSettled =
			!labelTween.active &&
			Math.abs(prefixSpring.x - prefixSpring.t) < 0.08 &&
			Math.abs(prefixSpring.v) < 0.35;
		const scaleSettled =
			Math.abs(scaleSpring.x - scaleSpring.t) < 0.0005 && Math.abs(scaleSpring.v) < 0.01;

		if (widthSettled && prefixSettled && scaleSettled) {
			widthSpring.x = widthSpring.t;
			widthSpring.v = 0;
			prefixSpring.x = prefixSpring.t;
			prefixSpring.v = 0;
			scaleSpring.x = scaleSpring.t;
			scaleSpring.v = 0;
			currentWidth = widthSpring.x;
			currentPrefixWidth = prefixSpring.x;
			currentScale = scaleSpring.x;
			return;
		}

		currentWidth = Math.max(40, widthSpring.x);
		currentPrefixWidth = Math.max(0, prefixSpring.x);
		currentScale = scaleSpring.x;
		springRafId = requestAnimationFrame(tickSprings);
	}

	function wakeSprings() {
		if (prefersReducedMotion) {
			if (springRafId) {
				cancelAnimationFrame(springRafId);
				springRafId = 0;
			}
			labelTween.active = false;
			widthSpring.x = widthSpring.t;
			widthSpring.v = 0;
			prefixSpring.x = prefixSpring.t;
			prefixSpring.v = 0;
			scaleSpring.x = scaleSpring.t;
			scaleSpring.v = 0;
			currentWidth = widthSpring.x;
			currentPrefixWidth = prefixSpring.x;
			currentScale = scaleSpring.x;
			return;
		}
		if (springRafId) return;
		springLastTime = performance.now();
		springRafId = requestAnimationFrame(tickSprings);
	}

	function setPress(down: boolean) {
		scaleSpring.k = PRESS_K;
		scaleSpring.c = PRESS_C;
		scaleSpring.t = down && !prefersReducedMotion ? 0.97 : 1;
		wakeSprings();
	}

	function syncWidthTarget(animate = true, mode: 'open' | 'label' = 'open') {
		const target = open ? width : closedWidth;

		if (!animate || !widthInitialized || prefersReducedMotion) {
			labelTween.active = false;
			widthSpring.x = target;
			widthSpring.v = 0;
			widthSpring.t = target;
			prefixSpring.x = prefixTargetWidth;
			prefixSpring.v = 0;
			prefixSpring.t = prefixTargetWidth;
			currentWidth = target;
			currentPrefixWidth = prefixTargetWidth;
			widthInitialized = true;
			return;
		}

		if (mode === 'label' && !open) {
			const growing = target >= currentWidth;
			labelTween.active = true;
			labelTween.startTime = performance.now();
			labelTween.duration = growing ? LABEL_GROW_MS : LABEL_SHRINK_MS;
			labelTween.fromWidth = currentWidth;
			labelTween.toWidth = target;
			labelTween.fromPrefix = currentPrefixWidth;
			labelTween.toPrefix = prefixTargetWidth;
			labelTween.growing = growing;
			widthSpring.t = target;
			prefixSpring.t = prefixTargetWidth;
			wakeSprings();
			return;
		}

		labelTween.active = false;
		widthSpring.k = 300;
		widthSpring.c = getOpenDamping();
		widthSpring.t = target;

		// 열림/닫힘 시 버튼 접두어 폭은 즉시 타겟에 맞춰 어긋남 방지
		prefixSpring.x = prefixTargetWidth;
		prefixSpring.v = 0;
		prefixSpring.t = prefixTargetWidth;
		currentPrefixWidth = prefixTargetWidth;

		wakeSprings();
	}

	function openWith(trusted: boolean, playIcon = false) {
		if (open) return;
		open = true;
		setPress(false);
		syncWidthTarget(true);
		if (trusted || playIcon) {
			void tick().then(() => {
				if (trusted) inputEl?.focus({ preventScroll: true });
				if (playIcon) openIconRef?.play();
			});
		}
	}

	function handleStagePointerEnter() {
		if (open) {
			openIconRef?.play();
		} else {
			closedIconRef?.play();
		}
	}

	function close(clearText = false) {
		if (!open) return;
		open = false;
		if (clearText && value !== '') {
			value = '';
			oninput?.('');
		}
		inputEl?.blur();
		syncWidthTarget(true);
	}

	// 커스텀 blur-swap 트랜지션 (위치 이동 없이 블러 + 투명도로만 전환)
	function blurSwap(
		_node: Element,
		{
			delay = 0,
			duration = 180,
			mode = 'in'
		}: { delay?: number; duration?: number; mode?: 'in' | 'out' } = {}
	) {
		if (prefersReducedMotion) {
			return { duration: 0, delay: 0, css: () => '' };
		}
		// Svelte out 전환은 (1 - progress)에 easing을 적용하므로 cubicIn으로 초반에 빠르게 소거
		const easing =
			mode === 'out' ? (t: number) => t * t * t : (t: number) => 1 - Math.pow(1 - t, 3);
		return {
			delay,
			duration,
			easing,
			css: (t: number) => `opacity: ${t}; filter: blur(${((1 - t) * 4).toFixed(2)}px);`
		};
	}

	function easeOutBackGentle(t: number): number {
		const c1 = 1.45;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	}

	function clearPop(_node: Element, { mode = 'in' }: { mode?: 'in' | 'out' } = {}) {
		if (prefersReducedMotion) {
			return { duration: 0, css: () => '' };
		}
		const isIn = mode === 'in';
		return {
			duration: isIn ? 210 : 150,
			easing: isIn ? easeOutBackGentle : (t: number) => t * t * t,
			css: (t: number) => {
				const scale = 0.35 + 0.65 * t;
				const opacity = Math.min(1, Math.max(0, t));
				return `opacity: ${opacity.toFixed(3)}; transform: scale(${scale.toFixed(3)});`;
			}
		};
	}

	// FdDiv 설정 (ContentHeader 필터 버튼 및 CommandButton 톤에 맞춘 평면 + 유체 물결 + 닫힘 상태 근접 돌출)
	const shellSetting = $derived(
		new FluidSetting({
			radius: 999,
			reach: open ? 0 : 32,
			bulge: open ? 0 : 6,
			bulgeWidth: 18,
			layers: 2,
			waveLength: 90,
			spin: 1.0,
			inset: 12,
			staticFrontWave: true,
			hoverReactive: !open,
			bulgeReactive: !open,
			clickReactive: false,
			pressDeform: { x: 0, y: 0 },
			pauseWhenIdle: !open && !hovered,
			color: 'var(--surface-dim)',
			hoverColor: open ? 'var(--surface-dim)' : 'var(--surface-1)',
			pressColor: 'var(--surface-2)',
			waveColor: 'var(--surface-1)',
			borderWidth: 0
		})
	);

	function measureClosedWidth() {
		if (!measureEl) return;
		const nextTotal = measureEl.getBoundingClientRect().width;
		const nextPrefix = measurePrefixEl ? measurePrefixEl.getBoundingClientRect().width : 0;
		if (
			nextTotal > 0 &&
			(Math.abs(nextTotal - closedWidth) > 0.1 || Math.abs(nextPrefix - prefixTargetWidth) > 0.1)
		) {
			closedWidth = nextTotal;
			prefixTargetWidth = nextPrefix;
			if (!open) {
				syncWidthTarget(widthInitialized, 'label');
			}
		}
	}

	onMount(() => {
		const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = reduceMq.matches;
		const handleReduce = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};
		reduceMq.addEventListener('change', handleReduce);

		mac = readIsMac();
		if (value.trim().length > 0) {
			open = true;
		}

		void tick().then(() => {
			measureClosedWidth();
			syncWidthTarget(false);
		});

		const ro = new ResizeObserver(() => {
			measureClosedWidth();
		});
		if (measureEl) ro.observe(measureEl);

		const onKeyDown = (e: KeyboardEvent) => {
			const { modifiers, key } = parsedShortcut;
			if (open) {
				if (e.key === 'Escape') {
					e.preventDefault();
					close(true);
				}
				return;
			}
			if (!modifiers.some((m) => m !== 'shift') && isTypingTarget(e.target)) return;
			if (!e.repeat && modifiers.every((m) => isModDown(m, e, mac)) && isKeyMatch(e, key)) {
				e.preventDefault();
				openWith(e.isTrusted);
			}
		};

		const onWindowBlur = () => {
			setPress(false);
		};

		const onDocPointerDown = (e: PointerEvent) => {
			if (!open) return;
			const targetEl = e.target instanceof Element ? e.target : null;
			if (targetEl?.closest('[data-keep-search-open]')) return;
			if (!rootEl?.contains(e.target as Node) && !value.trim()) {
				close(false);
			}
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('blur', onWindowBlur);
		document.addEventListener('pointerdown', onDocPointerDown);

		return () => {
			reduceMq.removeEventListener('change', handleReduce);
			ro.disconnect();
			if (springRafId) cancelAnimationFrame(springRafId);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('blur', onWindowBlur);
			document.removeEventListener('pointerdown', onDocPointerDown);
		};
	});

	// 카테고리 전환 등으로 라벨이 바뀔 때 닫힘 상태 너비를 동일 프레임에 재계산
	$effect(() => {
		void label;
		measureClosedWidth();
	});

	// 외부에서 value가 채워질 경우 자동으로 열림 상태 동기화
	$effect(() => {
		if (value.trim().length > 0 && !open) {
			open = true;
			syncWidthTarget(widthInitialized);
		}
	});

	function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
		const field = e.currentTarget;
		let v = field.value;
		if (maxlength && maxlength > 0 && v.length > maxlength) {
			const caret = field.selectionStart ?? maxlength;
			const extra = v.slice(maxlength);
			v = v.slice(0, maxlength);
			field.value = v;
			if (document.activeElement === field) {
				const pos = Math.min(caret, maxlength);
				field.setSelectionRange(pos, pos);
			}
			letterMotion.drop(extra, v);
		}
		value = v;
		oninput?.(v);
	}

	function handleInputKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			close(true);
			return;
		}
		if (e.key === 'Enter') {
			onenter?.(value);
			if (value.trim()) {
				onSearch?.(value.trim());
			}
		}
	}

	function handleInputBlur() {
		if (!value.trim()) {
			close(false);
		}
	}

	function handleClearClick(e: MouseEvent) {
		e.stopPropagation();
		if (value !== '') {
			value = '';
			oninput?.('');
		}
		inputEl?.focus({ preventScroll: true });
	}
</script>

<div bind:this={pileEl} use:portalToBody class="cmd-ll-pile" aria-hidden="true"></div>

<div bind:this={rootEl} class="cmd-search-root {klass}" style:transform="scale({currentScale})">
	<!-- 닫힘 상태 버튼 너비 측정용 숨김 엘리먼트 -->
	<span bind:this={measureEl} class="cmd-measure" aria-hidden="true">
		<span class="cmd-search-icon">
			<SearchIcon size={15} />
		</span>
		<span class="cmd-measure-label">
			<span bind:this={measurePrefixEl} class="cmd-measure-prefix">{labelParts.prefix}</span><span
				>{labelParts.suffix}</span
			>
		</span>
	</span>

	<FdDiv
		setting={shellSetting}
		bind:hovered
		staticFrontWave={true}
		class="cmd-fd-wrap"
		bodyClass="cmd-fd-body"
		onpointerenter={handleStagePointerEnter}
		onpointerdown={(e: PointerEvent) => {
			if (!open) {
				setPress(true);
				return;
			}
			const isClearTarget =
				e.target instanceof Element && Boolean(e.target.closest('.cmd-clear-btn'));
			if (!isClearTarget) {
				openIconRef?.play();
			}
			if (e.target !== inputEl) {
				e.preventDefault();
				inputEl?.focus({ preventScroll: true });
			}
		}}
		onpointerup={() => setPress(false)}
		onpointerleave={() => setPress(false)}
	>
		<div
			class="cmd-stage"
			class:is-open={open}
			style:width="{currentWidth}px"
			style:height="{resolvedHeight}px"
		>
			{#if open}
				<div
					class="cmd-field"
					in:blurSwap={{ delay: 60, duration: 180, mode: 'in' }}
					out:blurSwap={{ duration: 130, mode: 'out' }}
				>
					<span class="cmd-search-icon" aria-hidden="true">
						<SearchIcon bind:this={openIconRef} size={15} />
					</span>

					<div class="cmd-input-wrap">
						<input
							bind:this={inputEl}
							type="text"
							{value}
							placeholder={animatePlaceholder ? undefined : placeholder}
							aria-placeholder={animatePlaceholder && placeholder ? placeholder : undefined}
							aria-label={ariaLabel || placeholder}
							class="cmd-input"
							oninput={handleInput}
							onkeydown={handleInputKeyDown}
							onblur={handleInputBlur}
						/>
						<div bind:this={mirrorEl} class="cmd-input-mirror" aria-hidden="true"></div>

						{#if animatePlaceholder && isEmpty && placeholder}
							<div class="cmd-placeholder-layer" aria-hidden="true">
								{#key placeholder}
									<span
										class="cmd-placeholder-text"
										in:blurSwap={{ delay: 90, duration: 185, mode: 'in' }}
										out:blurSwap={{ duration: 95, mode: 'out' }}
									>
										{placeholder}
									</span>
								{/key}
							</div>
						{/if}
					</div>

					{#if !isEmpty}
						<button
							type="button"
							class="cmd-clear-btn"
							aria-label="검색어 지우기"
							in:clearPop|local={{ mode: 'in' }}
							out:clearPop|local={{ mode: 'out' }}
							onclick={handleClearClick}
						>
							<span class="cmd-clear-icon" aria-hidden="true">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="14"
									height="14"
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
							</span>
						</button>
					{/if}
				</div>
			{:else}
				<button
					type="button"
					class="cmd-btn"
					aria-keyshortcuts={[
						...parsedShortcut.modifiers.map((m) =>
							m === 'mod' ? (mac ? 'Meta' : 'Control') : m[0].toUpperCase() + m.slice(1)
						),
						parsedShortcut.key.toUpperCase()
					].join('+')}
					aria-expanded={false}
					aria-label={ariaLabel}
					onclick={(e) => openWith(e.isTrusted, true)}
					in:blurSwap={{ delay: 60, duration: 180, mode: 'in' }}
					out:blurSwap={{ duration: 130, mode: 'out' }}
				>
					<span class="cmd-search-icon" aria-hidden="true">
						<SearchIcon bind:this={closedIconRef} size={15} />
					</span>

					<span class="cmd-btn-label-row">
						<span class="cmd-prefix-slot" style:width="{currentPrefixWidth}px">
							{#key labelParts.prefix}
								<span
									class="cmd-btn-label"
									in:blurSwap={{ delay: 90, duration: 185, mode: 'in' }}
									out:blurSwap={{ duration: 95, mode: 'out' }}
								>
									{labelParts.prefix}
								</span>
							{/key}
						</span>
						{#if labelParts.suffix}
							<span class="cmd-btn-suffix">{labelParts.suffix}</span>
						{/if}
					</span>
				</button>
			{/if}
		</div>
	</FdDiv>
</div>

<style>
	.cmd-ll-pile {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 250;
	}

	.cmd-ll-pile :global(.ll-falling-char) {
		position: absolute;
		left: 0;
		top: 0;
		width: 20px;
		height: 24px;
		margin: -12px 0 0 -10px;
		text-align: center;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 24px;
		color: var(--danger);
		will-change: transform, opacity;
	}

	.cmd-input-mirror {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		white-space: pre;
		overflow: hidden;
		visibility: hidden;
		pointer-events: none;
	}

	.cmd-search-root {
		position: relative;
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		transform-origin: center center;
		will-change: transform;
	}

	/* 닫힘 상태 버튼의 실제 폭을 미리 재기 위한 숨김 복사본 */
	.cmd-measure {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 1rem 0 0.875rem;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.cmd-measure-label {
		display: inline-flex;
		align-items: center;
	}

	.cmd-measure-prefix {
		white-space: pre;
	}

	:global(.fd-wrap.cmd-fd-wrap) {
		max-width: 100%;
	}

	:global(.fd-wrap.cmd-fd-wrap .fd-body.cmd-fd-body) {
		padding: 0;
		display: block;
		max-width: 100%;
		overflow: hidden;
		border-radius: 999px;
	}

	.cmd-stage {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		max-width: 100%;
		overflow: hidden;
		border-radius: 999px;
	}

	.cmd-btn,
	.cmd-field {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.cmd-btn {
		appearance: none;
		border: none;
		background: transparent;
		margin: 0;
		padding: 0 1rem 0 0.875rem;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.55rem;
		color: rgba(255, 255, 255, 0.85);
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		outline: none;
	}

	.cmd-btn:focus-visible {
		color: var(--white);
	}

	.cmd-btn-label-row {
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
	}

	.cmd-prefix-slot {
		display: inline-grid;
		align-items: center;
		overflow: visible;
		flex-shrink: 0;
	}

	.cmd-btn-label {
		grid-area: 1 / 1;
		justify-self: start;
		white-space: pre;
		pointer-events: none;
	}

	.cmd-btn-suffix {
		flex-shrink: 0;
		white-space: nowrap;
	}

	.cmd-field {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0 0.875rem;
	}

	.cmd-search-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		color: var(--muted);
	}

	.cmd-input-wrap {
		position: relative;
		flex: 1 1 0%;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: center;
	}

	.cmd-input {
		width: 100%;
		height: 100%;
		min-width: 0;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--white);
		caret-color: var(--white);
		outline: none;
	}

	.cmd-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	.cmd-placeholder-layer {
		position: absolute;
		inset: 0;
		display: grid;
		align-items: center;
		pointer-events: none;
		overflow: hidden;
	}

	.cmd-placeholder-text {
		grid-area: 1 / 1;
		font-size: 0.875rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.35);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		user-select: none;
	}

	.cmd-clear-btn {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0 -0.22rem 0 0;
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		color: var(--muted);
		cursor: pointer;
		outline: none;
		transform-origin: center center;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.22s ease;
	}

	.cmd-clear-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		transform-origin: center center;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.cmd-clear-btn:hover,
	.cmd-clear-btn:focus-visible {
		color: var(--white);
	}

	.cmd-clear-btn:hover .cmd-clear-icon,
	.cmd-clear-btn:focus-visible .cmd-clear-icon {
		transform: rotate(90deg);
	}

	.cmd-clear-btn:active .cmd-clear-icon {
		transform: rotate(90deg) scale(0.88);
	}

	@media (prefers-reduced-motion: reduce) {
		.cmd-clear-btn,
		.cmd-clear-icon {
			transition: none;
		}
	}
</style>
