/**
 * 전역 싱글톤 BGM 매니저 (Svelte 5 Runes)
 * - 페이지가 바뀌어도 오디오가 끊기지 않고 연속 재생됩니다.
 * - 여러 페이지의 FdBgmPlayer 버튼들이 모두 동일한 재생 상태를 실시간 공유합니다.
 */

class BgmManager {
	/** 현재 재생 중 여부 (모든 버튼이 반응형으로 감지) */
	isPlaying = $state(false);

	/** 볼륨 (0.0 ~ 1.0) */
	volume = $state(0.5);

	/** 반복 재생 여부 */
	loop = $state(true);

	/** 현재 재생 중인 음원 경로 */
	src = $state('/audio/bgm.mp3');

	/** 전역 단일 HTMLAudioElement 인스턴스 */
	private audio: HTMLAudioElement | null = null;

	private getAudio(): HTMLAudioElement | null {
		if (typeof window === 'undefined') return null;

		if (!this.audio) {
			this.audio = new Audio(this.src);
			this.audio.loop = this.loop;
			this.audio.volume = this.volume;
			this.audio.preload = 'auto';

			this.audio.addEventListener('play', () => {
				this.isPlaying = true;
			});

			this.audio.addEventListener('pause', () => {
				// 음원이 끝까지 도달하여 반복 재생(loop)되는 과도 상태에서는 isPlaying을 끄지 않음
				if (this.audio && this.audio.ended && this.loop) {
					return;
				}
				this.isPlaying = false;
			});

			this.audio.addEventListener('ended', () => {
				// 브라우저의 네이티브 loop 가 동작하지 않고 ended 가 발생했을 때의 무한 반복 보장
				if (this.loop && this.audio) {
					this.audio.currentTime = 0;
					this.audio.play().catch((err) => {
						console.warn('[BgmManager] 반복 재생 실패:', err);
						this.isPlaying = false;
					});
				} else {
					this.isPlaying = false;
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
			});

			this.audio.addEventListener('error', (e) => {
				console.warn('[BgmManager] 오디오 로드/재생 에러:', e);
				this.isPlaying = false;
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

		// 재생 시 루프 설정 재확인
		a.loop = this.loop;

		const promise = a.play();
		if (promise !== undefined) {
			promise.catch((err) => {
				console.warn('[BgmManager] 브라우저 자동재생 정책 등으로 재생이 차단됨:', err);
				this.isPlaying = false;
			});
		}
	}

	/** 일시정지 */
	pause() {
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
	}

	/** 반복 재생 여부 변경 */
	setLoop(l: boolean) {
		this.loop = l;
		if (this.audio) {
			this.audio.loop = l;
		}
	}

	/** 음원 변경 */
	setSrc(newSrc: string) {
		if (this.src === newSrc) return;
		this.src = newSrc;

		if (this.audio) {
			const wasPlaying = this.isPlaying;
			this.audio.src = newSrc;
			this.audio.loop = this.loop;
			this.audio.load();
			if (wasPlaying) {
				this.play();
			}
		}
	}
}

/** 싱글톤 인스턴스 export */
export const bgm = new BgmManager();

