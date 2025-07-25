let assignments = [];

async function loadMatches() {
  if (!currentEvent) {
    alert('Please enter an event key first');
    return;
  }
  
  const container = document.getElementById('matches-container');
  container.innerHTML = '<p>Loading matches...</p>';
  
  try {
    const response = await fetch(`/api/admin/matches?event=${currentEvent}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    matches = await response.json();
    
    if (matches.length === 0) {
      container.innerHTML = '<p>No matches found for this event. Make sure the event key is correct.</p>';
      return;
    }
    
    // Load teams for this event if not already loaded
    if (teams.length === 0) {
      await loadTeamsForEvent(currentEvent);
    }
    
    // Load current assignments
    const assignmentsResponse = await fetch(`/api/admin/assignments?event=${currentEvent}`);
    const assignments = await assignmentsResponse.json();
    
    // Load match summary for stats
    const summaryResponse = await fetch(`/api/admin/match-summary?event=${currentEvent}`);
    const summary = await summaryResponse.json();
    
    // Add summary display at the top
    const summaryHTML = `
      <div class="match-summary">
        <h3>Assignment Summary</h3>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-number">${summary.total_assignments}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-item completed">
            <span class="stat-number">${summary.completed}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat-item home-games">
            <span class="stat-number">${summary.home_games}</span>
            <span class="stat-label">Home Games</span>
          </div>
          <div class="stat-item pending">
            <span class="stat-number">${summary.pending}</span>
            <span class="stat-label">Pending</span>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = summaryHTML + matches.map(match => {
      const matchAssignments = assignments.filter(a => a.match_number === match.match_number);
      const isHomeMatch = match.all_teams.includes('6897'); // Check if team 6897 is playing
      
      return `
        <div class="match-card ${isHomeMatch ? 'home-match' : ''}">
          <div class="match-header">
            <div class="match-info">
              <h4>Match ${match.match_number}</h4>
              ${isHomeMatch ? '<span class="home-indicator">🏠 Home Match</span>' : ''}
            </div>
            <button onclick="assignMatch(${match.match_number})" class="assign-btn">Assign Scouters</button>
          </div>
          <div class="teams-grid">
            <div class="alliance red">
              <h5>Red Alliance</h5>
              ${match.red_teams.map(team => {
                const assignment = matchAssignments.find(a => a.team_number === team);
                const isHomeTeam = team === '6897';
                return `
                  <div class="team-assignment ${isHomeTeam ? 'home-team' : ''}">
                    <span class="team-number">${team}${isHomeTeam ? ' (HOME)' : ''}</span>
                    <span class="assignment-status">
                      ${assignment ? getAssignmentStatusDisplay(assignment) : 'Unassigned'}
                    </span>
                    ${assignment && !isHomeTeam ? getAssignmentActions(assignment) : ''}
                  </div>
                `;
              }).join('')}
            </div>
            <div class="alliance blue">
              <h5>Blue Alliance</h5>
              ${match.blue_teams.map(team => {
                const assignment = matchAssignments.find(a => a.team_number === team);
                const isHomeTeam = team === '6897';
                return `
                  <div class="team-assignment ${isHomeTeam ? 'home-team' : ''}">
                    <span class="team-number">${team}${isHomeTeam ? ' (HOME)' : ''}</span>
                    <span class="assignment-status">
                      ${assignment ? getAssignmentStatusDisplay(assignment) : 'Unassigned'}
                    </span>
                    ${assignment && !isHomeTeam ? getAssignmentActions(assignment) : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = '<p>Error loading matches. Please check the event key and try again.</p>';
    console.error('Error loading matches:', error);
  }
}

function getAssignmentStatusDisplay(assignment) {
  if (assignment.is_home_game) {
    return '<span class="status-badge home-game">🏠 Home Game</span>';
  } else if (assignment.completed) {
    return `<span class="status-badge completed">✅ ${assignment.scouter}</span>`;
  } else {
    return `<span class="status-badge pending">⏳ ${assignment.scouter}</span>`;
  }
}

function getAssignmentActions(assignment) {
  if (assignment.is_home_game) {
    return `
      <div class="assignment-actions">
        <button onclick="unmarkHomeGame('${assignment.assignment_key}')" class="action-btn unmark-home">
          Remove Home
        </button>
      </div>
    `;
  } else if (!assignment.completed) {
    return `
      <div class="assignment-actions">
        <button onclick="markHomeGame('${assignment.assignment_key}')" class="action-btn mark-home">
          Mark Home
        </button>
      </div>
    `;
  }
  return '';
}

async function markHomeGame(assignmentKey) {
  if (!confirm('Mark this assignment as a home game? The scouter will not need to scout this match.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/mark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      loadMatches(); // Refresh the display
    } else {
      alert('Error marking as home game');
    }
  } catch (error) {
    alert('Error marking as home game');
    console.error(error);
  }
}

async function unmarkHomeGame(assignmentKey) {
  if (!confirm('Remove home game status? The scouter will need to complete this assignment.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/unmark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      loadMatches(); // Refresh the display
    } else {
      alert('Error removing home game status');
    }
  } catch (error) {
    alert('Error removing home game status');
    console.error(error);
  }
}

function startScouting(assignmentKey, teamNumber, matchNumber) {
  // Store the assignment key in sessionStorage so we can mark it as completed later
  sessionStorage.setItem('currentAssignment', assignmentKey);
  
  // Redirect to the scouting form with pre-filled data
  const url = `/scout?team=${teamNumber}&match=${matchNumber}&assignment=${assignmentKey}`;
  window.location.href = url;
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch (error) {
    window.location.href = '/login';
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Load assignments on page load
  loadAssignments();

  // Refresh assignments every 30 seconds to see updates
  setInterval(loadAssignments, 30000);

  // Check if we just came back from scouting
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('completed') === 'true') {
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = 'Scout report submitted successfully!';
    successMessage.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(successMessage);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      successMessage.remove();
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 3000);
    
    // Reload assignments to reflect the completed status
    setTimeout(loadAssignments, 500);
  }
});