"""
Statbotics API Integration - With better error handling and debugging
"""

import os
from typing import List, Dict, Optional, Set
from dev_mode import is_dev_mode
import math

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
        Preload EPA values for multiple teams using the correct API method
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
        
        try:
            # Get all team_years for this year with explicit parameters
            print(f"🔍 Calling get_team_years(year={year}, limit=10000, fields=['team', 'epa_end'])")
            
            all_team_years = self.sb.get_team_years(
                year=year,
                limit=10000,
                fields=['team', 'year', 'epa_end', 'epa_start', 'epa_mean', 'epa_max']
            )
            
            if not all_team_years:
                print(f"⚠️  No data returned from Statbotics for year {year}")
                print(f"⚠️  This likely means {year} season data is not yet available")
                # Fall back to zeros
                for team in teams_to_fetch:
                    cache_key = f"{team}_{year}"
                    self.epa_cache[cache_key] = 0
                return
            
            print(f"📊 Received {len(all_team_years)} teams from Statbotics for {year}")
            
            # Debug: print first few entries
            if len(all_team_years) > 0:
                print(f"🔍 Sample data: {all_team_years[0]}")
            
            # Build lookup dict: team_number -> epa_end
            team_epa_map = {}
            for ty in all_team_years:
                team_num = ty.get('team')
                # Use epa_end (end of season EPA), fall back to epa_mean or epa_max
                epa = ty.get('epa_end') or ty.get('epa_mean') or ty.get('epa_max') or 0
                
                if team_num:
                    team_epa_map[team_num] = epa
            
            print(f"📊 Loaded EPA data for {len(team_epa_map)} teams")
            
            # Cache the requested teams
            found_count = 0
            missing_count = 0
            
            for team in teams_to_fetch:
                cache_key = f"{team}_{year}"
                if team in team_epa_map:
                    epa_value = team_epa_map[team]
                    self.epa_cache[cache_key] = epa_value
                    found_count += 1
                    # Debug: show some EPA values
                    if found_count <= 3:
                        print(f"✅ Team {team}: EPA = {epa_value}")
                else:
                    # Team not in database for this year
                    self.epa_cache[cache_key] = 0
                    missing_count += 1
            
            print(f"✅ Cached {found_count} teams with EPA data")
            if missing_count > 0:
                print(f"⚠️  {missing_count} teams have no {year} data (using EPA=0)")
                    
        except Exception as e:
            print(f"❌ Error fetching EPA data: {e}")
            import traceback
            traceback.print_exc()
            
            # Fall back to zeros
            for team in teams_to_fetch:
                cache_key = f"{team}_{year}"
                if cache_key not in self.epa_cache:
                    self.epa_cache[cache_key] = 0
    
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