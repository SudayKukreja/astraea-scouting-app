import json
import os
from datetime import datetime
from dev_mode import get_data_file, is_dev_user

ASSIGNMENTS_FILE = 'assignments.json'

def load_assignments():
    """Load scouter assignments from JSON file"""
    # Use dev file if dev user, otherwise use normal file
    assignments_file = get_data_file('assignments') if is_dev_user() else ASSIGNMENTS_FILE
    
    if not os.path.exists(assignments_file):
        return {}
    
    try:
        with open(assignments_file, 'r') as f:
            return json.load(f)
    except:
        return {}

def save_assignments(assignments):
    """Save assignments to JSON file"""
    # Use dev file if dev user, otherwise use normal file
    assignments_file = get_data_file('assignments') if is_dev_user() else ASSIGNMENTS_FILE
    
    with open(assignments_file, 'w') as f:
        json.dump(assignments, f, indent=2)

def assign_scouter_to_team(scouter_username, event_key, match_number, team_number):
    """Assign a scouter to scout a specific team in a match"""
    assignments = load_assignments()
    
    assignment_key = f"{event_key}_qm{match_number}_{team_number}"
    
    if assignment_key not in assignments:
        assignments[assignment_key] = {}
    
    assignments[assignment_key] = {
        'scouter': scouter_username,
        'event_key': event_key,
        'match_number': match_number,
        'team_number': team_number,
        'assigned_at': datetime.now().isoformat(),
        'completed': False
    }
    
    save_assignments(assignments)
    return True

def bulk_assign_team_to_scouter(scouter_username, event_key, team_number):
    """Assign a scouter to scout a specific team across ALL matches for that event"""
    from manual_matches import is_manual_event, get_manual_event_matches
    
    if is_manual_event(event_key):
        matches = get_manual_event_matches(event_key)
    else:
        from tba_api import TBAClient
        tba_client = TBAClient()
        matches = tba_client.get_event_matches(event_key)
    
    if not matches:
        return False, "Could not load matches for this event"
    
    assignments = load_assignments()
    assigned_matches = []
    
    for match in matches:
        if team_number in match['all_teams']:
            assignment_key = f"{event_key}_qm{match['match_number']}_{team_number}"
            
            assignments[assignment_key] = {
                'scouter': scouter_username,
                'event_key': event_key,
                'match_number': match['match_number'],
                'team_number': team_number,
                'assigned_at': datetime.now().isoformat(),
                'completed': False
            }
            assigned_matches.append(match['match_number'])
    
    save_assignments(assignments)
    return True, f"Assigned {scouter_username} to team {team_number} for {len(assigned_matches)} matches"

def get_scouter_assignments(scouter_username, event_key=None):
    """Get all assignments for a specific scouter"""
    assignments = load_assignments()
    scouter_assignments = []
    
    for assignment_key, assignment in assignments.items():
        if assignment.get('scouter') == scouter_username:
            if event_key is None or assignment.get('event_key') == event_key:
                scouter_assignments.append({
                    'assignment_key': assignment_key,
                    **assignment
                })
    
    return sorted(scouter_assignments, key=lambda x: x['match_number'])

def get_match_assignments(event_key, match_number):
    """Get all assignments for a specific match"""
    assignments = load_assignments()
    match_assignments = []
    
    for assignment_key, assignment in assignments.items():
        if (assignment.get('event_key') == event_key and 
            assignment.get('match_number') == match_number):
            match_assignments.append({
                'assignment_key': assignment_key,
                **assignment
            })
    
    return match_assignments

def mark_assignment_completed(assignment_key):
    """Mark an assignment as completed"""
    assignments = load_assignments()
    
    if assignment_key in assignments:
        assignments[assignment_key]['completed'] = True
        assignments[assignment_key]['completed_at'] = datetime.now().isoformat()
        save_assignments(assignments)
        return True
    
    return False

def remove_assignment(assignment_key):
    """Remove an assignment"""
    assignments = load_assignments()
    
    if assignment_key in assignments:
        del assignments[assignment_key]
        save_assignments(assignments)
        return True
    
    return False

