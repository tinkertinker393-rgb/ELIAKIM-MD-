/**
 * Group management commands (owner/admin only)
 * Commands:
 *  .kick @12345
 *  .add 1234567890
 *  .promote @12345
 *  .demote @12345
 *  .subject New subject here
 *
 * Note: This scaffold expects the sender to be group admin or owner.
 * Baileys method names vary by version; adjust if needed.
 */
const config = require('../config');

function isOwner(sender) {
  return config.OWNER && config.OWNER.includes(sender);
}

module.exports = {
  name: 'group',
  help: {
    description: 'Group admin commands: kick/add/promote/demote/subject',
    usage: '.kick @num | .add 1234567890 | .promote @num | .demote @num | .subject text'
  },
  async handler({ conn, message, args }) {
    const from = message.key.remoteJid;
    const text = (message.message.conversation || '') || (message.message.extendedTextMessage && message.message.extendedTextMessage.text) || '';
    const sender = message.key.participant || message.key.remoteJid;
    const matched = text.trim().split(/\s+/);
    const cmd = matched[0].slice(1).toLowerCase();

    if (!from.endsWith('@g.us')) {
      await conn.sendMessage(from, { text: 'This command must be used in a group.' });
      return;
    }

    // Only allow owner or group admin — here we simplify and allow owner only by default
    if (!isOwner(sender)) {
      await conn.sendMessage(from, { text: 'Owner-only for now. Add group admin checks if desired.' });
      return;
    }

    try {
      if (cmd === 'kick') {
        // expect mentions or numbers
        const mentions = message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.mentionedJid;
        const targets = mentions && mentions.length ? mentions : [matched[1] && (matched[1].includes('@') ? matched[1] : `${matched[1]}@s.whatsapp.net`)];
        await conn.groupParticipantsUpdate(from, targets, 'remove');
        await conn.sendMessage(from, { text: 'Removed: ' + targets.join(', ') });
      } else if (cmd === 'add') {
        const num = matched[1];
        if (!num) return await conn.sendMessage(from, { text: 'Usage: .add 1234567890' });
        const jid = num.includes('@') ? num : `${num}@s.whatsapp.net`;
        await conn.groupParticipantsUpdate(from, [jid], 'add');
        await conn.sendMessage(from, { text: 'Added: ' + jid });
      } else if (cmd === 'promote' || cmd === 'demote') {
        const mentions = message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.mentionedJid;
        const targets = mentions && mentions.length ? mentions : [matched[1] && (matched[1].includes('@') ? matched[1] : `${matched[1]}@s.whatsapp.net`)];
        const action = cmd === 'promote' ? 'promote' : 'demote';
        await conn.groupParticipantsUpdate(from, targets, action);
        await conn.sendMessage(from, { text: `${action}d: ${targets.join(', ')}` });
      } else if (cmd === 'subject') {
        const subject = text.slice(matched[0].length).trim();
        if (!subject) return await conn.sendMessage(from, { text: 'Usage: .subject New group subject' });
        // Baileys group update subject API
        await conn.groupUpdateSubject(from, subject);
        await conn.sendMessage(from, { text: 'Group subject updated.' });
      } else {
        await conn.sendMessage(from, { text: 'Unknown group command.' });
      }
    } catch (err) {
      console.error('group cmd error', err);
      await conn.sendMessage(from, { text: 'Group command failed: ' + (err.message || err) });
    }
  }
};