// Mancing Mania Public Frontend Script
let boatPrice = 500000;
let pricingType = 'flat';

document.addEventListener('DOMContentLoaded', () => {
  // Load page settings and departure times
  loadSettings();
  
  // Load current weather widget
  loadCurrentWeather();

  // Load gallery
  loadGallery();

  // Setup form submission
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingSubmit);
  }

  // Setup live price calculator
  const inputPeople = document.getElementById('input-people');
  if (inputPeople) {
    inputPeople.addEventListener('input', calculateTotalPrice);
  }

  // Setup booking search
  const searchBtn = document.getElementById('search-btn');
  const searchInput = document.getElementById('search-input');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', handleBookingSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleBookingSearch();
    });
  }
});

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  
  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slide-out 0.3s ease-in forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

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

// Load configurations from backend
async function loadSettings() {
  try {
    const res = await fetch('/api/public-settings');
    const data = await res.json();

    if (data.settings) {
      const s = data.settings;
      if (s.site_title) {
        document.getElementById('hero-title').innerText = s.site_title;
        updateDynamicLogo(s.site_title);
      }
      if (s.site_subtitle) document.getElementById('hero-subtitle').innerText = s.site_subtitle;
      if (s.about_text) document.getElementById('about-us-text').innerText = s.about_text;
      
      boatPrice = parseInt(s.boat_price || '500000');
      pricingType = s.pricing_type || 'flat';
    }

    if (data.departureTimes) {
      const select = document.getElementById('input-time');
      if (select) {
        select.innerHTML = '<option value="">Pilih Jam Keberangkatan</option>';
        data.departureTimes.forEach(time => {
          const opt = document.createElement('option');
          opt.value = time.time_label;
          opt.innerText = time.time_label;
          select.appendChild(opt);
        });
      }
    }

    calculateTotalPrice();
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
  }
}

// Live price calculator
function calculateTotalPrice() {
  const inputPeople = document.getElementById('input-people');
  const displayPrice = document.getElementById('display-total-price');

  if (!inputPeople || !displayPrice) return;

  const peopleCount = parseInt(inputPeople.value) || 1;
  const totalPrice = pricingType === 'per_person' ? boatPrice * peopleCount : boatPrice;

  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  });

  displayPrice.innerText = formatter.format(totalPrice);
}

// Fetch single weather info for Home Widget
async function loadCurrentWeather() {
  const condText = document.getElementById('widget-condition');
  const waveText = document.getElementById('widget-wave');
  const windText = document.getElementById('widget-wind');
  const tempText = document.getElementById('widget-temp');

  if (!condText) return;

  try {
    const res = await fetch('/api/weather');
    const data = await res.json();

    if (data && data.marine && data.forecast) {
      const currentHour = new Date().getHours();
      
      // Get current wave height
      const waveHeight = data.marine.hourly.wave_height[currentHour] || data.marine.daily.wave_height_max[0];
      const windSpeed = data.forecast.hourly.wind_speed_10m[currentHour] || data.forecast.daily.wind_speed_10m_max[0];
      const temp = data.forecast.hourly.temperature_2m[currentHour] || data.forecast.daily.temperature_2m_max[0];
      const weatherCode = data.forecast.hourly.weather_code[currentHour] || data.forecast.daily.weather_code[0];

      waveText.innerText = `${waveHeight.toFixed(1)}m`;
      windText.innerText = `${windSpeed.toFixed(0)} km/j`;
      tempText.innerText = `${temp.toFixed(0)}°C`;
      condText.innerText = translateWeatherCode(weatherCode);
    }
  } catch (err) {
    condText.innerText = 'Gagal memuat cuaca';
    console.error(err);
  }
}

// Translate weather codes
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
    96: 'Badai Petir Es Ringan',
    99: 'Badai Petir Es Lebat'
  };
  return weatherCodes[code] || 'Cerah Berawan';
}

// Create new booking
async function handleBookingSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('input-name').value;
  const phone = document.getElementById('input-phone').value;
  const people_count = document.getElementById('input-people').value;
  const departure_time = document.getElementById('input-time').value;

  if (!name || !phone || !people_count || !departure_time) {
    showToast('Harap isi semua kolom booking!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, phone, people_count, departure_time })
    });

    const data = await res.json();

    if (res.ok) {
      showToast(`Pemesanan Berhasil! Kode Booking: ${data.booking.bookingCode}`, 'success');
      document.getElementById('booking-form').reset();
      calculateTotalPrice();
      
      // Auto fill search input and show status
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = data.booking.bookingCode;
        handleBookingSearch();
        document.getElementById('status-check').scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      showToast(data.error || 'Gagal mengirim booking.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
    console.error(err);
  }
}

// Search bookings
async function handleBookingSearch() {
  const val = document.getElementById('search-input').value.trim();
  const resultsDiv = document.getElementById('search-results');

  if (!val) {
    showToast('Masukkan kode booking atau nomor HP!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/bookings/status?q=${encodeURIComponent(val)}`);
    const data = await res.json();

    resultsDiv.style.display = 'block';

    if (data.length === 0) {
      resultsDiv.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">❌ Pesanan tidak ditemukan. Pastikan kode booking atau nomor HP benar.</div>';
      return;
    }

    const formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    });

    const badgeClasses = {
      pending: 'badge-pending',
      approved: 'badge-approved',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled'
    };

    const statusLabels = {
      pending: 'Menunggu Konfirmasi',
      approved: 'Disetujui',
      completed: 'Selesai',
      cancelled: 'Dibatalkan'
    };

    resultsDiv.innerHTML = '<h4>Hasil Pencarian:</h4>';
    data.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const row = document.createElement('div');
      row.className = 'status-row';
      row.innerHTML = `
        <div class="status-info">
          <h4>${item.name} (${item.booking_code})</h4>
          <p><i class="fa-solid fa-clock"></i> Berangkat: <strong>${item.departure_time}</strong> | Orang: ${item.people_count} pemancing</p>
          <p><i class="fa-solid fa-coins"></i> Total Bayar: <strong>${formatter.format(item.total_price)}</strong></p>
          <p style="font-size: 0.75rem; margin-top: 4px;"><i class="fa-solid fa-calendar-day"></i> Dibuat: ${date}</p>
        </div>
        <div>
          <span class="badge ${badgeClasses[item.status]}">${statusLabels[item.status]}</span>
        </div>
      `;
      resultsDiv.appendChild(row);
    });
  } catch (err) {
    showToast('Gagal memuat status pesanan.', 'error');
    console.error(err);
  }
}

// Load public gallery
async function loadGallery() {
  const container = document.getElementById('gallery-container');
  if (!container) return;

  try {
    const res = await fetch('/api/gallery');
    const data = await res.json();

    container.innerHTML = '';

    if (data.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Belum ada dokumentasi galeri.</div>';
      return;
    }

    data.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <img src="${item.image_url}" alt="${item.caption}">
        <div class="gallery-overlay">
          <p>${item.caption}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load gallery:', err);
  }
}
