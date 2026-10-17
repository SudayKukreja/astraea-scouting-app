import re

from flask import Blueprint, abort, render_template, request

from astraea.services import analytics, events

bp = Blueprint('analytics', __name__, url_prefix='/analytics')


def _filters():
    return {'event': request.args.get('event', ''), 'exclude_partial': request.args.get('exclude_partial') == '1'}


def _context(**kwargs):
    return {'filters': _filters(), 'data_events': analytics.events_with_data(),
            'columns': analytics.STAT_COLUMNS, **kwargs}


@bp.route('/')
def rankings():
    return render_template('analytics.html', **_context(rows=analytics.rankings(**_filters())))


@bp.route('/team/<int:team>')
def team(team):
    detail = analytics.team_detail(team, **_filters())
    if detail is None and team not in analytics.teams_with_data():
        abort(404)
    return render_template('team.html', **_context(team=team, detail=detail))


@bp.route('/compare')
def compare():
    raw = request.args.getlist('team') + re.findall(r'\d+', request.args.get('teams', ''))
    teams = list(dict.fromkeys(int(t) for t in raw if str(t).isdigit()))[:6]
    rows = analytics.compare(teams, **_filters()) if teams else []
    return render_template('compare.html', **_context(teams=teams, rows=rows, best=analytics.best_by_column(rows),
                                                      all_teams=analytics.teams_with_data()))


@bp.route('/match')
def match():
    stored = events.list_events()
    event = request.args.get('schedule') or events.get_current_event() or (stored[0]['key'] if stored else '')
    match_number = request.args.get('match', type=int)
    result = analytics.match_lookup(event, match_number, _filters()['exclude_partial']) if match_number else None
    total = len(events.get_matches(event))
    return render_template('match.html', **_context(stored_events=stored, schedule_event=event,
                                                    match_number=match_number, result=result, total=total))
