const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude .sandcastle worktrees and test files — worktrees contain Docker-created
// node_modules with Linux permissions; test files import Node built-ins that crash
// the React Native runtime when Metro bundles them.
config.resolver.blockList = [
  /.*\.sandcastle.*/,
  /.*\/__tests__\/.*/,
  /.*\.test\.[jt]sx?$/,
  /.*\.spec\.[jt]sx?$/,
];

module.exports = withNativeWind(config, { input: './global.css' });
