let currentEvent = '';
let scouters = {};
let matches = [];
let teams = [];

document.addEventListener('DOMContentLoaded', () => {
  const savedEvent = localStorage.getItem('currentEvent');
  if (savedEvent) {
    currentEvent = savedEvent;
    document.getElementById('event-key-input').value = savedEvent;
    document.getElementById('current-event-display').textContent = savedEvent;
    document.getElementById('event-section').style.display = 'block';
    loadMatches();
  }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    if (tabId === 'scouters') loadScouters();
  });
});

loadScouters();

async function loadEventData() {
  const eventKey = document.getElementById('event-key-input').value.trim();
  if (!eventKey) {
    alert('Please enter an event key');
    return;
  }

  currentEvent = eventKey;
  document.getElementById('current-event-display').textContent = `${eventKey} (TBA)`;
  document.getElementById('event-section').style.display = 'block';
  
  localStorage.setItem('currentEvent', eventKey);

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
    
    if (teams.length === 0) {
      await loadTeamsForEvent(currentEvent);
    }
    
    const assignmentsResponse = await fetch(`/api/admin/assignments?event=${currentEvent}`);
    const assignments = await assignmentsResponse.json();
    const summaryResponse = await fetch(`/api/admin/match-summary?event=${currentEvent}`);
    const summary = await summaryResponse.json();

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
      const isHomeMatch = match.all_teams.includes('6897'); 
      
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

document.addEventListener('DOMContentLoaded', () => {
  const eventTabBtns = document.querySelectorAll('.event-tab-btn');
  const eventTabContents = document.querySelectorAll('.event-tab-content');
  
  eventTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-event-tab');
      
      eventTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      eventTabContents.forEach(t => t.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');

      if (tabId === 'manual-load') {
        loadManualEventsList();
      }
    });
  });
  
  loadManualEventsList();
  addManualMatch();
});

let manualMatchCount = 0;


