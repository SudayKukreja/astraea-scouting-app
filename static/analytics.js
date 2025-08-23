let analyticsData = [];
let currentFilters = {
  event: '',
  team: '',
  matchMin: null,
  matchMax: null,
  hidePartial: false
};

async function generateGeminiInsight(team) {
  if (!team) {
    alert('Please select a team first');
    return;
  }

  // Show enhanced loading state
  const container = document.getElementById('team-insights-container');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-loading';
  loadingDiv.innerHTML = `
    <div class="ai-loading-content">
      <div class="loading-spinner"></div>
      <h4>🤖 Analyzing Team ${team}</h4>
      <p>Generating alliance selection insights...</p>
      <div class="loading-progress">
        <div class="progress-bar"></div>
      </div>
    </div>
  `;
  container.prepend(loadingDiv);

  // Disable button
  const generateButton = document.querySelector('button[onclick*="generateGeminiInsight"]');
  if (generateButton) {
    generateButton.disabled = true;
    generateButton.innerHTML = '🔄 Analyzing...';
    generateButton.classList.add('loading');
  }

  try {
    const teamData = analyticsData.filter(d => String(d.team) === String(team));
    
    if (teamData.length === 0) {
      throw new Error(`No match data found for Team ${team} with current filters`);
    }

    const response = await fetch('/api/admin/gemini-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: team, matches: teamData })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.insight) {
      throw new Error('No insight generated');
    }

    // Remove loading
    if (loadingDiv.parentNode) {
      loadingDiv.remove();
    }

    // Create enhanced AI insight card
    const insightDiv = document.createElement('div');
    insightDiv.className = 'ai-insight-card enhanced';
    insightDiv.innerHTML = createEnhancedInsightHTML(data);
    
    container.prepend(insightDiv);
    insightDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (error) {
    console.error('AI insight generation failed:', error);
    
    if (loadingDiv.parentNode) {
      loadingDiv.remove();
    }
    
    showEnhancedError(container, error.message);
    
  } finally {
    // Re-enable button
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.innerHTML = '🔮 Generate AI Insight';
      generateButton.classList.remove('loading');
    }
  }
}

function createEnhancedInsightHTML(data) {
  const formattedInsight = formatEnhancedAIInsight(data.insight);
  const stats = data.team_stats || {};
  
  return `
    <div class="ai-insight-header">
      <div class="header-left">
        <h4>🤖 Team ${data.team} Alliance Analysis</h4>
        <div class="team-quick-stats">
          <span class="quick-stat">📊 ${data.matches_analyzed} matches</span>
          <span class="quick-stat">⚡ ${stats.avg_total_score ? stats.avg_total_score.toFixed(1) : 'N/A'} avg</span>
          <span class="quick-stat">🎯 ${stats.consistency_rating || 'Unknown'}</span>
        </div>
      </div>
      <button class="remove-insight-btn" onclick="this.closest('.ai-insight-card').remove()">✕</button>
    </div>
    
    <div class="ai-insight-body">
      ${formattedInsight}
    </div>
    
    <div class="ai-insight-footer">
      <div class="analysis-meta">
        <span>⏰ ${new Date(data.generated_at).toLocaleTimeString()}</span>
        <span>🎯 Alliance Selection Focus</span>
      </div>
    </div>
  `;
}

function formatEnhancedAIInsight(insightText) {
  let formatted = insightText;
  
  // Replace markdown-style headers with styled HTML
  formatted = formatted.replace(/## ALLIANCE VALUE: (HIGH|MEDIUM|LOW)/gi, (match, value) => {
    const colorClass = value.toLowerCase() === 'high' ? 'value-high' : 
                       value.toLowerCase() === 'medium' ? 'value-medium' : 'value-low';
    return `<div class="alliance-value ${colorClass}">
      <span class="value-label">ALLIANCE VALUE</span>
      <span class="value-rating">${value}</span>
    </div>`;
  });

  // Format sections with enhanced styling
  formatted = formatted.replace(/### (STRENGTHS|WEAKNESSES|ALLIANCE SELECTION NOTES|RELIABILITY SCORE):/g, 
    '<div class="insight-section"><h5 class="section-title">$1</h5>');
  
  // Close sections
  formatted = formatted.replace(/### /g, '</div><div class="insight-section"><h5 class="section-title">');
  formatted += '</div>'; // Close the last section

  // Format bullet points with icons
  formatted = formatted.replace(/• (.*?)(\n|$)/g, '<div class="insight-bullet">✓ $1</div>');
  
  // Format bold text in bullets and regular text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Format the quick summary
  formatted = formatted.replace(/\*\*Quick Summary:\*\* (.*?)(\n|<)/g, 
    '<div class="quick-summary">$1</div>$2');

  // Format reliability score specially
  formatted = formatted.replace(/RELIABILITY SCORE: (EXCELLENT|GOOD|CONCERNING)/gi, (match, score) => {
    const colorClass = score.toLowerCase() === 'excellent' ? 'reliability-excellent' : 
                       score.toLowerCase() === 'good' ? 'reliability-good' : 'reliability-concerning';
    return `<div class="reliability-score ${colorClass}">
      <span class="reliability-label">RELIABILITY</span>
      <span class="reliability-rating">${score}</span>
    </div>`;
  });

  // Clean up extra divs and formatting
  formatted = formatted.replace(/<div class="insight-section"><h5 class="section-title"><\/h5>/g, '');
  
  return formatted;
}

