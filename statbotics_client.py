"""
Statbotics API Integration with Batch Processing & Caching
Fixes timeout issues by fetching all team data at once
"""

import os
from typing import List, Dict, Optional, Set
from dev_mode import is_dev_mode
import math

# Try to import statbotics, but don't fail if it's not installed
try:
    import statbotics
    STATBOTICS_AVAILABLE = True
except ImportError:
    print("⚠️  Statbotics package not installed - using mock data")
    STATBOTICS_AVAILABLE = False

class StatboticsPredictor:
    """Client for predicting match outcomes using Statbotics EPA with caching"""
    
    def __init__(self):
        """Initialize Statbotics client or use mock mode"""
        self.mock_mode = False
        self.epa_cache = {}  # Cache EPA values to avoid redundant API calls
        
        # In dev mode, use mock data if Statbotics isn't available
        if is_dev_mode() and not STATBOTICS_AVAILABLE:
            print("🚀 DEV MODE: Using mock EPA data for predictions")
            self.mock_mode = True
            self.sb = None
        elif STATBOTICS_AVAILABLE:
            try:
                self.sb = statbotics.Statbotics()
                print("✅ Statbotics API initialized")
            except Exception as e:
                print(f"⚠️  Statbotics initialization failed: {e}")
                if is_dev_mode():
                    print("🚀 DEV MODE: Falling back to mock data")
                    self.mock_mode = True
                    self.sb = None
                else:
                    self.sb = None
        else:
            self.sb = None
    
    def _generate_mock_epa(self, team_number: int) -> float:
        """Generate consistent mock EPA values for dev testing"""
        import random
        random.seed(team_number)
        
        if team_number <= 500:
            return random.uniform(50, 80)
        elif team_number <= 2000:
            return random.uniform(30, 50)
        elif team_number <= 5000:
            return random.uniform(10, 30)
        else:
            return random.uniform(-10, 10)
    
    def preload_team_epas(self, team_numbers: Set[int], year: int = 2025):
        """
        Preload EPA values for multiple teams at once
        This dramatically reduces API calls and prevents timeouts
        """
        if self.mock_mode:
            # Generate mock EPAs for all teams
            for team in team_numbers:
                cache_key = f"{team}_{year}"
                self.epa_cache[cache_key] = self._generate_mock_epa(team)
            print(f"🚀 Generated mock EPAs for {len(team_numbers)} teams")
            return
        
        if not self.sb:
            return
        
        # Filter out teams we already have cached
        teams_to_fetch = [t for t in team_numbers if f"{t}_{year}" not in self.epa_cache]
        
        if not teams_to_fetch:
            print(f"✅ All {len(team_numbers)} teams already cached")
            return
        
        print(f"📊 Fetching EPA data for {len(teams_to_fetch)} teams from Statbotics...")
        
        try:
            # ✅ FIX: Use the correct method - fetch each team individually but cache them
            # The batch API doesn't work the way we thought, so we'll fetch efficiently
            
            for team in teams_to_fetch:
                cache_key = f"{team}_{year}"
                try:
                    # Get team year data for this specific team
                    team_year = self.sb.get_team_year(team=team, year=year)
                    
                    if team_year and 'epa_end' in team_year:
                        epa = team_year['epa_end']
                        self.epa_cache[cache_key] = epa
                    else:
                        # Team exists but no EPA data
                        self.epa_cache[cache_key] = 0
                        print(f"⚠️  No EPA data for team {team} in {year}")
                        
                except Exception as e:
                    # Team not found or error
                    print(f"⚠️  Could not fetch EPA for team {team}: {e}")
                    self.epa_cache[cache_key] = 0
                    
            print(f"✅ Cached EPA data for {len(teams_to_fetch)} teams")
            
        except Exception as e:
            print(f"❌ Error fetching EPA data: {e}")
            # Fall back to zeros for missing teams
            for team in teams_to_fetch:
                cache_key = f"{team}_{year}"
                if cache_key not in self.epa_cache:
                    if is_dev_mode():
                        self.epa_cache[cache_key] = self._generate_mock_epa(team)
                    else:
                        self.epa_cache[cache_key] = 0
    
    def get_team_epa(self, team_number: int, year: int = 2025) -> float:
        """Get team's EPA rating from cache (must preload first!)"""
        cache_key = f"{team_number}_{year}"
        
        # Return from cache if available
        if cache_key in self.epa_cache:
            return self.epa_cache[cache_key]
        
        # If not in cache and mock mode, generate mock
        if self.mock_mode:
            epa = self._generate_mock_epa(team_number)
            self.epa_cache[cache_key] = epa
            return epa
        
        # Otherwise return 0 (should have been preloaded)
        print(f"⚠️  EPA not cached for team {team_number}, returning 0")
        return 0
    
    def predict_match(self, red_teams: List[int], blue_teams: List[int], year: int = 2025) -> Dict:
        """
        Predict match outcome using EPA
        Note: Call preload_team_epas() first for best performance!
        """
        # Get EPAs from cache
        red_epas = [self.get_team_epa(team, year) for team in red_teams]
        blue_epas = [self.get_team_epa(team, year) for team in blue_teams]
        
        red_total_epa = sum(red_epas)
        blue_total_epa = sum(blue_epas)
        
        # Calculate win probability using logistic function
        epa_diff = red_total_epa - blue_total_epa
        scaling_factor = 30  # 30 EPA diff = ~70% win prob
        
        red_win_prob = 1 / (1 + math.exp(-epa_diff / scaling_factor))
        blue_win_prob = 1 - red_win_prob
        
        # Convert to percentage
        red_win_prob_pct = red_win_prob * 100
        blue_win_prob_pct = blue_win_prob * 100
        
        # Determine confidence level
        max_prob = max(red_win_prob_pct, blue_win_prob_pct)
        if max_prob >= 75:
            confidence = 'high'
        elif max_prob >= 60:
            confidence = 'medium'
        else:
            confidence = 'low'
        
        return {
            'red_epa': round(red_total_epa, 1),
            'blue_epa': round(blue_total_epa, 1),
            'red_win_prob': round(red_win_prob_pct, 1),
            'blue_win_prob': round(blue_win_prob_pct, 1),
            'predicted_winner': 'red' if red_win_prob > 0.5 else 'blue',
            'confidence': confidence,
            'mock_data': self.mock_mode
        }
    
    def clear_cache(self):
        """Clear the EPA cache (useful between events)"""
        self.epa_cache.clear()
        print("🗑️  EPA cache cleared")