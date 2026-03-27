#!/usr/bin/env python3
"""
Generate hint/walkthrough JSON files for all Scott Adams adventure games.
Parses .dat files to extract rooms, items, exits, and analyzes action tables
to discover per-room puzzle solutions.

Usage: python3 generate_hints.py
Output: hints/{gameId}/room_NN.json + hints/{gameId}/walkthrough.json
"""

import json, os, re, sys
from pathlib import Path

DIR_LABELS = ['N', 'S', 'E', 'W', 'U', 'D']

GAME_META = {
    'adv01': {'title': 'Adventureland', 'year': 1978, 'difficulty': 'Beginner',
              'objective': 'Collect all 13 treasures and store them in the hollow stump.'},
    'adv02': {'title': 'Pirate Adventure', 'year': 1979, 'difficulty': 'Beginner',
              'objective': 'Find all treasures on the pirate island and bring them back.'},
    'adv03': {'title': 'Secret Mission', 'year': 1979, 'difficulty': 'Intermediate',
              'objective': 'Infiltrate the enemy saboteur base and destroy it.'},
    'adv04': {'title': 'Voodoo Castle', 'year': 1979, 'difficulty': 'Intermediate',
              'objective': 'Break the curse on Count Cristo before it is too late.'},
    'adv05': {'title': 'The Count', 'year': 1979, 'difficulty': 'Intermediate',
              'objective': 'Escape from Castle Dracula and destroy the vampire Count.'},
    'adv06': {'title': 'Strange Odyssey', 'year': 1979, 'difficulty': 'Advanced',
              'objective': 'Collect alien treasures from an alien world and return to your ship.'},
    'adv07': {'title': 'Mystery Fun House', 'year': 1981, 'difficulty': 'Intermediate',
              'objective': 'Navigate a fun house full of tricks and find the hidden treasures.'},
    'adv08': {'title': 'Pyramid of Doom', 'year': 1981, 'difficulty': 'Intermediate',
              'objective': 'Explore the pyramid, avoid traps, and collect ancient treasures.'},
    'adv09': {'title': 'Ghost Town', 'year': 1981, 'difficulty': 'Intermediate',
              'objective': 'Search the abandoned ghost town and find all the hidden treasures.'},
    'adv10': {'title': 'Savage Island Part 1', 'year': 1981, 'difficulty': 'Expert',
              'objective': 'Survive on a savage island and find a way into the volcano.'},
    'adv11': {'title': 'Savage Island Part 2', 'year': 1981, 'difficulty': 'Expert',
              'objective': 'Navigate the alien complex inside the volcano and escape.'},
    'adv12': {'title': 'Golden Voyage', 'year': 1981, 'difficulty': 'Intermediate',
              'objective': 'Sail the seas, explore islands, and collect golden treasures.'},
    'adv13': {'title': 'Sorcerer of Claymorgue Castle', 'year': 1984, 'difficulty': 'Expert',
              'objective': 'Defeat the sorcerer by collecting 13 stars hidden in the castle.'},
    'adv14a': {'title': 'Return to Pirate\'s Isle', 'year': 1984, 'difficulty': 'Intermediate',
               'objective': 'Return to the pirate island and find new treasures.'},
    'adv14b': {'title': 'Buckaroo Banzai', 'year': 1984, 'difficulty': 'Advanced',
               'objective': 'Help Buckaroo Banzai save the world from the Red Lectroids.'},
    'quest1': {'title': 'The Hulk', 'year': 1984, 'difficulty': 'Intermediate',
               'objective': 'As Bruce Banner/Hulk, collect all Gem Eggs hidden in Dr. Strange\'s domain.'},
    'quest2': {'title': 'Spiderman', 'year': 1984, 'difficulty': 'Intermediate',
               'objective': 'As Spiderman, defeat villains and collect all gems.'},
}


