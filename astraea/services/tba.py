import os

import requests

BASE_URL = 'https://www.thebluealliance.com/api/v3'


class TBAError(Exception):
    pass


def _get(path):
    api_key = os.environ.get('TBA_API_KEY', '')
    if not api_key:
        raise TBAError('TBA_API_KEY is not set. Add it to the .env file.')
    try:
        response = requests.get(f'{BASE_URL}{path}', timeout=10,
                                headers={'X-TBA-Auth-Key': api_key, 'User-Agent': 'AstraeaScoutingApp/2.0'})
    except requests.RequestException:
        raise TBAError('Could not reach The Blue Alliance. Check the internet connection.')
    if response.status_code == 404:
        raise TBAError('Event not found on The Blue Alliance.')
    if response.status_code != 200:
        raise TBAError(f'The Blue Alliance returned an error ({response.status_code}).')
    return response.json()


def fetch_event(event_key):
    event = _get(f'/event/{event_key}/simple')
    matches = []
    for match in _get(f'/event/{event_key}/matches/simple'):
        if match['comp_level'] != 'qm':
            continue
        red = [t.replace('frc', '') for t in match['alliances']['red']['team_keys']]
        blue = [t.replace('frc', '') for t in match['alliances']['blue']['team_keys']]
        matches.append({'match_number': match['match_number'], 'red_teams': red, 'blue_teams': blue})
    matches.sort(key=lambda m: m['match_number'])
    return event.get('name', event_key), matches
