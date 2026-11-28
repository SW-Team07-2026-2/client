<script lang="ts">
	interface Props {
		/** 서버에서 발급한 입장 QR 토큰 문자열 (가공 없이 그대로 인코딩) */
		token: string;
		/** QR 캔버스 크기(px) */
		size?: number;
	}

	let { token, size = 196 }: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let renderError = $state(false);

	$effect(() => {
		const el = canvasEl;
		const currentToken = token;
		const currentSize = size;
		if (!el || !currentToken) return;

		let cancelled = false;
		renderError = false;

		void import('qrcode')
			.then((QRCode) => {
				if (cancelled) return;
				return QRCode.toCanvas(el, currentToken, {
					width: currentSize,
					margin: 2,
					errorCorrectionLevel: 'M',
					color: {
						dark: '#0b0c10',
						light: '#ffffff'
					}
				});
			})
			.catch((err) => {
				if (cancelled) return;
				console.error('Failed to render entry QR canvas:', err);
				renderError = true;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<!-- 브라우저 로컬 캔버스 기반 입장 QR 렌더러 (외부 QR API 전송 금지) -->
<div class="qr-frame" style:width="{size + 16}px" style:height="{size + 16}px">
	{#if renderError}
		<p class="qr-fallback">QR을 그리지 못했습니다.</p>
	{:else}
		<canvas
			bind:this={canvasEl}
			class="qr-canvas"
			width={size}
			height={size}
			aria-label="공연 입장 QR 코드"
		></canvas>
	{/if}
</div>

<style>
	.qr-frame {
		padding: 8px;
		border-radius: 14px;
		background: var(--white);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px color-mix(in srgb, var(--bg) 45%, transparent);
		flex-shrink: 0;
	}

	.qr-canvas {
		display: block;
		border-radius: 6px;
	}

	.qr-fallback {
		margin: 0;
		font-size: 0.78rem;
		color: var(--bg);
		text-align: center;
	}
</style>
