/**
 * Welcome/Goodbye messages for group.
 * Save group settings in data/welcome.json
 *
 * Commands:
 *  .welcome on|off
 * (owner-only for now)
 */
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const DATA_FILE = path.resolve('data', 'welcome.json');

async function loadSettings() {
  await fs.ensureFile(DATA_FILE);
  const raw = await fs.readFile(DATA_FILE, 'utf8').catch(() => '{}');
  return JSON.parse(raw || '{}');
}

async function saveSettings(obj) {
  await fs.outputFile(DATA_FILE, JSON.stringify(obj, null, 2));
}

module.exports = {
  name: 'welcome',
  help: {
    description: 'Enable/disable welcome messages in group: .welcome on/off',
    usage: '.welcome on | .welcome off'
  },
  async handler({ conn, message, args }) {
    const from = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    if (!from.endsWith('@g.us')) {
      await conn.sendMessage(from, { text: 'This command is for groups only.' });
      return;
    }
    // owner-only simplified
    if (!config.OWNER || !config.OWNER.includes(sender)) {
      await conn.sendMessage(from, { text: 'Owner-only for now.' });
      return;
    }
    const arg = args[0] && args[0].toLowerCase();
    const settings = await loadSettings();
    settings[from] = settings[from] || {};
    if (arg === 'on') settings[from].welcome = true;
    else if (arg === 'off') settings[from].welcome = false;
    else {
      await conn.sendMessage(from, { text: 'Usage: .welcome on | .welcome off' });
      return;
    }
    await saveSettings(settings);
    await conn.sendMessage(from, { text: `Welcome messages ${settings[from].welcome ? 'enabled' : 'disabled'}` });
  },
  // helper for runtime
  async onParticipantAdded(conn, jid, participant) {
    const settings = await loadSettings();
    if (settings[jid] && settings[jid].welcome) {
      await conn.sendMessage(jid, { text: `Welcome @${participant.split('@')[0]} to the group!`, mentions: [participant] });
    }
  }
};