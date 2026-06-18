const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const authDir = path.join(__dirname, 'auth_info_baileys');

let sock = null;
let latestQrDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'qr_ready', 'connected'
let connectedUser = null;

// Logger
const logger = pino({ level: 'silent' });

async function initWhatsApp() {
  if (sock) {
    console.log('WhatsApp: Socket already initialized.');
    return;
  }

  console.log('WhatsApp: Initializing client...');
  connectionStatus = 'connecting';
  latestQrDataUrl = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    // Fetch latest WhatsApp version to avoid 405 Connection Failure
    let version;
    try {
      const versionResult = await fetchLatestBaileysVersion();
      version = versionResult.version;
      console.log(`WhatsApp: Using version v${version.join('.')}`);
    } catch (e) {
      console.warn('WhatsApp: Failed to fetch latest version, using fallback');
      version = [2, 3000, 1017592476]; // standard fallback
    }

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['Mancing Mania', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      logger: logger
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'qr_ready';
        try {
          latestQrDataUrl = await QRCode.toDataURL(qr);
          console.log('WhatsApp: New QR Code generated successfully.');
        } catch (err) {
          console.error('WhatsApp: Failed to generate QR data URI:', err.message);
        }
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('WhatsApp: Connection closed due to', lastDisconnect?.error?.message || lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        
        connectionStatus = 'disconnected';
        latestQrDataUrl = null;
        connectedUser = null;
        sock = null;

        if (shouldReconnect) {
          // Reconnect after 5 seconds
          setTimeout(initWhatsApp, 5000);
        }
      } else if (connection === 'open') {
        console.log('WhatsApp: Connection opened successfully!');
        connectionStatus = 'connected';
        latestQrDataUrl = null;
        
        const userJid = sock.user.id;
        connectedUser = userJid.split(':')[0] || userJid.split('@')[0];
        console.log('WhatsApp: Logged in as:', connectedUser);
      }
    });
  } catch (error) {
    console.error('WhatsApp: Initialization error:', error);
    connectionStatus = 'disconnected';
    sock = null;
  }
}

// Format phone number to international JID
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('62') && cleaned.length >= 9) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

// Send message function with onWhatsApp JID resolution
async function sendMessage(to, text) {
  if (!sock || connectionStatus !== 'connected') {
    console.warn('WhatsApp: Cannot send message. Client is not connected.');
    return false;
  }

  try {
    const formatted = formatPhoneNumber(to);
    const fallbackJid = `${formatted}@s.whatsapp.net`;
    let targetJid = fallbackJid;

    // Resolve the JID using onWhatsApp to support @lid and @s.whatsapp.net dynamically
    try {
      const [result] = await sock.onWhatsApp(fallbackJid);
      if (result && result.exists) {
        targetJid = result.jid;
        console.log(`WhatsApp: Resolved ${to} to JID ${targetJid}`);
      } else {
        console.log(`WhatsApp: JID resolution returned no exist state for ${to}, falling back to ${fallbackJid}`);
      }
    } catch (resolveError) {
      console.error('WhatsApp: JID resolution error (using fallback JID):', resolveError.message);
    }

    await sock.sendMessage(targetJid, { text });
    console.log(`WhatsApp: Message sent successfully to ${targetJid}`);
    return true;
  } catch (error) {
    console.error('WhatsApp: Failed to send message:', error.message);
    return false;
  }
}

// Disconnect and clear session
async function disconnectWhatsApp() {
  console.log('WhatsApp: Logging out and clearing session...');
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // ignore
    }
    try {
      sock.end();
    } catch (e) {
      // ignore
    }
  }

  sock = null;
  connectionStatus = 'disconnected';
  latestQrDataUrl = null;
  connectedUser = null;

  // Delete credentials folder
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('WhatsApp: Auth credentials deleted.');
  }

  // Re-initialize to generate a new QR code
  setTimeout(initWhatsApp, 2000);
  return true;
}

// Get current status
function getStatus() {
  return {
    status: connectionStatus,
    qr: latestQrDataUrl,
    phone: connectedUser
  };
}

module.exports = {
  initWhatsApp,
  sendMessage,
  disconnectWhatsApp,
  getStatus
};
