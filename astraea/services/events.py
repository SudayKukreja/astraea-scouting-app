import re
from datetime import datetime

from astraea.services import tba
from astraea.storage import load_json, update_json

EVENTS_FILE = 'events.json'
SETTINGS_FILE = 'settings.json'


class ScheduleError(ValueError):
    pass


def list_events():
    events = load_json(EVENTS_FILE, {})
    return sorted(events.values(), key=lambda e: e.get('created_at', ''), reverse=True)


def get_event(event_key):
    return load_json(EVENTS_FILE, {}).get(event_key)


def get_matches(event_key):
    event = get_event(event_key) if event_key else None
    return event['matches'] if event else []


def get_match(event_key, match_number):
    return next((m for m in get_matches(event_key) if m['match_number'] == match_number), None)


def _store(key, name, source, matches):
    with update_json(EVENTS_FILE, {}) as events:
        events[key] = {
            'key': key,
            'name': name,
            'source': source,
            'matches': matches,
            'created_at': datetime.now().isoformat(timespec='seconds')
        }
    set_current_event(key)


def load_tba_event(event_key):
    event_key = event_key.strip().lower()
    name, matches = tba.fetch_event(event_key)
    _store(event_key, name, 'tba', matches)
    return name, len(matches)


def parse_schedule(text):
    matches = []
    for i, line in enumerate((l.strip() for l in text.splitlines() if l.strip()), 1):
        found = re.match(r'red:\s*(.+?)\s*vs\.?\s*blue:\s*(.+)$', line, re.IGNORECASE)
        if found:
            red, blue = (re.findall(r'\d+', part) for part in found.groups())
        else:
            teams = re.findall(r'\d+', line)
            if len(teams) != 6:
                raise ScheduleError(f'Line {i}: expected 6 team numbers, found {len(teams)}')
            red, blue = teams[:3], teams[3:]
        if not red or not blue:
            raise ScheduleError(f'Line {i}: both alliances need at least one team')
        matches.append({'match_number': len(matches) + 1, 'red_teams': red, 'blue_teams': blue})
    if not matches:
        raise ScheduleError('Enter at least one match')
    return matches


def create_manual_event(name, schedule_text):
    name = name.strip()
    if not name:
        raise ScheduleError('Event name is required')
    matches = parse_schedule(schedule_text)
    key = 'manual_' + re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    _store(key, name, 'manual', matches)
    return key, len(matches)


def delete_event(event_key):
    with update_json(EVENTS_FILE, {}) as events:
        events.pop(event_key, None)
    if get_current_event() == event_key:
        set_current_event('')


def get_current_event():
    return load_json(SETTINGS_FILE, {}).get('current_event', '')


def set_current_event(event_key):
    with update_json(SETTINGS_FILE, {}) as settings:
        settings['current_event'] = event_key
