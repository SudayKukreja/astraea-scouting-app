// ============================================================
// analytics.js — Astraea Robotics Scouting App
// REBUILT 2026 — Full dashboard implementation
// Hooks into analytics_dashboard.html
// ============================================================

'use strict';

// ==================== STATE ====================
let allData = [];       // raw entries from API
let filteredData = [];  // after sheet/event filters
let activeCharts = {};  // Chart.js instances keyed by canvas id

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  loadSheets();
  document.getElementById('sheet-filter').addEventListener('change', onSheetChange);
  document.getElementById('event-filter').addEventListener('change', onEventChange);
  document.getElementById('team-select').addEventListener('change', () => {});
  document.getElementById('hide-partial').addEventListener('change', () => {
    if (document.getElementById('team-select').value) analyzeTeam();
  });
});

// ==================== SHEET / DATA LOADING ====================
async function loadSheets() {
  try {
    const res = await fetch('/api/admin/sheets');
    if (!res.ok) throw new Error('No sheets endpoint');
    const sheets = await res.json();
    const sel = document.getElementById('sheet-filter');
    sel.innerHTML = '<option value="">-- Select Sheet --</option>';
    (sheets.sheets || sheets).forEach(s => {
      const name = typeof s === 'string' ? s : s.name || s;
      sel.innerHTML += `<option value="${name}">${name}</option>`;
    });
  } catch {
    // Fallback: load default sheet directly
    document.getElementById('sheet-filter').innerHTML =
      '<option value="">Default Sheet</option>';
    await loadData('');
  }
}

async function onSheetChange() {
  const sheet = document.getElementById('sheet-filter').value;
  document.getElementById('analysis-container').innerHTML = loadingHTML('Loading data...');
  await loadData(sheet);
}

async function loadData(sheet) {
  try {
    const url = sheet
      ? `/api/admin/analytics/data?sheet=${encodeURIComponent(sheet)}`
      : '/api/admin/analytics/data';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allData = await res.json();
    if (allData.error) throw new Error(allData.error);

    populateFilters();
    applyFilters();
    document.getElementById('analysis-container').innerHTML = `
      <div class="no-data">
        <h3>✅ ${allData.length} entries loaded</h3>
        <p>Select a team above and click <strong>Analyze Team</strong></p>
      </div>`;
  } catch (e) {
    document.getElementById('analysis-container').innerHTML =
      errorHTML(`Failed to load data: ${e.message}`);
  }
}

function populateFilters() {
  // Events
  const events = [...new Set(allData.map(d => d.event).filter(Boolean))];
  const evSel = document.getElementById('event-filter');
  evSel.innerHTML = '<option value="">All Events</option>';
  events.forEach(e => evSel.innerHTML += `<option value="${e}">${e}</option>`);

  // Teams
  populateTeamSelect(allData);
}

