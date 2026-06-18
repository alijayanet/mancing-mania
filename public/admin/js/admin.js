// Mancing Mania Admin Panel JavaScript
let settingsData = {};
let bookingsData = [];
let waPollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check Admin session on load
  checkSession();

  // Sidebar navigation setup
  setupSidebarNavigation();

  // Load bookings and statistics
  loadBookingsAndStats();

  // Handle forms submissions
  document.getElementById('content-form').addEventListener('submit', handleContentSubmit);
  document.getElementById('settings-form').addEventListener('submit', handleSettingsSubmit);
  document.getElementById('gallery-form').addEventListener('submit', handleGallerySubmit);
  document.getElementById('time-add-form').addEventListener('submit', handleTimeAddSubmit);
  document.getElementById('admin-logout-btn').addEventListener('click', handleLogout);

  // Booking table search
  document.getElementById('booking-search').addEventListener('input', handleBookingSearch);

  // File upload preview listener
  const galleryImageInput = document.getElementById('gallery-image');
  const filePreviewDiv = document.getElementById('file-preview-name');
  if (galleryImageInput && filePreviewDiv) {
    galleryImageInput.addEventListener('change', () => {
      if (galleryImageInput.files.length > 0) {
        filePreviewDiv.innerHTML = `<i class="fa-solid fa-file-image"></i> Terpilih: <strong>${galleryImageInput.files[0].name}</strong>`;
        filePreviewDiv.style.display = 'flex';
      } else {
        filePreviewDiv.style.display = 'none';
      }
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

// Session verification
async function checkSession() {
  try {
    const res = await fetch('/api/admin/check-session');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = '/admin/login.html';
    }
  } catch (err) {
    window.location.href = '/admin/login.html';
  }
}

// Navigation switcher
function setupSidebarNavigation() {
  const links = document.querySelectorAll('.sidebar-link');
  const panels = document.querySelectorAll('.admin-panel');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetPanel = link.getAttribute('data-target');
      if (!targetPanel) return;

      // Update active nav link
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Update active panel
      panels.forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(targetPanel);
      if (activePanel) {
        activePanel.classList.add('active');
      }

      // Action based on target panel
      if (targetPanel === 'panel-bookings') {
        loadBookingsAndStats();
        stopWhatsAppPolling();
      } else if (targetPanel === 'panel-content') {
        loadContentPanel();
        stopWhatsAppPolling();
      } else if (targetPanel === 'panel-settings') {
        loadSettingsPanel();
        stopWhatsAppPolling();
      } else if (targetPanel === 'panel-whatsapp') {
        startWhatsAppPolling();
      }
    });
  });
}

// STOP WhatsApp status polling
function stopWhatsAppPolling() {
  if (waPollInterval) {
    clearInterval(waPollInterval);
    waPollInterval = null;
  }
}

// START WhatsApp status polling
function startWhatsAppPolling() {
  stopWhatsAppPolling();
  
  // Poll immediately, then every 2.5 seconds
  pollWhatsAppStatus();
  waPollInterval = setInterval(pollWhatsAppStatus, 2500);
}

