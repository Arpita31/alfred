const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce file watching to minimum
config.watchFolders = [];
config.resolver.nodeModulesPath = [];
config.watchOptions = {
  ignored: /node_modules/,
  poll: 1000,
};

module.exports = config;