const fs = require('fs');
const path = require('path');
const config = require('../config');

function loadPlugins() {
  const plugins = new Map();
  const pluginDir = path.resolve(config.PLUGIN_DIR);
  if (!fs.existsSync(pluginDir)) return plugins;

  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const pluginPath = path.join(pluginDir, file);
      delete require.cache[require.resolve(pluginPath)];
      const mod = require(pluginPath);
      if (mod && mod.name) {
        plugins.set(mod.name, mod);
        console.log(`Loaded plugin: ${mod.name}`);
      } else {
        console.log(`Skipped plugin (missing name): ${file}`);
      }
    } catch (err) {
      console.error(`Failed to load plugin ${file}:`, err);
    }
  }
  return plugins;
}

module.exports = { loadPlugins };