function populateTeamSelect(data) {
  const teams = [...new Set(data.map(d => d.team).filter(Boolean))].sort((a, b) => +a - +b);
  const sel = document.getElementById('team-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- Select Team --</option>';
  teams.forEach(t => sel.innerHTML += `<option value="${t}"${t === prev ? ' selected' : ''}>Team ${t}</option>`);
}

function onEventChange() {
  applyFilters();
  populateTeamSelect(filteredData);
  document.getElementById('analysis-container').innerHTML = `
    <div class="no-data"><h3>👆 Now select a team</h3></div>`;
}

function applyFilters() {
  const event = document.getElementById('event-filter').value;
  filteredData = allData.filter(d => !event || d.event === event);
}

// ==================== MAIN ANALYZE ====================
function analyzeTeam() {
  const teamNum = document.getElementById('team-select').value;
  if (!teamNum) {
    showToast('Please select a team first');
    return;
  }

  const hidePartial = document.getElementById('hide-partial').checked;
  let teamData = filteredData.filter(d => String(d.team) === String(teamNum));
  if (hidePartial) teamData = teamData.filter(d => !d.partialMatch);

  if (teamData.length === 0) {
    document.getElementById('analysis-container').innerHTML =
      errorHTML(`No data found for Team ${teamNum}`);
    return;
  }

  // Destroy old charts
  Object.values(activeCharts).forEach(c => { try { c.destroy(); } catch {} });
  activeCharts = {};

  const stats = computeStats(teamData);
  document.getElementById('analysis-container').innerHTML = buildDashboard(stats, teamData, teamNum);

  // Charts — run after DOM insertion
  requestAnimationFrame(() => {
    buildFuelChart('chart-fuel', teamData);
    buildScoreChart('chart-score', teamData);
    buildClimbChart('chart-climb', stats);
    buildSourceChart('chart-sources', stats);
    buildRadarChart('chart-radar', stats);
  });
}

// ==================== STATS COMPUTATION ====================
function computeStats(rows) {
  let autoFuelTotal = 0, teleopFuelTotal = 0;
  let autoFuelScored = 0, autoFuelMissed = 0;
  let teleopFuelScored = 0, teleopFuelMissed = 0;
  let autoClimbs = 0, totalScore = 0;
  let climbDist = { none: 0, level1: 0, level2: 0, level3: 0 };
  let climbAttempts = 0, successfulClimbs = 0, climbPtsTotal = 0;
  let bumpCrosses = 0, trenchCrosses = 0;
  let roles = { offense: 0, defense: 0, feeder: 0, mix: 0, unknown: 0 };
  let offenseRatings = [], defenseRatings = [];
  let collectSources = { neutral: 0, outpost: 0, depot: 0, preloaded: 0 };
  let autoCollectSources = { neutral: 0, outpost: 0, depot: 0, preloaded: 0 };
  let maxAutoFuel = 0, maxTeleopFuel = 0, maxTotal = 0;
  const n = rows.length;

  for (const d of rows) {
    const auto = d.auto || {};
    const teleop = d.teleop || {};
    const endgame = d.endgame || {};

    const aFuel = auto.fuel_scored || 0;
    const tFuel = teleop.fuel_scored || 0;
    const aFuelMiss = auto.fuel_missed || 0;
    const tFuelMiss = teleop.fuel_missed || 0;

    autoFuelTotal += aFuel;
    teleopFuelTotal += tFuel;
    autoFuelScored += aFuel;
    autoFuelMissed += aFuelMiss;
    teleopFuelScored += tFuel;
    teleopFuelMissed += tFuelMiss;
    totalScore += (d.totalScore || 0);

    if (auto.auto_climb) autoClimbs++;

    // FUEL max
    if (aFuel > maxAutoFuel) maxAutoFuel = aFuel;
    if (tFuel > maxTeleopFuel) maxTeleopFuel = tFuel;
    if (aFuel + tFuel > maxTotal) maxTotal = aFuel + tFuel;

    // Climb
    const eAction = endgame.action || 'none';
    const eLevel = endgame.tower_level || '';
    const eSuccess = endgame.climb_successful || false;
    if (eAction === 'climb') {
      climbAttempts++;
      if (eSuccess) { successfulClimbs++; climbPtsTotal += endgame.score || 0; }
      if (eLevel === 'level1') climbDist.level1++;
      else if (eLevel === 'level2') climbDist.level2++;
      else if (eLevel === 'level3') climbDist.level3++;
      else climbDist.none++;
    } else {
      climbDist.none++;
    }

    // Mobility
    if (teleop.can_cross_bump) bumpCrosses++;
    if (teleop.can_cross_trench) trenchCrosses++;

    // Role
    const role = teleop.robotRole || 'unknown';
    if (role in roles) roles[role]++;
    else roles.unknown++;
    if (teleop.offenseRating > 0) offenseRatings.push(teleop.offenseRating);
    if (teleop.defenseRating > 0) defenseRatings.push(teleop.defenseRating);

    // Collect sources — teleop
    for (const src of (teleop.collect_sources || [])) {
      const k = src.toLowerCase();
      if (k in collectSources) collectSources[k]++;
    }
    // Collect sources — auto
    for (const src of (auto.collect_sources || [])) {
      const k = src.toLowerCase();
      if (k in autoCollectSources) autoCollectSources[k]++;
    }
  }

  const avgAutoFuel = +(autoFuelTotal / n).toFixed(1);
  const avgTeleopFuel = +(teleopFuelTotal / n).toFixed(1);
  const avgTotalFuel = +(( autoFuelTotal + teleopFuelTotal) / n).toFixed(1);
  const avgTotalScore = +(totalScore / n).toFixed(1);
  const allScored = autoFuelScored + teleopFuelScored;
  const allAttempted = allScored + autoFuelMissed + teleopFuelMissed;
  const hubEfficiency = allAttempted > 0 ? Math.round((allScored / allAttempted) * 100) : 0;
  const autoClimbRate = Math.round((autoClimbs / n) * 100);
  const climbSuccessRate = climbAttempts > 0 ? Math.round((successfulClimbs / climbAttempts) * 100) : 0;
  const avgClimbPts = +(climbPtsTotal / n).toFixed(1);
  const bumpRate = Math.round((bumpCrosses / n) * 100);
  const trenchRate = Math.round((trenchCrosses / n) * 100);
  const primaryRole = Object.entries(roles).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
  const avgOffenseRating = offenseRatings.length
    ? +(offenseRatings.reduce((a, b) => a + b, 0) / offenseRatings.length).toFixed(1) : null;
  const avgDefenseRating = defenseRatings.length
    ? +(defenseRatings.reduce((a, b) => a + b, 0) / defenseRatings.length).toFixed(1) : null;

  // Consistency (lower stdev = higher consistency score)
  const fuelValues = rows.map(d => (d.auto?.fuel_scored || 0) + (d.teleop?.fuel_scored || 0));
  const mean = avgTotalFuel;
  const variance = fuelValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  const consistency = mean > 0 ? Math.max(0, Math.round((1 - Math.sqrt(variance) / mean) * 100)) : 100;

  return {
    n, avgAutoFuel, avgTeleopFuel, avgTotalFuel, avgTotalScore,
    maxAutoFuel, maxTeleopFuel, maxTotal,
    hubEfficiency, autoClimbRate, climbSuccessRate, avgClimbPts,
    climbDist, climbAttempts, successfulClimbs,
    bumpRate, trenchRate, roles, primaryRole,
    avgOffenseRating, avgDefenseRating,
    collectSources, autoCollectSources, consistency
  };
}

// ==================== DASHBOARD HTML ====================
function buildDashboard(s, rows, teamNum) {
  const teamName = window.TEAM_NAMES?.[teamNum] || '';
  const roleColor = { offense:'#ef4444', defense:'#3b82f6', feeder:'#f59e0b', mix:'#8b5cf6', unknown:'#94a3b8' };
  const roleIcon  = { offense:'⚔️', defense:'🛡️', feeder:'🔄', mix:'🔀', unknown:'❓' };

  // RP pace bars
  const energizedPct = Math.min(100, Math.round((s.avgTotalFuel / 100) * 100));
  const superchargedPct = Math.min(100, Math.round((s.avgTotalFuel / 360) * 100));
  const traversalPct = Math.min(100, Math.round((parseFloat(s.avgClimbPts) / 50) * 100));

  // Climb bar segments
  const total = s.n || 1;
  const climbSegments = `
    <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin:6px 0;">
      <div style="background:#e2e8f0;width:${Math.round(s.climbDist.none/total*100)}%;transition:width .4s;"></div>
      <div style="background:#fbbf24;width:${Math.round(s.climbDist.level1/total*100)}%;transition:width .4s;"></div>
      <div style="background:#f97316;width:${Math.round(s.climbDist.level2/total*100)}%;transition:width .4s;"></div>
      <div style="background:#10b981;width:${Math.round(s.climbDist.level3/total*100)}%;transition:width .4s;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;">
      <span>None (${s.climbDist.none})</span>
      <span style="color:#d97706;">L1 (${s.climbDist.level1})</span>
      <span style="color:#ea580c;">L2 (${s.climbDist.level2})</span>
      <span style="color:#059669;">L3 (${s.climbDist.level3})</span>
    </div>`;

  // Top teleop sources
  const srcEmoji = { neutral:'🏟️', outpost:'📡', depot:'📦', preloaded:'🔋' };
  const topSources = Object.entries(s.collectSources)
    .filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1])
    .map(([k,v]) => `<span class="source-badge">${srcEmoji[k]||''} ${k} (${v})</span>`).join('');

  // Recent notes
  const notes = rows.filter(d => d.notes?.trim()).slice(-3)
    .map(d => `<div class="note-item"><span class="note-match">M${d.match}</span> ${escapeHtml(d.notes)}</div>`).join('');

  return `
  <div class="team-header">
    <div>
      <h2>Team ${teamNum}${teamName ? ` — ${teamName}` : ''}</h2>
      <span class="match-count">${s.n} match${s.n !== 1 ? 'es' : ''} scouted</span>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <span class="role-badge" style="background:${roleColor[s.primaryRole]||'#94a3b8'};">
        ${roleIcon[s.primaryRole]||'❓'} ${s.primaryRole}
      </span>
    </div>
  </div>

  <!-- KEY STATS GRID -->
  <div class="stats-grid">
    ${statCard('⛽ Avg FUEL/Match', s.avgTotalFuel, `Auto ${s.avgAutoFuel} / Teleop ${s.avgTeleopFuel}`, '#eff6ff', '#1d4ed8')}
    ${statCard('🎯 HUB Efficiency', s.hubEfficiency + '%', `Max ${s.maxTotal} fuel in a match`, '#f0fdf4', '#065f46')}
    ${statCard('🏆 Avg Est. Score', s.avgTotalScore, `Fuel + Tower climb pts`, '#fff7ed', '#c2410c')}
    ${statCard('🧗 Avg Climb Pts', s.avgClimbPts, `Success rate: ${s.climbSuccessRate}%`, '#fdf4ff', '#7c3aed')}
    ${statCard('🤖 Auto Climb', s.autoClimbRate + '%', `${s.autoClimbRate > 0 ? '+15pts when yes' : 'No L1 in auto'}`, '#f0f9ff', '#0369a1')}
    ${statCard('📊 Consistency', s.consistency + '%', `Fuel stdev stability`, '#f8fafc', '#334155')}
  </div>

  <!-- CHARTS ROW 1 -->
  <div class="charts-row">
    <div class="chart-card chart-wide">
      <h3>⛽ FUEL Per Match (Auto + Teleop)</h3>
      <canvas id="chart-fuel" height="120"></canvas>
    </div>
    <div class="chart-card">
      <h3>📈 Score Trend</h3>
      <canvas id="chart-score" height="120"></canvas>
    </div>
  </div>

  <!-- CHARTS ROW 2 -->
  <div class="charts-row">
    <div class="chart-card">
      <h3>🧗 Tower Climb Distribution</h3>
      <canvas id="chart-climb" height="160"></canvas>
    </div>
    <div class="chart-card">
      <h3>📦 Collection Sources (Teleop)</h3>
      <canvas id="chart-sources" height="160"></canvas>
    </div>
    <div class="chart-card">
      <h3>🕸️ Capability Radar</h3>
      <canvas id="chart-radar" height="160"></canvas>
    </div>
  </div>

  <!-- DETAILED STATS -->
  <div class="detail-grid">
    <!-- Climb breakdown -->
    <div class="detail-card">
      <h3>🧗 Tower Climb</h3>
      ${climbSegments}
      <div class="detail-rows">
        <div class="detail-row"><span>Auto Climb (L1) Rate</span><strong>${s.autoClimbRate}%</strong></div>
        <div class="detail-row"><span>Climb Attempts</span><strong>${s.climbAttempts} / ${s.n}</strong></div>
        <div class="detail-row"><span>Successful Climbs</span><strong>${s.successfulClimbs}</strong></div>
        <div class="detail-row"><span>Success Rate</span><strong>${s.climbSuccessRate}%</strong></div>
        <div class="detail-row"><span>Avg Climb Points</span><strong>${s.avgClimbPts} pts</strong></div>
      </div>
    </div>

    <!-- Mobility -->
    <div class="detail-card">
      <h3>🚧 Mobility & Collection</h3>
      <div class="detail-rows">
        <div class="detail-row"><span>Can Cross BUMP</span><strong>${s.bumpRate}%</strong></div>
        <div class="detail-row"><span>Can Cross TRENCH</span><strong>${s.trenchRate}%</strong></div>
        <div class="detail-row"><span>Max FUEL (single match)</span><strong>${s.maxTotal}</strong></div>
        <div class="detail-row"><span>Max Auto FUEL</span><strong>${s.maxAutoFuel}</strong></div>
        <div class="detail-row"><span>Max Teleop FUEL</span><strong>${s.maxTeleopFuel}</strong></div>
      </div>
      ${topSources ? `<div style="margin-top:10px;"><div style="font-size:11px;color:#64748b;margin-bottom:6px;">TOP TELEOP SOURCES</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${topSources}</div></div>` : ''}
    </div>

    <!-- RP Contribution -->
    <div class="detail-card">
      <h3>⚡ RP Contribution (Per-Robot Pace)</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:12px;">Alliance needs 3 robots combined. Bars show this robot's share.</p>
      ${rpBar('⚡ ENERGIZED RP', 'Need 100 fuel total', s.avgTotalFuel, 100, '#2563eb', energizedPct)}
      ${rpBar('⚡⚡ SUPERCHARGED RP', 'Need 360 fuel total', s.avgTotalFuel, 360, '#7c3aed', superchargedPct)}
      ${rpBar('🧗 TRAVERSAL RP', 'Need 50 tower pts total', s.avgClimbPts, 50, '#10b981', traversalPct)}
      <div class="detail-rows" style="margin-top:14px;">
        ${s.avgOffenseRating !== null ? `<div class="detail-row"><span>⚔️ Offense Rating</span><strong>${s.avgOffenseRating}/5</strong></div>` : ''}
        ${s.avgDefenseRating !== null ? `<div class="detail-row"><span>🛡️ Defense Rating</span><strong>${s.avgDefenseRating}/5</strong></div>` : ''}
        <div class="detail-row">
          <span>Role Distribution</span>
          <strong>${Object.entries(s.roles).filter(([,v])=>v>0).map(([k,v])=>`${k}:${v}`).join(', ')}</strong>
        </div>
      </div>
    </div>
  </div>

  <!-- MATCH LOG -->
  <div class="detail-card match-log-card">
    <h3>📋 Match Log</h3>
    <div style="overflow-x:auto;">
      <table class="match-table">
        <thead>
          <tr>
            <th>Match</th>
            <th>Auto FUEL</th>
            <th>Teleop FUEL</th>
            <th>Total FUEL</th>
            <th>Auto Climb</th>
            <th>Tower Climb</th>
            <th>Est. Score</th>
            <th>Role</th>
            <th>Partial</th>
          </tr>
        </thead>
        <tbody>
          ${rows.sort((a,b) => a.match - b.match).map(d => {
            const auto = d.auto || {};
            const teleop = d.teleop || {};
            const eg = d.endgame || {};
            const totalFuel = (auto.fuel_scored||0) + (teleop.fuel_scored||0);
            const climbLabel = eg.action === 'climb'
              ? `${eg.tower_level?.replace('level','L').replace('1','1').replace('2','2').replace('3','3') || '?'} ${eg.climb_successful ? '✓' : '✗'}`
              : '—';
            return `<tr class="${d.partialMatch ? 'partial-row' : ''}">
              <td><strong>M${d.match}</strong></td>
              <td>${auto.fuel_scored||0}</td>
              <td>${teleop.fuel_scored||0}</td>
              <td><strong>${totalFuel}</strong></td>
              <td>${auto.auto_climb ? '✅ Yes (+15)' : '—'}</td>
              <td>${climbLabel}</td>
              <td><strong>${d.totalScore||0}</strong></td>
              <td>${teleop.robotRole || '—'}</td>
              <td>${d.partialMatch ? '⚠️' : ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- NOTES -->
  ${notes ? `
  <div class="detail-card">
    <h3>📝 Scout Notes</h3>
    <div class="notes-list">${notes}</div>
  </div>` : ''}
  `;
}

// ==================== CHART BUILDERS ====================
function buildFuelChart(id, rows) {
  const sorted = [...rows].sort((a,b) => a.match - b.match);
  const labels = sorted.map(d => `M${d.match}`);
  const autoData = sorted.map(d => d.auto?.fuel_scored || 0);
  const teleopData = sorted.map(d => d.teleop?.fuel_scored || 0);
  activeCharts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Auto FUEL', data: autoData, backgroundColor: 'rgba(37,99,235,0.85)', borderRadius: 4, stack: 'fuel' },
        { label: 'Teleop FUEL', data: teleopData, backgroundColor: 'rgba(96,165,250,0.75)', borderRadius: 4, stack: 'fuel' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'FUEL' } }
      }
    }
  });
}

function buildScoreChart(id, rows) {
  const sorted = [...rows].sort((a,b) => a.match - b.match);
  const labels = sorted.map(d => `M${d.match}`);
  const scores = sorted.map(d => d.totalScore || 0);
  const avg = scores.reduce((a,b) => a+b, 0) / (scores.length || 1);
  activeCharts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Est. Score', data: scores, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
        { label: 'Avg', data: new Array(labels.length).fill(+avg.toFixed(1)), borderColor: '#f59e0b', borderDash: [6,3], borderWidth: 2, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function buildClimbChart(id, s) {
  const { none, level1, level2, level3 } = s.climbDist;
  activeCharts[id] = new Chart(document.getElementById(id), {
    type: 'doughnut',
    data: {
      labels: ["No Climb", "L1 (10pts)", "L2 (20pts)", "L3 (30pts)"],
      datasets: [{ data: [none, level1, level2, level3], backgroundColor: ['#e2e8f0','#fbbf24','#f97316','#10b981'], borderWidth: 2 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function buildSourceChart(id, s) {
  const keys = ['neutral', 'outpost', 'depot', 'preloaded'];
  const labels = ['🏟️ Neutral', '📡 Outpost', '📦 Depot', '🔋 Preloaded'];
  const data = keys.map(k => s.collectSources[k] || 0);
  activeCharts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Matches', data, backgroundColor: ['#3b82f6','#8b5cf6','#f59e0b','#10b981'], borderRadius: 6 }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function buildRadarChart(id, s) {
  const norm = (v, max) => Math.min(100, Math.round((v / max) * 100));
  activeCharts[id] = new Chart(document.getElementById(id), {
    type: 'radar',
    data: {
      labels: ['Auto FUEL', 'Teleop FUEL', 'HUB Eff.', 'Climb Rate', 'Auto Climb', 'Consistency'],
      datasets: [{
        label: 'Team Profile',
        data: [
          norm(s.avgAutoFuel, 15),
          norm(s.avgTeleopFuel, 60),
          s.hubEfficiency,
          s.climbSuccessRate,
          s.autoClimbRate,
          s.consistency
        ],
        backgroundColor: 'rgba(37,99,235,0.2)',
        borderColor: '#2563eb',
        pointBackgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      scales: { r: { beginAtZero: true, max: 100, ticks: { display: false } } },
      plugins: { legend: { display: false } }
    }
  });
}

// ==================== SMALL HTML HELPERS ====================
function statCard(label, value, sub, bg, color) {
  return `
    <div class="stat-card" style="background:${bg};">
      <div class="stat-value" style="color:${color};">${value}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-sub">${sub}</div>
    </div>`;
}

function rpBar(label, hint, current, target, color, pct) {
  return `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span style="font-weight:600;">${label}</span>
        <span style="color:#64748b;">${hint} | avg ${current}</span>
      </div>
      <div style="background:#e2e8f0;border-radius:4px;height:8px;">
        <div style="background:${color};width:${pct}%;height:100%;border-radius:4px;transition:width .5s;"></div>
      </div>
    </div>`;
}

function loadingHTML(msg) {
  return `<div class="no-data"><div class="spinner"></div><p>${msg}</p></div>`;
}
function errorHTML(msg) {
  return `<div class="no-data" style="color:#ef4444;"><h3>⚠️ Error</h3><p>${msg}</p></div>`;
}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}