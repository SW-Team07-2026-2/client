import { createSpring, prefersReducedMotion, stepSpring, type SpringState } from '#lib/common/type/spring';

interface FallingLetter {
	el: HTMLSpanElement;
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	vr: number;
	age: number;
	opacity: number;
}

export interface LetterLimitMotionTargets {
	getInput: () => HTMLTextAreaElement | HTMLInputElement | undefined;
	getMirror: () => HTMLDivElement | undefined;
	getFillCircle: () => SVGCircleElement | undefined;
	getMeterSvg: () => SVGSVGElement | undefined;
	getCountEl: () => HTMLSpanElement | undefined;
	getSendWrap: () => HTMLDivElement | undefined;
	getPileEl: () => HTMLDivElement | undefined;
}

const MAX_FALLING_LETTERS = 48;

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

/**
 * 공용 Letter Limit UI 물리·스프링 모션 컨트롤러 (순수 UI 애니메이션)
 * - 글자 수 제한 초과 시 끝에서 잘린 글자가 튕겨 나와 중력·회전으로 화면 아래 멀리 떨어져 사라집니다.
 * - 원형 미터 링(일반 모드), 카운트 팝, 초과 시 좌우 흔들림(shake), 버튼 프레스 스프링을 하나의 rAF 루프로 구동합니다.
 */
export function createLetterLimitMotion(targets: LetterLimitMotionTargets) {
	const F: SpringState = createSpring(0, 280, 22);
	const CP: SpringState = createSpring(1, 520, 16);
	const SH: SpringState = createSpring(0, 700, 12);
	const PP: SpringState = createSpring(1, 520, 16);

	const springs = [F, CP, SH, PP];

	let letters: FallingLetter[] = [];
	let prevLen = 0;
	let rafId = 0;
	let lastNow = 0;
	let destroyed = false;

	function tuneForReducedMotion() {
		if (!prefersReducedMotion()) return;
		for (const s of springs) {
			s.c = 2 * Math.sqrt(s.k);
		}
	}

	function measureEndOfText(text: string): [number, number] {
		const mirror = targets.getMirror();
		const pile = targets.getPileEl();
		const input = targets.getInput();
		if (!mirror || !pile) return [40, 24];

		mirror.textContent = text;
		const marker = document.createElement('span');
		marker.textContent = '\u200b';
		mirror.appendChild(marker);

		const pileRect = pile.getBoundingClientRect();
		const markerRect = marker.getBoundingClientRect();
		const scrollTop = input && 'scrollTop' in input ? input.scrollTop : 0;
		const scrollLeft = input && 'scrollLeft' in input ? input.scrollLeft : 0;
		const x = markerRect.left - pileRect.left - scrollLeft;
		const y = markerRect.top + markerRect.height * 0.5 - pileRect.top - scrollTop;
		return [x, y];
	}

	function drop(chars: string, clampedText: string) {
		if (destroyed) return;
		const reduced = prefersReducedMotion();
		if (!reduced) {
			const pile = targets.getPileEl();
			if (pile) {
				const [x, y] = measureEndOfText(clampedText);
				let idx = 0;
				for (const ch of [...chars]) {
					if (!ch.trim()) continue;
					const el = document.createElement('span');
					el.className = 'll-falling-char';
					el.textContent = ch;
					pile.appendChild(el);
					letters.push({
						el,
						x: x + 4 + idx * 9,
						y,
						vx: -50 + Math.random() * 170,
						vy: -170 - Math.random() * 120,
						r: 0,
						vr: (Math.random() - 0.5) * 760,
						age: 0,
						opacity: 1
					});
					idx += 1;
				}
				while (letters.length > MAX_FALLING_LETTERS) {
					const oldest = letters.shift();
					oldest?.el.remove();
				}
			}
			SH.v += 34;
			CP.x = 1.25;
		}
		wake();
	}

	function syncLength(nextLen: number, maxLength: number) {
		if (destroyed) return;
		const limit = Math.max(1, maxLength);
		const was = prevLen;
		prevLen = nextLen;

		if (nextLen !== was && !prefersReducedMotion()) {
			CP.x = Math.max(CP.x, 1.12);
		}

		F.t = clamp(nextLen / limit, 0, 1);

		if (prefersReducedMotion()) {
			F.x = F.t;
			F.v = 0;
			CP.x = 1;
			CP.v = 0;
			SH.x = 0;
			SH.v = 0;
			PP.x = 1;
			PP.v = 0;
			render();
			return;
		}
		wake();
	}

	function triggerSendPress() {
		if (destroyed || prefersReducedMotion()) return;
		PP.x = 0.9;
		wake();
	}

	function hasActiveWork(): boolean {
		for (const s of springs) {
			if (Math.abs(s.x - s.t) > 0.002 || Math.abs(s.v) > 0.005) return true;
		}
		return letters.length > 0;
	}

	function stepAll(dt: number) {
		tuneForReducedMotion();
		const pile = targets.getPileEl();
		const viewportHeight = pile ? pile.getBoundingClientRect().height : 900;
		const vanishY = viewportHeight + 60;
		const sub = 4;
		const subDt = dt / sub;

		for (let k = 0; k < sub; k++) {
			for (const s of springs) {
				stepSpring(s, subDt);
			}
			for (const l of letters) {
				l.age += subDt;
				l.vy += 1900 * subDt;
				l.x += l.vx * subDt;
				l.y += l.vy * subDt;
				l.r += l.vr * subDt;

				// 낙하하면서 화면 하단 가까워질수록 자연스럽게 옅어짐
				if (l.age > 0.45) {
					l.opacity = clamp(1 - (l.age - 0.45) / 0.85, 0, 1);
				}
			}
		}

		letters = letters.filter((l) => {
			if (l.y > vanishY || l.opacity <= 0.01) {
				l.el.remove();
				return false;
			}
			return true;
		});
	}

	function render() {
		const fill = targets.getFillCircle();
		if (fill) {
			fill.style.strokeDashoffset = (1 - clamp(F.x, 0, 1)).toFixed(4);
		}
		const sh = SH.x * 0.5;
		const countEl = targets.getCountEl();
		if (countEl) {
			countEl.style.transform = `translateX(${sh.toFixed(2)}px) scale(${CP.x.toFixed(4)})`;
		}
		const meterSvg = targets.getMeterSvg();
		if (meterSvg) {
			meterSvg.style.transform = `translateX(${sh.toFixed(2)}px) rotate(-90deg)`;
		}
		const sendWrap = targets.getSendWrap();
		if (sendWrap) {
			sendWrap.style.transform = `scale(${PP.x.toFixed(4)})`;
		}
		for (const l of letters) {
			l.el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0) rotate(${l.r.toFixed(1)}deg)`;
			l.el.style.opacity = l.opacity.toFixed(3);
		}
	}

	function tickFrame(now: number) {
		rafId = 0;
		if (destroyed) return;
		const dt = lastNow ? Math.min((now - lastNow) / 1000, 1 / 30) : 1 / 60;
		lastNow = now;

		stepAll(dt);
		render();

		if (hasActiveWork()) {
			rafId = requestAnimationFrame(tickFrame);
		} else {
			lastNow = 0;
		}
	}

	function wake() {
		if (destroyed || rafId || typeof requestAnimationFrame === 'undefined') return;
		lastNow = 0;
		rafId = requestAnimationFrame(tickFrame);
	}

	function destroy() {
		destroyed = true;
		if (rafId && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		for (const l of letters) {
			l.el.remove();
		}
		letters = [];
	}

	return {
		drop,
		syncLength,
		triggerSendPress,
		render,
		destroy
	};
}
