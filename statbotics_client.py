"""
Statbotics API Integration for Match Win/Loss Predictions
"""

import statbotics
from typing import List, Dict, Optional

class StatboticsPredictor:
    """Client for predicting match outcomes using Statbotics EPA"""
    
    def __init__(self):
        """Initialize Statbotics client"""
        try:
            self.sb = statbotics.Statbotics()
            print("✅ Statbotics API initialized")
        except Exception as e:
            print(f"⚠️  Statbotics initialization failed: {e}")
            self.sb = None
    
    def get_team_epa(self, team_number: int, year: int = 2025) -> Optional[float]:
        """Get team's EPA rating"""
        if not self.sb:
            return None
            
        try:
            team_year = self.sb.get_team_year(team_number, year)
            return team_year.get('epa_end', 0)
        except Exception as e:
            print(f"Could not fetch EPA for team {team_number}: {e}")
            return None
    
    def predict_match(self, red_teams: List[int], blue_teams: List[int], year: int = 2025) -> Dict:
        """
        Predict match outcome using EPA
        
        Returns:
            {
                'red_epa': float,
                'blue_epa': float,
                'red_win_prob': float (0-100),
                'blue_win_prob': float (0-100),
                'predicted_winner': 'red' or 'blue',
                'confidence': 'high', 'medium', or 'low'
            }
        """
        # Get EPAs for all teams
        red_epas = [self.get_team_epa(team, year) for team in red_teams]
        blue_epas = [self.get_team_epa(team, year) for team in blue_teams]
        
        # Filter out None values and calculate totals
        red_epas = [epa for epa in red_epas if epa is not None]
        blue_epas = [epa for epa in blue_epas if epa is not None]
        
        if not red_epas or not blue_epas:
            return {
                'red_epa': 0,
                'blue_epa': 0,
                'red_win_prob': 50,
                'blue_win_prob': 50,
                'predicted_winner': 'unknown',
                'confidence': 'none',
                'error': 'EPA data not available'
            }
        
        red_total_epa = sum(red_epas)
        blue_total_epa = sum(blue_epas)
        
        # Calculate win probability using logistic function
        # EPA difference of ~30 = ~70% win probability
        epa_diff = red_total_epa - blue_total_epa
        
        # Logistic function: P(red wins) = 1 / (1 + e^(-diff/scaling_factor))
        import math
        scaling_factor = 30  # Tuned so 30 EPA diff = ~70% win prob
        
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
            'confidence': confidence
        }