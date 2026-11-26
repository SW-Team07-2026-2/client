/** 결제 · 장바구니 도메인 설정 상수 */

/** 토스페이먼츠 SDK v2 스크립트 주소 */
export const TOSS_PAYMENTS_SDK_URL = 'https://js.tosspayments.com/v2/standard';

/** Daum(카카오) 우편번호 검색 서비스 v2 스크립트 주소 */
export const DAUM_POSTCODE_SDK_URL =
	'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

/** 토스페이먼츠 클라이언트 키 (공개 가능 키, .env의 VITE_TOSS_CLIENT_KEY) */
export const TOSS_CLIENT_KEY: string =
	(import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined)?.trim() ?? '';

/** 체크아웃 선택 상품 · 주문 임시 저장용 sessionStorage 키 */
export const PAY_CHECKOUT_DRAFT_STORAGE_KEY = 'indig_pay_checkout_draft_v1';

/** 장바구니 옵션당 최대 수량 */
export const CART_MAX_QTY_PER_OPTION = 10;
