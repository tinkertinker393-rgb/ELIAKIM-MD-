/**
 * Utility helpers: execPromise, downloadWithYtdlp, sendMediaFile
 *
 * Note: This uses the yt-dlp binary (must be installed on the runner) and ffmpeg for media conversion.
 */
const { execFile } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const mime = require('mime-types');

function execPromise(file, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile(file, args, opts, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Download media using yt-dlp.
 * Returns { filePath, mimeType, tmpDir } on success.
 *
 * @param {string} url
 * @param {Object} options
 *  - format: yt-dlp format string (e.g., "bestaudio", "bestvideo")
 *  - outputExt: preferred extension (mp4, mp3)
 */
async function downloadWithYtdlp(url, options = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eli-dl-'));
  const outTemplate = path.join(tmpDir, 'out.%(ext)s');
  const format = options.format || 'bestaudio/best';
  // Build args
  const args = [
    url,
    '-f', format,
    '-o', outTemplate,
    '--no-playlist',
    '--no-warnings',
    '--no-color'
  ];
  if (options.restrictFilenames) args.push('--restrict-filenames');
  // run yt-dlp (binary must be in PATH)
  await execPromise('yt-dlp', args);
  // find downloaded file
  const files = await fs.readdir(tmpDir);
  if (!files || files.length === 0) throw new Error('yt-dlp did not produce a file');
  const f = files[0];
  const filePath = path.join(tmpDir, f);
  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  return { filePath, mimeType, tmpDir };
}

/**
 * Send a media file via Baileys connection.
 * Small helper to pick right message shape for the provided mimetype/extension.
 *
 * @param {import('@whiskeysockets/baileys').BaileysEventEmitter} conn
 * @param {string} jid
 * @param {string} filePath
 * @param {Object} options
 *  - asDocument: boolean
 *  - caption: string
 */
async function sendMediaFile(conn, jid, filePath, options = {}) {
  const asDocument = !!options.asDocument;
  const caption = options.caption || '';
  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  const stream = await fs.readFile(filePath);
  const message = {};
  if (mimeType.startsWith('image/') && !asDocument) {
    message.image = stream;
    if (caption) message.caption = caption;
  } else if (mimeType.startsWith('video/') && !asDocument) {
    message.video = stream;
    if (caption) message.caption = caption;
  } else if (mimeType.startsWith('audio/') && !asDocument) {
    message.audio = stream;
    message.ptt = false;
  } else {
    message.document = stream;
    message.mimetype = mimeType;
    message.fileName = path.basename(filePath);
  }
  return conn.sendMessage(jid, message);
}

module.exports = {
  execPromise,
  downloadWithYtdlp,
  sendMediaFile
};
