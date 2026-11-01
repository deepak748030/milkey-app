const fs = require('node:fs');
const path = require('node:path');

function parseEnvFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const values = {};
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;

      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, '').trim();
      }
      values[match[1]] = value;
    }
    return values;
  } catch {
    return {};
  }
}

// Expo runs from milkey-app/, while the Vite web app uses the repository root.
// Read both env locations so a single root .env works for local web, Expo web,
// and local APK builds. Shell / EAS variables always take precedence.
const envFromFiles = {
  ...parseEnvFile(path.resolve(__dirname, '../.env')),
  ...parseEnvFile(path.resolve(__dirname, '../.env.local')),
  ...parseEnvFile(path.resolve(__dirname, '.env')),
  ...parseEnvFile(path.resolve(__dirname, '.env.local')),
};

const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  envFromFiles.EXPO_PUBLIC_API_URL ||
  envFromFiles.VITE_API_URL ||
  envFromFiles.API_URL ||
  ''
).trim();

// Also expose it through Expo Constants so the same resolved URL survives APK
// builds, where Metro's process.env substitution may not have a local .env file.
if (apiUrl) process.env.EXPO_PUBLIC_API_URL = apiUrl;

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    apiBaseUrl: apiUrl,
  },
});
