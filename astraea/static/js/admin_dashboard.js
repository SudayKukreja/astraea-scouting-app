const HOME_TEAM = '6897';

let currentEvent = '';
let scouters = {};
let matches = [];
let busy = false;

const $ = id => document.getElementById(id);

function setCurrentEvent(key, label) {
  currentEvent = key;
  localStorage.setItem('currentEvent', key);
  $('current-event-display').textContent = label || key;
  $('event-section').hidden = !key;
}

async function loadMatches() {
  if (!currentEvent) {
    toast('Please load an event first', 'error');
    return;
  }
  const container = $('matches-container');
  busy = true;
  container.innerHTML = '<p class="info-text">Loading matches...</p>';
  try {
    const [matchData, teams] = await Promise.all([
      getJSON(`/api/admin/matches?event=${encodeURIComponent(currentEvent)}`),
      getJSON(`/api/admin/teams?event=${encodeURIComponent(currentEvent)}`)
    ]);
    matches = matchData;
    $('bulk-team').innerHTML = '<option value="">Select Team</option>'
      + teams.map(t => `<option value="${esc(t)}">Team ${esc(t)}</option>`).join('');

    if (!matches.length) {
      container.innerHTML = '<p class="info-text">No matches found for this event. Check the event key and try again.</p>';
      return;
    }
    await renderMatches();
  } catch (err) {
    container.innerHTML = `<p class="error">Error loading matches: ${esc(err.message)}</p>`;
  } finally {
    busy = false;
  }
}

function statusBadge(a) {
  if (a.is_home_game) return '<span class="status-badge home-game">Home Game</span>';
  if (a.completed) return `<span class="status-badge completed">&check; ${esc(a.scouter)}</span>`;
  return `<span class="status-badge pending">${esc(a.scouter)}</span>`;
}

function assignmentActions(a) {
  const key = a.assignment_key;
  const actions = [];
  if (a.is_home_game) {
    actions.push(`<button onclick="setHomeGame('${key}', false)" class="btn btn-ghost btn-xs">Remove Home</button>`);
  } else if (!a.completed) {
    actions.push(`<button onclick="setHomeGame('${key}', true)" class="btn btn-ghost btn-xs">Mark Home</button>`);
  }
  if (!a.completed) {
    actions.push(`<button onclick="removeIndividualAssignment('${key}', '${esc(a.team_number)}', '${esc(a.scouter)}')" class="btn btn-danger btn-xs">Remove</button>`);
  }
  return actions.length ? `<div class="button-row">${actions.join('')}</div>` : '';
}

function allianceHTML(color, teamList, matchAssignments) {
  return `
    <div class="alliance ${color}">
      <h5>${color === 'red' ? 'Red' : 'Blue'} Alliance</h5>
      ${teamList.map(team => {
        const a = matchAssignments.find(x => x.team_number === team);
        const isHome = team === HOME_TEAM;
        return `
          <div class="team-assignment ${isHome ? 'home-team' : ''} ${a ? 'assigned' : 'unassigned'}">
            <div class="team-info">
              <span class="team-number">${esc(team)}${isHome ? ' (HOME)' : ''}</span>
              ${a ? statusBadge(a) : '<span class="status-badge unassigned">Unassigned</span>'}
            </div>
            ${a && !isHome ? assignmentActions(a) : ''}
          </div>`;
      }).join('')}
    </div>`;
}

