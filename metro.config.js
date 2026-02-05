// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// Deshabilitar el serializer personalizado de Expo que causa problemas
// Esto soluciona el error: "The 'to' argument must be of type string. Received undefined"
config.serializer = {
  ...config.serializer,
  customSerializer: undefined,
};

module.exports = config;
