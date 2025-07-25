let currentEvent = '';
let scouters = {};
let matches = [];
let teams = [];

// Load saved event from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedEvent = localStorage.getItem('currentEvent');
  if (savedEvent) {
    currentEvent = savedEvent;
    document.getElementById('event-key-input').value = savedEvent;
    document.getElementById('current-event-display').textContent = savedEvent;
    document.getElementById('event-section').style.display = 'block';
    // Auto-load data for the saved event
    loadMatches();
  }
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // Load data for the tab
    if (tabId === 'scouters') loadScouters();
  });
});

// Load initial data
loadScouters();

async function loadEventData() {
  const eventKey = document.getElementById('event-key-input').value.trim();
  if (!eventKey) {
    alert('Please enter an event key');
    return;
  }
  
  // Set the current event and update the display
  currentEvent = eventKey;
  document.getElementById('current-event-display').textContent = `${eventKey} (TBA)`;
  document.getElementById('event-section').style.display = 'block';
  
  // Save event to localStorage for persistence
  localStorage.setItem('currentEvent', eventKey);
  
  // Load matches and teams for this event
  await loadMatches();
  await loadTeamsForEvent(eventKey);  
}

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

// Event tab switching
document.addEventListener('DOMContentLoaded', () => {
  // Add event tab switching functionality
  const eventTabBtns = document.querySelectorAll('.event-tab-btn');
  const eventTabContents = document.querySelectorAll('.event-tab-content');
  
  eventTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-event-tab');
      
      // Update active tab button
      eventTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active tab content
      eventTabContents.forEach(t => t.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      
      // Load manual events list when switching to manual-load tab
      if (tabId === 'manual-load') {
        loadManualEventsList();
      }
    });
  });
  
  // Initialize manual events list on page load
  loadManualEventsList();
  addManualMatch(); // Add first match by default
});

let manualMatchCount = 0;

