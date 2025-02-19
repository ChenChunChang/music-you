interface Quality {
  br: number // 码率
  fid: number
  size: number // 大小
  sr: number // 采样率
  vd: number
}
export interface Track {
  id: number
  name: string
  duration?: number
  dt?: number
  ar?: Artist[]
  artists?: Artist[]
  al?: Album
  album?: Album
  h?: Quality
  l?: Quality
  m?: Quality
  sq?: Quality
  hr?: Quality
  meta?: {
    url: null | string
    br: null | number
    type: string
    encodeType: string
  }
  lyric?: {
    tlyric: {
      lyric: string
    }
    lrc: {
      lyric: string
    }
  }
}
export interface MV {
  artist?: Artist
  artists?: Artist[]
  id: number
  name: string
  copywriter: string
  picUrl?: string
  cover?: string
  playCount: number
  type: number
  canDislike: boolean
  publishTime?: string
  briefDesc?: string
}

export interface Artist {
  id: number
  name: string
  img1v1Url?: string
  cover?: string
  picUrl?: string
  albumSize: number
  musicSize?: number
  mvSize?: number
  briefDesc: string
  rank?: {
    rank: number
    type: number
  }
  transNames: string[]
  followed: boolean
  alias: string[]
}

export interface Album {
  tracks: Track[]
  id: number
  name: string
  picUrl: string
  coverImgUrl?: string
  artist: Artist
  artists: Artist[]
  description: string
  company: string
  companyId: number
  publishTime: number
  size: number
  songs: Track[]
  subType: string
  type: string
  isSub?: boolean
  subTime?: number
  alias: string[]
}

export interface Playlist {
  id: number
  name: string
  tracks: Track[]
  trackIds: {
    id: number
  }[]
  trackCount: number
  backgroundCoverUrl?: string
  coverImgUrl: string
  picUrl?: string
  createTime: number
  publishTime?: number
  creator: Record<string, any>
  description: string
  englishTitle?: string
  playCount: number
  subscribed: boolean
  subscribedCount?: number
  tags?: string[]
  titleImageUrl: string
  specialType: number
  updateFrequency?: string
  userId?: number
  privacy?: number
  officialPlaylistType?: string
}

export interface Account {
  profile: {
    userName: string
    userId: number
    userType: number
    vipType: number
    nickname: string
    signature: string
    avatarUrl: string
  }
  account?: {
    vipType: string
    id: number
    userName: string
  }
  token?: string
}

export interface Tracks {
  id?: string
  list: Track[]
}
