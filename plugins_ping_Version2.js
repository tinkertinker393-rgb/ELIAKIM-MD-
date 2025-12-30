module.exports = {
  name: 'ping',
  help: {
    description: 'Responds with ELIAKIM-MD is Active!',
    usage: '.ping'
  },
  async handler({ conn, message, args }) {
    const sender = message.key && (message.key.participant || message.key.remoteJid);
    const to = message.key.remoteJid;
    await conn.sendMessage(to, { text: 'ELIAKIM-MD is Active!' });
  }
};