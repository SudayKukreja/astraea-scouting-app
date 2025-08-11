// Fixed scouter_dashboard.js with better update detection
let assignments = [];
let lastUpdateHash = '';

// Create a hash of assignments to detect changes
function createAssignmentsHash(assignmentsList) {
  const relevant = assignmentsList.map(a => ({
    key: a.assignment_key,
    completed: a.completed,
    home: a.is_home_game
  }));
  return JSON.stringify(relevant);
}

async function loadAssignments() {
  try {
    const response = await fetch('/api/scouter/assignments');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const newAssignments = await response.json();
    
    // Create hash of relevant data for comparison
    const newHash = createAssignmentsHash(newAssignments);
    
    // Only update if there are actual meaningful changes
    if (newHash !== lastUpdateHash) {
      assignments = newAssignments;
      lastUpdateHash = newHash;
      await renderAssignments();
      
      // Show update notification if not the first load
      if (lastUpdateHash !== '') {
        showInfoMessage('Assignments updated');
      }
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
    const container = document.getElementById('assignments-container');
    if (container) {
      container.innerHTML = '<div class="error">Error loading assignments. Please refresh the page.</div>';
    }
  }
}

function getMatchProgressText(assignments) {
  const completed = assignments.filter(a => a.completed).length;
  const homeGames = assignments.filter(a => a.is_home_game).length;
  const total = assignments.length;
  const remaining = total - completed - homeGames;
  
  if (homeGames > 0) {
    return `${completed}/${total} completed, ${homeGames} home games, ${remaining} remaining`;
  } else {
    return `${completed}/${total} teams completed`;
  }
}

async function markHomeGame(assignmentKey) {
  if (!confirm('Mark this assignment as a home game? You will not need to scout this match.')) {
    return;
  }
  
  // Disable the button to prevent double-clicks
  const button = event.target;
  button.disabled = true;
  button.textContent = 'Updating...';
  
  try {
    const response = await fetch('/api/scouter/mark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      await loadAssignments();
      showSuccessMessage('Assignment marked as home game!');
    } else {
      const result = await response.json();
      showErrorMessage(result.error || 'Error marking as home game');
      // Re-enable button on error
      button.disabled = false;
      button.textContent = 'Mark Home Game';
    }
  } catch (error) {
    showErrorMessage('Error marking as home game');
    console.error(error);
    // Re-enable button on error
    button.disabled = false;
    button.textContent = 'Mark Home Game';
  }
}

async function unmarkHomeGame(assignmentKey) {
  if (!confirm('Remove home game status? You will need to complete this assignment.')) {
    return;
  }
  
  // Disable the button to prevent double-clicks
  const button = event.target;
  button.disabled = true;
  button.textContent = 'Updating...';
  
  try {
    const response = await fetch('/api/admin/unmark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      await loadAssignments();
      showSuccessMessage('Home game status removed!');
    } else {
      showErrorMessage('Error removing home game status');
      // Re-enable button on error
      button.disabled = false;
      button.textContent = 'Remove Home Status';
    }
  } catch (error) {
    showErrorMessage('Error removing home game status');
    console.error(error);
    // Re-enable button on error
    button.disabled = false;
    button.textContent = 'Remove Home Status';
  }
}

async function renderAssignments() {
  const container = document.getElementById('assignments-container');
  const noAssignments = document.getElementById('no-assignments');
  
  if (assignments.length === 0) {
    container.style.display = 'none';
    noAssignments.style.display = 'block';
    return;
  }
  
  container.style.display = 'block';
  noAssignments.style.display = 'none';
  
  const groupedAssignments = assignments.reduce((groups, assignment) => {
    const key = `${assignment.event_key}_${assignment.match_number}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(assignment);
    return groups;
  }, {});
  
  container.innerHTML = Object.keys(groupedAssignments)
    .sort((a, b) => {
      const matchA = parseInt(a.split('_').pop());
      const matchB = parseInt(b.split('_').pop());
      return matchA - matchB;
    })
    .map(key => {
      const matchAssignments = groupedAssignments[key];
      const firstAssignment = matchAssignments[0];
      const matchNumber = firstAssignment.match_number;
      const eventKey = firstAssignment.event_key;
      
      // Check if any assignments are incomplete
      const hasIncomplete = matchAssignments.some(a => !a.completed && !a.is_home_game);
      
      return `
        <div class="match-assignment-card ${hasIncomplete ? 'has-incomplete' : 'all-complete'}">
          <div class="match-header">
            <h3>Match ${matchNumber}</h3>
            <span class="event-key">${eventKey}</span>
          </div>
          <div class="teams-to-scout">
            <h4>Teams to Scout:</h4>
            <div class="team-list">
              ${matchAssignments.map(assignment => {
                if (assignment.is_home_game) {
                  return `
                    <div class="team-item home-game" data-assignment="${assignment.assignment_key}">
                      <span class="team-number">Team ${assignment.team_number}</span>
                      <span class="status home-game-status">🏠 Home Game</span>
                      <button onclick="unmarkHomeGame('${assignment.assignment_key}')" class="unmark-home-btn">Remove Home Status</button>
                    </div>
                  `;
                }
                
                const statusClass = assignment.completed ? 'completed' : 'pending';
                const statusText = assignment.completed ? '✅ Completed' : '⏳ Pending';
                
                return `
                  <div class="team-item ${statusClass}" data-assignment="${assignment.assignment_key}">
                    <span class="team-number">Team ${assignment.team_number}</span>
                    <span class="status">${statusText}</span>
                    <div class="team-actions">
                      ${!assignment.completed ? 
                        `<button onclick="startScouting('${assignment.assignment_key}', ${assignment.team_number}, ${matchNumber})" class="scout-btn">Scout Team</button>
                         <button onclick="markHomeGame('${assignment.assignment_key}')" class="home-game-btn">Mark Home Game</button>` :
                        ''
                      }
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="match-actions">
            <div class="match-progress">
              ${getMatchProgressText(matchAssignments)}
            </div>
          </div>
        </div>
      `;
    }).join('');
}

function startScouting(assignmentKey, teamNumber, matchNumber) {
  sessionStorage.setItem('currentAssignment', assignmentKey);
  
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

// Notification functions
function showSuccessMessage(message) {
  showNotification(message, 'success');
}

function showErrorMessage(message) {
  showNotification(message, 'error');
}

function showInfoMessage(message) {
  showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Choose colors and icons based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    max-width: 350px;
    font-size: 0.9rem;
    font-weight: 500;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  notification.innerHTML = `
    <span style="font-size: 1.2rem;">${icons[type]}</span>
    <span>${message}</span>
  `;
  
  document.body.appendChild(notification);
  
  // Slide in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto remove after 4 seconds (shorter for info messages)
  const duration = type === 'info' ? 2000 : 4000;
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadAssignments();

  // Check for updates every 15 seconds (more frequent than before)
  setInterval(loadAssignments, 15000);

  // Handle completion redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('completed') === 'true') {
    showSuccessMessage('Scout report submitted successfully!');
    
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Reload assignments after a short delay
    setTimeout(loadAssignments, 500);
  }
});