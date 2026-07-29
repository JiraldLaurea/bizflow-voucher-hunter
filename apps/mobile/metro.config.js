const { getDefaultConfig } = require("expo/metro-config");

// Expo SDK 52+ discovers npm workspaces automatically. Keeping the standard
// Expo config avoids duplicate React Native copies while still transpiling
// @bizflow/shared through Metro.
module.exports = getDefaultConfig(__dirname);
