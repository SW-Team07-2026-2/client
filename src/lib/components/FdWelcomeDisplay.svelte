<script lang="ts">
	import { tick } from 'svelte';
	import FdCheckButton from './FdCheckButton.svelte';
	import FdButton from './FdButton.svelte';
	import { FdWave } from '#lib/fluid';

	export interface ArtistItem {
		id: string;
		name: string;
		image: string;
		genre?: string;
		/** 해당 아티스트 클릭 시 추가될 연관 아티스트 ID 목록 */
		relatedIds?: string[];
	}

	interface Props {
		/** 초기 표시할 아티스트 목록 (미지정 시 내장 임시 데이터 사용) */
		initialArtists?: ArtistItem[];
		/** 양방향 바인딩 가능한 선택된 아티스트 ID 배열 */
		selectedIds?: string[];
		/** 선택 상태 변경 시 호출되는 콜백 */
		onChange?: (selectedArtists: ArtistItem[], selectedIds: string[]) => void;
		/** 백엔드 연동용: 특정 아티스트 클릭 시 연관 아티스트를 가져오는 함수 */
		onFetchRelated?: (artist: ArtistItem) => Promise<ArtistItem[]> | ArtistItem[];
		/** 백엔드 연동용: '더 추가하기' 클릭 시 추가 아티스트를 가져오는 함수 */
		onFetchMore?: (currentIds: string[]) => Promise<ArtistItem[]> | ArtistItem[];
		/** 추가 클래스 */
		class?: string;
	}

	/* ───────── FdWave 디자인 프리셋 (Hover vs Active 구분) ───────── */
	// Hover: 색 자체가 더 어둡고 물결 폭(waveAmp, layerGap)이 작음
	const HOVER_WAVE = new FdWave({
		layers: 1,
		layerGap: 2.5,
		waveAmp: 2.5,
		waveLength: 68,
		spin: 1.2,
		color: '#7f7f80'
	});

	// 선택(Checked): 밝은 톤의 뒤쪽 겹과 더 큰 물결 폭으로 구분
	const ACTIVE_WAVE = new FdWave({
		layers: 1,
		layerGap: 4.2,
		waveAmp: 4,
		waveLength: 70,
		spin: 1.75,
		color: '#a1a1aa'
	});

	/* ───────── 임시(Mock) 아티스트 배경 아트워크 (텍스트 없음) ───────── */
	function createArtistArtwork(bg1: string, bg2: string, accent: string, seed = 1): string {
		const cx = 65 + ((seed * 29) % 70);
		const cy = 55 + ((seed * 43) % 60);
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 200 200">
			<defs>
				<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="${bg1}"/>
					<stop offset="100%" stop-color="${bg2}"/>
				</linearGradient>
				<radialGradient id="r" cx="${cx}%" cy="${cy}%" r="75%">
					<stop offset="0%" stop-color="${accent}" stop-opacity="0.58"/>
					<stop offset="100%" stop-color="${bg2}" stop-opacity="0"/>
				</radialGradient>
			</defs>
			<rect width="200" height="200" fill="url(#g)"/>
			<circle cx="100" cy="100" r="100" fill="url(#r)"/>
			<circle cx="100" cy="78" r="26" fill="rgba(255,255,255,0.15)"/>
			<path d="M46 176 C46 130 154 130 154 176" fill="rgba(255,255,255,0.12)"/>
		</svg>`;
		return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
	}

	const MOCK_ARTIST_DB: Record<string, ArtistItem> = {
		illit: {
			id: 'illit',
			name: '아일릿',
			genre: 'K-POP',
			image: createArtistArtwork('#3b1f47', '#14131d', '#ff9ebb', 1),
			relatedIds: ['newjeans', 'aespa', 'rescene']
		},
		buzz: {
			id: 'buzz',
			name: '버즈',
			genre: '록 발라드',
			image: createArtistArtwork('#1e293b', '#0f131a', '#60a5fa', 2),
			relatedIds: ['izi', 'mc_the_max', 'yb']
		},
		day6: {
			id: 'day6',
			name: '데이식스',
			genre: '밴드',
			image: createArtistArtwork('#15352f', '#0d1715', '#34d399', 3),
			relatedIds: ['lucy', 'qwer', 'jannabi']
		},
		iu: {
			id: 'iu',
			name: '아이유',
			genre: '솔로/보컬',
			image: createArtistArtwork('#342048', '#14111d', '#c084fc', 4),
			relatedIds: ['taeyeon', 'akmu', 'bol4']
		},
		crush: {
			id: 'crush',
			name: '크러쉬',
			genre: 'R&B/소울',
			image: createArtistArtwork('#362819', '#14110e', '#fbbf24', 5),
			relatedIds: ['dean', 'zico', 'heize']
		},
		blackpink: {
			id: 'blackpink',
			name: '블랙핑크',
			genre: 'K-POP',
			image: createArtistArtwork('#42162b', '#140c11', '#f472b6', 6),
			relatedIds: ['babymonster', 'ive', 'le_sserafim']
		},
		silicagel: {
			id: 'silicagel',
			name: '실리카겔',
			genre: '인디/사이키델릭',
			image: createArtistArtwork('#182e3f', '#0c1117', '#38bdf8', 7),
			relatedIds: ['hyukoh', 'wave_to_earth', 'thornapple']
		},
		sung_si_kyung: {
			id: 'sung_si_kyung',
			name: '성시경',
			genre: '발라드',
			image: createArtistArtwork('#2e2927', '#121010', '#d6d3d1', 8),
			relatedIds: ['park_hyo_shin', 'kim_dong_ryul', 'paul_kim']
		},
		newjeans: {
			id: 'newjeans',
			name: '뉴진스',
			genre: 'K-POP',
			image: createArtistArtwork('#1d314d', '#0d1321', '#74c0fc', 9),
			relatedIds: ['ive', 'le_sserafim', 'kiss_of_life']
		},
		aespa: {
			id: 'aespa',
			name: '에스파',
			genre: 'K-POP',
			image: createArtistArtwork('#2f1f46', '#110d19', '#a78bfa', 10),
			relatedIds: ['ive', 'itzy', 'nmixx']
		},
		rescene: {
			id: 'rescene',
			name: '리센느',
			genre: 'K-POP',
			image: createArtistArtwork('#3d2233', '#140f13', '#f9a8d4', 11),
			relatedIds: ['fifty_fifty', 'triple_s', 'fromis_9']
		},
		ive: {
			id: 'ive',
			name: '아이브',
			genre: 'K-POP',
			image: createArtistArtwork('#421e32', '#140d12', '#fb7185', 12),
			relatedIds: ['le_sserafim', 'stayc', 'fromis_9']
		},
		le_sserafim: {
			id: 'le_sserafim',
			name: '르세라핌',
			genre: 'K-POP',
			image: createArtistArtwork('#252b3b', '#0e1015', '#93c5fd', 13),
			relatedIds: ['kiss_of_life', 'itzy', 'babymonster']
		},
		kiss_of_life: {
			id: 'kiss_of_life',
			name: '키스오브라이프',
			genre: 'K-POP',
			image: createArtistArtwork('#451624', '#170a0e', '#f43f5e', 14),
			relatedIds: ['babymonster', 'nmixx']
		},
		fifty_fifty: {
			id: 'fifty_fifty',
			name: '피프티피프티',
			genre: 'K-POP',
			image: createArtistArtwork('#3d2538', '#151014', '#f0abfc', 15),
			relatedIds: ['triple_s', 'stayc']
		},
		triple_s: {
			id: 'triple_s',
			name: '트리플에스',
			genre: 'K-POP',
			image: createArtistArtwork('#262b36', '#0d0f13', '#cbd5e1', 16),
			relatedIds: ['nmixx', 'fromis_9']
		},
		fromis_9: {
			id: 'fromis_9',
			name: '프로미스나인',
			genre: 'K-POP',
			image: createArtistArtwork('#40242c', '#140d10', '#fda4af', 17),
			relatedIds: ['stayc', 'qwer']
		},
		stayc: {
			id: 'stayc',
			name: '스테이씨',
			genre: 'K-POP',
			image: createArtistArtwork('#3b2142', '#120c14', '#e879f9', 18),
			relatedIds: ['itzy', 'nmixx']
		},
		itzy: {
			id: 'itzy',
			name: '있지',
			genre: 'K-POP',
			image: createArtistArtwork('#421e2b', '#140b0f', '#fb7185', 19),
			relatedIds: ['nmixx', 'babymonster']
		},
		nmixx: {
			id: 'nmixx',
			name: '엔믹스',
			genre: 'K-POP',
			image: createArtistArtwork('#1d3042', '#0d1218', '#67e8f9', 20),
			relatedIds: ['babymonster']
		},
		babymonster: {
			id: 'babymonster',
			name: '베이비몬스터',
			genre: 'K-POP',
			image: createArtistArtwork('#451620', '#14090c', '#f87171', 21),
			relatedIds: ['kiss_of_life', 'itzy']
		},
		izi: {
			id: 'izi',
			name: 'izi',
			genre: '록 발라드',
			image: createArtistArtwork('#282c3b', '#101218', '#94a3b8', 22),
			relatedIds: ['yarn', 'flower', 'mc_the_max']
		},
		mc_the_max: {
			id: 'mc_the_max',
			name: '엠씨더맥스',
			genre: '록 발라드',
			image: createArtistArtwork('#2b2b30', '#111113', '#a1a1aa', 23),
			relatedIds: ['sg_wannabe', 'park_hyo_shin', 'yb']
		},
		yb: {
			id: 'yb',
			name: 'YB',
			genre: '록 밴드',
			image: createArtistArtwork('#3b251a', '#140e0b', '#fb923c', 24),
			relatedIds: ['nell', 'jaurim']
		},
		yarn: {
			id: 'yarn',
			name: '얀',
			genre: '록 발라드',
			image: createArtistArtwork('#272b36', '#0e1014', '#cbd5e1', 25),
			relatedIds: ['flower']
		},
		flower: {
			id: 'flower',
			name: '플라워',
			genre: '록 발라드',
			image: createArtistArtwork('#36242b', '#130e10', '#fda4af', 26),
			relatedIds: ['yarn']
		},
		sg_wannabe: {
			id: 'sg_wannabe',
			name: 'SG워너비',
			genre: '발라드',
			image: createArtistArtwork('#362c20', '#120f0c', '#fcd34d', 27),
			relatedIds: ['davichi']
		},
		lucy: {
			id: 'lucy',
			name: '루시',
			genre: '밴드',
			image: createArtistArtwork('#1b3342', '#0b141a', '#60a5fa', 28),
			relatedIds: ['lacuna', 'touched', 'nerd_connection']
		},
		qwer: {
			id: 'qwer',
			name: 'QWER',
			genre: '밴드',
			image: createArtistArtwork('#3b203e', '#140c16', '#f472b6', 29),
			relatedIds: ['lucy', 'fromis_9', 'woodz']
		},
		jannabi: {
			id: 'jannabi',
			name: '잔나비',
			genre: '인디 밴드',
			image: createArtistArtwork('#3d2c1a', '#14100a', '#fbbf24', 30),
			relatedIds: ['hyukoh', '10cm', 'car_the_garden']
		},
		lacuna: {
			id: 'lacuna',
			name: '라쿠나',
			genre: '밴드',
			image: createArtistArtwork('#2c203f', '#100c17', '#c084fc', 31),
			relatedIds: ['thornapple', 'touched']
		},
		touched: {
			id: 'touched',
			name: '터치드',
			genre: '밴드',
			image: createArtistArtwork('#401d28', '#160b0f', '#fb7185', 32),
			relatedIds: ['nerd_connection', 'nell']
		},
		nerd_connection: {
			id: 'nerd_connection',
			name: '너드커넥션',
			genre: '밴드',
			image: createArtistArtwork('#21303b', '#0d1216', '#7dd3fc', 33),
			relatedIds: ['nell', 'thornapple']
		},
		taeyeon: {
			id: 'taeyeon',
			name: '태연',
			genre: '보컬/K-POP',
			image: createArtistArtwork('#332540', '#120e17', '#d8b4fe', 34),
			relatedIds: ['heize', 'davichi']
		},
		akmu: {
			id: 'akmu',
			name: '악뮤',
			genre: '듀오/포크팝',
			image: createArtistArtwork('#1f382d', '#0c1511', '#6ee7b7', 35),
			relatedIds: ['10cm', 'bol4', 'lee_mu_jin']
		},
		bol4: {
			id: 'bol4',
			name: '볼빨간사춘기',
			genre: '인디 팝',
			image: createArtistArtwork('#402630', '#160d10', '#f9a8d4', 36),
			relatedIds: ['10cm', 'paul_kim']
		},
		'10cm': {
			id: '10cm',
			name: '10CM',
			genre: '인디/어쿠스틱',
			image: createArtistArtwork('#382d20', '#14100c', '#fcd34d', 37),
			relatedIds: ['lee_mu_jin', 'car_the_garden']
		},
		dean: {
			id: 'dean',
			name: '딘',
			genre: 'R&B',
			image: createArtistArtwork('#22283b', '#0c0e14', '#818cf8', 38),
			relatedIds: ['colde', 'zico']
		},
		zico: {
			id: 'zico',
			name: '지코',
			genre: '힙합/랩',
			image: createArtistArtwork('#382d1a', '#14100a', '#facc15', 39),
			relatedIds: ['dean', 'heize']
		},
		heize: {
			id: 'heize',
			name: '헤이즈',
			genre: 'R&B/발라드',
			image: createArtistArtwork('#28283d', '#0f0f17', '#a5b4fc', 40),
			relatedIds: ['colde', 'paul_kim']
		},
		hyukoh: {
			id: 'hyukoh',
			name: '혁오',
			genre: '인디 밴드',
			image: createArtistArtwork('#332a27', '#120f0e', '#fdba74', 41),
			relatedIds: ['wave_to_earth', 'car_the_garden']
		},
		wave_to_earth: {
			id: 'wave_to_earth',
			name: '웨이브투어스',
			genre: '인디/재즈팝',
			image: createArtistArtwork('#1b323d', '#0b1418', '#38bdf8', 42),
			relatedIds: ['colde', 'hyukoh']
		},
		thornapple: {
			id: 'thornapple',
			name: '쏜애플',
			genre: '록 밴드',
			image: createArtistArtwork('#3d1c24', '#140a0c', '#f43f5e', 43),
			relatedIds: ['nell', 'jaurim']
		},
		nell: {
			id: 'nell',
			name: '넬',
			genre: '모던 록',
			image: createArtistArtwork('#232938', '#0d0f14', '#93c5fd', 44),
			relatedIds: ['jaurim', 'thornapple']
		},
		jaurim: {
			id: 'jaurim',
			name: '자우림',
			genre: '록 밴드',
			image: createArtistArtwork('#361f3b', '#130b14', '#e879f9', 45),
			relatedIds: ['nell']
		},
		park_hyo_shin: {
			id: 'park_hyo_shin',
			name: '박효신',
			genre: '발라드',
			image: createArtistArtwork('#2b2b30', '#101012', '#e4e4e7', 46),
			relatedIds: ['kim_dong_ryul', 'paul_kim']
		},
		kim_dong_ryul: {
			id: 'kim_dong_ryul',
			name: '김동률',
			genre: '발라드',
			image: createArtistArtwork('#302a22', '#12100d', '#fde68a', 47),
			relatedIds: ['park_hyo_shin']
		},
		paul_kim: {
			id: 'paul_kim',
			name: '폴킴',
			genre: '발라드/R&B',
			image: createArtistArtwork('#23302b', '#0d1210', '#86efac', 48),
			relatedIds: ['melomance', 'lee_mu_jin']
		},
		car_the_garden: {
			id: 'car_the_garden',
			name: '카더가든',
			genre: '인디/보컬',
			image: createArtistArtwork('#332721', '#120e0c', '#fdba74', 49),
			relatedIds: ['melomance', 'woodz']
		},
		woodz: {
			id: 'woodz',
			name: '우즈',
			genre: '록/올라운더',
			image: createArtistArtwork('#212c3f', '#0c1017', '#60a5fa', 50),
			relatedIds: ['colde', 'qwer']
		},
		colde: {
			id: 'colde',
			name: '콜드',
			genre: 'R&B/인디',
			image: createArtistArtwork('#262d38', '#0e1014', '#93c5fd', 51),
			relatedIds: ['wave_to_earth']
		},
		lee_mu_jin: {
			id: 'lee_mu_jin',
			name: '이무진',
			genre: '싱어송라이터',
			image: createArtistArtwork('#332d1f', '#12100b', '#fde047', 52),
			relatedIds: ['melomance']
		},
		melomance: {
			id: 'melomance',
			name: '멜로망스',
			genre: '발라드/인디',
			image: createArtistArtwork('#36262f', '#130e11', '#f9a8d4', 53),
			relatedIds: ['davichi']
		},
		davichi: {
			id: 'davichi',
			name: '다비치',
			genre: '발라드',
			image: createArtistArtwork('#302436', '#110d13', '#d8b4fe', 54),
			relatedIds: ['sg_wannabe']
		}
	};

	const DEFAULT_INITIAL_IDS = [
		'illit',
		'buzz',
		'day6',
		'iu',
		'crush',
		'blackpink',
		'silicagel',
		'sung_si_kyung'
	];

	const EXTRA_POOL_IDS = [
		'akmu',
		'jannabi',
		'newjeans',
		'aespa',
		'lucy',
		'qwer',
		'taeyeon',
		'zico',
		'hyukoh',
		'park_hyo_shin',
		'10cm',
		'ive',
		'le_sserafim',
		'yb',
		'mc_the_max',
		'wave_to_earth',
		'dean',
		'heize',
		'nell',
		'paul_kim',
		'woodz',
		'thornapple',
		'car_the_garden',
		'kiss_of_life',
		'rescene',
		'izi',
		'melomance'
	];

	let {
		initialArtists,
		selectedIds = $bindable<string[]>([]),
		onChange,
		onFetchRelated,
		onFetchMore,
		class: klass = ''
	}: Props = $props();

	const MORE_BTN_ID = '__more_btn__';

	let visibleArtists = $state<ArtistItem[]>(
		initialArtists && initialArtists.length > 0
			? [...initialArtists]
			: DEFAULT_INITIAL_IDS.map((id) => MOCK_ARTIST_DB[id]).filter(Boolean)
	);

	// 한 번 클릭해 연관 아티스트가 확장된 아티스트 ID 집합 (다시 눌러 취소해도 버튼이 사라지지 않음)
	let expandedSet = new Set<string>();
	let loadingId = $state<string | null>(null);

	let slotElements = new Map<string, HTMLElement>();

	function registerSlot(el: HTMLElement, id: string) {
		slotElements.set(id, el);
		return {
			update(newId: string) {
				if (newId !== id) {
					slotElements.delete(id);
					id = newId;
					slotElements.set(id, el);
				}
			},
			destroy() {
				slotElements.delete(id);
			}
		};
	}

	function notifyChange() {
		if (!onChange) return;
		const selectedItems = visibleArtists.filter((a) => selectedIds.includes(a.id));
		onChange(selectedItems, selectedIds);
	}

	/** 현재 화면의 모든 슬롯 중심 좌표를 기록 (FLIP 애니메이션용) */
	function capturePositions(): Map<string, { x: number; y: number }> {
		const map = new Map<string, { x: number; y: number }>();
		for (const [id, el] of slotElements.entries()) {
			const r = el.getBoundingClientRect();
			map.set(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
		}
		return map;
	}

	/**
	 * 새 아티스트가 추가될 때:
	 * - 새로 추가된 아티스트들은 클릭한 모체(originId) 중심에서 튀어나오듯 이동
	 * - 기존 아티스트들은 이전 위치에서 새 위치로 부드럽게 슬라이딩
	 */
	function playFlipAnimation(
		beforeMap: Map<string, { x: number; y: number }>,
		originId: string,
		newIds: Set<string>
	) {
		if (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}

		const originPos = beforeMap.get(originId);
		let newOrderIdx = 0;

		for (const [id, el] of slotElements.entries()) {
			const rect = el.getBoundingClientRect();
			const curX = rect.left + rect.width / 2;
			const curY = rect.top + rect.height / 2;

			if (newIds.has(id)) {
				if (!originPos) continue;
				const dx = originPos.x - curX;
				const dy = originPos.y - curY;
				const delay = newOrderIdx * 45;
				newOrderIdx++;

				el.animate(
					[
						{
							transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.35)`,
							opacity: 0
						},
						{
							transform: `translate3d(${dx * 0.15}px, ${dy * 0.15}px, 0) scale(1.04)`,
							opacity: 1,
							offset: 0.72
						},
						{
							transform: 'translate3d(0, 0, 0) scale(1)',
							opacity: 1
						}
					],
					{
						duration: 520,
						delay,
						easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
						fill: 'both'
					}
				);
			} else {
				const prev = beforeMap.get(id);
				if (!prev) continue;
				const dx = prev.x - curX;
				const dy = prev.y - curY;
				if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

				el.animate(
					[
						{ transform: `translate3d(${dx}px, ${dy}px, 0)` },
						{ transform: 'translate3d(0, 0, 0)' }
					],
					{
						duration: 460,
						easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
					}
				);
			}
		}
	}

	/** 아티스트 체크 상태 변경 핸들러 */
	async function handleArtistToggle(artist: ArtistItem, index: number, nextChecked: boolean) {
		if (!nextChecked) {
			// 선택 해제: 선택 목록에서만 제거하고 이미 늘어난 버튼들은 그대로 유지
			selectedIds = selectedIds.filter((id) => id !== artist.id);
			notifyChange();
			return;
		}

		// 새로 선택
		if (!selectedIds.includes(artist.id)) {
			selectedIds = [...selectedIds, artist.id];
			notifyChange();
		}

		// 이미 이전에 한 번 확장된 아티스트라면 연관 아티스트를 중복 추가하지 않음
		if (expandedSet.has(artist.id)) {
			return;
		}
		expandedSet.add(artist.id);

		let relatedList: ArtistItem[] = [];
		try {
			loadingId = artist.id;
			if (onFetchRelated) {
				relatedList = await onFetchRelated(artist);
			} else {
				const relIds = artist.relatedIds ?? MOCK_ARTIST_DB[artist.id]?.relatedIds ?? [];
				relatedList = relIds.map((id) => MOCK_ARTIST_DB[id]).filter(Boolean);
			}
		} finally {
			loadingId = null;
		}

		const existingIds = new Set(visibleArtists.map((a) => a.id));
		const newArtists = relatedList.filter((item) => item && !existingIds.has(item.id));

		if (newArtists.length === 0 && !onFetchRelated) {
			for (const poolId of EXTRA_POOL_IDS) {
				if (!existingIds.has(poolId) && MOCK_ARTIST_DB[poolId]) {
					newArtists.push(MOCK_ARTIST_DB[poolId]);
					existingIds.add(poolId);
					if (newArtists.length >= 2) break;
				}
			}
		}

		if (newArtists.length === 0) return;

		const beforeMap = capturePositions();
		const currentIdx = visibleArtists.findIndex((a) => a.id === artist.id);
		const insertIdx = currentIdx >= 0 ? currentIdx + 1 : index + 1;

		visibleArtists = [
			...visibleArtists.slice(0, insertIdx),
			...newArtists,
			...visibleArtists.slice(insertIdx)
		];

		await tick();
		playFlipAnimation(beforeMap, artist.id, new Set(newArtists.map((a) => a.id)));
	}

	/** 마지막 '더 추가하기' 버튼 클릭 핸들러 */
	async function handleAddMore() {
		const existingIds = new Set(visibleArtists.map((a) => a.id));
		let moreArtists: ArtistItem[] = [];

		if (onFetchMore) {
			loadingId = MORE_BTN_ID;
			try {
				const fetched = await onFetchMore(Array.from(existingIds));
				moreArtists = fetched.filter((a) => !existingIds.has(a.id));
			} finally {
				loadingId = null;
			}
		} else {
			for (const id of Object.keys(MOCK_ARTIST_DB)) {
				if (!existingIds.has(id)) {
					moreArtists.push(MOCK_ARTIST_DB[id]);
					existingIds.add(id);
					if (moreArtists.length >= 4) break;
				}
			}
			if (moreArtists.length === 0) {
				const extraNames = [
					['백예린', '#2f243d', '#f472b6'],
					['빈지노', '#38281a', '#fb923c'],
					['윤하', '#1b2b40', '#60a5fa'],
					['검정치마', '#2b2b30', '#e4e4e7'],
					['선우정아', '#3b1f2a', '#fb7185'],
					['새소년', '#1e3038', '#38bdf8'],
					['오혁', '#33291e', '#facc15'],
					['권진아', '#302433', '#d8b4fe']
				];
				for (let idx = 0; idx < extraNames.length; idx++) {
					const [name, c1, acc] = extraNames[idx];
					const customId = `extra_${name}`;
					if (!existingIds.has(customId)) {
						moreArtists.push({
							id: customId,
							name,
							image: createArtistArtwork(c1, '#101015', acc, 60 + idx)
						});
						existingIds.add(customId);
						if (moreArtists.length >= 4) break;
					}
				}
			}
		}

		if (moreArtists.length === 0) return;

		const beforeMap = capturePositions();
		visibleArtists = [...visibleArtists, ...moreArtists];

		await tick();
		playFlipAnimation(beforeMap, MORE_BTN_ID, new Set(moreArtists.map((a) => a.id)));
	}
