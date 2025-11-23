from flask import session, request, jsonify
from functools import wraps
import hashlib
import secrets
import json
import os
from dev_mode import get_data_file, is_dev_user

from team_scouters import get_team_scouters

USERS_FILE = 'users.json'

DEFAULT_ADMIN = {
    'username': 'admin',
    'password_hash': hashlib.sha256('admin6897'.encode()).hexdigest(),
    'role': 'admin'
}

DEFAULT_PIT_SCOUTER = {
    'username': 'pit',
    'password_hash': hashlib.sha256('pit6897'.encode()).hexdigest(),
    'role': 'pit_scouter',
    'name': 'Pit Scouter'
}

def load_users():
    """Load users from JSON file"""
    users_file = get_data_file('users') if is_dev_user() else USERS_FILE
    if not os.path.exists(users_file):
        users = {
            'admin': DEFAULT_ADMIN,
            'pit': DEFAULT_PIT_SCOUTER
        }
        team_scouters = get_team_scouters()
        users.update(team_scouters)
        save_users(users)
        print(f"Created {len(team_scouters)} team scouters")
        return users
    
    try:
        with open(USERS_FILE, 'r') as f:
            existing_users = json.load(f)
        
        users_updated = False
        
        if 'admin' not in existing_users:
            existing_users['admin'] = DEFAULT_ADMIN
            users_updated = True

        if 'pit' not in existing_users:
            existing_users['pit'] = DEFAULT_PIT_SCOUTER
            users_updated = True
            print("Added pit scouter account")
        
        team_scouters = get_team_scouters()
        for username, scouter_data in team_scouters.items():
            if username not in existing_users:
                existing_users[username] = scouter_data
                users_updated = True
                print(f"Added team scouter: {username} ({scouter_data['name']})")
        
        if users_updated:
            save_users(existing_users)
        
        return existing_users
    except:
        users = {'admin': DEFAULT_ADMIN}
        team_scouters = get_team_scouters()
        users.update(team_scouters)
        save_users(users)
        return users

def save_users(users):
    """Save users to JSON file"""
    users_file = get_data_file('users') if is_dev_user() else USERS_FILE
    with open(users_file, 'w') as f:
        json.dump(users, f, indent=2)

def hash_password(password):
    """Hash a password"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, password_hash):
    """Verify a password against its hash"""
    return hashlib.sha256(password.encode()).hexdigest() == password_hash

def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        
        users = load_users()
        user = users.get(session['user_id'])
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def authenticate_user(username, password):
    """Authenticate a user"""
    users = load_users()
    user = users.get(username)
    
    if user and verify_password(password, user['password_hash']):
        return user
    return None

def create_scouter(username, password, name):
    """Create a new scouter account"""
    users = load_users()
    
    if username in users:
        return False, "Username already exists"
    
    users[username] = {
        'username': username,
        'password_hash': hash_password(password),
        'role': 'scouter',
        'name': name
    }
    
    save_users(users)
    return True, "Scouter created successfully"

def get_all_scouters():
    """Get all scouter accounts"""
    users = load_users()
    return {k: v for k, v in users.items() if v.get('role') == 'scouter'}

def delete_scouter(username):
    """Delete a scouter account"""
    users = load_users()
    if username in users and users[username].get('role') == 'scouter':
        del users[username]
        save_users(users)
        return True
    return False

def create_bulk_scouters(scouters_list):
    """
    Create multiple scouters at once
    scouters_list should be a list of dictionaries with keys: 'username', 'password', 'name'
    """
    users = load_users()
    created_count = 0
    errors = []
    
    for scouter_data in scouters_list:
        username = scouter_data.get('username')
        password = scouter_data.get('password')
        name = scouter_data.get('name')
        
        if not all([username, password, name]):
            errors.append(f"Missing data for scouter: {scouter_data}")
            continue
        
        if username in users:
            errors.append(f"Username '{username}' already exists")
            continue
        
        users[username] = {
            'username': username,
            'password_hash': hash_password(password),
            'role': 'scouter',
            'name': name
        }
        created_count += 1
    
    if created_count > 0:
        save_users(users)
    
    return created_count, errors