// Poll WhatsApp state
async function pollWhatsAppStatus() {
  const badge = document.getElementById('wa-status-badge');
  const text = document.getElementById('wa-status-text');
  const instructions = document.getElementById('wa-instructions');
  const qrBox = document.getElementById('wa-qr-box');
  const qrImage = document.getElementById('wa-qr-image');
  const actionContainer = document.getElementById('wa-action-container');
  const disconnectBtn = document.getElementById('wa-disconnect-btn');

  if (!badge || !text) return;

  try {
    const res = await fetch('/api/admin/whatsapp/status');
    const data = await res.json();

    // Reset badge classes
    badge.className = 'wa-badge';
    
    if (data.status === 'connected') {
      badge.classList.add('wa-badge-connected');
      badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected';
      text.innerHTML = `Terhubung ke nomor WhatsApp: <strong style="color: #4caf50;">${data.phone}</strong>`;
      instructions.innerText = 'Bot WhatsApp siap mengirimkan notifikasi booking sewa perahu.';
      qrBox.style.display = 'none';
      actionContainer.style.display = 'block';
    } 
    else if (data.status === 'qr_ready') {
      badge.classList.add('wa-badge-connecting');
      badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Scan QR Code';
      text.innerText = 'WhatsApp Belum Terhubung';
      instructions.innerText = 'Silakan scan QR code di bawah ini menggunakan aplikasi WhatsApp HP Anda (Perangkat Tertaut).';
      
      if (data.qr) {
        qrImage.src = data.qr;
        qrBox.style.display = 'inline-flex';
      }
      actionContainer.style.display = 'none';
    } 
    else if (data.status === 'connecting') {
      badge.classList.add('wa-badge-connecting');
      badge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Connecting';
      text.innerText = 'Menghubungkan WhatsApp...';
      instructions.innerText = 'Menghubungkan ke server WhatsApp. Mohon tunggu beberapa saat.';
      qrBox.style.display = 'none';
      actionContainer.style.display = 'none';
    } 
    else {
      badge.classList.add('wa-badge-disconnected');
      badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Disconnected';
      text.innerText = 'WhatsApp Terputus';
      instructions.innerText = 'Server terputus dari WhatsApp. Membuat QR code baru...';
      qrBox.style.display = 'none';
      actionContainer.style.display = 'none';
    }

    // Set up disconnect action
    disconnectBtn.onclick = async () => {
      if (confirm('Apakah Anda yakin ingin memutuskan hubungan WhatsApp?')) {
        disconnectBtn.disabled = true;
        try {
          const resDisconnect = await fetch('/api/admin/whatsapp/disconnect', { method: 'POST' });
          const resData = await resDisconnect.json();
          if (resData.success) {
            showToast('WhatsApp berhasil diputus.', 'success');
          } else {
            showToast('Gagal memutuskan WhatsApp.', 'error');
          }
        } catch (err) {
          showToast('Kesalahan jaringan.', 'error');
        }
        disconnectBtn.disabled = false;
        pollWhatsAppStatus();
      }
    };

  } catch (err) {
    console.error('Failed to fetch WA status:', err);
    text.innerText = 'Gagal memuat status WhatsApp (Koneksi Server Gagal)';
  }
}

// Fetch bookings and reload stats widgets
async function loadBookingsAndStats() {
  try {
    // 1. Fetch Stats
    const statsRes = await fetch('/api/admin/stats');
    const stats = await statsRes.json();
    
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-pending').innerText = stats.pending || 0;
    document.getElementById('stat-approved').innerText = stats.approved || 0;
    document.getElementById('stat-completed').innerText = stats.completed || 0;

    // 2. Fetch Bookings
    const bookingsRes = await fetch('/api/admin/bookings');
    bookingsData = await bookingsRes.json();

    renderBookingsTable(bookingsData);
  } catch (err) {
    showToast('Gagal memuat data booking.', 'error');
    console.error(err);
  }
}

// Render Bookings rows
function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">Belum ada data pesanan sewa perahu.</td></tr>';
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
    pending: 'Pending',
    approved: 'Disetujui',
    completed: 'Selesai',
    cancelled: 'Dibatalkan'
  };

  bookings.forEach(booking => {
    const tr = document.createElement('tr');

    // Create action buttons based on status
    let actionButtons = '';
    if (booking.status === 'pending') {
      actionButtons = `
        <button class="btn-action btn-approve" onclick="updateBookingStatus(${booking.id}, 'approved')"><i class="fa-solid fa-check"></i> Setujui</button>
        <button class="btn-action btn-cancel" onclick="updateBookingStatus(${booking.id}, 'cancelled')"><i class="fa-solid fa-xmark"></i> Batalkan</button>
      `;
    } else if (booking.status === 'approved') {
      actionButtons = `
        <button class="btn-action btn-complete" onclick="updateBookingStatus(${booking.id}, 'completed')"><i class="fa-solid fa-anchor"></i> Selesai</button>
        <button class="btn-action btn-cancel" onclick="updateBookingStatus(${booking.id}, 'cancelled')"><i class="fa-solid fa-xmark"></i> Batalkan</button>
      `;
    } else {
      // Completed or cancelled, allow deleting
      actionButtons = `
        <button class="btn-action btn-delete" onclick="deleteBooking(${booking.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
      `;
    }

    tr.innerHTML = `
      <td style="font-weight: 700; color: #fff;">${booking.booking_code}</td>
      <td>${booking.name}</td>
      <td>${booking.phone}</td>
      <td>${booking.people_count} pemancing</td>
      <td style="font-weight: 600;">${booking.departure_time}</td>
      <td style="font-weight: 700; color: var(--secondary);">${formatter.format(booking.total_price)}</td>
      <td><span class="badge ${badgeClasses[booking.status]}">${statusLabels[booking.status]}</span></td>
      <td><div style="display: flex; gap: 8px;">${actionButtons}</div></td>
    `;

    tbody.appendChild(tr);
  });
}

