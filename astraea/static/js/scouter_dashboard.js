function renderTeam(a) {
  if (a.is_home_game) {
    return `
      <div class="team-item home-game">
        <span class="team-number">Team ${esc(a.team_number)}</span>
        <span class="status-badge home-game">Home Game</span>
        <button onclick="setHomeGame('${a.assignment_key}', false)" class="btn btn-ghost btn-sm">Remove Home Status</button>
      </div>`;
  }
  if (a.completed) {
    return `
      <div class="team-item completed">
        <span class="team-number">Team ${esc(a.team_number)}</span>
        <span class="status-badge completed">Completed &check;</span>
      </div>`;
  }
  return `
    <div class="team-item pending">
      <span class="team-number">Team ${esc(a.team_number)}</span>
      <span class="status-badge pending">Pending</span>
      <div class="button-row">
        <button onclick="startScouting('${a.assignment_key}', '${esc(a.team_number)}', ${a.match_number})" class="btn btn-primary btn-sm">Scout Team</button>
        <button onclick="setHomeGame('${a.assignment_key}', true)" class="btn btn-ghost btn-sm">Mark Home Game</button>
      </div>
    </div>`;
}

async function loadAssignments() {
  const container = document.getElementById('assignments-container');
  const empty = document.getElementById('no-assignments');

  let assignments;
  try {
    assignments = await getJSON('/api/scouter/assignments');
  } catch {
    container.innerHTML = '<div class="error">Error loading assignments. Please refresh the page.</div>';
    return;
  }

  container.hidden = assignments.length === 0;
  empty.hidden = assignments.length > 0;

  const groups = new Map();
  assignments.forEach(a => {
    const key = `${a.event_key}|${a.match_number}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  });

  container.innerHTML = [...groups.values()].map(group => `
    <div class="panel match-assignment-card">
      <div class="row-between">
        <h3>Match ${group[0].match_number}</h3>
        <span class="event-key">${esc(group[0].event_key)}</span>
      </div>
      <div class="team-list">${group.map(renderTeam).join('')}</div>
    </div>
  `).join('');
}

async function setHomeGame(assignmentKey, isHome) {
  const message = isHome
    ? 'Mark this assignment as a home game? You will not need to scout this match.'
    : 'Remove home game status? You will need to complete this assignment.';
  if (!confirm(message)) return;

  try {
    await postJSON(`/api/scouter/${isHome ? 'mark' : 'unmark'}-home-game`, { assignment_key: assignmentKey });
    toast(isHome ? 'Assignment marked as home game!' : 'Home game status removed!');
    loadAssignments();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function startScouting(assignmentKey, teamNumber, matchNumber) {
  window.location.href = `/scout?team=${teamNumber}&match=${matchNumber}&assignment=${encodeURIComponent(assignmentKey)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadAssignments();
  setInterval(loadAssignments, 30000);

  if (new URLSearchParams(window.location.search).get('completed') === 'true') {
    toast('Scout report submitted successfully!');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
