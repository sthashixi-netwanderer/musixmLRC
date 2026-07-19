import * as fs from "node:fs";
import * as path from "node:path";
import { parseFile } from "music-metadata";
import { Song } from "./song.js";

export interface CliOptions {
  songs: string[];
  outdir: string;
  sleep: number;
  depth: number;
  update: boolean;
  bfs: boolean;
  quiet: boolean;
  debug: boolean;
  token?: string;
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    songs: [],
    outdir: "lyrics",
    sleep: 30,
    depth: 100,
    update: false,
    bfs: false,
    quiet: false,
    debug: false,
  };

  let i = 2; // skip node and script path
  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "-s":
      case "--song":
        while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          options.songs.push(args[++i]);
        }
        break;
      case "-o":
      case "--out":
        options.outdir = args[++i];
        break;
      case "-t":
      case "--sleep":
        options.sleep = parseInt(args[++i], 10);
        break;
      case "-d":
      case "--depth":
        options.depth = parseInt(args[++i], 10);
        break;
      case "-u":
      case "--update":
        options.update = true;
        break;
      case "--bfs":
        options.bfs = true;
        break;
      case "-q":
      case "--quiet":
        options.quiet = true;
        break;
      case "--debug":
        options.debug = true;
        break;
      case "--token":
        options.token = args[++i];
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      default:
        console.warn(`Unknown option: ${arg}`);
        break;
    }
    i++;
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: mxlrc [options]

Fetch synced lyrics (*.lrc file) from Musixmatch

Options:
  -s, --song <song>      song information in the format "artist,title", a text file
                         containing list of songs, or a directory containing the song files
  -o, --out <outdir>     output directory to save the .lrc file(s) (default: lyrics)
  -t, --sleep <sleep>    sleep time (seconds) between requests (default: 30)
  -d, --depth <depth>    maximum recursion depth for directory mode (default: 100)
  -u, --update           rewrite existing .lrc files in output directory
  --bfs                  use breadth-first search for directory scanning
  -q, --quiet            suppress logging output
  --debug                enable debug logging
  --token <token>        musixmatch token
  -h, --help             show this help message`);
}

export async function getSongs(songsInput: string[], depth: number, bfs: boolean, update = false): Promise<Song[]> {
  if (songsInput.length === 0) {
    console.error("No songs specified");
    return [];
  }

  const songs: Song[] = [];

  for (const songArg of songsInput) {
    if (isDirectory(songArg)) {
      const dirSongs = await parseDir(songArg, depth, bfs, update);
      songs.push(...dirSongs);
    } else if (isTextFile(songArg)) {
      const fileSongs = await parseFileList(songArg);
      songs.push(...fileSongs);
    } else {
      const parsed = parseInput(songArg);
      if (parsed) songs.push(parsed);
    }
  }

  return songs;
}

function parseInput(input: string): Song | null {
  const match = input.match(/^(.+?),\s*(.+)$/);
  if (!match) {
    console.warn(`Invalid format: "${input}". Use "artist,title"`);
    return null;
  }
  const [, artist, title] = match;
  return new Song(artist.trim(), title.trim());
}

async function parseFileList(filepath: string): Promise<Song[]> {
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const songs: Song[] = [];
  for (const line of lines) {
    const song = parseInput(line);
    if (song) songs.push(song);
  }
  return songs;
}

async function parseDir(dirpath: string, depth: number, bfs: boolean, update: boolean): Promise<Song[]> {
  const audioExtensions = new Set([".mp3", ".flac", ".ogg", ".wav", ".m4a", ".aac", ".wma", ".opus"]);
  const songs: Song[] = [];

  async function scanDir(dir: string, currentDepth: number): Promise<void> {
    if (currentDepth > depth) return;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    // BFS: directories first; DFS: files first (matching original Python behavior)
    items.sort((a, b) => {
      if (bfs) return a.isDirectory() === b.isDirectory() ? 0 : a.isDirectory() ? -1 : 1;
      return a.isDirectory() === b.isDirectory() ? 0 : a.isDirectory() ? 1 : -1;
    });

    const dirs: string[] = [];

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      // Skip .lrc files
      if (item.isFile() && path.extname(item.name).toLowerCase() === ".lrc") {
        continue;
      }

      if (item.isDirectory()) {
        dirs.push(fullPath);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (!audioExtensions.has(ext)) continue;

        // Skip if .lrc already exists and not in update mode
        const lrcPath = path.join(dir, path.basename(item.name, ext) + ".lrc");
        if (!update && fs.existsSync(lrcPath)) {
          console.info(`Skipping ${item.name}. Lyrics file exists`);
          continue;
        }

        const song = await scanAudioFile(fullPath);
        if (song) songs.push(song);
      }
    }

    for (const d of dirs) {
      await scanDir(d, currentDepth + 1);
    }
  }

  await scanDir(dirpath, 0);
  return songs;
}

async function scanAudioFile(filepath: string): Promise<Song | null> {
  try {
    const metadata = await parseFile(filepath, { skipCovers: true });
    const artist = metadata.common.artist || "";
    const title = metadata.common.title || "";
    const album = metadata.common.album || "";
    const duration = metadata.format.duration ? metadata.format.duration * 1000 : 0;
    const uri = filepath;

    if (!artist || !title) {
      console.warn(`Could not read metadata for: ${filepath}`);
      return null;
    }

    const song = new Song(artist, title, album, uri);
    song.duration = duration;
    return song;
  } catch {
    console.warn(`Could not read metadata for: ${filepath}`);
    return null;
  }
}

function isDirectory(path: string): boolean {
  try {
    return fs.statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isTextFile(path: string): boolean {
  return path.endsWith(".txt");
}
