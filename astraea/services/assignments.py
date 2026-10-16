from datetime import datetime

from astraea.storage import load_json, update_json

ASSIGNMENTS_FILE = 'assignments.json'


def load_assignments():
    return load_json(ASSIGNMENTS_FILE, {})


def _new_assignment(scouter, event_key, match_number, team_number):
    return {
        'scouter': scouter,
        'event_key': event_key,
        'match_number': match_number,
        'team_number': team_number,
        'assigned_at': datetime.now().isoformat(),
        'completed': False
    }


def _key(event_key, match_number, team_number):
    return f'{event_key}_qm{match_number}_{team_number}'


def bulk_assign_team_to_scouter(scouter_username, event_key, team_number, matches):
    count = 0
    with update_json(ASSIGNMENTS_FILE, {}) as assignments:
        for match in matches:
            if team_number in match['all_teams']:
                assignments[_key(event_key, match['match_number'], team_number)] = _new_assignment(
                    scouter_username, event_key, match['match_number'], team_number)
                count += 1
    return f'Assigned {scouter_username} to team {team_number} for {count} matches'


def bulk_assign_match(event_key, match_number, team_assignments):
    with update_json(ASSIGNMENTS_FILE, {}) as assignments:
        for team_number, scouter_username in team_assignments.items():
            if scouter_username:
                assignments[_key(event_key, match_number, team_number)] = _new_assignment(
                    scouter_username, event_key, match_number, team_number)


def get_scouter_assignments(scouter_username):
    result = [
        {'assignment_key': key, **a}
        for key, a in load_assignments().items()
        if a.get('scouter') == scouter_username
    ]
    return sorted(result, key=lambda a: a['match_number'])


def get_all_assignments(event_key=None):
    assignments = load_assignments()
    if event_key:
        return {k: v for k, v in assignments.items() if v.get('event_key') == event_key}
    return assignments


def get_assignment(assignment_key):
    return load_assignments().get(assignment_key)


def _update_assignment(assignment_key, **fields):
    with update_json(ASSIGNMENTS_FILE, {}) as assignments:
        if assignment_key not in assignments:
            return False
        assignments[assignment_key].update(fields)
    return True


def mark_assignment_completed(assignment_key):
    return _update_assignment(assignment_key, completed=True, completed_at=datetime.now().isoformat())


def set_home_game(assignment_key, is_home):
    return _update_assignment(assignment_key, is_home_game=is_home)


def _remove_where(predicate):
    with update_json(ASSIGNMENTS_FILE, {}) as assignments:
        doomed = [k for k, a in assignments.items() if predicate(k, a)]
        for k in doomed:
            del assignments[k]
    return len(doomed)


def remove_assignment(assignment_key):
    return _remove_where(lambda k, a: k == assignment_key) > 0


def remove_team_assignments(event_key, team_number):
    return _remove_where(lambda k, a: a.get('event_key') == event_key and a.get('team_number') == team_number)


def clear_match_assignments(event_key, match_number):
    return _remove_where(lambda k, a: a.get('event_key') == event_key and a.get('match_number') == match_number)


def clear_event_assignments(event_key):
    return _remove_where(lambda k, a: a.get('event_key') == event_key)


def get_match_summary(event_key=None):
    assignments = get_all_assignments(event_key).values()
    home = sum(1 for a in assignments if a.get('is_home_game'))
    completed = sum(1 for a in assignments if a.get('completed') and not a.get('is_home_game'))
    return {
        'total_assignments': len(assignments),
        'completed': completed,
        'home_games': home,
        'pending': len(assignments) - home - completed
    }
