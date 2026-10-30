"""Extract Customs WR's sheet (Records tab CSV export) into data/seed.json."""
import csv, json, re, sys, collections
SRC = sys.argv[1]; OUT = sys.argv[2]
rows = list(csv.reader(open(SRC, encoding='utf-8')))
N = max(len(r) for r in rows)
def cell(r, j): return rows[r][j] if j < len(rows[r]) else ''
def idx(c):
    n = 0
    for ch in c: n = n*26 + ord(ch) - 64
    return n - 1
def num(s):
    s = s.strip().replace(',', '')
    try: return float(s) if s != '' else None
    except: return None
EMOJI = {'⚔️': 'Top', '⚔': 'Top', '🌳': 'Jungle', '🧙': 'Mid', '🏹': 'Bottom', '✨': 'Support'}
ROLES = ['Top', 'Jungle', 'Mid', 'Bottom', 'Support']
def role_of(s):
    for k, v in EMOJI.items():
        if k in s: return v
    return None
def norm(s): return re.sub(r'[^a-z0-9]', '', re.sub(r'\(.*?\)', '', s).lower())

REC = list(range(2, 48)); MMR = list(range(55, 105))
RENAME = {'CharlezardPotato': 'Charlezard'}
# match record rows to MMR rows by name, falling back to explicit pairs
EXPLICIT = {'his ride': 'Abdalla', 'Khango': 'Beepo', 'MiiChi': 'MiiChii'}
mmr_by_name = {norm(rows[m][0]): m for m in MMR}
players = []
for i in REC:
    raw = rows[i][0].strip()
    name = RENAME.get(raw, raw)
    key = norm(EXPLICIT.get(raw, name))
    m = mmr_by_name[key]
    mmr_name = rows[m][0].strip()
    display = EXPLICIT.get(raw, name) if raw in ('his ride', 'Khango') else name
    players.append(dict(rec_row=i, mmr_row=m, name=display, raw=raw))
assert len({p['name'] for p in players}) == len(players)

# game columns
G = idx('G')
cols = [j for j in range(G, N) if any(cell(i, j).strip() for i in REC)]
# dates from row 1, propagated
date_hdr = {}
cur = None
for j in range(G, N):
    v = cell(0, j).strip().rstrip(':')
    if v: cur = v
    date_hdr[j] = cur
def parse_dates(cols):
    out = {}; year = 2024; prev_m = 8
    seen = {}
    for j in cols:
        h = date_hdr[j]
        if h in seen: out[j] = seen[h]; continue
        parts = h.split('/')
        mth, day = int(parts[0]), int(parts[1])
        if len(parts) == 3:
            y = int(parts[2]); y = y + 2000 if y < 100 else y
            year = y
        else:
            if mth < prev_m: year += 1
        prev_m = mth
        # "9/11" etc after explicit year: keep rolling
        seen[h] = f'{year:04d}-{mth:02d}-{day:02d}'
        out[j] = seen[h]
    return out
dates = parse_dates(cols)

IL = idx('IL')
matches = []; mp = []
for seq, j in enumerate(cols, 1):
    ext = cell(1, j).strip() or None
    note = None
    entries = []
    for p in players:
        v = cell(p['rec_row'], j).strip()
        if not v: continue
        res = 'W' if v.startswith('W') else 'L' if v.startswith('L') else None
        if not res: print('unparsed', p['name'], j, repr(v)); continue
        role = role_of(v)
        mm = num(cell(p['mmr_row'], j))
        entries.append(dict(player=p['name'], result=res, role=role, mmr_after=mm))
    w = sum(e['result'] == 'W' for e in entries); l = len(entries) - w
    matches.append(dict(seq=seq, date=dates[j], external_id=ext, incomplete=not (w == 5 and l == 5), entries=entries))


# per-game baseline in force (reconstructed: sheet rebases at these columns; base = MMR in the column to the left)
REBASE = {idx(c) for c in ('FB', 'HR', 'IA', 'IM')}
base_at = {}
for p in players:
    m = p['mmr_row']; prev = None; base = None
    for j in range(1, N):
        v = num(cell(m, j))
        if prev is None:
            if v is not None: prev = v; base = v
            continue
        if j in REBASE: base = prev
        base_at[(p['name'], j)] = base
        if v is not None: prev = v
col_of_seq = {seq: j for seq, j in enumerate(cols, 1)}
for mt in matches:
    j = col_of_seq[mt['seq']]
    for e in mt['entries']:
        e['base_mmr'] = base_at.get((e['player'], j))

# players detail
out_players = []
for p in players:
    r, m = p['rec_row'], p['mmr_row']
    b = cell(r, 1).strip()
    playable = sorted({role_of(c) for c in re.findall(r'⚔️|⚔|🌳|🧙|🏹|✨', b)} - {None}, key=ROLES.index)
    played = {e['role'] for mt in matches for e in mt['entries'] if e['player'] == p['name'] and e['role']}
    playable = sorted(set(playable) | played, key=ROLES.index)
    vals = [(j, num(cell(m, j))) for j in range(1, N) if num(cell(m, j)) is not None]
    start = vals[0][1]
    cur_mmr = vals[-1][1]
    il = num(cell(m, IL))
    baseline = il if il is not None else start
    out_players.append(dict(name=p['name'], start_mmr=start, baseline_mmr=baseline, current_mmr=cur_mmr,
                            playable_roles=playable, sheet_wins=num(cell(r, 2)), sheet_losses=num(cell(r, 3))))

ONE_TRICKS = {"Top": ["Twami", "MarysLittleLamb"], "Jungle": ["Sytris", "esqueleto25"], "Mid": ["kruthik", "Charlezard"],
              "Bottom": ["VintageStrats"], "Support": ["jaythebluejay"]}
json.dump(dict(players=out_players, matches=matches, one_tricks=ONE_TRICKS), open(OUT, 'w'), ensure_ascii=False, indent=1)

# validation against sheet W/L
tally = collections.defaultdict(lambda: [0, 0])
for mt in matches:
    for e in mt['entries']: tally[e['player']][0 if e['result'] == 'W' else 1] += 1
bad = 0
for p in out_players:
    w, l = tally[p['name']]
    sw, sl = p['sheet_wins'], p['sheet_losses']
    if sw is None or sl is None: print('no sheet WL', p['name'], w, l); continue
    if (w, l) != (int(sw), int(sl)): bad += 1; print('WL MISMATCH', p['name'], (w, l), (int(sw), int(sl)))
print('players', len(out_players), 'matches', len(matches), 'incomplete', sum(m['incomplete'] for m in matches), 'WL mismatches', bad)
print('dates', matches[0]['date'], '->', matches[-1]['date'])