function showEnhancedError(container, message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'ai-error enhanced';
  errorDiv.innerHTML = `
    <div class="error-content">
      <div class="error-icon">❌</div>
      <div class="error-text">
        <h4>AI Analysis Failed</h4>
        <p>${message}</p>
      </div>
      <button onclick="this.closest('.ai-error').remove()" class="error-dismiss">Dismiss</button>
    </div>
  `;
  container.prepend(errorDiv);
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 8000);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    switch(tabId) {
      case 'teams': renderTeamAnalysis(); break;
      case 'matches': renderMatchDetails(); break;
      case 'insights': renderTeamInsights(); break;
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  ['event-filter', 'team-filter', 'match-min', 'match-max', 'hide-partial-filter'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.addEventListener('change', applyFilters);
  });
  loadAnalyticsData();
});

async function loadAnalyticsData() {
  try {
    const response = await fetch('/api/admin/analytics/data');
    if (!response.ok) throw new Error('Failed to fetch analytics data');
    analyticsData = await response.json();
    if (analyticsData.error) throw new Error(analyticsData.error);
    updateFilters();
    renderOverview();
    renderTeamAnalysis();
    renderMatchDetails();
    renderTeamInsights();
  } catch (error) {
    console.error('Error loading analytics data:', error);
    showError('Error loading analytics data: ' + error.message);
  }
}

function applyFilters() {
  currentFilters.event = document.getElementById('event-filter').value;
  currentFilters.team = document.getElementById('team-filter').value;
  currentFilters.matchMin = document.getElementById('match-min').value ? parseInt(document.getElementById('match-min').value) : null;
  currentFilters.matchMax = document.getElementById('match-max').value ? parseInt(document.getElementById('match-max').value) : null;
  currentFilters.hidePartial = document.getElementById('hide-partial-filter')?.checked || false;
  renderOverview();
  renderTeamAnalysis();
  renderMatchDetails();
  renderTeamInsights();
}

function getFilteredData() {
  return analyticsData.filter(entry => {
    if (currentFilters.event && entry.event !== currentFilters.event) return false;
    if (currentFilters.team && entry.team !== currentFilters.team) return false;
    if (currentFilters.matchMin && entry.match < currentFilters.matchMin) return false;
    if (currentFilters.matchMax && entry.match > currentFilters.matchMax) return false;
    if (currentFilters.hidePartial && entry.partialMatch) return false;
    return true;
  });
}

function updateFilters() {
  const events = [...new Set(analyticsData.map(d => d.event))];
  const teamsWithCounts = analyticsData.reduce((acc, d) => {
    acc[d.team] = (acc[d.team] || 0) + 1;
    return acc;
  }, {});
  const teams = Object.keys(teamsWithCounts).filter(team => teamsWithCounts[team] >= 1).sort((a, b) => parseInt(a) - parseInt(b));
  const eventSelect = document.getElementById('event-filter');
  eventSelect.innerHTML = '<option value="">All Events</option>';
  events.forEach(event => { eventSelect.innerHTML += `<option value="${event}">${event}</option>`; });
  
  // Update all team selectors
  ['team-filter', 'compare-team1', 'compare-team2', 'ai-team-select'].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
      const currentValue = select.value;
      select.innerHTML = '<option value="">Select Team</option>';
      teams.forEach(team => { select.innerHTML += `<option value="${team}">Team ${team}</option>`; });
      select.value = currentValue;
    }
  });
}

function renderNoDataMessage(container, message = 'No data available') {
  container.innerHTML = `<div class="no-data">${message}</div>`;
}

