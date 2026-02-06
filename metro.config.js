// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Para EAS Build: usar serializer estándar de Metro
if (process.env.EAS_BUILD === 'true') {
  config.serializer = {
    ...config.serializer,
    customSerializer: undefined,
  };
}

module.exports = config;
