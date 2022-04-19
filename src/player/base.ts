import {Howl, Howler} from 'howler';
import {PlayerState, usePlayerStore} from "@/store/player";
import { isArray, shuffle, throttle, DebouncedFunc } from 'lodash-es';
import { scrobble, getTrackDetail } from "@api/music";
import { TrackSource } from "@/types";
import { Store } from "pinia";
import {isRef, reactive} from "vue";


export class Player {
    howler: null | Howl;
    track: TrackSource | null;
    volume: number;
    currentTime: number;
    playing: boolean;
    playingList: {
        id?: string | number,
        list: TrackSource[],
    };
    isCurrentFm: boolean;
    stageMusicURL: string | null;
    store: Store;
    _updateCurrentTime: DebouncedFunc<(currentTime?: number) => void>;
    constructor() {
        this.store = usePlayerStore();
        this.howler = null;

        const { track, playing, volume, currentTime, playingList, isCurrentFm } = this.store.$state as PlayerState;
        this.track = track;
        this.volume = volume;
        this.currentTime = currentTime;
        this.playing = playing;
        this.playingList = playingList;
        this.isCurrentFm = isCurrentFm;
        this.stageMusicURL = null;
        this._updateCurrentTime = throttle(this.updateCurrentTime, 1000);

        this.init();
    }
    init() {
        console.log('player init success', this.store);
        this.initStoreEvent();
    }
    shuffle() {
        const list = shuffle(this.playingList?.list);
        // this.store.$patch('music/updatePlayingList', {
        //     list,
        // });
    }
    async updatePlayList(data: {id?: string | number, list: TrackSource[], album?: { id: string | number }, tracks?: TrackSource[], songs?: TrackSource[] }) {
        let list, id;
        const isAlbum = !!data.album;
        if (isArray(data)) {
            list = data;
        } else if (isAlbum) {
            list = data.songs;
            id = data.album?.id;
        } else {
            list = data.tracks;
            id = data.id;
        }
        this.store.$patch({
            playingList: {
                list,
                id,
            },
        });
        this.playingList.list = list as TrackSource[];
        this.playingList.id = id;
        return list?.[0];
    }
    initStoreEvent() {
        this.store.$subscribe((mutation, state) => {

            console.log('player store mutation', mutation, state);
            const { type, events } = mutation;
            const { playing, volume, playingList, isCurrentFm } = state as PlayerState;
            if (type === 'direct') {
                if (events.key === 'playing') {
                    if (playing) {
                        this._play()
                    } else {
                        this._pause()
                    }
                }
                if (events.key === 'volume') {
                    this.volume = volume;
                }
                if (events.key === 'playingList') {
                    this.updatePlayList(playingList);
                }
                if (events.key === 'isCurrentFm') {
                    this.isCurrentFm = isCurrentFm;
                }
            }
            if (mutation.type === 'patch object') {
                // console.log('mutation', mutation);
                // const { playing, isCurrentFm, volume } = mutation.payload;
                // if (playing) {
                //     this._play();
                // } else {
                //     this._pause();
                // }

                // this.isCurrentFm = !!isCurrentFm;
                // if (volume !== undefined) {
                //     this.volume = volume;
                // }
            }
        });
    }
    async getTrack(id: string | number) {
        try {
            const track = await getTrackDetail(id);
                if (track.url) {
                    return {
                        track,
                        url: track.url,
                        from: 'online',
                    };
                }
        } catch (e) {
            console.log(e);
        }
    }
    async updatePlayerTrack(id: string | number, autoplay = true, resetProgress = true) {
        if (!id) return;
        const { loadingTrack, track, fmTrack, isCurrentFm  } = this.store;
        this.store.$state.loadingTrack = true;
        const { track: trackInfo, url, from } = await this.getTrack(id);
        if (url) {
            this.store.$state.track = trackInfo;
            if (isCurrentFm) {
                this.store.$state.fmTrack = trackInfo
            }
            if (resetProgress) {
                this.updateCurrentTime(0);
            }
            this.track = trackInfo;
            Howler.unload();
            this.howler = null;
            this.howler = this.initSound(url);
            this.initMediaSession(trackInfo);
            if (resetProgress) {
                this.setSeek(0);
            } else {
                this.setSeek(this.currentTime);
            }
            if (autoplay) {
                this._play();
                this.setScrobble(this.track, this.howler.seek(), false);
            }
            // if (from === 'online' && cacheLimit) {
            //     // 延迟请求buffer缓存 防止阻塞后面播放的url请求
            //     await sleep(500);
            //     playerIDB.cacheTrack(trackInfo, cacheLimit);
            // }
        } else {
            // window?.app?.$toast.warning(`${trackInfo.name} 暂不可用, 自动播放下一曲`);
            // await sleep(1000);
            // this.next();
        }
    }
    initSound(src: string) {
        Howler.autoUnlock = false;
        Howler.usingWebAudio = true;
        Howler.volume(this.volume);
        const sound = new Howl({
            src: [src],
            html5: true,
            preload: 'metadata',
            format: ['mp3', 'flac'],
            onplay: () => {
                requestAnimationFrame(this.step.bind(this));
            },
            onplayerror: (id, e) => {
                console.log(id, e);
            },
            onseek: () => {
                // Start updating the progress of the track.
                requestAnimationFrame(this.step.bind(this));
            },
            onload: () => {
                this.trackLoaded();
                const { name, ar = [] } = this.track;
                const artists = ar.map((a) => a.name).join('&');
                document.title = `💿 ${name} - ${artists}`;
                this.fixDuration();
            },
            onloaderror: (e) => {
                console.log(e);
                this.trackLoaded();
                window?.app?.$toast.error('歌曲加载失败');
            },
        });
        sound.once('end', this.endCb.bind(this));
        sound.seek(0);
        return sound;
    }
    // 修正歌曲时长，当实际获取的音源时长，与网易返回的音源时长相差超过1s, 则修正为实际的音源时长
    fixDuration() {
        const factDuration = this.howler?.duration() * 1000;
        const trackDuration = this.track?.dt ?? 0;
        const offset = factDuration - trackDuration;
        if (offset > 1000 || offset < -1000) {
            console.debug(
                `netease返回的歌曲长度: ${this.track.dt}， 歌曲实际长度: ${
                    this.howler?.duration() * 1000
                }， 偏差大小: ${offset}，修正`,
            );
            // this.store.commit('music/updateDuration', factDuration);
        }
    }
    trackLoaded() {
        this.store.$state.loadingTrack = false;
    }
    _pause() {
        this.howler?.pause();
        this.playing = false;
    }
    _play() {
        this.howler?.play();
        this.playing = true;
    }
    play() {
        this.store.$state.playing = true;
    }
    pause() {
        this.store.$state.playing = false;
    }
    togglePlay() {
        this.store.$state.playing = !this.store.$state.playing;
    }
    next() {
        if (this.nextTrackId()) {
            this.updatePlayerTrack(this.nextTrackId());
        } else {
            this._pause();
        }
    }
    prev() {
        this.updatePlayerTrack(this.prevTrackId());
    }
    nextTrackId() {
        if (this.isCurrentFm) {
            return this.store.getters['music/nextFmTrackId'];
        } else {
            return this.store.getters['music/nextTrackId'];
        }
    }
    prevTrackId() {
        return this.store.getters['music/prevTrackId'];
    }
    updateCurrentTime(this:Player, val: number) {
        const current = val ?? Math.ceil(this.howler?.seek());
        this.currentTime = current;
        this.store.$state.currentTime = current;
    }
    setSeek(val) {
        this.howler.seek(val);
        this._updateCurrentTime(val);
    }
    step() {
        if (this.howler.playing()) {
            this._updateCurrentTime();
            requestAnimationFrame(this.step.bind(this));
        }
    }
    endCb() {
        // todo update 听歌记录
        this.next();
        this.setScrobble(this.track, 0, true);
    }
    setScrobble(this: Player, track: TrackSource, time, played = false) {
        const { id, dt } = track;
        const sourceid = this.playingList.id;
        if (played) {
            time = +dt / 1000;
        }
        if (time) {
            console.log('歌曲打卡', this.track?.name, Math.ceil(time), played);
            scrobble({
                id,
                sourceid,
                time: Math.ceil(time),
            });
        }
    }
    initMediaSession(track: TrackSource) {
        // https://developers.google.com/web/updates/2017/02/media-session
        if ('mediaSession' in navigator) {
            const { ar: artist = [], al: album = {}, name: title } = track;
            /* global MediaMetadata */
            navigator.mediaSession.metadata = new MediaMetadata({
                title,
                artist: artist.map((a) => a.name).join('&'),
                album: album.name,
                artwork: [
                    {
                        src: album.picUrl ?? '',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                ],
            });
            [
                ['play', this.togglePlay],
                ['pause', this.togglePlay],
                ['previoustrack', this.prev],
                ['nexttrack', this.next],
            ].map(([name, fn]) =>
                navigator.mediaSession.setActionHandler(name, fn.bind(this)),
            );
        }
    }
}

