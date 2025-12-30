/**
 * .menu / .help command
 * Lists available plugins and usage by scanning the plugins directory.
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');

module.exports = {
  name: 'menu',
  help: {
    description: 'Show bot menu and available commands',
    usage: '.menu'
  },
  async handler({ conn, message }) {
    const jid = message.key.remoteJid;
    const pdir = path.resolve(config.PLUGIN_DIR);
    let helpText = `*${config.BOT_NAME} Menu*\n\n`;
    try {
      if (fs.existsSync(pdir)) {
        const files = fs.readdirSync(pdir).filter(f => f.endsWith('.js'));
        for (const f of files) {
          try {
            const plugin = require(path.join(pdir, f));
            if (plugin && plugin.help) {
              helpText += `*${plugin.help.usage || plugin.name}* — ${plugin.help.description || ''}\n`;
            } else {
              helpText += `*${f}* — (no help metadata)\n`;
            }
          } catch (err) {
            helpText += `*${f}* — (failed to load help)\n`;
          }
        }
      } else {
        helpText += '_No plugins installed._\n';
      }
    } catch (err) {
      helpText += `_Error reading plugins: ${err.message}_\n`;
    }

    helpText += `\nPrefix: ${config.PREFIXES.join(' ')}\nOwner-only commands: restricted\n`;
    await conn.sendMessage(jid, { text: helpText });
  }
};