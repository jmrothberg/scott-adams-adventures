/**
 * Bootstrap repo-root transformersjs-assets/ for TEST_webLLM/transformersjs-compare-test.html
 * — same role as setup-offline-llm.mjs for webllm-assets/, but ONNX Hub layout (org/repo/config.json).
 *
 * Default (no flags): downloads config.json for each curated repo (see TRANSFORMERSJS_CATALOG_REPO_IDS)
 * so folder layout exists and _catalog.json can list them. Compare page marks LOCAL only when ONNX
 * shards exist on disk (see README).
 *
 * Full snapshot (--full): hf download (or CLI / python) for every id in TRANSFORMERSJS_CATALOG_REPO_IDS,
 * then rewrites transformersjs-assets/_catalog.json via refresh-onnx-transformers-catalog.mjs.
 * Very large total download; use for offline inference.
 *
 * Run from repo root:
 *   npm run setup-transformersjs-assets
 *   npm run setup-transformersjs-assets-full
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/**
 * Keep in sync with MODEL_CATALOG in TEST_webLLM/transformersjs-compare-test.html.
 * Includes onnx-community Gemma 4 E2B and E4B (both pulled on --full).
 */
const TRANSFORMERSJS_CATALOG_REPO_IDS = [
  'onnx-community/Qwen3.5-0.8B-Text-ONNX',
  'onnx-community/Qwen3.5-2B-ONNX',
  'onnx-community/Qwen3-0.6B-ONNX',
  'onnx-community/Qwen2.5-0.5B-Instruct',
  'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
  'onnx-community/Qwen2.5-1.5B-Instruct',
  'onnx-community/Qwen2.5-Coder-1.5B-Instruct',
  'onnx-community/Llama-3.2-1B-Instruct',
  'onnx-community/gemma-4-E2B-it-ONNX',
  'onnx-community/gemma-4-E4B-it-ONNX',
];

const MINIMAL_CONFIG_REPO_IDS = TRANSFORMERSJS_CATALOG_REPO_IDS;

function modelLocalDirForRepo(repoId) {
  const [org, name] = repoId.split('/');
  return path.join(root, 'transformersjs-assets', org, name);
}

function downloadHttpsToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    /** HF redirects may use relative Location — resolve against the previous request URL. */
    const tryOnce = (u, baseForRelative) => {
      const absolute =
        u.startsWith('http://') || u.startsWith('https://')
          ? u
          : new URL(u, baseForRelative || url).href;
      https
        .get(absolute, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            tryOnce(res.headers.location, absolute);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} ${absolute}`));
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
    console.warn('[setup-transformersjs-assets] Install Python package: pip install huggingface_hub');
  }
  return r.status === 0;
}

async function downloadConfigOnly() {
  for (const repoId of MINIMAL_CONFIG_REPO_IDS) {
    const url = `https://huggingface.co/${repoId}/resolve/main/config.json`;
    const dest = path.join(modelLocalDirForRepo(repoId), 'config.json');
    console.log('[setup-transformersjs-assets] Minimal:', path.relative(root, dest));
    console.log('[setup-transformersjs-assets] URL:', url);
    await downloadHttpsToFile(url, dest);
    console.log('[setup-transformersjs-assets] Wrote', dest);
  }
  console.log(
    '[setup-transformersjs-assets] ONNX weights still need: npm run setup-transformersjs-assets-full (or hf download per repo).',
  );
}

async function downloadFull() {
  let allOk = true;
  for (const repoId of TRANSFORMERSJS_CATALOG_REPO_IDS) {
    const localDir = modelLocalDirForRepo(repoId);
    console.log('[setup-transformersjs-assets] Full snapshot ->', localDir);
    if (tryHfDownload(repoId, localDir)) continue;
    if (tryPythonSnapshot(repoId, localDir)) continue;
    console.error('[setup-transformersjs-assets] Failed:', repoId);
    console.error(
      '  Install: pip install huggingface_hub  then run: hf download',
      repoId,
      '--local-dir',
      localDir,
    );
    allOk = false;
  }
  if (!allOk) {
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function main() {
  const full = process.argv.includes('--full');
  console.log('[setup-transformersjs-assets] Repo root:', root);
  if (full) {
    await downloadFull();
  } else {
    await downloadConfigOnly();
  }
  try {
    execSync('node scripts/refresh-onnx-transformers-catalog.mjs', {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ONNX_MODELS_DIR: path.join(root, 'transformersjs-assets') },
    });
  } catch (e) {
    console.warn('[setup-transformersjs-assets] Optional _catalog refresh failed:', e.message);
  }
  if (process.exitCode !== 1) {
    console.log(
      '[setup-transformersjs-assets] Serve repo root over HTTP, then open TEST_webLLM/transformersjs-compare-test.html (see TEST_webLLM/README.md).',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
