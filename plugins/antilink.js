/**
 * Anti-link plugin (simple)
 * - Detects WhatsApp group invite links and warns or removes
 * - Toggle via config or extend with per-group settings
 */
const config = require('../config');
const linkRegex = /(chat\.whatsapp\.com\/[A-Za-z0-9]+)/i;

module.exports = {
  name: 'antilink',
  help: {
    description: 'Detects group invite links and warns or removes the sender (automatic)',
    usage: '(automatic)'
  },
  async handler({ conn, message }) {
    const jid = message.key.remoteJid;
    const text = (message.message.conversation || '') || (message.message.extendedTextMessage && message.message.extendedTextMessage.text) || '';
    if (!text) return;
    if (linkRegex.test(text)) {
      const sender = message.key.participant || message.key.remoteJid;
      if (config.OWNER && config.OWNER.includes(sender)) {
        // allow owner
        return;
      }
      await conn.sendMessage(jid, { text: `@${sender.split('@')[0]} Posting group invite links is not allowed.`, mentions: [sender] });
      // Optionally remove: conn.groupParticipantsUpdate(jid, [sender], 'remove')
    }
  }
};
