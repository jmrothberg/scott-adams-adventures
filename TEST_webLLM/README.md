# WebLLM browser test (`TEST_webLLM`)

This folder holds a **standalone experiment**: running [WebLLM](https://webllm.mlc.ai/) (`@mlc-ai/web-llm`) in the browser with **WebGPU** so you can compare two small Qwen-family models side by side. It is **not** connected to the Scott Adams adventure interpreter (`index.html` in the repo root).

## Run on GitHub Pages (click to test)

Use a recent **Chrome** or **Edge** (modules + WebGPU / WASM). Enable **GitHub Pages** for this repo (Settings → Pages → source `main`, folder `/ (root)`), wait a minute after each push, then open:

| What | Link |
|------|------|
| **Transformers.js** — two-model ONNX compare ([`transformersjs-qwen-compare-test.html`](transformersjs-qwen-compare-test.html)) | [**Open the Transformers.js compare page →**](https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/transformersjs-qwen-compare-test.html) |
| **WebLLM** — MLC / WebGPU compare ([`webllm-qwen-compare-test.html`](webllm-qwen-compare-test.html)) | [**Open the WebLLM compare page →**](https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/webllm-qwen-compare-test.html) |
| **Adventure game** (repo root, not this folder) | [**Open the game →**](https://jmrothberg.github.io/scott-adams-adventures/) |

**Direct URL** (copy/paste):  
`https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/transformersjs-qwen-compare-test.html`

These tests live only under `TEST_webLLM/`; they do not replace or redirect the game at the site root.

### After you push — GitHub Pages still behaves the same

Large folders (**`webllm-assets/`**, **`transformersjs-assets/`**) stay in **`.gitignore`**, so they are **not** on `github.io`. Both compare pages probe for local files under **`https://<user>.github.io/<repo>/…`**; those paths **404**, so models load from the **network** (Hugging Face / CDN for WebLLM, **Hub** for Transformers.js). Optional **`transformersjs-assets/_catalog.json`** also 404s — the UI uses the built-in catalog only. **No extra GitHub configuration** is required for this to keep working.

## Open the test locally (double-click / paste path)

1. In Finder, open the `TEST_webLLM` folder and double-click **`webllm-qwen-compare-test.html`**, or  
2. In your browser’s address bar, paste a `file://` URL to that file, for example:  
   `file:///Users/<you>/path/to/scott-adams-adventures/TEST_webLLM/webllm-qwen-compare-test.html`

If modules or model downloads fail from `file://`, serve the repo folder over HTTP (see below).

## Optional: tiny local HTTP server

Some browsers restrict `file://` for ES modules or large fetches. From the **repository root**:

```bash
cd /path/to/scott-adams-adventures
python3 -m http.server 8765
```

Then open: `http://localhost:8765/TEST_webLLM/webllm-qwen-compare-test.html`  
or: `http://localhost:8765/TEST_webLLM/transformersjs-qwen-compare-test.html`

## Local weights (parallel folders at repo root)

| Page | Site-root folder | One-shot setup (from repo root) |
|------|------------------|----------------------------------|
| **WebLLM** compare + game LLM | **`webllm-assets/`** | **`npm run setup-offline-llm`** — wasm + MLC weights (large). See root **`README.md`**. |
| **Transformers.js** compare | **`transformersjs-assets/`** | **`npm run setup-transformersjs-assets`** — **one file** (`config.json`) to prove layout and **LOCAL** in the UI. **`npm run setup-transformersjs-assets-full`** — full ONNX snapshot (large), same **`hf` / `huggingface-cli` / `hf_download.py`** fallback as WebLLM setup. |

| Page | What’s inside the folder |
|------|---------------------------|
| **WebLLM** | MLC prebuilt layout (`…/resolve/main/…`, wasm in **`webllm-assets/wasm/`**). |
| **Transformers.js** | Hugging Face repo tree: **`transformersjs-assets/org/repo/config.json`**, tokenizer files, **`onnx/`**, etc. Same layout you get from **`hf download onnx-community/Qwen2.5-0.5B-Instruct`**. |

### Transformers.js: create `transformersjs-assets/` (like `webllm-assets/`)

From the **repository root** (needs network once):

```bash
cd /path/to/scott-adams-adventures
npm run setup-transformersjs-assets
```

This creates **`transformersjs-assets/onnx-community/Qwen2.5-0.5B-Instruct/config.json`** (only that file). Serve the repo over HTTP and open the compare page: that model appears under **Local (fast)** in **bold** so you know paths work. **Inference** still needs the rest of the repo; download everything with:

```bash
npm run setup-transformersjs-assets-full
```

Re-run if a download stalls — HF tools **resume** partial folders. The **full** script also runs **`refresh-onnx-transformers-catalog.mjs`** so **`transformersjs-assets/_catalog.json`** stays in sync. If both npm scripts fail, install **`pip install huggingface_hub`** and run:

`hf download onnx-community/Qwen2.5-0.5B-Instruct --local-dir transformersjs-assets/onnx-community/Qwen2.5-0.5B-Instruct`

### Manual layout (symlink instead of repo-root folder)

If ONNX files already live elsewhere, symlink **`transformersjs-assets`** at the repo root to that directory (same idea as copying **`webllm-assets/`** between machines). Layout must include paths like **`onnx-community/Qwen2.5-0.5B-Instruct/config.json`**.

### Optional: `_catalog.json` for extra models

After adding more **`org/repo/`** trees under **`transformersjs-assets/`**, refresh the dropdown:

```bash
ONNX_MODELS_DIR=/path/to/parent/of/org node scripts/refresh-onnx-transformers-catalog.mjs
```

If **`~/ONNX_Models`** is that parent folder: `node scripts/refresh-onnx-transformers-catalog.mjs`  
The script writes **`_catalog.json`** there; the page loads **`transformersjs-assets/_catalog.json`** via your server.

**`.gitignore`** lists **`webllm-assets/`**, **`transformersjs-assets/`**, and legacy **`ONNX_Models`** so large weights are not committed.

## Requirements

- A **Chromium-class** browser with **WebGPU** enabled (e.g. current Chrome or Edge).
- **First run** downloads model weights from Hugging Face (can take a while); later runs use cache.

## What the page does

- Loads WebLLM from the jsDelivr CDN (`@mlc-ai/web-llm`).
- The dropdown lists only models in the bundled WebLLM **0.2.82** `prebuiltAppConfig` (newer HF-only repos stay out until npm ships them).
- For **any** catalog `model_id`, the page probes `…/webllm-assets/<model_id>/resolve/main/mlc-chat-config.json` at the **site root**. If it 404s, weights load from **Hugging Face / CDN**. The UI shows **LOCAL** vs **NET**.
- Defaults to two **official prebuilt** `model_id` strings from the current WebLLM catalog (closest small Qwen3 q4-style sizes). You can edit the fields to try other prebuilt IDs when MLC publishes them.
- **Model A / B** are `<select>` dropdowns (not datalist): entries found under **`webllm-assets/`** are listed first in **bold** under “Local (fast)”; the rest appear under “Catalog”.
- Optional **system** and **user** messages; load A / B or run the same prompt on **both** (sequentially). Streaming is optional.

**Transformers.js** compare (`transformersjs-qwen-compare-test.html`): loads `@huggingface/transformers` from jsDelivr. For each catalog `model_id`, it probes **`transformersjs-assets/<model_id>/config.json`** at the **site root** (parallel to WebLLM’s `webllm-assets/` check). If that 404s, weights load from the **Hub**. **Model A / B** dropdowns list local disk entries first in **bold** under “Local (fast) — transformersjs-assets”.

## Relationship to the adventure game

- **No integration** with the game engine or `index.html`.
- Intended for trying in-browser LLMs (e.g. future **function calling** for commands); anything beyond this test page is a separate step.

## Files

| File | Purpose |
|------|--------|
| `webllm-qwen-compare-test.html` | Standalone test UI (single HTML file + module script). |
| `transformersjs-qwen-compare-test.html` | Same compare UI using **Transformers.js** (`@huggingface/transformers`) and ONNX Runtime Web. Local weights under repo-root **`transformersjs-assets/`** (parallel to **`webllm-assets/`** for WebLLM). |
| `../scripts/setup-transformersjs-assets.mjs` | Creates **`transformersjs-assets/`** — default: only **`config.json`** for **`onnx-community/Qwen2.5-0.5B-Instruct`**; **`--full`**: full Hub snapshot (via `npm run setup-transformersjs-assets-full`). |
| `../scripts/refresh-onnx-transformers-catalog.mjs` | Writes `_catalog.json` into your local ONNX tree so every downloaded `org/name` folder appears in the Transformers.js compare dropdown. |
| `README.md` | This file. |
