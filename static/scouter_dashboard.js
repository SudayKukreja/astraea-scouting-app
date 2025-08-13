let assignments = [];

class OfflineStatusManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingSubmissions = 0;
    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showStatus('🟢 Back online! Syncing data...', 'success');
      this.triggerSync();
      this.updateIndicator();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showStatus('🔴 You are offline. Data will be saved locally.', 'warning');
      this.updateIndicator();
    });

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, count, timestamp } = event.data || {};
        
        switch (type) {
          case 'OFFLINE_SUBMISSION_STORED':
            this.showStatus('💾 Scout report saved offline', 'info');
            this.getOfflineStatus(); // Update counter
            break;
            
          case 'SUBMISSIONS_SYNCED':
            this.showStatus(`✅ ${count} reports synced successfully!`, 'success');
            this.getOfflineStatus(); // Update counter
            break;
        }
      });
    }

    // Initial status check
    this.updateIndicator();
    this.getOfflineStatus();
  }

  async triggerSync() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await registration.sync.register('scout-submissions-sync');
        }
      } catch (error) {
        console.log('Sync registration failed:', error);
      }
    }
  }

  async getOfflineStatus() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        const status = event.data;
        if (status && typeof status.pendingSync === 'number') {
          this.pendingSubmissions = status.pendingSync;
          this.updateIndicator();
        }
      };

      registration.active?.postMessage(
        { type: 'GET_OFFLINE_STATUS' },
        [channel.port2]
      );
    } catch (error) {
      console.log('Could not get offline status:', error);
    }
  }

  updateIndicator() {
    let indicator = document.getElementById('offline-indicator');
    
    // Remove indicator if online and no pending submissions
    if (this.isOnline && this.pendingSubmissions === 0) {
      if (indicator) {
        indicator.remove();
      }
      return;
    }

    // Create indicator if it doesn't exist
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'offline-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #f59e0b;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: pointer;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(indicator);
      
      // Click to force sync
      indicator.addEventListener('click', () => {
        this.triggerSync();
        this.showStatus('🔄 Forcing sync...', 'info');
      });
    }

    // Update indicator content and color
    if (!this.isOnline) {
      indicator.textContent = '📴 Offline Mode';
      indicator.style.background = '#ef4444';
    } else if (this.pendingSubmissions > 0) {
      indicator.textContent = `🔄 ${this.pendingSubmissions} pending sync`;
      indicator.style.background = '#f59e0b';
    }
  }

  showStatus(message, type = 'info', duration = 4000) {
    // Remove existing notifications
    document.querySelectorAll('.offline-notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.textContent = message;
    
    const colors = {
      success: '#10b981',
      warning: '#f59e0b', 
      info: '#3b82f6',
      error: '#ef4444'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1002;
      font-size: 0.9rem;
      font-weight: 500;
      max-width: 350px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Slide in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
}

// Initialize offline manager
const offlineManager = new OfflineStatusManager();

async function loadAssignmentsEnhanced() {
  try {
    const { response, data: assignmentsData } = await fetchWithRetry('/api/scouter/assignments');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    assignments = assignmentsData;
    
    const container = document.getElementById('assignments-container');
    const noAssignments = document.getElementById('no-assignments');
    
    if (assignments.length === 0) {
      container.style.display = 'none';
      noAssignments.style.display = 'block';
      return;
    }
    
    container.style.display = 'block';
    noAssignments.style.display = 'none';
    
    // Keep all your existing assignment rendering code here - don't change it
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
      
  } catch (error) {
    console.error('Error loading assignments:', error);
    document.getElementById('assignments-container').innerHTML = 
      '<div class="info">Connection issue - showing cached assignments if available.</div>';
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(8000)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data._offline) {
          offlineManager.showStatus('📋 Showing cached data', 'info', 3000);
        }
        
        return { response, data };
      }
      
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return { response, data: await response.json() };
      
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
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
      loadAssignmentsEnhanced(); 
      showSuccessMessage('Assignment marked as home game!');
    } else {
      const result = await response.json();
      alert(result.error || 'Error marking as home game');
    }
  } catch (error) {
    alert('Error marking as home game');
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
      loadAssignmentsEnhanced();
      showSuccessMessage('Home game status removed!');
    } else {
      alert('Error removing home game status');
    }
  } catch (error) {
    alert('Error removing home game status');
    console.error(error);
  }
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
  loadAssignmentsEnhanced();

  setInterval(loadAssignmentsEnhanced, 30000);

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
    
    setTimeout(loadAssignmentsEnhanced, 500);
  }
});