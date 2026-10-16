from datetime import datetime

from astraea.services.tba import TBAClient
from astraea.storage import load_json, update_json

MANUAL_EVENTS_FILE = 'manual_events.json'

tba_client = TBAClient()


def _clean(teams):
    return [str(t).strip() for t in teams if str(t).strip()]


def create_manual_event(event_name, matches_data):
    event_key = f"manual_{event_name.lower().replace(' ', '_')}"
    matches = []
    for i, m in enumerate(matches_data, 1):
        red, blue = _clean(m.get('red_teams', [])), _clean(m.get('blue_teams', []))
        matches.append({'match_number': i, 'red_teams': red, 'blue_teams': blue, 'all_teams': red + blue})

    with update_json(MANUAL_EVENTS_FILE, {}) as events:
        events[event_key] = {
            'name': event_name,
            'key': event_key,
            'created_at': datetime.now().isoformat(),
            'matches': matches,
            'is_manual': True
        }
    return event_key


def get_manual_event_matches(event_key):
    return load_json(MANUAL_EVENTS_FILE, {}).get(event_key, {}).get('matches', [])


def list_manual_events():
    return [
        {
            'key': key,
            'name': event['name'],
            'created_at': event.get('created_at', ''),
            'match_count': len(event.get('matches', []))
        }
        for key, event in load_json(MANUAL_EVENTS_FILE, {}).items()
    ]


def delete_manual_event(event_key):
    with update_json(MANUAL_EVENTS_FILE, {}) as events:
        return events.pop(event_key, None) is not None


def is_manual_event(event_key):
    return event_key.startswith('manual_')


def get_event_matches(event_key):
    if is_manual_event(event_key):
        return get_manual_event_matches(event_key)
    return tba_client.get_event_matches(event_key)


def get_event_teams(event_key):
    teams = {t for m in get_event_matches(event_key) for t in m['all_teams']}
    return sorted(teams, key=lambda t: int(t) if t.isdigit() else 0)
