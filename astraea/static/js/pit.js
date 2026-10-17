const form = document.getElementById('pit-form');
const warning = document.getElementById('form-warning');

function showWarning(message) {
  warning.className = 'form-warning error';
  warning.textContent = message;
  warning.hidden = false;
}

async function save(force = false) {
  const data = { ...Object.fromEntries(new FormData(form)), force };
  const res = await fetch(EDITING ? `/api/entries/pit/${EDITING.id}` : '/api/entries/pit', {
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
    window.location.href = '/data?kind=pit&saved=1';
    return;
  }
  toast(`Saved pit data for team ${body.entry.team}`);
  const { scouter, event } = data;
  form.reset();
  form.elements.scouter.value = scouter;
  form.elements.event.value = event;
  warning.hidden = true;
  form.elements.team.focus();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  save();
});

if (EDITING) {
  Object.entries(EDITING).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? '';
  });
}
