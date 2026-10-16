const COUNTER_IDS = ['auto_fuel_scored', 'auto_fuel_missed', 'teleop_fuel_scored', 'teleop_fuel_missed'];
const COLLECT_SOURCES = ['neutral', 'outpost', 'depot', 'preloaded'];
const DRAFT_KEY = 'scoutDraft';
const QUEUE_KEY = 'offlineQueue';

const $ = id => document.getElementById(id);
const val = id => $(id)?.value.trim() ?? '';
const num = id => parseInt(val(id), 10) || 0;
const checked = id => !!$(id)?.checked;
const collected = phase => COLLECT_SOURCES.filter(s => checked(`${phase}_collect_${s}`));

let form;

function setCounter(id, value) {
  $(id).value = value;
  $(`${id}_display`).textContent = value;
}

function setAutoClimb(value) {
  $('auto_climb').value = value ? 'yes' : 'no';
  $('auto_climb_yes').classList.toggle('selected-yes', value);
  $('auto_climb_no').classList.toggle('selected-no', !value);
  saveDraft();
}

function saveDraft() {
  if (!form) return;
  const draft = Object.fromEntries(new FormData(form));
  form.querySelectorAll('input[type="checkbox"]').forEach(cb => { draft[cb.name] = cb.checked; });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    return;
  }
  if (!draft) return;

  Object.entries(draft).forEach(([key, value]) => {
    const el = form.querySelector(`[name="${key}"]`);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value === true || value === 'on';
    else if (el.type !== 'hidden') el.value = value;
  });
  COUNTER_IDS.forEach(id => { if (draft[id] !== undefined) setCounter(id, draft[id]); });
  if (draft.auto_climb) setAutoClimb(draft.auto_climb === 'yes');
  $('endgame_climb').dispatchEvent(new Event('change'));
  $('robot_role').dispatchEvent(new Event('change'));
}

function switchToTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === tabId));
}

function showWarning(message, type = 'error') {
  const warning = $('form-warning');
  warning.className = `form-warning ${type}`;
  warning.textContent = message;
  warning.hidden = false;
}

function clearErrors() {
  $('form-warning').hidden = true;
  form.querySelectorAll('.error-msg').forEach(el => el.remove());
  form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
}

function showFieldError(el, message) {
  el.classList.add('error-input');
  const span = document.createElement('span');
  span.className = 'error-msg';
  span.textContent = message;
  el.parentNode.appendChild(span);
}

function validate() {
  let valid = true;
  ['name', 'team', 'match'].forEach(id => {
    if (!val(id)) {
      valid = false;
      showFieldError($(id), 'Required field');
    }
  });

  const autoFilled = num('auto_fuel_scored') || num('auto_fuel_missed') || checked('auto_no_move')
    || checked('auto_moved_no_score') || val('auto_climb') || collected('auto').length;
  if (!autoFilled) return { tab: 'auto', message: 'Please fill out something in the Autonomous tab' };

  const teleopFilled = num('teleop_fuel_scored') || num('teleop_fuel_missed') || checked('teleop_no_move') || val('robot_role');
  if (!teleopFilled) return { tab: 'teleop', message: 'Please fill out something in the Teleop tab' };

  if (!val('endgame_climb')) {
    showFieldError($('endgame_climb'), 'Required');
    return { tab: 'endgame', message: 'Please select Endgame action' };
  }

  return valid ? null : { message: 'Please fix required fields.' };
}

function buildPayload() {
  return {
    name: val('name'),
    team: val('team'),
    match: val('match'),
    assignment_key: new URLSearchParams(window.location.search).get('assignment'),
    auto: {
      fuel_scored: num('auto_fuel_scored'),
      fuel_missed: num('auto_fuel_missed'),
      no_move: checked('auto_no_move'),
      moved_no_score: checked('auto_moved_no_score'),
      collect_sources: collected('auto'),
      auto_climb: val('auto_climb') || 'no'
    },
    teleop: {
      fuel_scored: num('teleop_fuel_scored'),
      fuel_missed: num('teleop_fuel_missed'),
      robot_role: val('robot_role'),
      offense_rating: num('offense_rating'),
      defense_rating: num('defense_rating'),
      can_cross_bump: checked('can_cross_bump'),
      can_cross_trench: checked('can_cross_trench'),
      no_move: checked('teleop_no_move'),
      collect_sources: collected('teleop')
    },
    endgame: {
      climb: val('endgame_climb') || 'none',
      climb_successful: checked('climb_successful')
    },
    notes: val('notes'),
    partial_match: checked('partial_match')
  };
}

function queueOffline(payload) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push(payload);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function sendQueued() {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  while (queue.length) {
    try {
      await postJSON('/submit', queue[0]);
      queue.shift();
    } catch {
      break;
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

document.addEventListener('DOMContentLoaded', () => {
  form = $('scout-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  $('back-btn').addEventListener('click', () => {
    if (confirm('Go back? Unsaved changes will be lost.')) window.location.href = '/dashboard';
  });

  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchToTab(btn.dataset.tab)));

  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.target;
      setCounter(id, Math.max(0, num(id) + parseInt(btn.dataset.amount, 10)));
      saveDraft();
    });
  });

  $('endgame_climb').addEventListener('change', e => {
    const climbed = e.target.value && e.target.value !== 'none';
    $('climb_success_field').hidden = !climbed;
    if (!climbed) $('climb_successful').checked = false;
  });

  $('robot_role').addEventListener('change', e => {
    const role = e.target.value;
    const offense = role === 'offense' || role === 'mix';
    const defense = role === 'defense' || role === 'mix';
    $('rating_fields').hidden = !offense && !defense;
    $('offense_rating_field').hidden = !offense;
    $('defense_rating_field').hidden = !defense;
    if (!offense) $('offense_rating').value = '0';
    if (!defense) $('defense_rating').value = '0';
  });

  loadDraft();
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);

  sendQueued();
  window.addEventListener('online', () => {
    toast('Back online! Syncing saved reports...');
    sendQueued();
  });

  let submitting = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting) return;
    clearErrors();

    const error = validate();
    if (error) {
      showWarning(error.message);
      if (error.tab) switchToTab(error.tab);
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    showWarning('Submitting... Please wait.', 'info');
    const payload = buildPayload();

    try {
      await postJSON('/submit', payload);
      localStorage.removeItem(DRAFT_KEY);
      window.location.href = '/dashboard?completed=true';
    } catch (err) {
      if (!navigator.onLine) {
        queueOffline(payload);
        localStorage.removeItem(DRAFT_KEY);
        alert('Offline: report saved locally and will sync when back online.');
        window.location.href = '/dashboard';
        return;
      }
      submitting = false;
      submitBtn.disabled = false;
      showWarning(err.message || 'Network error. Please try again.');
    }
  });
});
