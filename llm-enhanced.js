/**
 * llm-enhanced.js — Browser-local LLM integration for Scott Adams Adventures
 *
 * Adds three capabilities via WebLLM (in-browser, no server):
 *   A) Input translation:  natural language → VERB NOUN game commands
 *   B) Output enhancement: terse game text → immersive prose (streamed)
 *   C) Progressive hints:  room-specific hints from pre-built JSON data
 *
 * Loaded as ES module. Accesses game globals from the main <script> block.
 * Does NOT modify the Engine class — wraps handleCmd() with an async version.
 *
 * Toggle button switches between Classic (unchanged) and LLM Enhanced mode.
 * Works without WebGPU — falls back to Classic mode gracefully.
 *
 * Offline use: put MLC model files under webllm-assets/ (see README). Optional: copy
 * npm package to vendor/mlc-ai-web-llm so this script loads without the CDN.
 */

const webllm = await (async function loadWebLLM() {
  try {
    return await import(new URL('./vendor/mlc-ai-web-llm/lib/index.js', import.meta.url));
  } catch (e) {
    console.warn('[LLM] vendor/mlc-ai-web-llm missing — using CDN (needs network for this script).', e);
    return await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/lib/index.js');
  }
})();

/** Prebuilt wasm filenames for the two models in index.html (must match @mlc-ai/web-llm 0.2.x). */
const WASM_BY_MODEL_ID = {
  'Qwen3-1.7B-q4f16_1-MLC': 'Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm',
  'Qwen3-0.6B-q4f16_1-MLC': 'Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm',
};

let cachedAppConfig = null;

/** If webllm-assets/<model_id>/resolve/main/ exists, point that model at disk + local wasm (HF-style path; see scripts/ensure-webllm-resolve-layout.mjs). */
async function buildMergedAppConfig() {
  const base = webllm.prebuiltAppConfig;
  const modelsDir = new URL('webllm-assets/', window.location.href);
  const wasmDir = new URL('webllm-assets/wasm/', window.location.href);
  const list = base.model_list.map((r) => ({ ...r }));
  let anyLocal = false;
  for (const modelId of Object.keys(WASM_BY_MODEL_ID)) {
    const wasmName = WASM_BY_MODEL_ID[modelId];
    try {
      // WebLLM cleanModelUrl() appends resolve/main/ unless already present — local static server must serve that path (symlink from ensure-webllm-resolve-layout.mjs).
      const cfgUrl = new URL(modelId + '/resolve/main/mlc-chat-config.json', modelsDir).href;
      const r = await fetch(cfgUrl);
      if (!r.ok) continue;
      const idx = list.findIndex((m) => m.model_id === modelId);
      if (idx < 0) continue;
      list[idx] = {
        ...list[idx],
        model: new URL(modelId + '/resolve/main/', modelsDir).href,
        model_lib: new URL(wasmName, wasmDir).href,
      };
      anyLocal = true;
      console.log('[LLM] Local webllm-assets for', modelId);
    } catch (err) {
      console.warn('[LLM] Skip local bundle for', modelId, err);
    }
  }
  if (anyLocal) {
    console.log('[LLM] Model weights + wasm: loaded from this site (webllm-assets/) — local/offline-capable.');
  } else {
    console.log('[LLM] Model weights: default Hugging Face URLs (typical for GitHub Pages). WebLLM JS: ./vendor if present, else CDN.');
  }
  return {
    ...base,
    model_list: list,
    useIndexedDBCache: anyLocal ? true : base.useIndexedDBCache,
  };
}

async function getAppConfig() {
  if (!cachedAppConfig) cachedAppConfig = await buildMergedAppConfig();
  return cachedAppConfig;
}

// ============================================================
// STATE
// ============================================================
let llmEngine = null;           // Single MLCEngine (shared for translate/enhance/hints)
let llmMode = false;            // Toggle: false = Classic, true = LLM Enhanced
let modelLoaded = false;        // True once model is fully loaded and ready
let modelLoading = false;       // True during model download/init
let hintLevel = 0;              // Progressive hint counter for current room
let lastHintRoom = -1;          // Reset hint counter when room changes
let cachedWalkthrough = null;   // Current game's walkthrough.json
let roomHintCache = {};         // roomNum → hint JSON object
let descriptionCache = {};      // "roomNum:itemHash" → enhanced text string
let generationId = 0;           // Incremented to cancel stale LLM outputs

