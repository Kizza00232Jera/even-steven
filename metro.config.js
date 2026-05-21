const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude .sandcastle worktrees — they contain Docker-created node_modules
// with Linux permissions that Metro cannot traverse on Windows.
config.resolver.blockList = [/.*\.sandcastle.*/];

module.exports = withNativeWind(config, { input: './global.css' });
