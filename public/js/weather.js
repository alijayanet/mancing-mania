// Mancing Mania Detailed Weather Page Script
let weatherData = null;
let activeDayIndex = 0; // 0 = Today, 1 = Tomorrow, 2 = Lusa

// Dynamic Logo Formatting
function updateDynamicLogo(siteTitle) {
  if (!siteTitle) return;
  const logoTextEl = document.getElementById('logo-text');
  const footerLogoTextEl = document.getElementById('footer-logo-text');
  
  const words = siteTitle.trim().toUpperCase().split(/\s+/);
  let html = '';
  if (words.length > 1) {
    const firstWord = words[0];
    const restOfWords = words.slice(1).join(' ');
    html = `${firstWord}<span>${restOfWords}</span>`;
  } else {
    const word = words[0];
    const half = Math.ceil(word.length / 2);
    const firstHalf = word.slice(0, half);
    const secondHalf = word.slice(half);
    html = `${firstHalf}<span>${secondHalf}</span>`;
  }

  if (logoTextEl) logoTextEl.innerHTML = html;
  if (footerLogoTextEl) footerLogoTextEl.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  // Load full weather data
  fetchWeatherData();

  // Load dynamic logo settings
  fetch('/api/public-settings')
    .then(res => res.json())
    .then(data => {
      if (data.settings && data.settings.site_title) {
        updateDynamicLogo(data.settings.site_title);
      }
    })
    .catch(err => console.error('Gagal memuat setting logo:', err));

  // Setup Date Tabs
  const tabs = document.querySelectorAll('.weather-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Set active class
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');

      // Update active day and redraw
      activeDayIndex = parseInt(e.target.getAttribute('data-day'));
      if (weatherData) {
        renderWeatherForDay();
      }
    });
  });
});

async function fetchWeatherData() {
  const tbody = document.getElementById('hourly-tbody');
  try {
    const res = await fetch('/api/weather');
    if (!res.ok) throw new Error('Network response error');
    
    weatherData = await res.json();

    // Render coordinate display
    const coordDiv = document.getElementById('coordinate-info');
    if (coordDiv && weatherData.latitude && weatherData.longitude) {
      coordDiv.innerHTML = `<i class="fa-solid fa-location-dot" style="color: var(--secondary); margin-right: 6px;"></i> Koordinat Operasional: ${parseFloat(weatherData.latitude).toFixed(4)}° S, ${parseFloat(weatherData.longitude).toFixed(4)}° E`;
    }

    // Set Date Tab Labels with actual dates (Today, Besok, Lusa)
    updateTabLabels();

    // Render Day 0 initially
    renderWeatherForDay();
  } catch (err) {
    console.error('Failed to fetch detailed weather:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ff3333; padding: 40px;"><i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom:12px; display:block;"></i> Gagal memuat data cuaca maritim. Silakan periksa koneksi internet Anda atau hubungi admin.</td></tr>`;
    }
  }
}

function updateTabLabels() {
  const tabs = document.querySelectorAll('.weather-tab-btn');
  const now = new Date();
  
  const options = { weekday: 'long', day: 'numeric', month: 'short' };
  
  for (let i = 0; i < 3; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const label = i === 0 ? 'Hari Ini' : (i === 1 ? 'Besok' : 'Lusa');
    const formattedDate = date.toLocaleDateString('id-ID', options);
    
    if (tabs[i]) {
      tabs[i].innerHTML = `${label}<br><span style="font-size: 0.8rem; font-weight: 500; opacity: 0.8;">${formattedDate}</span>`;
    }
  }
}

// Convert wind/wave degrees to compass directions in Indonesian
function degToCompass(num) {
  const val = Math.floor((num / 22.5) + 0.5);
  const arr = ["Utara", "Timur Laut", "Timur Laut", "Timur", "Tenggara", "Tenggara", "Selatan", "Barat Daya", "Barat Daya", "Barat", "Barat Laut", "Barat Laut"];
  return arr[(val % 12)] || "Utara";
}

