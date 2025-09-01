let analyticsData = [];
let currentFilters = {
  event: '',
  team: '',
  hidePartial: false
};

// Add Chart.js via CDN in your HTML template
let performanceChart = null;
let scoringChart = null;
let endgameChart = null;

document.addEventListener('DOMContentLoaded', () => {
  loadAnalyticsData();
  
  document.getElementById('event-filter').addEventListener('change', updateTeamsList);
  document.getElementById('hide-partial').addEventListener('change', () => {
    if (currentFilters.team) {
      analyzeTeam();
    }
  });
});

async function loadAnalyticsData() {
  try {
    console.log('Loading analytics data...');
    const response = await fetch('/api/admin/analytics/data');
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('API response not OK:', response.status, response.statusText);
      throw new Error('Failed to fetch analytics data');
    }
    
    analyticsData = await response.json();
    console.log('Data loaded, entries:', analyticsData.length);
    
    if (analyticsData.error) {
      console.error('API returned error:', analyticsData.error);
      throw new Error(analyticsData.error);
    }
    
    if (analyticsData.length > 0) {
      console.log('First entry:', analyticsData[0]);
    } else {
      console.warn('No analytics data returned from API');
    }
    
    populateFilters();
  } catch (error) {
    console.error('Error loading analytics data:', error);
    showError('Failed to load data: ' + error.message);
  }
}

