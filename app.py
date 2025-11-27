from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import os, json
import re
from datetime import datetime
import requests

# Import our new modules
from auth import login_required, admin_required, authenticate_user, create_scouter, get_all_scouters, delete_scouter
from database import (assign_scouter_to_team, get_scouter_assignments, get_match_assignments, 
                     mark_assignment_completed, bulk_assign_match, get_all_assignments,
                     bulk_assign_team_to_scouter, remove_team_assignments)
from manual_matches import (create_manual_event, get_manual_event_matches, get_manual_event_teams,
                           list_manual_events, delete_manual_event, is_manual_event)
from tba_api import TBAClient, get_sample_matches
from team_names import TEAM_NAMES

# Add these imports after your other imports
from dotenv import load_dotenv
load_dotenv()  # Load .env file for local development

from dev_mode import (
    is_dev_mode, 
    is_dev_user, 
    authenticate_dev, 
    get_dev_mock_data, 
    get_data_file,
    init_dev_files,
    reset_dev_data,
    dev_login_required,
    maintenance_required,
    populate_dev_test_data
)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
CORS(app)

# Initialize dev mode if enabled
if is_dev_mode():
    print("🚀 DEV MODE ENABLED - Using isolated dev environment")
    init_dev_files()

# === CONFIGURATIONS AREA =====
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '16nYGy_cVkEWtsRl64S5dlRn45wMLqSfFvHA8z7jjJc8'
SHEET_NAME = 'Brunswick Eruption'
SHEET_ID = 1546014881 
PIT_SHEET_NAME = 'Pit Scouting'
PIT_SHEET_ID = 0  #TODO: Update this with actual sheet ID after creating the sheet
# ==============================

