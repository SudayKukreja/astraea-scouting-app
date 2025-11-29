let analyticsData = [];
let currentFilters = {
  event: '',
  team: '',
  hidePartial: false,
  sheet: ''
};

let availableSheets = [];
let performanceChart = null;
let scoringChart = null;
let endgameChart = null;

document.addEventListener('DOMContentLoaded', () => {
  loadSheets();
  
  document.getElementById('event-filter').addEventListener('change', updateTeamsList);
  document.getElementById('hide-partial').addEventListener('change', () => {
    if (currentFilters.team) {
      analyzeTeam();
    }
  });
  
  document.getElementById('sheet-filter').addEventListener('change', () => {
    loadAnalyticsData();
  });
});

async function loadSheets() {
  try {
    const response = await fetch('/api/admin/analytics/sheets');
    if (!response.ok) throw new Error('Failed to fetch sheets list');
    
    availableSheets = await response.json();
    
    const sheetSelect = document.getElementById('sheet-filter');
    sheetSelect.innerHTML = '<option value="">Auto-detect (current mode)</option>';
    
    availableSheets.forEach(sheet => {
      sheetSelect.innerHTML += `<option value="${sheet.name}">${sheet.name}</option>`;
    });
    
    loadAnalyticsData();
  } catch (error) {
    console.error('Error loading sheets:', error);
    loadAnalyticsData();
  }
}