async function renderMatches() {
  const container = $('matches-container');
  if (!currentEvent || !matches.length) return;

  let assignments, summary;
  try {
    [assignments, summary] = await Promise.all([
      getJSON(`/api/admin/assignments?event=${encodeURIComponent(currentEvent)}`),
      getJSON(`/api/admin/match-summary?event=${encodeURIComponent(currentEvent)}`)
    ]);
  } catch {
    container.innerHTML = '<p class="error">Error loading assignment data. Please refresh the page.</p>';
    return;
  }

  const stats = [
    ['Total', summary.total_assignments, ''],
    ['Completed', summary.completed, 'completed'],
    ['Home Games', summary.home_games, 'home-games'],
    ['Pending', summary.pending, 'pending']
  ];

  container.innerHTML = `
    <div class="panel">
      <h3>Assignment Summary</h3>
      <div class="summary-stats">
        ${stats.map(([label, n, cls]) => `
          <div class="stat-item ${cls}">
            <span class="stat-number">${n}</span>
            <span class="stat-label">${label}</span>
          </div>`).join('')}
      </div>
    </div>
  ` + matches.map(match => {
    const matchAssignments = assignments.filter(a => a.match_number === match.match_number);
    const isHomeMatch = match.all_teams.includes(HOME_TEAM);
    return `
      <div class="panel match-card ${isHomeMatch ? 'home-match' : ''}">
        <div class="row-between">
          <h4>Match ${match.match_number} ${isHomeMatch ? '<span class="home-indicator">Home Match</span>' : ''}</h4>
          <div class="button-row">
            <button onclick="assignMatch(${match.match_number})" class="btn btn-primary btn-sm">Assign Scouters</button>
            <button onclick="clearMatchAssignments(${match.match_number})" class="btn btn-danger btn-sm">Clear Match</button>
          </div>
        </div>
        <div class="teams-grid">
          ${allianceHTML('red', match.red_teams, matchAssignments)}
          ${allianceHTML('blue', match.blue_teams, matchAssignments)}
        </div>
      </div>`;
  }).join('');
}

async function runAction(action, successMessage) {
  try {
    const result = await action();
    toast(typeof successMessage === 'function' ? successMessage(result) : successMessage);
    await renderMatches();
    return result;
  } catch (err) {
    toast(err.message, 'error');
  }
}

function setHomeGame(assignmentKey, isHome) {
  const message = isHome
    ? 'Mark this assignment as a home game? The scouter will not need to scout this match.'
    : 'Remove home game status? The scouter will need to complete this assignment.';
  if (!confirm(message)) return;
  runAction(() => postJSON(`/api/admin/${isHome ? 'mark' : 'unmark'}-home-game`, { assignment_key: assignmentKey }),
    isHome ? 'Assignment marked as home game!' : 'Home game status removed!');
}

function removeIndividualAssignment(assignmentKey, team, scouter) {
  if (!confirm(`Remove assignment for Team ${team} from ${scouter}?`)) return;
  runAction(() => postJSON('/api/admin/remove-individual-assignment', { assignment_key: assignmentKey }),
    `Removed assignment for Team ${team}`);
}

function clearMatchAssignments(matchNumber) {
  if (!confirm(`Clear ALL assignments for Match ${matchNumber}?`)) return;
  runAction(() => postJSON('/api/admin/clear-match-assignments', { event_key: currentEvent, match_number: matchNumber }),
    r => r.message);
}

function scouterOptions() {
  return '<option value="">Select Scouter</option>' + Object.entries(scouters)
    .map(([u, s]) => `<option value="${esc(u)}">${esc(s.name)} (${esc(u)})</option>`).join('');
}

function openModal(html) {
  closeModal();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal dynamic"><div class="modal-content large">${html}</div></div>`);
}

function closeModal() {
  document.querySelectorAll('.modal.dynamic').forEach(m => m.remove());
}

function assignMatch(matchNumber) {
  const match = matches.find(m => m.match_number === matchNumber);
  if (!match) return;
  const selects = teams => teams.map(team => `
    <div class="form-group">
      <label>Team ${esc(team)}</label>
      <select name="${esc(team)}">${scouterOptions()}</select>
    </div>`).join('');

  openModal(`
    <h3>Assign Scouters - Match ${matchNumber}</h3>
    <form id="assign-form">
      <div class="teams-grid">
        <div class="alliance red"><h5>Red Alliance</h5>${selects(match.red_teams)}</div>
        <div class="alliance blue"><h5>Blue Alliance</h5>${selects(match.blue_teams)}</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Assignments</button>
      </div>
    </form>`);

  $('assign-form').addEventListener('submit', async e => {
    e.preventDefault();
    e.submitter.disabled = true;
    const assignments = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v));
    const ok = await runAction(
      () => postJSON('/api/admin/assign-match', { event_key: currentEvent, match_number: matchNumber, assignments }),
      'Assignments saved!');
    if (ok) closeModal();
    else e.submitter.disabled = false;
  });
}

