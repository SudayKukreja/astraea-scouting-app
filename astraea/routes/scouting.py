from flask import Blueprint, jsonify, request, session

from astraea.auth import login_required
from astraea.services import scouting_data
from astraea.services.assignments import get_assignment, get_scouter_assignments, mark_assignment_completed, set_home_game

bp = Blueprint('scouting', __name__)


def _is_number(value):
    return str(value or '').strip().isdigit()


@bp.route('/submit', methods=['POST'])
@login_required
def submit():
    data = request.json or {}
    if not _is_number(data.get('team')) or not _is_number(data.get('match')):
        return jsonify({'error': 'Valid team and match numbers are required'}), 400

    scouter = (data.get('name') or '').strip() or session.get('user_name', session['user_id'])
    scouting_data.add_entry('match', scouting_data.build_match_entry(data, scouter))

    if data.get('assignment_key'):
        mark_assignment_completed(data['assignment_key'])
    return jsonify({'status': 'success'})


@bp.route('/api/pit-scout/submit', methods=['POST'])
@login_required
def submit_pit_scout():
    data = request.json or {}
    if not _is_number(data.get('team')) or not (data.get('event') or '').strip():
        return jsonify({'error': 'Team number and event are required'}), 400

    scouter = session.get('user_name', session['user_id'])
    scouting_data.add_entry('pit', scouting_data.build_pit_entry(data, scouter))
    return jsonify({'status': 'success'})


@bp.route('/api/scouter/assignments')
@login_required
def scouter_assignments():
    return jsonify(get_scouter_assignments(session['user_id']))


def set_home_game_response(is_home, require_owner):
    assignment_key = (request.json or {}).get('assignment_key')
    if not assignment_key:
        return jsonify({'error': 'Assignment key required'}), 400
    assignment = get_assignment(assignment_key)
    if not assignment:
        return jsonify({'error': 'Assignment not found'}), 404
    if require_owner and assignment.get('scouter') != session['user_id']:
        return jsonify({'error': 'Not authorized for this assignment'}), 403
    set_home_game(assignment_key, is_home)
    return jsonify({'success': True})


@bp.route('/api/scouter/mark-home-game', methods=['POST'])
@login_required
def scouter_mark_home_game():
    return set_home_game_response(True, require_owner=True)


@bp.route('/api/scouter/unmark-home-game', methods=['POST'])
@login_required
def scouter_unmark_home_game():
    return set_home_game_response(False, require_owner=True)