async function loadAnalyticsData() {
  try {
    const selectedSheet = document.getElementById('sheet-filter').value;
    let url = '/api/admin/analytics/data';
    if (selectedSheet) {
      url += `?sheet=${encodeURIComponent(selectedSheet)}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch analytics data');
    
    analyticsData = await response.json();
    
    if (analyticsData.error) throw new Error(analyticsData.error);
    
    if (analyticsData.length === 0) {
      showNoDataMessage();
    } else {
      populateFilters();
    }
  } catch (error) {
    console.error('Error loading analytics data:', error);
    showError('Failed to load data: ' + error.message);
  }
}

function showNoDataMessage() {
  const container = document.getElementById('analysis-container');
  const selectedSheet = document.getElementById('sheet-filter').value || 'the selected sheet';
  container.innerHTML = `
    <div class="no-data">
      <h3>📭 No Data Found</h3>
      <p>There is no scouting data in <strong>${selectedSheet}</strong> yet.</p>
      <p>Try selecting a different sheet or submit some scout reports first.</p>
    </div>
  `;
}

function populateFilters() {
  const events = [...new Set(analyticsData.map(d => d.event))];
  if (events.length === 0) events.push('current_event');

  const eventSelect = document.getElementById('event-filter');
  eventSelect.innerHTML = '<option value="">All Events</option>';
  events.forEach(event => {
    eventSelect.innerHTML += `<option value="${event}">${event}</option>`;
  });
  
  updateTeamsList();
}

function updateTeamsList() {
  const eventFilter = document.getElementById('event-filter').value;
  
  let filteredData = analyticsData;
  if (eventFilter) {
    filteredData = analyticsData.filter(d => d.event === eventFilter);
  }
  
  const teamCounts = {};
  filteredData.forEach(d => {
    teamCounts[d.team] = (teamCounts[d.team] || 0) + 1;
  });
  
  const teams = Object.keys(teamCounts).sort((a, b) => parseInt(a) - parseInt(b));
  
  const teamSelect = document.getElementById('team-select');
  teamSelect.innerHTML = '<option value="">Select Team</option>';
  teams.forEach(team => {
    teamSelect.innerHTML += `<option value="${team}">Team ${team} (${teamCounts[team]} matches)</option>`;
  });
}

function analyzeTeam() {
  const team = document.getElementById('team-select').value;
  const event = document.getElementById('event-filter').value;
  const hidePartial = document.getElementById('hide-partial').checked;
  
  if (!team) {
    alert('Please select a team');
    return;
  }
  
  currentFilters = { team, event, hidePartial };

  let teamData = analyticsData.filter(d => String(d.team) === String(team));
  
  if (event) {
    teamData = teamData.filter(d => d.event === event);
  }
  
  if (hidePartial) {
    teamData = teamData.filter(d => !d.partialMatch);
  }
  
  if (teamData.length === 0) {
    document.getElementById('analysis-container').innerHTML = `
      <div class="no-data">
        <h3>No data found for Team ${team}</h3>
        <p>Try selecting a different event or disabling the "Hide Shutdowns" filter</p>
      </div>
    `;
    return;
  }
  
  const stats = calculateTeamStats(teamData);
  renderTeamAnalysis(team, teamData, stats);
}

function calculateTeamStats(teamData) {
  const totalMatches = teamData.length;
  const partialMatches = teamData.filter(d => d.partialMatch).length;
  
  const scores = teamData.map(d => d.totalScore);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  
  let trend = 'stable';
  if (totalMatches >= 4) {
    const recentMatches = teamData.slice(-Math.ceil(totalMatches / 2));
    const earlierMatches = teamData.slice(0, Math.floor(totalMatches / 2));
    
    const recentAvg = recentMatches.reduce((sum, d) => sum + d.totalScore, 0) / recentMatches.length;
    const earlierAvg = earlierMatches.reduce((sum, d) => sum + d.totalScore, 0) / earlierMatches.length;
    
    if (recentAvg > earlierAvg + 5) trend = 'improving';
    else if (earlierAvg > recentAvg + 5) trend = 'declining';
  }

  const autoScores = teamData.map(d => d.auto.score);
  const avgAuto = (autoScores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  const teleopScores = teamData.map(d => d.teleop.score);
  const avgTeleop = (teleopScores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  const offenseRatings = teamData.map(d => d.teleop.offenseRating || 0);
  const avgOffense = (offenseRatings.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  const defenseRatings = teamData.map(d => d.teleop.defenseRating || 0);
  const avgDefense = (defenseRatings.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);

  // Enhanced endgame analysis
  const climbAttempts = teamData.filter(d => d.endgame.action === 'climb').length;
  const successfulClimbs = teamData.filter(d => 
    d.endgame.action === 'climb' && d.endgame.climbSuccessful
  ).length;
  const failedClimbsWithPark = teamData.filter(d => 
    d.endgame.action === 'climb' && !d.endgame.climbSuccessful && d.endgame.climbParked
  ).length;
  const parkOnly = teamData.filter(d => d.endgame.action === 'park').length;
  const noEndgame = teamData.filter(d => 
    d.endgame.action === 'did not park/climb' || !d.endgame.action
  ).length;
  
  // Smart climb rate calculation
  let climbRate = null;
  let climbStrategy = 'none';
  
  if (climbAttempts > 0) {
    climbRate = ((successfulClimbs / climbAttempts) * 100).toFixed(0);
    climbStrategy = 'attempts';
  } else if (parkOnly > totalMatches * 0.5) {
    climbStrategy = 'park_focused';
  } else {
    climbStrategy = 'no_endgame';
  }

  let totalL1 = 0, totalL2 = 0, totalL3 = 0, totalL4 = 0;
  let totalProcessor = 0, totalBarge = 0, totalDropped = 0;
  
  teamData.forEach(d => {
    totalL1 += (d.auto.ll1 || 0) + (d.teleop.ll1 || 0);
    totalL2 += (d.auto.l2 || 0) + (d.teleop.l2 || 0);
    totalL3 += (d.auto.l3 || 0) + (d.teleop.l3 || 0);
    totalL4 += (d.auto.l4 || 0) + (d.teleop.l4 || 0);
    totalProcessor += (d.auto.processor || 0) + (d.teleop.processor || 0);
    totalBarge += (d.auto.barge || 0) + (d.teleop.barge || 0);
    totalDropped += (d.auto.droppedPieces || 0) + (d.teleop.droppedPieces || 0);
  });

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance).toFixed(1);
  
  return {
    totalMatches,
    partialMatches,
    avgScore,
    maxScore,
    minScore,
    avgAuto,
    avgTeleop,
    avgOffense,
    avgDefense,
    climbAttempts,
    successfulClimbs,
    failedClimbsWithPark,
    parkOnly,
    noEndgame,
    climbRate,
    climbStrategy,
    totalL1, totalL2, totalL3, totalL4, totalProcessor, totalBarge, totalDropped,
    avgL1: (totalL1 / totalMatches).toFixed(1),
    avgL2: (totalL2 / totalMatches).toFixed(1),
    avgL3: (totalL3 / totalMatches).toFixed(1),
    avgL4: (totalL4 / totalMatches).toFixed(1),
    avgProcessor: (totalProcessor / totalMatches).toFixed(1),
    avgBarge: (totalBarge / totalMatches).toFixed(1),
    avgDropped: (totalDropped / totalMatches).toFixed(1),
    consistency: stdDev,
    trend
  };
}

function renderTeamAnalysis(team, teamData, stats) {
  const container = document.getElementById('analysis-container');
  
  let performanceLevel = 'developing';
  let performanceColor = 'warning';
  let performanceEmoji = '🔨';
  
  if (stats.avgScore >= 90) {
    performanceLevel = 'world-class';
    performanceColor = 'elite';
    performanceEmoji = '👑';
  } else if (stats.avgScore >= 75) {
    performanceLevel = 'elite';
    performanceColor = 'elite';
    performanceEmoji = '🚀';
  } else if (stats.avgScore >= 60) {
    performanceLevel = 'strong';
    performanceColor = 'success';
    performanceEmoji = '💪';
  } else if (stats.avgScore >= 45) {
    performanceLevel = 'competitive';
    performanceColor = 'highlight';
    performanceEmoji = '⚡';
  }
  
  const trendIcon = stats.trend === 'improving' ? '📈' : 
                   stats.trend === 'declining' ? '📉' : '📊';

  // Smart endgame display
  let endgameDisplay = '';
  let endgameBadge = '';
  
  if (stats.climbStrategy === 'attempts') {
    endgameDisplay = `${stats.climbRate}%`;
    endgameBadge = '<span class="info-badge climb-focused">Climbs</span>';
  } else if (stats.climbStrategy === 'park_focused') {
    endgameDisplay = 'Parks';
    endgameBadge = '<span class="info-badge park-focused">Park Focused</span>';
  } else {
    endgameDisplay = 'None';
    endgameBadge = '<span class="info-badge no-endgame">No Strategy</span>';
  }

  const sortedMatches = [...teamData].sort((a, b) => a.match - b.match);
  
  // Generate smart summary
  const summary = generateSmartSummary(team, stats);
  
  container.innerHTML = `
    <div class="team-header">
      <div class="team-title">
        <h2>
          ${performanceEmoji} Team ${team}
          <span class="performance-badge badge-${performanceColor}">${performanceLevel.toUpperCase()}</span>
          <span class="trend-indicator" title="${stats.trend} performance">${trendIcon}</span>
          ${endgameBadge}
        </h2>
      </div>
      
      ${stats.partialMatches > 0 ? `
        <div class="warning-message">
          ⚠️ <strong>Reliability Alert:</strong> ${stats.partialMatches} shutdown${stats.partialMatches > 1 ? 's' : ''} in ${stats.totalMatches} matches (${((stats.partialMatches / stats.totalMatches) * 100).toFixed(0)}% failure rate)
        </div>
      ` : ''}
    </div>
    
    <div class="team-overview">
      <div class="stat-card ${stats.avgScore >= 75 ? 'elite' : stats.avgScore >= 60 ? 'success' : stats.avgScore >= 45 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgScore}</div>
        <div class="stat-label">⭐ Average Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalMatches}</div>
        <div class="stat-label">🎮 Matches Played</div>
      </div>
      <div class="stat-card ${stats.avgAuto >= 30 ? 'elite' : stats.avgAuto >= 20 ? 'success' : stats.avgAuto >= 12 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgAuto}</div>
        <div class="stat-label">🏁 Avg Auto Score</div>
      </div>
      <div class="stat-card ${stats.avgTeleop >= 60 ? 'elite' : stats.avgTeleop >= 45 ? 'success' : stats.avgTeleop >= 30 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgTeleop}</div>
        <div class="stat-label">🎯 Avg Teleop Score</div>
      </div>
      <div class="stat-card ${stats.climbStrategy === 'attempts' ? (stats.climbRate >= 75 ? 'elite' : stats.climbRate >= 50 ? 'success' : 'highlight') : ''}">
        <div class="stat-value">${endgameDisplay}</div>
        <div class="stat-label">🏔️ Endgame ${stats.climbStrategy === 'attempts' ? 'Success' : 'Strategy'}</div>
      </div>
      <div class="stat-card ${stats.consistency < 8 ? 'elite' : stats.consistency < 15 ? 'success' : stats.consistency < 25 ? 'highlight' : 'warning'}">
        <div class="stat-value">±${stats.consistency}</div>
        <div class="stat-label">📊 Consistency</div>
      </div>
    </div>
    
    <div class="charts-section">
      <div class="chart-container">
        <h3 class="chart-title">📈 Performance Over Time</h3>
        <canvas id="performance-chart" width="400" height="200"></canvas>
      </div>
      <div class="chart-container">
        <h3 class="chart-title">🎯 Scoring Breakdown</h3>
        <canvas id="scoring-chart" width="400" height="200"></canvas>
      </div>
      <div class="chart-container">
        <h3 class="chart-title">🏁 Endgame Distribution</h3>
        <canvas id="endgame-chart" width="400" height="200"></canvas>
      </div>
    </div>
    
    <div class="detail-sections">
      <div class="section-card">
        <h3 class="section-title">📊 Performance Metrics</h3>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">🏆 Peak Score</span>
            <span class="breakdown-value">${stats.maxScore}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">📉 Lowest Score</span>
            <span class="breakdown-value">${stats.minScore}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">📈 Trend</span>
            <span class="breakdown-value trend-${stats.trend}">${stats.trend.toUpperCase()}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">🛡️ Defense</span>
            <span class="breakdown-value">${stats.avgDefense}/5</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">⚔️ Offense</span>
            <span class="breakdown-value">${stats.avgOffense}/5</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">✅ Reliability</span>
            <span class="breakdown-value">${((1 - stats.partialMatches / stats.totalMatches) * 100).toFixed(0)}%</span>
          </div>
        </div>
        
        <h4 style="margin-top: 28px; margin-bottom: 16px; color: #1e293b; font-weight: 800; font-size: 16px;">🎯 Scoring Locations (Avg/Match)</h4>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">L1 (Ground)</span>
            <span class="breakdown-value">${stats.avgL1}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">L2</span>
            <span class="breakdown-value">${stats.avgL2}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">L3</span>
            <span class="breakdown-value">${stats.avgL3}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">L4</span>
            <span class="breakdown-value">${stats.avgL4}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Processor</span>
            <span class="breakdown-value">${stats.avgProcessor}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Barge/Net</span>
            <span class="breakdown-value">${stats.avgBarge}</span>
          </div>
        </div>
        
        ${stats.avgDropped > 0 ? `
          <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; border: 2px solid #fbbf24;">
            <strong style="color: #92400e;">⚠️ Dropped Pieces:</strong> 
            <span style="color: #92400e; font-weight: 600;">${stats.avgDropped} per match</span>
            <span style="color: #b45309; font-size: 13px;"> (${stats.totalDropped} total across ${stats.totalMatches} matches)</span>
          </div>
        ` : ''}
      </div>
      
      <div class="section-card">
        <h3 class="section-title">📋 Match History</h3>
        <div class="match-list">
          ${sortedMatches.map(match => {
            let endgameText = '⚪ None';
            if (match.endgame.action === 'climb') {
              if (match.endgame.climbSuccessful) {
                endgameText = match.endgame.climbDepth === 'deep' ? '🏔️ Deep Climb' : '⛰️ Shallow Climb';
              } else if (match.endgame.climbParked) {
                endgameText = '🔶 Failed + Park';
              } else {
                endgameText = '❌ Failed Climb';
              }
            } else if (match.endgame.action === 'park') {
              endgameText = '🚗 Park';
            }
            
            return `
              <div class="match-item">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span class="match-number">Match ${match.match}</span>
                  ${match.partialMatch ? '<span class="badge-shutdown">SHUTDOWN</span>' : ''}
                </div>
                <div class="match-details">
                  <span><strong>Auto:</strong> ${match.auto.score}</span>
                  <span><strong>Teleop:</strong> ${match.teleop.score}</span>
                  <span>${endgameText}</span>
                  <span class="match-score">${match.totalScore}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
    
    <div class="alliance-summary">
      ${summary}
    </div>
  `;

  setTimeout(() => {
    createPerformanceChart(sortedMatches);
    createScoringChart(stats);
    createEndgameChart(teamData, stats);
  }, 100);
}

function generateSmartSummary(team, stats) {
  let summary = `<h4>🤝 Alliance Selection Summary</h4><p style="color: #0c4a6e; line-height: 1.9; font-size: 16px;">`;
  
  // Performance intro
  if (stats.avgScore >= 90) {
    summary += `<strong>Team ${team}</strong> is a <strong>world-class competitor</strong>, averaging an exceptional <strong>${stats.avgScore} points</strong> per match. `;
  } else if (stats.avgScore >= 75) {
    summary += `<strong>Team ${team}</strong> is an <strong>elite performer</strong>, consistently scoring <strong>${stats.avgScore} points</strong> per match. `;
  } else if (stats.avgScore >= 60) {
    summary += `<strong>Team ${team}</strong> is a <strong>strong competitor</strong>, averaging <strong>${stats.avgScore} points</strong> per match. `;
  } else if (stats.avgScore >= 45) {
    summary += `<strong>Team ${team}</strong> is a <strong>competitive robot</strong>, scoring an average of <strong>${stats.avgScore} points</strong>. `;
  } else {
    summary += `<strong>Team ${team}</strong> is a <strong>developing team</strong>, averaging <strong>${stats.avgScore} points</strong> per match. `;
  }
  
  // Consistency
  if (stats.consistency < 8) {
    summary += `Their performance is <strong>exceptionally consistent</strong> (σ = ${stats.consistency}). `;
  } else if (stats.consistency < 15) {
    summary += `They show <strong>good consistency</strong> (σ = ${stats.consistency}). `;
  } else if (stats.consistency < 25) {
    summary += `Their performance varies moderately (σ = ${stats.consistency}). `;
  } else {
    summary += `⚠️ Their scores are <strong>highly variable</strong> (σ = ${stats.consistency}). `;
  }
  
  // Trend
  if (stats.trend === 'improving') {
    summary += `<strong style="color: #10b981;">📈 They're improving</strong> throughout the competition. `;
  } else if (stats.trend === 'declining') {
    summary += `<strong style="color: #ef4444;">📉 Performance is declining</strong> over time. `;
  } else {
    summary += `They maintain <strong>stable performance</strong>. `;
  }
  
  // Auto capability
  if (stats.avgAuto >= 30) {
    summary += `<strong>Exceptional autonomous</strong> (${stats.avgAuto} pts avg). `;
  } else if (stats.avgAuto >= 20) {
    summary += `<strong>Strong auto capability</strong> (${stats.avgAuto} pts avg). `;
  } else if (stats.avgAuto >= 12) {
    summary += `Moderate auto performance (${stats.avgAuto} pts avg). `;
  } else {
    summary += `Limited auto capability (${stats.avgAuto} pts avg). `;
  }
  
  // Endgame analysis
  if (stats.climbStrategy === 'attempts') {
    if (stats.climbRate >= 80) {
      summary += `<strong>🏔️ Elite climbing</strong> with ${stats.climbRate}% success rate. `;
    } else if (stats.climbRate >= 60) {
      summary += `<strong>Reliable climbing</strong> (${stats.climbRate}% success). `;
    } else if (stats.climbRate >= 40) {
      summary += `Moderate climbing success (${stats.climbRate}%). `;
    } else {
      summary += `⚠️ Struggles with climbing (${stats.climbRate}% success). `;
    }
  } else if (stats.climbStrategy === 'park_focused') {
    summary += `<strong>Focuses on parking</strong> rather than climbing. `;
  } else {
    summary += `⚠️ <strong>No endgame strategy</strong> observed. `;
  }
  
  // Offensive/defensive role
  if (stats.avgOffense >= 4) {
    summary += `<strong>Dominant offensive threat</strong> (${stats.avgOffense}/5 rating). `;
  } else if (stats.avgOffense >= 3) {
    summary += `Solid offensive capabilities (${stats.avgOffense}/5). `;
  } else if (stats.avgDefense >= 3) {
    summary += `<strong>Defense-oriented</strong> playstyle (Defense: ${stats.avgDefense}/5). `;
  } else {
    summary += `Balanced playstyle. `;
  }
  
  // Reliability
  if (stats.partialMatches === 0) {
    summary += `<strong style="color: #10b981;">✅ Perfect reliability</strong> - no shutdowns.`;
  } else if (stats.partialMatches / stats.totalMatches <= 0.1) {
    summary += `<strong style="color: #10b981;">✅ Highly reliable</strong> with minimal shutdowns.`;
  } else if (stats.partialMatches / stats.totalMatches <= 0.25) {
    summary += `<strong style="color: #f59e0b;">⚠️ Moderate reliability concern</strong> - ${stats.partialMatches} shutdown${stats.partialMatches > 1 ? 's' : ''}.`;
  } else {
    summary += `<strong style="color: #ef4444;">🚨 Serious reliability issues</strong> - ${stats.partialMatches} shutdowns in ${stats.totalMatches} matches.`;
  }
  
  summary += `</p>`;
  return summary;
}

function createPerformanceChart(matches) {
  const ctx = document.getElementById('performance-chart')?.getContext('2d');
  if (!ctx) return;
  
  if (performanceChart) {
    performanceChart.destroy();
  }
  
  const labels = matches.map(m => `M${m.match}`);
  const scores = matches.map(m => m.totalScore);
  const movingAvg = matches.map((m, i) => {
    const start = Math.max(0, i - 2);
    const subset = matches.slice(start, i + 1);
    return subset.reduce((sum, match) => sum + match.totalScore, 0) / subset.length;
  });
  
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Score',
        data: scores,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }, {
        label: '3-Match Rolling Avg',
        data: movingAvg,
        borderColor: '#f59e0b',
        borderDash: [8, 4],
        fill: false,
        pointRadius: 0,
        borderWidth: 3
      }, {
        label: 'Overall Average',
        data: Array(matches.length).fill(avgScore),
        borderColor: '#10b981',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 13,
              weight: '600'
            },
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          cornerRadius: 8
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 12,
              weight: '600'
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 12,
              weight: '600'
            }
          }
        }
      }
    }
  });
}

