# Scott Adams Adventures - Browser Edition

Play all 17 classic Scott Adams text adventures (1978-84) right in your browser. Created by Jonathan Rothberg using the original Scott Adams game data files. The originals ran as Level II BASIC programs on the TRS-80, reading from separate data files. This project replaces the BASIC interpreter with HTML and JavaScript, and adds AI-generated room images to bring the classic text descriptions to life.

## Play Now

**https://jmrothberg.github.io/scott-adams-adventures/**

### WebLLM browser test (separate page)

In-browser LLM experiment (WebGPU), **not** the adventure game:  
**https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/webllm-qwen-compare-test.html**  
Details: [`TEST_webLLM/README.md`](TEST_webLLM/README.md).

### Offline LLM Enhanced (Qwen3, no internet)

The game’s **LLM Enhanced** mode uses [WebLLM](https://webllm.mlc.ai/) in the browser. By default it loads the library from a CDN and model weights from Hugging Face. To make it **fully offline** on this machine **or a new computer** after one online setup:

**One command (from the repo root, needs network once — large download):**

```bash
npm install
npm run setup-offline-llm
```

This runs `scripts/setup-offline-llm.mjs`, which:

- Installs `node_modules` and copies **`vendor/mlc-ai-web-llm/`** (so `llm-enhanced.js` does not need the CDN for the library).
- Downloads the two **WebGPU `.wasm`** files into **`webllm-assets/wasm/`**.
- Downloads both dropdown models (**Qwen3 1.7B** and **0.6B** MLC builds) into **`webllm-assets/<model_id>/`** using **`hf download`** (or **`huggingface-cli download`**), otherwise **`python3 scripts/hf_download.py`** (requires `pip install huggingface_hub`).

Re-run the same command if a download **times out** — Hugging Face tools **resume** partial folders.

Then serve with `python3 -m http.server` (not `file://`). WebLLM expects Hugging Face–style paths (`.../resolve/main/...`). After download, run **`npm run ensure-webllm-layout`** once (or rely on `setup-offline-llm`, which runs it) so `webllm-assets/<model_id>/resolve/main/` resolves to your files.

#### What lives where (so an LLM or future-you can fix the other machine)

| Path | In git? | Purpose |
|------|---------|---------|
| `vendor/mlc-ai-web-llm/` | **Yes** (after commit) | WebLLM JavaScript — **no CDN** needed if this folder exists. |
| `node_modules/` | No | From `npm install` — small; uses `package-lock.json`. |
| `webllm-assets/` | **No** (~1GB+) | Model weights + `.wasm` — **must** be copied or downloaded (see checklist). |

#### GitHub Pages vs your computer

- **Published site** (e.g. `https://jmrothberg.github.io/scott-adams-adventures/`) does **not** include `webllm-assets/` (too large for git). The game **detects** that: if `webllm-assets/.../resolve/main/mlc-chat-config.json` is missing, it uses the **normal Hugging Face** model URLs in the browser — same as before, **no extra setup**. The **WebLLM library** loads from **`vendor/mlc-ai-web-llm/`** in the repo when present (no jsDelivr CDN for that script).
- **Your machine** with `webllm-assets/` + `npm run ensure-webllm-layout`: weights and wasm are served **from your own URL** (localhost or file server). Open DevTools → **Console** when you enable LLM Enhanced: you’ll see either **`Model weights + wasm: loaded from this site`** (local) or **`Model weights: default Hugging Face URLs`** (GitHub / no local folder).

#### New machine: offline LLM checklist (follow in order)

Use this on a **second computer** so **LLM Enhanced** works **without** relying on a CDN or Hugging Face in the browser. An AI assistant can execute or verify each step.

1. **Clone / copy the repo** into a folder (e.g. `scott-adams-adventures`). Ensure **`vendor/mlc-ai-web-llm/`** exists after `git pull` (it should if `vendor/` was committed on the main machine).
2. **Install Node dependencies** (from repo root):  
   `npm install`
3. **Get `webllm-assets/`** — pick one:
   - **Copy** the whole `webllm-assets/` directory from the first machine (USB, cloud drive, `rsync`, etc.), **or**
   - **Download again** (needs internet once):  
     `npm run setup-offline-llm`  
     If it errors, install Hugging Face tools (`pip install huggingface_hub` gives `hf` / `huggingface-cli`) and re-run; partial downloads **resume**.
4. **Confirm files** (paths relative to repo root):
   - `vendor/mlc-ai-web-llm/lib/index.js` exists  
   - `webllm-assets/wasm/*.wasm` exists (two files)  
   - `npm run ensure-webllm-layout` has been run if you copied an **old** flat `webllm-assets/` (creates `resolve/main` links WebLLM needs).
   - `webllm-assets/Qwen3-1.7B-q4f16_1-MLC/resolve/main/mlc-chat-config.json` exists (same for `Qwen3-0.6B-q4f16_1-MLC` if needed) — or the flat file exists **and** `ensure-webllm-layout` was run.
5. **Serve over HTTP** (required; `file://` breaks loading):  
   `python3 -m http.server 8090`  
   Open **http://localhost:8090** in **Chrome or Edge** (WebGPU).
6. In the game, click **Classic** / **LLM Enhanced** to enable LLM mode; first load may take a while while the model initializes.

**If LLM mode fails on the new machine:** re-check step 3–4, confirm WebGPU (Chrome), and that nothing blocked `webllm-assets/` (wrong folder name or missing `wasm/`).

**Manual download** (if `npm run setup-offline-llm` fails): same layout as the script — HF repos [`Qwen3-1.7B-q4f16_1-MLC`](https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC) and [`Qwen3-0.6B-q4f16_1-MLC`](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC), wasm from [`binary-mlc-llm-libs` `web-llm-models`](https://github.com/mlc-ai/binary-mlc-llm-libs/tree/main/web-llm-models) **`v0_2_80`** into `webllm-assets/wasm/`.

## How to Play

- **Select a game** from the dropdown menu and click **New Game**
- **Type commands** in the input field and press Enter
- Commands are **two words**: a verb and a noun (e.g., `GET AXE`, `GO NORTH`, `OPEN DOOR`)
- Words can be abbreviated to 3 letters (e.g., `GET AXE` = `GET AXE`)

### Shortcuts

| Key | Action |
|-----|--------|
| `N` `S` `E` `W` `U` `D` | Move North/South/East/West/Up/Down |
| `I` | Show inventory |
| `L` | Look around |
| `SCORE` | Check your score |
| `HELP` | Get a hint (when available) |
| `SAVE` | Save game (to browser storage) |
| `LOAD` | Restore saved game |
| `QUIT` | End game |

### Tips

- **Draw a map** on paper as you explore - you will get lost without one
- **Examine everything** - items often have clues
- **Read signs** - they contain important hints
- Treasures are marked with `*asterisks*` - collect them and store them at the treasure room
- Type `SCORE` to see how many treasures you've stored
- If you die, you end up in Limbo - look for an exit to continue

## The Games

| # | Game | Difficulty | Description |
|---|------|-----------|-------------|
| 1 | Adventureland | Moderate | Find 13 lost treasures in an enchanted realm with wild animals and magical beings |
| 2 | Pirate Adventure | Beginner | Explore a tropical island to find Long John Silver's lost treasures |
| 3 | Secret Mission | Advanced | Race the clock to save the world's first automated nuclear reactor |
| 4 | Voodoo Castle | Moderate | Break a fiendish curse to rescue the Count |
| 5 | The Count | Moderate | Wake up in a Transylvanian castle. Why did the postman deliver blood? |
| 6 | Strange Odyssey | Moderate | Harvest treasures from a long-dead alien civilization at the galaxy's rim |
| 7 | Mystery Fun House | Moderate | Escape a carnival fun house - you're NOT here to have a good time |
| 8 | Pyramid of Doom | Moderate | Plunder jewels and gold from crumbling ruins in the desert |
| 9 | Ghost Town | Advanced | Search a once-thriving mining town for 13 hidden treasures |
| 10 | Savage Island Pt.1 | Advanced | A small island holds an awesome secret. For experienced adventurers only |
| 11 | Savage Island Pt.2 | Advanced | The conclusion - requires the password from Part 1 |
| 12 | Golden Voyage | Advanced | Three days to bring back the elixir to save the dying king |
| 13 | Sorcerer of Claymorgue | Advanced | Recover 13 stolen Stars of Power as a wizard's apprentice |
| 14a | Return to Pirate's Isle | Moderate | Return to the world of Pirate Adventure |
| 14b | Buckaroo Banzai | Moderate | Based on the movie - save the world from the Red Lectroids |
| Q1 | The Hulk | Moderate | Questprobe #1 - you are Bruce Banner / The Incredible Hulk |
| Q2 | Spiderman | Moderate | Questprobe #2 - save the day as Spider-Man |

## Adding Room Images

The interpreter supports optional images for each room. When an image exists, it displays automatically. When it doesn't, nothing happens - the game works fine either way.

### Image folder structure

Each game has its own image folder, named after the `.dat` file:

```
images/
  adv01/
    room_01.png    <- Adventureland room 1 (dismal swamp)
    room_02.png    <- Adventureland room 2 (top of cypress tree)
    ...
  adv02/
    room_01.png    <- Pirate Adventure room 1 (flat in London)
    room_06.png    <- Pirate Adventure room 6 (sandy beach)
    ...
  quest1/
    room_01.png    <- The Hulk room 1
    ...
```

Room numbers are **two-digit, zero-padded** (`room_01.png`, not `room_1.png`). You don't need images for every room — missing images are silently skipped.

### Per-game image guides

The `image_guides/` folder has a markdown file for each game listing every room with a description suitable as an image generation prompt. For example, `image_guides/adv01_adventureland.md` lists all 33 rooms with descriptions like:

> **room_01.png** — Dismal swamp: A dark, foggy swamp with gnarled trees, murky water, hanging moss, and an oppressive grey-green atmosphere.

### Generating images locally (SDXL Turbo)

The included `generate_images.py` script uses SDXL Turbo to generate room images locally on your Mac (Apple Silicon) or any machine with a GPU.

**One-time setup:**
```bash
pip install torch diffusers transformers accelerate
```

**Generate images for a game:**
```bash
python3 generate_images.py adv01              # Adventureland
python3 generate_images.py adv05              # The Count
python3 generate_images.py adv01 adv02 adv03  # Multiple games
python3 generate_images.py --all              # All 17 games (takes a while!)
```

The script:
- Reads room descriptions from `image_guides/<game>_*.md`
- Generates 512x320 PNG images into `images/<game>/room_NN.png`
- Skips images that already exist (safe to re-run)
- Uses MPS (Apple Silicon), CUDA (NVIDIA), or CPU fallback
- First run downloads the SDXL Turbo model (~5GB, cached after that)

After generating, commit and push to see them on GitHub Pages.

### Adding images manually

1. Pick a game (e.g., Adventureland = `Game_Data/adv01.dat`)
2. Open `image_guides/adv01_adventureland.md` for the room list and prompts
3. Generate images using your preferred tool (Stable Diffusion, DALL-E, Midjourney, etc.)
4. Save images as `images/adv01/room_01.png`, `room_02.png`, etc.
5. Push to the repo — they'll appear in the game automatically

**Recommended size:** 512x320px landscape. **Style:** Retro 1980s adventure game illustration.

## Credits

- **Browser edition** by Jonathan Rothberg (2026) — HTML/JavaScript interpreter and AI-generated room images
- **Original games** (c) 1978-1984 by Scott Adams / Adventure International
- Games written by Scott Adams, with contributions from Alexis Adams, Alvin Files, Russ Wetmore, William Demas, and Phillip Case
- Data files in ScottFree format, converted by Paul David Doherty
- Room images generated with SDXL Turbo using prompts derived from the original game data

These games are shareware. See `0readme.txt` for the original shareware notice.
