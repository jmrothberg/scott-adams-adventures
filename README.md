# Scott Adams Adventures - Browser Edition

Play all 17 classic Scott Adams text adventures (1978-84) right in your browser. These are the original TRS-80 / Apple II era games that launched the home computer adventure game genre.

## Play Now

**https://jmrothberg.github.io/scott-adams-adventures/**

## How to Play

- **Select a game** from the dropdown menu and click **New Game**
- **Type commands** in the input field and press Enter
- Commands are **two words**: a verb and a noun (e.g., `GET AXE`, `GO NORTH`, `OPEN DOOR`)
- Words can be abbreviated to 3 letters (e.g., `GET AXE` = `GET AXE`)

### Shortcuts

| Key | Action |
|-----|--------|
| `N` `S` `E` `W` `U` `D` | Move North/South/East/West/Up/Down |
| `I` | Show inventory |
| `L` | Look around |
| `SCORE` | Check your score |
| `HELP` | Get a hint (when available) |
| `SAVE` | Save game (to browser storage) |
| `LOAD` | Restore saved game |
| `QUIT` | End game |

### Tips

- **Draw a map** on paper as you explore - you will get lost without one
- **Examine everything** - items often have clues
- **Read signs** - they contain important hints
- Treasures are marked with `*asterisks*` - collect them and store them at the treasure room
- Type `SCORE` to see how many treasures you've stored
- If you die, you end up in Limbo - look for an exit to continue

## The Games

| # | Game | Difficulty | Description |
|---|------|-----------|-------------|
| 1 | Adventureland | Moderate | Find 13 lost treasures in an enchanted realm with wild animals and magical beings |
| 2 | Pirate Adventure | Beginner | Explore a tropical island to find Long John Silver's lost treasures |
| 3 | Secret Mission | Advanced | Race the clock to save the world's first automated nuclear reactor |
| 4 | Voodoo Castle | Moderate | Break a fiendish curse to rescue the Count |
| 5 | The Count | Moderate | Wake up in a Transylvanian castle. Why did the postman deliver blood? |
| 6 | Strange Odyssey | Moderate | Harvest treasures from a long-dead alien civilization at the galaxy's rim |
| 7 | Mystery Fun House | Moderate | Escape a carnival fun house - you're NOT here to have a good time |
| 8 | Pyramid of Doom | Moderate | Plunder jewels and gold from crumbling ruins in the desert |
| 9 | Ghost Town | Advanced | Search a once-thriving mining town for 13 hidden treasures |
| 10 | Savage Island Pt.1 | Advanced | A small island holds an awesome secret. For experienced adventurers only |
| 11 | Savage Island Pt.2 | Advanced | The conclusion - requires the password from Part 1 |
| 12 | Golden Voyage | Advanced | Three days to bring back the elixir to save the dying king |
| 13 | Sorcerer of Claymorgue | Advanced | Recover 13 stolen Stars of Power as a wizard's apprentice |
| 14a | Return to Pirate's Isle | Moderate | Return to the world of Pirate Adventure |
| 14b | Buckaroo Banzai | Moderate | Based on the movie - save the world from the Red Lectroids |
| Q1 | The Hulk | Moderate | Questprobe #1 - you are Bruce Banner / The Incredible Hulk |
| Q2 | Spiderman | Moderate | Questprobe #2 - save the day as Spider-Man |

## Adding Room Images

The interpreter supports optional images for each room. When an image exists, it displays automatically. When it doesn't, nothing happens - the game works fine either way.

### Image format

```
images/room_NN.png
```

Where `NN` is the **two-digit room number** (zero-padded): `room_00.png`, `room_01.png`, etc.

### Per-game images

Since each game has its own set of rooms, images are loaded based on the **currently active game's room numbers**. To support images for multiple games, you can organize them in subfolders and the interpreter will look in `images/`:

To generate images, see the per-game room guides in the `image_guides/` folder. Each guide lists every room with a description suitable for use as an image generation prompt.

### Quick start for adding images

1. Pick a game (e.g., Adventureland = `adv01.dat`)
2. Open `image_guides/adv01_adventureland.md` for the room list and image prompts
3. Generate images using your preferred diffusion model (Stable Diffusion, DALL-E, Midjourney, etc.)
4. Save as `images/room_01.png`, `images/room_02.png`, etc.
5. Push to the repo - they'll appear in the game automatically

**Recommended style:** Pixel art or retro illustration, 400x250px or similar landscape ratio, to match the 1980s adventure game aesthetic.

## Credits

- All games (c) 1978-1984 by Scott Adams / Adventure International
- Games written by Scott Adams, with contributions from Alexis Adams, Alvin Files, Russ Wetmore, William Demas, and Phillip Case
- Data files in ScottFree format, converted by Paul David Doherty
- Browser interpreter built 2026

These games are shareware. See `0readme.txt` for the original shareware notice.
