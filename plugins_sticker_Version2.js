// Example sticker plugin (skeleton).
// Requires ffmpeg on the runner. This plugin assumes an image was sent and saves it to temp file,
// then converts using ffmpeg -> webp and sends back as sticker.
// This is a simplified example; production code should handle edge cases and cleanup.

const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const mime = require('mime-types');

module.exports = {
  name: 'sticker',
  help: {
    description: 'Convert image to sticker (send image with caption .sticker)',
    usage: '.sticker'
  },
  async handler({ conn, message, args }) {
    try {
      const jid = message.key.remoteJid;
      const messageType = Object.keys(message.message || {})[0];
      let mediaMessage = null;

      if (messageType === 'imageMessage') {
        mediaMessage = message.message.imageMessage;
      } else if (messageType === 'documentMessage' && message.message.documentMessage.mimetype && message.message.documentMessage.mimetype.startsWith('image/')) {
        mediaMessage = message.message.documentMessage;
      } else {
        await conn.sendMessage(jid, { text: 'Please send an image with the caption .sticker' });
        return;
      }

      const buffer = await conn.downloadMediaMessage(message);
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'elia-stk-'));
      const input = path.join(tmpDir, 'in');
      const output = path.join(tmpDir, 'out.webp');
      await fs.writeFile(input, buffer);

      await new Promise((resolve, reject) => {
        ffmpeg(input)
          .outputOptions([
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
            '-lossless', '1',
            '-compression_level', '6',
            '-qscale', '70'
          ])
          .duration(10)
          .save(output)
          .on('end', resolve)
          .on('error', reject);
      });

      const webpBuff = await fs.readFile(output);
      await conn.sendMessage(jid, { sticker: webpBuff });
      await fs.remove(tmpDir);
    } catch (err) {
      console.error('sticker handler error', err);
      try {
        await conn.sendMessage(message.key.remoteJid, { text: 'Failed to create sticker: ' + err.message });
      } catch (e) {}
    }
  }
};