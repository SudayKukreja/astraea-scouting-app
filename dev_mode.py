# dev_mode.py - Enhanced version with fake data
"""
Enhanced Developer Mode Configuration
- Supports both local and production dev mode
- Public maintenance mode
- Better dev navigation
- Fake data generation for testing
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
DEV_PASSWORD = os.environ.get('DEV_PASSWORD', 'dev123')

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

# Dev mode fake data
DEV_FAKE_DATA = {
    'events': [
        {
            'key': 'dev_2025test',
            'name': 'Dev Test Event 2025',
            'start_date': '2025-01-15',
            'end_date': '2025-01-17',
            'location': 'Virtual Testing, NJ'
        },
        {
            'key': 'dev_2025comp',
            'name': 'Dev Competition 2025',
            'start_date': '2025-02-20',
            'end_date': '2025-02-22',
            'location': 'Dev Arena, NJ'
        }
    ],
    'matches': [
        {
            'key': 'dev_2025test_qm1',
            'match_number': 1,
            'red_teams': ['254', '1323', '2468'],
            'blue_teams': ['148', '2471', '5940'],
            'all_teams': ['254', '1323', '2468', '148', '2471', '5940'],
        },
        {
            'key': 'dev_2025test_qm2',
            'match_number': 2,
            'red_teams': ['1678', '5190', '6834'],
            'blue_teams': ['973', '1114', '2056'],
            'all_teams': ['1678', '5190', '6834', '973', '1114', '2056'],
        },
        {
            'key': 'dev_2025test_qm3',
            'match_number': 3,
            'red_teams': ['6897', '1', '2'],
            'blue_teams': ['3', '4', '5'],
            'all_teams': ['6897', '1', '2', '3', '4', '5'],
        }
    ],
    'teams': ['254', '148', '1323', '2468', '2471', '5940', '1678', '5190', '6834', '973', '1114', '2056', '6897', '1', '2', '3', '4', '5'],
    'scouters': {
        'test_scouter1': {
            'username': 'test_scouter1',
            'name': 'Test Scouter 1',
            'role': 'scouter'
        },
        'test_scouter2': {
            'username': 'test_scouter2',
            'name': 'Test Scouter 2',
            'role': 'scouter'
        },
        'test_scouter3': {
            'username': 'test_scouter3',
            'name': 'Test Scouter 3',
            'role': 'scouter'
        }
    }
}

def get_dev_mock_data(data_type):
    """Get mock data for dev testing"""
    return DEV_FAKE_DATA.get(data_type, [])

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
    
    # Initialize empty files
    for key, path in DEV_FILES.items():
        if not os.path.exists(path):
            with open(path, 'w') as f:
                json.dump({}, f)
    
    # Create dev users file with dev user and test scouters
    users_path = DEV_FILES['users']
    if os.path.exists(users_path):
        with open(users_path, 'r') as f:
            existing_users = json.load(f)
    else:
        existing_users = {}
    
    # ✅ FIXED: Make dev user BOTH admin AND scouter so they can be assigned
    existing_users['dev'] = {
        'username': 'dev',
        'password_hash': 'dev',  # Plain text for dev mode
        'role': 'scouter',  # Changed from 'dev' to 'scouter' so they can be assigned
        'name': 'Developer',
        'is_dev': True  # Flag to maintain dev privileges
    }
    
    # Add admin user for dev mode
    existing_users['admin'] = {
        'username': 'admin',
        'password_hash': 'admin',
        'role': 'admin',
        'name': 'Dev Admin'
    }
    
    # Add test scouters
    for username, scouter_data in DEV_FAKE_DATA['scouters'].items():
        if username not in existing_users:
            existing_users[username] = {
                **scouter_data,
                'password_hash': 'test123'  # Simple password for testing
            }
    
    with open(users_path, 'w') as f:
        json.dump(existing_users, f, indent=2)
    
    print(f"✅ Dev mode initialized with {len(existing_users)} users")
    print(f"✅ Dev user 'dev' is now a SCOUTER and can be assigned to teams")

def reset_dev_data():
    """Reset all dev data to clean state"""
    for file_path in DEV_FILES.values():
        if os.path.exists(file_path):
            os.remove(file_path)
    init_dev_files()
    print("✅ Dev data reset complete")

def populate_dev_test_data():
    """✅ FIX: Populate dev environment with realistic test data"""
    if not is_dev_user():
        return False
    
    try:
        # Create some fake assignments
        assignments_path = DEV_FILES['assignments']
        test_assignments = {
            'dev_2025test_qm1_254': {
                'scouter': 'test_scouter1',
                'event_key': 'dev_2025test',
                'match_number': 1,
                'team_number': '254',
                'assigned_at': '2025-01-15T10:00:00',
                'completed': False
            },
            'dev_2025test_qm1_148': {
                'scouter': 'test_scouter2',
                'event_key': 'dev_2025test',
                'match_number': 1,
                'team_number': '148',
                'assigned_at': '2025-01-15T10:00:00',
                'completed': True,
                'completed_at': '2025-01-15T11:30:00'
            },
            'dev_2025test_qm2_1678': {
                'scouter': 'test_scouter1',
                'event_key': 'dev_2025test',
                'match_number': 2,
                'team_number': '1678',
                'assigned_at': '2025-01-15T10:00:00',
                'completed': False
            },
            'dev_2025test_qm3_6897': {
                'scouter': 'test_scouter3',
                'event_key': 'dev_2025test',
                'match_number': 3,
                'team_number': '6897',
                'assigned_at': '2025-01-15T10:00:00',
                'completed': False,
                'is_home_game': True
            }
        }
        
        with open(assignments_path, 'w') as f:
            json.dump(test_assignments, f, indent=2)
        
        # Create manual event
        manual_events_path = DEV_FILES['manual_events']
        test_manual_events = {
            'manual_dev_practice': {
                'name': 'Dev Practice Event',
                'key': 'manual_dev_practice',
                'created_at': '2025-01-10T09:00:00',
                'matches': [
                    {
                        'match_number': 1,
                        'red_teams': ['100', '200', '300'],
                        'blue_teams': ['400', '500', '600'],
                        'all_teams': ['100', '200', '300', '400', '500', '600']
                    },
                    {
                        'match_number': 2,
                        'red_teams': ['700', '800', '900'],
                        'blue_teams': ['1000', '1100', '1200'],
                        'all_teams': ['700', '800', '900', '1000', '1100', '1200']
                    }
                ],
                'is_manual': True
            }
        }
        
        with open(manual_events_path, 'w') as f:
            json.dump(test_manual_events, f, indent=2)
        
        print(f"✅ Populated {len(test_assignments)} test assignments")
        print(f"✅ Populated {len(test_manual_events)} test events")
        return True
    except Exception as e:
        print(f"❌ Error populating test data: {e}")
        return False