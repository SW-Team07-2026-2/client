/**
 * 전역 싱글톤 BGM 매니저 (Svelte 5 Runes)
 * - 페이지가 바뀌거나 OAuth 리다이렉트(카카오 로그인 등)로 재진입해도 재생 상태를 유지합니다.
 * - 여러 페이지의 FdBgmPlayer 버튼들이 모두 동일한 재생 상태를 실시간 공유합니다.
 */

const STORAGE_KEY_BGM = 'indig_bgm_state';

interface PersistedBgmState {
	isPlaying: boolean;
	currentTime: number;
	src: string;
	volume: number;
	loop: boolean;
	updatedAt: number;
}

class BgmManager {
	/** 현재 재생 중 여부 (모든 버튼이 반응형으로 감지, 기본값: 재생) */
	isPlaying = $state(true);

	/** 볼륨 (0.0 ~ 1.0) */
	volume = $state(0.5);

	/** 반복 재생 여부 */
	loop = $state(true);

	/** 현재 재생 중인 음원 경로 */
	src = $state('/audio/bgm.mp3');

	/** 전역 단일 HTMLAudioElement 인스턴스 */
	private audio: HTMLAudioElement | null = null;

	/** 페이지 언로드(리다이렉트 등) 중 발생하는 브라우저 pause 이벤트 무시용 플래그 */
	private isUnloading = false;

	/** 리다이렉트 직후 브라우저 자동재생 정책으로 대기 중인지 여부 */
	private pendingAutoplayResume = false;

	/** 복원할 재생 위치 (초) */
	private pendingCurrentTime: number | null = null;

	/** 사용자 인터랙션 시 재생 재개 리스너 해제 함수 */
	private removeResumeListeners: (() => void) | null = null;

	constructor() {
		if (typeof window !== 'undefined') {
			this.setupLifecycleListeners();
			this.restoreState();
		}
	}

	private setupLifecycleListeners() {
		const handleUnload = () => {
			this.isUnloading = true;
			this.saveState();
		};

		window.addEventListener('beforeunload', handleUnload);
		window.addEventListener('pagehide', handleUnload);
		window.addEventListener('pageshow', (e) => {
			this.isUnloading = false;
			if (e.persisted) {
				this.restoreState();
			}
		});
	}

	private saveState() {
		if (typeof window === 'undefined') return;
		try {
			const currentTime =
				this.audio && Number.isFinite(this.audio.currentTime) && this.audio.currentTime > 0
					? this.audio.currentTime
					: (this.pendingCurrentTime ?? 0);

			const state: PersistedBgmState = {
				isPlaying: this.isPlaying,
				currentTime,
				src: this.src,
				volume: this.volume,
				loop: this.loop,
				updatedAt: Date.now()
			};
			sessionStorage.setItem(STORAGE_KEY_BGM, JSON.stringify(state));
		} catch {
			// sessionStorage 접근 불가 환경 무시
		}
	}

	private restoreState() {
		if (typeof window === 'undefined') return;
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY_BGM);
			if (!raw) {
				// 첫 진입 시에도 기본값(재생)으로 시작
				this.isPlaying = true;
				this.resumeFromSavedState();
				return;
			}