function addManualMatch() {
  manualMatchCount++;
  const container = document.getElementById('manual-matches-container');
  
  const matchHTML = `
    <div class="match-builder" id="match-${manualMatchCount}">
      <div class="match-header">
        <span class="match-title">Match ${manualMatchCount}</span>
        <button type="button" onclick="removeManualMatch(${manualMatchCount})" class="remove-match-btn">Remove</button>
      </div>
      <div class="alliance-inputs">
        <div class="alliance-section red">
          <h5>Red Alliance</h5>
          <div class="team-inputs">
            <input type="text" placeholder="Team 1" data-match="${manualMatchCount}" data-alliance="red" data-position="1">
            <input type="text" placeholder="Team 2" data-match="${manualMatchCount}" data-alliance="red" data-position="2">
            <input type="text" placeholder="Team 3" data-match="${manualMatchCount}" data-alliance="red" data-position="3">
          </div>
        </div>
        <div class="alliance-section blue">
          <h5>Blue Alliance</h5>
          <div class="team-inputs">
            <input type="text" placeholder="Team 1" data-match="${manualMatchCount}" data-alliance="blue" data-position="1">
            <input type="text" placeholder="Team 2" data-match="${manualMatchCount}" data-alliance="blue" data-position="2">
            <input type="text" placeholder="Team 3" data-match="${manualMatchCount}" data-alliance="blue" data-position="3">
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', matchHTML);
}

function removeManualMatch(matchId) {
  const matchElement = document.getElementById(`match-${matchId}`);
  if (matchElement) {
    matchElement.remove();
    
    // Renumber remaining matches
    const remainingMatches = document.querySelectorAll('.match-builder');
    remainingMatches.forEach((match, index) => {
      const newNumber = index + 1;
      match.id = `match-${newNumber}`;
      match.querySelector('.match-title').textContent = `Match ${newNumber}`;
      match.querySelector('.remove-match-btn').setAttribute('onclick', `removeManualMatch(${newNumber})`);
      
      // Update data attributes
      const inputs = match.querySelectorAll('input[data-match]');
      inputs.forEach(input => {
        input.setAttribute('data-match', newNumber);
      });
    });
    
    manualMatchCount = remainingMatches.length;
  }
}

function clearManualMatches() {
  if (confirm('Are you sure you want to clear all matches?')) {
    document.getElementById('manual-matches-container').innerHTML = '';
    manualMatchCount = 0;
    addManualMatch(); // Add one match back
  }
}

function getManualMatchesData() {
  const matches = [];
  const matchElements = document.querySelectorAll('.match-builder');
  
  matchElements.forEach((matchElement) => {
    const redInputs = matchElement.querySelectorAll('input[data-alliance="red"]');
    const blueInputs = matchElement.querySelectorAll('input[data-alliance="blue"]');
    
    const redTeams = Array.from(redInputs).map(input => input.value.trim()).filter(team => team);
    const blueTeams = Array.from(blueInputs).map(input => input.value.trim()).filter(team => team);
    
    // Only add match if it has teams on both sides
    if (redTeams.length > 0 && blueTeams.length > 0) {
      matches.push({
        red_teams: redTeams,
        blue_teams: blueTeams
      });
    }
  });
  
  return matches;
}

async function createManualEvent() {
  const eventName = document.getElementById('manual-event-name').value.trim();
  
  if (!eventName) {
    alert('Please enter an event name');
    return;
  }
  
  const matchesData = getManualMatchesData();
  
  if (matchesData.length === 0) {
    alert('Please add at least one match with teams on both red and blue alliances');
    return;
  }
  
  try {
    const response = await fetch('/api/admin/manual-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        matches: matchesData
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(result.message);
      
      // Set this as the current event and load it
      currentEvent = result.event_key;
      document.getElementById('current-event-display').textContent = `${eventName} (Manual)`;
      document.getElementById('event-section').style.display = 'block';
      localStorage.setItem('currentEvent', currentEvent);
      
      // Clear the form
      document.getElementById('manual-event-name').value = '';
      clearManualMatches();
      
      // Load the event data
      await loadMatches();
      await loadTeamsForEvent(currentEvent);
      
      // Switch back to first tab
      document.querySelector('.event-tab-btn[data-event-tab="tba"]').click();
    } else {
      alert(result.error || 'Error creating manual event');
    }
  } catch (error) {
    alert('Error creating manual event');
    console.error(error);
  }
}

async function loadManualEventsList() {
  try {
    const response = await fetch('/api/admin/manual-events');
    const events = await response.json();
    
    // Update dropdown
    const select = document.getElementById('manual-event-select');
    select.innerHTML = '<option value="">Select an event...</option>';
    
    events.forEach(event => {
      const option = document.createElement('option');
      option.value = event.key;
      option.textContent = `${event.name} (${event.match_count} matches)`;
      select.appendChild(option);
    });
    
    // Update list display
    const listContainer = document.getElementById('manual-events-list');
    if (events.length === 0) {
      listContainer.innerHTML = '<p class="info-text">No manual events found. Create one to get started.</p>';
    } else {
      listContainer.innerHTML = events.map(event => `
        <div class="manual-event-item">
          <div class="manual-event-info">
            <h5>${event.name}</h5>
            <p>${event.match_count} matches • Created: ${new Date(event.created_at).toLocaleDateString()}</p>
          </div>
          <button onclick="deleteManualEventConfirm('${event.key}', '${event.name}')" class="delete-manual-event">Delete</button>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading manual events:', error);
    document.getElementById('manual-events-list').innerHTML = '<p class="error">Error loading manual events</p>';
  }
}

async function loadManualEvent() {
  const eventKey = document.getElementById('manual-event-select').value;
  
  if (!eventKey) {
    alert('Please select a manual event');
    return;
  }
  
  try {
    // Set as current event
    currentEvent = eventKey;
    
    // Get event name from dropdown text
    const select = document.getElementById('manual-event-select');
    const eventName = select.options[select.selectedIndex].textContent;
    
    document.getElementById('current-event-display').textContent = `${eventName} (Manual)`;
    document.getElementById('event-section').style.display = 'block';
    localStorage.setItem('currentEvent', currentEvent);
    
    // Load the event data
    await loadMatches();
    await loadTeamsForEvent(currentEvent);
    
    alert('Manual event loaded successfully!');
  } catch (error) {
    alert('Error loading manual event');
    console.error(error);
  }
}

function refreshManualEvents() {
  loadManualEventsList();
}

