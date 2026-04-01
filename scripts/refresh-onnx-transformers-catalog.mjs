#!/usr/bin/env node
/**
 * Scan a local ONNX / Transformers.js model directory (default: ~/ONNX_Models) for
 *   <root>/ModelName/config.json  (flat)
 *   <root>/org/repo/config.json   (nested, Hugging Face layout)
 * and write <root>/_catalog.json. The compare page merges model_ids from that file into its dropdown.
 *
 * Skips symlink directories so a mistaken ONNX_Models → self link does not invent bad ids.
 *
 * Usage:
 *   node scripts/refresh-onnx-transformers-catalog.mjs
 *   ONNX_MODELS_DIR=/path/to/ONNX_Models node scripts/refresh-onnx-transformers-catalog.mjs
 */
import { readdirSync, statSync, lstatSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const root = process.env.ONNX_MODELS_DIR || join(homedir(), "ONNX_Models");

if (!existsSync(root)) {
  console.error("ONNX models directory does not exist:", root);
  console.error("Create it or set ONNX_MODELS_DIR to your folder.");
  process.exit(1);
}

const ids = [];

function addIfModel(dir, id) {
  if (existsSync(join(dir, "config.json"))) {
    ids.push(id);
  }
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Skip symlink dirs (avoids ONNX_Models → same folder producing fake ids like ONNX_Models/Qwen…). */
function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

for (const name of readdirSync(root)) {
  if (name.startsWith(".") || name === "node_modules" || name === "_catalog.json") continue;
  const top = join(root, name);
  if (!isDir(top) || isSymlink(top)) continue;

  // Flat layout: <root>/MyModel/config.json  → id "MyModel"
  addIfModel(top, name);

  // Nested: <root>/org/repo/config.json  → id "org/repo"
  for (const sub of readdirSync(top)) {
    const subPath = join(top, sub);
    if (!isDir(subPath) || isSymlink(subPath)) continue;
    addIfModel(subPath, name + "/" + sub);
  }
}

const unique = [...new Set(ids)].sort();
const payload = {
  model_ids: unique,
  generated: new Date().toISOString(),
  root,
};

const outFile = join(root, "_catalog.json");
writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
console.log("Wrote", unique.length, "model ids to", outFile);