def bulk_assign_match(event_key, match_number, team_assignments):
    """Bulk assign scouters to teams for a match
    team_assignments: dict like {'254': 'scouter1', '148': 'scouter2', ...}"""
    assignments = load_assignments()
    
    for team_number, scouter_username in team_assignments.items():
        if scouter_username:  
            assignment_key = f"{event_key}_qm{match_number}_{team_number}"
            assignments[assignment_key] = {
                'scouter': scouter_username,
                'event_key': event_key,
                'match_number': match_number,
                'team_number': team_number,
                'assigned_at': datetime.now().isoformat(),
                'completed': False
            }
    
    save_assignments(assignments)
    return True

def get_all_assignments(event_key=None):
    """Get all assignments, optionally filtered by event"""
    assignments = load_assignments()
    
    if event_key:
        return {k: v for k, v in assignments.items() if v.get('event_key') == event_key}
    
    return assignments

def clear_event_assignments(event_key):
    """Clear all assignments for an event"""
    assignments = load_assignments()
    
    assignments = {k: v for k, v in assignments.items() if v.get('event_key') != event_key}
    
    save_assignments(assignments)
    return True

def remove_team_assignments(event_key, team_number):
    """Remove all assignments for a specific team in an event"""
    assignments = load_assignments()
    
    keys_to_remove = []
    for assignment_key, assignment in assignments.items():
        if (assignment.get('event_key') == event_key and 
            assignment.get('team_number') == team_number):
            keys_to_remove.append(assignment_key)
    
    for key in keys_to_remove:
        del assignments[key]
    
    save_assignments(assignments)
    return len(keys_to_remove)

def mark_assignment_as_home_game(assignment_key):
    """Mark an assignment as a home game (no scouting needed)"""
    assignments = load_assignments()
    
    if assignment_key in assignments:
        assignments[assignment_key]['is_home_game'] = True
        assignments[assignment_key]['marked_home_at'] = datetime.now().isoformat()
        save_assignments(assignments)
        return True
    
    return False

def unmark_assignment_as_home_game(assignment_key):
    """Remove home game status from an assignment"""
    assignments = load_assignments()
    
    if assignment_key in assignments:
        assignments[assignment_key]['is_home_game'] = False
        if 'marked_home_at' in assignments[assignment_key]:
            del assignments[assignment_key]['marked_home_at']
        save_assignments(assignments)
        return True
    
    return False

def check_home_team_in_match(match_teams, home_team='6897'):
    """Check if the home team is playing in this match"""
    return str(home_team) in [str(team) for team in match_teams]

def get_match_summary_for_admin(event_key=None):
    """Get a summary of assignments including home games for admin view"""
    assignments = load_assignments()
    
    if event_key:
        assignments = {k: v for k, v in assignments.items() if v.get('event_key') == event_key}
    
    summary = {
        'total_assignments': len(assignments),
        'completed': 0,
        'home_games': 0,
        'pending': 0
    }
    
    for assignment in assignments.values():
        if assignment.get('is_home_game'):
            summary['home_games'] += 1
        elif assignment.get('completed'):
            summary['completed'] += 1
        else:
            summary['pending'] += 1
    
    return summary

def clear_match_assignments_db(event_key, match_number):
    """Clear all assignments for a specific match"""
    assignments = load_assignments()
    
    keys_to_remove = []
    for assignment_key, assignment in assignments.items():
        if (assignment.get('event_key') == event_key and 
            assignment.get('match_number') == int(match_number)):
            keys_to_remove.append(assignment_key)
    
    for key in keys_to_remove:
        del assignments[key]
    
    save_assignments(assignments)
    return len(keys_to_remove)

def clear_event_assignments(event_key):
    """Clear all assignments for an event"""
    assignments = load_assignments()
    
    keys_to_remove = []
    for assignment_key, assignment in assignments.items():
        if assignment.get('event_key') == event_key:
            keys_to_remove.append(assignment_key)
    
    for key in keys_to_remove:
        del assignments[key]
    
    save_assignments(assignments)
    return len(keys_to_remove)