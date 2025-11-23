# dev_mode.py
"""
Developer Mode Configuration
Provides isolated testing environment with mock data and bypassed authentication
"""

import os
import json
from functools import wraps
from flask import session, request, jsonify, redirect

# Dev mode flag - set via environment variable
DEV_MODE = os.environ.get('DEV_MODE', 'False').lower() == 'true'

# Dev credentials
DEV_USERNAME = 'dev'
DEV_PASSWORD = 'dev123'  # Change this to something secure

# Mock data for dev testing
DEV_MOCK_DATA = {
    'events': [
        {
            'key': 'dev_2025test',
            'name': 'Dev Test Event 2025',
            'start_date': '2025-01-01',
            'end_date': '2025-01-03',
            'location': 'Test Location, NJ'
        }
    ],
    'matches': [
        {
            'key': 'dev_2025test_qm1',
            'match_number': 1,
            'red_teams': ['1', '2', '3'],
            'blue_teams': ['4', '5', '6'],
            'all_teams': ['1', '2', '3', '4', '5', '6']
        },
        {
            'key': 'dev_2025test_qm2',
            'match_number': 2,
            'red_teams': ['7', '8', '9'],
            'blue_teams': ['10', '11', '12'],
            'all_teams': ['7', '8', '9', '10', '11', '12']
        }
    ],
    'teams': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
}

def is_dev_mode():
    """Check if app is in dev mode"""
    return DEV_MODE

def is_dev_user():
    """Check if current user is a dev user"""
    return session.get('is_dev_user', False)

def dev_login_required(f):
    """Decorator for dev-only routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_dev_mode():
            return jsonify({'error': 'Dev mode not enabled'}), 403
        if not is_dev_user():
            return jsonify({'error': 'Dev login required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def authenticate_dev(username, password):
    """Authenticate dev user"""
    if username == DEV_USERNAME and password == DEV_PASSWORD:
        return {
            'username': username,
            'role': 'dev',
            'name': 'Developer',
            'is_dev': True
        }
    return None

def get_dev_mock_data(data_type):
    """Get mock data for dev testing"""
    return DEV_MOCK_DATA.get(data_type, [])

# Dev-specific file paths (separate from production)
DEV_FILES = {
    'assignments': 'dev_assignments.json',
    'users': 'dev_users.json',
    'manual_events': 'dev_manual_events.json'
}

def get_data_file(file_key):
    """Get appropriate data file based on dev mode"""
    if is_dev_user():
        return DEV_FILES.get(file_key)
    # Return normal file paths
    file_map = {
        'assignments': 'assignments.json',
        'users': 'users.json',
        'manual_events': 'manual_events.json'
    }
    return file_map.get(file_key)

def init_dev_files():
    """Initialize dev data files with sample data"""
    if not is_dev_mode():
        return
    
    # Create dev assignments file
    if not os.path.exists(DEV_FILES['assignments']):
        with open(DEV_FILES['assignments'], 'w') as f:
            json.dump({}, f)
    
    # Create dev users file with dev user
    if not os.path.exists(DEV_FILES['users']):
        import hashlib
        dev_users = {
            'dev': {
                'username': 'dev',
                'password_hash': hashlib.sha256(DEV_PASSWORD.encode()).hexdigest(),
                'role': 'dev',
                'name': 'Developer'
            }
        }
        with open(DEV_FILES['users'], 'w') as f:
            json.dump(dev_users, f, indent=2)
    
    # Create dev manual events file
    if not os.path.exists(DEV_FILES['manual_events']):
        with open(DEV_FILES['manual_events'], 'w') as f:
            json.dump({}, f)

def reset_dev_data():
    """Reset all dev data to clean state"""
    for file_path in DEV_FILES.values():
        if os.path.exists(file_path):
            os.remove(file_path)
    init_dev_files()