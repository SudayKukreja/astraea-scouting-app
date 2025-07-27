import requests
import json
import os
from datetime import datetime, timedelta

class TBAClient:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.environ.get('TBA_API_KEY', 'your_tba_api_key_here')
        self.base_url = 'https://www.thebluealliance.com/api/v3'
        self.headers = {
            'X-TBA-Auth-Key': self.api_key,
            'User-Agent': 'AstraeaScoutingApp/1.0'
        }
        
        if self.api_key and self.api_key != 'your_tba_api_key_here':
            print(f"TBA API Key loaded: {self.api_key[:10]}...")
        else:
            print("WARNING: TBA API Key not found or using placeholder!")

    def get_current_events(self):
        """Get current/recent events - filtered to show only relevant ones"""
        try:
            year = datetime.now().year
            url = f'{self.base_url}/events/{year}'
            print(f"Fetching events from: {url}")
            
            response = requests.get(url, headers=self.headers, timeout=10)
            print(f"TBA API Response Status: {response.status_code}")
            
            if response.status_code == 200:
                events = response.json()
                print(f"Retrieved {len(events)} events from TBA")
                
                today = datetime.now().date()
                two_weeks_ago = today - timedelta(days=14)
                two_months_ahead = today + timedelta(days=60)
                
                current_events = []
                for event in events:
                    if event.get('event_type') in [0, 1, 2, 3, 4]: 
                        try:
                            event_start = datetime.strptime(event['start_date'], '%Y-%m-%d').date()
                            event_end = datetime.strptime(event['end_date'], '%Y-%m-%d').date()
                            
                            if (event_start <= today <= event_end or 
                                event_start <= two_months_ahead or   
                                event_end >= two_weeks_ago):          
                                
                                current_events.append({
                                    'key': event['key'],
                                    'name': event['name'],
                                    'start_date': event['start_date'],
                                    'end_date': event['end_date'],
                                    'location': f"{event.get('city', '')}, {event.get('state_prov', '')}",
                                    'event_type': event.get('event_type', 0),
                                    'week': event.get('week')
                                })
                        except (ValueError, KeyError):
                            # Skip events with invalid date formats
                            continue
                
                print(f"Filtered to {len(current_events)} relevant events")
                return sorted(current_events, key=lambda x: (x['start_date'], x['name']))
            else:
                print(f"TBA API Error: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            print(f"Error fetching events: {e}")
            return []

    def get_event_matches(self, event_key):
        """Get matches for a specific event"""
        try:
            url = f'{self.base_url}/event/{event_key}/matches'
            print(f"Fetching matches from: {url}")
            
            response = requests.get(url, headers=self.headers, timeout=10)
            print(f"TBA API Response Status: {response.status_code}")
            
            if response.status_code == 200:
                matches = response.json()
                print(f"Retrieved {len(matches)} matches from TBA")
                
                processed_matches = []
                
                for match in matches:
                    if match['comp_level'] == 'qm':  
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
                
                print(f"Processed {len(processed_matches)} qualification matches")
                return sorted(processed_matches, key=lambda x: x['match_number'])
            else:
                print(f"TBA API Error: {response.status_code} - {response.text}")
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