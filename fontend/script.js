const BASE_URL = 'http://localhost:3000';

async function fetchStats(hours, targetId) {
  try {
    const res = await fetch(`${BASE_URL}/stats/${hours}`);
    const data = await res.json();
    const el = document.getElementById(targetId);
    
    if (!data.stats) {
      el.innerHTML = '<div class="no-data">No data available</div>';
      return;
    }

    let html = '';
    Object.entries(data.stats).forEach(([key, val]) => {
      html += `
        <div class="stats-item">
          <div class="stats-title">${key}</div>
          <div class="stats-values">
            <span class="stats-value">Min: <strong class="min-value">${parseFloat(val.min).toFixed(2)}</strong></span>
            <span class="stats-value">Avg: <strong class="avg-value">${parseFloat(val.avg).toFixed(2)}</strong></span>
            <span class="stats-value">Max: <strong class="max-value">${parseFloat(val.max).toFixed(2)}</strong></span>
          </div>
        </div>
      `;
    });
    
    el.innerHTML = html;
  } catch (err) {
    document.getElementById(targetId).innerHTML = '<div class="error-message">Connection error</div>';
  }
}

async function fetchLatest() {
  try {
    const res = await fetch(`${BASE_URL}/latest`);
    const data = await res.json();
    
    let html = '';
    Object.entries(data).forEach(([key, val]) => {
      if (key !== 'csvFile') {
        // Format numeric values to 2 decimal places
        const formattedValue = isNaN(val) ? val : parseFloat(val).toFixed(2);
        html += `
          <div class="data-item">
            <div class="metric-label">${key}</div>
            <div class="metric-value">${formattedValue}</div>
          </div>
        `;
      }
    });
    
    document.getElementById('latestData').innerHTML = html;
  } catch {
    document.getElementById('latestData').innerHTML = '<div class="error-message">Unable to load current data</div>';
  }
}

function updateTimestamp() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('lastRefresh').textContent = timeString;
}

function updateAll() {
  fetchStats(3, 'stats3');
  fetchStats(12, 'stats12');
  fetchStats(24, 'stats24');
  fetchLatest();
  updateTimestamp();
}

// Initial load
updateAll();

// Auto-refresh every second
setInterval(updateAll, 1000);