    const BASE_URL = 'http://localhost:3000';
    let chart;
    let chartData = [];
    let isShowingPM = false; // false = PC, true = PM

    // Initialize Chart
    function initChart() {
      const ctx = document.getElementById('pmChart').getContext('2d');
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'PC0.1 (particles)',
            data: [],
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#e9ecef'
              },
              ticks: {
                color: '#6c757d'
              }
            },
            x: {
              grid: {
                color: '#e9ecef'
              },
              ticks: {
                color: '#6c757d',
                maxTicksLimit: 10
              }
            }
          }
        }
      });
    }

    // Toggle between PC and PM data
    function toggleDataType() {
      isShowingPM = !isShowingPM;
      const toggleSwitch = document.getElementById('toggleSwitch');
      const chartTitle = document.getElementById('chartTitle');
      
      if (isShowingPM) {
        toggleSwitch.classList.add('active');
        chartTitle.textContent = 'PM0.1 Trend (Last 10 Minutes)';
        chart.data.datasets[0].label = 'PM0.1 (µg/m³)';
      } else {
        toggleSwitch.classList.remove('active');
        chartTitle.textContent = 'PC0.1 Trend (Last 10 Minutes)';
        chart.data.datasets[0].label = 'PC0.1 (particles)';
      }
      
      // Clear chart data when switching
      chartData = [];
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update();
    }

    // Fetch latest data
    async function fetchLatest() {
      try {
        const response = await fetch(`${BASE_URL}/latest`);
        const data = await response.json();
        
        // Update real-time display
        let html = '';
        
        if (isShowingPM) {
          // Show PM values
          const pmParams = [
            { key: 'PM0.1', label: 'PM0.1' },
            { key: 'PM1.0', label: 'PM1.0' },
            { key: 'PM2.5', label: 'PM2.5' }
          ];
          
          pmParams.forEach(param => {
            if (data[param.key]) {
              const value = parseFloat(data[param.key]);
              html += `
                <div class="realtime-card">
                  <div class="realtime-label">${param.label}</div>
                  <div class="realtime-value">${value.toFixed(2)}</div>
                  <div class="realtime-unit">µg/m³</div>
                </div>
              `;
            }
          });
        } else {
          // Show PC values
          const pcParams = [
            { key: 'PC0.1', label: 'PC0.1' },
            { key: 'PC1.0', label: 'PC1.0' },
            { key: 'PC2.5', label: 'PC2.5' }
          ];
          
          pcParams.forEach(param => {
            if (data[param.key]) {
              const value = parseFloat(data[param.key]);
              html += `
                <div class="realtime-card">
                  <div class="realtime-label">${param.label}</div>
                  <div class="realtime-value">${value.toFixed(0)}</div>
                  <div class="realtime-unit">particles</div>
                </div>
              `;
            }
          });
        }
        
        document.getElementById('realtimeData').innerHTML = html;
        
        // Update chart with PC0.1 data (always show PC0.1 regardless of toggle)
        const chartKey = isShowingPM ? 'PM0.1' : 'PC0.1';
        if (data[chartKey]) {
          const now = new Date();
          const timeLabel = now.toLocaleTimeString('en-US', { hour12: false });
          
          chartData.push({
            time: timeLabel,
            value: parseFloat(data[chartKey])
          });
          
          // Keep only last 10 minutes of data (600 seconds / 1 second interval = 600 points)
          if (chartData.length > 600) {
            chartData.shift();
          }
          
          chart.data.labels = chartData.map(d => d.time);
          chart.data.datasets[0].data = chartData.map(d => d.value);
          chart.update('none');
        }
        
      } catch (error) {
        document.getElementById('realtimeData').innerHTML = 
          '<div style="text-align: center; color: #dc3545; padding: 20px;">Connection Error</div>';
      }
    }

    // Fetch statistics
    async function fetchStats(hours, targetId) {
      try {
        const response = await fetch(`${BASE_URL}/stats/${hours}`);
        const data = await response.json();
        
        if (!data.stats) {
          document.getElementById(targetId).innerHTML = 
            '<div style="text-align: center; color: #6c757d; padding: 20px;">No data available</div>';
          return;
        }
        
        let html = '';
        
        // Filter parameters based on current mode
        const paramsToShow = isShowingPM ? 
          ['PM0.1', 'PM1.0', 'PM2.5'] : 
          ['PC0.1', 'PC1.0', 'PC2.5'];
        
        paramsToShow.forEach(key => {
          if (data.stats[key]) {
            const stats = data.stats[key];
            html += `
              <div class="stat-item">
                <div class="stat-name">${key}</div>
                <div class="stat-values">
                  <div class="stat-value">
                    <div class="stat-label">Min</div>
                    <div class="stat-number stat-min">${parseFloat(stats.min).toFixed(2)}</div>
                  </div>
                  <div class="stat-value">
                    <div class="stat-label">Avg</div>
                    <div class="stat-number stat-avg">${parseFloat(stats.avg).toFixed(2)}</div>
                  </div>
                  <div class="stat-value">
                    <div class="stat-label">Max</div>
                    <div class="stat-number stat-max">${parseFloat(stats.max).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            `;
          }
        });
        
        document.getElementById(targetId).innerHTML = html;
        
      } catch (error) {
        document.getElementById(targetId).innerHTML = 
          '<div style="text-align: center; color: #dc3545; padding: 20px;">Connection Error</div>';
      }
    }

    // Update timestamp
    function updateTimestamp() {
      const now = new Date();
      document.getElementById('lastUpdate').textContent = 
        now.toLocaleTimeString('en-US', { hour12: false });
    }

    // Update all data
    function updateAll() {
      fetchLatest();
      fetchStats(3, 'stats3');
      fetchStats(12, 'stats12');
      fetchStats(24, 'stats24');
      updateTimestamp();
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
      initChart();
      updateAll();
      
      // Auto-refresh every second
      setInterval(updateAll, 1000);
    });