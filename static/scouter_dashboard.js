let assignments = [];

async function loadAssignments() {
  try {
    const response = await fetch('/api/scouter/assignments');
    assignments = await response.json();
    
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
          </div>
        `;
      }).join('');
  } catch (error) {
    console.error('Error loading assignments:', error);
    document.getElementById('assignments-container').innerHTML = 
      '<div class="error">Error loading assignments. Please refresh the page.</div>';
  }
}

// function getMatchProgressText(assignments) {
//   const completed = assignments.filter(a => a.completed).length;
//   const homeGames = assignments.filter(a => a.is_home_game).length;
//   const total = assignments.length;
//   const remaining = total - completed - homeGames;
  
//   if (homeGames > 0) {
//     return `${completed}/${total} completed, ${homeGames} home games, ${remaining} remaining`;
//   } else {
//     return `${completed}/${total} teams completed`;
//   }
// }

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
      loadAssignments(); 
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
      loadAssignments();
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