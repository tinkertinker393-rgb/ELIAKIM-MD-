const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const express = require('express');
const path = require('path');
const config = require('./config');
const { loadPlugins } = require('./lib/pluginHandler');
const utils = require('./lib/utils');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// in-memory pairing payload and pairing info
let latestPairingPayload = null;
let latestPairingUpdated = null;
const PAIRING_FILE = path.join(config.SESSION_DIR, 'pairing.json');

let sock = null;
let plugins = new Map();
const antiDeleteCache = require('./plugins/antidelete').cache; // LRU cache exported from plugin

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info({ version, isLatest }, 'Baileys version');

  sock = makeWASocket({
    logger,
    printQRInTerminal: false,
    auth: state,
    version
  });

  // load plugins
  plugins = loadPlugins();

  sock.ev.on('connection.update', async (update) => {
    // store pairing payload text (the QR string payload if provided by Baileys)
    if (update.qr) {
      latestPairingPayload = update.qr;
      latestPairingUpdated = Date.now();
      logger.info('New pairing payload available');
    }

    // When connection becomes open, save a short session code and notify the paired jid
    if (update.connection === 'open') {
      logger.info('Connection opened');

      // try to determine the current logged-in JID: prefer state.creds.me
      const meId = state?.creds?.me?.id || (sock.user && sock.user.id) || null;
      if (meId) {
        // create a short session id and persist it to SESSION_DIR/pairing.json
        try {
          // If a pairing file already exists, do not overwrite it unless it's stale
          let existing = {};
          if (await fs.pathExists(PAIRING_FILE)) {
            try { existing = await fs.readJson(PAIRING_FILE); } catch (e) { existing = {}; }
          }

          // generate short code if not present or if jid changed
          let shortCode = existing.code;
          if (!shortCode || existing.jid !== meId) {
            shortCode = Math.random().toString(36).slice(2, 8).toUpperCase();
            const payload = { code: shortCode, jid: meId, createdAt: new Date().toISOString() };
            await fs.outputJson(PAIRING_FILE, payload, { spaces: 2 });
            logger.info({ pairing: payload }, 'Saved pairing info');
          } else {
            logger.info({ existing }, 'Existing pairing info found');
          }

          // Send the short session id to the paired WhatsApp account so the user can copy it
          try {
            await sock.sendMessage(meId, {
              text: `ELIAKIM-MD pairing successful.\n\nSession ID: ${shortCode}\n\nSave this Session ID and paste it into config.js as PAIRED_SESSION_CODE, and set LINKED_JID to your WhatsApp JID (e.g., 1234567890@s.whatsapp.net).`
            });
            logger.info('Sent pairing session ID to %s', meId);
          } catch (err) {
            logger.warn('Failed to send pairing Session ID message to %s: %s', meId, err?.message || err);
          }
        } catch (err) {
          logger.error('Failed to persist/send pairing info: %s', err?.message || err);
        }
      } else {
        logger.warn('Could not determine own JID to send pairing session ID');
      }

      // clear latest QR so UI stops showing a QR
      latestPairingPayload = null;
    }

    if (update.connection === 'close') {
      const reason = update.lastDisconnect?.error ? update.lastDisconnect.error : update.lastDisconnect;
      logger.warn('connection closed', reason && reason.toString ? reason.toString() : reason);
      // Attempt reconnect unless auth failure
      if (update.lastDisconnect && update.lastDisconnect.error && update.lastDisconnect.error.output?.statusCode !== 401) {
        setTimeout(() => startBot().catch(err => logger.error('reconnect failed', err)), 5000);
      } else {
        logger.info('Authentication failure or connection closed; please re-pair if necessary.');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // cache incoming messages for anti-delete and dispatch plugins
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const messages = m.messages;
      for (const msg of messages) {
        // ignore status or system messages
        if (!msg.message || msg.key && msg.key.fromMe) continue;
        // cache message for anti-delete
        try {
          const keyId = msg.key && msg.key.id ? msg.key.id : `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          antiDeleteCache.set(keyId, msg);
        } catch (e) {}

        // dispatch to prefix commands (plugins)
        const text = msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || '';
        if (!text) {
          // run auto plugins (e.g., antilink)
          for (const p of plugins.values()) {
            if (p && p.name && ['antilink'].includes(p.name)) {
              try { await p.handler({ conn: sock, message: msg, args: [] }); } catch (e) {}
            }
          }
          continue;
        }
        const matchedPrefix = config.PREFIXES.find(p => text.startsWith(p));
        if (!matchedPrefix) continue;
        const [cmd, ...rest] = text.trim().slice(matchedPrefix.length).split(/\s+/);
        const plugin = plugins.get(cmd.toLowerCase());
        if (plugin && plugin.handler) {
          try {
            await plugin.handler({ conn: sock, message: msg, args: rest });
          } catch (err) {
            console.error('plugin error', err);
            await sock.sendMessage(msg.key.remoteJid, { text: `Error executing ${cmd}: ${err.message}` });
          }
        }
      }
    } catch (err) {
      console.error('messages.upsert error', err);
    }
  });

  // Listen to message delete events (revoke)
  sock.ev.on('messages.delete', async (m) => {
    try {
      for (const del of m) {
        const key = del.key && del.key.id;
        const cached = antiDeleteCache.get(key);
        if (cached) {
          const jid = cached.key.remoteJid;
          const sender = cached.key.participant || cached.key.remoteJid;
          const body = cached.message.conversation || (cached.message.extendedTextMessage && cached.message.extendedTextMessage.text) || '';
          const msg = `Anti-delete: @${sender.split('@')[0]} deleted a message:\n\n${body}`;
          await sock.sendMessage(jid, { text: msg, mentions: [sender] });
        }
      }
    } catch (err) {
      console.error('messages.delete handler error', err);
    }
  });

  // Participant add/remove hook for welcome plugin
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const jid = update.id;
      for (const plugin of plugins.values()) {
        if (plugin && plugin.name === 'welcome' && plugin.onParticipantAdded && update.participants && update.action === 'add') {
          for (const p of update.participants) {
            try { await plugin.onParticipantAdded(sock, jid, p); } catch (e) {}
          }
        }
      }
    } catch (err) { console.error('group-participants.update error', err); }
  });

  return sock;
}

// Express endpoints
app.get('/pair', async (req, res) => {
  if (!config.ALLOW_PAIRING_FROM_WEB) {
    return res.status(403).json({ error: 'Pairing via web disabled' });
  }
  if (!latestPairingPayload) {
    return res.json({ ok: false, message: 'No pairing payload currently available. Ensure the bot is running and awaiting pairing.' });
  }
  res.json({ ok: true, pairing: latestPairingPayload, updatedAt: latestPairingUpdated });
});

app.post('/reload-plugins', (req, res) => {
  try {
    plugins = loadPlugins();
    res.json({ ok: true, count: plugins.size });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.redirect('/public/pair.html');
});

async function tryAutoGreeting(conn) {
  try {
    if (!config.PAIRED_SESSION_CODE || !config.LINKED_JID) return;
    if (!await fs.pathExists(PAIRING_FILE)) {
      logger.warn('No pairing file found for auto-greeting');
      return;
    }
    const pairing = await fs.readJson(PAIRING_FILE);
    if (!pairing || pairing.code !== config.PAIRED_SESSION_CODE || pairing.jid !== config.LINKED_JID) {
      logger.warn('Pairing file does not match provided config; auto-greeting skipped');
      return;
    }
    if (!config.AUTO_GREETING) {
      logger.info('AUTO_GREETING disabled in config');
      return;
    }
    // send greeting
    const text = `Good morning "Eliakim"\nELIAKIM-MD is active!`;
    await conn.sendMessage(config.LINKED_JID, { text });
    logger.info('Auto-greeting sent to %s', config.LINKED_JID);
  } catch (err) {
    logger.error('Failed to send auto-greeting: %s', err?.message || err);
  }
}

async function main() {
  await fs.ensureDir(config.SESSION_DIR);
  await fs.ensureDir('data');

  const connection = await startBot().catch(err => {
    console.error('Failed to start bot', err);
    return null;
  });

  // small delay to allow connection.open handlers to run and pairing file to be written
  setTimeout(() => {
    if (connection) tryAutoGreeting(connection);
  }, 2000);

  // Start HTTP server
  app.listen(config.PORT, () => {
    logger.info(`HTTP pair UI available at http://localhost:${config.PORT}/public/pair.html`);
  });
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});