import { mount, unmount } from 'svelte';
import { pushState } from '$app/navigation';
import { ArrowLeftIcon, ChevronLeftIcon } from '#lib/common/design/icon';
import { isMobile } from '#lib/common/logic/isMobile.svelte';
import { DAUM_POSTCODE_SDK_URL } from '#lib/config/pay';

export interface DaumPostcodeResult {
	zonecode: string;
	address: string;
}

interface DaumPostcodeRawData {
	zonecode: string;
	address: string;
	roadAddress: string;
	jibunAddress: string;
	userSelectedType: 'R' | 'J';
	bname: string;
	buildingName: string;
	apartment: 'Y' | 'N';
}

interface DaumPostcodeInstance {
	open: () => void;
	embed: (element: HTMLElement, options?: { q?: string; autoClose?: boolean }) => void;
}

interface DaumPostcodeConstructor {
	new (options: {
		width?: string | number;
		height?: string | number;
		theme?: Record<string, string>;
		oncomplete: (data: DaumPostcodeRawData) => void;
		onresize?: (size: { width: number; height: number }) => void;
		onclose?: (state: 'FORCE_CLOSE' | 'COMPLETE_CLOSE') => void;
	}): DaumPostcodeInstance;
}

declare global {
	interface Window {
		daum?: {
			Postcode?: DaumPostcodeConstructor;
		};
	}
}

let postcodeLoadPromise: Promise<DaumPostcodeConstructor> | null = null;
let activePostcodeCloser: (() => void) | null = null;

/** 열려 있는 인앱 주소 검색 모달을 즉시 닫습니다. */
export function closeDaumPostcode(): void {
	activePostcodeCloser?.();
}

/**
 * Daum(카카오) 우편번호 검색 스크립트를 필요 시점에만 동적 로드합니다.
 */
function loadDaumPostcodeSdk(): Promise<DaumPostcodeConstructor> {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('브라우저 환경에서만 주소 검색을 사용할 수 있습니다.'));
	}

	if (typeof window.daum?.Postcode === 'function') {
		return Promise.resolve(window.daum.Postcode);
	}

	if (postcodeLoadPromise) return postcodeLoadPromise;

	postcodeLoadPromise = new Promise<DaumPostcodeConstructor>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${DAUM_POSTCODE_SDK_URL}"]`
		);

		const onLoad = () => {
			if (typeof window.daum?.Postcode === 'function') {
				resolve(window.daum.Postcode);
			} else {
				postcodeLoadPromise = null;
				reject(new Error('Daum 우편번호 서비스를 초기화하지 못했습니다.'));
			}
		};

		const onError = () => {
			postcodeLoadPromise = null;
			reject(new Error('Daum 우편번호 스크립트를 불러오지 못했습니다.'));
		};

		if (existing) {
			existing.addEventListener('load', onLoad, { once: true });
			existing.addEventListener('error', onError, { once: true });
			return;
		}

		const script = document.createElement('script');
		script.src = DAUM_POSTCODE_SDK_URL;
		script.async = true;
		script.addEventListener('load', onLoad, { once: true });
		script.addEventListener('error', onError, { once: true });
		document.head.appendChild(script);
	});

	return postcodeLoadPromise;
}

function formatPostcodeAddress(data: DaumPostcodeRawData): string {
	if (data.userSelectedType === 'R') {
		let addr = data.roadAddress || data.address || '';
		const extras: string[] = [];
		if (data.bname && /[동|로|가]$/g.test(data.bname)) {
			extras.push(data.bname);
		}
		if (data.buildingName && data.apartment === 'Y') {
			extras.push(data.buildingName);
		}
		if (extras.length > 0) {
			addr += ` (${extras.join(', ')})`;
		}
		return addr.trim();
	}
	return (data.jibunAddress || data.roadAddress || data.address || '').trim();
}

