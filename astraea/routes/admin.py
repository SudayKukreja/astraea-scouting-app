from flask import Blueprint, jsonify, request

from astraea.auth import admin_required, create_scouter, delete_scouter, get_all_scouters
from astraea.routes.scouting import set_home_game_response
from astraea.services.assignments import (bulk_assign_match, bulk_assign_team_to_scouter, clear_event_assignments,
                                          clear_match_assignments, get_all_assignments, get_match_summary,
                                          remove_assignment, remove_team_assignments)
from astraea.services.events import (create_manual_event, delete_manual_event, get_event_matches, get_event_teams,
                                     list_manual_events)

HOME_TEAM = '6897'

bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def _body():
    return request.json or {}


def _missing(*fields):
    return jsonify({'error': f"{', '.join(fields)} required"}), 400


@bp.route('/manual-events', methods=['GET'])
@admin_required
def get_manual_events():
    return jsonify(list_manual_events())


@bp.route('/manual-events', methods=['POST'])
@admin_required
def create_manual_event_route():
    event_name = _body().get('event_name', '').strip()
    matches = _body().get('matches', [])
    if not event_name:
        return _missing('Event name')
    if not matches:
        return jsonify({'error': 'At least one match is required'}), 400
    event_key = create_manual_event(event_name, matches)
    return jsonify({'success': True, 'event_key': event_key,
                    'message': f'Manual event "{event_name}" created successfully'})


@bp.route('/manual-events/<event_key>', methods=['DELETE'])
@admin_required
def delete_manual_event_route(event_key):
    if delete_manual_event(event_key):
        return jsonify({'success': True})
    return jsonify({'error': 'Event not found'}), 404


@bp.route('/matches')
@admin_required
def get_matches():
    event_key = request.args.get('event')
    if not event_key:
        return _missing('Event key')
    return jsonify(get_event_matches(event_key))


@bp.route('/teams')
@admin_required
def get_teams():
    event_key = request.args.get('event')
    if not event_key:
        return _missing('Event key')
    return jsonify(get_event_teams(event_key))


@bp.route('/auto-assign', methods=['POST'])
@admin_required
def auto_assign_teams():
    event_key = _body().get('event_key')
    if not event_key:
        return _missing('Event key')

    scouters = get_all_scouters()
    if not scouters:
        return jsonify({'error': 'No scouters found'}), 400

    matches = get_event_matches(event_key)
    teams = [t for t in get_event_teams(event_key) if t != HOME_TEAM]
    if not teams:
        return jsonify({'error': 'No teams available for assignment'}), 400

    usernames = list(scouters)
    assignments = []
    for i, team in enumerate(teams):
        username = usernames[i % len(usernames)]
        bulk_assign_team_to_scouter(username, event_key, team, matches)
        assignments.append({'team': team, 'scouter_username': username,
                            'scouter_name': scouters[username].get('name', username)})

    return jsonify({'success': True, 'assignments': assignments, 'total_assignments': len(assignments)})


@bp.route('/clear-all-assignments', methods=['POST'])
@admin_required
def clear_all_assignments():
    event_key = _body().get('event_key')
    if not event_key:
        return _missing('Event key')
    removed = clear_event_assignments(event_key)
    return jsonify({'success': True, 'message': f'Cleared {removed} assignments', 'removed_count': removed})


@bp.route('/bulk-assign-team', methods=['POST'])
@admin_required
def bulk_assign_team():
    data = _body()
    event_key, team, scouter = data.get('event_key'), data.get('team_number'), data.get('scouter_username')
    if not all([event_key, team, scouter]):
        return _missing('Event key', 'team number', 'scouter')

    matches = get_event_matches(event_key)
    if not matches:
        return jsonify({'error': 'Could not load matches for this event'}), 500
    return jsonify({'success': True, 'message': bulk_assign_team_to_scouter(scouter, event_key, str(team), matches)})


@bp.route('/remove-team-assignments', methods=['POST'])
@admin_required
def remove_team_assignments_route():
    data = _body()
    if not all([data.get('event_key'), data.get('team_number')]):
        return _missing('Event key', 'team number')
    removed = remove_team_assignments(data['event_key'], str(data['team_number']))
    return jsonify({'success': True, 'removed_count': removed})


@bp.route('/scouters')
@admin_required
def get_scouters():
    return jsonify(get_all_scouters())


@bp.route('/scouter-stats')
@admin_required
def get_scouter_stats():
    stats = {u: {'assigned': 0, 'completed': 0} for u in get_all_scouters()}
    for a in get_all_assignments().values():
        s = stats.get(a.get('scouter'))
        if s:
            s['assigned'] += 1
            s['completed'] += bool(a.get('completed'))
    return jsonify(stats)


@bp.route('/create-scouter', methods=['POST'])
@admin_required
def create_new_scouter():
    data = _body()
    name, username, password = data.get('name'), data.get('username'), data.get('password')
    if not all([name, username, password]):
        return jsonify({'error': 'All fields are required'}), 400
    success, message = create_scouter(username, password, name)
    if success:
        return jsonify({'success': True, 'message': message})
    return jsonify({'error': message}), 400


@bp.route('/scouters/<username>', methods=['DELETE'])
@admin_required
def delete_scouter_account(username):
    if delete_scouter(username):
        return jsonify({'success': True})
    return jsonify({'error': 'Scouter not found'}), 404


@bp.route('/assign-match', methods=['POST'])
@admin_required
def assign_match():
    data = _body()
    if not all([data.get('event_key'), data.get('match_number')]):
        return _missing('Event key', 'match number')
    bulk_assign_match(data['event_key'], data['match_number'], data.get('assignments', {}))
    return jsonify({'success': True})


@bp.route('/assignments')
@admin_required
def get_admin_assignments():
    assignments = get_all_assignments(request.args.get('event'))
    return jsonify([{'assignment_key': k, **a} for k, a in assignments.items()])


@bp.route('/remove-individual-assignment', methods=['POST'])
@admin_required
def remove_individual_assignment():
    assignment_key = _body().get('assignment_key')
    if not assignment_key:
        return _missing('Assignment key')
    if remove_assignment(assignment_key):
        return jsonify({'success': True, 'message': 'Assignment removed successfully'})
    return jsonify({'error': 'Assignment not found'}), 404


@bp.route('/clear-match-assignments', methods=['POST'])
@admin_required
def clear_match_assignments_route():
    data = _body()
    if not all([data.get('event_key'), data.get('match_number')]):
        return _missing('Event key', 'match number')
    match_number = int(data['match_number'])
    removed = clear_match_assignments(data['event_key'], match_number)
    return jsonify({'success': True, 'removed_count': removed,
                    'message': f'Cleared {removed} assignments from match {match_number}'})


@bp.route('/match-summary')
@admin_required
def match_summary():
    return jsonify(get_match_summary(request.args.get('event')))


@bp.route('/mark-home-game', methods=['POST'])
@admin_required
def mark_home_game():
    return set_home_game_response(True, require_owner=False)


@bp.route('/unmark-home-game', methods=['POST'])
@admin_required
def unmark_home_game():
    return set_home_game_response(False, require_owner=False)
