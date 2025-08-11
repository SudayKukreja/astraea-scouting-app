let assignments = [];

async function loadAssignments() {
  try {
    const response = await fetch('/api/scouter/assignments');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const newAssignments = await response.json();
    
    // Only update if there are actual changes
    const newAssignmentsStr = JSON.stringify(newAssignments);
    const currentAssignmentsStr = JSON.stringify(assignments);
    
    if (newAssignmentsStr !== currentAssignmentsStr) {
      assignments = newAssignments;
      await renderAssignments();
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
  
  // Add loading state
  const assignmentElement = document.querySelector(`[data-assignment="${assignmentKey}"]`);
  if (assignmentElement) {
    assignmentElement.classList.add('loading');
  }
  
  try {
    const response = await fetch('/api/scouter/mark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      // IMMEDIATE UPDATE - this was missing!
      await loadAssignments();
      showSuccessMessage('Assignment marked as home game!');
    } else {
      const result = await response.json();
      showErrorMessage(result.error || 'Error marking as home game');
    }
  } catch (error) {
    showErrorMessage('Error marking as home game');
    console.error(error);
  } finally {
    // Remove loading state
    if (assignmentElement) {
      assignmentElement.classList.remove('loading');
    }
  }
}


async function unmarkHomeGame(assignmentKey) {
  if (!confirm('Remove home game status? You will need to complete this assignment.')) {
    return;
  }
  
  // Add loading state
  const assignmentElement = document.querySelector(`[data-assignment="${assignmentKey}"]`);
  if (assignmentElement) {
    assignmentElement.classList.add('loading');
  }
  
  try {
    const response = await fetch('/api/admin/unmark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      // IMMEDIATE UPDATE - this was missing!
      await loadAssignments();
      showSuccessMessage('Home game status removed!');
    } else {
      showErrorMessage('Error removing home game status');
    }
  } catch (error) {
    showErrorMessage('Error removing home game status');
    console.error(error);
  } finally {
    // Remove loading state
    if (assignmentElement) {
      assignmentElement.classList.remove('loading');
    }
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
      
      return `
        <div class="match-assignment-card">
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
                const statusText = assignment.completed ? 'Completed' : 'Pending';
                
                return `
                  <div class="team-item ${statusClass}" data-assignment="${assignment.assignment_key}">
                    <span class="team-number">Team ${assignment.team_number}</span>
                    <span class="status">${statusText}</span>
                    <div class="team-actions">
                      ${!assignment.completed ? 
                        `<button onclick="startScouting('${assignment.assignment_key}', ${assignment.team_number}, ${matchNumber})" class="scout-btn">Scout Team</button>
                         <button onclick="markHomeGame('${assignment.assignment_key}')" class="home-game-btn">Mark Home Game</button>` :
                        '<span class="completed-check">✓</span>'
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

function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  successDiv.style.cssText = `
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
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
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

document.addEventListener('DOMContentLoaded', () => {
  loadAssignments();

  setInterval(loadAssignments, 30000);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('completed') === 'true') {
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
    
    setTimeout(() => {
      successMessage.remove();
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 3000);
    
    setTimeout(loadAssignments, 500);
  }
});

function showSuccessMessage(message) {
  showNotification(message, 'success');
}

function showErrorMessage(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
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
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Slide in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }
  }, 4000);
}
