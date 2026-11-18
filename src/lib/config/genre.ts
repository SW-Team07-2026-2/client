/**
 * 백엔드 공식 Genre Enum (catalog · concert 공통 · 23개)
 * - API 파라미터로 전송할 때는 `value`(Enum 코드)를, 화면 표시에는 `label`(한국어)을 사용합니다.
 * - 출처: docs/Backend_share/v2_API_명세서.md §12
 */
export const GENRES = [
	{ value: 'INDIE_ROCK', label: '인디 록' },
	{ value: 'ALTERNATIVE', label: '얼터너티브' },
	{ value: 'GARAGE', label: '개러지' },
	{ value: 'PUNK', label: '펑크' },
	{ value: 'HARDCORE', label: '하드코어' },
	{ value: 'EMO', label: '이모' },
	{ value: 'METAL', label: '메탈' },
	{ value: 'POST_ROCK', label: '포스트 록' },
	{ value: 'SHOEGAZE', label: '슈게이즈' },
	{ value: 'PSYCHEDELIC', label: '사이키델릭' },
	{ value: 'INDIE_POP', label: '인디 팝' },
	{ value: 'DREAM_POP', label: '드림 팝' },
	{ value: 'SYNTH_POP', label: '신스 팝' },
	{ value: 'CITY_POP', label: '시티 팝' },
	{ value: 'FOLK', label: '포크' },
	{ value: 'ELECTRONIC', label: '일렉트로닉' },
	{ value: 'RNB_SOUL', label: 'R&B/소울' },
	{ value: 'HIPHOP', label: '힙합' },
	{ value: 'JAZZ', label: '재즈' },
	{ value: 'BLUES', label: '블루스' },
	{ value: 'FUNK', label: '펑크(Funk)' },
	{ value: 'SKA_REGGAE', label: '스카/레게' },
	{ value: 'ETC', label: '기타' }
] as const;

export type GenreCode = (typeof GENRES)[number]['value'];
export type GenreLabel = (typeof GENRES)[number]['label'];
export type GenreOption = (typeof GENRES)[number];

/** API Enum 값 -> 한국어 라벨 조회 맵 */
export const GENRE_LABELS: Record<GenreCode, GenreLabel> = Object.fromEntries(
	GENRES.map((item) => [item.value, item.label])
) as Record<GenreCode, GenreLabel>;

/** 유효한 Genre Enum 코드인지 확인하는 타입 가드 */
export function isGenreCode(value: string): value is GenreCode {
	return Object.prototype.hasOwnProperty.call(GENRE_LABELS, value);
}

/** Genre Enum 값을 한국어 라벨로 변환 (목록 외 값이면 원본 반환) */
export function getGenreLabel(code: string): string {
	return isGenreCode(code) ? GENRE_LABELS[code] : code;
}