// ============================================================
// DOM REFERENCES
// ============================================================
const toggleBtn = document.getElementById('llm-toggle');
/** Button label when playing in Classic mode (click = turn LLM on). */
const TOGGLE_LABEL_CLASSIC_MODE = 'LLM Enhanced!';
/** Button label when LLM Enhanced is on (click = return to Classic). */
const TOGGLE_LABEL_LLM_ACTIVE = 'Classic!';
const statusEl = document.getElementById('llm-status');
const modelSelect = document.getElementById('llm-model');
const progressDiv = document.getElementById('llm-progress');
const progressBar = document.getElementById('llm-progress-bar');
const cmdEl = document.getElementById('cmd');
const outputEl = document.getElementById('output');

// ============================================================
// WEBGPU CHECK — hide LLM UI if not available
// ============================================================
if (!navigator.gpu) {
  toggleBtn.style.display = 'none';
  statusEl.textContent = '';
  console.log('[LLM] WebGPU not available — Classic mode only');
}

// ============================================================
// MODEL LIFECYCLE
// ============================================================

function friendlyError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  const m = msg.toLowerCase();
  if (m.includes('memory') || m.includes('oom') || m.includes('allocation') || m.includes('too large'))
    return 'Model too large for this device. Try the smaller 0.6B model or reload.';
  if (m.includes('device lost') || m.includes('webgpu') || m.includes('gpu'))
    return 'WebGPU error. Try refreshing the page.';
  if (m.includes('abort'))
    return 'Model loading was aborted.';
  return 'Error: ' + msg;
}

async function loadModel() {
  if (modelLoading || modelLoaded) return;
  modelLoading = true;

  const modelId = modelSelect.value;
  toggleBtn.className = 'loading';
  toggleBtn.textContent = 'Loading...';
  statusEl.textContent = 'Downloading ' + modelId + '...';
  modelSelect.style.display = 'inline-block';
  progressDiv.style.display = 'block';
  progressBar.style.width = '0%';

  try {
    llmEngine = await webllm.CreateMLCEngine(modelId, {
      appConfig: await getAppConfig(),
      initProgressCallback: (report) => {
        statusEl.textContent = report.text || '';
        // Try to extract percentage from report text
        const pctMatch = (report.text || '').match(/(\d+)%/);
        if (pctMatch) progressBar.style.width = pctMatch[1] + '%';
      },
      logLevel: 'SILENT'
    });

    modelLoaded = true;
    modelLoading = false;
    toggleBtn.className = 'active';
    toggleBtn.textContent = TOGGLE_LABEL_LLM_ACTIVE;
    statusEl.textContent = modelId.split('-').slice(0, 2).join(' ') + ' ready';
    progressDiv.style.display = 'none';

    // Pre-load walkthrough for current game
    if (window.currentGameId) {
      cachedWalkthrough = await loadWalkthrough(window.currentGameId);
    }

    console.log('[LLM] Model loaded:', modelId);
  } catch (e) {
    console.error('[LLM] Load failed:', e);
    modelLoading = false;
    modelLoaded = false;
    llmEngine = null;
    llmMode = false;
    toggleBtn.className = '';
    toggleBtn.textContent = TOGGLE_LABEL_CLASSIC_MODE;
    statusEl.textContent = friendlyError(e);
    progressDiv.style.display = 'none';
  }
}

async function switchModel() {
  if (!llmEngine || !modelLoaded) return;
  const newId = modelSelect.value;
  toggleBtn.className = 'loading';
  toggleBtn.textContent = 'Switching...';
  statusEl.textContent = 'Loading ' + newId + '...';
  progressDiv.style.display = 'block';

  try {
    await llmEngine.reload(newId);
    toggleBtn.className = 'active';
    toggleBtn.textContent = TOGGLE_LABEL_LLM_ACTIVE;
    statusEl.textContent = newId.split('-').slice(0, 2).join(' ') + ' ready';
    progressDiv.style.display = 'none';
  } catch (e) {
    statusEl.textContent = friendlyError(e);
    progressDiv.style.display = 'none';
  }
}

// Model selector change
modelSelect.addEventListener('change', () => {
  if (modelLoaded && llmMode) switchModel();
});

// ============================================================
// TOGGLE
// ============================================================