def tokenize(text):
    """Tokenize ScottFree .dat file into integers and strings."""
    tokens = []
    i, n = 0, len(text)
    while i < n:
        # Skip whitespace
        while i < n and text[i] in ' \t\n\r':
            i += 1
        if i >= n:
            break
        if text[i] == '"':
            i += 1
            s = ''
            while i < n and text[i] != '"':
                s += text[i]
                i += 1
            if i < n:
                i += 1
            tokens.append(s)
        elif text[i].isdigit() or text[i] == '-':
            num = ''
            if text[i] == '-':
                num = '-'
                i += 1
            while i < n and text[i].isdigit():
                num += text[i]
                i += 1
            tokens.append(int(num))
        else:
            i += 1
    return tokens


def parse_dat(filepath):
    """Parse a ScottFree .dat file and return all game data."""
    with open(filepath, 'r') as f:
        text = f.read()
    tok = tokenize(text)
    p = [0]

    def ni():
        v = tok[p[0]]
        p[0] += 1
        return v

    def ns():
        v = tok[p[0]]
        p[0] += 1
        return v

    h = {
        'id': ni(), 'numItems': ni(), 'numActions': ni(), 'numWords': ni(),
        'numRooms': ni(), 'maxCarry': ni(), 'startRoom': ni(), 'numTreasures': ni(),
        'wordLen': ni(), 'lightTime': ni(), 'numMessages': ni(), 'treasureRoom': ni()
    }

    actions = []
    for _ in range(h['numActions'] + 1):
        actions.append({
            'vocab': ni(),
            'cond': [ni(), ni(), ni(), ni(), ni()],
            'act': [ni(), ni()]
        })

    verbs, nouns = [], []
    for _ in range(h['numWords'] + 1):
        verbs.append(ns())
        nouns.append(ns())

    rooms = []
    for _ in range(h['numRooms'] + 1):
        exits = [ni(), ni(), ni(), ni(), ni(), ni()]
        desc = ns()
        rooms.append({'exits': exits, 'desc': desc})

    messages = []
    for _ in range(h['numMessages'] + 1):
        messages.append(ns())

    items = []
    for _ in range(h['numItems'] + 1):
        desc = ns()
        loc = ni()
        auto_get = ''
        m = re.search(r'/([^/]+)/\s*$', desc)
        if m:
            auto_get = m.group(1)
        items.append({'desc': desc, 'loc': loc, 'startLoc': loc, 'autoGet': auto_get})

    # Skip action comments
    action_comments = []
    for _ in range(h['numActions'] + 1):
        action_comments.append(ns())

    version = ni()
    adv_num = ni()

    return {
        'h': h, 'actions': actions, 'verbs': verbs, 'nouns': nouns,
        'rooms': rooms, 'messages': messages, 'items': items,
        'action_comments': action_comments, 'version': version, 'advNum': adv_num
    }


def get_verb_name(game, verb_id):
    """Get canonical verb name for a verb ID."""
    for i, v in enumerate(game['verbs']):
        clean = v.lstrip('*')
        if clean:
            grp = i
            for j in range(i, -1, -1):
                if not game['verbs'][j].startswith('*'):
                    grp = j
                    break
            if grp == verb_id:
                return clean
    # Direct lookup
    if 0 <= verb_id < len(game['verbs']):
        return game['verbs'][verb_id].lstrip('*')
    return f'VERB{verb_id}'


def get_noun_name(game, noun_id):
    """Get canonical noun name for a noun ID."""
    for i, n in enumerate(game['nouns']):
        clean = n.lstrip('*')
        if clean:
            grp = i
            for j in range(i, -1, -1):
                if not game['nouns'][j].startswith('*'):
                    grp = j
                    break
            if grp == noun_id:
                return clean
    if 0 <= noun_id < len(game['nouns']):
        return game['nouns'][noun_id].lstrip('*')
    return f'NOUN{noun_id}'


