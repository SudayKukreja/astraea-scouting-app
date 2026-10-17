function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const getJSON = url => request(url);
const deleteJSON = url => request(url, { method: 'DELETE' });

function toast(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function sortValue(cell) {
  const raw = cell.dataset.sort ?? cell.textContent.trim();
  const num = parseFloat(raw);
  return raw !== '' && !isNaN(num) && /^-?[\d.]+%?$/.test(raw) ? num : raw.toLowerCase();
}

function makeSortable(table) {
  const headers = [...table.tHead.rows[0].cells];
  headers.forEach((th, index) => {
    if (th.classList.contains('no-sort')) return;
    th.addEventListener('click', () => {
      const dir = th.dataset.dir === 'desc' ? 'asc' : 'desc';
      headers.forEach(h => { delete h.dataset.dir; });
      th.dataset.dir = dir;
      const rows = [...table.tBodies[0].rows];
      rows.sort((a, b) => {
        const x = sortValue(a.cells[index]);
        const y = sortValue(b.cells[index]);
        const empty = (x === '' || x === '-') - (y === '' || y === '-');
        if (empty) return empty;
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
        return dir === 'asc' ? cmp : -cmp;
      });
      table.tBodies[0].append(...rows);
    });
  });
}

function barChart(container, labels, values, average) {
  const width = 720;
  const height = 240;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const max = Math.max(10, ...values) * 1.1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = innerW / Math.max(values.length, 1);
  const barW = Math.min(36, step * 0.7);
  const y = v => pad.top + innerH - (v / max) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(max * f));
  const grid = ticks.map(t => `
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}" class="chart-grid"/>
    <text x="${pad.left - 6}" y="${y(t) + 4}" class="chart-axis" text-anchor="end">${t}</text>`).join('');
  const bars = values.map((v, i) => {
    const x = pad.left + step * i + (step - barW) / 2;
    return `<rect x="${x}" y="${y(v)}" width="${barW}" height="${pad.top + innerH - y(v)}" rx="4" class="chart-bar"><title>Match ${labels[i]}: ${v} pts</title></rect>
      <text x="${x + barW / 2}" y="${height - 10}" class="chart-axis" text-anchor="middle">${esc(labels[i])}</text>`;
  }).join('');
  const avgLine = average == null ? '' : `
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(average)}" y2="${y(average)}" class="chart-avg"/>
    <text x="${width - pad.right}" y="${y(average) - 6}" class="chart-avg-label" text-anchor="end">avg ${average}</text>`;

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Points per match">${grid}${bars}${avgLine}</svg>`;
}

document.querySelectorAll('table.sortable').forEach(makeSortable);
