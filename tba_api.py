import requests
import json
import os
from datetime import datetime

class TBAClient:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.environ.get('TBA_API_KEY', 'your_tba_api_key_here')
        self.base_url = 'https://www.thebluealliance.com/api/v3'
        self.headers = {
            'X-TBA-Auth-Key': self.api_key,
            'User-Agent': 'AstraeaScoutingApp/1.0'
        }

    def get_current_events(self):
        """Get current/recent events"""
        try:
            year = datetime.now().year
            response = requests.get(f'{self.base_url}/events/{year}', headers=self.headers)
            if response.status_code == 200:
                events = response.json()
                # Filter for current/upcoming events
                current_events = []
                for event in events:
                    if event.get('event_type') in [0, 1, 2, 3, 4]:  # Regional, District, etc.
                        current_events.append({
                            'key': event['key'],
                            'name': event['name'],
                            'start_date': event['start_date'],
                            'end_date': event['end_date'],
                            'location': f"{event.get('city', '')}, {event.get('state_prov', '')}"
                        })
                return sorted(current_events, key=lambda x: x['start_date'])
            return []
        except Exception as e:
            print(f"Error fetching events: {e}")
            return []

    def get_event_matches(self, event_key):
        """Get matches for a specific event"""
        try:
            response = requests.get(f'{self.base_url}/event/{event_key}/matches', headers=self.headers)
            if response.status_code == 200:
                matches = response.json()
                processed_matches = []
                
                for match in matches:
                    if match['comp_level'] == 'qm':  # Qualification matches only
                        # Extract team numbers
                        red_teams = [team.replace('frc', '') for team in match['alliances']['red']['team_keys']]
                        blue_teams = [team.replace('frc', '') for team in match['alliances']['blue']['team_keys']]
                        
                        processed_matches.append({
                            'key': match['key'],
                            'match_number': match['match_number'],
                            'red_teams': red_teams,
                            'blue_teams': blue_teams,
                            'all_teams': red_teams + blue_teams,
                            'predicted_time': match.get('predicted_time'),
                            'actual_time': match.get('actual_time'),
                            'time': match.get('time')
                        })
                
                return sorted(processed_matches, key=lambda x: x['match_number'])
            return []
        except Exception as e:
            print(f"Error fetching matches for {event_key}: {e}")
            return []

    def get_team_info(self, team_key):
        """Get basic info about a team"""
        try:
            response = requests.get(f'{self.base_url}/team/{team_key}', headers=self.headers)
            if response.status_code == 200:
                team = response.json()
                return {
                    'key': team['key'],
                    'team_number': team['team_number'],
                    'nickname': team.get('nickname', ''),
                    'name': team.get('name', ''),
                    'city': team.get('city', ''),
                    'state_prov': team.get('state_prov', ''),
                    'country': team.get('country', '')
                }
            return None
        except Exception as e:
            print(f"Error fetching team info for {team_key}: {e}")
            return None

# Sample data for testing when TBA API is not available
SAMPLE_MATCHES = [
    {
        'key': '2025test_qm1',
        'match_number': 1,
        'red_teams': ['254', '1323', '2468'],
        'blue_teams': ['148', '2471', '5940'],
        'all_teams': ['254', '1323', '2468', '148', '2471', '5940'],
        'predicted_time': None,
        'actual_time': None,
        'time': None
    },
    {
        'key': '2025test_qm2',
        'match_number': 2,
        'red_teams': ['1678', '5190', '6834'],
        'blue_teams': ['973', '1114', '2056'],
        'all_teams': ['1678', '5190', '6834', '973', '1114', '2056'],
        'predicted_time': None,
        'actual_time': None,
        'time': None
    }
]

def get_sample_matches():
    """Return sample matches for testing"""
    return SAMPLE_MATCHES