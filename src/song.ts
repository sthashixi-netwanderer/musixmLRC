export interface LrcLine {
  text: string;
  minutes: number;
  seconds: number;
  hundredths: number;
}

export interface SongInfo {
  artist: string;
  title: string;
  album: string;
  uri: string;
  duration: number;
  hasSynced: boolean;
  hasUnsynced: boolean;
  isInstrumental: boolean;
  lyrics: LrcLine[] | null;
  subtitles: LrcLine[] | null;
  coverartUrl: string | null;
}

export interface MatcherTrackBody {
  track: {
    track_name: string;
    artist_name: string;
    album_name: string;
    track_length: number;
    has_subtitles: boolean;
    has_lyrics: boolean;
    instrumental: boolean;
    album_coverart_100x100: string;
    album_coverart_350x350: string;
    album_coverart_500x500: string;
    album_coverart_800x800: string;
  };
}

export interface LyricsBody {
  lyrics: {
    lyrics_body: string;
    restricted: boolean;
  };
}

export interface SubtitleBody {
  subtitle_list: Array<{
    subtitle: {
      subtitle_body: string;
    };
  }>;
}

export class Song {
  artist: string;
  title: string;
  album: string;
  uri: string;
  duration: number;
  hasSynced: boolean;
  hasUnsynced: boolean;
  isInstrumental: boolean;
  lyrics: LrcLine[] | null;
  subtitles: LrcLine[] | null;
  coverartUrl: string | null;

  constructor(artist: string, title: string, album = "", uri = "") {
    this.artist = artist;
    this.title = title;
    this.album = album;
    this.uri = uri;
    this.duration = 0;
    this.hasSynced = false;
    this.hasUnsynced = false;
    this.isInstrumental = false;
    this.lyrics = null;
    this.subtitles = null;
    this.coverartUrl = null;
  }

  toString(): string {
    return `${this.artist} - ${this.title}`;
  }

  updateInfo(body: { "matcher.track.get": { message: { body: MatcherTrackBody | null } } }): void {
    const meta = body["matcher.track.get"].message.body;
    if (!meta) return;

    const coverartSizes = ["100x100", "350x350", "500x500", "800x800"] as const;
    const coverartUrls = coverartSizes
      .map(size => meta.track[`album_coverart_${size}` as keyof typeof meta.track] as string)
      .filter(Boolean);

    this.coverartUrl = coverartUrls.length > 0 ? coverartUrls[coverartUrls.length - 1] : null;
    this.title = meta.track.track_name;
    this.artist = meta.track.artist_name;
    this.album = meta.track.album_name;
    this.duration = meta.track.track_length * 1000;
    this.hasSynced = meta.track.has_subtitles;
    this.hasUnsynced = meta.track.has_lyrics;
    this.isInstrumental = meta.track.instrumental;
  }
}
