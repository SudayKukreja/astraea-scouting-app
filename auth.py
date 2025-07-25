from flask import session, request, jsonify
from functools import wraps
import hashlib
import secrets
import json
import os

# Simple user storage - in production, use a proper database
USERS_FILE = 'users.json'

# Default admin credentials
DEFAULT_ADMIN = {
    'username': 'admin',
    'password_hash': hashlib.sha256('admin123'.encode()).hexdigest(),
    'role': 'admin'
}

def load_users():
    """Load users from JSON file"""
    if not os.path.exists(USERS_FILE):
        # Create default admin user
        users = {'admin': DEFAULT_ADMIN}
        save_users(users)
        return users
    
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except:
        users = {'admin': DEFAULT_ADMIN}
        save_users(users)
        return users

def save_users(users):
    """Save users to JSON file"""
    with open(USERS_FILE, 'w') as f:
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