</script>

<div class="fd-welcome-display {klass}">
	<div class="artist-flow" role="group" aria-label="관심 아티스트 선택 목록">
		{#each visibleArtists as artist, idx (artist.id)}
			{@const isSelected = selectedIds.includes(artist.id)}
			<div class="artist-slot" use:registerSlot={artist.id}>
				<FdCheckButton
					class="artist-check-btn"
					checked={isSelected}
					onchange={(next) => handleArtistToggle(artist, idx, next)}
					color="transparent"
					hoverColor="#9ca3af"
					pressColor="#71717a"
					activeColor="#ffffff"
					textColor="#ffffff"
					hoverWave={HOVER_WAVE}
					activeWave={ACTIVE_WAVE}
				>
					<span class="orb-box">
						<span class="img-wrap">
							<img src={artist.image} alt="" loading="lazy" draggable="false" />
							<span class="img-dim" aria-hidden="true"></span>
						</span>
						<span class="artist-name">{artist.name}</span>
					</span>
				</FdCheckButton>
			</div>
		{/each}

		<!-- 항상 마지막에 위치하는 '더 추가하기' 버튼 -->
		<div class="artist-slot" use:registerSlot={MORE_BTN_ID}>
			<FdButton
				class="artist-more-btn"
				onclick={handleAddMore}
				disabled={loadingId === MORE_BTN_ID}
				radius={999}
				color="transparent"
				hoverColor="#9ca3af"
				pressColor="#71717a"
				textColor="#ffffff"
				wave={HOVER_WAVE}
			>
				<span class="orb-box more-orb">
					<span class="img-wrap more-inner">
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="plus-icon">
							<path
								d="M12 6V18M6 12H18"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
					</span>
					<span class="artist-name more-label">더 추가하기</span>
				</span>
			</FdButton>
		</div>
	</div>
</div>

<style>
	.fd-welcome-display {
		--orb-size: 112px;
		width: 100%;
		padding: 24px 12px 32px;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	/* 가로로 늘어나다가 칸이 없으면 세로로 한 칸 내려가는 플로우 레이아웃 */
	.artist-flow {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 24px 22px;
		max-width: 980px;
		margin: 0 auto;
	}

	.artist-slot {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		will-change: transform, opacity;
	}

	/*
	 * FdCheckButton / FdButton 내부의 <button>이 정확히 정사각형(원형) 몸체 크기(--orb-size)를 갖도록 설정.
	 * 투명 border(--lq-i-inset) 여백은 음수 마진으로 상쇄해 플로우 간격을 일정하게 유지합니다.
	 */
	.artist-slot :global(.lq) {
		margin: calc(-1 * var(--lq-i-inset, 0px));
	}

	.artist-slot :global(button.artist-check-btn),
	.artist-slot :global(button.artist-more-btn) {
		box-sizing: content-box !important;
		width: var(--orb-size);
		height: var(--orb-size);
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.orb-box {
		position: relative;
		width: var(--orb-size);
		height: var(--orb-size);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	/*
	 * 아무 반응이 없는 기본 아티스트는 border 없이 원형 이미지만 깔끔하게 표시됩니다.
	 * Hover 시 살짝(0.95), 선택(Checked) 시 조금 더(0.90) 안쪽 이미지가 수축하여
	 * 뒤쪽 FdCheckButton 캔버스의 다중 겹 물결이 골짜기까지 가려지지 않고 선명하게 드러납니다.
	 */
	.img-wrap {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		overflow: hidden;
		background: #141418;
		border: none;
		box-shadow: none;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.img-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.artist-slot :global(.lq[data-hovered] .img-wrap img) {
		transform: scale(1.06);
	}

	.artist-slot :global(.lq[data-checked] .img-wrap) {
		transform: scale(0.9);
	}

	.artist-slot :global(.lq[data-hovered] .img-wrap) {
		transform: scale(0.95);
	}
	/* 이미지 정중앙 이름 가독성을 위한 다크닝 오버레이 */
	.img-dim {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			circle,
			rgba(7, 7, 9, 0.48) 0%,
			rgba(7, 7, 9, 0.28) 65%,
			rgba(7, 7, 9, 0.14) 100%
		);
	}

	/* 정중앙에 배치된 아티스트 이름 태그 */
	.artist-name {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 0 10px;
		box-sizing: border-box;
		text-align: center;
		font-size: 0.96rem;
		font-weight: 700;
		line-height: 1.2;
		color: rgba(255, 255, 255, 0.92);
		letter-spacing: -0.02em;
		word-break: keep-all;
		overflow-wrap: break-word;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.75);
	}

	.artist-slot :global(.lq[data-checked] .artist-name) {
		color: #ffffff;
		font-weight: 800;
	}

	/* '더 추가하기' 버튼 스타일 */
	.more-orb .more-inner {
		background: #14141a;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-bottom: 22px;
		box-sizing: border-box;
		color: rgba(255, 255, 255, 0.85);
		transition:
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			background-color 0.2s ease;
	}

	.artist-slot :global(.lq[data-hovered] .more-inner) {
		background: #1c1c24;
		color: #ffffff;
	}

	.plus-icon {
		width: 22px;
		height: 22px;
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.artist-slot :global(.lq[data-hovered] .plus-icon) {
		transform: rotate(90deg);
	}

	.more-label {
		padding-top: 24px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	/* 태블릿 & 모바일 반응형 */
	@media (max-width: 768px) {
		.fd-welcome-display {
			--orb-size: 96px;
		}
		.artist-flow {
			gap: 20px 18px;
		}
		.artist-name {
			font-size: 0.88rem;
		}
		.more-label {
			font-size: 0.75rem;
		}
	}

	@media (max-width: 480px) {
		.fd-welcome-display {
			--orb-size: 84px;
			padding: 18px 8px 26px;
		}
		.artist-flow {
			gap: 16px 14px;
		}
		.artist-name {
			font-size: 0.82rem;
			padding: 0 6px;
		}
		.plus-icon {
			width: 18px;
			height: 18px;
		}
		.more-label {
			font-size: 0.72rem;
			padding-top: 20px;
		}
	}
</style>
