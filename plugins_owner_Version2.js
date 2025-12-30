/**
 * Owner-only utilities: eval, restart, broadcast, reload
 *
 * WARNING: eval is dangerous. Keep owner list small and trusted.
 */
const config = require('../config');
const { loadPlugins } = require('../lib/pluginHandler');

function isOwner(sender) {
  return config.OWNER && config.OWNER.includes(sender);
}

module.exports = {
  name: 'owner',
  help: {
    description: 'Owner-only commands: .eval, .restart, .broadcast <text>',
    usage: '.eval <js> | .restart | .broadcast <text>'
  },
  async handler({ conn, message, args }) {
    const from = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const text = (message.message.conversation || '') || (message.message.extendedTextMessage && message.message.extendedTextMessage.text) || '';
    const matched = text.trim().split(/\s+/);
    const cmd = matched[0].slice(1).toLowerCase();

    if (!isOwner(sender)) {
      await conn.sendMessage(from, { text: 'Owner-only command.' });
      return;
    }

    if (cmd === 'eval') {
      const code = text.slice(matched[0].length).trim();
      if (!code) return await conn.sendMessage(from, { text: 'Usage: .eval <js>' });
      try {
        const result = await eval(code); // extremely dangerous
        await conn.sendMessage(from, { text: 'Result:\n' + String(result) });
      } catch (err) {
        await conn.sendMessage(from, { text: 'Eval error:\n' + err.toString() });
      }
    } else if (cmd === 'restart') {
      await conn.sendMessage(from, { text: 'Restarting...' });
      process.exit(0);
    } else if (cmd === 'broadcast') {
      const payload = text.slice(matched[0].length).trim();
      if (!payload) return await conn.sendMessage(from, { text: 'Usage: .broadcast <text>' });
      try {
        const chats = Object.keys(conn.chats || {});
        let count = 0;
        for (const c of chats) {
          try {
            await conn.sendMessage(c, { text: payload });
            count++;
          } catch (e) {}
        }
        await conn.sendMessage(from, { text: `Broadcast sent to approximately ${count} chats.` });
      } catch (err) {
        await conn.sendMessage(from, { text: 'Broadcast failed: ' + err.message });
      }
    } else if (cmd === 'reload-plugins') {
      try {
        const newPlugins = loadPlugins();
        await conn.sendMessage(from, { text: `Reloaded plugins: ${newPlugins.size}` });
      } catch (err) {
        await conn.sendMessage(from, { text: 'Reload failed: ' + err.message });
      }
    }
  }
};