function toggleLLM() {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU required — use Chrome/Edge';
    return;
  }

  llmMode = !llmMode;

  if (llmMode) {
    modelSelect.style.display = 'inline-block';
    if (!modelLoaded && !modelLoading) {
      loadModel();
    } else if (modelLoaded) {
      toggleBtn.className = 'active';
      toggleBtn.textContent = TOGGLE_LABEL_LLM_ACTIVE;
    }
  } else {
    toggleBtn.className = '';
    toggleBtn.textContent = TOGGLE_LABEL_CLASSIC_MODE;
    statusEl.textContent = '';
    modelSelect.style.display = 'none';
    progressDiv.style.display = 'none';
  }
}

window.toggleLLM = toggleLLM;

// ============================================================
// HINT DATA LOADING
// ============================================================

async function loadRoomHints(gameId, roomNum) {
  const key = gameId + ':' + roomNum;
  if (roomHintCache[key]) return roomHintCache[key];

  const pad = String(roomNum).padStart(2, '0');
  try {
    const resp = await fetch('hints/' + gameId + '/room_' + pad + '.json');
    if (!resp.ok) return null;
    const data = await resp.json();
    roomHintCache[key] = data;
    return data;
  } catch (e) {
    return null;
  }
}

async function loadWalkthrough(gameId) {
  try {
    const resp = await fetch('hints/' + gameId + '/walkthrough.json');
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

// ============================================================
// HELPER: Get current game state for prompts
// ============================================================

function getVisibleItems() {
  const eng = window.engine;
  if (!eng) return [];
  const items = [];
  for (let i = 0; i < eng.iLoc.length; i++) {
    if (eng.iLoc[i] === eng.loc) {
      let desc = eng.g.items[i].desc.replace(/\/[^\/]*\/\s*$/, '').trim();
      if (desc) items.push(desc);
    }
  }
  return items;
}

function getInventory() {
  const eng = window.engine;
  if (!eng) return [];
  const items = [];
  for (let i = 0; i < eng.iLoc.length; i++) {
    if (eng.iLoc[i] === -1) {
      let desc = eng.g.items[i].desc.replace(/\/[^\/]*\/\s*$/, '').trim();
      if (desc) items.push(desc);
    }
  }
  return items;
}

function getRoomDescription() {
  const eng = window.engine;
  if (!eng) return '';
  const room = eng.g.rooms[eng.loc];
  if (!room) return '';
  let d = room.desc;
  if (d.startsWith('*')) return d.substring(1);
  return d ? "I'm in a " + d : '';
}

function getExitDirections() {
  const eng = window.engine;
  if (!eng) return [];
  const room = eng.g.rooms[eng.loc];
  if (!room) return [];
  const dirs = ['North', 'South', 'East', 'West', 'Up', 'Down'];
  const exits = [];
  for (let d = 0; d < 6; d++) {
    if (room.exits[d]) exits.push(dirs[d]);
  }
  return exits;
}

function getVocabNouns(roomData) {
  // Combine room-specific nouns with inventory item nouns
  const nouns = new Set();
  if (roomData && roomData.items_available) {
    roomData.items_available.forEach(n => nouns.add(n));
  }
  // Add visible item auto-get names
  const eng = window.engine;
  if (eng) {
    for (let i = 0; i < eng.g.items.length; i++) {
      if (eng.iLoc[i] === eng.loc || eng.iLoc[i] === -1) {
        if (eng.g.items[i].autoGet) nouns.add(eng.g.items[i].autoGet);
      }
    }
  }
  // Add direction nouns
  ['NORTH', 'SOUTH', 'EAST', 'WEST', 'UP', 'DOWN'].forEach(d => nouns.add(d));
  return [...nouns];
}

// ============================================================
// FEATURE A: INPUT TRANSLATION
// ============================================================

async function translateInput(rawInput, roomData) {
  if (!llmEngine || !modelLoaded) return rawInput.toUpperCase();

  const visibleItems = getVisibleItems();
  const inventory = getInventory();
  const roomDesc = getRoomDescription();
  const exits = getExitDirections();
  const nouns = getVocabNouns(roomData);

  const systemPrompt = `You translate natural language into text adventure game commands. /no_think
Output ONLY the game command (1-2 uppercase words). Nothing else. No square brackets. No explanation. No thinking.

Valid verbs: GO,GET,DROP,LOOK,OPEN,CLOSE,UNLOCK,SAY,CLIMB,READ,LIGHT,SWIM,FILL,WAVE,THROW,RUB,SCORE,INVENTORY,SAVE,HELP,JUMP,ATTACK,DRINK,EAT,WAKE,FIND,MAKE,CUT
Valid nouns: ${nouns.slice(0, 30).join(',')}

Examples:
"pick up the axe" → GET AXE
"go north" → GO NORTH
"what am I carrying" → INVENTORY
"what is the score" → SCORE
"look around" → LOOK
"open the door" → OPEN DOOR
"climb the tree" → CLIMB TREE
"say bunyon" → SAY BUNYON
"head south" → GO SOUTH
"take the lamp" → GET LAMP
"put down the key" → DROP KEY`;

  const userMsg = `Room: ${roomDesc}
Items here: ${visibleItems.join(', ') || 'none'}
Carrying: ${inventory.join(', ') || 'nothing'}
Exits: ${exits.join(', ')}

Player: "${rawInput}"
→`;

  try {
    const reply = await llmEngine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.1,
      max_tokens: 20,
      // No streaming for input — need full result before executing
    });

    let raw = (reply.choices[0]?.message?.content || '').trim();
    // Strip Qwen3 thinking blocks: <think>...</think>
    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    console.log('[LLM] Raw translation:', JSON.stringify(raw));

    // Parse: extract first line that looks like 1-2 uppercase words
    const lines = raw.split('\n');
    for (const line of lines) {
      // Strip brackets (model sometimes prints [INVENTORY] — engine needs bare INV token)
      const clean = line.replace(/[\[\]→\-\*`"']/g, '').trim().toUpperCase();
      // Match 1-2 words (letters only)
      const match = clean.match(/^([A-Z]+(?:\s+[A-Z]+)?)$/);
      if (match) return match[1];
    }

    // Fallback: just uppercase the raw output, take first 2 words
    const words = raw.toUpperCase().replace(/[^A-Z\s]/g, '').trim().split(/\s+/).slice(0, 2);
    if (words.length > 0 && words[0].length > 0) return words.join(' ');

    // Last resort: use raw input
    return rawInput.toUpperCase();
  } catch (e) {
    console.warn('[LLM] Translation failed:', e);
    return rawInput.toUpperCase();
  }
}

// ============================================================
// FEATURE B: OUTPUT ENHANCEMENT
// ============================================================

async function enhanceOutput(terseText, roomData) {
  if (!llmEngine || !modelLoaded) return;
  if (!terseText || terseText.trim().length < 10) return;

  // Skip enhancement for short responses (OK, errors, etc.)
  const stripped = terseText.replace(/<[^>]*>/g, '').trim();
  if (stripped.length < 30) return;

  // Check cache
  const eng = window.engine;
  const itemsHere = [];
  if (eng) {
    for (let i = 0; i < eng.iLoc.length; i++) {
      if (eng.iLoc[i] === eng.loc) itemsHere.push(i);
    }
  }
  const cacheKey = (eng ? eng.loc : 0) + ':' + itemsHere.join(',');
  if (descriptionCache[cacheKey]) {
    appendEnhanced(descriptionCache[cacheKey]);
    return;
  }

  const myGenId = ++generationId;
  const roomNotes = roomData ? (roomData.notes || '') : '';
  const danger = roomData ? (roomData.danger || false) : false;

  const gameTitle = cachedWalkthrough ? cachedWalkthrough.title : 'a text adventure';

  const systemPrompt = `You are the narrator of "${gameTitle}", a classic text adventure game. /no_think
Rewrite the game output as 2-3 sentences of atmospheric, immersive prose. No thinking.
Rules:
- Keep ALL items and exits mentioned in the original text
- Add NO new items, exits, or information not in the original
- Do NOT give hints, solutions, or suggestions
- Do NOT mention game mechanics
- Write in second person ("You see..." / "You stand in...")
- Keep it brief and vivid${danger ? '\n- This is a dangerous location — convey tension and unease' : ''}`;

  const userMsg = `${roomNotes ? 'Context: ' + roomNotes + '\n\n' : ''}Game output:
${stripped}

Narration:`;

  try {
    // Create the enhanced div for streaming
    const enhDiv = document.createElement('div');
    enhDiv.className = 'llm-enhanced';
    outputEl.appendChild(enhDiv);

    const chunks = await llmEngine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.7,
      max_tokens: 200,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of chunks) {
      // Cancel if player has moved on
      if (generationId !== myGenId) {
        enhDiv.remove();
        return;
      }
      const delta = chunk.choices[0]?.delta?.content || '';
      fullText += delta;
      // Strip Qwen3 thinking blocks from streamed output
      const display = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '')
                              .replace(/<think>[\s\S]*/gi, '') // partial unclosed tag
                              .trim();
      enhDiv.textContent = display;
      outputEl.scrollTop = outputEl.scrollHeight;
    }

    // Cache the cleaned result
    const cleanText = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    descriptionCache[cacheKey] = cleanText;
    enhDiv.textContent = cleanText;

  } catch (e) {
    console.warn('[LLM] Enhancement failed:', e);
    // Silently fail — terse text is already shown
  }
}

function appendEnhanced(text) {
  const div = document.createElement('div');
  div.className = 'llm-enhanced';
  div.textContent = text;
  outputEl.appendChild(div);
  outputEl.scrollTop = outputEl.scrollHeight;
}

// ============================================================
// FEATURE C: PROGRESSIVE HINTS
// ============================================================

const hintPatterns = /^(hint|help|what\s+(should|do|can)|how\s+(do|can|should)|where|stuck|clue|what\s+now|i'?m\s+stuck)/i;

function isHintRequest(input) {
  return hintPatterns.test(input.trim());
}

async function deliverHint(input, roomData) {
  if (!roomData || !roomData.hints || roomData.hints.length === 0) {
    window.appendOut('<div class="llm-enhanced">I don\'t have specific hints for this room. Try LOOK to examine your surroundings, or check your INVENTORY.</div>');
    return;
  }

  // Reset hint counter when room changes
  const eng = window.engine;
  if (eng && eng.loc !== lastHintRoom) {
    hintLevel = 0;
    lastHintRoom = eng.loc;
  }

  const hint = roomData.hints[Math.min(hintLevel, roomData.hints.length - 1)];
  const isLastHint = hintLevel >= roomData.hints.length - 1;
  hintLevel++;

  if (llmEngine && modelLoaded) {
    try {
      const reply = await llmEngine.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a friendly adventure game guide. /no_think
Present this hint to the player in a natural, encouraging way. Keep it to 1-2 sentences. Do not add any extra hints or spoilers beyond what is given. No thinking.

Hint to present: ${hint}${!isLastHint ? '\nMention they can ask for another hint if they need more help.' : ''}`
          },
          { role: 'user', content: input }
        ],
        temperature: 0.7,
        max_tokens: 100
      });
      let text = (reply.choices[0]?.message?.content || hint);
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || hint;
      window.appendOut('<div class="llm-enhanced">' + escapeHtml(text) + '</div>');
    } catch (e) {
      // Fallback to raw hint
      window.appendOut('<div class="llm-enhanced">' + escapeHtml(hint) + '</div>');
    }
  } else {
    // No LLM loaded — show raw hint
    const suffix = !isLastHint ? ' (Type HINT again for more help)' : '';
    window.appendOut('<div class="llm-enhanced">' + escapeHtml(hint) + suffix + '</div>');
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// COMMAND HANDLER — wraps the original handleCmd
// ============================================================

let isProcessing = false;

async function handleCmdEnhanced() {
  const eng = window.engine;
  if (!eng) return;
  if (isProcessing) return; // Prevent double-submit during LLM processing

  const cmd = cmdEl.value.trim();
  cmdEl.value = '';
  if (!cmd) return;

  // Add to command history (mirrors original behavior)
  // (History listener is still active from original script)

  // Echo player's input
  window.appendOut('<span style="color:#e94560">&gt; ' + escapeHtml(cmd.toUpperCase()) + '</span>');

  const upper = cmd.toUpperCase();

  // === SPECIAL INTERCEPTS (same as original) ===
  if (upper === 'MAP' || upper === 'SHOW MAP' || upper === 'M') {
    window.showMap();
    return;
  }
  if (upper === 'QUIT' || upper === 'Q') {
    window.appendOut('Thanks for playing!\n');
    eng.deathReason = 'You quit (QUIT).';
    eng.dead = true;
    window.appendOut('Why you ended: You quit (QUIT).\n');
    return;
  }
  if (upper === 'LOAD' || upper === 'RESTORE') {
    eng.doLoad();
    window.appendOut(eng.flush());
    window.loadMapState();
    window.recordMapState();
    window.showRoomImg(eng.roomNum);
    return;
  }

  // === CLASSIC MODE — unchanged behavior ===
  if (!llmMode || !modelLoaded) {
    // Check for hint request even in classic mode (uses raw hints, no LLM)
    if (isHintRequest(cmd)) {
      const roomData = await loadRoomHints(window.currentGameId, eng.loc);
      await deliverHint(cmd, roomData);
      return;
    }
    const out = eng.turn(cmd);
    window.appendOut(out);
    window.recordMapState();
    window.showRoomImg(eng.roomNum);
    return;
  }

  // === LLM ENHANCED MODE ===
  isProcessing = true;
  cmdEl.disabled = true;
  cmdEl.placeholder = 'Thinking...';

  try {
    // Cancel any in-flight enhanceOutput() from the previous command so its stream cannot reorder DOM after this turn.
    generationId++;

    const roomData = await loadRoomHints(window.currentGameId, eng.loc);

    // Check if it's a hint request
    if (isHintRequest(cmd)) {
      await deliverHint(cmd, roomData);
      return;
    }

    // Feature A: Translate natural language → VERB NOUN
    const translated = await translateInput(cmd, roomData);

    // Show translation if it differs from what the player typed
    if (translated !== upper && translated !== cmd.toUpperCase()) {
      window.appendOut('<span class="llm-translated">[' + translated + ']</span>');
    }

    // Execute through normal engine
    const prevRoom = eng.loc;
    let out = eng.turn(translated);

    // Fallback: if engine didn't understand the LLM translation, try raw input
    if (out.includes("I don't know what") && translated !== upper) {
      out = eng.turn(cmd);
    }

    window.appendOut(out);
    window.recordMapState();
    window.showRoomImg(eng.roomNum);

    // Feature B: Enhance room narration only — not I/INVENTORY/SCORE/LOOK (short meta; also avoids stream races with the next command).
    const tw = translated.trim().toUpperCase();
    const isMeta = /^(I|L|INVENTORY|SCORE|LOOK)$/.test(tw);
    if (!isMeta && (eng.loc !== prevRoom || out.length > 60)) {
      const newRoomData = await loadRoomHints(window.currentGameId, eng.loc);
      enhanceOutput(out, newRoomData);
    }

  } catch (e) {
    console.error('[LLM] Error in enhanced handler:', e);
    // Last resort fallback: run command in classic mode
    const out = eng.turn(cmd);
    window.appendOut(out);
    window.recordMapState();
    window.showRoomImg(eng.roomNum);
  } finally {
    isProcessing = false;
    cmdEl.disabled = false;
    cmdEl.placeholder = '';
    cmdEl.focus();
  }
}

// ============================================================
// OVERRIDE: Replace Enter key handler
// ============================================================

// Remove old Enter→handleCmd listener by replacing it
// The original listener calls handleCmd() on Enter, but we can't remove anonymous listeners.
// Instead, we override window.handleCmd so the original listener calls our version.
// BUT the original listener is: e => { if (e.key === 'Enter') handleCmd(); }
// handleCmd is a function-scoped name — we need to intercept at the event level.

// Strategy: Add a capturing listener that stops propagation for Enter,
// then calls our enhanced handler instead.
cmdEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.stopImmediatePropagation(); // Prevent original handleCmd listener
    handleCmdEnhanced();
  }
}, true); // 'true' = capturing phase, runs BEFORE the original bubbling listener

// ============================================================
// HOOK INTO newGame() — clear caches, load walkthrough
// ============================================================

const _originalNewGame = window.newGame;

window.newGame = async function() {
  await _originalNewGame();

  // Clear LLM caches
  roomHintCache = {};
  descriptionCache = {};
  hintLevel = 0;
  lastHintRoom = -1;
  generationId++;

  // Pre-load walkthrough if in LLM mode
  if (llmMode && modelLoaded && window.currentGameId) {
    cachedWalkthrough = await loadWalkthrough(window.currentGameId);
  }
};

// ============================================================
// INITIAL WALKTHROUGH LOAD (for the default game on page load)
// ============================================================
(async function() {
  if (window.currentGameId) {
    cachedWalkthrough = await loadWalkthrough(window.currentGameId);
  }
})();

console.log('[LLM] llm-enhanced.js loaded. Click "' + TOGGLE_LABEL_CLASSIC_MODE + '" to enable LLM mode.');
