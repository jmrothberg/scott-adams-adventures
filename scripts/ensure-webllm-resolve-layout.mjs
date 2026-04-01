/**
 * WebLLM always resolves model files under .../resolve/main/ (Hugging Face layout).
 * HF downloads are flat under webllm-assets/<model_id>/; this adds
 *   webllm-assets/<model_id>/resolve/main -> symlink/junction to parent folder
 * so GET .../resolve/main/mlc-chat-config.json works on python -m http.server.
 *
 * Run: node scripts/ensure-webllm-resolve-layout.mjs
 * Called automatically at end of npm run setup-offline-llm.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const MODEL_IDS = [
  'Qwen3-1.7B-q4f16_1-MLC',
  'Qwen3-0.6B-q4f16_1-MLC',
  'Qwen3-8B-q4f16_1-MLC',
  'Qwen3.5-0.8B-q4f16_1-MLC',
];

function main() {
  const assets = path.join(root, 'webllm-assets');
  if (!fs.existsSync(assets)) {
    console.log('[ensure-webllm-resolve-layout] No webllm-assets/ — skip.');
    return;
  }
  for (const id of MODEL_IDS) {
    const base = path.join(assets, id);
    const flatCfg = path.join(base, 'mlc-chat-config.json');
    const resMain = path.join(base, 'resolve', 'main');
    const nestedCfg = path.join(resMain, 'mlc-chat-config.json');
    if (!fs.existsSync(flatCfg)) continue;
    if (fs.existsSync(nestedCfg)) {
      console.log('[ensure-webllm-resolve-layout] OK', id);
      continue;
    }
    fs.mkdirSync(path.join(base, 'resolve'), { recursive: true });
    const absBase = path.resolve(base);
    try {
      if (process.platform === 'win32') {
        fs.symlinkSync(absBase, resMain, 'junction');
      } else {
        fs.symlinkSync(absBase, resMain, 'dir');
      }
      console.log('[ensure-webllm-resolve-layout] Linked', id, 'resolve/main -> model folder');
    } catch (e) {
      if (e && e.code === 'EEXIST') continue;
      console.error('[ensure-webllm-resolve-layout]', id, e.message);
    }
  }
}

main();