/** CSS 변수 값을 Daum Postcode 테마가 지원하는 6자리 #RRGGBB 형식으로 정규화 */
function readHex6CssVar(name: string, fallback: string): string {
	const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	if (/^#[0-9a-f]{6}$/i.test(val)) return val;
	if (/^#[0-9a-f]{8}$/i.test(val)) return val.slice(0, 7);
	return fallback;
}

/** 브라우저 기본(크로스-오리진 iframe 내부) 수직 스크롤바 너비를 동적으로 측정 */
function getNativeScrollbarWidth(): number {
	const probe = document.createElement('div');
	Object.assign(probe.style, {
		position: 'fixed',
		top: '-9999px',
		left: '-9999px',
		width: '100px',
		height: '100px',
		overflowY: 'scroll',
		visibility: 'hidden',
		pointerEvents: 'none'
	});
	document.body.append(probe);
	const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
	probe.remove();
	return width;
}

/**
 * 화면 내부 인앱 레이어 모달로 Daum(카카오) 우편번호 검색을 임베드해 엽니다.
 * 사용자가 주소를 선택하면 `{ zonecode, address }`를 반환하고, 닫으면 `null`을 반환합니다.
 */
export async function openDaumPostcode(): Promise<DaumPostcodeResult | null> {
	const Postcode = await loadDaumPostcodeSdk();
	closeDaumPostcode();

	return new Promise<DaumPostcodeResult | null>((resolve) => {
		let settled = false;

		/* 배경 입력란에 남아 있던 모바일 포커스를 해제해 iframe 입력 충돌을 방지 */
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}

		const overlay = document.createElement('div');
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', '주소 검색');
		Object.assign(overlay.style, {
			position: 'fixed',
			inset: '0',
			zIndex: '10000',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: 'calc(3.75rem + env(safe-area-inset-top, 0px)) 1rem calc(1.25rem + env(safe-area-inset-bottom, 0px))',
			boxSizing: 'border-box'
		});

		/* backdrop-filter를 위젯의 조상이 아닌 형제 레이어로 분리 + 0px -> blur 부드러운 보간 */
		const scrim = document.createElement('div');
		Object.assign(scrim.style, {
			position: 'absolute',
			inset: '0',
			background: 'var(--glass-bg)',
			opacity: '0',
			transition:
				'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), -webkit-backdrop-filter 320ms cubic-bezier(0.22, 1, 0.36, 1), backdrop-filter 320ms cubic-bezier(0.22, 1, 0.36, 1)'
		});
		scrim.style.setProperty('-webkit-backdrop-filter', 'blur(0px) saturate(100%)');
		scrim.style.setProperty('backdrop-filter', 'blur(0px) saturate(100%)');

		/* 블러 배경 위에 검색 서비스 위젯만 단독 배치 */
		const embedStage = document.createElement('div');
		Object.assign(embedStage.style, {
			position: 'relative',
			zIndex: '1',
			width: 'min(480px, 100%)',
			height: 'min(590px, calc(100svh - 6.5rem))',
			maxHeight: 'calc(100dvh - 5.5rem)',
			boxSizing: 'border-box',
			borderRadius: '0',
			border: '1px solid var(--line)',
			overflow: 'hidden',
			colorScheme: 'dark',
			background: 'var(--surface)',
			boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
			opacity: '0',
			transform: 'translate3d(0, 14px, 0) scale(0.97)',
			transition:
				'opacity 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'
		});

		/* 화면 좌측 상단 심플 아이콘 전용 이전 화살표 버튼 (PC: ArrowLeftIcon, 모바일: ChevronLeftIcon) */
		const backBtn = document.createElement('button');
		backBtn.type = 'button';
		backBtn.setAttribute('aria-label', '이전');
		backBtn.title = '이전';
		Object.assign(backBtn.style, {
			position: 'absolute',
			top: 'max(1rem, env(safe-area-inset-top, 0px))',
			left: 'max(1rem, env(safe-area-inset-left, 0px))',
			zIndex: '2',
			width: '36px',
			height: '36px',
			padding: '0',
			border: 'none',
			background: 'transparent',
			color: 'var(--muted)',
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			cursor: 'pointer',
			opacity: '0',
			transform: 'translate3d(-6px, 0, 0)',
			transition:
				'opacity 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 280ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms ease'
		});

		const mobileMode = isMobile.current;
		const backIcon = mount(mobileMode ? ChevronLeftIcon : ArrowLeftIcon, {
			target: backBtn,
			props: {
				size: mobileMode ? 24 : 22,
				animateOnHover: true
			}
		});

		backBtn.addEventListener('pointerenter', () => {
			backBtn.style.color = 'var(--white)';
		});
		backBtn.addEventListener('pointerleave', () => {
			backBtn.style.color = 'var(--muted)';
		});

		/* 크로스-오리진 iframe 자체 스크롤바(화이트 테마) 대신 부모 뷰포트에서 다크 스크롤바 렌더링 */
		const embedViewport = document.createElement('div');
		embedViewport.className = 'daum-postcode-viewport';
		Object.assign(embedViewport.style, {
			position: 'absolute',
			inset: '0',
			width: '100%',
			height: '100%',
			overflowY: 'auto',
			overflowX: 'hidden',
			overscrollBehavior: 'contain',
			background: 'var(--surface)'
		});

		const embedHost = document.createElement('div');
		Object.assign(embedHost.style, {
			width: '100%',
			minHeight: '100%',
			height: '100%',
			overflow: 'hidden',
			background: 'var(--surface)'
		});

		const applyNoScrollToIframes = () => {
			embedHost.querySelectorAll('iframe').forEach((iframe) => {
				if (iframe.getAttribute('scrolling') !== 'no') {
					iframe.setAttribute('scrolling', 'no');
				}
				iframe.style.overflow = 'hidden';
			});
		};
		const iframeObserver = new MutationObserver(applyNoScrollToIframes);
		iframeObserver.observe(embedHost, { childList: true, subtree: true });

		embedViewport.append(embedHost);
		embedStage.append(embedViewport);
		overlay.append(scrim, embedStage, backBtn);
		document.body.append(overlay);

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		/* 브라우저 뒤로가기 시 페이지(cart 등)로 이탈하지 않고 모달만 닫히도록 shallow history 엔트리 추가 */
		let pushedHistory = false;
		try {
			pushState('', { postcodeModalOpen: true });
			pushedHistory = true;
		} catch {
			pushedHistory = false;
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				finish(null);
			}
		};
		const onPopState = () => {
			finish(null, { skipHistoryBack: true });
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('popstate', onPopState);

		const closeCurrent = () => finish(null, { skipHistoryBack: true });
		activePostcodeCloser = closeCurrent;

		let clearTransformTimer: ReturnType<typeof setTimeout> | null = null;

		const finish = (
			result: DaumPostcodeResult | null,
			options?: { skipHistoryBack?: boolean }
		) => {
			if (settled) return;
			settled = true;
			if (clearTransformTimer) {
				clearTimeout(clearTransformTimer);
				clearTransformTimer = null;
			}
			iframeObserver.disconnect();
			if (activePostcodeCloser === closeCurrent) {
				activePostcodeCloser = null;
			}
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('popstate', onPopState);
			document.body.style.overflow = prevOverflow;

			scrim.style.opacity = '0';
			scrim.style.setProperty('-webkit-backdrop-filter', 'blur(0px) saturate(100%)');
			scrim.style.setProperty('backdrop-filter', 'blur(0px) saturate(100%)');
			embedStage.style.opacity = '0';
			embedStage.style.transform = 'translate3d(0, 10px, 0) scale(0.98)';
			backBtn.style.opacity = '0';
			backBtn.style.transform = 'translate3d(-6px, 0, 0)';

			setTimeout(() => {
				void unmount(backIcon);
				overlay.remove();
			}, 240);

			if (pushedHistory && !options?.skipHistoryBack) {
				pushedHistory = false;
				window.history.back();
			}

			resolve(result);
		};

		backBtn.addEventListener('click', () => finish(null));
		scrim.addEventListener('click', () => finish(null));

		/* 초기 페인트(blur 0px, opacity 0)를 강제 확정한 뒤 다음 프레임에 전환 시작 */
		void overlay.offsetHeight;
		requestAnimationFrame(() => {
			if (settled) return;
			scrim.style.opacity = '1';
			scrim.style.setProperty('-webkit-backdrop-filter', 'var(--glass-filter)');
			scrim.style.setProperty('backdrop-filter', 'var(--glass-filter)');
			embedStage.style.opacity = '1';
			embedStage.style.transform = 'translate3d(0, 0, 0) scale(1)';
			backBtn.style.opacity = '1';
			backBtn.style.transform = 'translate3d(0, 0, 0)';

			/* 등장 전환 종료 후 transform을 해제해 모바일 cross-origin iframe 내 키보드 입력/포커스 이슈를 방지 */
			clearTransformTimer = setTimeout(() => {
				if (!settled) {
					embedStage.style.transform = 'none';
				}
			}, 320);
		});

		const bgHex = readHex6CssVar('--surface-dim', '#191919');
		const surfaceHex = readHex6CssVar('--surface', '#1b1b1b');
		const fgHex = readHex6CssVar('--fg', '#f0f0f0');
		const whiteHex = readHex6CssVar('--white', '#ffffff');
		const lineHex = readHex6CssVar('--line', '#3b3b3b');
		const nativeScrollbarW = getNativeScrollbarWidth();

		new Postcode({
			width: '100%',
			height: '100%',
			theme: {
				bgColor: bgHex,
				searchBgColor: surfaceHex,
				contentBgColor: surfaceHex,
				pageBgColor: bgHex,
				textColor: fgHex,
				queryTextColor: whiteHex,
				postcodeTextColor: whiteHex,
				emphTextColor: whiteHex,
				outlineColor: lineHex
			},
			onresize: (size) => {
				const minH = embedViewport.clientHeight || 0;
				const hasOverflow = size.height > minH;
				embedHost.style.height = `${Math.max(size.height, minH)}px`;
				/* 크로스-오리진 중첩 iframe 내부의 기본 화이트 스크롤바 영역을 우측으로 밀어 클리핑 */
				embedHost.style.width =
					hasOverflow && nativeScrollbarW > 0 ? `calc(100% + ${nativeScrollbarW}px)` : '100%';
				applyNoScrollToIframes();
			},
			oncomplete: (data) => {
				finish({
					zonecode: (data.zonecode ?? '').trim(),
					address: formatPostcodeAddress(data)
				});
			},
			onclose: (state) => {
				if (state === 'FORCE_CLOSE') {
					finish(null);
				}
			}
		}).embed(embedHost, { autoClose: false });

		applyNoScrollToIframes();
	});
}
