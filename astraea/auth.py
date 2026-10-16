import hashlib
from functools import wraps

from flask import jsonify, redirect, request, session

from astraea.storage import load_json, update_json
from astraea.reference.team_scouters import get_team_scouters

USERS_FILE = 'users.json'

DEFAULT_USERS = {
    'admin': {
        'username': 'admin',
        'password_hash': hashlib.sha256('admin6897'.encode()).hexdigest(),
        'role': 'admin'
    },
    'pit': {
        'username': 'pit',
        'password_hash': hashlib.sha256('pit6897'.encode()).hexdigest(),
        'role': 'pit_scouter',
        'name': 'Pit Scouter'
    }
}


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def load_users():
    users = load_json(USERS_FILE, {})
    required = {**DEFAULT_USERS, **get_team_scouters()}
    missing = {k: v for k, v in required.items() if k not in users}
    if missing:
        with update_json(USERS_FILE, {}) as stored:
            for username, data in missing.items():
                stored.setdefault(username, data)
            users = dict(stored)
    return users


def current_user():
    if 'user_id' not in session:
        return None
    return load_users().get(session['user_id'])


def current_role():
    user = current_user()
    return user.get('role') if user else None


def _deny(message, status):
    if request.path.startswith('/api/') or request.method != 'GET':
        return jsonify({'error': message}), status
    return redirect('/login')


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return _deny('Login required', 401)
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return _deny('Login required', 401)
        if user.get('role') != 'admin':
            return _deny('Admin access required', 403)
        return f(*args, **kwargs)
    return wrapper


def authenticate_user(username, password):
    user = load_users().get(username)
    if user and hash_password(password) == user['password_hash']:
        return user
    return None


def create_scouter(username, password, name):
    load_users()
    with update_json(USERS_FILE, {}) as users:
        if username in users:
            return False, 'Username already exists'
        users[username] = {
            'username': username,
            'password_hash': hash_password(password),
            'role': 'scouter',
            'name': name
        }
    return True, 'Scouter created successfully'


def get_all_scouters():
    return {k: v for k, v in load_users().items() if v.get('role') == 'scouter'}


def delete_scouter(username):
    with update_json(USERS_FILE, {}) as users:
        if users.get(username, {}).get('role') != 'scouter':
            return False
        del users[username]
    return True
