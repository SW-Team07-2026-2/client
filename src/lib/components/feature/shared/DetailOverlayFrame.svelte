<script lang="ts">
	import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import {
		detailOverlay,
		isMobile,
		type DetailRect
	} from '#lib/common/logic';

	interface Props {
		/** 카테고리 키 (artist | concert | album | goods) */
		category: CatalogCategoryKey;
		/** 상세 대상 ID */
		itemId: number;
		/** PC 독립 오버레이 프레임 모드 여부 */
		overlayMode?: boolean;
		/** 상단 앰비언트 배경 포인트 색상 */
		accentColor?: string;
		/** 앞면 모핑 프록시로 이동할 대표 이미지 URL */
		imageSrc?: string;
		/** 카드 미디어 형태 ('circle' | 'rounded') */
		mediaShape?: 'circle' | 'rounded';
		/** mediaShape === 'rounded'일 때 모서리 반경(px) */
		mediaRadius?: number;
		/** 닫기 축소 목표 카드를 찾을 CSS 셀렉터 (미지정 시 기본 data 속성 규칙 사용) */
		cardSelector?: string;
		/** 추가 클래스 */
		class?: string;
		/** 상세 본문 콘텐츠 (히어로 미디어 숨김 여부 전달) */
		children: Snippet<[{ heroHiddenForProxy: boolean }]>;
	}

	let {
		category,
		itemId,
		overlayMode = false,
		accentColor = 'var(--muted-wave)',
		imageSrc = '',
		mediaShape = 'circle',
		mediaRadius = 18,
		cardSelector,
		class: klass = '',
		children
	}: Props = $props();

	interface FrameBounds {
		top: number;
		left: number;
		width: number;
		height: number;
		radius: number;
		isTopClipped?: boolean;
	}

	const EXPAND_DURATION_MS = 460;
	const CLOSE_DURATION_MS = 380;
	const CLOSE_WAVE_DECAY_DELAY_MS = 140;
	const SLIDE_DOWN_CLOSE_MS = 400;
	const PROXY_HANDOFF_MS = 100;
	const PROXY_WAVE_INSET = 14;
	const EXPAND_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
	const CLOSE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

	const mobile = $derived(isMobile.current);
	const slot = $derived(detailOverlay.getSlot(category));
	const isSlotClosingThis = $derived(slot.phase === 'closing' && slot.closingId === itemId);
	const effectiveImageSrc = $derived(
		imageSrc || slot.seed?.imageSrc || detailOverlay.getLastImageSrc(category, itemId)
	);
	const effectiveAccentColor = $derived(slot.seed?.accentColor || accentColor);
	const useWaveProxy = $derived(!mobile && mediaShape === 'circle');
	let proxyWaveSettling = $state<boolean>(false);
	const proxyWaveSetting = $derived(
		new FluidSetting({
			radius: 999,
			inset: PROXY_WAVE_INSET,
			layers: 2,
			layerGap: 3,
			waveAmp: 2.2,
			waveLength: 68,
			spin: 1.0,
			bulge: 0,
			reach: 0,
			hoverReactive: false,
			bulgeReactive: false,
			clickReactive: false,
			pauseWhenIdle: proxyWaveSettling,
			waveColor: effectiveAccentColor
		})
	);

	function readCssPxVar(name: string, fallback: number): number {
		if (typeof document === 'undefined') return fallback;
		const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		const parsed = Number.parseFloat(raw);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	function resolveHeaderBottom(): number {
		if (typeof document === 'undefined') return 0;
		const header = document.querySelector<HTMLElement>('.main-header, .mobile-header');
		if (header) {
			return Math.max(0, Math.round(header.getBoundingClientRect().bottom));
		}
		return !isMobile.current ? readCssPxVar('--pc-header-height', 70) : 0;
	}

	function resolveFrameBounds(useFullViewport: boolean): FrameBounds {
		if (typeof window === 'undefined' || typeof document === 'undefined') {
			return { top: 0, left: 0, width: 0, height: 0, radius: 0 };
		}
		const isMobileDevice = isMobile.current;
		const fallbackGap = isMobileDevice ? 0 : readCssPxVar('--detail-frame-gap', 16);
		const marginTop = isMobileDevice ? 0 : readCssPxVar('--detail-frame-margin-top', fallbackGap);
		const marginRight = isMobileDevice
			? 0
			: readCssPxVar('--detail-frame-margin-right', fallbackGap);
		const marginBottom = isMobileDevice
			? 0
			: readCssPxVar('--detail-frame-margin-bottom', fallbackGap);
		const marginLeft = isMobileDevice
			? 0
			: readCssPxVar('--detail-frame-margin-left', fallbackGap);
		const radius = isMobileDevice ? 0 : readCssPxVar('--detail-frame-radius', 22);
		const headerBottom = resolveHeaderBottom();
		const stageEl = useFullViewport ? null : document.querySelector<HTMLElement>('.route-stage');
		const stageRect = stageEl?.getBoundingClientRect();
		const containerLeft = stageRect ? stageRect.left : 0;
		const containerWidth =
			stageRect && stageRect.width > 0 ? stageRect.width : document.documentElement.clientWidth;

		return {
			top: headerBottom + marginTop,
			left: containerLeft + marginLeft,
			width: Math.max(0, containerWidth - marginLeft - marginRight),
			height: Math.max(0, window.innerHeight - headerBottom - marginTop - marginBottom),
			radius,
			isTopClipped: false
		};
	}

	function resolveLiveShellFrame(): FrameBounds | null {
		if (!shellEl) return null;
		const r = shellEl.getBoundingClientRect();
		if (r.width <= 0 || r.height <= 0) return null;
		const radius = isMobile.current ? 0 : readCssPxVar('--detail-frame-radius', 22);
		return {
			top: r.top,
			left: r.left,
			width: r.width,
			height: r.height,
			radius,
			isTopClipped: false
		};
	}

	function resolveCloseFrame(): { frame: FrameBounds; innerOffsetY: number } {
		const fallback = resolveFrameBounds(false);
		const rect = slot.closeFrameRect;
		const radius = isMobile.current ? 0 : readCssPxVar('--detail-frame-radius', 22);
		if (typeof window === 'undefined' || !rect) {
			return { frame: fallback, innerOffsetY: slot.closeScrollY };
		}
		const headerBottom = slot.closeHeaderBottom || resolveHeaderBottom();
		const visibleTop = Math.max(headerBottom, rect.top);
		const rectBottom = rect.top + rect.height;
		const visibleBottom = Math.min(window.innerHeight, rectBottom);
		return {
			frame: {
				top: visibleTop,
				left: rect.left,
				width: rect.width,
				height: Math.max(48, visibleBottom - visibleTop),
				radius,
				isTopClipped: rect.top < headerBottom - 1
			},
			innerOffsetY: Math.max(0, visibleTop - rect.top)
		};
	}

	function resolveMediaClipRadius(rect: DetailRect, shrinkPx: number): number {
		if (mediaShape === 'rounded') {
			return Math.max(6, mediaRadius - shrinkPx);
		}
		const effectiveDiameter = Math.max(16, Math.min(rect.width, rect.height) - shrinkPx * 2);
		return Math.max(12, Math.round(effectiveDiameter / 2));
	}

	function buildMediaClipPath(frame: FrameBounds, media: DetailRect, shrinkPx = 0): string {
		const insetTop = Math.max(0, media.top - frame.top + shrinkPx);
		const insetRight = Math.max(
			0,
			frame.left + frame.width - (media.left + media.width) + shrinkPx
		);
		const insetBottom = Math.max(
			0,
			frame.top + frame.height - (media.top + media.height) + shrinkPx
		);
		const insetLeft = Math.max(0, media.left - frame.left + shrinkPx);
		const r = resolveMediaClipRadius(media, shrinkPx);
		return `inset(${insetTop.toFixed(1)}px ${insetRight.toFixed(1)}px ${insetBottom.toFixed(1)}px ${insetLeft.toFixed(1)}px round ${r}px)`;
	}

	function getHeroMediaRect(): DetailRect | null {
		if (!shellEl) return null;
		const el =
			shellEl.querySelector<HTMLElement>('[data-detail-hero-media] .fd-img') ??
			shellEl.querySelector<HTMLElement>('[data-detail-hero-media] img') ??
			shellEl.querySelector<HTMLElement>('[data-detail-hero-media]');
		const r = el?.getBoundingClientRect();
		if (!r || r.width <= 0 || r.height <= 0) return null;
		return { left: r.left, top: r.top, width: r.width, height: r.height };
	}

	function findCardMediaElement(): HTMLElement | null {
		if (typeof document === 'undefined') return null;
		const selector =
			cardSelector ??
			`[data-catalog-card="${category}-${itemId}"], [data-${category}-card="${itemId}"]`;
		const cardEl = document.querySelector<HTMLElement>(selector);
		if (!cardEl) return null;
		return (
			cardEl.querySelector<HTMLElement>('.fd-image-wrap') ??
			cardEl.querySelector<HTMLElement>('.fd-img') ??
			cardEl.querySelector<HTMLElement>('img') ??
			cardEl
		);
	}

	function resolveTargetCardRect(): DetailRect | null {
		if (typeof document === 'undefined' || typeof window === 'undefined') return null;
		const selector =
			cardSelector ??
			`[data-catalog-card="${category}-${itemId}"], [data-${category}-card="${itemId}"]`;
		const cardEl = document.querySelector<HTMLElement>(selector);
		const mediaEl =
			cardEl?.querySelector<HTMLElement>('.fd-img') ??
			cardEl?.querySelector<HTMLElement>('.fd-image-body') ??
			cardEl?.querySelector<HTMLElement>('img') ??
			cardEl;
		if (mediaEl) {
			const r = mediaEl.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) {
				if (r.bottom > -120 && r.top < window.innerHeight + 120) {
					return { left: r.left, top: r.top, width: r.width, height: r.height };
				}
				return null;
			}
		}
		const saved = detailOverlay.getLastOriginRect(category, itemId);
		if (
			saved &&
			saved.width > 0 &&
			saved.height > 0 &&
			saved.top + saved.height > -120 &&
			saved.top < window.innerHeight + 120
		) {
			return saved;
		}
		return null;
	}

	let hiddenSourceCardMedia: HTMLElement | null = null;

	function setSourceCardMediaHidden(hidden: boolean) {
		if (hidden) {
			const el = findCardMediaElement();
			if (hiddenSourceCardMedia && hiddenSourceCardMedia !== el) {
				hiddenSourceCardMedia.style.opacity = '';
			}
			hiddenSourceCardMedia = el;
			if (el) {
				el.style.opacity = '0';
			}
		} else if (hiddenSourceCardMedia) {
			hiddenSourceCardMedia.style.opacity = '';
			hiddenSourceCardMedia = null;
		}
	}

	// 초기 확장 상태 동기화 (첫 프레임 깜빡임 방지)
	const initialOriginRect = untrack(() => {
		const s = detailOverlay.getSlot(category);
		if (s.phase === 'expanding' && s.activeId === itemId && s.seed?.originRect && !prefersReducedMotion()) {
			return s.seed.originRect;
		}
		return null;
	});
	const initialFrame = untrack(() =>
		initialOriginRect ? resolveFrameBounds(overlayMode) : null
	);
	const initialClip = untrack(() =>
		initialOriginRect && initialFrame ? buildMediaClipPath(initialFrame, initialOriginRect, 2) : ''
	);

	let isExpanding = $state<boolean>(Boolean(initialOriginRect));
	let isClosingAnim = $state<boolean>(false);
	let ambientVisible = $state<boolean>(prefersReducedMotion());
	let fixedFrame = $state<FrameBounds | null>(initialFrame);
	let preAnimClip = $state<string>(initialClip);
	let closeInnerOffsetY = $state<number>(0);

	const isViewportFixed = $derived(
		!overlayMode && (isExpanding || isClosingAnim) && fixedFrame !== null
	);

	let proxyRect = $state<DetailRect | null>(initialOriginRect);
	let proxyVisible = $state<boolean>(Boolean(initialOriginRect));
	let heroHiddenForProxy = $state<boolean>(Boolean(initialOriginRect));

	let shellEl = $state<HTMLDivElement | null>(null);
	let backdropEl = $state<HTMLDivElement | null>(null);
	let innerEl = $state<HTMLDivElement | null>(null);
	let proxyEl = $state<HTMLDivElement | null>(null);

	let destroyed = false;
	let expandTimer: ReturnType<typeof setTimeout> | undefined;
	let ambientRevealTimer: ReturnType<typeof setTimeout> | undefined;
	let proxyFadeTimer: ReturnType<typeof setTimeout> | undefined;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let closeWaveTimer: ReturnType<typeof setTimeout> | undefined;
	let closeRunSeq = 0;
	let closeLocked = false;
	let closeAnimStarted = false;

	function cancelAnimations() {
		shellEl?.getAnimations().forEach((a) => a.cancel());
		backdropEl?.getAnimations().forEach((a) => a.cancel());
		innerEl?.getAnimations().forEach((a) => a.cancel());
		proxyEl?.getAnimations().forEach((a) => a.cancel());
	}

	async function playSynchronizedAnimations(
		anims: Animation[],
		isStillValid: () => boolean,
		onStart?: () => void
	): Promise<void> {
		if (anims.length === 0) return;
		for (const anim of anims) {
			anim.pause();
		}
		try {
			await Promise.all(anims.map((a) => a.ready));
		} catch {
			// 취소된 애니메이션 무시
		}
		if (!isStillValid()) {
			for (const anim of anims) anim.cancel();
			return;
		}
		const syncStart =
			typeof document !== 'undefined' ? (document.timeline?.currentTime ?? null) : null;
		for (const anim of anims) {
			anim.play();
			if (syncStart !== null) {
				anim.startTime = syncStart;
			}
		}
		onStart?.();
		await Promise.allSettled(anims.map((a) => a.finished));
	}

	function finishExpand(crossfadeProxy = false) {
		clearTimeout(expandTimer);
		clearTimeout(proxyFadeTimer);
		if (!isExpanding) return;

		heroHiddenForProxy = false;
		preAnimClip = '';

		const commitSettle = () => {
			if (destroyed || !isExpanding) return;
			clearTimeout(proxyFadeTimer);
			proxyEl?.getAnimations().forEach((a) => a.cancel());
			proxyVisible = false;
			proxyRect = null;
			isExpanding = false;
			fixedFrame = null;
			setSourceCardMediaHidden(false);
			shellEl?.getAnimations().forEach((a) => a.cancel());
			innerEl?.getAnimations().forEach((a) => a.cancel());
			detailOverlay.finishExpand(category);
		};

		if (crossfadeProxy && proxyEl && proxyVisible && typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				if (destroyed || !isExpanding) return;
				if (!proxyEl) {
					commitSettle();
					return;
				}
				const fadeAnim = proxyEl.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: PROXY_HANDOFF_MS,
					easing: 'ease-out',
					fill: 'forwards'
				});
				proxyFadeTimer = setTimeout(commitSettle, PROXY_HANDOFF_MS + 25);
				void fadeAnim.finished.then(commitSettle);
			});
		} else {
			commitSettle();
		}
	}

	async function runExpandAnimation(originRect: DetailRect) {
		if (prefersReducedMotion()) {
			finishExpand(false);
			return;
		}

		clearTimeout(closeWaveTimer);
		proxyWaveSettling = false;
		fixedFrame = resolveFrameBounds(overlayMode);
		preAnimClip = buildMediaClipPath(fixedFrame, originRect, 2);
		proxyRect = originRect;
		proxyVisible = Boolean(effectiveImageSrc);
		heroHiddenForProxy = Boolean(effectiveImageSrc);
		if (effectiveImageSrc) {
			setSourceCardMediaHidden(true);
		}
		await tick();

		if (destroyed || !shellEl || !fixedFrame) {
			finishExpand(false);
			return;
		}

		const targetFrame = (overlayMode ? resolveLiveShellFrame() : null) ?? fixedFrame;
		fixedFrame = targetFrame;

		const destRect = getHeroMediaRect();
		const startClip = buildMediaClipPath(targetFrame, originRect, 2);
		const endClip = `inset(0px 0px 0px 0px round ${targetFrame.radius}px ${targetFrame.radius}px 0px 0px)`;

		const anims: Animation[] = [
			shellEl.animate([{ clipPath: startClip }, { clipPath: endClip }], {
				duration: EXPAND_DURATION_MS,
				easing: EXPAND_EASE,
				fill: 'both'
			})
		];
		preAnimClip = '';

		if (innerEl) {
			anims.push(
				innerEl.animate(
					[
						{ opacity: 0, transform: 'translate3d(0, 14px, 0) scale(0.99)' },
						{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
					],
					{
						duration: 350,
						delay: 85,
						easing: EXPAND_EASE,
						fill: 'both'
					}
				)
			);
		}

		if (proxyEl && destRect) {
			const dx = destRect.left + destRect.width / 2 - (originRect.left + originRect.width / 2);
			const dy = destRect.top + destRect.height / 2 - (originRect.top + originRect.height / 2);
			const scaleRatio = originRect.width > 0 ? destRect.width / originRect.width : 1;

			anims.push(
				proxyEl.animate(
					[
						{ transform: 'translate3d(0px, 0px, 0) scale(1)' },
						{
							transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scaleRatio.toFixed(4)})`
						}
					],
					{
						duration: EXPAND_DURATION_MS,
						easing: EXPAND_EASE,
						fill: 'both'
					}
				)
			);
		}

		expandTimer = setTimeout(() => {
			if (!destroyed) finishExpand(true);
		}, EXPAND_DURATION_MS + 140);

		void playSynchronizedAnimations(anims, () => !destroyed && isExpanding).then(() => {
			if (!destroyed && isExpanding) finishExpand(true);
		});
	}

	function finishClose() {
		clearTimeout(closeTimer);
		clearTimeout(closeWaveTimer);
		cancelAnimations();
		isClosingAnim = false;
		fixedFrame = null;
		closeInnerOffsetY = 0;
		proxyVisible = false;
		proxyRect = null;
		proxyWaveSettling = false;
		heroHiddenForProxy = false;
		setSourceCardMediaHidden(false);
		detailOverlay.finishClose(category);
	}

	async function runCloseAnimation() {
		const seq = ++closeRunSeq;

		if (prefersReducedMotion()) {
			finishClose();
			return;
		}

		await tick();
		if (destroyed || seq !== closeRunSeq || !isSlotClosingThis || !shellEl || !fixedFrame) {
			return;
		}

		const frame = (overlayMode ? resolveLiveShellFrame() : null) ?? fixedFrame;
		const liveTargetRect = resolveTargetCardRect();

		// 새로고침 등으로 원래 카드 위치를 찾을 수 없을 때는 상세 영역 전체를 아래로 슬라이드해 닫기
		if (!liveTargetRect) {
			const hadProxy = proxyVisible || heroHiddenForProxy;
			proxyVisible = false;
			proxyRect = null;
			heroHiddenForProxy = false;
			setSourceCardMediaHidden(false);
			if (hadProxy) {
				await tick();
				if (destroyed || seq !== closeRunSeq || !isSlotClosingThis || !shellEl) {
					return;
				}
			}

			const slideDistance = Math.max(frame.height, window.innerHeight - frame.top) + 32;
			const anims: Animation[] = [
				shellEl.animate(
					[
						{ transform: 'translate3d(0, 0, 0)' },
						{ transform: `translate3d(0, ${slideDistance.toFixed(1)}px, 0)` }
					],
					{
						duration: SLIDE_DOWN_CLOSE_MS,
						easing: CLOSE_EASE,
						fill: 'both'
					}
				),
				shellEl.animate(
					[
						{ opacity: 1 },
						{ opacity: 1, offset: 0.72 },
						{ opacity: 0 }
					],
					{
						duration: SLIDE_DOWN_CLOSE_MS,
						easing: 'linear',
						fill: 'both'
					}
				)
			];

			closeTimer = setTimeout(() => {
				if (!destroyed && seq === closeRunSeq) finishClose();
			}, SLIDE_DOWN_CLOSE_MS + 140);

			void playSynchronizedAnimations(
				anims,
				() => !destroyed && seq === closeRunSeq && isSlotClosingThis
			).then(() => {
				if (!destroyed && seq === closeRunSeq) finishClose();
			});
			return;
		}

		const targetRect = liveTargetRect;
		const heroStartRect = proxyRect ?? slot.closeHeroRect ?? getHeroMediaRect();
		const canGlideProxy = Boolean(
			proxyVisible &&
				proxyEl &&
				effectiveImageSrc &&
				heroStartRect &&
				heroStartRect.top + heroStartRect.height > frame.top - 24 &&
				heroStartRect.top < window.innerHeight + 24
		);

		if (canGlideProxy) {
			setSourceCardMediaHidden(true);
		}

		const startTopRadius = frame.isTopClipped ? 0 : frame.radius;
		const startClip = `inset(0px 0px 0px 0px round ${startTopRadius}px ${startTopRadius}px 0px 0px)`;
		const endClip = buildMediaClipPath(frame, targetRect, 2);

		const anims: Animation[] = [
			shellEl.animate([{ clipPath: startClip }, { clipPath: endClip }], {
				duration: CLOSE_DURATION_MS,
				easing: CLOSE_EASE,
				fill: 'both'
			}),
			shellEl.animate(
				[
					{ opacity: 1 },
					{ opacity: 1, offset: 0.72 },
					{ opacity: 0 }
				],
				{
					duration: CLOSE_DURATION_MS,
					easing: 'linear',
					fill: 'both'
				}
			)
		];

		if (backdropEl) {
			const currentOpacity = Number.parseFloat(getComputedStyle(backdropEl).opacity) || 0;
			anims.push(
				backdropEl.animate([{ opacity: currentOpacity }, { opacity: 0 }], {
					duration: Math.round(CLOSE_DURATION_MS * 0.82),
					easing: CLOSE_EASE,
					fill: 'both'
				})
			);
		}

		if (innerEl) {
			const baseY = -closeInnerOffsetY;
			anims.push(
				innerEl.animate(
					[
						{ opacity: 1, transform: `translate3d(0, ${baseY}px, 0)` },
						{ opacity: 0, transform: `translate3d(0, ${(baseY + 10).toFixed(1)}px, 0)` }
					],
					{
						duration: 150,
						easing: 'ease-out',
						fill: 'both'
					}
				)
			);
		}

		if (canGlideProxy && heroStartRect && proxyEl) {
			const dx =
				targetRect.left + targetRect.width / 2 - (heroStartRect.left + heroStartRect.width / 2);
			const dy =
				targetRect.top + targetRect.height / 2 - (heroStartRect.top + heroStartRect.height / 2);
			const scaleRatio = heroStartRect.width > 0 ? targetRect.width / heroStartRect.width : 1;

			anims.push(
				proxyEl.animate(
					[
						{ transform: 'translate3d(0px, 0px, 0) scale(1)' },
						{
							transform: `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scaleRatio.toFixed(4)})`
						}
					],
					{
						duration: CLOSE_DURATION_MS,
						easing: CLOSE_EASE,
						fill: 'both'
					}
				)
			);
		}

		closeTimer = setTimeout(() => {
			if (!destroyed && seq === closeRunSeq) finishClose();
		}, CLOSE_DURATION_MS + 140);

		void playSynchronizedAnimations(
			anims,
			() => !destroyed && seq === closeRunSeq && isSlotClosingThis,
			() => {
				if (useWaveProxy && canGlideProxy) {
					clearTimeout(closeWaveTimer);
					closeWaveTimer = setTimeout(() => {
						if (!destroyed && seq === closeRunSeq && isSlotClosingThis) {
							proxyWaveSettling = true;
						}
					}, CLOSE_WAVE_DECAY_DELAY_MS);
				}
			}
		).then(() => {
			if (!destroyed && seq === closeRunSeq) finishClose();
		});
	}

	onMount(() => {
		if (!prefersReducedMotion()) {
			const revealDelay = initialOriginRect ? 160 : 40;
			ambientRevealTimer = setTimeout(() => {
				if (!destroyed && !isClosingAnim) {
					ambientVisible = true;
				}
			}, revealDelay);
		}
		if (initialOriginRect) {
			void runExpandAnimation(initialOriginRect);
		} else if (slot.phase === 'expanding' && slot.activeId === itemId) {
			detailOverlay.finishExpand(category);
		}
	});

	// 닫기 상태 머신 반응 (1단계: 즉시 프레임·프록시 고정 -> 2단계: 배경 준비 완료 시 역방향 축소 실행)
	$effect.pre(() => {
		const shouldClose = isSlotClosingThis;
		const readyToAnimate = slot.closeReady;

		if (shouldClose && !closeLocked) {
			closeLocked = true;
			closeAnimStarted = false;
			untrack(() => {
				clearTimeout(expandTimer);
				clearTimeout(proxyFadeTimer);
				clearTimeout(closeWaveTimer);
				cancelAnimations();
				isExpanding = false;
				preAnimClip = '';
				proxyWaveSettling = false;

				if (overlayMode) {
					fixedFrame = resolveLiveShellFrame() ?? resolveFrameBounds(true);
					closeInnerOffsetY = 0;
				} else {
					const { frame, innerOffsetY } = resolveCloseFrame();
					fixedFrame = frame;
					closeInnerOffsetY = innerOffsetY;
				}
				isClosingAnim = true;

				const currentFrame = fixedFrame;
				const hasLikelyCardTarget = Boolean(
					findCardMediaElement() || detailOverlay.getLastOriginRect(category, itemId)
				);
				const heroStartRect = getHeroMediaRect() ?? slot.closeHeroRect ?? null;
				const canShowProxy = Boolean(
					hasLikelyCardTarget &&
						effectiveImageSrc &&
						heroStartRect &&
						currentFrame &&
						heroStartRect.top + heroStartRect.height > currentFrame.top - 24 &&
						heroStartRect.top < window.innerHeight + 24
				);
				if (canShowProxy && heroStartRect) {
					proxyRect = heroStartRect;
					proxyVisible = true;
					heroHiddenForProxy = true;
				} else {
					proxyRect = null;
					proxyVisible = false;
					heroHiddenForProxy = false;
				}
			});
		}

		if (shouldClose && closeLocked && readyToAnimate && !closeAnimStarted) {
			closeAnimStarted = true;
			untrack(() => {
				void runCloseAnimation();
			});
		}

		if (!shouldClose && closeLocked) {
			closeLocked = false;
			closeAnimStarted = false;
			untrack(() => {
				closeRunSeq += 1;
				clearTimeout(closeTimer);
				clearTimeout(closeWaveTimer);
				cancelAnimations();
				isClosingAnim = false;
				fixedFrame = null;
				closeInnerOffsetY = 0;
				proxyVisible = false;
				proxyRect = null;
				proxyWaveSettling = false;
				heroHiddenForProxy = false;
			});
		}
	});

	onDestroy(() => {
		destroyed = true;
		clearTimeout(expandTimer);
		clearTimeout(ambientRevealTimer);
		clearTimeout(proxyFadeTimer);
		clearTimeout(closeTimer);
		clearTimeout(closeWaveTimer);
		setSourceCardMediaHidden(false);
		cancelAnimations();
	});
</script>

<div
	bind:this={shellEl}
	data-detail-frame="{category}-{itemId}"
	class="detail-overlay-frame {klass}"
	class:is-mobile={mobile}
	class:is-overlay-mode={overlayMode}
	class:is-expanding={isExpanding}
	class:is-closing={isClosingAnim}
	class:is-viewport-fixed={isViewportFixed}
	class:is-top-clipped={Boolean(isViewportFixed && fixedFrame?.isTopClipped)}
	style:--detail-accent={effectiveAccentColor}
	style:top={isViewportFixed && fixedFrame ? `${fixedFrame.top}px` : undefined}
	style:left={isViewportFixed && fixedFrame ? `${fixedFrame.left}px` : undefined}
	style:width={isViewportFixed && fixedFrame ? `${fixedFrame.width}px` : undefined}
	style:height={isViewportFixed && fixedFrame ? `${fixedFrame.height}px` : undefined}
	style:clip-path={isExpanding && preAnimClip ? preAnimClip : undefined}
>
	<div
		bind:this={backdropEl}
		class="detail-ambient-backdrop"
		class:is-visible={ambientVisible}
		aria-hidden="true"
	></div>

	<div
		bind:this={innerEl}
		class="detail-frame-inner"
		style:transform={isClosingAnim && closeInnerOffsetY > 0
			? `translate3d(0, ${-closeInnerOffsetY}px, 0)`
			: undefined}
	>
		{@render children({ heroHiddenForProxy })}
	</div>
</div>

{#if proxyVisible && proxyRect && effectiveImageSrc}
	{@const proxyInset = useWaveProxy ? PROXY_WAVE_INSET : 0}
	<div
		bind:this={proxyEl}
		class="detail-morph-proxy"
		class:is-rounded={mediaShape === 'rounded'}
		class:has-fluid-wave={useWaveProxy}
		style:--proxy-radius="{mediaRadius}px"
		style:left="{proxyRect.left - proxyInset}px"
		style:top="{proxyRect.top - proxyInset}px"
		style:width="{proxyRect.width + proxyInset * 2}px"
		style:height="{proxyRect.height + proxyInset * 2}px"
		aria-hidden="true"
	>
		{#if useWaveProxy}
			<FdImage
				class="detail-morph-fd-image"
				src={effectiveImageSrc}
				alt=""
				loading="eager"
				decoding="sync"
				objectPosition="50% 40%"
				setting={proxyWaveSetting}
				active={!proxyWaveSettling}
				fullWidth
			/>
		{:else}
			<img src={effectiveImageSrc} alt="" draggable="false" />
		{/if}
	</div>
{/if}

<style>
	.detail-overlay-frame {
		position: relative;
		width: 100%;
		min-height: calc(
			100dvh - var(--pc-header-height) - var(--detail-frame-margin-top, 0px) -
				var(--detail-frame-margin-bottom, 0px)
		);
		background: var(--detail-frame-bg);
		border: var(--detail-frame-border);
		border-radius: var(--detail-frame-radius) var(--detail-frame-radius) 0 0;
		box-sizing: border-box;
		color: var(--fg);
		overflow-x: clip;
	}

	.detail-overlay-frame.is-mobile {
		min-height: calc(100dvh - var(--mobile-bottom-bar-height));
		background: var(--bg);
		border: none;
		border-radius: 0;
	}

	.detail-overlay-frame.is-overlay-mode {
		position: absolute;
		top: var(--detail-frame-margin-top, 0px);
		right: var(--detail-frame-margin-right, 0px);
		bottom: var(--detail-frame-margin-bottom, 0px);
		left: var(--detail-frame-margin-left, 0px);
		width: auto;
		min-height: 0;
		height: auto;
		border-radius: var(--detail-frame-radius) var(--detail-frame-radius) 0 0;
		overflow-y: auto;
		overflow-x: clip;
		overscroll-behavior: contain;
		pointer-events: auto;
	}

	.detail-overlay-frame.is-overlay-mode.is-expanding,
	.detail-overlay-frame.is-overlay-mode.is-closing {
		overflow: hidden;
		will-change: transform, clip-path, opacity;
	}

	.detail-overlay-frame.is-viewport-fixed {
		position: fixed;
		min-height: 0;
		z-index: 40;
		overflow: hidden;
		will-change: transform, clip-path, opacity;
	}

	.detail-overlay-frame.is-top-clipped {
		border-top-left-radius: 0;
		border-top-right-radius: 0;
		border-top-color: transparent;
	}

	.detail-overlay-frame.is-closing {
		pointer-events: none;
	}

	.detail-ambient-backdrop {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		overflow: hidden;
		pointer-events: none;
		background:
			radial-gradient(
				circle at 22% 18%,
				color-mix(in srgb, var(--detail-accent) 22%, transparent) 0%,
				transparent 54%
			),
			radial-gradient(
				circle at 78% 12%,
				color-mix(in srgb, var(--detail-accent) 10%, transparent) 0%,
				transparent 48%
			);
		opacity: 0;
		transition: opacity 0.95s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.detail-ambient-backdrop.is-visible {
		opacity: 0.92;
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-ambient-backdrop {
			transition: none;
		}
	}

	.detail-frame-inner {
		position: relative;
		z-index: 1;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4.5rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.detail-overlay-frame.is-mobile .detail-frame-inner {
		padding: 1rem var(--content-padding-x-mobile) 3.5rem;
		gap: 2rem;
	}

	.detail-morph-proxy {
		position: fixed;
		z-index: 45;
		border-radius: 999px;
		overflow: hidden;
		pointer-events: none;
		transform-origin: center center;
		will-change: transform, opacity;
		box-shadow: 0 18px 46px rgba(0, 0, 0, 0.45);
	}

	.detail-morph-proxy.has-fluid-wave {
		overflow: visible;
		border-radius: 0;
		box-shadow: none;
	}

	.detail-morph-proxy :global(.fd-image-wrap.detail-morph-fd-image) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.detail-morph-proxy.is-rounded {
		border-radius: var(--proxy-radius, 18px);
	}

	.detail-morph-proxy img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 40%;
	}
</style>
