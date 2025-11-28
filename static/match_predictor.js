async function loadPredictions() {
  const eventKey = document.getElementById('event-input').value.trim();
  const teamNumber = document.getElementById('team-input').value.trim();
  
  if (!eventKey) {
    showError('Please enter an event key');
    return;
  }
  
  // Show loading
  document.getElementById('loading').style.display = 'block';
  document.getElementById('results-section').classList.remove('active');
  document.getElementById('error-container').innerHTML = '';
  
  try {
    let url = `/api/admin/predict-matches?event=${eventKey}`;
    if (teamNumber) {
      url += `&team=${teamNumber}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load predictions');
    }
    
    const predictions = await response.json();
    
    if (predictions.length === 0) {
      showError(teamNumber ? 
        `No matches found for team ${teamNumber} at ${eventKey}` : 
        `No matches found for ${eventKey}`
      );
      return;
    }
    
    displayResults(predictions, teamNumber);
    
  } catch (error) {
    console.error('Error loading predictions:', error);
    showError(error.message);
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

function displayResults(predictions, teamNumber) {
  const resultsSection = document.getElementById('results-section');
  resultsSection.classList.add('active');
  
  // Calculate summary stats
  let wins = 0;
  let losses = 0;
  let avgWinProb = 0;
  
  predictions.forEach(p => {
    if (p.predicted_result === 'WIN') wins++;
    if (p.predicted_result === 'LOSS') losses++;
    if (p.win_probability) avgWinProb += p.win_probability;
  });
  
  avgWinProb = (avgWinProb / predictions.length).toFixed(1);
  
  // Display summary cards if team specified
  const summaryCards = document.getElementById('summary-cards');
  if (teamNumber) {
    summaryCards.innerHTML = `
      <div class="summary-card win">
        <div class="summary-value">${wins}</div>
        <div class="summary-label">Predicted Wins</div>
      </div>
      <div class="summary-card loss">
        <div class="summary-value">${losses}</div>
        <div class="summary-label">Predicted Losses</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${avgWinProb}%</div>
        <div class="summary-label">Avg Win Probability</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${predictions.length}</div>
        <div class="summary-label">Total Matches</div>
      </div>
    `;
  } else {
    summaryCards.innerHTML = `
      <div class="summary-card">
        <div class="summary-value">${predictions.length}</div>
        <div class="summary-label">Total Matches</div>
      </div>
    `;
  }
  
  // Display match cards
  const matchesContainer = document.getElementById('matches-container');
  matchesContainer.innerHTML = predictions.map(p => {
    const cardClass = p.predicted_result === 'WIN' ? 'predicted-win' : 
                     p.predicted_result === 'LOSS' ? 'predicted-loss' : '';
    
    return `
      <div class="match-card ${cardClass}">
        <div class="match-header">
          <div class="match-number">Match ${p.match_number}</div>
          ${p.predicted_result ? `
            <div class="prediction-badge ${p.predicted_result.toLowerCase()}">
              ${p.predicted_result} (${p.win_probability}%)
            </div>
          ` : ''}
        </div>
        
        <div class="alliances">
          <div class="alliance red ${p.team_alliance === 'red' ? 'team-alliance' : ''}">
            <h4>Red Alliance ${p.team_alliance === 'red' ? '(Your Team)' : ''}</h4>
            <div class="teams">${p.red_teams.join(', ')}</div>
          </div>
          <div class="alliance blue ${p.team_alliance === 'blue' ? 'team-alliance' : ''}">
            <h4>Blue Alliance ${p.team_alliance === 'blue' ? '(Your Team)' : ''}</h4>
            <div class="teams">${p.blue_teams.join(', ')}</div>
          </div>
        </div>
        
        <div class="prediction-details">
          <div class="prediction-stat">
            <div class="prediction-stat-label">Red EPA</div>
            <div class="prediction-stat-value">${p.prediction.red_epa}</div>
          </div>
          <div class="prediction-stat">
            <div class="prediction-stat-label">Blue EPA</div>
            <div class="prediction-stat-value">${p.prediction.blue_epa}</div>
          </div>
          <div class="prediction-stat">
            <div class="prediction-stat-label">Red Win %</div>
            <div class="prediction-stat-value">${p.prediction.red_win_prob}%</div>
          </div>
          <div class="prediction-stat">
            <div class="prediction-stat-label">Blue Win %</div>
            <div class="prediction-stat-value">${p.prediction.blue_win_prob}%</div>
          </div>
          <div class="prediction-stat">
            <div class="prediction-stat-label">Confidence</div>
            <div class="prediction-stat-value">
              <span class="confidence-badge ${p.prediction.confidence}">
                ${p.prediction.confidence.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function showError(message) {
  const errorContainer = document.getElementById('error-container');
  errorContainer.innerHTML = `
    <div class="error-message">
      <strong>Error:</strong> ${message}
    </div>
  `;
  document.getElementById('results-section').classList.remove('active');
}

// Allow Enter key to trigger prediction
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('event-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadPredictions();
  });
  document.getElementById('team-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadPredictions();
  });
});