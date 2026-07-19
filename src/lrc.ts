import * as fs from "node:fs";
import * as path from "node:path";
import { Song, LrcLine } from "./song.js";

export interface LrcMetadata {
  artist: string;
  title: string;
  album: string;
  length: string;
}

export function parseLrcMetadata(filepath: string): LrcMetadata | null {
  if (!fs.existsSync(filepath)) return null;

  try {
    const content = fs.readFileSync(filepath, "utf-8");
    const metadata: LrcMetadata = { artist: "", title: "", album: "", length: "" };

    for (const line of content.split("\n")) {
      if (line.startsWith("[ar:")) metadata.artist = line.slice(4, -1);
      else if (line.startsWith("[ti:")) metadata.title = line.slice(4, -1);
      else if (line.startsWith("[al:")) metadata.album = line.slice(4, -1);
      else if (line.startsWith("[length:")) metadata.length = line.slice(8, -1);
      else if (/^\[\d{2}:\d{2}\.\d{2,3}\]/.test(line)) break; // Stop at timestamp line
    }

    return metadata;
  } catch {
    return null;
  }
}

export function lrcMetadataMatches(metadata: LrcMetadata, song: Song): boolean {
  const totalSeconds = Math.floor((song.duration || 0) / 1000);
  const songLength = totalSeconds > 0
    ? `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`
    : "";

  return (
    metadata.artist === song.artist &&
    metadata.title === song.title &&
    metadata.album === song.album &&
    (songLength === "" || metadata.length === songLength)
  );
}

export function genLrc(song: Song, outdir = "", filename = "", force = false): boolean {
  let lyrics = song.subtitles;
  if (!lyrics) {
    console.warn("Synced lyrics not found, using unsynced lyrics...");
    lyrics = song.lyrics;
    if (!lyrics) {
      console.warn("Unsynced lyrics not found");
      return false;
    }
  }

  const fn = filename || slugify(song.toString());
  const filepath = path.join(outdir, fn) + ".lrc";

  // Check if file exists and metadata matches
  if (!force) {
    const existing = parseLrcMetadata(filepath);
    if (existing && lrcMetadataMatches(existing, song)) {
      console.info(`Skipping ${fn}.lrc - metadata matches`);
      return true;
    }
  }

  console.info("Formatting lyrics");

  const tags: string[] = [
    "[by:fashni]",
    `[ar:${song.artist}]`,
    `[ti:${song.title}]`,
  ];

  if (song.album) {
    tags.push(`[al:${song.album}]`);
  }

  if (song.duration) {
    const totalSeconds = Math.floor(song.duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    tags.push(`[length:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`);
  }

  const lrcLines = lyrics.map(
    (line: LrcLine) =>
      `[${String(line.minutes).padStart(2, "0")}:${String(line.seconds).padStart(2, "0")}.${String(line.hundredths).padStart(2, "0")}]${line.text}`
  );

  const content = [...tags, ...lrcLines].join("\n") + "\n";

  fs.writeFileSync(filepath, content, "utf-8");
  console.log(`Lyrics saved: ${filepath}`);
  return true;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\w\s()'-]/g, "")
    .replace(/[-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}
