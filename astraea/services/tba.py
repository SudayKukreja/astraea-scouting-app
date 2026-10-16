import os
import time

import requests

CACHE_SECONDS = 120


class TBAClient:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.environ.get('TBA_API_KEY', '')
        self.base_url = 'https://www.thebluealliance.com/api/v3'
        self.headers = {
            'X-TBA-Auth-Key': self.api_key,
            'User-Agent': 'AstraeaScoutingApp/1.0'
        }
        self._cache = {}
        if not self.api_key:
            print('WARNING: TBA_API_KEY not set')

    def get_event_matches(self, event_key):
        cached = self._cache.get(event_key)
        if cached and time.time() - cached[0] < CACHE_SECONDS:
            return cached[1]

        try:
            response = requests.get(f'{self.base_url}/event/{event_key}/matches', headers=self.headers, timeout=10)
        except requests.RequestException as e:
            print(f'Error fetching matches for {event_key}: {e}')
            return cached[1] if cached else []

        if response.status_code != 200:
            print(f'TBA API Error: {response.status_code} - {response.text}')
            return []

        matches = []
        for match in response.json():
            if match['comp_level'] != 'qm':
                continue
            red = [t.replace('frc', '') for t in match['alliances']['red']['team_keys']]
            blue = [t.replace('frc', '') for t in match['alliances']['blue']['team_keys']]
            matches.append({
                'key': match['key'],
                'match_number': match['match_number'],
                'red_teams': red,
                'blue_teams': blue,
                'all_teams': red + blue
            })
        matches.sort(key=lambda m: m['match_number'])
        self._cache[event_key] = (time.time(), matches)
        return matches
