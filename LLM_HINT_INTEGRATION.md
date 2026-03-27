# LLM Hint System Integration Guide

How to use the pre-built hint data files with a small browser-local LLM (0.6B-2B parameters) to provide in-game hints and natural language support for Scott Adams adventures.

## Hint Data Structure

```
hints/
├── adv01/
│   ├── room_00.json        ← per-room hint file
│   ├── room_01.json
│   ├── ...
│   ├── room_33.json
│   └── walkthrough.json    ← full game walkthrough
├── adv02/
│   └── ...
└── quest2/
    └── ...
```

**498 room files** across 17 games, plus 17 walkthrough files.

## Per-Room File Format (`room_NN.json`)

Each file is small (~500 bytes-2KB) — designed to fit in a tiny LLM context window.

```json
{
  "room": 11,
  "name": "forest",
  "description": "I'm in a forest",
  "items_start": ["Trees"],
  "exits": { "N": 11, "S": 25, "E": 23, "W": 11 },
  "hints": [
    "There's something interesting about the trees here.",
    "Have you tried climbing? Think vertically.",
    "Type CLIMB TREE to reach the treetop above.",
    "CLIMB TREE → treetop (room 28). EAST → meadow (room 23). N/S/W loop back."
  ],
  "key_actions": ["GO TRE", "HEL"],
  "action_details": [
    {
      "command": "GO TRE",
      "needs": [],
      "effects": ["Move to room 28", "Show score"]
    }
  ],
  "items_needed": [],
  "items_available": [],
  "danger": false,
  "notes": "Starting room. Forest loops N/S/W. CLIMB TREE is the key action."
}
```

### Fields

| Field | Type | Purpose |
|-------|------|---------|
| `room` | int | Room number (matches `room_NN.json` and `images/{game}/room_NN.png`) |
| `name` | string | Short room name |
| `description` | string | Exact game text shown to player |
| `items_start` | string[] | Items in this room at game start |
| `exits` | object | Direction → target room number |
| `hints` | string[] | **2-4 progressive hints**: gentle → moderate → exact command → full solution |
| `key_actions` | string[] | Exact commands that do something here |
| `action_details` | object[] | What each action requires and does |
| `items_needed` | string[] | Items player should bring here |
| `items_available` | string[] | Items that can be picked up here |
| `danger` | bool | True if room has traps/death |
| `notes` | string | Context for the LLM about this room's role |

## Walkthrough File Format (`walkthrough.json`)

Larger file (~5-20KB) for smarter models (2B+) that can handle more context.

```json
{
  "game": "adv01",
  "title": "Adventureland",
  "author": "Scott Adams",
  "year": 1978,
  "difficulty": "Beginner",
  "objective": "Collect all 13 treasures and store them in the hollow stump.",
  "magic_words": ["BUNYON", "FEE FIE FOE FOO"],
  "key_mechanics": [
    "Light source has limited fuel — manage it carefully",
    "Say BUNYON near the axe to trigger Paul Bunyon"
  ],
  "walkthrough": [
    {"step": 1, "room": 11, "action": "CLIMB TREE", "result": "Reach treetop"},
    {"step": 2, "room": 2, "action": "GET KEYS", "result": "Pick up keys"}
  ],
  "treasures": [
    {"desc": "*GOLDEN FISH*", "start_room": 0}
  ],
  "common_mistakes": [
    "Don't waste lamp turns exploring the maze"
  ],
  "vocabulary": {
    "verbs": ["GO", "GET", "DRO", "CLI", ...],
    "nouns": ["NOR", "SOU", "AXE", "KEY", ...]
  }
}
```

## How to Load Hint Data (JavaScript)

```javascript
// Load per-room hints for current location
async function loadRoomHints(gameId, roomNum) {
  const pad = String(roomNum).padStart(2, '0');
  const url = `hints/${gameId}/room_${pad}.json`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

// Load full walkthrough (for smarter models)
async function loadWalkthrough(gameId) {
  try {
    const resp = await fetch(`hints/${gameId}/walkthrough.json`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}
```

## LLM Prompt Templates

### For a 0.6B model (minimal context, just room hints)

```
You are a hint assistant for a text adventure game.
The player is in: {room.description}
Items here: {room.items_start}
Exits: {room.exits}

Available hints (give ONE at a time, from gentle to specific):
1. {room.hints[0]}
2. {room.hints[1]}
3. {room.hints[2]}

The player asks: "{player_input}"

If they want a hint, give hint #1 first. If they ask for more, give #2, then #3.
If they want to do something, translate to: VERB NOUN (from the game vocabulary).
Keep responses short (1-2 sentences).
```

### For a 1.5-2B model (room hints + game context)

