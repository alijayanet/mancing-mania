const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./database');
const whatsapp = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure images folder exists for local seeding
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
  secret: 'mancing_mania_super_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Admin Auth Middleware
function checkAdminAuth(req, res, next) {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Admin session required.' });
  }
}

// Initialize WhatsApp Client on Startup
whatsapp.initWhatsApp();

// --- PUBLIC API ROUTES ---

// Get public settings and content
app.get('/api/public-settings', (req, res) => {
  try {
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(row => {
      // Don't expose admin password hash
      if (row.key !== 'admin_password') {
        settings[row.key] = row.value;
      }
    });

    const departureTimes = db.prepare('SELECT id, time_label FROM departure_times ORDER BY time_label ASC').all();
    
    res.json({
      settings,
      departureTimes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch merged marine and forecast weather
app.get('/api/weather', async (req, res) => {
  try {
    const lat = db.prepare("SELECT value FROM settings WHERE key = 'lat'").get()?.value || '-5.7600';
    const lon = db.prepare("SELECT value FROM settings WHERE key = 'lon'").get()?.value || '106.5600';

    // Call Marine and Weather Forecast APIs
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&daily=wave_height_max,wave_direction_dominant,wave_period_max&hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction&timezone=Asia/Jakarta&cell_selection=sea`;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max,wind_direction_10m_dominant&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=Asia/Jakarta`;

    const [marineResponse, forecastResponse] = await Promise.all([
      axios.get(marineUrl),
      axios.get(forecastUrl)
    ]);

    res.json({
      latitude: lat,
      longitude: lon,
      marine: marineResponse.data,
      forecast: forecastResponse.data
    });
  } catch (error) {
    console.error('Weather API Proxy Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather data. Please try again later.' });
  }
});

// Create a boat booking order
app.post('/api/bookings', async (req, res) => {
  const { name, phone, people_count, departure_time } = req.body;

  if (!name || !phone || !people_count || !departure_time) {
    return res.status(400).json({ error: 'Semua kolom input wajib diisi.' });
  }

  const numPeople = parseInt(people_count);
  if (isNaN(numPeople) || numPeople <= 0) {
    return res.status(400).json({ error: 'Jumlah orang harus berupa angka positif.' });
  }

  try {
    // Get price configuration from settings
    const priceStr = db.prepare("SELECT value FROM settings WHERE key = 'boat_price'").get()?.value || '500000';
    const pricingType = db.prepare("SELECT value FROM settings WHERE key = 'pricing_type'").get()?.value || 'flat';
    const price = parseInt(priceStr);

    // Calculate total price
    const totalPrice = pricingType === 'per_person' ? price * numPeople : price;

    // Generate unique booking code
    const rand = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `MM-${rand}`;

    const createdAt = new Date().toISOString();

    // Insert booking into DB
    const insertStmt = db.prepare(`
      INSERT INTO bookings (booking_code, name, phone, people_count, departure_time, total_price, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `);
    
    insertStmt.run(bookingCode, name, phone, numPeople, departure_time, totalPrice, createdAt);

    const priceFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPrice);

    // --- WhatsApp Notifications ---
    const adminPhone = db.prepare("SELECT value FROM settings WHERE key = 'whatsapp_admin'").get()?.value;

    const adminMsg = `🎣 *BOOKING PERAHU BARU (MANCING MANIA)* 🎣\n\n` +
      `Ada pesanan sewa perahu baru yang perlu ditinjau:\n\n` +
      `▪ *Kode Booking:* ${bookingCode}\n` +
      `▪ *Nama Pemesan:* ${name}\n` +
      `▪ *No HP:* ${phone}\n` +
      `▪ *Jumlah Orang:* ${numPeople} orang\n` +
      `▪ *Waktu Berangkat:* ${departure_time}\n` +
      `▪ *Total Bayar:* ${priceFormatted}\n` +
      `▪ *Status:* Menunggu Konfirmasi (Pending)\n\n` +
      `Silakan buka Dashboard Admin untuk menyetujui atau membatalkan pesanan.`;

    const customerMsg = `⛵ *BOOKING SEWA PERAHU - MANCING MANIA* ⛵\n\n` +
      `Halo *${name}*,\n` +
      `Booking sewa perahu Anda berhasil diajukan! Berikut rincian pesanan Anda:\n\n` +
      `▪ *Kode Booking:* ${bookingCode}\n` +
      `▪ *Waktu Berangkat:* ${departure_time}\n` +
      `▪ *Jumlah Orang:* ${numPeople} orang\n` +
      `▪ *Total Pembayaran:* *${priceFormatted}*\n` +
      `▪ *Status:* Menunggu Konfirmasi Admin\n\n` +
      `Kami akan memproses pesanan Anda segera dan menghubungi Anda via WhatsApp. Harap simpan Kode Booking di atas untuk melakukan pengecekan status secara mandiri. Terima kasih!`;

    // Send notifications asynchronously
    if (adminPhone) {
      whatsapp.sendMessage(adminPhone, adminMsg);
    }
    whatsapp.sendMessage(phone, customerMsg);

    res.status(201).json({
      message: 'Booking berhasil dibuat!',
      booking: {
        bookingCode,
        name,
        phone,
        peopleCount: numPeople,
        departureTime: departure_time,
        totalPrice,
        status: 'pending'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check booking status
app.get('/api/bookings/status', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required.' });
  }

  try {
    const results = db.prepare(`
      SELECT booking_code, name, phone, people_count, departure_time, total_price, status, created_at 
      FROM bookings 
      WHERE booking_code = ? OR phone = ? 
      ORDER BY id DESC
    `).all(query, query);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get gallery images
app.get('/api/gallery', (req, res) => {
  try {
    const images = db.prepare('SELECT id, image_url, caption FROM gallery ORDER BY id DESC').all();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ADMIN API ROUTES (PROTECTED) ---

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  try {
    const dbUsername = db.prepare("SELECT value FROM settings WHERE key = 'admin_username'").get()?.value;
    const dbPasswordHash = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get()?.value;

    if (username === dbUsername && bcrypt.compareSync(password, dbPasswordHash)) {
      req.session.admin = username;
      res.json({ success: true, message: 'Login berhasil!' });
    } else {
      res.status(401).json({ error: 'Username atau password salah.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Gagal logout.' });
    }
    res.json({ success: true, message: 'Logout berhasil!' });
  });
});

// Check Admin Session Status
app.get('/api/admin/check-session', (req, res) => {
  if (req.session && req.session.admin) {
    res.json({ loggedIn: true, username: req.session.admin });
  } else {
    res.json({ loggedIn: false });
  }
});

// Get dashboard statistics
app.get('/api/admin/stats', checkAdminAuth, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM bookings').get()?.count || 0;
    const pending = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").get()?.count || 0;
    const approved = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'approved'").get()?.count || 0;
    const completed = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'completed'").get()?.count || 0;
    const cancelled = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'cancelled'").get()?.count || 0;

    res.json({ total, pending, approved, completed, cancelled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bookings list
app.get('/api/admin/bookings', checkAdminAuth, (req, res) => {
  try {
    const bookings = db.prepare('SELECT * FROM bookings ORDER BY id DESC').all();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
app.put('/api/admin/bookings/:id/status', checkAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }

  try {
    // Get booking detail first for notification
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }

    // Update DB
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);

    // Send WhatsApp notification status update
    const statusLabels = {
      pending: 'PENDING (Menunggu Konfirmasi)',
      approved: 'DISETUJUI',
      completed: 'SELESAI',
      cancelled: 'DIBATALKAN'
    };

    let statusText = '';
    if (status === 'approved') {
      statusText = `Selamat! Pesanan sewa perahu Anda untuk keberangkatan jam *${booking.departure_time}* telah *DISETUJUI* oleh Admin.\n\nSilakan datang ke dermaga tepat waktu. Sampai jumpa di laut!`;
    } else if (status === 'cancelled') {
      statusText = `Mohon maaf, pesanan sewa perahu Anda dengan kode booking *${booking.booking_code}* telah *DIBATALKAN*.\n\nSilakan hubungi kami di nomor ini jika ada pertanyaan atau untuk melakukan pemesanan ulang.`;
    } else if (status === 'completed') {
      statusText = `Terima kasih telah berlayar bersama Mancing Mania!\n\nSemoga trip mancing Anda menyenangkan dan mendapatkan tangkapan yang melimpah. Jangan lupa bagikan momen keseruan Anda!`;
    }

    if (statusText) {
      const msg = `⛵ *UPDATE STATUS SEWA PERAHU - MANCING MANIA* ⛵\n\n` +
        `Halo *${booking.name}*,\n` +
        `Ada perubahan status pada pesanan Anda:\n\n` +
        `▪ *Kode Booking:* ${booking.booking_code}\n` +
        `▪ *Status Baru:* *${statusLabels[status]}*\n\n` +
        `${statusText}`;
      
      whatsapp.sendMessage(booking.phone, msg);
    }

    res.json({ success: true, message: 'Status booking berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a booking
app.delete('/api/admin/bookings/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
    res.json({ success: true, message: 'Booking berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get settings
app.get('/api/admin/settings', checkAdminAuth, (req, res) => {
  try {
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    settingsRows.forEach(row => {
      // Don't send password hash
      if (row.key !== 'admin_password') {
        settings[row.key] = row.value;
      }
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.post('/api/admin/settings', checkAdminAuth, (req, res) => {
  const settingsObj = req.body;
  const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  try {
    db.transaction(() => {
      for (const [key, value] of Object.entries(settingsObj)) {
        // Handle password updates separately to hash it
        if (key === 'admin_password') {
          if (value && value.trim() !== '') {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(value, salt);
            updateStmt.run('admin_password', hash);
          }
        } else {
          updateStmt.run(key, String(value));
        }
      }
    })();
    res.json({ success: true, message: 'Pengaturan berhasil disimpan!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Departure Times CRUD
app.get('/api/admin/departure-times', checkAdminAuth, (req, res) => {
  try {
    const times = db.prepare('SELECT * FROM departure_times ORDER BY time_label ASC').all();
    res.json(times);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/departure-times', checkAdminAuth, (req, res) => {
  const { time_label } = req.body;
  if (!time_label) {
    return res.status(400).json({ error: 'Waktu keberangkatan wajib diisi.' });
  }

  try {
    db.prepare('INSERT OR IGNORE INTO departure_times (time_label) VALUES (?)').run(time_label);
    res.json({ success: true, message: 'Waktu keberangkatan berhasil ditambahkan.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/departure-times/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM departure_times WHERE id = ?').run(id);
    res.json({ success: true, message: 'Waktu keberangkatan berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gallery Management (with Multer file upload)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = 'gallery-' + Date.now() + ext;
    cb(null, filename);
  }
});
const upload = multer({ storage: storage });

app.get('/api/admin/gallery', checkAdminAuth, (req, res) => {
  try {
    const galleryItems = db.prepare('SELECT * FROM gallery ORDER BY id DESC').all();
    res.json(galleryItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/gallery', checkAdminAuth, upload.single('image'), (req, res) => {
  const { caption } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'File gambar wajib diunggah.' });
  }

  const imageUrl = '/uploads/' + req.file.filename;

  try {
    db.prepare('INSERT INTO gallery (image_url, caption) VALUES (?, ?)').run(imageUrl, caption || '');
    res.json({ success: true, message: 'Gambar galeri berhasil ditambahkan.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/gallery/:id', checkAdminAuth, (req, res) => {
  const { id } = req.params;
  try {
    const item = db.prepare('SELECT image_url FROM gallery WHERE id = ?').get(id);
    if (item && item.image_url.startsWith('/uploads/')) {
      const filepath = path.join(__dirname, 'public', item.image_url);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath); // delete actual file
      }
    }
    db.prepare('DELETE FROM gallery WHERE id = ?').run(id);
    res.json({ success: true, message: 'Gambar galeri berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp status & QR Code routes
app.get('/api/admin/whatsapp/status', checkAdminAuth, (req, res) => {
  res.json(whatsapp.getStatus());
});

app.post('/api/admin/whatsapp/disconnect', checkAdminAuth, async (req, res) => {
  try {
    await whatsapp.disconnectWhatsApp();
    res.json({ success: true, message: 'WhatsApp berhasil diputus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- SERVER LISTENER ---
app.listen(PORT, () => {
  console.log(`Server Mancing Mania running on http://localhost:${PORT}`);
});
