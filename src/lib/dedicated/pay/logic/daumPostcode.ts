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
}

interface DaumPostcodeConstructor {
	new (options: {
		oncomplete: (data: DaumPostcodeRawData) => void;
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

/**
 * Daum 우편번호 검색 팝업을 열고, 사용자가 주소를 선택하면 `{ zonecode, address }`를 반환합니다.
 * 선택 없이 팝업을 닫으면 `null`을 반환합니다.
 */
export async function openDaumPostcode(): Promise<DaumPostcodeResult | null> {
	const Postcode = await loadDaumPostcodeSdk();
	return new Promise<DaumPostcodeResult | null>((resolve) => {
		let settled = false;
		const finish = (result: DaumPostcodeResult | null) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};

		new Postcode({
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
		}).open();
	});
}