function getWaveSafety(height) {
  if (height < 0.5) {
    return { text: 'Tenang', color: '#00ff00', badgeClass: 'badge-approved' };
  } else if (height <= 1.25) {
    return { text: 'Sedikit Kasar', color: '#ffeb3b', badgeClass: 'badge-pending' };
  } else if (height <= 2.5) {
    return { text: 'Kasar (Waspada)', color: '#ff9800', badgeClass: 'badge-pending' };
  } else {
    return { text: 'Bahaya!', color: '#ff3333', badgeClass: 'badge-cancelled' };
  }
}

// Map weather codes to icons
function getWeatherIcon(code) {
  const icons = {
    0: 'fa-sun',
    1: 'fa-cloud-sun',
    2: 'fa-cloud-sun',
    3: 'fa-cloud',
    45: 'fa-smog',
    48: 'fa-smog',
    51: 'fa-cloud-showers-water',
    53: 'fa-cloud-showers-water',
    55: 'fa-cloud-showers-heavy',
    61: 'fa-cloud-rain',
    63: 'fa-cloud-rain',
    65: 'fa-cloud-showers-heavy',
    80: 'fa-cloud-showers-water',
    81: 'fa-cloud-rain',
    82: 'fa-cloud-showers-heavy',
    95: 'fa-cloud-bolt',
    96: 'fa-cloud-bolt',
    99: 'fa-cloud-bolt'
  };
  return icons[code] || 'fa-cloud-sun';
}

function translateWeatherCode(code) {
  const weatherCodes = {
    0: 'Cerah',
    1: 'Cerah Berawan',
    2: 'Berawan',
    3: 'Berawan Tebal',
    45: 'Kabut',
    48: 'Kabut Beku',
    51: 'Gerimis Ringan',
    53: 'Gerimis Sedang',
    55: 'Gerimis Lebat',
    61: 'Hujan Ringan',
    63: 'Hujan Sedang',
    65: 'Hujan Lebat',
    80: 'Hujan Pancar Ringan',
    81: 'Hujan Pancar Sedang',
    82: 'Hujan Pancar Lebat',
    95: 'Badai Petir',
    96: 'Badai Petir Ringan',
    99: 'Badai Petir Lebat'
  };
  return weatherCodes[code] || 'Cerah Berawan';
}