function populateFilters() {
  const events = [...new Set(analyticsData.map(d => d.event))];

  if (events.length === 0) {
    events.push('current_event');
  }

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
  
  // Filter data
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
  
  // Scoring stats
  const scores = teamData.map(d => d.totalScore);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  
  // Trend calculation - compare recent vs earlier performance
  let trend = 'stable';
  if (totalMatches >= 4) {
    const recentMatches = teamData.slice(-Math.ceil(totalMatches / 2));
    const earlierMatches = teamData.slice(0, Math.floor(totalMatches / 2));
    
    const recentAvg = recentMatches.reduce((sum, d) => sum + d.totalScore, 0) / recentMatches.length;
    const earlierAvg = earlierMatches.reduce((sum, d) => sum + d.totalScore, 0) / earlierMatches.length;
    
    if (recentAvg > earlierAvg + 5) trend = 'improving';
    else if (earlierAvg > recentAvg + 5) trend = 'declining';
  }
  
  // Auto/Teleop stats
  const autoScores = teamData.map(d => d.auto.score);
  const avgAuto = (autoScores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  const teleopScores = teamData.map(d => d.teleop.score);
  const avgTeleop = (teleopScores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  // Offense/Defense ratings
  const offenseRatings = teamData.map(d => d.teleop.offenseRating || 0);
  const avgOffense = (offenseRatings.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  const defenseRatings = teamData.map(d => d.teleop.defenseRating || 0);
  const avgDefense = (defenseRatings.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  // Enhanced climb analysis
  const climbAttempts = teamData.filter(d => d.endgame.action === 'climb').length;
  const successfulClimbs = teamData.filter(d => 
    d.endgame.action === 'climb' && d.endgame.climbSuccessful
  ).length;
  const failedClimbsWithPark = teamData.filter(d => 
    d.endgame.action === 'climb' && !d.endgame.climbSuccessful && d.endgame.climbParked
  ).length;
  const climbRate = climbAttempts > 0 ? 
    ((successfulClimbs / climbAttempts) * 100).toFixed(0) : 0;
  
  // Game piece breakdown
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
  
  // Consistency (standard deviation)
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
    climbRate,
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
  
  // Determine performance level
  let performanceLevel = 'low';
  let performanceColor = 'warning';
  if (stats.avgScore >= 80) {
    performanceLevel = 'elite';
    performanceColor = 'success';
  } else if (stats.avgScore >= 60) {
    performanceLevel = 'high';
    performanceColor = 'success';
  } else if (stats.avgScore >= 40) {
    performanceLevel = 'medium';
    performanceColor = 'highlight';
  }
  
  // Trend indicator
  const trendIcon = stats.trend === 'improving' ? '📈' : 
                   stats.trend === 'declining' ? '📉' : '➡️';
  
  // Sort matches by number
  const sortedMatches = [...teamData].sort((a, b) => a.match - b.match);
  
  container.innerHTML = `
    <div class="team-header">
      <h2 style="margin-bottom: 24px; color: #1e293b; display: flex; align-items: center; gap: 12px;">
        🏆 Team ${team} Analysis
        <span class="performance-badge badge-${performanceColor}">${performanceLevel.toUpperCase()} PERFORMER</span>
        <span class="trend-indicator" title="${stats.trend} trend">${trendIcon}</span>
      </h2>
      
      ${stats.partialMatches > 0 ? `
        <div class="warning-message">
          ⚠️ This team had ${stats.partialMatches} shutdown${stats.partialMatches > 1 ? 's' : ''} out of ${stats.totalMatches} matches
        </div>
      ` : ''}
    </div>
    
    <div class="team-overview">
      <div class="stat-card ${stats.avgScore >= 80 ? 'elite' : stats.avgScore >= 60 ? 'success' : stats.avgScore >= 40 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgScore}</div>
        <div class="stat-label">Average Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalMatches}</div>
        <div class="stat-label">Matches Played</div>
      </div>
      <div class="stat-card ${stats.avgAuto >= 25 ? 'success' : stats.avgAuto >= 15 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgAuto}</div>
        <div class="stat-label">Avg Auto Score</div>
      </div>
      <div class="stat-card ${stats.avgTeleop >= 60 ? 'success' : stats.avgTeleop >= 40 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgTeleop}</div>
        <div class="stat-label">Avg Teleop Score</div>
      </div>
      <div class="stat-card ${stats.climbRate >= 75 ? 'success' : stats.climbRate >= 50 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.climbRate}%</div>
        <div class="stat-label">Climb Success Rate</div>
      </div>
      <div class="stat-card ${stats.consistency < 10 ? 'success' : stats.consistency < 20 ? 'highlight' : 'warning'}">
        <div class="stat-value">±${stats.consistency}</div>
        <div class="stat-label">Consistency</div>
      </div>
    </div>
    
    <div class="charts-section">
      <div class="chart-container">
        <h3 class="chart-title">📈 Performance Trend</h3>
        <canvas id="performance-chart" width="400" height="200"></canvas>
      </div>
      <div class="chart-container">
        <h3 class="chart-title">🎯 Scoring Breakdown (Avg per Match)</h3>
        <canvas id="scoring-chart" width="400" height="200"></canvas>
      </div>
      <div class="chart-container">
        <h3 class="chart-title">🏁 Endgame Actions</h3>
        <canvas id="endgame-chart" width="400" height="200"></canvas>
      </div>
    </div>
    
    <div class="detail-sections">
      <div class="section-card">
        <h3 class="section-title">🎯 Key Statistics</h3>
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-label">Best Score</span>
            <span class="breakdown-value">${stats.maxScore}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Worst Score</span>
            <span class="breakdown-value">${stats.minScore}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Performance Trend</span>
            <span class="breakdown-value trend-${stats.trend}">${stats.trend.toUpperCase()}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Defense Rating</span>
            <span class="breakdown-value">${stats.avgDefense}/5</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Offense Rating</span>
            <span class="breakdown-value">${stats.avgOffense}/5</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Reliability</span>
            <span class="breakdown-value">${((1 - stats.partialMatches / stats.totalMatches) * 100).toFixed(0)}%</span>
          </div>
        </div>
        
        <h4 style="margin-top: 24px; margin-bottom: 12px; color: #475569;">Scoring Locations (Avg/Match)</h4>
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
            <span class="breakdown-label">Barge</span>
            <span class="breakdown-value">${stats.avgBarge}</span>
          </div>
        </div>
        
        ${stats.avgDropped > 0 ? `
          <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 8px;">
            <strong>⚠️ Dropped Pieces:</strong> ${stats.avgDropped} per match (${stats.totalDropped} total)
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
                endgameText = '✅ Climb';
              } else if (match.endgame.climbParked) {
                endgameText = '🔶 Failed Climb + Park';
              } else {
                endgameText = '❌ Failed Climb';
              }
            } else if (match.endgame.action === 'park') {
              endgameText = '🚗 Park';
            }
            
            return `
              <div class="match-item">
                <div>
                  <span class="match-number">Match ${match.match}</span>
                  ${match.partialMatch ? '<span class="badge-shutdown">SHUTDOWN</span>' : ''}
                </div>
                <div class="match-details">
                  <span>Auto: ${match.auto.score}</span>
                  <span>Teleop: ${match.teleop.score}</span>
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
      <h4 style="margin-bottom: 12px; color: #1e293b;">🤝 Quick Alliance Selection Summary</h4>
      <p style="color: #475569; line-height: 1.6;">
        <strong>Team ${team}</strong> averages <strong>${stats.avgScore} points</strong> per match with 
        ${stats.consistency < 10 ? 'very consistent' : stats.consistency < 20 ? 'moderate' : 'inconsistent'} performance 
        (σ = ${stats.consistency}). 
        They show a <strong>${stats.trend}</strong> trend and 
        ${stats.climbRate >= 50 ? `successfully climb ${stats.climbRate}% of the time` : 'struggle with climbing'}. 
        ${stats.avgOffense >= 3.5 ? 'Strong offensive capabilities' : stats.avgOffense >= 2.5 ? 'Moderate offensive capabilities' : 'Defensive focus'}.
        ${stats.partialMatches > 0 ? ` ⚠️ Reliability concern: ${stats.partialMatches} shutdown${stats.partialMatches > 1 ? 's' : ''}.` : ' ✅ No reliability concerns.'}
      </p>
    </div>
  `;
  
  // Create charts after DOM is rendered
  setTimeout(() => {
    createPerformanceChart(sortedMatches);
    createScoringChart(stats);
    createEndgameChart(teamData);
  }, 100);
}

function createPerformanceChart(matches) {
  const ctx = document.getElementById('performance-chart')?.getContext('2d');
  if (!ctx) return;
  
  if (performanceChart) {
    performanceChart.destroy();
  }
  
  const labels = matches.map(m => `Match ${m.match}`);
  const scores = matches.map(m => m.totalScore);
  const movingAvg = matches.map((m, i) => {
    const start = Math.max(0, i - 2);
    const subset = matches.slice(start, i + 1);
    return subset.reduce((sum, match) => sum + match.totalScore, 0) / subset.length;
  });
  
  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Score',
        data: scores,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.1,
        fill: true
      }, {
        label: '3-Match Average',
        data: movingAvg,
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        fill: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true
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
      labels: ['L1', 'L2', 'L3', 'L4', 'Processor', 'Barge'],
      datasets: [{
        label: 'Avg per Match',
        data: [stats.avgL1, stats.avgL2, stats.avgL3, stats.avgL4, stats.avgProcessor, stats.avgBarge],
        backgroundColor: [
          '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#fbbf24'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function createEndgameChart(teamData) {
  const ctx = document.getElementById('endgame-chart')?.getContext('2d');
  if (!ctx) return;
  
  if (endgameChart) {
    endgameChart.destroy();
  }
  
  const successfulClimbs = teamData.filter(d => d.endgame.action === 'climb' && d.endgame.climbSuccessful).length;
  const failedClimbs = teamData.filter(d => d.endgame.action === 'climb' && !d.endgame.climbSuccessful).length;
  const parks = teamData.filter(d => d.endgame.action === 'park').length;
  const noEndgame = teamData.filter(d => d.endgame.action === 'did not park/climb' || !d.endgame.action).length;
  
  endgameChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Successful Climbs', 'Failed Climbs', 'Parks', 'No Endgame'],
      datasets: [{
        data: [successfulClimbs, failedClimbs, parks, noEndgame],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#6b7280']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
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