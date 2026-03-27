#!/usr/bin/env python3
"""Parse all Scott Adams .dat files and extract items by room."""
import re, glob, os

DAT_DIR = "/Users/jonathanrothberg/Scott_Adams_Adventures/scott-adams-adventures"

def tokenize(text):
    """Extract all tokens (integers and quoted strings) from dat file."""
    tokens = []
    i = 0
    while i < len(text):
        if text[i] == '"':
            j = i + 1
            while j < len(text) and text[j] != '"':
                j += 1
            tokens.append(('str', text[i+1:j]))
            i = j + 1
        elif text[i] in '-0123456789':
            j = i + 1
            while j < len(text) and text[j] in '0123456789':
                j += 1
            tokens.append(('int', int(text[i:j])))
            i = j
        else:
            i += 1
    return tokens

def parse_dat(filepath):
    with open(filepath) as f:
        text = f.read()
    tokens = tokenize(text)

    # Header: 12 integers
    idx = 0
    header = []
    for i in range(12):
        assert tokens[idx][0] == 'int', f"Expected int at {idx}, got {tokens[idx]}"
        header.append(tokens[idx][1])
        idx += 1

    num_items = header[1]      # 0-indexed count
    num_actions = header[2]
    num_words = header[3]
    num_rooms = header[4]
    max_carry = header[5]
    start_room = header[6]
    num_treasures = header[7]
    word_len = header[8]
    light_time = header[9]
    num_messages = header[10]
    treasure_room = header[11]

    # Actions: (num_actions+1) entries, 8 ints each
    for i in range(num_actions + 1):
        for j in range(8):
            idx += 1

    # Vocabulary: (num_words+1) pairs of strings
    for i in range(num_words + 1):
        idx += 1  # verb
        idx += 1  # noun

    # Rooms: (num_rooms+1) entries, 6 ints + 1 string each
    rooms = {}
    for i in range(num_rooms + 1):
        exits = []
        for j in range(6):
            assert tokens[idx][0] == 'int'
            exits.append(tokens[idx][1])
            idx += 1
        assert tokens[idx][0] == 'str'
        desc = tokens[idx][1]
        idx += 1
        # Clean up description
        desc = desc.replace('\n', ' ').strip()
        if desc.startswith('*'):
            desc = desc[1:]
        rooms[i] = desc

    # Messages: (num_messages+1) strings
    for i in range(num_messages + 1):
        idx += 1

    # Items: (num_items+1) entries, 1 string + 1 int each
    items = {}
    for i in range(num_items + 1):
        assert tokens[idx][0] == 'str'
        item_desc = tokens[idx][1]
        idx += 1
        assert tokens[idx][0] == 'int'
        item_room = tokens[idx][1]
        idx += 1

        # Clean item name (remove /WORD/ aliases)
        clean = re.sub(r'/\w+/', '', item_desc).strip()
        if clean and item_room > 0:
            if item_room not in items:
                items[item_room] = []
            items[item_room].append(clean)

    return rooms, items, start_room

# Process all .dat files
for datfile in sorted(glob.glob(os.path.join(DAT_DIR, "*.dat"))):
    basename = os.path.basename(datfile).replace('.dat', '')
    if basename == 'sampler1':
        continue

    try:
        rooms, items, start = parse_dat(datfile)
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"ERROR parsing {basename}: {e}")
        continue

    print(f"\n{'='*60}")
    print(f"GAME: {basename} (start room: {start})")
    print(f"{'='*60}")

    for room_num in sorted(rooms.keys()):
        if room_num == 0 and not rooms[room_num]:
            continue
        room_items = items.get(room_num, [])
        if room_items:
            desc = rooms[room_num] if rooms[room_num] else "(no description)"
            print(f"\nRoom {room_num}: {desc}")
            for item in room_items:
                print(f"  - {item}")