async function bulkAssignTeam() {
  const team = $('bulk-team').value;
  const scouter = $('bulk-scouter').value;
  if (!team || !scouter || !currentEvent) {
    toast('Please select an event, team, and scouter', 'error');
    return;
  }
  if (!confirm(`Assign ${scouters[scouter]?.name} to scout team ${team} across ALL their matches?`)) return;
  if (await runAction(() => postJSON('/api/admin/bulk-assign-team', { event_key: currentEvent, team_number: team, scouter_username: scouter }), r => r.message)) {
    $('bulk-team').value = '';
    $('bulk-scouter').value = '';
  }
}

async function removeTeamAssignments() {
  const team = $('bulk-team').value;
  if (!team || !currentEvent) {
    toast('Please select an event and team', 'error');
    return;
  }
  if (!confirm(`Remove ALL assignments for team ${team} in this event?`)) return;
  if (await runAction(() => postJSON('/api/admin/remove-team-assignments', { event_key: currentEvent, team_number: team }),
    r => `Removed ${r.removed_count} assignments for team ${team}`)) {
    $('bulk-team').value = '';
  }
}

async function autoAssignTeams() {
  if (!currentEvent) {
    toast('Please select an event first', 'error');
    return;
  }
  if (!confirm('Auto-assign teams to scouters? Each scouter will scout specific teams across all of their matches.')) return;

  const results = $('auto-assign-results');
  results.hidden = false;
  results.innerHTML = '<p class="info-text">Assigning teams...</p>';
  const result = await runAction(() => postJSON('/api/admin/auto-assign', { event_key: currentEvent }),
    r => `Auto-assigned ${r.total_assignments} teams`);
  results.innerHTML = result
    ? `<p class="success">Assigned ${result.total_assignments} teams:</p>
       <div class="assignment-list">${result.assignments.map(a =>
         `<div class="assignment-item"><strong>Team ${esc(a.team)}</strong> &rarr; ${esc(a.scouter_name)} (${esc(a.scouter_username)})</div>`).join('')}</div>`
    : '<p class="error">Auto assignment failed.</p>';
}

async function clearAllAssignments() {
  if (!currentEvent) {
    toast('Please select an event first', 'error');
    return;
  }
  if (!confirm('Clear ALL assignments for this event? This cannot be undone.')) return;
  const result = await runAction(() => postJSON('/api/admin/clear-all-assignments', { event_key: currentEvent }), r => r.message);
  if (result) {
    $('auto-assign-results').hidden = false;
    $('auto-assign-results').innerHTML = `<p class="success">${esc(result.message)}</p>`;
  }
}

