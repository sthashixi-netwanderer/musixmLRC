import { Song, LrcLine, MatcherTrackBody, LyricsBody, SubtitleBody } from "./song.js";

export interface MacroCalls {
  "matcher.track.get": {
    message: {
      header: { status_code: number; hint?: string };
      body: MatcherTrackBody | null;
    };
  };
  "track.lyrics.get": {
    message: {
      header: { status_code: number };
      body: LyricsBody | null;
    };
  };
  "track.subtitles.get": {
    message: {
      header: { status_code: number };
      body: SubtitleBody | null;
    };
  };
}

export class Musixmatch {
  private static readonly BASE_URL =
    "https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&namespace=lyrics_richsynched&subtitle_format=mxm&app_id=web-desktop-app-v1.0&";
  private static readonly TOKEN_URL =
    "https://apic-desktop.musixmatch.com/ws/1.1/token.get?app_id=web-desktop-app-v1.0";
  private static readonly HEADERS: Record<string, string> = {
    authority: "apic-desktop.musixmatch.com",
    cookie: "x-mxm-token-guid=",
  };

  private token: string;

  constructor(token?: string) {
    this.token = token || "";
  }

  setToken(token: string): void {
    this.token = token;
  }

  async getToken(): Promise<string> {
    if (this.token) return this.token;

    try {
      const response = await fetch(Musixmatch.TOKEN_URL, { headers: Musixmatch.HEADERS });
      const data = await response.json() as {
        message: {
          header: { status_code: number; hint?: string };
          body: { user_token?: string };
        };
      };

      const statusCode = data.message.header.status_code;
      if (statusCode !== 200) {
        const hint = data.message.header.hint || "unknown";
        if (hint === "captcha") {
          console.error("Rate limited by Musixmatch (captcha required). Try again later or provide a token with --token.");
        } else {
          console.error(`Failed to fetch token: status ${statusCode} (${hint})`);
        }
        return "";
      }

      this.token = data.message.body.user_token || "";
      if (this.token) {
        console.info("Fetched fresh token from Musixmatch");
      }
      return this.token;
    } catch (e) {
      console.error(`Failed to fetch token: ${e}`);
      return "";
    }
  }

  async findLyrics(song: Song): Promise<MacroCalls | null> {
    if (!this.token) {
      await this.getToken();
      if (!this.token) return null;
    }
    const durr = song.duration ? song.duration / 1000 : "";
    const params = new URLSearchParams({
      q_album: song.album,
      q_artist: song.artist,
      q_artists: song.artist,
      q_track: song.title,
      track_spotify_id: song.uri,
      q_duration: String(durr),
      f_subtitle_length: durr ? String(Math.floor(durr as number)) : "",
      usertoken: this.token,
    });

    const url = Musixmatch.BASE_URL + params.toString();

    let response: Response;
    try {
      response = await fetch(url, { headers: Musixmatch.HEADERS });
    } catch (e) {
      console.error(`Request error: ${e}`);
      return null;
    }

    const r = await response.json() as {
      message: {
        header: { status_code: number; hint?: string };
        body: { macro_calls: MacroCalls };
      };
    };

    if (r.message.header.status_code !== 200 && r.message.header.hint === "renew") {
      console.error("Invalid token");
      return null;
    }

    const body = r.message.body.macro_calls;

    const trackStatus = body["matcher.track.get"].message.header.status_code;
    if (trackStatus !== 200) {
      if (trackStatus === 404) {
        console.info("Song not found.");
      } else if (trackStatus === 401) {
        console.warn("Timed out. Change the token or wait a few minutes before trying again.");
      } else {
        console.error(`Requested error: ${JSON.stringify(body["matcher.track.get"].message.header)}`);
      }
      return null;
    }

    const lyricsBody = body["track.lyrics.get"].message.body;
    if (lyricsBody && lyricsBody.lyrics.restricted) {
      console.info("Restricted lyrics.");
      return null;
    }

    return body;
  }

  static getUnsynced(song: Song, body: MacroCalls): boolean {
    if (song.isInstrumental) {
      song.lyrics = [{ text: "♪ Instrumental ♪", minutes: 0, seconds: 0, hundredths: 0 }];
    } else if (song.hasUnsynced) {
      const lyricsBody = body["track.lyrics.get"].message.body;
      if (!lyricsBody) return false;

      const lyricsText = lyricsBody.lyrics.lyrics_body;
      if (lyricsText) {
        song.lyrics = lyricsText
          .split("\n")
          .filter(line => line.length > 0)
          .map(line => ({ text: line, minutes: 0, seconds: 0, hundredths: 0 }));
      } else {
        song.lyrics = [{ text: "", minutes: 0, seconds: 0, hundredths: 0 }];
      }
    } else {
      return false;
    }
    return true;
  }

  static getSynced(song: Song, body: MacroCalls): boolean {
    if (song.isInstrumental) {
      song.subtitles = [{ text: "♪ Instrumental ♪", minutes: 0, seconds: 0, hundredths: 0 }];
    } else if (song.hasSynced) {
      const subtitleBody = body["track.subtitles.get"].message.body;
      if (!subtitleBody) return false;

      const subtitle = subtitleBody.subtitle_list[0]?.subtitle;
      if (subtitle) {
        const parsed = JSON.parse(subtitle.subtitle_body) as Array<{
          text: string;
          time: { minutes: number; seconds: number; hundredths: number };
        }>;
        song.subtitles = parsed.map(line => ({
          text: line.text || "♪",
          minutes: line.time.minutes,
          seconds: line.time.seconds,
          hundredths: line.time.hundredths,
        }));
      } else {
        song.subtitles = [{ text: "", minutes: 0, seconds: 0, hundredths: 0 }];
      }
    } else {
      return false;
    }
    return true;
  }
}
