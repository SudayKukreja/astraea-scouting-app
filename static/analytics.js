// analytics-simple.js
let analyticsData = [];
let currentFilters = {
  event: '',
  team: '',
  hidePartial: false
};

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
    const response = await fetch('/api/admin/analytics/data');
    if (!response.ok) throw new Error('Failed to fetch analytics data');
    
    analyticsData = await response.json();
    
    if (analyticsData.error) {
      throw new Error(analyticsData.error);
    }
    
    populateFilters();
  } catch (error) {
    console.error('Error loading analytics data:', error);
    showError('Failed to load data: ' + error.message);
  }
}

function populateFilters() {
  // Populate events
  const events = [...new Set(analyticsData.map(d => d.event))];
  const eventSelect = document.getElementById('event-filter');
  eventSelect.innerHTML = '<option value="">All Events</option>';
  events.forEach(event => {
    eventSelect.innerHTML += `<option value="${event}">${event}</option>`;
  });
  
  updateTeamsList();
}

function updateTeamsList() {
  const eventFilter = document.getElementById('event-filter').value;
  
  // Filter data by event if selected
  let filteredData = analyticsData;
  if (eventFilter) {
    filteredData = analyticsData.filter(d => d.event === eventFilter);
  }
  
  // Get unique teams with match counts
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
  
  // Calculate all statistics
  const stats = calculateTeamStats(teamData);
  
  // Render the analysis
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
  
  // Auto stats
  const autoScores = teamData.map(d => d.auto.score);
  const avgAuto = (autoScores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  // Teleop stats
  const teleopScores = teamData.map(d => d.teleop.score);
  const avgTeleop = (teleopScores.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  // Offense/Defense ratings
  const offenseRatings = teamData.map(d => d.teleop.offenseRating || 0);
  const avgOffense = (offenseRatings.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  const defenseRatings = teamData.map(d => d.teleop.defenseRating || 0);
  const avgDefense = (defenseRatings.reduce((a, b) => a + b, 0) / totalMatches).toFixed(1);
  
  // Climb analysis
  const climbAttempts = teamData.filter(d => d.endgame.action === 'climb').length;
  const successfulClimbs = teamData.filter(d => 
    d.endgame.action === 'climb' && d.endgame.climbSuccessful
  ).length;
  const failedClimbs = climbAttempts - successfulClimbs;
  const climbRate = climbAttempts > 0 ? 
    ((successfulClimbs / climbAttempts) * 100).toFixed(0) : 0;
  
  // Park analysis
  const parkCount = teamData.filter(d => d.endgame.action === 'park').length;
  const noEndgameCount = teamData.filter(d => 
    d.endgame.action === 'did not park/climb' || !d.endgame.action
  ).length;
  
  // Game piece breakdown
  let totalL1 = 0, totalL2 = 0, totalL3 = 0, totalL4 = 0;
  let totalProcessor = 0, totalBarge = 0;
  let totalDropped = 0;
  
  teamData.forEach(d => {
    // Auto pieces
    totalL1 += (d.auto.ll1 || 0);
    totalL2 += (d.auto.l2 || 0);
    totalL3 += (d.auto.l3 || 0);
    totalL4 += (d.auto.l4 || 0);
    totalProcessor += (d.auto.processor || 0);
    totalBarge += (d.auto.barge || 0);
    totalDropped += (d.auto.droppedPieces || 0);
    
    // Teleop pieces
    totalL1 += (d.teleop.ll1 || 0);
    totalL2 += (d.teleop.l2 || 0);
    totalL3 += (d.teleop.l3 || 0);
    totalL4 += (d.teleop.l4 || 0);
    totalProcessor += (d.teleop.processor || 0);
    totalBarge += (d.teleop.barge || 0);
    totalDropped += (d.teleop.droppedPieces || 0);
  });
  
  // Calculate consistency (standard deviation)
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
    failedClimbs,
    climbRate,
    parkCount,
    noEndgameCount,
    totalL1,
    totalL2,
    totalL3,
    totalL4,
    totalProcessor,
    totalBarge,
    totalDropped,
    avgL1: (totalL1 / totalMatches).toFixed(1),
    avgL2: (totalL2 / totalMatches).toFixed(1),
    avgL3: (totalL3 / totalMatches).toFixed(1),
    avgL4: (totalL4 / totalMatches).toFixed(1),
    avgProcessor: (totalProcessor / totalMatches).toFixed(1),
    avgBarge: (totalBarge / totalMatches).toFixed(1),
    avgDropped: (totalDropped / totalMatches).toFixed(1),
    consistency: stdDev
  };
}

function renderTeamAnalysis(team, teamData, stats) {
  const container = document.getElementById('analysis-container');
  
  // Determine performance level
  let performanceLevel = 'low';
  if (stats.avgScore >= 60) performanceLevel = 'high';
  else if (stats.avgScore >= 40) performanceLevel = 'medium';
  
  // Sort matches by number
  const sortedMatches = [...teamData].sort((a, b) => a.match - b.match);
  
  container.innerHTML = `
    <h2 style="margin-bottom: 24px; color: #1e293b;">
      Team ${team} Analysis
      <span class="performance-badge badge-${performanceLevel}">${performanceLevel.toUpperCase()} PERFORMER</span>
    </h2>
    
    ${stats.partialMatches > 0 ? `
      <div class="warning-message">
        ⚠️ This team had ${stats.partialMatches} shutdown${stats.partialMatches > 1 ? 's' : ''} out of ${stats.totalMatches} matches
      </div>
    ` : ''}
    
    <div class="team-overview">
      <div class="stat-card ${stats.avgScore >= 60 ? 'success' : stats.avgScore >= 40 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.avgScore}</div>
        <div class="stat-label">Average Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalMatches}</div>
        <div class="stat-label">Matches Played</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgAuto}</div>
        <div class="stat-label">Avg Auto Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgTeleop}</div>
        <div class="stat-label">Avg Teleop Score</div>
      </div>
      <div class="stat-card ${stats.climbRate >= 75 ? 'success' : stats.climbRate >= 50 ? 'highlight' : 'warning'}">
        <div class="stat-value">${stats.climbRate}%</div>
        <div class="stat-label">Climb Success Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgOffense}/5</div>
        <div class="stat-label">Offense Rating</div>
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
            <span class="breakdown-label">Consistency (σ)</span>
            <span class="breakdown-value">±${stats.consistency}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Defense Rating</span>
            <span class="breakdown-value">${stats.avgDefense}/5</span>
          </div>
        </div>
        
        <h4 style="margin-top: 24px; margin-bottom: 12px; color: #475569;">Endgame Breakdown</h4>
        <div class="quick-facts">
          <div class="fact-item">
            <div class="fact-value">${stats.successfulClimbs}</div>
            <div class="fact-label">Successful Climbs</div>
          </div>
          <div class="fact-item">
            <div class="fact-value">${stats.failedClimbs}</div>
            <div class="fact-label">Failed Climbs</div>
          </div>
          <div class="fact-item">
            <div class="fact-value">${stats.parkCount}</div>
            <div class="fact-label">Parks</div>
          </div>
          <div class="fact-item">
            <div class="fact-value">${stats.noEndgameCount}</div>
            <div class="fact-label">No Endgame</div>
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
            const endgameText = match.endgame.action === 'climb' ? 
              (match.endgame.climbSuccessful ? '✅ Climb' : '❌ Failed Climb') :
              match.endgame.action === 'park' ? '🚗 Park' : '⚪ None';
            
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
    
    <div style="margin-top: 24px; padding: 20px; background: #f1f5f9; border-radius: 12px;">
      <h4 style="margin-bottom: 12px; color: #1e293b;">Quick Alliance Selection Summary</h4>
      <p style="color: #475569; line-height: 1.6;">
        <strong>Team ${team}</strong> averages <strong>${stats.avgScore} points</strong> per match with 
        ${stats.consistency < 10 ? 'very consistent' : stats.consistency < 20 ? 'moderate' : 'inconsistent'} performance 
        (σ = ${stats.consistency}). 
        They ${stats.climbRate >= 50 ? `successfully climb ${stats.climbRate}% of the time` : 'struggle with climbing'} 
        and ${stats.avgOffense >= 3.5 ? 'have strong offensive capabilities' : stats.avgOffense >= 2.5 ? 'have moderate offensive capabilities' : 'focus more on defense'}.
        ${stats.partialMatches > 0 ? ` ⚠️ Reliability concern: ${stats.partialMatches} shutdown${stats.partialMatches > 1 ? 's' : ''}.` : ''}
      </p>
    </div>
  `;
}

function showError(message) {
  const container = document.getElementById('analysis-container');
  container.innerHTML = `
    <div class="error-message">
      <strong>Error:</strong> ${message}
    </div>
  `;
}