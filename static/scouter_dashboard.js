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
    
    // Group assignments by match
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
                  const statusClass = assignment.completed ? 'completed' : 'pending';
                  const statusText = assignment.completed ? 'Completed' : 'Pending';
                  
                  return `
                    <div class="team-item ${statusClass}">
                      <span class="team-number">Team ${assignment.team_number}</span>
                      <span class="status">${statusText}</span>
                      ${!assignment.completed ? 
                        `<button onclick="startScouting('${assignment.assignment_key}', ${assignment.team_number}, ${matchNumber})" class="scout-btn">Scout Team</button>` :
                        '<span class="completed-check">✓</span>'
                      }
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="match-actions">
              <div class="match-progress">
                ${matchAssignments.filter(a => a.completed).length}/${matchAssignments.length} teams completed
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