const form = document.getElementById('entry-form');
const $ = id => document.getElementById(id);
const MULTI = ['auto_collect', 'teleop_collect'];
const KEEP_AFTER_SAVE = ['scouter', 'event', 'match'];

function readForm() {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || MULTI.includes(el.name)) continue;
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else data[el.name] = el.value.trim();
  }
  MULTI.forEach(name => { data[name] = [...form.querySelectorAll(`[name="${name}"]:checked`)].map(el => el.value); });
  data.teleop_moved = !data.teleop_no_move;
  delete data.teleop_no_move;
  return data;
}

function fillForm(entry) {
  for (const el of form.elements) {
    if (!el.name) continue;
    if (MULTI.includes(el.name)) el.checked = (entry[el.name] || []).includes(el.value);
    else if (el.name === 'teleop_no_move') el.checked = entry.teleop_moved === false;
    else if (el.type === 'checkbox') el.checked = !!entry[el.name];
    else if (el.type === 'radio') el.checked = entry[el.name] === el.value;
    else el.value = entry[el.name] ?? '';
  }
  updateForm();
}

function resetForm(keep) {
  const kept = Object.fromEntries(KEEP_AFTER_SAVE.map(k => [k, form.elements[k].value]));
  form.reset();
  if (keep) KEEP_AFTER_SAVE.forEach(k => { form.elements[k].value = kept[k]; });
  $('form-warning').hidden = true;
  updateForm();
  (form.elements.scouter.value ? (form.elements.match.value ? $('team') : $('match')) : form.elements.scouter).focus();
}

function scheduledMatch() {
  if ($('event').value !== CURRENT_EVENT) return null;
  const number = parseInt($('match').value, 10);
  return SCHEDULE.find(m => m.match_number === number) || null;
}

function updateTeamInfo() {
  const match = scheduledMatch();
  const picker = $('team-picker');
  const team = $('team').value.trim();

  picker.hidden = !match;
  if (match) {
    const button = (t, color) =>
      `<button type="button" class="team-pick ${color} ${t === team ? 'selected' : ''}" data-team="${esc(t)}">${esc(t)}</button>`;
    picker.innerHTML = match.red_teams.map(t => button(t, 'red')).join('') + match.blue_teams.map(t => button(t, 'blue')).join('');
  }

  const info = $('team-name');
  info.classList.remove('error');
  if (!team) {
    info.textContent = '';
  } else if (match && ![...match.red_teams, ...match.blue_teams].includes(team)) {
    info.textContent = `Team ${team} is not in match ${match.match_number}`;
    info.classList.add('error');
  } else {
    info.textContent = TEAM_NAMES[team] || '';
  }
}

function updateForm() {
  const autoStatus = form.querySelector('[name="auto_status"]:checked').value;
  form.querySelector('.auto-fields').disabled = autoStatus !== 'active';
  form.querySelector('.teleop-fields').disabled = form.elements.teleop_no_move.checked;
  const role = $('robot_role').value;
  $('offense-field').hidden = !['offense', 'mix'].includes(role);
  $('defense-field').hidden = !['defense', 'mix'].includes(role);
  $('climb-success-field').hidden = $('climb').value === 'none';
  updateTeamInfo();
}

function showWarning(message) {
  const warning = $('form-warning');
  warning.className = 'form-warning error';
  warning.textContent = message;
  warning.hidden = false;
}

function addRecent(entry) {
  $('recent-panel').hidden = false;
  const who = entry.scouter ? ` &middot; ${esc(entry.scouter)}` : '';
  $('recent-list').insertAdjacentHTML('afterbegin',
    `<li><span>Match ${entry.match} &middot; Team ${entry.team}${who}</span><a href="/?edit=${entry.id}">Edit</a></li>`);
}

async function save(force = false) {
  const data = { ...readForm(), force };
  const res = await fetch(EDITING ? `/api/entries/match/${EDITING.id}` : '/api/entries/match', {
    method: EDITING ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => null);
  if (!res) return showWarning('Could not reach the app. Is it still running?');

  const body = await res.json().catch(() => ({}));
  if (res.status === 409 && body.duplicate) {
    if (confirm(body.error)) save(true);
    return;
  }
  if (!res.ok) return showWarning(body.error || 'Could not save this entry');

  if (EDITING) {
    window.location.href = '/data?saved=1';
    return;
  }
  toast(`Saved team ${body.entry.team}, match ${body.entry.match}`);
  addRecent(body.entry);
  resetForm(true);
}

form.addEventListener('change', updateForm);
$('match').addEventListener('input', updateTeamInfo);
$('team').addEventListener('input', updateTeamInfo);

$('team-picker').addEventListener('click', e => {
  const pick = e.target.closest('.team-pick');
  if (!pick) return;
  $('team').value = pick.dataset.team;
  updateTeamInfo();
  form.querySelector('[name="auto_status"]:checked').focus();
});

form.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    form.requestSubmit();
  } else if (e.target.tagName === 'INPUT') {
    e.preventDefault();
    const fields = [...form.elements].filter(el => !el.disabled && el.offsetParent && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName));
    fields[fields.indexOf(e.target) + 1]?.focus();
  }
});

form.addEventListener('submit', e => {
  e.preventDefault();
  save();
});

$('clear-btn')?.addEventListener('click', () => {
  if (confirm('Clear this entry?')) resetForm(true);
});

if (EDITING) fillForm(EDITING);
else resetForm(false);
