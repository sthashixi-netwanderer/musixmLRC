#!/usr/bin/env node
import { parseArgs, getSongs } from "./cli.js";
import { Musixmatch } from "./musixmatch.js";
import { genLrc } from "./lrc.js";
import { Song } from "./song.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.songs.length === 0) {
    console.error("No songs specified. Use -s \"artist,title\" or -h for help.");
    process.exit(1);
  }

  const mxm = new Musixmatch(args.token);

  const songs = await getSongs(args.songs, args.depth, args.bfs, args.update);
  if (songs.length === 0) {
    console.error("No songs found");
    process.exit(1);
  }

  console.info(`Found ${songs.length} song(s)`);
  console.info(`Output directory: ${args.outdir}`);
  console.info(`Delay: ${args.sleep}s`);

  const fs = await import("node:fs");
  if (!fs.existsSync(args.outdir)) {
    fs.mkdirSync(args.outdir, { recursive: true });
  }

  let done = 0;
  let success = 0;
  let skipped = 0;

  for (const song of songs) {
    if (!args.quiet) {
      console.log(`\n[${done + 1}/${songs.length}] Searching: ${song}`);
    }

    const body = await mxm.findLyrics(song);
    if (!body) {
      done++;
      continue;
    }

    song.updateInfo(body);
    const gotSynced = Musixmatch.getSynced(song, body);
    const gotUnsynced = Musixmatch.getUnsynced(song, body);

    const output = genLrc(song, args.outdir, "", args.update);
    if (output) success++;
    else skipped++;

    done++;

    if (done < songs.length) {
      console.info(`Sleeping for ${args.sleep}s...`);
      await new Promise(resolve => setTimeout(resolve, args.sleep * 1000));
    }
  }

  console.log(`\nDone. ${success}/${songs.length} lyrics saved. ${skipped} skipped.`);
}

main().catch(err => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
