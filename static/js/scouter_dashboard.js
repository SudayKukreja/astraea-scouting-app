let assignments = [];
let lastAssignmentsHash = ''; // Add hash tracking like admin dashboard

// Global realtime instance
let realtimeUpdates = new RealtimeUpdates();

async function loadAssignments() {
  try {
    const response = await fetch('/api/scouter/assignments');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const newAssignments = await response.json();
    
    // Use hash comparison like admin dashboard
    const newHash = realtimeUpdates.generateDataHash(newAssignments);
    
    if (newHash !== lastAssignmentsHash) {
      const hadAssignments = assignments.length > 0;
      lastAssignmentsHash = newHash;
      assignments = newAssignments;
      
      await renderAssignments();
      
      // Show update notification (only if not first load)
      if (hadAssignments) {
        realtimeUpdates.showNotification('Assignments updated!', 'info');
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
                    <div class="team-item home-game">
                      <span class="team-number">Team ${assignment.team_number}</span>
                      <span class="status home-game-status">🏠 Home Game</span>
                      <button onclick="unmarkHomeGame('${assignment.assignment_key}')" class="unmark-home-btn">Remove Home Status</button>
                    </div>
                  `;
                }
                
                const statusClass = assignment.completed ? 'completed' : 'pending';
                const statusText = assignment.completed ? 'Completed' : 'Pending';
                
                return `
                  <div class="team-item ${statusClass}">
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
  
  try {
    const response = await fetch('/api/scouter/mark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      await loadAssignments(); // Use async version
      realtimeUpdates.showNotification('Assignment marked as home game!', 'success');
    } else {
      const result = await response.json();
      realtimeUpdates.showNotification(result.error || 'Error marking as home game', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error marking as home game', 'error');
    console.error(error);
  }
}

async function unmarkHomeGame(assignmentKey) {
  if (!confirm('Remove home game status? You will need to complete this assignment.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/unmark-home-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_key: assignmentKey })
    });
    
    if (response.ok) {
      await loadAssignments();
      realtimeUpdates.showNotification('Home game status removed!', 'success');
    } else {
      realtimeUpdates.showNotification('Error removing home game status', 'error');
    }
  } catch (error) {
    realtimeUpdates.showNotification('Error removing home game status', 'error');
    console.error(error);
  }
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

// Setup connection indicator like admin dashboard
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

document.addEventListener('DOMContentLoaded', () => {
  // Setup connection indicator
  setupConnectionIndicator();
  
  // Initial load
  loadAssignments();

  // Start auto-refresh with RealtimeUpdates system
  realtimeUpdates.start(async () => {
    await loadAssignments();
  }, 15000); // 15 seconds like admin dashboard

  // Handle completion message from URL params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('completed') === 'true') {
    realtimeUpdates.showNotification('Scout report submitted successfully!', 'success');
    
    // Clean up URL
    setTimeout(() => {
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 3000);
    
    // Refresh assignments after a short delay
    setTimeout(loadAssignments, 500);
  }
});

// ===== REALTIME UPDATES CLASS (same as admin dashboard) =====
class RealtimeUpdates {
  constructor() {
    this.updateInterval = null;
    this.isVisible = true;
    this.lastUpdateTime = 0;
    this.eventListeners = [];
    this.setupVisibilityHandling();
    this.setupConnectionStatus();
  }

  setupVisibilityHandling() {
    const visibilityHandler = () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) {
        console.log('Page became visible, refreshing data...');
        this.triggerUpdate();
      }
    };

    const focusHandler = () => {
      if (!this.isVisible) {
        this.isVisible = true;
        this.triggerUpdate();
      }
    };

    const blurHandler = () => {
      this.isVisible = false;
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('focus', focusHandler);
    window.addEventListener('blur', blurHandler);

    this.eventListeners.push(
      { element: document, event: 'visibilitychange', handler: visibilityHandler },
      { element: window, event: 'focus', handler: focusHandler },
      { element: window, event: 'blur', handler: blurHandler }
    );
  }

  setupConnectionStatus() {
    const onlineHandler = () => {
      this.showNotification('Connection restored! Refreshing data...', 'success');
      this.triggerUpdate();
    };

    const offlineHandler = () => {
      this.showNotification('You are offline. Data may not be current.', 'warning');
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    this.eventListeners.push(
      { element: window, event: 'online', handler: onlineHandler },
      { element: window, event: 'offline', handler: offlineHandler }
    );
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

  destroy() {
    this.stop();
    
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
    
    console.log('RealtimeUpdates destroyed');
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

  generateDataHash(data) {
    if (typeof data !== 'object' || data === null) {
      return String(data);
    }
    
    const sortedData = this.sortObjectKeys(data);
    return JSON.stringify(sortedData);
  }

  sortObjectKeys(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = this.sortObjectKeys(obj[key]);
      });
      return sorted;
    }
    return obj;
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (realtimeUpdates) {
    realtimeUpdates.destroy();
  }
});