function showBulkMatchModal() {
  const modalHTML = `
    <div class="modal">
      <div class="modal-content large">
        <h3>Bulk Add Matches</h3>
        <p>Enter match data in one of the formats below:</p>
        
        <!-- Format Selection -->
        <div class="bulk-format-tabs">
          <button class="format-tab-btn active" data-format="csv">CSV Format</button>
          <button class="format-tab-btn" data-format="text">Text Format</button>
          <button class="format-tab-btn" data-format="json">JSON Format</button>
        </div>
        
        <!-- CSV Format Tab -->
        <div id="csv-format" class="format-content active">
          <p><strong>CSV Format:</strong> Each line is a match with red teams, then blue teams</p>
          <code>254,148,1323,2468,2471,5940</code>
          <textarea id="bulk-csv-input" placeholder="Enter CSV format matches (one per line):
254,148,1323,2468,2471,5940
1678,5190,6834,973,1114,2056
..." rows="10" style="width: 100%; font-family: monospace;"></textarea>
        </div>
        
        <!-- Text Format Tab -->
        <div id="text-format" class="format-content">
          <p><strong>Text Format:</strong> Natural language format</p>
          <code>Red: 254, 148, 1323 vs Blue: 2468, 2471, 5940</code>
          <textarea id="bulk-text-input" placeholder="Enter text format matches (one per line):
Red: 254, 148, 1323 vs Blue: 2468, 2471, 5940
Red: 1678, 5190, 6834 vs Blue: 973, 1114, 2056
..." rows="10" style="width: 100%; font-family: monospace;"></textarea>
        </div>
        
        <!-- JSON Format Tab -->
        <div id="json-format" class="format-content">
          <p><strong>JSON Format:</strong> Structured data format</p>
          <textarea id="bulk-json-input" placeholder='Enter JSON format:
[
  {"red": ["254", "148", "1323"], "blue": ["2468", "2471", "5940"]},
  {"red": ["1678", "5190", "6834"], "blue": ["973", "1114", "2056"]}
]' rows="10" style="width: 100%; font-family: monospace;"></textarea>
        </div>
        
        <div class="bulk-preview">
          <h4>Preview:</h4>
          <div id="bulk-preview-container">
            <p class="info-text">Enter match data above to see preview</p>
          </div>
        </div>
        
        <div class="modal-actions">
          <button type="button" onclick="closeModal()">Cancel</button>
          <button type="button" onclick="previewBulkMatches()">Preview Matches</button>
          <button type="button" onclick="addBulkMatches()" id="add-bulk-btn" disabled>Add Matches</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Add event listeners for format tabs
  document.querySelectorAll('.format-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.getAttribute('data-format');
      
      // Update active tab
      document.querySelectorAll('.format-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active content
      document.querySelectorAll('.format-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`${format}-format`).classList.add('active');
    });
  });
  
  // Add real-time preview
  ['bulk-csv-input', 'bulk-text-input', 'bulk-json-input'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', previewBulkMatches);
    }
  });
}

function parseMatchData(input, format) {
  const matches = [];
  
  try {
    switch (format) {
      case 'csv':
        const csvLines = input.trim().split('\n').filter(line => line.trim());
        csvLines.forEach((line, index) => {
          const teams = line.split(',').map(t => t.trim()).filter(t => t);
          if (teams.length === 6) {
            matches.push({
              red_teams: teams.slice(0, 3),
              blue_teams: teams.slice(3, 6)
            });
          } else if (teams.length > 0) {
            throw new Error(`Line ${index + 1}: Expected 6 teams, got ${teams.length}`);
          }
        });
        break;
        
      case 'text':
        const textLines = input.trim().split('\n').filter(line => line.trim());
        textLines.forEach((line, index) => {
          // Parse "Red: 254, 148, 1323 vs Blue: 2468, 2471, 5940" format
          const match = line.toLowerCase().match(/red:\s*([^v]+)vs\s*blue:\s*(.+)/);
          if (match) {
            const redTeams = match[1].split(',').map(t => t.trim()).filter(t => t);
            const blueTeams = match[2].split(',').map(t => t.trim()).filter(t => t);
            if (redTeams.length >= 1 && blueTeams.length >= 1) {
              matches.push({
                red_teams: redTeams,
                blue_teams: blueTeams
              });
            }
          } else {
            throw new Error(`Line ${index + 1}: Invalid format. Expected "Red: ... vs Blue: ..."`);
          }
        });
        break;
        
      case 'json':
        const jsonData = JSON.parse(input);
        if (Array.isArray(jsonData)) {
          jsonData.forEach((match, index) => {
            if (match.red && match.blue && Array.isArray(match.red) && Array.isArray(match.blue)) {
              matches.push({
                red_teams: match.red.map(t => String(t).trim()),
                blue_teams: match.blue.map(t => String(t).trim())
              });
            } else {
              throw new Error(`Match ${index + 1}: Invalid structure. Expected {red: [...], blue: [...]}`);
            }
          });
        } else {
          throw new Error('JSON must be an array of match objects');
        }
        break;
    }
  } catch (error) {
    throw new Error(`Parse error: ${error.message}`);
  }
  
  return matches;
}

function previewBulkMatches() {
  const activeFormat = document.querySelector('.format-tab-btn.active').getAttribute('data-format');
  const inputId = `bulk-${activeFormat}-input`;
  const input = document.getElementById(inputId).value.trim();
  const previewContainer = document.getElementById('bulk-preview-container');
  const addBtn = document.getElementById('add-bulk-btn');
  
  if (!input) {
    previewContainer.innerHTML = '<p class="info-text">Enter match data above to see preview</p>';
    addBtn.disabled = true;
    return;
  }
  
  try {
    const matches = parseMatchData(input, activeFormat);
    
    if (matches.length === 0) {
      previewContainer.innerHTML = '<p class="error">No valid matches found</p>';
      addBtn.disabled = true;
      return;
    }
    
    let previewHTML = `<p class="success">Found ${matches.length} matches:</p>`;
    previewHTML += '<div class="matches-preview">';
    
    matches.forEach((match, index) => {
      previewHTML += `
        <div class="preview-match">
          <strong>Match ${index + 1}:</strong>
          <span class="red-teams">Red: ${match.red_teams.join(', ')}</span>
          <span class="vs">vs</span>
          <span class="blue-teams">Blue: ${match.blue_teams.join(', ')}</span>
        </div>
      `;
    });
    
    previewHTML += '</div>';
    previewContainer.innerHTML = previewHTML;
    addBtn.disabled = false;
    
  } catch (error) {
    previewContainer.innerHTML = `<p class="error">${error.message}</p>`;
    addBtn.disabled = true;
  }
}

function addBulkMatches() {
  const activeFormat = document.querySelector('.format-tab-btn.active').getAttribute('data-format');
  const inputId = `bulk-${activeFormat}-input`;
  const input = document.getElementById(inputId).value.trim();
  
  try {
    const matches = parseMatchData(input, activeFormat);
    
    // Add matches to the manual matches container
    const container = document.getElementById('manual-matches-container');
    const currentMatches = container.querySelectorAll('.match-builder').length;
    
    matches.forEach((matchData, index) => {
      manualMatchCount++;
      const matchNumber = manualMatchCount;
      
      const matchHTML = `
        <div class="match-builder" id="match-${matchNumber}">
          <div class="match-header">
            <span class="match-title">Match ${matchNumber}</span>
            <button type="button" onclick="removeManualMatch(${matchNumber})" class="remove-match-btn">Remove</button>
          </div>
          <div class="alliance-inputs">
            <div class="alliance-section red">
              <h5>Red Alliance</h5>
              <div class="team-inputs">
                <input type="text" placeholder="Team 1" data-match="${matchNumber}" data-alliance="red" data-position="1" value="${matchData.red_teams[0] || ''}">
                <input type="text" placeholder="Team 2" data-match="${matchNumber}" data-alliance="red" data-position="2" value="${matchData.red_teams[1] || ''}">
                <input type="text" placeholder="Team 3" data-match="${matchNumber}" data-alliance="red" data-position="3" value="${matchData.red_teams[2] || ''}">
              </div>
            </div>
            <div class="alliance-section blue">
              <h5>Blue Alliance</h5>
              <div class="team-inputs">
                <input type="text" placeholder="Team 1" data-match="${matchNumber}" data-alliance="blue" data-position="1" value="${matchData.blue_teams[0] || ''}">
                <input type="text" placeholder="Team 2" data-match="${matchNumber}" data-alliance="blue" data-position="2" value="${matchData.blue_teams[1] || ''}">
                <input type="text" placeholder="Team 3" data-match="${matchNumber}" data-alliance="blue" data-position="3" value="${matchData.blue_teams[2] || ''}">
              </div>
            </div>
          </div>
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', matchHTML);
    });
    
    closeModal();
    alert(`Successfully added ${matches.length} matches!`);
    
  } catch (error) {
    alert(`Error adding matches: ${error.message}`);
  }
}

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
    
    const remainingMatches = document.querySelectorAll('.match-builder');
    remainingMatches.forEach((match, index) => {
      const newNumber = index + 1;
      match.id = `match-${newNumber}`;
      match.querySelector('.match-title').textContent = `Match ${newNumber}`;
      match.querySelector('.remove-match-btn').setAttribute('onclick', `removeManualMatch(${newNumber})`);
      
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
    addManualMatch(); 
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
      
      currentEvent = result.event_key;
      document.getElementById('current-event-display').textContent = `${eventName} (Manual)`;
      document.getElementById('event-section').style.display = 'block';
      localStorage.setItem('currentEvent', currentEvent);
      
      document.getElementById('manual-event-name').value = '';
      clearManualMatches();
      
      await loadMatches();
      await loadTeamsForEvent(currentEvent);
      
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
    
    const select = document.getElementById('manual-event-select');
    select.innerHTML = '<option value="">Select an event...</option>';
    
    events.forEach(event => {
      const option = document.createElement('option');
      option.value = event.key;
      option.textContent = `${event.name} (${event.match_count} matches)`;
      select.appendChild(option);
    });
    
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
    currentEvent = eventKey;
    
    const select = document.getElementById('manual-event-select');
    const eventName = select.options[select.selectedIndex].textContent;
    
    document.getElementById('current-event-display').textContent = `${eventName} (Manual)`;
    document.getElementById('event-section').style.display = 'block';
    localStorage.setItem('currentEvent', currentEvent);
    
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
      loadManualEventsList(); 
      
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
      loadMatches();
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
      loadMatches();
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
        loadMatches(); 
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
    
    const name = document.getElementById('scouter-name').value.trim();
    const username = document.getElementById('scouter-username').value.trim();
    const password = document.getElementById('scouter-password').value;
    
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
        await loadScouters();
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
      loadMatches(); 
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
      loadMatches();
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
    localStorage.removeItem('currentEvent');
    window.location.href = '/login';
  } catch (error) {
    localStorage.removeItem('currentEvent');
    window.location.href = '/login';
  }
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeModal();
  }
});

