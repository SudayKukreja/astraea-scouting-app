const $ = id => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const EDIT_PAGES = { match: '/', pit: '/pit' };

let kind = params.get('kind') === 'pit' ? 'pit' : 'match';
let table = { columns: [], rows: [] };
let sort = { key: null, dir: 1 };

function fillSelect(select, values, allLabel, format = v => v) {
  const selected = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>`
    + values.map(v => `<option value="${esc(v)}">${esc(format(v))}</option>`).join('');
  select.value = values.map(String).includes(selected) ? selected : '';
}

async function load() {
  document.querySelectorAll('.data-kind-btn').forEach(b => b.classList.toggle('active', b.dataset.kind === kind));
  try {
    table = await getJSON(`/api/entries/${kind}`);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  fillSelect($('data-team'), [...new Set(table.rows.map(r => r.team))].sort((a, b) => a - b), 'All teams', t => `Team ${t}`);
  fillSelect($('data-event'), [...new Set(table.rows.map(r => r.event).filter(Boolean))].sort(), 'All events');
  render();
}

function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function render() {
  const query = $('data-search').value.trim().toLowerCase();
  const team = $('data-team').value;
  const event = $('data-event').value;
  const { columns } = table;

  let rows = table.rows.filter(r =>
    (!team || String(r.team) === team)
    && (!event || r.event === event)
    && (!query || columns.some(c => String(r[c.key]).toLowerCase().includes(query))));
  if (sort.key) rows = [...rows].sort((a, b) => compare(a[sort.key], b[sort.key]) * sort.dir);

  const arrow = key => sort.key === key ? (sort.dir > 0 ? ' &#9650;' : ' &#9660;') : '';
  $('data-table').innerHTML = `
    <thead><tr>
      <th class="no-sort"></th>
      ${columns.map(c => `<th data-key="${c.key}">${esc(c.label)}${arrow(c.key)}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr class="${r.partial_match === 'Yes' ? 'partial' : ''}">
          <td class="row-actions">
            <a class="btn btn-ghost btn-xs" href="${EDIT_PAGES[kind]}?edit=${r.id}">Edit</a>
            <button class="btn btn-danger btn-xs" data-delete="${r.id}">Delete</button>
          </td>
          ${columns.map(c => c.key === 'team'
            ? `<td><a href="/analytics/team/${r.team}">${r.team}</a></td>`
            : `<td class="${c.key === 'notes' ? 'wrap' : ''}">${esc(r[c.key])}</td>`).join('')}
        </tr>`).join('')}
      ${rows.length ? '' : `<tr><td colspan="${columns.length + 1}" class="info-text">No entries yet.</td></tr>`}
    </tbody>`;
  $('data-count').textContent = `Showing ${rows.length} of ${table.rows.length} entries`;
}

$('data-table').addEventListener('click', async e => {
  const th = e.target.closest('th[data-key]');
  if (th) {
    sort = { key: th.dataset.key, dir: sort.key === th.dataset.key ? -sort.dir : 1 };
    render();
    return;
  }
  const del = e.target.closest('[data-delete]');
  if (del && confirm('Delete this entry? This cannot be undone.')) {
    try {
      await deleteJSON(`/api/entries/${kind}/${del.dataset.delete}`);
      toast('Entry deleted');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

document.querySelectorAll('.data-kind-btn').forEach(btn => btn.addEventListener('click', () => {
  kind = btn.dataset.kind;
  sort = { key: null, dir: 1 };
  $('data-team').value = '';
  load();
}));
['data-search', 'data-team', 'data-event'].forEach(id => $(id).addEventListener('input', render));

if (params.get('saved')) toast('Changes saved');
load();
