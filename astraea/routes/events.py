from flask import Blueprint, flash, redirect, render_template, request, url_for

from astraea.services import events
from astraea.services.events import ScheduleError
from astraea.services.tba import TBAError

bp = Blueprint('events', __name__, url_prefix='/events')


@bp.route('/')
def index():
    return render_template('events.html', events=events.list_events(), current_event=events.get_current_event())


@bp.route('/tba', methods=['POST'])
def load_tba():
    key = request.form.get('event_key', '').strip()
    if not key:
        flash('Enter an event key', 'error')
    else:
        try:
            name, count = events.load_tba_event(key)
            flash(f'Loaded {name}: {count} qualification matches', 'success')
        except TBAError as e:
            flash(str(e), 'error')
    return redirect(url_for('events.index'))


@bp.route('/manual', methods=['POST'])
def create_manual():
    try:
        _, count = events.create_manual_event(request.form.get('name', ''), request.form.get('schedule', ''))
        flash(f'Created event with {count} matches', 'success')
    except ScheduleError as e:
        flash(str(e), 'error')
    return redirect(url_for('events.index'))


@bp.route('/current', methods=['POST'])
def set_current():
    events.set_current_event(request.form.get('event_key', ''))
    flash('Current event updated', 'success')
    return redirect(url_for('events.index'))


@bp.route('/<event_key>/delete', methods=['POST'])
def delete(event_key):
    events.delete_event(event_key)
    flash('Event deleted', 'success')
    return redirect(url_for('events.index'))