function createScoringChart(stats) {
  const ctx = document.getElementById('scoring-chart')?.getContext('2d');
  if (!ctx) return;
  
  if (scoringChart) {
    scoringChart.destroy();
  }
  
  scoringChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['L1\n(Ground)', 'L2', 'L3', 'L4', 'Processor', 'Net/Barge'],
      datasets: [{
        label: 'Avg Pieces per Match',
        data: [
          stats.avgL1, 
          stats.avgL2, 
          stats.avgL3, 
          stats.avgL4, 
          stats.avgProcessor, 
          stats.avgBarge
        ],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',   // L1 - Green
          'rgba(52, 211, 153, 0.8)',   // L2 - Light Green
          'rgba(110, 231, 183, 0.8)',  // L3 - Lighter Green
          'rgba(167, 243, 208, 0.8)',  // L4 - Lightest Green
          'rgba(245, 158, 11, 0.8)',   // Processor - Orange
          'rgba(251, 191, 36, 0.8)'    // Barge - Yellow
        ],
        borderColor: [
          '#10b981',
          '#34d399',
          '#6ee7b7',
          '#a7f3d0',
          '#f59e0b',
          '#fbbf24'
        ],
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              return `Avg: ${context.parsed.y.toFixed(1)} pieces/match`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 12,
              weight: '600'
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11,
              weight: '600'
            }
          }
        }
      }
    }
  });
}

