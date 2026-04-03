---
name: Transformers.js LLM in game
overview: "Add Qwen3.5 (Transformers.js / ONNX) alongside existing WebLLM in the game via a new module (e.g. llmjs-enhance.js), with four dropdown options. This is **lower risk** than replacing [llm-enhanced.js](llm-enhanced.js) entirely, but still requires a **single dispatch layer** so translate / enhance / hints and the Enter-key handler do not fork into two unmaintainable copies."
todos:
  - id: orchestration
    content: "Add backend dispatch in llm-enhanced.js (or tiny llm-router.js): read #llm-model; if ONNX/Transformers id → call into llmjs-enhance.js API; else existing WebLLM path. One handleCmdEnhanced, one toggleLLM."
    status: pending
  - id: llmjs-module
    content: "Implement llmjs-enhance.js — pipeline load/switch/dispose, translateInput/enhanceOutput/deliverHint mirroring prompts from llm-enhanced.js; reuse compare-test patterns (dtype q4, repetition_penalty, TextStreamer, WASM fallback)."
    status: pending
  - id: index-four-options
    content: "index.html #llm-model — four options (two MLC + two ONNX), labels clear; optional data-backend or value prefix for dispatch."
    status: pending
  - id: lazy-import
    content: "Lazy-import @huggingface/transformers only when user selects an ONNX model (avoid loading both WebLLM + Transformers on every page load)."
    status: pending
  - id: readme-note
    content: "README snippet — webllm-assets vs transformersjs-assets for offline; four-option behavior."
    status: pending
isProject: false
---

# Add Transformers.js Qwen3.5 alongside WebLLM (four-option dropdown)

## Is “ADD llmjs-enhance.js + four options” easier?

**Yes, in terms of risk and rollout:** you keep the current **WebLLM** stack in [llm-enhanced.js](llm-enhanced.js) working as-is for the two existing MLC models, and add a **second backend** for Qwen3.5 without deleting MLC support.

**Not proportionally easier in total work:** the game still needs **one** implementation of translate / stream-enhance / hints wired to the command pipeline. That means either:

- **Small edits to [llm-enhanced.js](llm-enhanced.js)** to **branch** on the selected model (WebLLM vs Transformers), calling into **`llmjs-enhance.js`** for the ONNX path, **or**
- A new thin **router** module that both backends register with (more files, clearer separation).

Duplicating `handleCmdEnhanced` in two files would be **harder to maintain** — the plan should **not** do that.

## Proposed layout

```mermaid
flowchart TB
  index[index.html four options]
  shell[llm-enhanced.js orchestration]
  webllm[WebLLM MLCEngine existing]
  tfjs[llmjs-enhance.js Transformers pipeline]
  index --> shell
  shell -->|MLC model_id| webllm
  shell -->|onnx-community/...| tfjs
```

| Piece | Role |
|--------|------|
| [index.html](index.html) | `#llm-model` with **four** `<option>`s: e.g. `Qwen3-1.7B-q4f16_1-MLC`, `Qwen3-0.6B-q4f16_1-MLC`, `onnx-community/Qwen3.5-0.8B-Text-ONNX`, `onnx-community/Qwen3.5-2B-ONNX` (labels user-friendly). |
| [llm-enhanced.js](llm-enhanced.js) | Stays the **entry**: `toggleLLM`, `loadModel`, `handleCmdEnhanced`, progress UI — extended to **dispatch** load/inference to WebLLM **or** `llmjs-enhance.js` based on selection. |
| **llmjs-enhance.js** (name as you suggested) | **Only** Transformers.js: `pipeline`, load/switch/dispose, `translateInput` / `enhanceOutput` / `deliverHint` using the **same prompts** as today (copy or import shared prompt strings from a tiny shared `llm-prompts.js` if you want zero drift). |

## Why not two completely separate enhancer scripts?

If both scripts attach their own `keydown` / `toggleLLM`, they **fight**. One module must own the UI and delegate.

## Lazy loading

On first paint, **do not** import `@huggingface/transformers` until the user selects an ONNX model or enables LLM with that model — keeps initial load smaller when users only use MLC.

## WebGPU gate

Today [llm-enhanced.js](llm-enhanced.js) hides the LLM UI when `!navigator.gpu`. For Transformers.js, **WASM fallback** is valid — orchestration can show the toggle for ONNX models even without WebGPU, or keep one policy for both (product choice).

## Model notes

- **Qwen3.5-0.8B-Text-ONNX** — preferred first ONNX in-game.
- **Qwen3.5-2B-ONNX** — heavier / different arch; keep as fourth option but expect more OOM risk.

## Compared to “replace WebLLM”

| Approach | Pros | Cons |
|----------|------|------|
| **Add llmjs-enhance.js + 4 options** | Preserves MLC users; incremental ship; A/B test backends | Orchestration + two dependency trees; must avoid duplicate command logic |
| **Replace WebLLM only** | Single backend | Breaks existing MLC/offline setup until Transformers parity proven |

**Recommendation:** proceed with the **additive** design unless you explicitly want to drop WebLLM later.
