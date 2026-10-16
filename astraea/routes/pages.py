import os

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, send_from_directory, session

from astraea.auth import admin_required, authenticate_user, current_role, login_required

bp = Blueprint('pages', __name__)


def home_for_role(role):
    return '/admin' if role == 'admin' else '/dashboard'


@bp.route('/')
def home():
    role = current_role()
    return redirect(home_for_role(role) if role else '/login')


@bp.route('/login')
def login_page():
    role = current_role()
    if role:
        return redirect(home_for_role(role))
    return render_template('login.html')


@bp.route('/api/login', methods=['POST'])
def api_login():
    data = request.json or {}
    user = authenticate_user(data.get('username', ''), data.get('password', ''))
    if not user:
        return jsonify({'error': 'Invalid username or password'}), 401
    session['user_id'] = data['username']
    session['user_name'] = user.get('name', data['username'])
    return jsonify({'success': True, 'role': user.get('role', 'scouter')})


@bp.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})


@bp.route('/admin')
@admin_required
def admin_dashboard():
    return render_template('admin_dashboard.html')


@bp.route('/dashboard')
@login_required
def scouter_dashboard():
    if current_role() == 'pit_scouter':
        return redirect('/pit-scout')
    return render_template('scouter_dashboard.html')


def is_preview():
    return request.args.get('preview') == '1' and current_role() == 'admin'


@bp.route('/scout')
@login_required
def scout_form():
    return render_template('scout_form.html',
                           preview=is_preview(),
                           prefill_team=request.args.get('team', ''),
                           prefill_match=request.args.get('match', ''))


@bp.route('/pit-scout')
@login_required
def pit_scout_form():
    if current_role() not in ('pit_scouter', 'admin'):
        return redirect('/dashboard')
    return render_template('pit_scout.html',
                           preview=is_preview(),
                           prefill_team=request.args.get('team', ''),
                           prefill_event=request.args.get('event', ''))


@bp.route('/sw.js')
def service_worker():
    return send_from_directory(os.path.join(current_app.static_folder, 'js'), 'sw.js',
                               mimetype='application/javascript', max_age=0)
