# musixmLRC

Command line tool to fetch synced lyrics from [Musixmatch](https://www.musixmatch.com/) and save it as `*.lrc` files.

TypeScript/Node.js rewrite of [MxLRC](https://github.com/fashni/MxLRC).

---

## Installation

```bash
git clone https://github.com/fashni/musixmLRC.git
cd musixmLRC
npm install
npm run build
```

---

## Usage

```
node dist/index.js [options]

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
  -h, --help             show this help message
```

## Examples

### One song
```bash
node dist/index.js -s "adele,hello"
```

### Multiple songs and custom output directory
```bash
node dist/index.js -s "adele,hello" "the killers,mr. brightside" -o some_directory
```

### With a text file and custom sleep time
```bash
node dist/index.js -s example_input.txt -t 20
```

### Directory Mode (recursive)
```bash
node dist/index.js -s "/path/to/music/folder"
```

> **Note:** This option overrides the `-o/--outdir` argument. Lyrics will be saved in the same directory as the given input.

> **Note:** The `-d/--depth` argument limits the depth of subdirectory scanning. Use `-d 0` to only scan the specified directory.

---

## Features

- Auto-fetches fresh Musixmatch tokens (no manual token setup required)
- Smart skip/overwrite logic: skips existing `.lrc` files if metadata matches, overwrites if different
- Supports text file input with list of songs
- Recursive directory scanning with configurable depth
- BFS/DFS directory traversal options
- Rate limiting between requests

---

## How to get the Musixmatch Token

The tool auto-fetches tokens, but if you need a custom token, follow steps 1 to 5 from the guide [here](https://spicetify.app/docs/faq#sometimes-popup-lyrics-andor-lyrics-plus-seem-to-not-work).

---

## Credits

- [MxLRC](https://github.com/fashni/MxLRC) - Original Python implementation
- [Spicetify Lyrics Plus](https://github.com/spicetify/spicetify-cli/tree/master/CustomApps/lyrics-plus) - Token extraction guide
