from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import uuid4

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from astraea.storage import load_json, update_json
from astraea.reference.team_names import TEAM_NAMES

FILES = {'match': 'scouting_data.json', 'pit': 'pit_data.json'}

COLUMNS = {
    'match': [
        ('team', 'Team'),
        ('team_name', 'Team Name'),
        ('match', 'Match'),
        ('scouter', 'Scouter'),
        ('auto_status', 'Auto Status'),
        ('auto_fuel_scored', 'Auto Fuel Scored'),
        ('auto_fuel_missed', 'Auto Fuel Missed'),
        ('auto_collect', 'Auto Collected From'),
        ('auto_climb', 'Auto Climb'),
        ('teleop_moved', 'Teleop Moved'),
        ('teleop_fuel_scored', 'Teleop Fuel Scored'),
        ('teleop_fuel_missed', 'Teleop Fuel Missed'),
        ('can_cross_bump', 'Crosses Bump'),
        ('can_cross_trench', 'Crosses Trench'),
        ('teleop_collect', 'Teleop Collected From'),
        ('robot_role', 'Role'),
        ('offense_rating', 'Offense Rating'),
        ('defense_rating', 'Defense Rating'),
        ('climb_level', 'Tower Climb'),
        ('climb_result', 'Climb Result'),
        ('partial_match', 'Partial Match'),
        ('est_points', 'Est. Points'),
        ('notes', 'Notes'),
        ('submitted_at', 'Submitted'),
    ],
    'pit': [
        ('team', 'Team'),
        ('team_name', 'Team Name'),
        ('event', 'Event'),
        ('scouter', 'Scouter'),
        ('drivebase', 'Drivebase'),
        ('avg_cycle_time', 'Avg Cycle Time (s)'),
        ('notes', 'Notes'),
        ('submitted_at', 'Submitted'),
    ],
}

SHEET_TITLES = {'match': 'Match Scouting', 'pit': 'Pit Scouting'}

COLLECT_LABELS = {'neutral': 'Neutral Zone', 'outpost': 'Outpost', 'depot': 'Depot', 'preloaded': 'Preloaded'}
ROLE_LABELS = {'offense': 'Offense', 'defense': 'Defense', 'feeder': 'Feeder', 'mix': 'Mix'}
CLIMB_LEVELS = {'level1': ('L1', 10), 'level2': ('L2', 20), 'level3': ('L3', 30)}
DRIVEBASE_LABELS = {'tank': 'Tank', 'mecanum': 'Mecanum', 'swerve': 'Swerve', 'west_coast': 'West Coast', 'other': 'Other'}
AUTO_CLIMB_POINTS = 15

EASTERN = timezone(timedelta(hours=-4))


def _now():
    return datetime.now(EASTERN).strftime('%Y-%m-%d %H:%M:%S')


def _int(value, default=0):
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _sources(values):
    return ', '.join(COLLECT_LABELS.get(v, v) for v in values or [])