function createEndgameChart(teamData, stats) {
  const ctx = document.getElementById('endgame-chart')?.getContext('2d');
  if (!ctx) return;
  
  if (endgameChart) {
    endgameChart.destroy();
  }
  
  const successfulClimbs = stats.successfulClimbs;
  const failedClimbsWithPark = stats.failedClimbsWithPark;
  const failedClimbsNoPark = stats.climbAttempts - successfulClimbs - failedClimbsWithPark;
  const directParks = stats.parkOnly;
  const noEndgame = stats.noEndgame;
  
  const chartData = [];
  const chartLabels = [];
  const chartColors = [];
  
  if (successfulClimbs > 0) {
    chartData.push(successfulClimbs);
    chartLabels.push('Successful Climbs');
    chartColors.push('#10b981');
  }
  
  if (failedClimbsWithPark > 0) {
    chartData.push(failedClimbsWithPark);
    chartLabels.push('Failed + Park');
    chartColors.push('#f59e0b');
  }
  
  if (failedClimbsNoPark > 0) {
    chartData.push(failedClimbsNoPark);
    chartLabels.push('Failed Climbs');
    chartColors.push('#ef4444');
  }
  
  if (directParks > 0) {
    chartData.push(directParks);
    chartLabels.push('Direct Parks');
    chartColors.push('#3b82f6');
  }
  
  if (noEndgame > 0) {
    chartData.push(noEndgame);
    chartLabels.push('No Endgame');
    chartColors.push('#6b7280');
  }
  
  // Fallback if no data
  if (chartData.length === 0) {
    chartData.push(1);
    chartLabels.push('No Data');
    chartColors.push('#94a3b8');
  }
  
  endgameChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 15
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: {
              size: 13,
              weight: '600'
            },
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} matches (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function showError(message) {
  const container = document.getElementById('analysis-container');
  container.innerHTML = `
    <div class="error-message">
      <strong>Error:</strong> ${message}
    </div>
  `;
}