// Update booking status
async function updateBookingStatus(id, status) {
  try {
    const res = await fetch(`/api/admin/bookings/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      showToast('Status booking berhasil diperbarui.', 'success');
      loadBookingsAndStats();
    } else {
      const data = await res.json();
      showToast(data.error || 'Gagal memperbarui status.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

// Delete a booking
async function deleteBooking(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus permanen pesanan ini dari database?')) return;

  try {
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Booking berhasil dihapus.', 'success');
      loadBookingsAndStats();
    } else {
      showToast('Gagal menghapus booking.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

// Local Search filter for bookings
function handleBookingSearch() {
  const query = document.getElementById('booking-search').value.toLowerCase().trim();
  if (!query) {
    renderBookingsTable(bookingsData);
    return;
  }

  const filtered = bookingsData.filter(b => 
    b.booking_code.toLowerCase().includes(query) ||
    b.name.toLowerCase().includes(query) ||
    b.phone.toLowerCase().includes(query)
  );

  renderBookingsTable(filtered);
}

// --- CONTENT PANEL ---
async function loadContentPanel() {
  try {
    const res = await fetch('/api/admin/settings');
    settingsData = await res.json();

    document.getElementById('set-site-title').value = settingsData.site_title || '';
    document.getElementById('set-site-subtitle').value = settingsData.site_subtitle || '';
    document.getElementById('set-about-text').value = settingsData.about_text || '';

    // Load active gallery images
    loadGalleryList();
  } catch (err) {
    showToast('Gagal memuat konten website.', 'error');
  }
}

async function handleContentSubmit(e) {
  e.preventDefault();

  const site_title = document.getElementById('set-site-title').value;
  const site_subtitle = document.getElementById('set-site-subtitle').value;
  const about_text = document.getElementById('set-about-text').value;

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ site_title, site_subtitle, about_text })
    });

    if (res.ok) {
      showToast('Konten website berhasil diperbarui!', 'success');
    } else {
      showToast('Gagal menyimpan konten.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

async function loadGalleryList() {
  const list = document.getElementById('gallery-list');
  if (!list) return;

  try {
    const res = await fetch('/api/gallery');
    const data = await res.json();

    list.innerHTML = '';
    
    if (data.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">Belum ada gambar di galeri.</div>';
      return;
    }

    data.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'list-item-crud';
      itemDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${item.image_url}" style="width: 50px; height: 40px; object-fit: cover; border-radius: var(--radius-sm);">
          <span style="font-size: 0.9rem; font-weight: 500; color: #fff; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.caption || 'Tanpa Keterangan'}</span>
        </div>
        <button class="btn-action btn-delete" onclick="deleteGalleryItem(${item.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
      `;
      list.appendChild(itemDiv);
    });
  } catch (err) {
    console.error(err);
  }
}

