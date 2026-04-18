// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub out `react-native-ping` because thermal printer libraries import it
// for optional network/IP printing — we only use Bluetooth. This avoids
// the Metro "Unable to resolve react-native-ping" bundling error without
// installing an extra native module.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'react-native-ping': path.resolve(__dirname, 'shims/react-native-ping.js'),
};

module.exports = config;
