from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import os, json

# Load environment variables (add this for local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available in production, that's fine

# Import our new modules
from auth import login_required, admin_required, authenticate_user, create_scouter, get_all_scouters, delete_scouter
from database import (assign_scouter_to_team, get_scouter_assignments, get_match_assignments, 
                     mark_assignment_completed, bulk_assign_match, get_all_assignments,
                     bulk_assign_team_to_scouter, remove_team_assignments)
from tba_api import TBAClient, get_sample_matches
from team_names import TEAM_NAMES

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
CORS(app)

# === CONFIGURATIONS AREA ===
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = '16nYGy_cVkEWtsRl64S5dlRn45wMLqSfFvHA8z7jjJc8'
SHEET_NAME = 'Testing2'
SHEET_ID = 1557407027 
# ===========================

credentials_info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
creds = service_account.Credentials.from_service_account_info(credentials_info, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()

# Initialize TBA client with API key from environment
tba_client = TBAClient(api_key=os.environ.get('TBA_API_KEY'))

@app.route('/login')
def login_page():
    if 'user_id' in session:
        # Redirect based on role
        from auth import load_users
        users = load_users()
        user = users.get(session['user_id'])
        if user and user.get('role') == 'admin':
            return redirect('/admin')
        else:
            return redirect('/dashboard')
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = authenticate_user(username, password)
    if user:
        session['user_id'] = username
        session['user_name'] = user.get('name', username)
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

# =============================================================================
# DASHBOARD ROUTES
# =============================================================================

@app.route('/admin')
@login_required
def admin_dashboard():
    # Check admin role
    from auth import load_users
    users = load_users()
    user = users.get(session['user_id'])
    if not user or user.get('role') != 'admin':
        return redirect('/dashboard')
    return render_template('admin_dashboard.html')

@app.route('/dashboard')
@login_required
def scouter_dashboard():
    return render_template('scouter_dashboard.html')

# =============================================================================
# ADMIN API ROUTES
# =============================================================================

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
        # Fallback to sample data for testing
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
        matches = tba_client.get_event_matches(event_key)
        if not matches:  # Fallback to sample data
            matches = get_sample_matches()
        return jsonify(matches)
    except Exception as e:
        # Fallback to sample data for testing
        return jsonify(get_sample_matches())

@app.route('/api/admin/teams')
@admin_required
def get_teams():
    """Get teams for a specific event"""
    event_key = request.args.get('event')
    if not event_key:
        return jsonify({'error': 'Event key required'}), 400
    
    try:
        # Get matches first to extract teams
        matches = tba_client.get_event_matches(event_key)
        if not matches:
            matches = get_sample_matches()
        
        # Extract unique teams from matches
        teams = set()
        for match in matches:
            teams.update(match['all_teams'])
        
        # Convert to sorted list
        teams_list = sorted(list(teams), key=int)
        return jsonify(teams_list)
        
    except Exception as e:
        # Fallback to sample teams
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
        # Return empty stats if there's an error
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
    
    # Convert to list format for easier frontend handling
    assignment_list = []
    for assignment_key, assignment in assignments.items():
        assignment_list.append({
            'assignment_key': assignment_key,
            **assignment
        })
    
    return jsonify(assignment_list)


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
    
    # Verify this assignment belongs to the current scouter
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
    # Get pre-filled data from query parameters
    team = request.args.get('team', '')
    match = request.args.get('match', '')
    assignment_key = request.args.get('assignment', '')
    
    # Store assignment key in session for completion tracking
    if assignment_key:
        session['current_assignment'] = assignment_key
    
    return render_template('index.html', prefill_team=team, prefill_match=match)

@app.route('/')
def home():
    # Redirect to login if not authenticated
    if 'user_id' not in session:
        return redirect('/login')
    
    # Redirect to appropriate dashboard
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

        if climb_depth == 'shallow':
            climb_type = "Shallow climb"
        elif climb_depth == 'deep':
            climb_type = "Deep climb"
        else:
            climb_type = "Climb"
            
        if climb_successful:
            endgame_summary = f"{climb_type} - Success"
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

    # Mark assignment as completed if this was from an assignment
    if 'current_assignment' in session:
        assignment_key = session['current_assignment']
        mark_assignment_completed(assignment_key)
        session.pop('current_assignment', None)

    return jsonify({'status': 'success'})

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('.', 'sw.js', mimetype='application/javascript')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)