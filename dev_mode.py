# dev_mode.py - Enhanced version
"""
Enhanced Developer Mode Configuration
- Supports both local and production dev mode
- Public maintenance mode
- Better dev navigation
"""

import os
import json
from functools import wraps
from flask import session, request, jsonify, redirect, render_template_string

# Dev mode can be enabled via environment variable OR session
def is_dev_mode():
    """Check if dev mode is enabled globally (blocks public access)"""
    return os.environ.get('DEV_MODE', 'False').lower() == 'true'

def is_dev_user():
    """Check if current user has dev access"""
    return session.get('is_dev_user', False) or session.get('user_id') == 'dev'

# Dev credentials
DEV_USERNAME = 'dev'
DEV_PASSWORD = os.environ.get('DEV_PASSWORD', 'dev123')  # Set this in Render

# Maintenance mode template
MAINTENANCE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Under Maintenance - Astraea Scouting</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .maintenance-container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 600px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .maintenance-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        
        h1 {
            color: #1e293b;
            font-size: 32px;
            margin-bottom: 16px;
        }
        
        p {
            color: #64748b;
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        
        .dev-login-btn {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        
        .dev-login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(245, 158, 11, 0.4);
        }
        
        .status-dots {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin-top: 40px;
        }
        
        .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #cbd5e1;
            animation: pulse 1.5s infinite;
        }
        
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="maintenance-container">
        <div class="maintenance-icon">🔧</div>
        <h1>We'll Be Right Back!</h1>
        <p>
            We're currently making some improvements to the Astraea Scouting System. 
            We should be back online shortly.
        </p>
        <p style="font-size: 14px; color: #94a3b8;">
            If you're a developer, you can access the dev dashboard below.
        </p>
        <a href="/dev-login" class="dev-login-btn">Developer Access →</a>
        <div class="status-dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    </div>
</body>
</html>
"""

def maintenance_required(f):
    """Decorator to show maintenance page when dev mode is active"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # If dev mode is active AND user is not a dev user
        if is_dev_mode() and not is_dev_user():
            return render_template_string(MAINTENANCE_TEMPLATE), 503
        return f(*args, **kwargs)
    return decorated_function

def dev_login_required(f):
    """Decorator for dev-only routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_dev_user():
            return jsonify({'error': 'Dev access required'}), 403
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

# Dev mode mock data
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

def get_dev_mock_data(data_type):
    """Get mock data for dev testing"""
    return DEV_MOCK_DATA.get(data_type, [])

# Dev-specific file paths
DEV_FILES = {
    'assignments': 'dev_assignments.json',
    'users': 'dev_users.json',
    'manual_events': 'dev_manual_events.json'
}

def get_data_file(file_key):
    """Get appropriate data file based on dev mode"""
    if is_dev_user():
        return DEV_FILES.get(file_key)
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
    
    for key, path in DEV_FILES.items():
        if not os.path.exists(path):
            with open(path, 'w') as f:
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

def reset_dev_data():
    """Reset all dev data to clean state"""
    for file_path in DEV_FILES.values():
        if os.path.exists(file_path):
            os.remove(file_path)
    init_dev_files()