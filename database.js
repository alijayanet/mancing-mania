const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'mancing_mania.db');
const db = new Database(dbPath);

// Create tables if they do not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS departure_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time_label TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT UNIQUE,
    name TEXT,
    phone TEXT,
    people_count INTEGER,
    departure_time TEXT,
    total_price INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT,
    caption TEXT
  );
`);

// Seed default data if settings table is empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();

if (settingsCount.count === 0) {
  console.log('Seeding default database records...');

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  // Default admin login: admin / admin123
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);

  insertSetting.run('admin_username', 'admin');
  insertSetting.run('admin_password', adminPasswordHash);
  
  // Settings
  insertSetting.run('boat_price', '500000'); // IDR 500.000
  insertSetting.run('pricing_type', 'flat'); // 'flat' or 'per_person'
  insertSetting.run('lat', '-5.7600'); // Pulau Seribu Latitude
  insertSetting.run('lon', '106.5600'); // Pulau Seribu Longitude
  insertSetting.run('whatsapp_admin', '628123456789'); // Admin WhatsApp target
  
  // Site Content
  insertSetting.run('site_title', 'Mancing Mania');
  insertSetting.run('site_subtitle', 'Sewa Perahu Mancing Terbaik & Terpercaya');
  insertSetting.run('about_text', 'Kami menyediakan layanan sewa perahu nelayan/mancing profesional untuk para pemancing mania dengan fasilitas lengkap, kapten berpengalaman, dan alat navigasi canggih untuk menjamin kepuasan dan keselamatan Anda selama memancing di laut.');
  insertSetting.run('hero_bg_url', '/images/hero-bg.png');

  // Seed default departure times
  const insertTime = db.prepare('INSERT OR IGNORE INTO departure_times (time_label) VALUES (?)');
  insertTime.run('05:00 WIB');
  insertTime.run('07:00 WIB');
  insertTime.run('13:00 WIB');
  insertTime.run('16:00 WIB');

  // Seed default gallery items
  const insertGallery = db.prepare('INSERT INTO gallery (image_url, caption) VALUES (?, ?)');
  insertGallery.run('/images/gallery1.jpg', 'Keseruan memancing ikan GT (Giant Trevally)');
  insertGallery.run('/images/gallery2.jpg', 'Kapal Mancing Mania bersiap berlayar subuh hari');
  insertGallery.run('/images/gallery3.jpg', 'Tangkapan melimpah ikan Tenggiri');

  console.log('Database seeded successfully!');
}

module.exports = db;