credentials_info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
creds = service_account.Credentials.from_service_account_info(credentials_info, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()

tba_client = TBAClient(api_key=os.environ.get('TBA_API_KEY'))

def analyze_team_performance(matches):
    """Analyze team performance data to create structured insights for AI"""
    if not matches:
        return {}
    
    total_matches = len(matches)
    
    # Basic scoring stats
    total_scores = [match.get('totalScore', 0) for match in matches]
    auto_scores = [match.get('auto', {}).get('score', 0) for match in matches]
    teleop_scores = [match.get('teleop', {}).get('score', 0) for match in matches]
    
    avg_total_score = sum(total_scores) / total_matches if total_matches > 0 else 0
    avg_auto_score = sum(auto_scores) / total_matches if total_matches > 0 else 0
    avg_teleop_score = sum(teleop_scores) / total_matches if total_matches > 0 else 0
    
    best_score = max(total_scores) if total_scores else 0
    worst_score = min(total_scores) if total_scores else 0
    best_match = matches[total_scores.index(best_score)].get('match', 'Unknown') if total_scores else 'Unknown'
    worst_match = matches[total_scores.index(worst_score)].get('match', 'Unknown') if total_scores else 'Unknown'
    
    # Consistency calculation
    if len(total_scores) > 1:
        variance = sum((score - avg_total_score) ** 2 for score in total_scores) / len(total_scores)
        std_dev = variance ** 0.5
        if std_dev < 10:
            consistency_rating = "Very Consistent"
        elif std_dev < 20:
            consistency_rating = "Moderately Consistent"
        else:
            consistency_rating = "Inconsistent"
    else:
        consistency_rating = "Insufficient Data"
    
    # Game piece analysis
    auto_breakdown = analyze_scoring_breakdown(matches, 'auto')
    teleop_breakdown = analyze_scoring_breakdown(matches, 'teleop')
    
    # Dropped pieces
    dropped_pieces = []
    for match in matches:
        auto_dropped = match.get('auto', {}).get('droppedPieces', 0)
        teleop_dropped = match.get('teleop', {}).get('droppedPieces', 0)
        dropped_pieces.append(auto_dropped + teleop_dropped)
    
    avg_dropped_pieces = sum(dropped_pieces) / len(dropped_pieces) if dropped_pieces else 0
    
    # Ratings
    offense_ratings = [match.get('teleop', {}).get('offenseRating', 0) for match in matches]
    defense_ratings = [match.get('teleop', {}).get('defenseRating', 0) for match in matches]
    avg_offense_rating = sum(offense_ratings) / len(offense_ratings) if offense_ratings else 0
    avg_defense_rating = sum(defense_ratings) / len(defense_ratings) if defense_ratings else 0
    
    # Endgame analysis
    climb_attempts = sum(1 for match in matches if match.get('endgame', {}).get('action') == 'climb')
    successful_climbs = sum(1 for match in matches 
                          if match.get('endgame', {}).get('action') == 'climb' 
                          and match.get('endgame', {}).get('climbSuccessful', False))
    
    climb_success_rate = (successful_climbs / climb_attempts * 100) if climb_attempts > 0 else 0
    
    # Endgame preference
    endgame_actions = [match.get('endgame', {}).get('action', 'none') for match in matches]
    endgame_counts = {}
    for action in endgame_actions:
        endgame_counts[action] = endgame_counts.get(action, 0) + 1
    
    endgame_preference = max(endgame_counts, key=endgame_counts.get) if endgame_counts else 'Unknown'
    
    # Performance trend
    if total_matches >= 4:
        first_half_avg = sum(total_scores[:len(total_scores)//2]) / (len(total_scores)//2)
        second_half_avg = sum(total_scores[len(total_scores)//2:]) / (len(total_scores) - len(total_scores)//2)
        
        if second_half_avg > first_half_avg + 5:
            performance_trend = "Improving"
        elif first_half_avg > second_half_avg + 5:
            performance_trend = "Declining"
        else:
            performance_trend = "Stable"
    else:
        performance_trend = "Insufficient Data"
    
    # Partial matches
    partial_matches = sum(1 for match in matches if match.get('partialMatch', False))
    
    return {
        'total_matches': total_matches,
        'avg_total_score': avg_total_score,
        'avg_auto_score': avg_auto_score,
        'avg_teleop_score': avg_teleop_score,
        'best_score': best_score,
        'worst_score': worst_score,
        'best_match': best_match,
        'worst_match': worst_match,
        'consistency_rating': consistency_rating,
        'auto_breakdown': auto_breakdown,
        'teleop_breakdown': teleop_breakdown,
        'avg_dropped_pieces': avg_dropped_pieces,
        'avg_offense_rating': avg_offense_rating,
        'avg_defense_rating': avg_defense_rating,
        'climb_attempts': climb_attempts,
        'successful_climbs': successful_climbs,
        'climb_success_rate': climb_success_rate,
        'endgame_preference': endgame_preference,
        'performance_trend': performance_trend,
        'partial_matches': partial_matches
    }


def analyze_scoring_breakdown(matches, phase):
    """Analyze scoring breakdown for auto or teleop phase"""
    breakdown = {
        'll1': 0, 'l2': 0, 'l3': 0, 'l4': 0, 
        'processor': 0, 'barge': 0
    }
    
    total_matches = len(matches)
    if total_matches == 0:
        return "No data available"
    
    for match in matches:
        phase_data = match.get(phase, {})
        for key in breakdown.keys():
            breakdown[key] += phase_data.get(key, 0)
    
    # Calculate averages
    avg_breakdown = {key: value / total_matches for key, value in breakdown.items()}
    
    # Format as readable string
    breakdown_str = f"L1:{avg_breakdown['ll1']:.1f}, L2:{avg_breakdown['l2']:.1f}, L3:{avg_breakdown['l3']:.1f}, L4:{avg_breakdown['l4']:.1f}, Processor:{avg_breakdown['processor']:.1f}, Barge:{avg_breakdown['barge']:.1f}"
    
    return breakdown_str

@app.route('/login')
@maintenance_required
def login_page():
    if 'user_id' in session:
        from auth import load_users
        users = load_users()
        user = users.get(session['user_id'])
        if user and user.get('role') == 'admin':
            return redirect('/admin')
        else:
            return redirect('/dashboard')
    return render_template('login.html')

@app.route('/dev-login')
def dev_login_page():
    """Special login page for devs during maintenance mode"""
    if is_dev_user():
        return redirect('/dev')
    
    return render_template('dev_login.html')

@app.route('/api/dev-login', methods=['POST'])
def api_dev_login():
    """Dev-specific login endpoint"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = authenticate_dev(username, password)
    if user:
        session['user_id'] = username
        session['user_name'] = user.get('name', username)
        session['is_dev_user'] = True
        return jsonify({
            'success': True,
            'role': 'dev'
        })
    else:
        return jsonify({'error': 'Invalid dev credentials'}), 401

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Try dev authentication first if dev mode is enabled
    if is_dev_mode() and username == 'dev':
        user = authenticate_dev(username, password)
        if user:
            session['user_id'] = username
            session['user_name'] = user.get('name', username)
            session['is_dev_user'] = True
            return jsonify({
                'success': True,
                'role': 'dev',
                'dev_mode': True
            })
    
    # Regular authentication
    user = authenticate_user(username, password)
    if user:
        session['user_id'] = username
        session['user_name'] = user.get('name', username)
        session['is_dev_user'] = False
        return jsonify({
            'success': True,
            'role': user.get('role', 'scouter')
        })
    else:
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/analytics')
@admin_required
def analytics_dashboard():
    """Serve the analytics dashboard page"""
    return render_template('analytics_dashboard.html')

@app.route('/api/admin/analytics/data')
@admin_required
def get_analytics_data():
    """Get all scouting data for analytics"""
    try:
        # Read all data from the Google Sheet
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID, 
            range=f'{SHEET_NAME}!A1:Z1000'
        ).execute()
        
        all_values = result.get('values', [])
        analytics_data = []
        
        current_team = None
        
        for row in all_values:
            if not row:  # Skip empty rows
                continue
                
            # Check if this is a team header row
            if len(row) > 0 and row[0].startswith('Team '):
                team_match = re.match(r'Team (\d+):', row[0])
                if team_match:
                    current_team = team_match.group(1)
                continue
            
            # Check if this is the column header row
            if len(row) > 0 and row[0] == 'Scouter Name':
                continue
                
            # Skip rows that don't have enough data
            if len(row) < 10:
                continue
                
            # Parse the data row
            try:
                scouter_name = row[0] if len(row) > 0 else ''
                team_number = row[1] if len(row) > 1 else current_team or ''
                match_number = row[2] if len(row) > 2 else ''
                submission_time = row[3] if len(row) > 3 else ''
                auto_summary = row[4] if len(row) > 4 else ''
                teleop_summary = row[5] if len(row) > 5 else ''
                offense_rating = row[6] if len(row) > 6 else '0'
                defense_rating = row[7] if len(row) > 7 else '0'
                endgame_summary = row[8] if len(row) > 8 else ''
                partial_match = row[9] if len(row) > 9 else 'No'
                notes = row[10] if len(row) > 10 else ''
                
                # Skip if essential data is missing
                if not scouter_name or not team_number or not match_number:
                    continue
                    
                # Parse auto data from summary
                auto_data = parse_auto_summary(auto_summary)
                
                # Parse teleop data from summary
                teleop_data = parse_teleop_summary(teleop_summary)
                
                # Parse endgame data
                endgame_data = parse_endgame_summary(endgame_summary)
                
                # Calculate scores (simplified scoring system)
                auto_score = calculate_auto_score(auto_data)
                teleop_score = calculate_teleop_score(teleop_data)
                endgame_score = calculate_endgame_score(endgame_data)
                total_score = auto_score + teleop_score + endgame_score
                
                # Parse submission time
                try:
                    submission_datetime = datetime.strptime(submission_time, "%m/%d/%Y %I:%M:%S %p")
                except:
                    submission_datetime = datetime.now()
                
                # Create analytics entry
                analytics_entry = {
                    'team': team_number,
                    'match': int(match_number) if match_number.isdigit() else 0,
                    'scouterName': scouter_name,
                    'submissionTime': submission_datetime.isoformat(),
                    'event': 'current_event',  # You might want to track this differently
                    'auto': {
                        'score': auto_score,
                        **auto_data
                    },
                    'teleop': {
                        'score': teleop_score,
                        'offenseRating': safe_int(offense_rating),
                        'defenseRating': safe_int(defense_rating),
                        **teleop_data
                    },
                    'endgame': {
                        'score': endgame_score,
                        **endgame_data
                    },
                    'totalScore': total_score,
                    'notes': notes,
                    'partialMatch': partial_match.lower() == 'yes'
                }
                
                analytics_data.append(analytics_entry)
                
            except Exception as e:
                print(f"Error parsing row {row}: {str(e)}")
                continue
        
        return jsonify(analytics_data)
        
    except Exception as e:
        print(f"Error fetching analytics data: {str(e)}")
        return jsonify({'error': 'Failed to fetch analytics data'}), 500

def safe_int(value, default=0):
    """Safely convert value to int"""
    try:
        if value == '-' or value == '':
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

def parse_auto_summary(summary):
    """Parse auto summary string into structured data"""
    if not summary:
        return {'ll1': 0, 'l2': 0, 'l3': 0, 'l4': 0, 'processor': 0, 'barge': 0, 'droppedPieces': 0}
    
    data = {'ll1': 0, 'l2': 0, 'l3': 0, 'l4': 0, 'processor': 0, 'barge': 0, 'droppedPieces': 0}
    
    if "Didn't move in auto" in summary:
        return data
    elif "Only moved forward" in summary:
        # Extract dropped pieces if present
        dropped_match = re.search(r'Dropped:(\d+)', summary)
        if dropped_match:
            data['droppedPieces'] = int(dropped_match.group(1))
        return data
    
    # Parse scoring data: "L1:2, L2:1, L3:0, L4:1, P:1, B:0, Dropped:1"
    patterns = {
        'll1': r'L1:(\d+)',
        'l2': r'L2:(\d+)',
        'l3': r'L3:(\d+)',
        'l4': r'L4:(\d+)',
        'processor': r'P:(\d+)',
        'barge': r'B:(\d+)',
        'droppedPieces': r'Dropped:(\d+)'
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, summary)
        if match:
            data[key] = int(match.group(1))
    
    return data

def parse_teleop_summary(summary):
    """Parse teleop summary string into structured data"""
    if not summary:
        return {'ll1': 0, 'l2': 0, 'l3': 0, 'l4': 0, 'processor': 0, 'barge': 0, 'droppedPieces': 0}
    
    data = {'ll1': 0, 'l2': 0, 'l3': 0, 'l4': 0, 'processor': 0, 'barge': 0, 'droppedPieces': 0}
    
    if "Didn't move in teleop" in summary:
        return data
    
    # Parse scoring data: "L1:5, L2:3, L3:1, L4:0, P:2, B:1, Dropped:2"
    patterns = {
        'll1': r'L1:(\d+)',
        'l2': r'L2:(\d+)',
        'l3': r'L3:(\d+)',
        'l4': r'L4:(\d+)',
        'processor': r'P:(\d+)',
        'barge': r'B:(\d+)',
        'droppedPieces': r'Dropped:(\d+)'
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, summary)
        if match:
            data[key] = int(match.group(1))
    
    return data

def parse_endgame_summary(summary):
    """Parse endgame summary string into structured data"""
    if not summary:
        return {'action': 'did not park/climb', 'climbDepth': '', 'climbSuccessful': False, 'climbParked': False}
    
    summary_lower = summary.lower()
    
    # Check for "did not park/climb" first to avoid false positives
    if 'did not park/climb' in summary_lower or 'did not park' in summary_lower:
        return {
            'action': 'did not park/climb',
            'climbDepth': '',
            'climbSuccessful': False,
            'climbParked': False
        }
    elif 'park' in summary_lower and 'climb' not in summary_lower:
        return {
            'action': 'park',
            'climbDepth': '',
            'climbSuccessful': False,
            'climbParked': False
        }
    elif 'climb' in summary_lower:
        action = 'climb'
        climb_depth = 'shallow' if 'shallow' in summary_lower else 'deep' if 'deep' in summary_lower else 'unknown'
        climb_successful = 'success' in summary_lower
        climb_parked = 'failed but parked' in summary_lower or 'parked' in summary_lower
        return {
            'action': action,
            'climbDepth': climb_depth,
            'climbSuccessful': climb_successful,
            'climbParked': climb_parked
        }
    else:
        return {
            'action': 'did not park/climb',
            'climbDepth': '',
            'climbSuccessful': False,
            'climbParked': False
        }

# Updated calculate_endgame_score function
def calculate_endgame_score(endgame_data):
    """Calculate endgame score based on REEFSCAPE official scoring"""
    action = endgame_data.get('action', '').lower()
    
    if action == 'climb':
        if endgame_data.get('climbSuccessful', False):
            climb_depth = endgame_data.get('climbDepth', '').lower()
            if climb_depth == 'deep':
                return 12  # Deep CAGE = 12 points
            elif climb_depth == 'shallow':
                return 6   # Shallow CAGE = 6 points
            else:
                return 6   # Default to shallow if depth unknown
        elif endgame_data.get('climbParked', False):
            return 2   # Failed climb but parked = 2 points
        else:
            return 0   # Failed climb, no park = 0 points
    elif action == 'park':
        return 2  # PARK in BARGE ZONE = 2 points
    
    return 0  # No endgame action = 0 points

def calculate_auto_score(auto_data):
    """Calculate auto score based on REEFSCAPE official scoring"""
    score = 0
    
    # CORAL scoring in AUTO (from Table 6-2)
    score += auto_data.get('ll1', 0) * 3   # L1 (trough) = 3 points
    score += auto_data.get('l2', 0) * 4    # L2 BRANCH = 4 points  
    score += auto_data.get('l3', 0) * 6    # L3 BRANCH = 6 points
    score += auto_data.get('l4', 0) * 7    # L4 BRANCH = 7 points
    
    # ALGAE scoring in AUTO (from Table 6-2)
    score += auto_data.get('processor', 0) * 6  # PROCESSOR = 6 points
    score += auto_data.get('barge', 0) * 4      # NET = 4 points (assuming barge refers to NET)
    
    # Note: LEAVE points (3 points) are not included here as they're tracked separately
    # Note: Dropped pieces don't score negatively in official rules
    
    return score

def calculate_teleop_score(teleop_data):
    """Calculate teleop score based on REEFSCAPE official scoring"""
    score = 0
    
    # CORAL scoring in TELEOP (from Table 6-2)
    score += teleop_data.get('ll1', 0) * 2   # L1 (trough) = 2 points
    score += teleop_data.get('l2', 0) * 3    # L2 BRANCH = 3 points
    score += teleop_data.get('l3', 0) * 4    # L3 BRANCH = 4 points  
    score += teleop_data.get('l4', 0) * 5    # L4 BRANCH = 5 points
    
    # ALGAE scoring in TELEOP (from Table 6-2)
    score += teleop_data.get('processor', 0) * 6  # PROCESSOR = 6 points
    score += teleop_data.get('barge', 0) * 4      # NET = 4 points (assuming barge refers to NET)
    
    # Note: Dropped pieces don't score negatively in official rules
    # Note: Offense/Defense ratings are subjective and don't contribute to match points
    
    return score

def calculate_endgame_score(endgame_data):
    """Calculate endgame score based on REEFSCAPE official scoring"""
    action = endgame_data.get('action', '').lower()
    
    if action == 'climb' and endgame_data.get('climbSuccessful', False):
        climb_depth = endgame_data.get('climbDepth', '').lower()
        if climb_depth == 'deep':
            return 12  # Deep CAGE = 12 points (from Table 6-2)
        elif climb_depth == 'shallow':
            return 6   # Shallow CAGE = 6 points (from Table 6-2)
        else:
            # If depth is unknown but climb was successful, assume shallow
            return 6
    elif action == 'park':
        return 2  # PARK in BARGE ZONE = 2 points (from Table 6-2)
    
    return 0  # No endgame action = 0 points

# Additional function to calculate other potential scores
def calculate_additional_scores(auto_data, teleop_data, endgame_data):
    """Calculate additional scores that might be tracked"""
    additional_score = 0
    
    # LEAVE points (only in auto, 3 points if robot left starting line)
    # This would need to be tracked separately in your scouting form
    # For now, we'll assume if any auto scoring happened, robot left starting line
    if (auto_data.get('ll1', 0) + auto_data.get('l2', 0) + 
        auto_data.get('l3', 0) + auto_data.get('l4', 0) + 
        auto_data.get('processor', 0) + auto_data.get('barge', 0)) > 0:
        additional_score += 3  # LEAVE points
    
    return additional_score

# =============================================================================
# DEV MODE ROUTES
# =============================================================================

@app.route('/dev')
@dev_login_required
def dev_dashboard():
    """Enhanced dev dashboard with live preview"""
    return render_template('dev_dashboard_enhanced.html')

@app.route('/api/dev/navigate/<page>')
@dev_login_required
def dev_navigate(page):
    """Navigate to different pages in dev mode"""
    # Set a flag in session to show dev navigation
    session['dev_preview'] = True
    
    routes = {
        'scout': '/scout',
        'dashboard': '/dashboard',
        'admin': '/admin',
        'analytics': '/analytics',
        'pit-scout': '/pit-scout'
    }
    
    return jsonify({'url': routes.get(page, '/')})

@app.route('/api/dev/toggle-mode', methods=['POST'])
@dev_login_required
def toggle_dev_mode():
    """Toggle dev/maintenance mode (requires environment variable change)"""
    # This is just informational - actual toggle happens via environment
    current_state = is_dev_mode()
    return jsonify({
        'current_mode': 'maintenance' if current_state else 'normal',
        'message': 'To change mode, update DEV_MODE environment variable in Render'
    })

@app.route('/api/dev/reset', methods=['POST'])
@dev_login_required
def reset_dev_environment():
    """Reset dev environment to clean state"""
    try:
        reset_dev_data()
        return jsonify({'success': True, 'message': 'Dev environment reset successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dev/status')
@dev_login_required
def dev_status():
    """Get dev environment status"""
    import os
    from dev_mode import DEV_FILES
    
    status = {
        'dev_mode': is_dev_mode(),
        'dev_user': is_dev_user(),
        'environment': 'production' if os.environ.get('RENDER') else 'local',
        'files': {}
    }
    
    for key, path in DEV_FILES.items():
        status['files'][key] = {
            'exists': os.path.exists(path),
            'size': os.path.getsize(path) if os.path.exists(path) else 0
        }
    
    return jsonify(status)

@app.route('/api/dev/populate-test-data', methods=['POST'])
@dev_login_required
def populate_test_data():
    """Populate dev environment with test data"""
    try:
        from dev_mode import populate_dev_test_data
        result = populate_dev_test_data()
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Test data populated successfully',
                'data': {
                    'scouters': 3,
                    'assignments': 4,
                    'events': 2,
                    'matches': 3
                }
            })
        else:
            return jsonify({'error': 'Failed to populate test data'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dev/get-fake-data/<data_type>')
@dev_login_required
def get_fake_data(data_type):
    """Get fake data for testing"""
    try:
        from dev_mode import get_dev_mock_data
        data = get_dev_mock_data(data_type)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =============================================================================
# MANUAL MATCHES ROUTES
# =============================================================================

@app.route('/api/admin/manual-events', methods=['GET'])
@admin_required
def get_manual_events():
    """Get list of all manual events"""
    try:
        events = list_manual_events()
        return jsonify(events)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/manual-events', methods=['POST'])
@admin_required
def create_manual_event_route():
    """Create a new manual event"""
    data = request.json
    event_name = data.get('event_name', '').strip()
    matches_data = data.get('matches', [])
    
    if not event_name:
        return jsonify({'error': 'Event name is required'}), 400
    
    if not matches_data:
        return jsonify({'error': 'At least one match is required'}), 400
    
    try:
        event_key = create_manual_event(event_name, matches_data)
        return jsonify({
            'success': True,
            'event_key': event_key,
            'message': f'Manual event "{event_name}" created successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/manual-events/<event_key>', methods=['DELETE'])
@admin_required
def delete_manual_event_route(event_key):
    """Delete a manual event"""
    try:
        if delete_manual_event(event_key):
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Event not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =============================================================================
# DASHBOARD ROUTES
# =============================================================================

@app.route('/admin')
@login_required
def admin_dashboard():
    # ✅ Check for dev user first
    if is_dev_user():
        return render_template('admin_dashboard.html')
    
    # Then check regular admin
    from auth import load_users
    users = load_users()
    user = users.get(session['user_id'])
    if not user or user.get('role') != 'admin':
        return redirect('/dashboard')
    return render_template('admin_dashboard.html')

@app.route('/dashboard')
@login_required
def scouter_dashboard():
    from auth import load_users
    users = load_users()
    user = users.get(session['user_id'])
    
    # Auto-redirect pit scouters to pit scouting page
    if user and user.get('role') == 'pit_scouter':
        return redirect('/pit-scout')
    
    return render_template('scouter_dashboard.html')

# =============================================================================
# ADMIN API ROUTES
# =============================================================================

@app.route('/api/admin/auto-assign', methods=['POST'])
@admin_required
def auto_assign_teams():
    """Automatically assign each scouter to one team across all matches"""
    data = request.json
    event_key = data.get('event_key')
    
    print(f"Auto-assign called with event_key: {event_key}")  # Debug log
    
    if not event_key:
        return jsonify({'error': 'Event key required'}), 400
    
    from auth import get_all_scouters
    scouters_data = get_all_scouters()
    scouter_usernames = list(scouters_data.keys())
    
    print(f"Found {len(scouter_usernames)} scouters: {scouter_usernames}")  # Debug log
    
    if not scouter_usernames:
        return jsonify({'error': 'No scouters found'}), 400
    
    # Get teams for this event
    try:
        if is_manual_event(event_key):
            teams = get_manual_event_teams(event_key)
        else:
            matches = tba_client.get_event_matches(event_key)
            if not matches:
                matches = get_sample_matches()
            
            teams_set = set()
            for match in matches:
                teams_set.update(match['all_teams'])
            teams = sorted(list(teams_set), key=int)
        
        print(f"Found {len(teams)} teams: {teams}")  # Debug log
            
    except Exception as e:
        print(f"Error loading teams: {str(e)}")  # Debug log
        return jsonify({'error': f'Could not load teams: {str(e)}'}), 500
    
    if not teams:
        return jsonify({'error': 'No teams found for this event'}), 400
    
    # Remove home team if present
    home_team = '6897'
    if home_team in teams:
        teams.remove(home_team)
        print(f"Removed home team {home_team}, remaining teams: {len(teams)}")  # Debug log
    
    if len(teams) == 0:
        return jsonify({'error': 'No teams available for assignment (excluding home team)'}), 400
    
    # Assign teams to scouters in round-robin fashion
    assignments_made = []
    
    for i, team in enumerate(teams):
        scouter_username = scouter_usernames[i % len(scouter_usernames)]
        scouter_name = scouters_data[scouter_username].get('name', scouter_username)
        
        print(f"Assigning team {team} to {scouter_username}")  # Debug log
        
        success, message = bulk_assign_team_to_scouter(scouter_username, event_key, str(team))
        
        if success:
            assignments_made.append({
                'team': team,
                'scouter_username': scouter_username,
                'scouter_name': scouter_name
            })
        else:
            print(f"Failed to assign team {team}: {message}")  # Debug log
    
    print(f"Successfully made {len(assignments_made)} assignments")  # Debug log
    
    return jsonify({
        'success': True,
        'assignments': assignments_made,
        'total_assignments': len(assignments_made)
    })

@app.route('/api/admin/clear-all-assignments', methods=['POST'])
@admin_required  
def clear_all_assignments():
    """Clear all assignments for an event"""
    data = request.json
    event_key = data.get('event_key')
    
    if not event_key:
        return jsonify({'error': 'Event key required'}), 400
    
    try:
        from database import clear_event_assignments
        removed_count = clear_event_assignments(event_key)
        return jsonify({
            'success': True, 
            'message': f'Cleared {removed_count} assignments',
            'removed_count': removed_count
        })
    except Exception as e:
        print(f"Error clearing assignments: {str(e)}")  # Add logging
        return jsonify({'error': str(e)}), 500
    


@app.route('/api/admin/bulk-assign-team', methods=['POST'])
@admin_required
def bulk_assign_team():
    """Assign a scouter to a team across all matches"""
    data = request.json
    event_key = data.get('event_key')
    team_number = data.get('team_number')
    scouter_username = data.get('scouter_username')
    
    if not all([event_key, team_number, scouter_username]):
        return jsonify({'error': 'Event key, team number, and scouter required'}), 400
    
    success, message = bulk_assign_team_to_scouter(scouter_username, event_key, str(team_number))
    if success:
        return jsonify({'success': True, 'message': message})
    else:
        return jsonify({'error': message}), 500

@app.route('/api/admin/remove-team-assignments', methods=['POST'])
@admin_required
def remove_team_assignments_route():
    """Remove all assignments for a team"""
    data = request.json
    event_key = data.get('event_key')
    team_number = data.get('team_number')
    
    if not all([event_key, team_number]):
        return jsonify({'error': 'Event key and team number required'}), 400
    
    removed_count = remove_team_assignments(event_key, str(team_number))
    return jsonify({'success': True, 'removed_count': removed_count})

@app.route('/api/admin/events')
@admin_required
def get_events():
    try:
        events = tba_client.get_current_events()
        return jsonify(events)
    except Exception as e:
        return jsonify([{
            'key': '2025test',
            'name': 'Test Event 2025',
            'start_date': '2025-03-01',
            'end_date': '2025-03-03',
            'location': 'Test Location, CA'
        }])

@app.route('/api/admin/matches')
@admin_required
def get_matches():
    event_key = request.args.get('event')
    if not event_key:
        return jsonify({'error': 'Event key required'}), 400
    
    try:
        if is_manual_event(event_key):
            matches = get_manual_event_matches(event_key)
            return jsonify(matches)
        else:
            matches = tba_client.get_event_matches(event_key)
            if not matches: 
                matches = get_sample_matches()
            return jsonify(matches)
    except Exception as e:
        return jsonify(get_sample_matches())

@app.route('/api/admin/teams')
@admin_required
def get_teams():
    """Get teams for a specific event"""
    event_key = request.args.get('event')
    if not event_key:
        return jsonify({'error': 'Event key required'}), 400
    
    try:
        if is_manual_event(event_key):
            teams = get_manual_event_teams(event_key)
            return jsonify(teams)
        else:
            matches = tba_client.get_event_matches(event_key)
            if not matches:
                matches = get_sample_matches()
            
            teams = set()
            for match in matches:
                teams.update(match['all_teams'])
            
            teams_list = sorted(list(teams), key=int)
            return jsonify(teams_list)
            
    except Exception as e:
        return jsonify(['254', '148', '1323', '2468', '2471', '5940', '1678', '5190', '6834', '973', '1114', '2056'])

@app.route('/api/admin/scouters')
@admin_required
def get_scouters():
    scouters = get_all_scouters()
    return jsonify(scouters)

@app.route('/api/admin/scouter-stats')
@admin_required
def get_scouter_stats():
    """Get scouting statistics for each scouter"""
    try:
        scouters = get_all_scouters()
        assignments = get_all_assignments()
        
        stats = {}
        for username in scouters.keys():
            assigned_count = 0
            completed_count = 0
            
            for assignment in assignments.values():
                if assignment.get('scouter') == username:
                    assigned_count += 1
                    if assignment.get('completed', False):
                        completed_count += 1
            
            stats[username] = {
                'assigned': assigned_count,
                'completed': completed_count
            }
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({})

@app.route('/api/admin/create-scouter', methods=['POST'])
@admin_required
def create_new_scouter():
    data = request.json
    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    
    if not all([name, username, password]):
        return jsonify({'error': 'All fields are required'}), 400
    
    success, message = create_scouter(username, password, name)
    if success:
        return jsonify({'success': True, 'message': message})
    else:
        return jsonify({'error': message}), 400

@app.route('/api/admin/scouters/<username>', methods=['DELETE'])
@admin_required
def delete_scouter_account(username):
    if delete_scouter(username):
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Scouter not found'}), 404

@app.route('/api/admin/assign-match', methods=['POST'])
@admin_required
def assign_match():
    data = request.json
    event_key = data.get('event_key')
    match_number = data.get('match_number')
    assignments = data.get('assignments', {})
    
    if not all([event_key, match_number]):
        return jsonify({'error': 'Event key and match number required'}), 400
    
    success = bulk_assign_match(event_key, match_number, assignments)
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Failed to save assignments'}), 500

@app.route('/api/admin/assignments')
@admin_required
def get_admin_assignments():
    event_key = request.args.get('event')
    assignments = get_all_assignments(event_key)
    
    assignment_list = []
    for assignment_key, assignment in assignments.items():
        assignment_list.append({
            'assignment_key': assignment_key,
            **assignment
        })
    
    return jsonify(assignment_list)

@app.route('/api/admin/remove-individual-assignment', methods=['POST'])
@admin_required
def remove_individual_assignment():
    """Remove a specific individual assignment"""
    data = request.json
    assignment_key = data.get('assignment_key')
    
    if not assignment_key:
        return jsonify({'error': 'Assignment key required'}), 400
    
    from database import remove_assignment
    success = remove_assignment(assignment_key)
    
    if success:
        return jsonify({'success': True, 'message': 'Assignment removed successfully'})
    else:
        return jsonify({'error': 'Assignment not found or could not be removed'}), 404

@app.route('/api/admin/clear-match-assignments', methods=['POST'])
@admin_required
def clear_match_assignments():
    """Clear all assignments for a specific match"""
    data = request.json
    event_key = data.get('event_key')
    match_number = data.get('match_number')
    
    if not all([event_key, match_number]):
        return jsonify({'error': 'Event key and match number required'}), 400
    
    from database import clear_match_assignments_db
    removed_count = clear_match_assignments_db(event_key, match_number)
    
    return jsonify({
        'success': True, 
        'removed_count': removed_count,
        'message': f'Cleared {removed_count} assignments from match {match_number}'
    })

# =============================================================================
# HOME GAME ROUTES
# =============================================================================

@app.route('/api/admin/mark-home-game', methods=['POST'])
@admin_required
def mark_home_game():
    """Mark an assignment as a home game"""
    data = request.json
    assignment_key = data.get('assignment_key')
    
    if not assignment_key:
        return jsonify({'error': 'Assignment key required'}), 400
    
    from database import mark_assignment_as_home_game
    success = mark_assignment_as_home_game(assignment_key)
    
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Assignment not found'}), 404

@app.route('/api/admin/unmark-home-game', methods=['POST'])
@admin_required
def unmark_home_game():
    """Remove home game status from an assignment"""
    data = request.json
    assignment_key = data.get('assignment_key')
    
    if not assignment_key:
        return jsonify({'error': 'Assignment key required'}), 400
    
    from database import unmark_assignment_as_home_game
    success = unmark_assignment_as_home_game(assignment_key)
    
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Assignment not found'}), 404

@app.route('/api/scouter/mark-home-game', methods=['POST'])
@login_required
def scouter_mark_home_game():
    """Allow scouter to mark their assignment as a home game"""
    data = request.json
    assignment_key = data.get('assignment_key')
    
    if not assignment_key:
        return jsonify({'error': 'Assignment key required'}), 400
    
    from database import load_assignments, mark_assignment_as_home_game
    assignments = load_assignments()
    
    if assignment_key not in assignments:
        return jsonify({'error': 'Assignment not found'}), 404
    
    assignment = assignments[assignment_key]
    if assignment.get('scouter') != session['user_id']:
        return jsonify({'error': 'Not authorized for this assignment'}), 403
    
    success = mark_assignment_as_home_game(assignment_key)
    
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Failed to mark as home game'}), 500

@app.route('/api/admin/match-summary')
@admin_required
def get_match_summary():
    """Get summary of assignments including home games"""
    event_key = request.args.get('event')
    
    from database import get_match_summary_for_admin
    summary = get_match_summary_for_admin(event_key)
    
    return jsonify(summary)

# =============================================================================
# SCOUTER API ROUTES
# =============================================================================

@app.route('/api/scouter/assignments')
@login_required
def get_scouter_assignments_api():
    scouter_username = session['user_id']
    assignments = get_scouter_assignments(scouter_username)
    return jsonify(assignments)

# =============================================================================
# SCOUTING FORM ROUTES
# =============================================================================

@app.route('/scout')
@login_required
def scout_form():
    team = request.args.get('team', '')
    match = request.args.get('match', '')
    assignment_key = request.args.get('assignment', '')
    
    if assignment_key:
        session['current_assignment'] = assignment_key
    
    return render_template('index.html', prefill_team=team, prefill_match=match)

@app.route('/')
@maintenance_required
def home():
    if 'user_id' not in session:
        return redirect('/login')

    from auth import load_users
    users = load_users()
    user = users.get(session['user_id'])
    if user and user.get('role') == 'admin':
        return redirect('/admin')
    else:
        return redirect('/dashboard')

@app.route('/submit', methods=['POST'])
@login_required
def submit():
    data = request.json

    name = data.get('name', '').strip()
    team = str(data.get('team', '')).strip()
    match_number = data.get('match', '').strip()
    est = timezone(timedelta(hours=-4))
    now = datetime.now(est)

    timestamp_us = now.isoformat(timespec='microseconds')
    unique_suffix = uuid4().hex[:8]
    submitted_time_internal = f"{timestamp_us}_{unique_suffix}"

    submitted_time_display = now.strftime("%m/%d/%Y %I:%M:%S %p")

    auto = data.get('auto', {})
    teleop = data.get('teleop', {})
    endgame = data.get('endgame', {})
    notes = data.get('notes', '').strip()

    auto_no_move = auto.get('no_move', False)
    auto_only_moved = auto.get('only_moved', False)
    teleop_no_move = teleop.get('no_move', False)
    partial_match = data.get('partial_match', False) 

    auto_dropped_pieces = auto.get('dropped_pieces', 0)
    
    # Auto summary logic
    if auto_no_move:
        auto_summary = "Didn't move in auto"
    elif auto_only_moved:
        auto_summary = f"Only moved forward (no scoring), Dropped:{auto_dropped_pieces}"
    else:
        auto_summary = (
            f"L1:{auto.get('ll1', 0)}, L2:{auto.get('l2', 0)}, L3:{auto.get('l3', 0)}, "
            f"L4:{auto.get('l4', 0)}, P:{auto.get('processor', 0)}, B:{auto.get('barge', 0)}, "
            f"Dropped:{auto_dropped_pieces}"
        )

    # Teleop summary logic
    if teleop_no_move:
        teleop_summary = "Didn't move in teleop"
    else:
        dropped_pieces = teleop.get('dropped_pieces', 0)
        teleop_summary = (
            f"L1:{teleop.get('ll1', 0)}, L2:{teleop.get('l2', 0)}, L3:{teleop.get('l3', 0)}, "
            f"L4:{teleop.get('l4', 0)}, P:{teleop.get('processor', 0)}, B:{teleop.get('barge', 0)}, "
            f"Dropped:{dropped_pieces}"
        )

    def clean_rating(val):
        try:
            val_num = int(val)
            return str(val_num) if val_num > 0 else '-'
        except:
            return '-' if val is None or val == '' else str(val)

    offense_rating = clean_rating(teleop.get('offense_rating', '-'))
    defense_rating = clean_rating(teleop.get('defense_rating', '-'))

    # Endgame summary logic
    endgame_action = endgame.get('action', '').strip().lower()
    if endgame_action == 'climb':
        climb_depth = endgame.get('climb_depth', '').strip().lower()
        climb_successful = endgame.get('climb_successful', False)
        climb_parked = endgame.get('climb_parked', False)

        if climb_depth == 'shallow':
            climb_type = "Shallow climb"
        elif climb_depth == 'deep':
            climb_type = "Deep climb"
        else:
            climb_type = "Climb"

        if climb_successful:
            endgame_summary = f"{climb_type} - Success"
        elif climb_parked:
            endgame_summary = f"{climb_type} - Failed but Parked"
        else:
            endgame_summary = f"{climb_type} - Failed"
    
    elif endgame_action == 'park':
        endgame_summary = "Park"
    elif endgame_action == 'did not park/climb':
        endgame_summary = "Did Not Park/Climb"
    else:
        endgame_summary = "None"

    # Partial match column
    partial_match_status = "Yes" if partial_match else "No"

    data_row = [
        name, team, match_number, submitted_time_display, auto_summary,
        teleop_summary, offense_rating, defense_rating,
        endgame_summary, partial_match_status, notes
    ]

    result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=f'{SHEET_NAME}!A1:Z1000').execute()
    all_values = result.get('values', [])

    teams_data = {}
    for row in all_values:
        if len(row) > 0 and not row[0].startswith('Team ') and row[0] != 'Scouter Name':
            team_num = str(row[1]) if len(row) > 1 else ''
            if team_num not in teams_data:
                teams_data[team_num] = []
            teams_data[team_num].append(row)

    if team not in teams_data:
        teams_data[team] = []
    teams_data[team].append(data_row)

    sheet.values().clear(spreadsheetId=SPREADSHEET_ID, range=f'{SHEET_NAME}!A1:Z1000').execute()

    new_values = []
    format_requests = []
    current_row = 0

    for team_num in sorted(teams_data.keys(), key=int):
        team_name = TEAM_NAMES.get(team_num, "Unknown Team")

        if current_row > 0:
            new_values.append([''] * 11)
            current_row += 1

        new_values.append([f'Team {team_num}: {team_name}'] + [''] * 10)
        format_requests.append({
            "repeatCell": {
                "range": {"sheetId": SHEET_ID, "startRowIndex": current_row, "endRowIndex": current_row + 1},
                "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 14}}},
                "fields": "userEnteredFormat.textFormat"
            }
        })
        current_row += 1

        new_values.append([
            "Scouter Name", "Team Number", "Match Number", "Submission Time",
            "Auto Summary", "Teleop Summary", "Offense Rating", "Defense Rating",
            "Endgame Summary", "Partial Match Shutdown?", "Notes"
        ])
        format_requests.append({
            "repeatCell": {
                "range": {"sheetId": SHEET_ID, "startRowIndex": current_row, "endRowIndex": current_row + 1},
                "cell": {"userEnteredFormat": {"textFormat": {"bold": True, "fontSize": 11}}},
                "fields": "userEnteredFormat.textFormat"
            }
        })
        current_row += 1

        sorted_data = sorted(teams_data[team_num], key=lambda x: int(x[2]) if len(x) > 2 and str(x[2]).isdigit() else 0)
        for entry in sorted_data:
            is_partial_match = len(entry) > 9 and entry[9] == "Yes"
            
            new_values.append(entry)
            
            if is_partial_match:
                format_requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": SHEET_ID, 
                            "startRowIndex": current_row, 
                            "endRowIndex": current_row + 1,
                            "startColumnIndex": 9,
                            "endColumnIndex": 10
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 1.0, "green": 1.0, "blue": 0.0},
                                "textFormat": {"bold": False}
                            }
                        },
                        "fields": "userEnteredFormat"
                    }
                })
            else:
                format_requests.append({
                    "repeatCell": {
                        "range": {"sheetId": SHEET_ID, "startRowIndex": current_row, "endRowIndex": current_row + 1},
                        "cell": {"userEnteredFormat": {"textFormat": {"bold": False}}},
                        "fields": "userEnteredFormat.textFormat"
                    }
                })
            current_row += 1

    if new_values:
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{SHEET_NAME}!A1:K{len(new_values)}',
            valueInputOption='RAW',
            body={'values': new_values}
        ).execute()

    if format_requests:
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={"requests": format_requests}
        ).execute()

    if 'current_assignment' in session:
        assignment_key = session['current_assignment']
        mark_assignment_completed(assignment_key)
        session.pop('current_assignment', None)

    return jsonify({'status': 'success'})

# =============================================================================
# PIT SCOUTING ROUTES
# =============================================================================

app.route('/pit-scout')
@login_required
def pit_scout_form():
    # ✅ Allow dev users
    if is_dev_user():
        team = request.args.get('team', '')
        event = request.args.get('event', '')
        return render_template('pit_scout.html', prefill_team=team, prefill_event=event)
    
    # Regular permission check
    from auth import load_users
    users = load_users()
    user = users.get(session['user_id'])
    if not user or (user.get('role') not in ['pit_scouter', 'admin']):
        return redirect('/dashboard')
    
    team = request.args.get('team', '')
    event = request.args.get('event', '')
    return render_template('pit_scout.html', prefill_team=team, prefill_event=event)

@app.route('/api/pit-scout/submit', methods=['POST'])
@login_required
def submit_pit_scout():
    """Submit pit scouting data to Google Sheets"""
    data = request.json
    
    scouter_name = session.get('user_name', session.get('user_id', ''))
    team = str(data.get('team', '')).strip()
    event_key = data.get('event', '').strip()
    
    est = timezone(timedelta(hours=-4))
    now = datetime.now(est)
    timestamp_us = now.isoformat(timespec='microseconds')
    unique_suffix = uuid4().hex[:8]
    submitted_time_internal = f"{timestamp_us}_{unique_suffix}"
    submitted_time_display = now.strftime("%m/%d/%Y %I:%M:%S %p")
    
    if not all([team, event_key]):
        return jsonify({'error': 'Team number and event are required'}), 400
    
    # Prepare data row for Google Sheets
    data_row = [
        scouter_name,
        team,
        event_key,
        submitted_time_display,
        data.get('drivebase_type', ''),
        data.get('avg_cycle_time', ''),
        data.get('notes', '').strip()
    ]
    
    try:
        # Read existing data
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID, 
            range=f'{PIT_SHEET_NAME}!A1:Z1000'
        ).execute()
        
        all_values = result.get('values', [])
        
        # Check if we need to add headers
        if not all_values or all_values[0][0] != 'Scouter Name':
            # Add headers
            headers = [
                'Scouter Name', 'Team Number', 'Event', 'Submission Time',
                'Drivebase Type', 'Avg Cycle Time (sec)', 'Notes'
            ]
            all_values = [headers] + all_values
        
        # Add new data
        all_values.append(data_row)
        
        # Write back to sheet
        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{PIT_SHEET_NAME}!A1:G{len(all_values)}',
            valueInputOption='RAW',
            body={'values': all_values}
        ).execute()
        
        # Apply formatting
        format_requests = [
            # Header row - bold and larger font
            {
                "repeatCell": {
                    "range": {
                        "sheetId": PIT_SHEET_ID,
                        "startRowIndex": 0,
                        "endRowIndex": 1
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {
                                "bold": True,
                                "fontSize": 11
                            },
                            "backgroundColor": {
                                "red": 0.9,
                                "green": 0.9,
                                "blue": 0.9
                            }
                        }
                    },
                    "fields": "userEnteredFormat(textFormat,backgroundColor)"
                }
            },
            # Freeze header row
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": PIT_SHEET_ID,
                        "gridProperties": {
                            "frozenRowCount": 1
                        }
                    },
                    "fields": "gridProperties.frozenRowCount"
                }
            }
        ]
        
        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={"requests": format_requests}
        ).execute()
        
        return jsonify({'status': 'success'})
        
    except Exception as e:
        print(f"Error submitting pit scout data: {str(e)}")
        return jsonify({'error': 'Failed to submit pit scout data'}), 500

@app.route('/api/admin/pit-scout-data')
@admin_required
def get_pit_scout_data():
    """Get all pit scouting data for admin view"""
    try:
        result = sheet.values().get(
            spreadsheetId=SPREADSHEET_ID, 
            range=f'{PIT_SHEET_NAME}!A1:Z1000'
        ).execute()
        
        all_values = result.get('values', [])
        
        if not all_values:
            return jsonify([])
        
        # Skip header row, return data
        headers = all_values[0] if all_values else []
        data_rows = all_values[1:] if len(all_values) > 1 else []
        
        # Format as list of dictionaries
        pit_data = []
        for row in data_rows:
            if len(row) >= 4:  # Ensure minimum required fields
                pit_entry = {
                    'scouter_name': row[0] if len(row) > 0 else '',
                    'team_number': row[1] if len(row) > 1 else '',
                    'event': row[2] if len(row) > 2 else '',
                    'timestamp': row[3] if len(row) > 3 else '',
                    'drivebase_type': row[4] if len(row) > 4 else '',
                    'avg_cycle_time': row[5] if len(row) > 5 else '',
                    'notes': row[6] if len(row) > 6 else ''
                }
                pit_data.append(pit_entry)
        
        return jsonify(pit_data)
        
    except Exception as e:
        print(f"Error fetching pit scout data: {str(e)}")
        return jsonify({'error': 'Failed to fetch pit scout data'}), 500

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('.', 'sw.js', mimetype='application/javascript')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)