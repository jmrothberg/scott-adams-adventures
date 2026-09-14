# Browser LLM compare tests (`TEST_webLLM`)

Standalone **two-model compare** harnesses for in-browser LLMs. **Not** connected to the Scott Adams game (`index.html`).

| Page | Stack | Defaults |
|------|--------|----------|
| [`transformersjs-compare-test.html`](transformersjs-compare-test.html) | `@huggingface/transformers` + ONNX (jsDelivr **4.0.1+**; Gemma 4 needs ≥ 4.0.1) | Gemma 4 **E2B** vs **E4B** ONNX |
| [`webllm-compare-test.html`](webllm-compare-test.html) | WebLLM / MLC + WebGPU (CDN **0.2.82**) | **Qwen3 0.6B** vs **1.7B** MLC |

Shared UI: Model A/B dropdowns (local trees listed first in **bold**), optional system/user prompts, **Max tokens (completion)** (default **512**, range 1–16384; applied to both A and B), optional streaming, Run A / Run B.

Future game dual-backend notes: [`PLAN_dual_backend_llm.md`](PLAN_dual_backend_llm.md) (not implemented).

## Run on GitHub Pages

Chrome or Edge. After Pages is enabled for `main` / root:

| What | Link |
|------|------|
| **Transformers.js** compare | [**Open →**](https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/transformersjs-compare-test.html) |
| **WebLLM** compare | [**Open →**](https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/webllm-compare-test.html) |
| **Adventure game** | [**Open →**](https://jmrothberg.github.io/scott-adams-adventures/) |

**`webllm-assets/`** and **`transformersjs-assets/`** are gitignored, so Pages always falls back to **network** (HF / CDN) for weights. No extra Pages config required.

## Run locally

Prefer the same threaded server as the game (parallel image + weight fetches):

```bash
cd /path/to/scott-adams-adventures
npm run serve-game
```

Then open:

- `http://localhost:8090/TEST_webLLM/transformersjs-compare-test.html`
- `http://localhost:8090/TEST_webLLM/webllm-compare-test.html`

`file://` may work for a quick look; use HTTP if modules or downloads fail.

**`npm install` is not required** to open the HTML pages (libraries load from CDN). It **is** required for the asset setup scripts below.

## Local weights (repo root)

Offline WebLLM for the **game** is documented in the root [`README.md`](../README.md) (`npm run setup-offline-llm` → **`webllm-assets/`**).

| Page | Folder | Setup (from repo root) |
|------|--------|-------------------------|
| WebLLM compare (+ game LLM) | **`webllm-assets/`** | **`npm run setup-offline-llm`** — see root README |
| Transformers.js compare | **`transformersjs-assets/`** | **`npm run setup-transformersjs-assets`** — `config.json` per catalog id (UI stays Hub until ONNX exists). **`npm run setup-transformersjs-assets-full`** — full ONNX for every compare-page repo (large; includes Gemma 4 E2B + E4B) |

**Local (fast)** on the Transformers.js page needs **`config.json`** plus at least one weight under **`onnx/`** (e.g. `model_q4.onnx` or `decoder_model_merged_q4.onnx`). Otherwise that id loads from the Hub.

Symlink alternative: point repo-root **`transformersjs-assets`** at an existing Hub-layout tree (`org/repo/config.json`, …).

Optional extra dropdown ids after adding folders:

```bash
node scripts/refresh-onnx-transformers-catalog.mjs
# or: ONNX_MODELS_DIR=/path/to/parent/of/org node scripts/refresh-onnx-transformers-catalog.mjs
```

Writes **`_catalog.json`**; the page fetches **`transformersjs-assets/_catalog.json`**.

## Files in this folder

| File | Purpose |
|------|--------|
| `transformersjs-compare-test.html` | ONNX / Transformers.js A–B compare |
| `webllm-compare-test.html` | WebLLM A–B compare |
| `PLAN_dual_backend_llm.md` | Design note for optional future game integration |
| `README.md` | This file |

Setup scripts live under **`../scripts/`** (`setup-transformersjs-assets.mjs`, `refresh-onnx-transformers-catalog.mjs`, `setup-offline-llm.mjs`, …).