async function handleGallerySubmit(e) {
  e.preventDefault();

  const fileInput = document.getElementById('gallery-image');
  const captionInput = document.getElementById('gallery-caption');

  if (fileInput.files.length === 0) {
    showToast('Pilih file gambar terlebih dahulu.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('image', fileInput.files[0]);
  formData.append('caption', captionInput.value);

  try {
    const res = await fetch('/api/admin/gallery', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      showToast('Gambar berhasil diunggah ke galeri!', 'success');
      document.getElementById('gallery-form').reset();
      const previewDiv = document.getElementById('file-preview-name');
      if (previewDiv) previewDiv.style.display = 'none';
      loadGalleryList();
    } else {
      const data = await res.json();
      showToast(data.error || 'Gagal mengunggah gambar.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus gambar galeri ini?')) return;

  try {
    const res = await fetch(`/api/admin/gallery/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Gambar galeri berhasil dihapus.', 'success');
      loadGalleryList();
    } else {
      showToast('Gagal menghapus gambar.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

// --- SETTINGS PANEL ---
async function loadSettingsPanel() {
  try {
    const res = await fetch('/api/admin/settings');
    settingsData = await res.json();

    document.getElementById('set-boat-price').value = settingsData.boat_price || '500000';
    document.getElementById('set-pricing-type').value = settingsData.pricing_type || 'flat';
    document.getElementById('set-whatsapp-admin').value = settingsData.whatsapp_admin || '';
    document.getElementById('set-lat').value = settingsData.lat || '-5.7600';
    document.getElementById('set-lon').value = settingsData.lon || '106.5600';
    
    // Bind admin account settings
    document.getElementById('set-admin-username').value = settingsData.admin_username || 'admin';
    document.getElementById('set-admin-password').value = ''; // clear on load

    // Load active departure times
    loadDepartureTimes();
  } catch (err) {
    showToast('Gagal memuat konfigurasi settings.', 'error');
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault();

  const boat_price = document.getElementById('set-boat-price').value;
  const pricing_type = document.getElementById('set-pricing-type').value;
  const whatsapp_admin = document.getElementById('set-whatsapp-admin').value;
  const lat = document.getElementById('set-lat').value;
  const lon = document.getElementById('set-lon').value;
  const admin_username = document.getElementById('set-admin-username').value;
  const admin_password = document.getElementById('set-admin-password').value;

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        boat_price, 
        pricing_type, 
        whatsapp_admin, 
        lat, 
        lon, 
        admin_username, 
        admin_password 
      })
    });

    if (res.ok) {
      showToast('Konfigurasi pengaturan berhasil disimpan!', 'success');
      document.getElementById('set-admin-password').value = ''; // clear after save
    } else {
      showToast('Gagal menyimpan pengaturan.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

async function loadDepartureTimes() {
  const list = document.getElementById('times-list');
  if (!list) return;

  try {
    const res = await fetch('/api/admin/departure-times');
    const times = await res.json();

    list.innerHTML = '';
    
    if (times.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">Belum ada waktu keberangkatan yang diatur.</div>';
      return;
    }

    times.forEach(time => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'list-item-crud';
      itemDiv.innerHTML = `
        <span style="font-size: 1.1rem; font-weight: 700; color: #fff;"><i class="fa-solid fa-clock" style="color: var(--primary-light); margin-right: 8px;"></i> ${time.time_label}</span>
        <button class="btn-action btn-delete" onclick="deleteDepartureTime(${time.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
      `;
      list.appendChild(itemDiv);
    });
  } catch (err) {
    console.error(err);
  }
}

async function handleTimeAddSubmit(e) {
  e.preventDefault();

  const timeInput = document.getElementById('input-new-time');
  const time_label = timeInput.value.trim();

  if (!time_label) return;

  try {
    const res = await fetch('/api/admin/departure-times', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ time_label })
    });

    if (res.ok) {
      showToast('Jadwal keberangkatan berhasil ditambahkan!', 'success');
      timeInput.value = '';
      loadDepartureTimes();
    } else {
      showToast('Gagal menambahkan jadwal.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

async function deleteDepartureTime(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus jadwal keberangkatan ini?')) return;

  try {
    const res = await fetch(`/api/admin/departure-times/${id}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Jadwal keberangkatan berhasil dihapus.', 'success');
      loadDepartureTimes();
    } else {
      showToast('Gagal menghapus jadwal.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}

// Logout Admin
async function handleLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari panel admin?')) return;

  try {
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    if (res.ok) {
      window.location.href = '/admin/login.html';
    } else {
      showToast('Gagal logout.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan jaringan.', 'error');
  }
}
