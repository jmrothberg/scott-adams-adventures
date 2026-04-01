/**
 * Bootstrap repo-root transformersjs-assets/ for TEST_webLLM/transformersjs-qwen-compare-test.html
 * — same role as setup-offline-llm.mjs for webllm-assets/, but ONNX Hub layout (org/repo/config.json).
 *
 * Default (no flags): downloads one file — config.json for the page’s default small model — so the
 * compare page detects LOCAL for that model_id and you can confirm paths / HTTP serving.
 *
 * Full snapshot (--full): same Hugging Face flow as setup-offline-llm (hf / huggingface-cli / python),
 * then rewrites transformersjs-assets/_catalog.json via refresh-onnx-transformers-catalog.mjs.
 * Large download (hundreds of MB+); use for offline inference.
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

/** Matches DEFAULT_MODEL_A in transformersjs-qwen-compare-test.html */
const REPO_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

function modelLocalDir() {
  const [org, name] = REPO_ID.split('/');
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
  const url = `https://huggingface.co/${REPO_ID}/resolve/main/config.json`;
  const dest = path.join(modelLocalDir(), 'config.json');
  console.log('[setup-transformersjs-assets] Minimal smoke setup: one file —', path.relative(root, dest));
  console.log('[setup-transformersjs-assets] URL:', url);
  await downloadHttpsToFile(url, dest);
  console.log('[setup-transformersjs-assets] Wrote', dest);
  console.log(
    '[setup-transformersjs-assets] The compare page will list this model as LOCAL (bold), but loading/running it needs full ONNX weights — run: npm run setup-transformersjs-assets-full',
  );
}

async function downloadFull() {
  const localDir = modelLocalDir();
  console.log('[setup-transformersjs-assets] Full snapshot (large) ->', localDir);
  if (tryHfDownload(REPO_ID, localDir)) return true;
  if (tryPythonSnapshot(REPO_ID, localDir)) return true;
  console.error('[setup-transformersjs-assets] Failed:', REPO_ID);
  console.error(
    '  Install: pip install huggingface_hub  then run: hf download',
    REPO_ID,
    '--local-dir',
    localDir,
  );
  process.exitCode = 1;
  return false;
}

async function main() {
  const full = process.argv.includes('--full');
  console.log('[setup-transformersjs-assets] Repo root:', root);
  let fullOk = true;
  if (full) {
    fullOk = await downloadFull();
  } else {
    await downloadConfigOnly();
  }
  if (full && fullOk) {
    try {
      execSync('node scripts/refresh-onnx-transformers-catalog.mjs', {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, ONNX_MODELS_DIR: path.join(root, 'transformersjs-assets') },
      });
    } catch (e) {
      console.warn('[setup-transformersjs-assets] Optional _catalog refresh failed:', e.message);
    }
  }
  if (process.exitCode !== 1) {
    console.log(
      '[setup-transformersjs-assets] Serve repo root over HTTP, then open TEST_webLLM/transformersjs-qwen-compare-test.html (see TEST_webLLM/README.md).',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