def build_match_entry(data, scouter):
    auto = data.get('auto') or {}
    teleop = data.get('teleop') or {}
    endgame = data.get('endgame') or {}

    if auto.get('no_move'):
        auto_status, auto_active = "Didn't move", False
    elif auto.get('moved_no_score'):
        auto_status, auto_active = 'Moved, no score', False
    else:
        auto_status, auto_active = 'Active', True

    teleop_moved = not teleop.get('no_move')
    role = teleop.get('robot_role', '')
    offense = _int(teleop.get('offense_rating')) if role in ('offense', 'mix') else None
    defense = _int(teleop.get('defense_rating')) if role in ('defense', 'mix') else None

    level, climb_points = CLIMB_LEVELS.get(endgame.get('climb'), ('None', 0))
    climb_success = bool(endgame.get('climb_successful')) and level != 'None'

    auto_scored = _int(auto.get('fuel_scored')) if auto_active else 0
    auto_climb = auto_active and auto.get('auto_climb') == 'yes'
    teleop_scored = _int(teleop.get('fuel_scored')) if teleop_moved else 0

    return {
        'team': int(data['team']),
        'match': int(data['match']),
        'scouter': scouter,
        'auto_status': auto_status,
        'auto_fuel_scored': auto_scored,
        'auto_fuel_missed': _int(auto.get('fuel_missed')) if auto_active else 0,
        'auto_collect': _sources(auto.get('collect_sources')) if auto_active else '',
        'auto_climb': auto_climb,
        'teleop_moved': teleop_moved,
        'teleop_fuel_scored': teleop_scored,
        'teleop_fuel_missed': _int(teleop.get('fuel_missed')) if teleop_moved else 0,
        'can_cross_bump': bool(teleop.get('can_cross_bump')),
        'can_cross_trench': bool(teleop.get('can_cross_trench')),
        'teleop_collect': _sources(teleop.get('collect_sources')) if teleop_moved else '',
        'robot_role': ROLE_LABELS.get(role, ''),
        'offense_rating': offense,
        'defense_rating': defense,
        'climb_level': level,
        'climb_result': ('Success' if climb_success else 'Failed') if level != 'None' else '',
        'partial_match': bool(data.get('partial_match')),
        'est_points': auto_scored + teleop_scored
                      + (AUTO_CLIMB_POINTS if auto_climb else 0)
                      + (climb_points if climb_success else 0),
        'notes': (data.get('notes') or '').strip(),
    }


def build_pit_entry(data, scouter):
    try:
        cycle = round(float(data.get('avg_cycle_time')), 1)
    except (TypeError, ValueError):
        cycle = None
    drivebase = data.get('drivebase_type', '')
    return {
        'team': int(data['team']),
        'event': (data.get('event') or '').strip(),
        'scouter': scouter,
        'drivebase': DRIVEBASE_LABELS.get(drivebase, drivebase),
        'avg_cycle_time': cycle,
        'notes': (data.get('notes') or '').strip(),
    }


def add_entry(kind, entry):
    entry = {'id': uuid4().hex[:12], 'submitted_at': _now(), **entry}
    with update_json(FILES[kind], []) as entries:
        entries.append(entry)
    return entry


def delete_entry(kind, entry_id):
    with update_json(FILES[kind], []) as entries:
        before = len(entries)
        entries[:] = [e for e in entries if e.get('id') != entry_id]
        return len(entries) < before


def _display(value):
    if isinstance(value, bool):
        return 'Yes' if value else 'No'
    return '' if value is None else value


def get_rows(kind):
    entries = sorted(load_json(FILES[kind], []), key=lambda e: (e.get('team', 0), e.get('match', 0), e.get('submitted_at', '')))
    rows = []
    for e in entries:
        row = {key: _display(e.get(key)) for key, _ in COLUMNS[kind]}
        row['team_name'] = TEAM_NAMES.get(str(e.get('team')), '')
        row['id'] = e.get('id')
        rows.append(row)
    return rows


def table(kind):
    return {
        'columns': [{'key': k, 'label': label} for k, label in COLUMNS[kind]],
        'rows': get_rows(kind),
    }


HEADER_FILL = PatternFill('solid', fgColor='0B1F4D')
HEADER_FONT = Font(bold=True, color='FFFFFF')
PARTIAL_FILL = PatternFill('solid', fgColor='FFF3B0')


def _write_sheet(ws, kind):
    columns = COLUMNS[kind]
    ws.append([label for _, label in columns])
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical='center')

    rows = get_rows(kind)
    for row in rows:
        ws.append([row[key] for key, _ in columns])
        if row.get('partial_match') == 'Yes':
            for cell in ws[ws.max_row]:
                cell.fill = PARTIAL_FILL

    for i, (key, label) in enumerate(columns, 1):
        longest = max([len(label)] + [len(str(r[key])) for r in rows])
        ws.column_dimensions[get_column_letter(i)].width = min(longest + 3, 60)
        if key == 'notes':
            for cell in ws[get_column_letter(i)][1:]:
                cell.alignment = Alignment(wrap_text=True, vertical='top')

    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions


def export_workbook():
    wb = Workbook()
    for i, kind in enumerate(('match', 'pit')):
        ws = wb.active if i == 0 else wb.create_sheet()
        ws.title = SHEET_TITLES[kind]
        _write_sheet(ws, kind)
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
