from collections import Counter, defaultdict
from statistics import pstdev

from astraea.services import events
from astraea.services.scouting_data import (AUTO_STATUSES, CLIMBS, COLLECT_SOURCES, DRIVEBASES, ROLES, list_entries,
                                            points, team_name)

STAT_COLUMNS = [
    ('matches', 'Matches', ''),
    ('avg_points', 'Avg Points', ''),
    ('max_points', 'Best', ''),
    ('consistency', 'Std Dev', ''),
    ('avg_auto_fuel', 'Auto Fuel', ''),
    ('avg_teleop_fuel', 'Teleop Fuel', ''),
    ('accuracy', 'Accuracy', '%'),
    ('auto_climb_rate', 'Auto Climb', '%'),
    ('climb_rate', 'Climb Rate', '%'),
    ('best_climb', 'Best Climb', ''),
    ('avg_offense', 'Offense', ''),
    ('avg_defense', 'Defense', ''),
    ('bump_rate', 'Bump', '%'),
    ('trench_rate', 'Trench', '%'),
    ('role', 'Main Role', ''),
]

LOWER_IS_BETTER = {'consistency'}


def _avg(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None


def _pct(count, total):
    return round(count / total * 100) if total else None


def team_stats(entries):
    n = len(entries)
    pts = [points(e) for e in entries]
    scored = sum(e['auto_fuel_scored'] + e['teleop_fuel_scored'] for e in entries)
    missed = sum(e['auto_fuel_missed'] + e['teleop_fuel_missed'] for e in entries)
    climbed = [e['climb'] for e in entries if e['climb_success']]
    roles = Counter(e['robot_role'] for e in entries if e['robot_role'])

    return {
        'matches': n,
        'avg_points': _avg(pts),
        'max_points': max(pts),
        'min_points': min(pts),
        'consistency': round(pstdev(pts), 1) if n > 1 else 0,
        'avg_auto_fuel': _avg([e['auto_fuel_scored'] for e in entries]),
        'avg_teleop_fuel': _avg([e['teleop_fuel_scored'] for e in entries]),
        'accuracy': _pct(scored, scored + missed),
        'auto_climb_rate': _pct(sum(e['auto_climb'] for e in entries), n),
        'climb_rate': _pct(len(climbed), n),
        'best_climb': CLIMBS[max(climbed)][0] if climbed else '-',
        'avg_offense': _avg([e['offense_rating'] for e in entries]),
        'avg_defense': _avg([e['defense_rating'] for e in entries]),
        'bump_rate': _pct(sum(e['can_cross_bump'] for e in entries), n),
        'trench_rate': _pct(sum(e['can_cross_trench'] for e in entries), n),
        'role': ROLES[roles.most_common(1)[0][0]] if roles else '-',
        'partial_matches': sum(e['partial_match'] for e in entries),
    }


def filtered_entries(event='', exclude_partial=False):
    return [e for e in list_entries('match')
            if (not event or e['event'] == event) and not (exclude_partial and e['partial_match'])]


def _by_team(entries):
    teams = defaultdict(list)
    for e in entries:
        teams[e['team']].append(e)
    return teams


def rankings(event='', exclude_partial=False):
    rows = [{'team': team, 'team_name': team_name(team), **team_stats(entries)}
            for team, entries in _by_team(filtered_entries(event, exclude_partial)).items()]
    rows.sort(key=lambda r: r['avg_points'] or 0, reverse=True)
    for rank, row in enumerate(rows, 1):
        row['rank'] = rank
    return rows


def team_detail(team, event='', exclude_partial=False):
    entries = sorted((e for e in filtered_entries(event, exclude_partial) if e['team'] == team),
                     key=lambda e: (e['event'], e['match']))
    if not entries:
        return None

    collect = Counter(s for e in entries for s in e['auto_collect'] + e['teleop_collect'])
    climbs = Counter(CLIMBS[e['climb']][0] + (' (failed)' if e['climb'] != 'none' and not e['climb_success'] else '')
                     for e in entries)
    pit = [{**p, 'drivebase': DRIVEBASES.get(p['drivebase'], '')}
           for p in list_entries('pit') if p['team'] == team]

    return {
        'team': team,
        'team_name': team_name(team),
        'stats': team_stats(entries),
        'matches': [{
            **e,
            'points': points(e),
            'auto_status_label': AUTO_STATUSES[e['auto_status']],
            'role_label': ROLES.get(e['robot_role'], '-'),
            'climb_label': CLIMBS[e['climb']][0],
        } for e in entries],
        'collect': [(COLLECT_SOURCES[k], v) for k, v in collect.most_common()],
        'climbs': climbs.most_common(),
        'pit': pit,
    }


def compare(teams, event='', exclude_partial=False):
    by_team = _by_team(filtered_entries(event, exclude_partial))
    return [{'team': t, 'team_name': team_name(t), 'stats': team_stats(by_team[t]) if by_team.get(t) else None}
            for t in teams]


def best_by_column(rows):
    best = {}
    for key, _, _ in STAT_COLUMNS:
        values = [r['stats'][key] for r in rows if r['stats'] and isinstance(r['stats'][key], (int, float))]
        if len(values) > 1:
            best[key] = min(values) if key in LOWER_IS_BETTER else max(values)
    return best


def match_lookup(event, match_number, exclude_partial=False):
    match = events.get_match(event, match_number)
    if not match:
        return None
    by_team = _by_team(filtered_entries('', exclude_partial))

    def alliance(teams):
        rows = [{'team': int(t), 'team_name': team_name(t),
                 'stats': team_stats(by_team[int(t)]) if by_team.get(int(t)) else None} for t in teams]
        expected = sum(r['stats']['avg_points'] or 0 for r in rows if r['stats'])
        return {'teams': rows, 'expected': round(expected, 1),
                'missing': sum(1 for r in rows if not r['stats'])}

    return {'match_number': match_number, 'red': alliance(match['red_teams']), 'blue': alliance(match['blue_teams'])}


def teams_with_data():
    return sorted({e['team'] for e in list_entries('match')})


def events_with_data():
    return sorted({e['event'] for e in list_entries('match') if e['event']})
