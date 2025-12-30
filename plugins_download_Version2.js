/**
 * .yt or .download command
 * Usage:
 *  .yt <youtube_url>         -> download best video (short)
 *  .yta <youtube_url>        -> download audio only (mp3)
 *
 * This uses yt-dlp binary present in PATH.
 * Large files should be handled carefully (size limits). This is a basic scaffold.
 */
const { downloadWithYtdlp, sendMediaFile } = require('../lib/utils');
const path = require('path');
const fs = require('fs-extra');

module.exports = {
  name: 'yt',
  help: {
    description: 'Download YouTube video or audio. Use .yta for audio only',
    usage: '.yt <url> | .yta <url>'
  },
  async handler({ conn, message, args }) {
    const jid = message.key.remoteJid;
    const text = (message.message.conversation || '') || (message.message.extendedTextMessage && message.message.extendedTextMessage.text) || '';
    const cmd = text.trim().split(/\s+/)[0].slice(1).toLowerCase();
    const url = args[0];
    if (!url) {
      await conn.sendMessage(jid, { text: 'Usage: .yt <url> or .yta <url>' });
      return;
    }
    try {
      await conn.sendMessage(jid, { text: 'Processing download, please wait...' });
      if (cmd === 'yta') {
        // audio only
        const { filePath, mimeType, tmpDir } = await downloadWithYtdlp(url, { format: 'bestaudio', restrictFilenames: true });
        await sendMediaFile(conn, jid, filePath, { asDocument: false, caption: 'Here is your audio' });
        await fs.remove(tmpDir);
      } else {
        // video (best)
        const { filePath, mimeType, tmpDir } = await downloadWithYtdlp(url, { format: 'bestvideo+bestaudio/best', restrictFilenames: true });
        await sendMediaFile(conn, jid, filePath, { asDocument: false, caption: 'Here is your video' });
        await fs.remove(tmpDir);
      }
    } catch (err) {
      console.error('download error', err);
      await conn.sendMessage(jid, { text: 'Download failed: ' + (err.message || err) });
    }
  }
};