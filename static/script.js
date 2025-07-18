document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const form = document.getElementById('scout-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const formWarning = document.getElementById('form-warning');
  const spinner = document.getElementById('submit-spinner');
  const endgameAction = document.getElementById('endgame_action');
  const climbDepthLabel = document.getElementById('climb_depth_label');

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

  // Tab switching
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      tabContents.forEach(tab => tab.classList.remove('active'));
      document.getElementById(target).classList.add('active');
    });
  });

  // Restore draft from localStorage
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
  }

  // Autosave draft to localStorage
  form.addEventListener('input', () => {
    const draft = new FormData(form);
    const draftObj = {};
    draft.forEach((value, key) => {
      draftObj[key] = value;
    });
    localStorage.setItem('scoutDraft', JSON.stringify(draftObj));
  });

  let firstInputTime = null;
  function recordFirstInputTime() {
    if (!firstInputTime) {
      firstInputTime = Date.now();
    }
  }

  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', recordFirstInputTime, { once: true });
  });

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

    const autoFields = ['auto_ll1', 'auto_l2', 'auto_l3', 'auto_l4', 'auto_processor', 'auto_barge'];
    const teleopFields = ['teleop_ll1', 'teleop_l2', 'teleop_l3', 'teleop_l4', 'teleop_processor', 'teleop_barge', 'offense_rating', 'defense_rating'];
    const endgameFields = ['endgame_action'];

    if (!autoFields.some(id => getValue(id) !== '' && getValue(id) !== '0') && !getCheckbox('auto_no_move')) {
      tabErrors.push({ tab: 'auto-tab', message: 'Please fill out something in Autonomous tab' });
      autoFields.forEach(id => showError(document.getElementById(id), 'Expected input'));
    }

    if (!teleopFields.some(id => getValue(id) !== '' && getValue(id) !== '0') && !getCheckbox('teleop_no_move')) {
      tabErrors.push({ tab: 'teleop-tab', message: 'Please fill out something in Teleop tab' });
      teleopFields.forEach(id => showError(document.getElementById(id), 'Expected input'));
    }

    if (!getValue('endgame_action')) {
      tabErrors.push({ tab: 'endgame-tab', message: 'Please select an Endgame action' });
      showError(document.getElementById('endgame_action'), 'Required');
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

    const data = {
      name: getValue('name'),
      team: getValue('team'),
      match: getValue('match'),
      auto: {
        ll1: getValue('auto_ll1') || 0,
        l2: getValue('auto_l2') || 0,
        l3: getValue('auto_l3') || 0,
        l4: getValue('auto_l4') || 0,
        processor: getValue('auto_processor') || 0,
        barge: getValue('auto_barge') || 0,
        dropped_pieces: parseInt(getValue('auto_dropped_pieces')) || 0,
        no_move: getCheckbox('auto_no_move')
      },
      teleop: {
        ll1: getValue('teleop_ll1') || 0,
        l2: getValue('teleop_l2') || 0,
        l3: getValue('teleop_l3') || 0,
        l4: getValue('teleop_l4') || 0,
        processor: getValue('teleop_processor') || 0,
        barge: getValue('teleop_barge') || 0,
        offense_rating: getValue('offense_rating') || '-',
        defense_rating: getValue('defense_rating') || '-',
        no_move: getCheckbox('teleop_no_move'),
        dropped_pieces: parseInt(getValue('dropped_pieces')) || 0
      },
      endgame: {
        action: getValue('endgame_action') || '',
        climb_depth: getValue('climb_depth') || ''
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

        formWarning.style.display = 'none';
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

      formWarning.style.display = 'none';
    } finally {
      spinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });

  if (endgameAction) {
    endgameAction.addEventListener('change', () => {
      if (endgameAction.value === 'climb') {
        climbDepthLabel.classList.remove('hidden');
      } else {
        climbDepthLabel.classList.add('hidden');
        const climbDepthInput = document.getElementById('climb_depth');
        climbDepthInput.value = '';

        const savedDraft = localStorage.getItem('scoutDraft');
        if (savedDraft) {
          const draftObj = JSON.parse(savedDraft);
          if ('climb_depth' in draftObj) {
            delete draftObj.climb_depth;
            localStorage.setItem('scoutDraft', JSON.stringify(draftObj));
          }
        }
      }
    });
  }
});