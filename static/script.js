document.addEventListener('DOMContentLoaded', () => {
  const tabs        = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const form        = document.getElementById('scout-form');
  const submitBtn   = form.querySelector('button[type="submit"]');
  const formWarning = document.getElementById('form-warning');
  const spinner     = document.getElementById('submit-spinner');
  const endgameClimb      = document.getElementById('endgame_climb');
  const climbSuccessField = document.getElementById('climb_success_field');
  const robotRole         = document.getElementById('robot_role');
  const ratingFields      = document.getElementById('rating_fields');
  const offenseRatingField = document.getElementById('offense_rating_field');
  const defenseRatingField = document.getElementById('defense_rating_field');

  // Back button
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to go back? Unsaved changes will be lost.')) {
        window.location.href = '/dashboard';
      }
    });
  }

  // ========== COUNTER BUTTONS ==========
  // Each button has data-target (hidden input id) and data-amount (positive or negative int)
  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const targetId  = btn.getAttribute('data-target');
      const amount    = parseInt(btn.getAttribute('data-amount'), 10) || 0;
      const hidden    = document.getElementById(targetId);
      const display   = document.getElementById(targetId + '_display');
      if (!hidden) return;
      const newVal = Math.max(0, (parseInt(hidden.value, 10) || 0) + amount);
      hidden.value = newVal;
      if (display) display.textContent = newVal;
      saveDraft();
    });
  });

  // ========== ENDGAME CLIMB HANDLER ==========
  if (endgameClimb && climbSuccessField) {
    endgameClimb.addEventListener('change', () => {
      const v = endgameClimb.value;
      if (v && v !== 'none') {
        climbSuccessField.style.display = 'block';
      } else {
        climbSuccessField.style.display = 'none';
        const cb = document.getElementById('climb_successful');
        if (cb) cb.checked = false;
      }
      saveDraft();
    });
  }

  // ========== ROBOT ROLE HANDLER ==========
  if (robotRole) {
    robotRole.addEventListener('change', () => {
      const role = robotRole.value;
      if (role === 'offense') {
        ratingFields.style.display = 'grid';
        offenseRatingField.style.display = 'block';
        defenseRatingField.style.display = 'none';
        document.getElementById('defense_rating').value = '0';
      } else if (role === 'defense') {
        ratingFields.style.display = 'grid';
        offenseRatingField.style.display = 'none';
        defenseRatingField.style.display = 'block';
        document.getElementById('offense_rating').value = '0';
      } else if (role === 'mix') {
        ratingFields.style.display = 'grid';
        offenseRatingField.style.display = 'block';
        defenseRatingField.style.display = 'block';
      } else {
        // feeder or empty
        ratingFields.style.display = 'none';
        document.getElementById('offense_rating').value = '0';
        document.getElementById('defense_rating').value = '0';
      }
      saveDraft();
    });
  }

  // ========== TAB SWITCHING ==========
  function switchToTab(tabId) {
    tabs.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const content = document.getElementById(tabId);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      switchToTab(btn.getAttribute('data-tab'));
    });
  });

  function clearErrors() {
    formWarning.style.display = 'none';
    formWarning.textContent = '';
    form.querySelectorAll('.error-msg').forEach(el => el.remove());
    form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
  }

  function showFieldError(el, msg) {
    el.classList.add('error-input');
    const span = document.createElement('span');
    span.className = 'error-msg';
    span.style.cssText = 'color:#b33;font-size:0.9rem;display:block;margin-top:4px;';
    span.textContent = msg;
    el.parentNode.appendChild(span);
  }

  // ========== DRAFT SAVE / LOAD ==========
  const COUNTER_IDS = ['auto_fuel_scored','auto_fuel_missed','teleop_fuel_scored','teleop_fuel_missed'];

  function saveDraft() {
    const draft = {};
    // save counters
    COUNTER_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) draft[id] = el.value;
    });
    // save all visible form values
    new FormData(form).forEach((v, k) => { draft[k] = v; });
    // save checkboxes explicitly (FormData skips unchecked)
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      draft[cb.name] = cb.checked ? 'on' : 'off';
    });
    // save auto climb hidden value
    const ac = document.getElementById('auto_climb');
    if (ac) draft['auto_climb'] = ac.value;
    localStorage.setItem('scoutDraft', JSON.stringify(draft));
  }

  function loadDraft() {
    const raw = localStorage.getItem('scoutDraft');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      // restore counters
      COUNTER_IDS.forEach(id => {
        if (d[id] !== undefined) {
          const hidden  = document.getElementById(id);
          const display = document.getElementById(id + '_display');
          if (hidden)  hidden.value = d[id];
          if (display) display.textContent = d[id];
        }
      });
      // restore other inputs
      Object.entries(d).forEach(([key, value]) => {
        const el = form.querySelector(`[name="${key}"]`);
        if (!el) return;
        if (el.type === 'checkbox') {
          el.checked = value === 'on' || value === true;
        } else if (el.type !== 'hidden') {
          el.value = value;
        }
      });
      // restore auto climb buttons
      const acVal = d['auto_climb'];
      if (acVal === 'yes') setAutoClimb(true);
      else if (acVal === 'no') setAutoClimb(false);
      // trigger dependent UI
      if (endgameClimb && endgameClimb.value) endgameClimb.dispatchEvent(new Event('change'));
      if (robotRole && robotRole.value)       robotRole.dispatchEvent(new Event('change'));
    } catch(e) { console.error('Draft load error:', e); }
  }

  loadDraft();
  form.addEventListener('input',  saveDraft);
  form.addEventListener('change', saveDraft);

  // ========== TIMING ==========
  let firstInputTime = null;
  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => { if (!firstInputTime) firstInputTime = Date.now(); }, { once: true });
  });

  // ========== OFFLINE QUEUE ==========
  function saveOffline(data) {
    const q = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    q.push(data);
    localStorage.setItem('offlineQueue', JSON.stringify(q));
  }
  async function sendQueued() {
    let q = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (!q.length) return;
    for (let i = 0; i < q.length; i++) {
      try {
        const r = await fetch('/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(q[i]) });
        if (r.ok) { q.splice(i,1); i--; } else break;
      } catch { break; }
    }
    localStorage.setItem('offlineQueue', JSON.stringify(q));
  }
  window.addEventListener('load', sendQueued);
  window.addEventListener('online', () => { alert('Back online! Syncing saved reports...'); sendQueued(); });

  // ========== FORM SUBMIT ==========
  let isSubmitting = false;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (isSubmitting) return;
    clearErrors();

    const val  = id => document.getElementById(id)?.value.trim();
    const bool = id => document.getElementById(id)?.checked;

    // required fields
    let formValid = true;
    ['name','team','match'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) { formValid = false; showFieldError(el, 'Required field'); }
    });

    const tabErrors = [];

    // auto: at least something filled
    const autoScored   = parseInt(val('auto_fuel_scored'))  || 0;
    const autoMissed   = parseInt(val('auto_fuel_missed'))  || 0;
    const autoNoMove   = bool('auto_no_move');
    const autoMovedNS  = bool('auto_moved_no_score');
    const autoClimbVal = val('auto_climb');
    const autoCollect  = ['neutral','outpost','depot','preloaded'].some(s => bool(`auto_collect_${s}`));
    if (!autoScored && !autoMissed && !autoNoMove && !autoMovedNS && !autoClimbVal && !autoCollect) {
      tabErrors.push({ tab:'auto', message:'Please fill out something in the Autonomous tab' });
    }

    // teleop
    const teScored  = parseInt(val('teleop_fuel_scored')) || 0;
    const teMissed  = parseInt(val('teleop_fuel_missed')) || 0;
    const teNoMove  = bool('teleop_no_move');
    const teRole    = val('robot_role');
    if (!teScored && !teMissed && !teNoMove && !teRole) {
      tabErrors.push({ tab:'teleop', message:'Please fill out something in the Teleop tab' });
    }

    // endgame
    if (!val('endgame_climb')) {
      tabErrors.push({ tab:'endgame', message:'Please select Endgame action' });
      showFieldError(document.getElementById('endgame_climb'), 'Required');
    }

    if (!formValid || tabErrors.length) {
      formWarning.style.display = 'block';
      formWarning.style.color = '#b33';
      formWarning.textContent = tabErrors.length ? tabErrors[0].message : 'Please fix required fields.';
      if (tabErrors.length) switchToTab(tabErrors[0].tab);
      return;
    }

    isSubmitting = true;
    spinner.style.display = 'block';
    formWarning.style.display = 'block';
    formWarning.style.color = '#2563eb';
    formWarning.textContent = 'Submitting... Please wait.';
    submitBtn.disabled = true;

    const rtField = document.getElementById('response_time');
    rtField.value = firstInputTime ? ((Date.now() - firstInputTime) / 1000).toFixed(2) : '-1';

    const assignmentKey = new URLSearchParams(window.location.search).get('assignment');

    // build collection arrays
    const autoCollectSources   = ['neutral','outpost','depot','preloaded'].filter(s => bool(`auto_collect_${s}`));
    const teleopCollectSources = ['neutral','outpost','depot','preloaded'].filter(s => bool(`teleop_collect_${s}`));

    const payload = {
      name:  val('name'),
      team:  val('team'),
      match: val('match'),
      assignment_key: assignmentKey,
      auto: {
        fuel_scored:      parseInt(val('auto_fuel_scored'))  || 0,
        fuel_missed:      parseInt(val('auto_fuel_missed'))  || 0,
        no_move:          bool('auto_no_move'),
        moved_no_score:   bool('auto_moved_no_score'),
        collect_sources:  autoCollectSources,
        auto_climb:       val('auto_climb') || 'no',
      },
      teleop: {
        fuel_scored:      parseInt(val('teleop_fuel_scored')) || 0,
        fuel_missed:      parseInt(val('teleop_fuel_missed')) || 0,
        robot_role:       val('robot_role') || '',
        offense_rating:   val('offense_rating') || '-',
        defense_rating:   val('defense_rating') || '-',
        can_cross_bump:   bool('can_cross_bump'),
        can_cross_trench: bool('can_cross_trench'),
        no_move:          bool('teleop_no_move'),
        collect_sources:  teleopCollectSources,
      },
      endgame: {
        climb:            val('endgame_climb') || 'none',
        climb_successful: bool('climb_successful') || false,
      },
      notes:         val('notes') || '',
      response_time: rtField.value,
      timestamp:     new Date().toLocaleString(),
      partial_match: bool('partial_match'),
    };

    try {
      const res = await fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        localStorage.removeItem('scoutDraft');
        alert('Scout report submitted successfully!');
        window.location.href = '/dashboard?completed=true';
      } else {
        throw new Error('Server error ' + res.status);
      }
    } catch (err) {
      console.error(err);
      if (!navigator.onLine) {
        saveOffline(payload);
        localStorage.removeItem('scoutDraft');
        alert('Offline — report saved locally and will sync when back online.');
        window.location.href = '/dashboard?completed=true';
      } else {
        isSubmitting = false;
        formWarning.style.color = '#b33';
        formWarning.textContent = 'Network error. Please try again.';
        spinner.style.display = 'none';
        submitBtn.disabled = false;
      }
    }
  });
});

// ========== AUTO CLIMB (called from onclick in HTML) ==========
function setAutoClimb(value) {
  const hidden = document.getElementById('auto_climb');
  const yesBtn = document.getElementById('auto_climb_yes');
  const noBtn  = document.getElementById('auto_climb_no');
  if (!hidden) return;
  if (value) {
    hidden.value = 'yes';
    yesBtn.classList.add('selected-yes');
    yesBtn.classList.remove('selected-no');
    noBtn.classList.remove('selected-yes','selected-no');
  } else {
    hidden.value = 'no';
    noBtn.classList.add('selected-no');
    noBtn.classList.remove('selected-yes');
    yesBtn.classList.remove('selected-yes','selected-no');
  }
  try { saveDraft(); } catch(e) {}
}