const PIT_DRAFT_KEY = 'pitScoutDraft';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('pit-scout-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const warning = document.getElementById('form-warning');
  const preview = form.dataset.preview === '1';

  function showWarning(message, type = 'error') {
    warning.className = `form-warning ${type}`;
    warning.textContent = message;
    warning.hidden = false;
  }

  function clearErrors() {
    warning.hidden = true;
    form.querySelectorAll('.error-msg').forEach(el => el.remove());
    form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
  }

  if (!preview) {
    try {
      const draft = JSON.parse(localStorage.getItem(PIT_DRAFT_KEY)) || {};
      Object.entries(draft).forEach(([key, value]) => {
        const el = form.elements[key];
        if (el && !el.value) el.value = value;
      });
    } catch {}

    form.addEventListener('input', () => {
      localStorage.setItem(PIT_DRAFT_KEY, JSON.stringify(Object.fromEntries(new FormData(form))));
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();

    const data = Object.fromEntries(new FormData(form));
    const missing = ['team', 'event', 'drivebase_type'].filter(name => !data[name]?.trim());
    missing.forEach(name => {
      const el = form.elements[name];
      el.classList.add('error-input');
      el.insertAdjacentHTML('afterend', '<span class="error-msg">Required field</span>');
    });
    if (missing.length) {
      showWarning('Please fill out all required fields.');
      return;
    }

    if (preview) {
      showWarning('Preview: this report is valid and would submit. Nothing was saved.', 'info');
      return;
    }

    submitBtn.disabled = true;
    showWarning('Submitting... Please wait.', 'info');

    try {
      await postJSON('/api/pit-scout/submit', data);
      const event = data.event;
      form.reset();
      form.elements.event.value = event;
      localStorage.setItem(PIT_DRAFT_KEY, JSON.stringify({ event }));
      warning.hidden = true;
      toast(`Pit report for team ${data.team} saved!`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showWarning(err.message || 'Network error. Please check your connection and try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
});