def analyze_actions(game):
    """Analyze the action table to find per-room actions and puzzles."""
    room_actions = {}  # room_num -> list of {verb, noun, conditions, results, comment}
    wl = game['h']['wordLen']

    for idx, action in enumerate(game['actions']):
        vocab = action['vocab']
        verb_id = vocab // 150
        noun_id = vocab % 150

        if verb_id == 0:
            continue  # Skip auto-actions

        verb_name = get_verb_name(game, verb_id)
        noun_name = get_noun_name(game, noun_id) if noun_id > 0 else ''

        # Parse conditions to find room requirements
        required_room = None
        required_items = []
        required_flags = []
        params = []

        for c in action['cond']:
            code = c % 20
            val = c // 20
            if code == 0:
                params.append(val)
            elif code == 4:  # must be in room val
                required_room = val
            elif code == 1:  # must carry item val
                if val < len(game['items']):
                    item_desc = game['items'][val]['desc'].split('/')[0].strip()
                    required_items.append(item_desc)
            elif code == 2:  # item must be here
                if val < len(game['items']):
                    item_desc = game['items'][val]['desc'].split('/')[0].strip()
                    required_items.append(f'{item_desc} (must be in room)')
            elif code == 3:  # item available (carried or here)
                if val < len(game['items']):
                    item_desc = game['items'][val]['desc'].split('/')[0].strip()
                    required_items.append(f'{item_desc} (need access)')

        # Parse action results
        results = []
        subs = [action['act'][0] // 150, action['act'][0] % 150,
                action['act'][1] // 150, action['act'][1] % 150]
        pi = 0
        for s in subs:
            if s == 0:
                continue
            if 1 <= s <= 51:
                msg = game['messages'][s] if s < len(game['messages']) else ''
                results.append(f'Message: {msg}')
            elif s >= 102:
                msg_idx = s - 50
                msg = game['messages'][msg_idx] if msg_idx < len(game['messages']) else ''
                results.append(f'Message: {msg}')
            elif s == 54 and pi < len(params):  # GOTO
                results.append(f'Move to room {params[pi]}')
                pi += 1
            elif s == 52:
                results.append('Auto-GET item')
            elif s == 53:
                results.append('Auto-DROP item')
            elif s == 55 and pi < len(params):
                results.append(f'Destroy item {params[pi]}')
                pi += 1
            elif s == 58 and pi < len(params):
                results.append(f'Set flag {params[pi]}')
                pi += 1
            elif s == 59 and pi < len(params):
                results.append(f'Clear flag {params[pi]}')
                pi += 1
            elif s == 60:
                results.append('DEATH')
            elif s == 61 and pi + 1 < len(params):
                results.append(f'Move item {params[pi]} to room {params[pi+1]}')
                pi += 2
            elif s == 63 or s == 75:
                results.append('Look around')
            elif s == 64:
                results.append('Show score')

        comment = ''
        if idx < len(game['action_comments']):
            comment = game['action_comments'][idx]

        cmd = verb_name
        if noun_name:
            cmd += ' ' + noun_name

        action_info = {
            'command': cmd,
            'verb': verb_name,
            'noun': noun_name,
            'required_items': required_items,
            'results': results,
            'comment': comment
        }

        if required_room is not None:
            if required_room not in room_actions:
                room_actions[required_room] = []
            room_actions[required_room].append(action_info)
        else:
            # Global action (works anywhere) - store under -1
            if -1 not in room_actions:
                room_actions[-1] = []
            room_actions[-1].append(action_info)

    return room_actions


def clean_item_desc(desc):
    """Remove /autoget/ suffix from item description."""
    return re.sub(r'/[^/]+/\s*$', '', desc).strip()


def get_room_name(desc):
    """Extract short room name from description."""
    if desc.startswith('*'):
        return desc[1:].strip()
    return desc.strip()


def generate_skeleton(game_id, game):
    """Generate skeleton room_NN.json and walkthrough.json for a game."""
    hints_dir = Path(f'hints/{game_id}')
    hints_dir.mkdir(parents=True, exist_ok=True)

    h = game['h']
    room_actions = analyze_actions(game)
    global_actions = room_actions.get(-1, [])

    # Items by starting room
    items_by_room = {}
    for item in game['items']:
        loc = item['startLoc']
        if loc > 0:
            if loc not in items_by_room:
                items_by_room[loc] = []
            items_by_room[loc].append(clean_item_desc(item['desc']))

    # Gettable items by room
    gettable_by_room = {}
    for item in game['items']:
        if item['autoGet'] and item['startLoc'] > 0:
            loc = item['startLoc']
            if loc not in gettable_by_room:
                gettable_by_room[loc] = []
            gettable_by_room[loc].append(item['autoGet'])

    # Treasure items
    treasures = []
    for item in game['items']:
        if '*' in item['desc']:
            treasures.append({
                'desc': clean_item_desc(item['desc']),
                'startRoom': item['startLoc']
            })

    # Generate per-room files
    for room_num in range(len(game['rooms'])):
        room = game['rooms'][room_num]
        desc = room['desc']
        if not desc:
            continue

        name = get_room_name(desc)
        full_desc = desc
        if desc.startswith('*'):
            full_desc = desc[1:]
        else:
            full_desc = "I'm in a " + desc

        exits = {}
        for d_idx in range(6):
            if room['exits'][d_idx]:
                exits[DIR_LABELS[d_idx]] = room['exits'][d_idx]

        # Get room-specific actions
        ra = room_actions.get(room_num, [])
        key_cmds = []
        for a in ra:
            key_cmds.append({
                'command': a['command'],
                'needs': a['required_items'],
                'effects': a['results']
            })

        room_data = {
            'room': room_num,
            'name': name,
            'description': full_desc,
            'items_start': items_by_room.get(room_num, []),
            'exits': exits,
            'hints': [],
            'key_actions': [a['command'] for a in ra],
            'action_details': key_cmds,
            'items_needed': [],
            'items_available': gettable_by_room.get(room_num, []),
            'danger': any('DEATH' in str(a.get('results', '')) for a in ra),
            'notes': ''
        }

        pad = str(room_num).padStart(2, '0') if hasattr(str, 'padStart') else f'{room_num:02d}'
        filepath = hints_dir / f'room_{pad}.json'
        with open(filepath, 'w') as f:
            json.dump(room_data, f, indent=2)

    # Generate walkthrough skeleton
    meta = GAME_META.get(game_id, {})
    walkthrough = {
        'game': game_id,
        'title': meta.get('title', game_id),
        'author': 'Scott Adams',
        'year': meta.get('year', 0),
        'difficulty': meta.get('difficulty', 'Unknown'),
        'objective': meta.get('objective', ''),
        'num_rooms': h['numRooms'],
        'num_treasures': h['numTreasures'],
        'treasure_room': h['treasureRoom'],
        'start_room': h['startRoom'],
        'max_carry': h['maxCarry'],
        'light_time': h['lightTime'],
        'magic_words': [],
        'key_mechanics': [],
        'treasures': [{'desc': t['desc'], 'start_room': t['startRoom']} for t in treasures],
        'vocabulary': {
            'verbs': [v for v in game['verbs'] if v and v != '*'],
            'nouns': [n for n in game['nouns'] if n and n != '*']
        },
        'walkthrough': [],
        'common_mistakes': []
    }

    filepath = hints_dir / 'walkthrough.json'
    with open(filepath, 'w') as f:
        json.dump(walkthrough, f, indent=2)

    return len(game['rooms'])


def main():
    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    dat_files = sorted(Path('.').glob('*.dat'))
    if not dat_files:
        print("No .dat files found in current directory!")
        sys.exit(1)

    total_rooms = 0
    for dat_file in dat_files:
        game_id = dat_file.stem
        if game_id == 'sampler1':
            continue  # Skip sampler

        print(f'Parsing {dat_file}...')
        try:
            game = parse_dat(str(dat_file))
            n = generate_skeleton(game_id, game)
            print(f'  → hints/{game_id}/ ({n} rooms)')
            total_rooms += n
        except Exception as e:
            print(f'  ERROR: {e}')
            import traceback
            traceback.print_exc()

    print(f'\nDone! Generated skeletons for {total_rooms} rooms across {len(dat_files)-1} games.')
    print('Now fill in hints[], items_needed[], and notes in each room_NN.json')


if __name__ == '__main__':
    main()