async function loadScouters() {
  try {
    scouters = await getJSON('/api/admin/scouters');
    $('bulk-scouter').innerHTML = scouterOptions();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function createScouterSubmit(e) {
  e.preventDefault();
  try {
    const name = $('scouter-name').value.trim();
    await postJSON('/api/admin/create-scouter', {
      name,
      username: $('scouter-username').value.trim(),
      password: $('scouter-password').value
    });
    e.target.reset();
    toast(`Scouter ${name} added!`);
    loadScouters();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadEventData() {
  const key = $('event-key-input').value.trim();
  if (!key) {
    toast('Please enter an event key', 'error');
    return;
  }
  setCurrentEvent(key, `${key} (TBA)`);
  await loadMatches();
}

function matchBuilderHTML(red = [], blue = []) {
  const inputs = (alliance, teams) => [0, 1, 2].map(i =>
    `<input type="text" placeholder="Team ${i + 1}" data-alliance="${alliance}" value="${esc(teams[i] || '')}">`).join('');
  return `
    <div class="match-builder">
      <div class="row-between">
        <span class="match-title"></span>
        <button type="button" onclick="removeManualMatch(this)" class="btn btn-ghost btn-xs">Remove</button>
      </div>
      <div class="teams-grid">
        <div class="alliance red"><h5>Red Alliance</h5><div class="team-inputs">${inputs('red', red)}</div></div>
        <div class="alliance blue"><h5>Blue Alliance</h5><div class="team-inputs">${inputs('blue', blue)}</div></div>
      </div>
    </div>`;
}

function renumberManualMatches() {
  document.querySelectorAll('#manual-matches-container .match-title')
    .forEach((el, i) => { el.textContent = `Match ${i + 1}`; });
}

function addManualMatch(red, blue) {
  $('manual-matches-container').insertAdjacentHTML('beforeend', matchBuilderHTML(red, blue));
  renumberManualMatches();
}

function removeManualMatch(button) {
  button.closest('.match-builder').remove();
  renumberManualMatches();
}

function clearManualMatches(skipConfirm) {
  if (!skipConfirm && !confirm('Clear all matches?')) return;
  $('manual-matches-container').innerHTML = '';
  addManualMatch();
}

function getManualMatchesData() {
  return [...document.querySelectorAll('#manual-matches-container .match-builder')].map(el => {
    const teams = alliance => [...el.querySelectorAll(`input[data-alliance="${alliance}"]`)].map(i => i.value.trim()).filter(Boolean);
    return { red_teams: teams('red'), blue_teams: teams('blue') };
  }).filter(m => m.red_teams.length && m.blue_teams.length);
}

async function createManualEvent() {
  const name = $('manual-event-name').value.trim();
  const matchData = getManualMatchesData();
  if (!name) return toast('Please enter an event name', 'error');
  if (!matchData.length) return toast('Add at least one match with teams on both alliances', 'error');

  try {
    const result = await postJSON('/api/admin/manual-events', { event_name: name, matches: matchData });
    toast(result.message);
    setCurrentEvent(result.event_key, `${name} (Manual)`);
    $('manual-event-name').value = '';
    clearManualMatches(true);
    loadManualEventsList();
    await loadMatches();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadManualEventsList() {
  try {
    const events = await getJSON('/api/admin/manual-events');
    $('manual-event-select').innerHTML = '<option value="">Select an event...</option>'
      + events.map(e => `<option value="${esc(e.key)}">${esc(e.name)} (${e.match_count} matches)</option>`).join('');
    $('manual-events-list').innerHTML = events.length ? events.map(e => `
      <div class="manual-event-item">
        <div>
          <h5>${esc(e.name)}</h5>
          <p class="muted">${e.match_count} matches &middot; Created ${new Date(e.created_at).toLocaleDateString()}</p>
        </div>
        <button onclick="deleteManualEvent('${esc(e.key)}', '${esc(e.name)}')" class="btn btn-danger btn-sm">Delete</button>
      </div>`).join('') : '<p class="info-text">No manual events yet.</p>';
  } catch {
    $('manual-events-list').innerHTML = '<p class="error">Error loading manual events</p>';
  }
}

async function loadManualEvent() {
  const select = $('manual-event-select');
  if (!select.value) return toast('Please select a manual event', 'error');
  setCurrentEvent(select.value, `${select.options[select.selectedIndex].textContent} (Manual)`);
  await loadMatches();
}

async function deleteManualEvent(key, name) {
  if (!confirm(`Delete the manual event "${name}"? This cannot be undone.`)) return;
  try {
    await deleteJSON(`/api/admin/manual-events/${encodeURIComponent(key)}`);
    toast('Manual event deleted');
    loadManualEventsList();
    if (currentEvent === key) {
      setCurrentEvent('', '');
      localStorage.removeItem('currentEvent');
      matches = [];
      $('matches-container').innerHTML = '<p class="info-text">Load an event above to see its matches.</p>';
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function parseMatchData(input, format) {
  const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const split = s => s.split(',').map(t => t.trim()).filter(Boolean);

  if (format === 'csv') {
    return lines.map((line, i) => {
      const teams = split(line);
      if (teams.length !== 6) throw new Error(`Line ${i + 1}: expected 6 teams, got ${teams.length}`);
      return { red_teams: teams.slice(0, 3), blue_teams: teams.slice(3) };
    });
  }
  if (format === 'text') {
    return lines.map((line, i) => {
      const m = line.toLowerCase().match(/red:\s*([^v]+)vs\s*blue:\s*(.+)/);
      if (!m) throw new Error(`Line ${i + 1}: expected "Red: ... vs Blue: ..."`);
      return { red_teams: split(m[1]), blue_teams: split(m[2]) };
    });
  }
  const data = JSON.parse(input);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of match objects');
  return data.map((m, i) => {
    if (!Array.isArray(m.red) || !Array.isArray(m.blue)) throw new Error(`Match ${i + 1}: expected {red: [...], blue: [...]}`);
    return { red_teams: m.red.map(String), blue_teams: m.blue.map(String) };
  });
}

const BULK_FORMATS = {
  csv: { label: 'CSV', hint: 'Each line: 3 red teams then 3 blue teams', placeholder: '254,148,1323,2468,2471,5940\n1678,5190,6834,973,1114,2056' },
  text: { label: 'Text', hint: 'Each line: Red: a, b, c vs Blue: d, e, f', placeholder: 'Red: 254, 148, 1323 vs Blue: 2468, 2471, 5940' },
  json: { label: 'JSON', hint: 'An array of {red: [...], blue: [...]}', placeholder: '[\n  {"red": ["254", "148", "1323"], "blue": ["2468", "2471", "5940"]}\n]' }
};
let bulkFormat = 'csv';
let bulkParsed = [];

function showBulkMatchModal() {
  openModal(`
    <h3>Bulk Add Matches</h3>
    <div class="tabs sub-tabs">
      ${Object.entries(BULK_FORMATS).map(([k, f]) => `<button type="button" class="tab-btn format-tab-btn" data-format="${k}">${f.label}</button>`).join('')}
    </div>
    <p id="bulk-hint" class="muted"></p>
    <textarea id="bulk-input" rows="10" class="mono"></textarea>
    <div id="bulk-preview" class="bulk-preview"><p class="info-text">Enter match data above to see a preview</p></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button type="button" class="btn btn-primary" id="add-bulk-btn" onclick="addBulkMatches()" disabled>Add Matches</button>
    </div>`);

  document.querySelectorAll('.format-tab-btn').forEach(btn => btn.addEventListener('click', () => setBulkFormat(btn.dataset.format)));
  $('bulk-input').addEventListener('input', previewBulkMatches);
  setBulkFormat('csv');
}

function setBulkFormat(format) {
  bulkFormat = format;
  document.querySelectorAll('.format-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.format === format));
  $('bulk-hint').textContent = BULK_FORMATS[format].hint;
  $('bulk-input').placeholder = BULK_FORMATS[format].placeholder;
  previewBulkMatches();
}

function previewBulkMatches() {
  const input = $('bulk-input').value.trim();
  const preview = $('bulk-preview');
  bulkParsed = [];
  if (input) {
    try {
      bulkParsed = parseMatchData(input, bulkFormat);
      preview.innerHTML = `<p class="success">Found ${bulkParsed.length} matches:</p>` + bulkParsed.map((m, i) => `
        <div class="preview-match">
          <strong>Match ${i + 1}</strong>
          <span class="red-text">${esc(m.red_teams.join(', '))}</span> vs
          <span class="blue-text">${esc(m.blue_teams.join(', '))}</span>
        </div>`).join('');
    } catch (err) {
      preview.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  } else {
    preview.innerHTML = '<p class="info-text">Enter match data above to see a preview</p>';
  }
  $('add-bulk-btn').disabled = !bulkParsed.length;
}

function addBulkMatches() {
  const container = $('manual-matches-container');
  const onlyEmpty = getManualMatchesData().length === 0;
  if (onlyEmpty) container.innerHTML = '';
  bulkParsed.forEach(m => addManualMatch(m.red_teams, m.blue_teams));
  closeModal();
  toast(`Added ${bulkParsed.length} matches`);
}

let dataKind = 'match';
let dataTable = { columns: [], rows: [] };
let dataSort = { key: null, dir: 1 };

async function loadData() {
  try {
    dataTable = await getJSON(`/api/admin/data/${dataKind}`);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  const teamSelect = $('data-team');
  const selected = teamSelect.value;
  const teamList = [...new Set(dataTable.rows.map(r => r.team))].sort((a, b) => a - b);
  teamSelect.innerHTML = '<option value="">All Teams</option>'
    + teamList.map(t => `<option value="${t}">Team ${t}</option>`).join('');
  teamSelect.value = teamList.map(String).includes(selected) ? selected : '';
  renderData();
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function renderData() {
  const query = $('data-search').value.trim().toLowerCase();
  const team = $('data-team').value;
  const { columns } = dataTable;

  let rows = dataTable.rows.filter(r =>
    (!team || String(r.team) === team)
    && (!query || columns.some(c => String(r[c.key]).toLowerCase().includes(query))));
  if (dataSort.key) rows = [...rows].sort((a, b) => compareValues(a[dataSort.key], b[dataSort.key]) * dataSort.dir);

  const arrow = key => dataSort.key === key ? (dataSort.dir > 0 ? ' &#9650;' : ' &#9660;') : '';
  $('data-table').innerHTML = `
    <thead><tr>
      ${columns.map(c => `<th data-key="${c.key}">${esc(c.label)}${arrow(c.key)}</th>`).join('')}
      <th></th>
    </tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr class="${r.partial_match === 'Yes' ? 'partial' : ''}">
          ${columns.map(c => `<td class="${c.key === 'notes' ? 'wrap' : ''}">${esc(r[c.key])}</td>`).join('')}
          <td><button class="btn btn-danger btn-xs" onclick="deleteDataRow('${r.id}')">Delete</button></td>
        </tr>`).join('')}
      ${rows.length ? '' : `<tr><td colspan="${columns.length + 1}" class="info-text">No entries yet.</td></tr>`}
    </tbody>`;

  $('data-table').querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => {
    const key = th.dataset.key;
    dataSort = { key, dir: dataSort.key === key ? -dataSort.dir : 1 };
    renderData();
  }));
  $('data-count').textContent = `Showing ${rows.length} of ${dataTable.rows.length} entries`;
}

async function deleteDataRow(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  try {
    await deleteJSON(`/api/admin/data/${dataKind}/${id}`);
    toast('Entry deleted');
    loadData();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function bindTabs(selector, attr, onChange) {
  const buttons = document.querySelectorAll(selector);
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.toggle('active', b === btn));
    onChange(btn.dataset[attr]);
  }));
}

function showPanel(selector, id) {
  document.querySelectorAll(selector).forEach(el => el.classList.toggle('active', el.id === id));
}

document.addEventListener('DOMContentLoaded', () => {
  bindTabs('.dashboard-tabs .tab-btn[data-tab]', 'tab', tab => {
    showPanel('.tab-content', tab);
    if (tab === 'data') loadData();
  });
  bindTabs('.event-tab-btn', 'eventTab', tab => {
    showPanel('.event-tab-content', tab);
    if (tab === 'manual-load') loadManualEventsList();
  });
  bindTabs('.data-kind-btn', 'kind', kind => {
    dataKind = kind;
    dataSort = { key: null, dir: 1 };
    $('data-team').value = '';
    loadData();
  });

  $('data-search').addEventListener('input', renderData);
  $('data-team').addEventListener('change', renderData);
  $('create-scouter-form').addEventListener('submit', createScouterSubmit);

  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) closeModal();
  });

  addManualMatch();
  loadManualEventsList();
  loadScouters();

  const savedEvent = localStorage.getItem('currentEvent');
  if (savedEvent) {
    $('event-key-input').value = savedEvent.startsWith('manual_') ? '' : savedEvent;
    setCurrentEvent(savedEvent, savedEvent);
    loadMatches();
  }

  setInterval(() => {
    if (!busy && !document.querySelector('.modal.dynamic')) renderMatches();
  }, 15000);
});
