from flask import Blueprint, abort, render_template, request

from astraea.reference.team_names import TEAM_NAMES
from astraea.services import events, scouting_data

bp = Blueprint('pages', __name__)


def _editing(kind):
    entry_id = request.args.get('edit')
    if not entry_id:
        return None
    entry = scouting_data.get_entry(kind, entry_id)
    if not entry:
        abort(404)
    return entry


@bp.route('/')
def entry():
    current = events.get_current_event()
    return render_template('entry.html',
                           editing=_editing('match'),
                           events=events.list_events(),
                           current_event=current,
                           schedule=events.get_matches(current),
                           team_names=TEAM_NAMES)


@bp.route('/pit')
def pit():
    return render_template('pit.html',
                           editing=_editing('pit'),
                           events=events.list_events(),
                           current_event=events.get_current_event(),
                           drivebases=scouting_data.DRIVEBASES)


@bp.route('/data')
def data():
    return render_template('data.html')