function renderWeatherForDay() {
  const m = weatherData.marine;
  const f = weatherData.forecast;
  
  if (!m || !f) return;

  // --- 1. RENDER SUMMARY CARD ---
  // Daily parameters
  const maxWave = m.daily.wave_height_max[activeDayIndex];
  const domWaveDir = m.daily.wave_direction_dominant[activeDayIndex];
  const wavePeriod = m.daily.wave_period_max[activeDayIndex];

  const maxWind = f.daily.wind_speed_10m_max[activeDayIndex];
  const domWindDir = f.daily.wind_direction_10m_dominant[activeDayIndex];

  const maxTemp = f.daily.temperature_2m_max[activeDayIndex];
  const minTemp = f.daily.temperature_2m_min[activeDayIndex];
  const dayCode = f.daily.weather_code[activeDayIndex];

  // Calculate current average for day (using 8 indices per day or similar)
  const startIndex = activeDayIndex * 24;
  const endIndex = startIndex + 24;
  
  let currentSum = 0;
  let currentCount = 0;
  let currentDirs = [];
  
  for (let i = startIndex; i < endIndex; i++) {
    if (m.hourly.ocean_current_velocity[i] !== undefined) {
      currentSum += m.hourly.ocean_current_velocity[i];
      currentCount++;
      currentDirs.push(m.hourly.ocean_current_direction[i]);
    }
  }
  const avgCurrent = currentCount > 0 ? (currentSum / currentCount) : 0;
  // Calculate average current direction
  const avgCurrentDir = currentDirs.length > 0 ? currentDirs[Math.floor(currentDirs.length / 2)] : 0;

  // Render summaries
  const safety = getWaveSafety(maxWave);
  document.getElementById('summary-wave').innerHTML = `${maxWave.toFixed(1)}m <span style="font-size: 1rem; color: ${safety.color};">(${safety.text})</span>`;
  document.getElementById('summary-wave-status').innerText = `Arah: ${degToCompass(domWaveDir)} | Periode: ${wavePeriod.toFixed(0)} dtk`;
  
  document.getElementById('summary-wind').innerText = `${maxWind.toFixed(0)} km/jam`;
  document.getElementById('summary-wind-dir').innerText = `Dominan dari: ${degToCompass(domWindDir)}`;
  
  document.getElementById('summary-current').innerText = `${avgCurrent.toFixed(2)} m/s`;
  document.getElementById('summary-current-dir').innerText = `Arah Arus: Menuju ${degToCompass(avgCurrentDir)}`;
  
  document.getElementById('summary-temp').innerText = `${minTemp.toFixed(0)}°C - ${maxTemp.toFixed(0)}°C`;
  document.getElementById('summary-condition').innerHTML = `<i class="fa-solid ${getWeatherIcon(dayCode)}" style="margin-right: 6px;"></i> ${translateWeatherCode(dayCode)}`;

  // --- 2. RENDER HOURLY TABLE (3-hour interval for readability) ---
  const tbody = document.getElementById('hourly-tbody');
  tbody.innerHTML = '';

  // 3-hour intervals: 0, 3, 6, 9, 12, 15, 18, 21
  const intervals = [0, 3, 6, 9, 12, 15, 18, 21];

  intervals.forEach(hour => {
    const dataIndex = startIndex + hour;
    
    // Wave parameters
    const waveH = m.hourly.wave_height[dataIndex];
    const waveD = m.hourly.wave_direction[dataIndex];
    const waveP = m.hourly.wave_period[dataIndex];

    // Forecast parameters
    const temp = f.hourly.temperature_2m[dataIndex];
    const code = f.hourly.weather_code[dataIndex];
    const windS = f.hourly.wind_speed_10m[dataIndex];
    const windD = f.hourly.wind_direction_10m[dataIndex];

    // Current parameters
    const currV = m.hourly.ocean_current_velocity[dataIndex];
    const currD = m.hourly.ocean_current_direction[dataIndex];

    const hSafety = getWaveSafety(waveH);

    const tr = document.createElement('tr');
    
    // Format hour string
    const hourStr = String(hour).padStart(2, '0') + ':00';

    tr.innerHTML = `
      <td style="font-weight: 700; color: #fff;">${hourStr}</td>
      <td>
        <span style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid ${getWeatherIcon(code)}" style="color: var(--primary-light); font-size: 1.2rem;"></i>
          ${translateWeatherCode(code)}
        </span>
      </td>
      <td style="font-weight: 600;">${temp.toFixed(0)}°C</td>
      <td>
        <span style="color: ${hSafety.color}; font-weight: 700;">${waveH.toFixed(1)}m</span> 
        <span style="font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: var(--radius-sm); margin-left: 6px; color: ${hSafety.color}; border: 1px solid ${hSafety.color}33;">${hSafety.text}</span>
      </td>
      <td style="color: var(--text-muted); font-size: 0.9rem;">
        <i class="fa-solid fa-compass" style="transform: rotate(${waveD}deg); color: var(--primary-light); margin-right: 4px;"></i>
        ${degToCompass(waveD)} (${waveP.toFixed(0)} dtk)
      </td>
      <td style="font-size: 0.9rem;">
        <span style="font-weight: 600; color: #fff;">${windS.toFixed(0)} km/j</span>
        <span style="color: var(--text-muted); display: block; font-size: 0.8rem;">
          <i class="fa-solid fa-circle-arrow-up" style="transform: rotate(${windD}deg); color: #8bc34a; margin-right: 4px;"></i>
          Dari ${degToCompass(windD)}
        </span>
      </td>
      <td style="font-size: 0.9rem;">
        <span style="font-weight: 600; color: #fff;">${currV.toFixed(2)} m/s</span>
        <span style="color: var(--text-muted); display: block; font-size: 0.8rem;">
          <i class="fa-solid fa-location-arrow" style="transform: rotate(${currD}deg); color: #00bcd4; margin-right: 4px;"></i>
          Ke ${degToCompass(currD)}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
