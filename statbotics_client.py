"""
Statbotics API Integration - Using individual team_year lookups (WORKS!)
"""

import os
from typing import List, Dict, Optional, Set
from dev_mode import is_dev_mode
import math
import time

# Try to import statbotics
try:
    import statbotics
    STATBOTICS_AVAILABLE = True
except ImportError:
    print("⚠️  Statbotics package not installed")
    STATBOTICS_AVAILABLE = False

class StatboticsPredictor:
    """Client for predicting match outcomes using Statbotics EPA with caching"""
    
    def __init__(self):
        """Initialize Statbotics client"""
        self.mock_mode = False
        self.epa_cache = {}  # Cache EPA values
        
        if not STATBOTICS_AVAILABLE:
            print("⚠️  Statbotics not available - install with: pip install statbotics")
            self.sb = None
            self.mock_mode = is_dev_mode()
        else:
            try:
                self.sb = statbotics.Statbotics()
                print("✅ Statbotics API initialized")
            except Exception as e:
                print(f"⚠️  Statbotics initialization failed: {e}")
                self.sb = None
                self.mock_mode = is_dev_mode()
    
    def _generate_mock_epa(self, team_number: int) -> float:
        """Generate consistent mock EPA values for dev testing"""
        import random
        random.seed(team_number)
        return random.uniform(-10, 30)
    
    def preload_team_epas(self, team_numbers: Set[int], year: int = 2025):
        """
        Preload EPA values for multiple teams by fetching each individually
        This is slower but actually works with the Statbotics API
        """
        if self.mock_mode or not self.sb:
            for team in team_numbers:
                cache_key = f"{team}_{year}"
                self.epa_cache[cache_key] = self._generate_mock_epa(team)
            print(f"🚀 Generated mock EPAs for {len(team_numbers)} teams")
            return
        
        teams_to_fetch = [t for t in team_numbers if f"{t}_{year}" not in self.epa_cache]
        
        if not teams_to_fetch:
            print(f"✅ All {len(team_numbers)} teams already cached")
            return
        
        print(f"📊 Fetching EPA data for {len(teams_to_fetch)} teams from Statbotics...")
        
        found_count = 0
        missing_count = 0
        
        for team in teams_to_fetch:
            cache_key = f"{team}_{year}"
            
            try:
                # ✅ FIX: Use get_team_year() for individual team lookup
                # This method WORKS and is documented!
                team_year_data = self.sb.get_team_year(team=team, year=year)
                
                if team_year_data:
                    # Try to get epa_end, fall back to other EPA values
                    epa = (team_year_data.get('epa_end') or 
                           team_year_data.get('epa_mean') or 
                           team_year_data.get('epa_max') or 0)
                    
                    self.epa_cache[cache_key] = epa
                    found_count += 1
                    
                    # Show first few for debugging
                    if found_count <= 3:
                        print(f"✅ Team {team}: EPA = {epa:.1f}")
                else:
                    # No data for this team/year
                    self.epa_cache[cache_key] = 0
                    missing_count += 1
                    
            except Exception as e:
                # Team not found or error
                if "404" not in str(e):
                    print(f"⚠️  Error fetching team {team}: {e}")
                self.epa_cache[cache_key] = 0
                missing_count += 1
            
            # Small delay to avoid rate limiting (10 requests/second = 0.1s delay)
            if len(teams_to_fetch) > 10:
                time.sleep(0.1)
        
        print(f"✅ Cached {found_count} teams with EPA data")
        if missing_count > 0:
            print(f"⚠️  {missing_count} teams have no {year} data (using EPA=0)")
    
    def get_team_epa(self, team_number: int, year: int = 2025) -> float:
        """Get team's EPA rating from cache"""
        cache_key = f"{team_number}_{year}"
        
        if cache_key in self.epa_cache:
            return self.epa_cache[cache_key]
        
        if self.mock_mode:
            epa = self._generate_mock_epa(team_number)
            self.epa_cache[cache_key] = epa
            return epa
        
        print(f"⚠️  EPA not cached for team {team_number}, returning 0")
        return 0
    
    def predict_match(self, red_teams: List[int], blue_teams: List[int], year: int = 2025) -> Dict:
        """
        Predict match outcome using EPA
        Call preload_team_epas() first!
        """
        red_epas = [self.get_team_epa(team, year) for team in red_teams]
        blue_epas = [self.get_team_epa(team, year) for team in blue_teams]
        
        red_total_epa = sum(red_epas)
        blue_total_epa = sum(blue_epas)
        
        # Calculate win probability
        epa_diff = red_total_epa - blue_total_epa
        scaling_factor = 30
        
        red_win_prob = 1 / (1 + math.exp(-epa_diff / scaling_factor))
        blue_win_prob = 1 - red_win_prob
        
        red_win_prob_pct = red_win_prob * 100
        blue_win_prob_pct = blue_win_prob * 100
        
        # Confidence level
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
        """Clear the EPA cache"""
        self.epa_cache.clear()
        print("🗑️  EPA cache cleared")