import json
import os
from datetime import datetime

MANUAL_EVENTS_FILE = 'manual_events.json'

def load_manual_events():
    """Load manual events from JSON file"""
    if not os.path.exists(MANUAL_EVENTS_FILE):
        return {}
    
    try:
        with open(MANUAL_EVENTS_FILE, 'r') as f:
            return json.load(f)
    except:
        return {}

def save_manual_events(events):
    """Save manual events to JSON file"""
    with open(MANUAL_EVENTS_FILE, 'w') as f:
        json.dump(events, f, indent=2)

def create_manual_event(event_name, matches_data):
    """Create a new manual event with matches"""
    events = load_manual_events()
    
    # Generate event key from name
    event_key = f"manual_{event_name.lower().replace(' ', '_')}"
    
    # Process matches data
    matches = []
    for i, match_data in enumerate(matches_data, 1):
        match = {
            'match_number': i,
            'red_teams': [team.strip() for team in match_data.get('red_teams', []) if team.strip()],
            'blue_teams': [team.strip() for team in match_data.get('blue_teams', []) if team.strip()],
            'all_teams': []
        }
        
        # Combine all teams
        match['all_teams'] = match['red_teams'] + match['blue_teams']
        matches.append(match)
    
    events[event_key] = {
        'name': event_name,
        'key': event_key,
        'created_at': datetime.now().isoformat(),
        'matches': matches,
        'is_manual': True
    }
    
    save_manual_events(events)
    return event_key

def get_manual_event(event_key):
    """Get a specific manual event"""
    events = load_manual_events()
    return events.get(event_key)

def get_manual_event_matches(event_key):
    """Get matches for a manual event"""
    event = get_manual_event(event_key)
    if event:
        return event.get('matches', [])
    return []

def get_manual_event_teams(event_key):
    """Get all teams from a manual event"""
    matches = get_manual_event_matches(event_key)
    teams = set()
    
    for match in matches:
        teams.update(match.get('all_teams', []))
    
    return sorted(list(teams), key=lambda x: int(x) if x.isdigit() else 0)

def list_manual_events():
    """Get list of all manual events"""
    events = load_manual_events()
    return [
        {
            'key': key,
            'name': event['name'],
            'created_at': event.get('created_at', 'Unknown'),
            'match_count': len(event.get('matches', []))
        }
        for key, event in events.items()
    ]

def delete_manual_event(event_key):
    """Delete a manual event"""
    events = load_manual_events()
    if event_key in events:
        del events[event_key]
        save_manual_events(events)
        return True
    return False

def is_manual_event(event_key):
    """Check if an event key is for a manual event"""
    return event_key.startswith('manual_')

def update_manual_event_matches(event_key, matches_data):
    """Update matches for an existing manual event"""
    events = load_manual_events()
    
    if event_key not in events:
        return False
    
    # Process matches data
    matches = []
    for i, match_data in enumerate(matches_data, 1):
        match = {
            'match_number': i,
            'red_teams': [team.strip() for team in match_data.get('red_teams', []) if team.strip()],
            'blue_teams': [team.strip() for team in match_data.get('blue_teams', []) if team.strip()],
            'all_teams': []
        }
        
        # Combine all teams
        match['all_teams'] = match['red_teams'] + match['blue_teams']
        matches.append(match)
    
    events[event_key]['matches'] = matches
    events[event_key]['updated_at'] = datetime.now().isoformat()
    
    save_manual_events(events)
    return True