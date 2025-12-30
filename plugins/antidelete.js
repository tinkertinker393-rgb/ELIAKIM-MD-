/**
 * Anti-delete scaffold:
 * - Keeps a short-term cache of incoming messages
 * - When a delete/revoke event arrives, reposts the cached message content
 */
const LRU = require('lru-cache');

const recent = new LRU({ max: 500, ttl: 1000 * 60 * 60 }); // 1 hour cache

module.exports = {
  name: 'antidelete',
  help: {
    description: 'Restores deleted messages in groups (anti-delete)',
    usage: '(automatic)'
  },
  async handler() {
    // Not a direct command; runtime uses the exported cache
  },
  cache: recent
};
