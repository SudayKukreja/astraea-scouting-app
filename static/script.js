document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const form = document.getElementById('scout-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const formWarning = document.getElementById('form-warning');
  const spinner = document.getElementById('submit-spinner');
  const endgameClimb = document.getElementById('endgame_climb');
  const towerLevelField = document.getElementById('tower_level_field');
  const robotRole = document.getElementById('robot_role');
  const ratingFields = document.getElementById('rating_fields');
  const offenseRatingField = document.getElementById('offense_rating_field');
  const defenseRatingField = document.getElementById('defense_rating_field');

  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to go back? Any unsaved changes will be lost.')) {
        window.location.href = '/dashboard';
      }
    });
  }

  // ========== COUNTER BUTTON FUNCTIONALITY ==========
  const counterButtons = document.querySelectorAll('.counter-btn');
  
  counterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const currentValue = parseInt(input.value) || 0;
      
      if (btn.classList.contains('plus')) {
        input.value = currentValue + 1;
      } else if (btn.classList.contains('minus')) {
        input.value = Math.max(0, currentValue - 1);
      }
      
      // Save to draft
      saveDraft();
    });
  });

  // ========== ENDGAME CLIMB HANDLER ==========
  if (endgameClimb) {
    endgameClimb.addEventListener('change', () => {
      if (endgameClimb.value === 'climbed') {
        towerLevelField.style.display = 'block';
      } else {
        towerLevelField.style.display = 'none';
        document.getElementById('tower_level').value = '';
      }
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
      } else if (role === 'both') {
        ratingFields.style.display = 'grid';
        offenseRatingField.style.display = 'block';
        defenseRatingField.style.display = 'block';
      } else {
        ratingFields.style.display = 'none';
      }
    });
  }

  // ========== TAB SWITCHING ==========
  function clearErrors() {
    formWarning.style.display = 'none';
    formWarning.textContent = '';
    form.querySelectorAll('.error-msg').forEach(el => el.remove());
    form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
  }

  function showError(el, msg) {
    el.classList.add('error-input');
    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-msg';
    errorSpan.style.color = '#b33';
    errorSpan.style.fontSize = '0.9rem';
    errorSpan.textContent = msg;
    el.parentNode.appendChild(errorSpan);
  }

  function switchToTab(tabId) {
    tabs.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      tabContents.forEach(tab => tab.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });

  // ========== DRAFT SAVING ==========
  function saveDraft() {
    const draft = new FormData(form);
    const draftObj = {};
    draft.forEach((value, key) => {
      draftObj[key] = value;
    });
    localStorage.setItem('scoutDraft', JSON.stringify(draftObj));
  }

  const savedDraft = localStorage.getItem('scoutDraft');
  if (savedDraft) {
    const draftObj = JSON.parse(savedDraft);
    for (const [key, value] of Object.entries(draftObj)) {
      const el = document.getElementsByName(key)[0];
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = value === 'on' || value === true;
        } else {
          el.value = value;
        }
      }
    }
    
    // Trigger endgame climb display
    if (endgameClimb && endgameClimb.value === 'climbed') {
      towerLevelField.style.display = 'block';
    }
    
    // Trigger robot role rating fields display
    if (robotRole && robotRole.value) {
      robotRole.dispatchEvent(new Event('change'));
    }
  }

  form.addEventListener('input', saveDraft);

  // ========== TIMING TRACKING ==========
  let firstInputTime = null;
  function recordFirstInputTime() {
    if (!firstInputTime) {
      firstInputTime = Date.now();
    }
  }

  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', recordFirstInputTime, { once: true });
  });

  // ========== OFFLINE QUEUE ==========
  function saveOffline(data) {
    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push(data);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  }

  async function sendQueuedSubmissions() {
    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (!queue.length) return;

    for (let i = 0; i < queue.length; i++) {
      try {
        const res = await fetch('/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queue[i])
        });
        if (res.ok) {
          queue.splice(i, 1);
          i--;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  }

  window.addEventListener('load', sendQueuedSubmissions);
  window.addEventListener('online', () => {
    alert('You are back online! Trying to submit any saved reports now.');
    sendQueuedSubmissions();
  });

  // ========== FORM SUBMISSION ==========
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const getValue = id => document.getElementById(id)?.value.trim();
    const getCheckbox = id => document.getElementById(id)?.checked;

    const requiredFields = ['name', 'team', 'match'];
    let formValid = true;

    for (const id of requiredFields) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        formValid = false;
        showError(el, 'Required field');
      }
    }

    let tabErrors = [];

    // Validate Auto
    const autoFuelScored = parseInt(getValue('auto_fuel_scored')) || 0;
    const autoFuelMissed = parseInt(getValue('auto_fuel_missed')) || 0;
    const autoNoMove = getCheckbox('auto_no_move');
    
    if (autoFuelScored === 0 && autoFuelMissed === 0 && !autoNoMove && !getCheckbox('auto_left_zone')) {
      tabErrors.push({ tab: 'auto', message: 'Please fill out something in Autonomous tab' });
    }

    // Validate Teleop
    const teleopFuelScored = parseInt(getValue('teleop_fuel_scored')) || 0;
    const teleopFuelMissed = parseInt(getValue('teleop_fuel_missed')) || 0;
    const teleopNoMove = getCheckbox('teleop_no_move');
    const robotRoleValue = getValue('robot_role');
    
    if (teleopFuelScored === 0 && teleopFuelMissed === 0 && !teleopNoMove && !robotRoleValue) {
      tabErrors.push({ tab: 'teleop', message: 'Please fill out something in Teleop tab' });
    }

    // Validate Endgame
    if (!getValue('endgame_climb')) {
      tabErrors.push({ tab: 'endgame', message: 'Please select Endgame action' });
      showError(document.getElementById('endgame_climb'), 'Required');
    }

    if (!formValid || tabErrors.length > 0) {
      formWarning.style.display = 'block';
      formWarning.style.color = '#b33';
      formWarning.textContent = tabErrors.length > 0 ? tabErrors[0].message : 'Please fix required fields.';
      if (tabErrors.length > 0) switchToTab(tabErrors[0].tab);
      return;
    }

    spinner.style.display = 'block';
    formWarning.style.display = 'block';
    formWarning.style.color = '#2563eb';
    formWarning.textContent = 'Submitting... This may take a few seconds, please wait.';
    submitBtn.disabled = true;

    const responseTimeField = document.getElementById('response_time');
    if (firstInputTime) {
      const responseTimeSec = ((Date.now() - firstInputTime) / 1000).toFixed(2);
      responseTimeField.value = responseTimeSec;
    } else {
      responseTimeField.value = '-1';
    }

    const urlParams = new URLSearchParams(window.location.search);
    const assignmentKey = urlParams.get('assignment');

    const data = {
      name: getValue('name'),
      team: getValue('team'),
      match: getValue('match'),
      assignment_key: assignmentKey,
      auto: {
        fuel_scored: parseInt(getValue('auto_fuel_scored')) || 0,
        fuel_missed: parseInt(getValue('auto_fuel_missed')) || 0,
        left_zone: getCheckbox('auto_left_zone'),
        no_move: getCheckbox('auto_no_move')
      },
      teleop: {
        fuel_scored: parseInt(getValue('teleop_fuel_scored')) || 0,
        fuel_missed: parseInt(getValue('teleop_fuel_missed')) || 0,
        robot_role: getValue('robot_role') || '',
        offense_rating: getValue('offense_rating') || '-',
        defense_rating: getValue('defense_rating') || '-',
        can_cross_bump: getCheckbox('can_cross_bump'),
        can_cross_trench: getCheckbox('can_cross_trench'),
        no_move: getCheckbox('teleop_no_move')
      },
      endgame: {
        climb: getValue('endgame_climb') || 'none',
        tower_level: getValue('tower_level') || ''
      },
      notes: getValue('notes') || '',
      response_time: responseTimeField.value,
      timestamp: new Date().toLocaleString(),
      partial_match: getCheckbox('partial_match')
    };

    try {
      const res = await fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        alert('Scout report submitted successfully!');
        form.reset();
        localStorage.removeItem('scoutDraft');

        tabs.forEach(b => b.classList.remove('active'));
        tabs[0].classList.add('active');
        tabContents.forEach(t => t.classList.remove('active'));
        tabContents[0].classList.add('active');

        towerLevelField.style.display = 'none';
        formWarning.style.display = 'none';

        window.location.href = '/dashboard?completed=true';
      } else {
        formWarning.style.display = 'block';
        formWarning.style.color = '#b33';
        formWarning.textContent = 'Error submitting report. Please try again.';
      }
    } catch (err) {
      saveOffline(data);
      alert('You are currently offline. Your report has been saved locally and will sync automatically when you are back online.');
      form.reset();
      localStorage.removeItem('scoutDraft');

      tabs.forEach(b => b.classList.remove('active'));
      tabs[0].classList.add('active');
      tabContents.forEach(t => t.classList.remove('active'));
      tabContents[0].classList.add('active');

      towerLevelField.style.display = 'none';
      formWarning.style.display = 'none';

      window.location.href = '/dashboard?completed=true';
    } finally {
      spinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });

  // Trigger robot role on page load if value exists
  if (robotRole && robotRole.value) {
    robotRole.dispatchEvent(new Event('change'));
  }
});