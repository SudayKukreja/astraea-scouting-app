// ===== REAL-TIME UPDATES SYSTEM =====
class RealtimeUpdates {
  constructor() {
    this.updateInterval = null;
    this.isVisible = true;
    this.lastUpdateTime = 0;
    this.setupVisibilityHandling();
    this.setupConnectionStatus();
  }

  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) {
        console.log('Page became visible, refreshing data...');
        this.triggerUpdate();
      }
    });

    window.addEventListener('focus', () => {
      if (!this.isVisible) {
        this.isVisible = true;
        this.triggerUpdate();
      }
    });

    window.addEventListener('blur', () => {
      this.isVisible = false;
    });
  }

  setupConnectionStatus() {
    window.addEventListener('online', () => {
      this.showNotification('Connection restored! Refreshing data...', 'success');
      this.triggerUpdate();
    });

    window.addEventListener('offline', () => {
      this.showNotification('You are offline. Data may not be current.', 'warning');
    });
  }

  start(callback, interval = 10000) {
    this.callback = callback;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      if (this.isVisible && navigator.onLine) {
        this.triggerUpdate();
      }
    }, interval);

    console.log(`Auto-refresh started with ${interval/1000}s interval`);
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Auto-refresh stopped');
    }
  }

  async triggerUpdate() {
    if (!this.callback) return;

    const now = Date.now();
    if (now - this.lastUpdateTime < 2000) {
      return;
    }

    try {
      this.lastUpdateTime = now;
      await this.callback();
    } catch (error) {
      console.error('Auto-refresh failed:', error);
      this.showNotification('Failed to refresh data', 'error');
    }
  }

  showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.realtime-notification');
    existing.forEach(el => el.remove());

    const notification = document.createElement('div');
    notification.className = `realtime-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.getColor(type)};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      max-width: 350px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
      font-size: 0.9rem;
    `;

    notification.querySelector('.notification-content').style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    notification.querySelector('.notification-close').style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0;
      margin-left: auto;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, type === 'error' ? 8000 : 4000);
  }

  getIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  getColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || colors.info;
  }
}

// ===== GLOBAL VARIABLES =====
let currentEvent = '';
let scouters = {};
let matches = [];
let teams = [];
let lastMatchesHash = '';
let lastScoutersHash = '';

// Global realtime instance
let realtimeUpdates = new RealtimeUpdates();

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupEventTabs();
  setupConnectionIndicator();
  
  const savedEvent = localStorage.getItem('currentEvent');
  if (savedEvent) {
    currentEvent = savedEvent;
    document.getElementById('event-key-input').value = savedEvent;
    document.getElementById('current-event-display').textContent = savedEvent;
    document.getElementById('event-section').style.display = 'block';
    loadMatchesWithUpdates();
  }

  loadScoutersWithUpdates();
  loadManualEventsList();
  addManualMatch();

  // Start auto-refresh
  realtimeUpdates.start(async () => {
    await loadMatchesWithUpdates();
    await loadScoutersWithUpdates();
  }, 15000); // 15 seconds

  // Setup form handlers
  setupFormHandlers();
});

function setupConnectionIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'connection-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #10b981;
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
    z-index: 999;
    transition: all 0.3s ease;
    opacity: 0;
  `;
  indicator.innerHTML = '🟢 Live Updates Active';
  document.body.appendChild(indicator);
  
  setTimeout(() => indicator.style.opacity = '1', 1000);
  setTimeout(() => indicator.style.opacity = '0', 4000);
  
  window.addEventListener('offline', () => {
    indicator.innerHTML = '🔴 Offline Mode';
    indicator.style.background = '#ef4444';
    indicator.style.opacity = '1';
  });
  
  window.addEventListener('online', () => {
    indicator.innerHTML = '🟢 Live Updates Active';
    indicator.style.background = '#10b981';
    setTimeout(() => indicator.style.opacity = '0', 3000);
  });
}

// ===== TAB SYSTEM =====
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      
      if (tabId === 'scouters') loadScoutersWithUpdates();
    });
  });
}

function setupEventTabs() {
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
}

// ===== ENHANCED MATCHES SYSTEM =====
async function loadEventData() {
  const eventKey = document.getElementById('event-key-input').value.trim();
  if (!eventKey) {
    realtimeUpdates.showNotification('Please enter an event key', 'error');
    return;
  }

  currentEvent = eventKey;
  document.getElementById('current-event-display').textContent = `${eventKey} (TBA)`;
  document.getElementById('event-section').style.display = 'block';
  
  localStorage.setItem('currentEvent', eventKey);

  await loadMatchesWithUpdates();
  await loadTeamsForEvent(eventKey);
  
  realtimeUpdates.showNotification('Event data loaded successfully!', 'success');
}

async function loadMatchesWithUpdates() {
  if (!currentEvent) return;
  
  try {
    const response = await fetch(`/api/admin/matches?event=${currentEvent}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const newMatches = await response.json();
    const newHash = JSON.stringify(newMatches);
    
    // Check if data actually changed
    if (newHash !== lastMatchesHash) {
      const hadMatches = matches.length > 0;
      lastMatchesHash = newHash;
      matches = newMatches;
      await renderMatches();
      
      // Show update notification (only if not first load)
      if (hadMatches && document.querySelector('.match-card')) {
        realtimeUpdates.showNotification('Match assignments updated!', 'success');
      }
    }
  } catch (error) {
    console.error('Error updating matches:', error);
    const container = document.getElementById('matches-container');
    container.innerHTML = '<p class="error">Error loading matches. Please check the event key and try again.</p>';
  }
}

