/**
 * DOM 요소를 SVG `<foreignObject>`로 직렬화해 고해상도 Canvas 스냅샷으로 래스터화합니다.
 * - Svelte 스코프 CSS와 CSS 변수(`var(--surface)` 등)가 SVG 내부에서도 정확히 보이도록
 *   계산된 스타일(computedStyle)을 복제 트리에 인라인 복사합니다.
 */
const STYLE_PROPS_TO_COPY: readonly string[] = [
	'box-sizing',
	'display',
	'position',
	'top',
	'right',
	'bottom',
	'left',
	'width',
	'height',
	'min-width',
	'min-height',
	'max-width',
	'max-height',
	'margin-top',
	'margin-right',
	'margin-bottom',
	'margin-left',
	'padding-top',
	'padding-right',
	'padding-bottom',
	'padding-left',
	'flex-direction',
	'flex-wrap',
	'flex-grow',
	'flex-shrink',
	'flex-basis',
	'align-items',
	'align-self',
	'justify-content',
	'justify-items',
	'gap',
	'row-gap',
	'column-gap',
	'grid-template-columns',
	'grid-template-rows',
	'grid-column',
	'grid-row',
	'grid-area',
	'color',
	'background-color',
	'background-image',
	'border-top-width',
	'border-right-width',
	'border-bottom-width',
	'border-left-width',
	'border-top-style',
	'border-right-style',
	'border-bottom-style',
	'border-left-style',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'border-top-left-radius',
	'border-top-right-radius',
	'border-bottom-right-radius',
	'border-bottom-left-radius',
	'font-family',
	'font-size',
	'font-weight',
	'font-style',
	'font-variant-numeric',
	'line-height',
	'letter-spacing',
	'text-align',
	'text-decoration',
	'white-space',
	'word-break',
	'overflow',
	'overflow-x',
	'overflow-y',
	'text-overflow',
	'opacity',
	'box-shadow',
	'transform',
	'fill',
	'stroke',
	'stroke-width',
	'stroke-linecap',
	'stroke-linejoin'
];

function copyComputedStylesTree(source: Element, target: Element): void {
	if (typeof window === 'undefined') return;
	const cs = window.getComputedStyle(source);
	const targetEl = target as HTMLElement | SVGElement;

	if (targetEl.style) {
		for (const prop of STYLE_PROPS_TO_COPY) {
			const val = cs.getPropertyValue(prop);
			if (val) {
				targetEl.style.setProperty(prop, val);
			}
		}
		targetEl.style.setProperty('visibility', 'visible');
	}

	const srcChildren = source.children;
	const dstChildren = target.children;
	const len = Math.min(srcChildren.length, dstChildren.length);
	for (let i = 0; i < len; i++) {
		copyComputedStylesTree(srcChildren[i], dstChildren[i]);
	}
}

export async function captureElementToCanvas(
	element: HTMLElement,
	width: number,
	height: number,
	dpr = 1
): Promise<HTMLCanvasElement | null> {
	if (typeof window === 'undefined' || width <= 0 || height <= 0) return null;

	try {
		const clone = element.cloneNode(true) as HTMLElement;
		copyComputedStylesTree(element, clone);

		// 루트 복제 노드를 지정 크기에 정확히 맞춤
		clone.style.position = 'static';
		clone.style.margin = '0';
		clone.style.width = `${width}px`;
		clone.style.height = `${height}px`;
		clone.style.opacity = '1';
		clone.style.visibility = 'visible';
		clone.style.transform = 'none';

		const serializer = new XMLSerializer();
		const xhtml = serializer.serializeToString(clone);
		const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">${xhtml}</div></foreignObject></svg>`;
		const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.decoding = 'async';
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error('SVG snapshot load failed'));
			image.src = dataUrl;
		});

		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width * dpr));
		canvas.height = Math.max(1, Math.round(height * dpr));
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;

		ctx.scale(dpr, dpr);
		ctx.drawImage(img, 0, 0, width, height);
		return canvas;
	} catch {
		return null;
	}
}