```
You are a friendly guide for "{walkthrough.title}" ({walkthrough.year}), a classic text adventure.
Objective: {walkthrough.objective}
Difficulty: {walkthrough.difficulty}
Magic words in this game: {walkthrough.magic_words}

Current room: {room.description}
Items visible: {room.items_start}
Exits: {room.exits}
Danger: {room.danger}

Progressive hints for this room:
1. {room.hints[0]}
2. {room.hints[1]}
3. {room.hints[2]}
4. {room.hints[3]}

Key actions here: {room.key_actions}
Items needed here: {room.items_needed}
Room notes: {room.notes}

The player says: "{player_input}"

Rules:
- Give hints progressively (gentle first, specific later)
- If translating a command, output: {"verb": "GET", "noun": "AXE"}
- Never spoil the whole solution unless explicitly asked
- Reference the game setting and theme in your responses
- Keep it fun and encouraging
```

### For a 2B+ model (full walkthrough available)

Same as above, but append:
```
Full walkthrough context (for reference, do NOT dump this to the player):
Current step in walkthrough: {nearest_step}
Next recommended action: {walkthrough.walkthrough[next_step]}
Common mistakes: {walkthrough.common_mistakes}
```

## Progressive Hint System

The hint arrays are designed for gradual revelation:

| Hint Level | Style | Example |
|-----------|-------|---------|
| `hints[0]` | **Gentle nudge** | "There's something interesting about the trees here." |
| `hints[1]` | **Moderate direction** | "Have you tried climbing? Think vertically." |
| `hints[2]` | **Specific command** | "Type CLIMB TREE to reach the treetop above." |
| `hints[3]` | **Full solution** | "CLIMB TREE → room 28. EAST → meadow. N/S/W loop back." |

**Implementation**: Track a `hintLevel` counter per room. Each time the player asks for a hint, increment and show the next level. Reset when they move to a new room.

```javascript
let hintLevel = 0;
let lastHintRoom = -1;

function getNextHint(roomData) {
  if (engine.loc !== lastHintRoom) {
    hintLevel = 0;
    lastHintRoom = engine.loc;
  }
  const hint = roomData.hints[Math.min(hintLevel, roomData.hints.length - 1)];
  hintLevel++;
  return hint;
}
```

## Recommended LLM Setup

### Framework: WebLLM (MLC AI)
- WebGPU-accelerated browser inference
- OpenAI-compatible API
- CDN: `https://esm.run/@mlc-ai/web-llm`
- Caches model in IndexedDB after first download

### Recommended Models

| Model | Download | Best For |
|-------|----------|----------|
| **Qwen3.5-2B** | ~1-1.5GB | Best quality hints + command translation |
| **Qwen2.5-1.5B** | ~500MB | Good balance of size and capability |
| **Qwen2.5-0.5B** | ~200MB | Ultra-light, hint retrieval only |

### Basic WebLLM Setup

```javascript
import { CreateMLCEngine } from "@mlc-ai/web-llm";

// One-time model load (cached after first download)
const llm = await CreateMLCEngine("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");

// Per-turn: load room hints, build prompt, get response
const roomData = await loadRoomHints(currentGameId, engine.loc);
const prompt = buildPrompt(roomData, playerInput);
const response = await llm.chat.completions.create({
  messages: [{ role: "user", content: prompt }],
  max_tokens: 150,
  temperature: 0.7
});
```

## UI Integration

### Toggle Button
```html
<button id="mode-btn" onclick="toggleMode()">Classic</button>
```
- **Classic Mode** (default): commands go directly to game engine
- **LLM Mode**: commands preprocessed by local model

### Command Flow in LLM Mode
```
Player types: "what's in the tree?"
  → Load hints/adv01/room_11.json
  → Build prompt with room context + player input
  → LLM returns: {"hint": "There's something interesting up there. Try CLIMB TREE."}
  → Display hint in italic gold text
  → Player types: "climb the tree"
  → LLM returns: {"verb": "GO", "noun": "TRE"}
  → Show: [→ CLIMB TREE] in muted text
  → engine.turn("GO TRE")
  → Normal game output
```

### Hint Request Detection
```javascript
const hintPatterns = /^(hint|help|what|how|where|stuck|clue)/i;
if (hintPatterns.test(playerInput)) {
  // Use progressive hint system
} else {
  // Translate to game command
}
```

## File Sizes

| Content | Files | Total Size |
|---------|-------|-----------|
| Per-room hints | 498 | ~400KB |
| Walkthroughs | 17 | ~150KB |
| **Total** | **515** | **~550KB** |

All files are static JSON served from GitHub Pages — no server needed.

## Testing Without LLM

The hint data works without any LLM at all. A simple JavaScript implementation could:
1. Fetch `room_NN.json` on room change
2. Show `hints[0]` when player types HINT
3. Show `hints[1]` on second HINT, etc.
4. Show `notes` and `items_needed` for context

This provides immediate value while the LLM integration is developed.