async function deleteManualEventConfirm(eventKey, eventName) {
  if (!confirm(`Are you sure you want to delete the manual event "${eventName}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/manual-events/${eventKey}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert('Manual event deleted successfully');
      loadManualEventsList(); // Refresh the list
      
      // If this was the current event, clear it
      if (currentEvent === eventKey) {
        currentEvent = '';
        document.getElementById('current-event-display').textContent = '';
        document.getElementById('event-section').style.display = 'none';
        localStorage.removeItem('currentEvent');
        document.getElementById('matches-container').innerHTML = '<p class="info-text">Select an event to load matches</p>';
      }
    } else {
      alert('Error deleting manual event');
    }
  } catch (error) {
    alert('Error deleting manual event');
    console.error(error);
  }
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

async function loadTeamsForEvent(eventKey) {
  try {
    const response = await fetch(`/api/admin/teams?event=${eventKey}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    teams = await response.json();
    
    // Update the bulk assignment team dropdown
    const bulkTeamSelect = document.getElementById('bulk-team');
    if (bulkTeamSelect) {
      bulkTeamSelect.innerHTML = '<option value="">Select Team</option>';
      teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = `Team ${team}`;
        bulkTeamSelect.appendChild(option);
      });
      console.log(`Loaded ${teams.length} teams for event ${eventKey}`);
    }
  } catch (error) {
    console.error('Error loading teams:', error);
    // Fallback to empty dropdown
    const bulkTeamSelect = document.getElementById('bulk-team');
    if (bulkTeamSelect) {
      bulkTeamSelect.innerHTML = '<option value="">No teams found</option>';
    }
  }
}

function assignMatch(matchNumber) {
  const match = matches.find(m => m.match_number === matchNumber);
  if (!match) return;
  
  const modalHTML = `
    <div class="modal">
      <div class="modal-content large">
        <h3>Assign Scouters - Match ${matchNumber}</h3>
        <form id="assign-form">
          <div class="assignment-grid">
            <div class="alliance red">
              <h4>Red Alliance</h4>
              ${match.red_teams.map(team => `
                <div class="team-select">
                  <label>Team ${team}:</label>
                  <select name="team_${team}">
                    <option value="">Select Scouter</option>
                    ${Object.keys(scouters).map(username => 
                      `<option value="${username}">${scouters[username].name} (${username})</option>`
                    ).join('')}
                  </select>
                </div>
              `).join('')}
            </div>
            <div class="alliance blue">
              <h4>Blue Alliance</h4>
              ${match.blue_teams.map(team => `
                <div class="team-select">
                  <label>Team ${team}:</label>
                  <select name="team_${team}">
                    <option value="">Select Scouter</option>
                    ${Object.keys(scouters).map(username => 
                      `<option value="${username}">${scouters[username].name} (${username})</option>`
                    ).join('')}
                  </select>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" onclick="closeModal()">Cancel</button>
            <button type="submit">Save Assignments</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const assignments = {};
    
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('team_') && value) {
        const teamNumber = key.replace('team_', '');
        assignments[teamNumber] = value;
      }
    }
    
    try {
      const response = await fetch('/api/admin/assign-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_key: currentEvent,
          match_number: matchNumber,
          assignments: assignments
        })
      });
      
      if (response.ok) {
        closeModal();
        loadMatches(); // Refresh the matches display
      } else {
        alert('Error saving assignments');
      }
    } catch (error) {
      alert('Error saving assignments');
      console.error(error);
    }
  });
}

async function loadScouters() {
  try {
    const response = await fetch('/api/admin/scouters');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    scouters = await response.json();
    
    // Update the bulk assignment dropdown
    const bulkScouterSelect = document.getElementById('bulk-scouter');
    if (bulkScouterSelect) {
      bulkScouterSelect.innerHTML = '<option value="">Select Scouter</option>';
      Object.keys(scouters).forEach(username => {
        const option = document.createElement('option');
        option.value = username;
        option.textContent = `${scouters[username].name} (${username})`;
        bulkScouterSelect.appendChild(option);
      });
    }
    
    // Get scouting stats for each scouter
    try {
      const statsResponse = await fetch('/api/admin/scouter-stats');
      const stats = await statsResponse.json();
      
      const scoutersList = document.getElementById('scouters-list');
      scoutersList.innerHTML = Object.keys(scouters).map(username => {
        const scouter = scouters[username];
        const scouterStats = stats[username] || { completed: 0, assigned: 0 };
        return `
          <div class="scouter-card">
            <div class="scouter-info">
              <h4>${scouter.name}</h4>
              <p>Username: ${username}</p>
              <p class="scouter-stats">Completed: ${scouterStats.completed}/${scouterStats.assigned} matches</p>
            </div>
            <button onclick="deleteScouter('${username}')" class="delete-btn">Delete</button>
          </div>
        `;
      }).join('');
      
      if (Object.keys(scouters).length === 0) {
        scoutersList.innerHTML = '<p class="info-text">No scouters found. Create some scouters to get started.</p>';
      }
    } catch (statsError) {
      console.warn('Could not load scouter stats:', statsError);
      // Still display scouters without stats
      const scoutersList = document.getElementById('scouters-list');
      scoutersList.innerHTML = Object.keys(scouters).map(username => {
        const scouter = scouters[username];
        return `
          <div class="scouter-card">
            <div class="scouter-info">
              <h4>${scouter.name}</h4>
              <p>Username: ${username}</p>
            </div>
            <button onclick="deleteScouter('${username}')" class="delete-btn">Delete</button>
          </div>
        `;
      }).join('');
      
      if (Object.keys(scouters).length === 0) {
        scoutersList.innerHTML = '<p class="info-text">No scouters found. Create some scouters to get started.</p>';
      }
    }
  } catch (error) {
    console.error('Error loading scouters:', error);
    const scoutersList = document.getElementById('scouters-list');
    scoutersList.innerHTML = '<p class="error">Error loading scouters. Please refresh the page.</p>';
  }
}

