/**
 * One-shot setup for offline LLM Enhanced mode:
 *  - npm install @mlc-ai/web-llm -> vendor/mlc-ai-web-llm
 *  - wasm blobs -> webllm-assets/wasm/
 *  - Qwen3 MLC weights -> webllm-assets/<model_id>/
 *
 * Run from repo root: npm install && npm run setup-offline-llm
 * Needs network once; large downloads (~1GB+ per model).
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const WASM_VERSION = 'v0_2_80';
const WASM_BASE = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/${WASM_VERSION}`;

const MODELS = [
  { repoId: 'mlc-ai/Qwen3-1.7B-q4f16_1-MLC', folder: 'Qwen3-1.7B-q4f16_1-MLC', wasm: 'Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm' },
  { repoId: 'mlc-ai/Qwen3-0.6B-q4f16_1-MLC', folder: 'Qwen3-0.6B-q4f16_1-MLC', wasm: 'Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm' },
];

function downloadHttpsToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const tryOnce = (u) => {
      https
        .get(u, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            tryOnce(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} ${u}`));
            return;
          }
          const out = fs.createWriteStream(destPath);
          res.pipe(out);
          out.on('finish', () => {
            out.close(resolve);
          });
        })
        .on('error', reject);
    };
    tryOnce(url);
  });
}

function copyVendor() {
  const src = path.join(root, 'node_modules', '@mlc-ai', 'web-llm');
  const dst = path.join(root, 'vendor', 'mlc-ai-web-llm');
  if (!fs.existsSync(src)) {
    throw new Error('node_modules/@mlc-ai/web-llm missing — run npm install from repo root first.');
  }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log('[setup-offline-llm] Copied', dst);
}

/** Prefer `hf download`, then `huggingface-cli download`; both resume partial folders. */
function tryHfDownload(repoId, localDir) {
  let r = spawnSync('hf', ['download', repoId, '--local-dir', localDir], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (r.status === 0) return true;
  r = spawnSync('huggingface-cli', ['download', repoId, '--local-dir', localDir], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  return r.status === 0;
}

function tryPythonSnapshot(repoId, localDir) {
  const script = path.join(root, 'scripts', 'hf_download.py');
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const r = spawnSync(py, [script, repoId, localDir], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (r.status === 2) {
    console.warn('[setup-offline-llm] Install Python package: pip install huggingface_hub');
  }
  return r.status === 0;
}

async function main() {
  console.log('[setup-offline-llm] Repo root:', root);
  console.log('[setup-offline-llm] Running npm install...');
  execSync('npm install', { cwd: root, stdio: 'inherit' });

  copyVendor();

  const wasmDir = path.join(root, 'webllm-assets', 'wasm');
  for (const m of MODELS) {
    const url = `${WASM_BASE}/${m.wasm}`;
    const dest = path.join(wasmDir, m.wasm);
    console.log('[setup-offline-llm] Downloading wasm', m.wasm);
    await downloadHttpsToFile(url, dest);
  }

  for (const m of MODELS) {
    const localDir = path.join(root, 'webllm-assets', m.folder);
    console.log('[setup-offline-llm] Model (idempotent / resumes):', m.repoId);
    if (tryHfDownload(m.repoId, localDir)) continue;
    if (tryPythonSnapshot(m.repoId, localDir)) continue;
    console.error('[setup-offline-llm] Failed:', m.repoId);
    console.error('  Install: pip install huggingface_hub  then run: hf download', m.repoId, '--local-dir', localDir);
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    try {
      execSync('node scripts/ensure-webllm-resolve-layout.mjs', { cwd: root, stdio: 'inherit' });
    } catch (e) {
      console.warn('[setup-offline-llm] ensure-webllm-resolve-layout failed:', e.message);
    }
    console.log('[setup-offline-llm] Done. Serve with: python3 scripts/serve-threaded.py 8090 (or npm run serve-game)');
    console.log('[setup-offline-llm] Open http://localhost:8090 — LLM Enhanced uses local vendor + webllm-assets.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
