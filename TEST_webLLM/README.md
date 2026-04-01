# WebLLM browser test (`TEST_webLLM`)

This folder holds a **standalone experiment**: running [WebLLM](https://webllm.mlc.ai/) (`@mlc-ai/web-llm`) in the browser with **WebGPU** so you can compare two small Qwen-family models side by side. It is **not** connected to the Scott Adams adventure interpreter (`index.html` in the repo root).

## Live URL (GitHub Pages)

After you push to GitHub and Pages is enabled for this repository, open:

**`https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/webllm-qwen-compare-test.html`**

**Transformers.js + ONNX Runtime Web** (same UI idea, Hub ONNX models):  
**`https://jmrothberg.github.io/scott-adams-adventures/TEST_webLLM/transformersjs-qwen-compare-test.html`**

- The **game** is still served at the site root:  
  **`https://jmrothberg.github.io/scott-adams-adventures/`**  
  That page loads the root **`index.html`** (the adventure game). This WebLLM test lives **only** under `TEST_webLLM/` so visiting the URL above does **not** swap in or replace the game.

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

## Local ONNX models (`ONNX_Models` → your download folder)

The Transformers.js compare page loads **local** weights from **`ONNX_Models/`** at the **repository root** (URL path), not from a bare `file://` path. Browsers only see what your HTTP server exposes.

1. Keep downloads in a single folder on disk, e.g. **`/Users/<you>/ONNX_Models`**, with the same layout as on the Hub: `onnx-community/Qwen2.5-0.5B-Instruct/config.json`, tokenizer files, `onnx/`, etc.
2. From the **repo root**, point `ONNX_Models` at that folder (one-time):

   ```bash
   cd /path/to/scott-adams-adventures
   ln -s /Users/<you>/ONNX_Models ONNX_Models
   ```

   Example: `ln -s /Users/jonathanrothberg_1/ONNX_Models ONNX_Models`

3. (Optional) Regenerate the dropdown list after new downloads:

   ```bash
   node scripts/refresh-onnx-transformers-catalog.mjs
   ```

   This writes **`_catalog.json`** into that directory. The HTML page fetches `ONNX_Models/_catalog.json` and merges **`model_ids`** with its built-in list.

`ONNX_Models/` is listed in **`.gitignore`** so large weights are not committed.

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

## Relationship to the adventure game

- **No integration** with the game engine or `index.html`.
- Intended for trying in-browser LLMs (e.g. future **function calling** for commands); anything beyond this test page is a separate step.

## Files

| File | Purpose |
|------|--------|
| `webllm-qwen-compare-test.html` | Standalone test UI (single HTML file + module script). |
| `transformersjs-qwen-compare-test.html` | Same compare UI using **Transformers.js** (`@huggingface/transformers`) and ONNX Runtime Web; includes an **`importmap`** so the browser can load `onnxruntime-web/webgpu` (not a path/folder issue). Local weights under repo-root **`ONNX_Models/`**. |
| `../scripts/refresh-onnx-transformers-catalog.mjs` | Writes `ONNX_Models/_catalog.json` so every downloaded `org/name` folder appears in the compare page dropdown. |
| `README.md` | This file. |