function showCreateScouterModal() {
  document.getElementById('create-scouter-modal').style.display = 'flex';
}

function hideCreateScouterModal() {
  document.getElementById('create-scouter-modal').style.display = 'none';
  document.getElementById('create-scouter-form').reset();
}

function refreshMatches() {
  if (currentEvent) {
    loadMatches();
  } else {
    alert('Please enter an event key first');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('create-scouter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data properly
    const name = document.getElementById('scouter-name').value.trim();
    const username = document.getElementById('scouter-username').value.trim();
    const password = document.getElementById('scouter-password').value;
    
    // Validate fields
    if (!name || !username || !password) {
      alert('All fields are required');
      return;
    }
    
    const data = { name, username, password };
    
    try {
      const response = await fetch('/api/admin/create-scouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        hideCreateScouterModal();
        await loadScouters(); // Reload scouters to show the new one
        alert('Scouter created successfully!');
      } else {
        alert(result.error || 'Error creating scouter');
      }
    } catch (error) {
      alert('Error creating scouter');
      console.error(error);
    }
  });
});

async function deleteScouter(username) {
  if (!confirm(`Are you sure you want to delete scouter "${username}"?`)) return;
  
  try {
    const response = await fetch(`/api/admin/scouters/${username}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Reload scouters to update the display immediately
      await loadScouters();
      alert('Scouter deleted successfully!');
    } else {
      alert('Error deleting scouter');
    }
  } catch (error) {
    alert('Error deleting scouter');
    console.error(error);
  }
}

// Bulk assignment functions
async function bulkAssignTeam() {
  const teamNumber = document.getElementById('bulk-team').value;
  const scouterUsername = document.getElementById('bulk-scouter').value;
  
  if (!teamNumber || !scouterUsername || !currentEvent) {
    alert('Please select an event, team, and scouter');
    return;
  }
  
  if (!confirm(`Assign ${scouters[scouterUsername]?.name} to scout team ${teamNumber} across ALL their matches in this event?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/bulk-assign-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_key: currentEvent,
        team_number: teamNumber,
        scouter_username: scouterUsername
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(result.message);
      loadMatches(); // Refresh the display
      // Clear the form
      document.getElementById('bulk-team').value = '';
      document.getElementById('bulk-scouter').value = '';
    } else {
      alert(result.error || 'Error making bulk assignment');
    }
  } catch (error) {
    alert('Error making bulk assignment');
    console.error(error);
  }
}

async function removeTeamAssignments() {
  const teamNumber = document.getElementById('bulk-team').value;
  
  if (!teamNumber || !currentEvent) {
    alert('Please select an event and team');
    return;
  }
  
  if (!confirm(`Remove ALL assignments for team ${teamNumber} in this event?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/remove-team-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_key: currentEvent,
        team_number: teamNumber
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(`Removed ${result.removed_count} assignments for team ${teamNumber}`);
      loadMatches(); // Refresh the display
      document.getElementById('bulk-team').value = '';
    } else {
      alert('Error removing assignments');
    }
  } catch (error) {
    alert('Error removing assignments');
    console.error(error);
  }
}

function closeModal() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => modal.remove());
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    // Clear saved event data on logout
    localStorage.removeItem('currentEvent');
    window.location.href = '/login';
  } catch (error) {
    localStorage.removeItem('currentEvent');
    window.location.href = '/login';
  }
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeModal();
  }
});