			const saved = JSON.parse(raw) as Partial<PersistedBgmState>;
			if (typeof saved.src === 'string' && saved.src) {
				this.src = saved.src;
			}
			if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) {
				this.volume = Math.max(0, Math.min(1, saved.volume));
			}
			if (typeof saved.loop === 'boolean') {
				this.loop = saved.loop;
			}
			if (typeof saved.currentTime === 'number' && Number.isFinite(saved.currentTime) && saved.currentTime > 0) {
				this.pendingCurrentTime = saved.currentTime;
			}

			if (saved.isPlaying === false) {
				this.isPlaying = false;
			} else {
				// 컴포넌트 마운트 시점부터 BGM 버튼이 활성(재생 중) 상태를 유지하도록 즉시 반영
				this.isPlaying = true;
				this.resumeFromSavedState();
			}
		} catch {
			// 파싱 실패 시에도 기본값(재생) 유지
			this.isPlaying = true;
			this.resumeFromSavedState();
		}
	}

	private resumeFromSavedState() {
		const a = this.getAudio();
		if (!a) return;

		this.applyPendingCurrentTime(a);

		const promise = a.play();
		if (promise !== undefined) {
			promise
				.then(() => {
					this.pendingAutoplayResume = false;
					this.clearResumeListeners();
					this.isPlaying = true;
					this.saveState();
				})
				.catch(() => {
					// OAuth 리다이렉트 직후 브라우저 자동재생 정책에 의해 보류된 경우:
					// 버튼 UI 상태(isPlaying = true)는 그대로 유지하고 첫 상호작용 시 즉시 이어서 재생
					this.pendingAutoplayResume = true;
					this.isPlaying = true;
					this.attachResumeListeners();
				});
		}
	}

	private applyPendingCurrentTime(a: HTMLAudioElement) {
		if (this.pendingCurrentTime === null || this.pendingCurrentTime <= 0) return;
		const targetTime = this.pendingCurrentTime;

		const setTime = () => {
			try {
				if (a.duration && Number.isFinite(a.duration)) {
					a.currentTime = targetTime % a.duration;
				} else {
					a.currentTime = targetTime;
				}
				this.pendingCurrentTime = null;
			} catch {
				// 메타데이터 로드 전이면 loadedmetadata에서 재시도
			}
		};

		if (a.readyState >= 1) {
			setTime();
		} else {
			a.addEventListener('loadedmetadata', setTime, { once: true });
		}
	}

	private attachResumeListeners() {
		if (typeof window === 'undefined' || this.removeResumeListeners) return;

		const onInteract = (e: Event) => {
			if (!this.pendingAutoplayResume || !this.isPlaying) {
				this.clearResumeListeners();
				return;
			}

			// 사용자가 BGM 버튼 자체를 눌러 정지시키려는 경우에는 해당 버튼의 toggle 핸들러에 위임
			const target = e.target as Element | null;
			if (target?.closest?.('.bgm-player-wrap')) {
				this.clearResumeListeners();
				return;
			}

			const a = this.getAudio();
			if (a && a.paused && this.isPlaying) {
				this.applyPendingCurrentTime(a);
				const promise = a.play();
				if (promise !== undefined) {
					promise
						.then(() => {
							this.pendingAutoplayResume = false;
							this.clearResumeListeners();
							this.isPlaying = true;
							this.saveState();
						})
						.catch(() => {
							// pointerdown이 제스처로 인정되지 않는 모바일 브라우저에서는 click / touchend 에서 재시도
							if (this.isPlaying) {
								this.pendingAutoplayResume = true;
							}
						});
					return;
				}
			}

			this.pendingAutoplayResume = false;
			this.clearResumeListeners();
		};

		window.addEventListener('pointerdown', onInteract, { capture: true, passive: true });
		window.addEventListener('click', onInteract, { capture: true, passive: true });
		window.addEventListener('touchend', onInteract, { capture: true, passive: true });
		window.addEventListener('keydown', onInteract, { capture: true, passive: true });

		this.removeResumeListeners = () => {
			window.removeEventListener('pointerdown', onInteract, { capture: true });
			window.removeEventListener('click', onInteract, { capture: true });
			window.removeEventListener('touchend', onInteract, { capture: true });
			window.removeEventListener('keydown', onInteract, { capture: true });
			this.removeResumeListeners = null;
		};
	}

	private clearResumeListeners() {
		if (this.removeResumeListeners) {
			this.removeResumeListeners();
		}
	}

	private getAudio(): HTMLAudioElement | null {
		if (typeof window === 'undefined') return null;

		if (!this.audio) {
			this.audio = new Audio(this.src);
			this.audio.loop = this.loop;
			this.audio.volume = this.volume;
			this.audio.preload = 'auto';

			this.audio.addEventListener('play', () => {
				this.pendingAutoplayResume = false;
				this.clearResumeListeners();
				this.isPlaying = true;
				this.saveState();
			});

			this.audio.addEventListener('pause', () => {
				// 페이지 리다이렉트/언로드 중이거나 자동재생 재개 대기 중일 때는 상태를 끄지 않음
				if (this.isUnloading || this.pendingAutoplayResume) {
					return;
				}
				// 음원이 끝까지 도달하여 반복 재생(loop)되는 과도 상태에서는 isPlaying을 끄지 않음
				if (this.audio && this.audio.ended && this.loop) {
					return;
				}
				this.isPlaying = false;
				this.saveState();
			});

			this.audio.addEventListener('ended', () => {
				// 브라우저의 네이티브 loop 가 동작하지 않고 ended 가 발생했을 때의 무한 반복 보장
				if (this.loop && this.audio) {
					this.audio.currentTime = 0;
					this.audio.play().catch((err) => {
						console.warn('[BgmManager] 반복 재생 실패:', err);
						this.isPlaying = false;
						this.saveState();
					});
				} else {
					this.isPlaying = false;
					this.saveState();
				}
			});

			this.audio.addEventListener('timeupdate', () => {
				// 브라우저에 따라 ended 이벤트가 생략되고 일시정지되는 경우 대비
				if (this.loop && this.audio && this.audio.duration > 0) {
					if (this.audio.currentTime >= this.audio.duration - 0.08 && this.audio.paused && this.isPlaying) {
						this.audio.currentTime = 0;
						this.audio.play().catch(() => {});
					}
				}
				if (this.isPlaying && !this.isUnloading) {
					this.saveState();
				}
			});

			this.audio.addEventListener('error', (e) => {
				console.warn('[BgmManager] 오디오 로드/재생 에러:', e);
				this.isPlaying = false;
				this.saveState();
			});
		}

		return this.audio;
	}

	/** 재생 */
	play(newSrc?: string) {
		if (newSrc && newSrc !== this.src) {
			this.setSrc(newSrc);
		}

		const a = this.getAudio();
		if (!a) return;

		this.pendingAutoplayResume = false;
		this.clearResumeListeners();

		// 재생 시 루프 설정 재확인 및 상태 즉시 반영
		a.loop = this.loop;
		this.applyPendingCurrentTime(a);
		this.isPlaying = true;
		this.saveState();

		const promise = a.play();
		if (promise !== undefined) {
			promise.catch((err) => {
				console.warn('[BgmManager] 브라우저 자동재생 정책 등으로 재생이 차단됨:', err);
				this.isPlaying = false;
				this.saveState();
			});
		}
	}

	/** 일시정지 */
	pause() {
		this.pendingAutoplayResume = false;
		this.clearResumeListeners();
		this.isPlaying = false;
		this.saveState();

		const a = this.getAudio();
		if (a) {
			a.pause();
		}
	}

	/** 재생/정지 토글 */
	toggle(newSrc?: string) {
		if (this.isPlaying) {
			this.pause();
		} else {
			this.play(newSrc);
		}
	}

	/** 볼륨 변경 (0.0 ~ 1.0) */
	setVolume(v: number) {
		this.volume = Math.max(0, Math.min(1, v));
		if (this.audio) {
			this.audio.volume = this.volume;
		}
		this.saveState();
	}

	/** 반복 재생 여부 변경 */
	setLoop(l: boolean) {
		this.loop = l;
		if (this.audio) {
			this.audio.loop = l;
		}
		this.saveState();
	}

	/** 음원 변경 */
	setSrc(newSrc: string) {
		if (this.src === newSrc) return;
		this.src = newSrc;
		this.pendingCurrentTime = 0;

		if (this.audio) {
			const wasPlaying = this.isPlaying;
			this.audio.src = newSrc;
			this.audio.loop = this.loop;
			this.audio.load();
			if (wasPlaying) {
				this.play();
			}
		}
		this.saveState();
	}
}

/** 싱글톤 인스턴스 export */
export const bgm = new BgmManager();

