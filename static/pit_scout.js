document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('pit-scout-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const formWarning = document.getElementById('form-warning');
  const spinner = document.getElementById('submit-spinner');

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
    errorSpan.textContent = msg;
    el.parentNode.appendChild(errorSpan);
  }

  // Auto-save draft functionality
  form.addEventListener('input', () => {
    const draft = new FormData(form);
    const draftObj = {};
    draft.forEach((value, key) => {
      draftObj[key] = value;
    });
    localStorage.setItem('pitScoutDraft', JSON.stringify(draftObj));
  });

  // Load saved draft on page load
  const savedDraft = localStorage.getItem('pitScoutDraft');
  if (savedDraft) {
    try {
      const draftObj = JSON.parse(savedDraft);
      for (const [key, value] of Object.entries(draftObj)) {
        const el = document.getElementsByName(key)[0];
        if (el && el.id !== 'scouter_name') { // Don't overwrite scouter name
          el.value = value;
        }
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
  }

  // Track first input time for response time measurement
  let firstInputTime = null;
  function recordFirstInputTime() {
    if (!firstInputTime) {
      firstInputTime = Date.now();
    }
  }

  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', recordFirstInputTime, { once: true });
  });

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const getValue = id => document.getElementById(id)?.value.trim();

    // Validate required fields
    const requiredFields = ['scouter_name', 'team', 'event', 'drivebase_type'];
    let formValid = true;

    for (const id of requiredFields) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        formValid = false;
        showError(el, 'Required field');
      }
    }

    if (!formValid) {
      formWarning.style.display = 'block';
      formWarning.style.color = '#b33';
      formWarning.textContent = 'Please fill out all required fields.';
      return;
    }

    spinner.style.display = 'block';
    formWarning.style.display = 'block';
    formWarning.style.color = '#2563eb';
    formWarning.textContent = 'Submitting... Please wait.';
    submitBtn.disabled = true;

    // Calculate response time
    const responseTimeField = document.getElementById('response_time');
    if (firstInputTime) {
      const responseTimeSec = ((Date.now() - firstInputTime) / 1000).toFixed(2);
      responseTimeField.value = responseTimeSec;
    } else {
      responseTimeField.value = '-1';
    }

    const data = {
      scouter_name: getValue('scouter_name'),
      team: getValue('team'),
      event: getValue('event'),
      drivebase_type: getValue('drivebase_type'),
      avg_cycle_time: getValue('avg_cycle_time') || '',
      notes: getValue('notes') || '',
      response_time: responseTimeField.value,
      timestamp: new Date().toLocaleString()
    };

    try {
      const res = await fetch('/api/pit-scout/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        alert('Pit scout report submitted successfully!');
        form.reset();
        localStorage.removeItem('pitScoutDraft');
        formWarning.style.display = 'none';
        window.location.href = '/dashboard?completed=true';
      } else {
        const result = await res.json();
        formWarning.style.display = 'block';
        formWarning.style.color = '#b33';
        formWarning.textContent = result.error || 'Error submitting report. Please try again.';
      }
    } catch (err) {
      formWarning.style.display = 'block';
      formWarning.style.color = '#b33';
      formWarning.textContent = 'Network error. Please check your connection and try again.';
      console.error('Submission error:', err);
    } finally {
      spinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
});