function renderOverview() {
  const data = getFilteredData();
  
  // Calculate statistics
  const totalReports = data.length;
  const uniqueTeams = new Set(data.map(d => d.team)).size;
  const avgAutoScore = data.length > 0 ? (data.reduce((sum, d) => sum + d.auto.score, 0) / data.length).toFixed(1) : 0;
  const avgTeleopScore = data.length > 0 ? (data.reduce((sum, d) => sum + d.teleop.score, 0) / data.length).toFixed(1) : 0;
  const avgOffenseRating = data.length > 0 ? (data.reduce((sum, d) => sum + (d.teleop.offenseRating || 0), 0) / data.length).toFixed(1) : 0;
  
  const climbAttempts = data.filter(d => d.endgame.action === 'climb');
  const successfulClimbs = climbAttempts.filter(d => d.endgame.climbSuccessful);
  const climbSuccessRate = climbAttempts.length > 0 ? ((successfulClimbs.length / climbAttempts.length) * 100).toFixed(1) + '%' : '0%';

  // Update overview stats
  document.getElementById('total-reports').textContent = totalReports;
  document.getElementById('total-teams').textContent = uniqueTeams;
  document.getElementById('avg-auto-score').textContent = avgAutoScore;
  document.getElementById('avg-teleop-score').textContent = avgTeleopScore;
  document.getElementById('climb-success-rate').textContent = climbSuccessRate;
  document.getElementById('avg-offense-rating').textContent = avgOffenseRating;

  // Render charts
  renderScoringChart(data);
  renderTopTeams(data);
}