async function renderMatches() {
  const container = document.getElementById('matches-container');
  
  if (matches.length === 0) {
    container.innerHTML = '<p class="info-text">No matches found for this event. Make sure the event key is correct.</p>';
    return;
  }
  
  if (teams.length === 0) {
    await loadTeamsForEvent(currentEvent);
  }
  
  try {
    const [assignmentsResponse, summaryResponse] = await Promise.all([
      fetch(`/api/admin/assignments?event=${currentEvent}`),
      fetch(`/api/admin/match-summary?event=${currentEvent}`)
    ]);
    
    const assignments = await assignmentsResponse.json();
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
    
    const matchesHTML = matches.map(match => {
      const matchAssignments = assignments.filter(a => a.match_number === match.match_number);
      const isHomeMatch = match.all_teams.includes('6897'); 
      
      return `
        <div class="match-card ${isHomeMatch ? 'home-match' : ''}" data-match="${match.match_number}">
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
                  <div class="team-assignment ${isHomeTeam ? 'home-team' : ''}" data-team="${team}">
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
                  <div class="team-assignment ${isHomeTeam ? 'home-team' : ''}" data-team="${team}">
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
    
    container.innerHTML = summaryHTML + matchesHTML;
  } catch (error) {
    console.error('Error rendering matches:', error);
    container.innerHTML = '<p class="error">Error loading match assignments.</p>';
  }
}

// Legacy function for compatibility
async function loadMatches() {
  await loadMatchesWithUpdates();
}

function refreshMatches() {
  if (currentEvent) {
    loadMatchesWithUpdates();
    realtimeUpdates.showNotification('Refreshing matches...', 'info');
  } else {
    realtimeUpdates.showNotification('Please enter an event key first', 'error');
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

// ===== HOME GAME FUNCTIONS =====
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
      await loadMatchesWithUpdates();
      realtimeUpdates.showNotification('Assignment marked as home game!', 'success');
    } else {
      realtimeUpdates.showNotification('Error marking as home game', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error marking as home game', 'error');
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
      await loadMatchesWithUpdates();
      realtimeUpdates.showNotification('Home game status removed!', 'success');
    } else {
      realtimeUpdates.showNotification('Error removing home game status', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error removing home game status', 'error');
    console.error(error);
  }
}

// ===== TEAMS LOADING =====
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

// ===== ENHANCED SCOUTERS SYSTEM =====
async function loadScoutersWithUpdates() {
  try {
    const response = await fetch('/api/admin/scouters');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const newScouters = await response.json();
    const newHash = JSON.stringify(newScouters);
    
    // Check if data actually changed
    if (newHash !== lastScoutersHash) {
      lastScoutersHash = newHash;
      scouters = newScouters;
      await renderScouters();
      
      // Update bulk scouter select
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
    }
  } catch (error) {
    console.error('Error loading scouters:', error);
    const scoutersList = document.getElementById('scouters-list');
    scoutersList.innerHTML = '<p class="error">Error loading scouters. Please refresh the page.</p>';
  }
}

async function renderScouters() {
  try {
    const statsResponse = await fetch('/api/admin/scouter-stats');
    const stats = await statsResponse.json();
    
    const scoutersList = document.getElementById('scouters-list');
    scoutersList.innerHTML = Object.keys(scouters).map(username => {
      const scouter = scouters[username];
      const scouterStats = stats[username] || { completed: 0, assigned: 0 };
      return `
        <div class="scouter-card" data-scouter="${username}">
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
        <div class="scouter-card" data-scouter="${username}">
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
}

// Legacy function for compatibility
async function loadScouters() {
  await loadScoutersWithUpdates();
}

// ===== ASSIGNMENT FUNCTIONS =====
async function assignMatch(matchNumber) {
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
            <button type="submit" id="save-assignments-btn">Save Assignments</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  document.getElementById('assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveBtn = document.getElementById('save-assignments-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
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
        await loadMatchesWithUpdates();
        realtimeUpdates.showNotification('Assignments saved successfully!', 'success');
      } else {
        throw new Error('Failed to save assignments');
      }
    } catch (error) {
      realtimeUpdates.showNotification('Error saving assignments', 'error');
      console.error(error);
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  });
}

async function bulkAssignTeam() {
  const teamNumber = document.getElementById('bulk-team').value;
  const scouterUsername = document.getElementById('bulk-scouter').value;
  
  if (!teamNumber || !scouterUsername || !currentEvent) {
    realtimeUpdates.showNotification('Please select an event, team, and scouter', 'error');
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
      realtimeUpdates.showNotification(result.message, 'success');
      await loadMatchesWithUpdates();
      document.getElementById('bulk-team').value = '';
      document.getElementById('bulk-scouter').value = '';
    } else {
      realtimeUpdates.showNotification(result.error || 'Error making bulk assignment', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error making bulk assignment', 'error');
    console.error(error);
  }
}

async function removeTeamAssignments() {
  const teamNumber = document.getElementById('bulk-team').value;
  
  if (!teamNumber || !currentEvent) {
    realtimeUpdates.showNotification('Please select an event and team', 'error');
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
      realtimeUpdates.showNotification(`Removed ${result.removed_count} assignments for team ${teamNumber}`, 'success');
      await loadMatchesWithUpdates();
      document.getElementById('bulk-team').value = '';
    } else {
      realtimeUpdates.showNotification('Error removing assignments', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error removing assignments', 'error');
    console.error(error);
  }
}

// ===== MANUAL MATCHES SYSTEM =====
let manualMatchCount = 0;

function showBulkMatchModal() {
  const modalHTML = `
    <div class="modal">
      <div class="modal-content large">
        <h3>Bulk Add Matches</h3>
        <p>Enter match data in one of the formats below:</p>
        
        <div class="bulk-format-tabs">
          <button class="format-tab-btn active" data-format="csv">CSV Format</button>
          <button class="format-tab-btn" data-format="text">Text Format</button>
          <button class="format-tab-btn" data-format="json">JSON Format</button>
        </div>
        
        <div id="csv-format" class="format-content active">
          <p><strong>CSV Format:</strong> Each line is a match with red teams, then blue teams</p>
          <code>254,148,1323,2468,2471,5940</code>
          <textarea id="bulk-csv-input" placeholder="Enter CSV format matches (one per line):
254,148,1323,2468,2471,5940
1678,5190,6834,973,1114,2056
..." rows="10" style="width: 100%; font-family: monospace;"></textarea>
        </div>
        
        <div id="text-format" class="format-content">
          <p><strong>Text Format:</strong> Natural language format</p>
          <code>Red: 254, 148, 1323 vs Blue: 2468, 2471, 5940</code>
          <textarea id="bulk-text-input" placeholder="Enter text format matches (one per line):
Red: 254, 148, 1323 vs Blue: 2468, 2471, 5940
Red: 1678, 5190, 6834 vs Blue: 973, 1114, 2056
..." rows="10" style="width: 100%; font-family: monospace;"></textarea>
        </div>
        
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
    previewContainer.innerHTML = `<p class="error">${error.message}</p>`
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
    realtimeUpdates.showNotification(`Successfully added ${matches.length} matches!`, 'success');
    
  } catch (error) {
    realtimeUpdates.showNotification(`Error adding matches: ${error.message}`, 'error');
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
    realtimeUpdates.showNotification('Please enter an event name', 'error');
    return;
  }
  
  const matchesData = getManualMatchesData();
  
  if (matchesData.length === 0) {
    realtimeUpdates.showNotification('Please add at least one match with teams on both red and blue alliances', 'error');
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
      realtimeUpdates.showNotification(result.message, 'success');
      
      currentEvent = result.event_key;
      document.getElementById('current-event-display').textContent = `${eventName} (Manual)`;
      document.getElementById('event-section').style.display = 'block';
      localStorage.setItem('currentEvent', currentEvent);
      
      document.getElementById('manual-event-name').value = '';
      clearManualMatches();
      
      await loadMatchesWithUpdates();
      await loadTeamsForEvent(currentEvent);
      
      document.querySelector('.event-tab-btn[data-event-tab="tba"]').click();
    } else {
      realtimeUpdates.showNotification(result.error || 'Error creating manual event', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error creating manual event', 'error');
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
    realtimeUpdates.showNotification('Please select a manual event', 'error');
    return;
  }
  
  try {
    currentEvent = eventKey;
    
    const select = document.getElementById('manual-event-select');
    const eventName = select.options[select.selectedIndex].textContent;
    
    document.getElementById('current-event-display').textContent = `${eventName} (Manual)`;
    document.getElementById('event-section').style.display = 'block';
    localStorage.setItem('currentEvent', currentEvent);
    
    await loadMatchesWithUpdates();
    await loadTeamsForEvent(currentEvent);
    
    realtimeUpdates.showNotification('Manual event loaded successfully!', 'success');
  } catch (error) {
    realtimeUpdates.showNotification('Error loading manual event', 'error');
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
      realtimeUpdates.showNotification('Manual event deleted successfully', 'success');
      loadManualEventsList(); 
      
      if (currentEvent === eventKey) {
        currentEvent = '';
        document.getElementById('current-event-display').textContent = '';
        document.getElementById('event-section').style.display = 'none';
        localStorage.removeItem('currentEvent');
        document.getElementById('matches-container').innerHTML = '<p class="info-text">Select an event to load matches</p>';
      }
    } else {
      realtimeUpdates.showNotification('Error deleting manual event', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error deleting manual event', 'error');
    console.error(error);
  }
}

// ===== SCOUTER MANAGEMENT =====
function showCreateScouterModal() {
  document.getElementById('create-scouter-modal').style.display = 'flex';
}

function hideCreateScouterModal() {
  document.getElementById('create-scouter-modal').style.display = 'none';
  document.getElementById('create-scouter-form').reset();
}

async function deleteScouter(username) {
  if (!confirm(`Are you sure you want to delete scouter "${username}"?`)) return;
  
  try {
    const response = await fetch(`/api/admin/scouters/${username}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadScoutersWithUpdates();
      realtimeUpdates.showNotification('Scouter deleted successfully!', 'success');
    } else {
      realtimeUpdates.showNotification('Error deleting scouter', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error deleting scouter', 'error');
    console.error(error);
  }
}

// ===== FORM HANDLERS =====
function setupFormHandlers() {
  const createScouterForm = document.getElementById('create-scouter-form');
  if (createScouterForm) {
    createScouterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('scouter-name').value.trim();
      const username = document.getElementById('scouter-username').value.trim();
      const password = document.getElementById('scouter-password').value;
      
      if (!name || !username || !password) {
        realtimeUpdates.showNotification('All fields are required', 'error');
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
          await loadScoutersWithUpdates();
          realtimeUpdates.showNotification('Scouter created successfully!', 'success');
        } else {
          realtimeUpdates.showNotification(result.error || 'Error creating scouter', 'error');
        }
      } catch (error) {
        realtimeUpdates.showNotification('Error creating scouter', 'error');
        console.error(error);
      }
    });
  }
}

// ===== MODAL MANAGEMENT =====
function closeModal() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => modal.remove());
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeModal();
  }
});

// ===== LOGOUT =====
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

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
  realtimeUpdates.stop();
});