function renderScoringChart(data) {
  const canvas = document.getElementById('scoring-chart');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (data.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Create score ranges
  const ranges = [
    { min: 0, max: 20, label: '0-20', color: '#ef4444' },
    { min: 21, max: 40, label: '21-40', color: '#f97316' },
    { min: 41, max: 60, label: '41-60', color: '#eab308' },
    { min: 61, max: 80, label: '61-80', color: '#22c55e' },
    { min: 81, max: 1000, label: '81+', color: '#3b82f6' }
  ];

  const counts = ranges.map(range => 
    data.filter(d => d.totalScore >= range.min && d.totalScore <= range.max).length
  );

  const maxCount = Math.max(...counts) || 1;
  const barWidth = (canvas.width - 80) / ranges.length - 10;
  const maxBarHeight = canvas.height - 60;

  ranges.forEach((range, i) => {
    const barHeight = (counts[i] / maxCount) * maxBarHeight;
    const x = 40 + i * (barWidth + 10);
    const y = canvas.height - barHeight - 30;

    // Draw bar
    ctx.fillStyle = range.color;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw count on top of bar
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(counts[i], x + barWidth / 2, y - 5);

    // Draw label at bottom
    ctx.fillText(range.label, x + barWidth / 2, canvas.height - 10);
  });
}

function renderTopTeams(data) {
  // Calculate average scores per team
  const teamStats = {};
  data.forEach(entry => {
    if (!teamStats[entry.team]) {
      teamStats[entry.team] = {
        totalScore: 0,
        matchCount: 0,
        autoScore: 0,
        teleopScore: 0,
        offenseRating: 0
      };
    }
    
    teamStats[entry.team].totalScore += entry.totalScore;
    teamStats[entry.team].autoScore += entry.auto.score;
    teamStats[entry.team].teleopScore += entry.teleop.score;
    teamStats[entry.team].offenseRating += entry.teleop.offenseRating || 0;
    teamStats[entry.team].matchCount++;
  });

  // Calculate averages and sort
  const teamAverages = Object.keys(teamStats).map(team => ({
    team,
    avgTotal: (teamStats[team].totalScore / teamStats[team].matchCount).toFixed(1),
    avgAuto: (teamStats[team].autoScore / teamStats[team].matchCount).toFixed(1),
    avgTeleop: (teamStats[team].teleopScore / teamStats[team].matchCount).toFixed(1),
    avgOffense: (teamStats[team].offenseRating / teamStats[team].matchCount).toFixed(1),
    matchCount: teamStats[team].matchCount
  })).sort((a, b) => parseFloat(b.avgTotal) - parseFloat(a.avgTotal)).slice(0, 10);

  // Render top teams
  const container = document.getElementById('top-teams-chart');
  if (teamAverages.length === 0) {
    container.innerHTML = '<p class="loading">No team data available</p>';
    return;
  }

  container.innerHTML = teamAverages.map(team => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin: 8px 0; background: #f9fafb; border-radius: 8px;">
      <div>
        <strong style="color: #1e3a8a;">Team ${team.team}</strong>
        <span style="color: #6b7280; margin-left: 12px;">${team.matchCount} matches</span>
      </div>
      <div style="display: flex; gap: 16px; align-items: center;">
        <span style="font-weight: 600; color: #059669;">Avg: ${team.avgTotal}</span>
        <span style="color: #6b7280; font-size: 0.9rem;">Auto: ${team.avgAuto} | Teleop: ${team.avgTeleop}</span>
      </div>
    </div>
  `).join('');
}

function renderTeamAnalysis() {
  const data = getFilteredData();
  const container = document.getElementById('team-analysis-container');

  if (data.length === 0) {
    container.innerHTML = '<p class="loading">No data available for current filters</p>';
    return;
  }

  // Group by team
  const teamData = {};
  data.forEach(entry => {
    if (!teamData[entry.team]) {
      teamData[entry.team] = [];
    }
    teamData[entry.team].push(entry);
  });

  const teams = Object.keys(teamData).sort((a, b) => parseInt(a) - parseInt(b));

  container.innerHTML = `
    <div class="teams-grid">
      ${teams.map(team => {
        const matches = teamData[team];
        const avgTotal = (matches.reduce((sum, m) => sum + m.totalScore, 0) / matches.length).toFixed(1);
        const avgAuto = (matches.reduce((sum, m) => sum + m.auto.score, 0) / matches.length).toFixed(1);
        const avgTeleop = (matches.reduce((sum, m) => sum + m.teleop.score, 0) / matches.length).toFixed(1);
        const avgOffense = (matches.reduce((sum, m) => sum + (m.teleop.offenseRating || 0), 0) / matches.length).toFixed(1);
        const avgDefense = (matches.reduce((sum, m) => sum + (m.teleop.defenseRating || 0), 0) / matches.length).toFixed(1);
        const climbAttempts = matches.filter(m => m.endgame.action === 'climb').length;
        const successfulClimbs = matches.filter(m => m.endgame.action === 'climb' && m.endgame.climbSuccessful).length;
        const climbRate = climbAttempts > 0 ? ((successfulClimbs / climbAttempts) * 100).toFixed(0) + '%' : 'N/A';

        let performanceClass = 'performance-low';
        if (parseFloat(avgTotal) >= 60) performanceClass = 'performance-high';
        else if (parseFloat(avgTotal) >= 40) performanceClass = 'performance-medium';

        return `
          <div class="team-card">
            <div class="team-number">Team ${team}</div>
            <div class="performance-indicator ${performanceClass}">
              Avg Score: ${avgTotal}
            </div>
            <div class="team-stats">
              <div class="team-stat">
                <div class="team-stat-value">${matches.length}</div>
                <div class="team-stat-label">Matches</div>
              </div>
              <div class="team-stat">
                <div class="team-stat-value">${avgAuto}</div>
                <div class="team-stat-label">Avg Auto</div>
              </div>
              <div class="team-stat">
                <div class="team-stat-value">${avgTeleop}</div>
                <div class="team-stat-label">Avg Teleop</div>
              </div>
              <div class="team-stat">
                <div class="team-stat-value">${avgOffense}</div>
                <div class="team-stat-label">Offense</div>
              </div>
              <div class="team-stat">
                <div class="team-stat-value">${avgDefense}</div>
                <div class="team-stat-label">Defense</div>
              </div>
              <div class="team-stat">
                <div class="team-stat-value">${climbRate}</div>
                <div class="team-stat-label">Climb Success</div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMatchDetails() {
  const data = getFilteredData().slice(0, 50).sort((a, b) => new Date(b.submissionTime) - new Date(a.submissionTime));
  const container = document.getElementById('match-details-container');

  if (data.length === 0) {
    container.innerHTML = '<p class="loading">No match data available</p>';
    return;
  }

  container.innerHTML = `
    <table class="match-table">
      <thead>
        <tr>
          <th>Team</th>
          <th>Match</th>
          <th>Event</th>
          <th>Auto Score</th>
          <th>Teleop Score</th>
          <th>Total Score</th>
          <th>Endgame</th>
          <th>Offense</th>
          <th>Defense</th>
          <th>Scouter</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(entry => {
          let performanceClass = 'performance-low';
          if (entry.totalScore >= 60) performanceClass = 'performance-high';
          else if (entry.totalScore >= 40) performanceClass = 'performance-medium';

          const submissionDate = new Date(entry.submissionTime);
          let endgameDisplay;
          
          // Fixed endgame display logic
          if (entry.endgame.action === 'climb') {
            endgameDisplay = entry.endgame.climbSuccessful ? '✅ Climb' : '❌ Climb';
          } else if (entry.endgame.action === 'park') {
            endgameDisplay = '🚗 Park';
          } else if (entry.endgame.action === 'did not park/climb') {
            endgameDisplay = '⚪ No Action';
          } else {
            endgameDisplay = entry.endgame.action || 'Unknown';
          }

          return `
            <tr>
              <td><strong>Team ${entry.team}</strong></td>
              <td>Match ${entry.match}</td>
              <td>${entry.event}</td>
              <td>${entry.auto.score}</td>
              <td>${entry.teleop.score}</td>
              <td>
                <span class="performance-indicator ${performanceClass}">
                  ${entry.totalScore}
                </span>
              </td>
              <td>${endgameDisplay}</td>
              <td>${entry.teleop.offenseRating || '-'}/5</td>
              <td>${entry.teleop.defenseRating || '-'}/5</td>
              <td>${entry.scouterName}</td>
              <td>${submissionDate.toLocaleDateString()}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderTeamInsights() {
  const data = getFilteredData();
  const container = document.getElementById('team-insights-container');
  
  if (data.length === 0) {
    container.innerHTML = '<p class="loading">No data available for insights</p>';
    return;
  }

  // Just update the team selector - the AI controls are already in the HTML template
  updateTeamSelector();
}

function updateTeamSelector() {
  const data = getFilteredData();
  const teamCounts = {};
  
  data.forEach(entry => {
    teamCounts[entry.team] = (teamCounts[entry.team] || 0) + 1;
  });

  const teams = Object.keys(teamCounts)
    .filter(team => teamCounts[team] >= 1) // At least 1 match
    .sort((a, b) => parseInt(a) - parseInt(b));

  const select = document.getElementById('ai-team-select');
  if (select) {
    select.innerHTML = '<option value="">Select Team for AI Analysis</option>';
    teams.forEach(team => {
      select.innerHTML += `<option value="${team}">Team ${team} (${teamCounts[team]} matches)</option>`;
    });
  }
}

function compareTeams() {
  const team1 = document.getElementById('compare-team1').value;
  const team2 = document.getElementById('compare-team2').value;
  const container = document.getElementById('comparison-container');

  if (!team1 || !team2) {
    container.innerHTML = '<p class="loading">Please select two teams to compare</p>';
    return;
  }

  if (team1 === team2) {
    container.innerHTML = '<p class="error">Please select two different teams</p>';
    return;
  }

  const filtered = getFilteredData();
  // Fixed comparison: convert to string for proper comparison
  const team1Data = filtered.filter(d => String(d.team) === String(team1));
  const team2Data = filtered.filter(d => String(d.team) === String(team2));

  console.log(`Team ${team1} data:`, team1Data.length, 'matches');
  console.log(`Team ${team2} data:`, team2Data.length, 'matches');

  if (team1Data.length === 0) {
    container.innerHTML = `<p class="error">No data available for Team ${team1} with current filters</p>`;
    return;
  }

  if (team2Data.length === 0) {
    container.innerHTML = `<p class="error">No data available for Team ${team2} with current filters</p>`;
    return;
  }

  // Calculate stats for both teams
  const getTeamStats = (teamData) => {
    const totalMatches = teamData.length;
    const avgTotal = (teamData.reduce((sum, d) => sum + d.totalScore, 0) / totalMatches).toFixed(1);
    const avgAuto = (teamData.reduce((sum, d) => sum + d.auto.score, 0) / totalMatches).toFixed(1);
    const avgTeleop = (teamData.reduce((sum, d) => sum + d.teleop.score, 0) / totalMatches).toFixed(1);
    const avgOffense = (teamData.reduce((sum, d) => sum + (d.teleop.offenseRating || 0), 0) / totalMatches).toFixed(1);
    const avgDefense = (teamData.reduce((sum, d) => sum + (d.teleop.defenseRating || 0), 0) / totalMatches).toFixed(1);
    
    const climbAttempts = teamData.filter(d => d.endgame.action === 'climb');
    const climbSuccessRate = climbAttempts.length > 0 ? 
      ((climbAttempts.filter(d => d.endgame.climbSuccessful).length / climbAttempts.length) * 100).toFixed(1) + '%' : 
      'N/A';

    return {
      totalMatches,
      avgTotal: parseFloat(avgTotal),
      avgAuto: parseFloat(avgAuto),
      avgTeleop: parseFloat(avgTeleop),
      avgOffense: parseFloat(avgOffense),
      avgDefense: parseFloat(avgDefense),
      climbSuccessRate
    };
  };

  const stats1 = getTeamStats(team1Data);
  const stats2 = getTeamStats(team2Data);

  // Create comparison visualization
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px;">
      <div class="team-card">
        <div class="team-number">Team ${team1}</div>
        <div class="team-stats">
          <div class="team-stat">
            <div class="team-stat-value">${stats1.totalMatches}</div>
            <div class="team-stat-label">Matches</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats1.avgTotal > stats2.avgTotal ? '#10b981' : stats1.avgTotal < stats2.avgTotal ? '#ef4444' : '#6b7280'}">${stats1.avgTotal}</div>
            <div class="team-stat-label">Avg Total</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats1.avgAuto > stats2.avgAuto ? '#10b981' : stats1.avgAuto < stats2.avgAuto ? '#ef4444' : '#6b7280'}">${stats1.avgAuto}</div>
            <div class="team-stat-label">Avg Auto</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats1.avgTeleop > stats2.avgTeleop ? '#10b981' : stats1.avgTeleop < stats2.avgTeleop ? '#ef4444' : '#6b7280'}">${stats1.avgTeleop}</div>
            <div class="team-stat-label">Avg Teleop</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats1.avgOffense > stats2.avgOffense ? '#10b981' : stats1.avgOffense < stats2.avgOffense ? '#ef4444' : '#6b7280'}">${stats1.avgOffense}</div>
            <div class="team-stat-label">Offense</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value">${stats1.climbSuccessRate}</div>
            <div class="team-stat-label">Climb Success</div>
          </div>
        </div>
      </div>

      <div class="team-card">
        <div class="team-number">Team ${team2}</div>
        <div class="team-stats">
          <div class="team-stat">
            <div class="team-stat-value">${stats2.totalMatches}</div>
            <div class="team-stat-label">Matches</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats2.avgTotal > stats1.avgTotal ? '#10b981' : stats2.avgTotal < stats1.avgTotal ? '#ef4444' : '#6b7280'}">${stats2.avgTotal}</div>
            <div class="team-stat-label">Avg Total</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats2.avgAuto > stats1.avgAuto ? '#10b981' : stats2.avgAuto < stats1.avgAuto ? '#ef4444' : '#6b7280'}">${stats2.avgAuto}</div>
            <div class="team-stat-label">Avg Auto</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats2.avgTeleop > stats1.avgTeleop ? '#10b981' : stats2.avgTeleop < stats1.avgTeleop ? '#ef4444' : '#6b7280'}">${stats2.avgTeleop}</div>
            <div class="team-stat-label">Avg Teleop</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value" style="color: ${stats2.avgOffense > stats1.avgOffense ? '#10b981' : stats2.avgOffense < stats1.avgOffense ? '#ef4444' : '#6b7280'}">${stats2.avgOffense}</div>
            <div class="team-stat-label">Offense</div>
          </div>
          <div class="team-stat">
            <div class="team-stat-value">${stats2.climbSuccessRate}</div>
            <div class="team-stat-label">Climb Success</div>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;">
      <h4 style="color: #1e3a8a; margin-bottom: 12px;">Head-to-Head Summary</h4>
      <p style="color: #6b7280;">
        <strong>Team ${stats1.avgTotal > stats2.avgTotal ? team1 : stats2.avgTotal > stats1.avgTotal ? team2 : 'Tie'}</strong> 
        ${stats1.avgTotal !== stats2.avgTotal ? 'has higher average performance' : 'teams are evenly matched'}
        ${stats1.avgTotal !== stats2.avgTotal ? ` (${Math.abs(stats1.avgTotal - stats2.avgTotal).toFixed(1)} point difference)` : ''}
      </p>
    </div>
  `;
}

function showError(message) {
  // Create error notification
  const error = document.createElement('div');
  error.className = 'error';
  error.textContent = message;
  error.style.position = 'fixed';
  error.style.top = '20px';
  error.style.right = '20px';
  error.style.zIndex = '1000';
  error.style.maxWidth = '400px';
  
  document.body.appendChild(error);
  
  setTimeout(() => {
    if (error.parentNode) {
      error.parentNode.removeChild(error);
    }
  }, 5000);
}

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadAnalyticsData();
});