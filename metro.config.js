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

// Apply NativeWind first, then layer our resolver on top so withNativeWind
// cannot overwrite it.
const finalConfig = withNativeWind(config, { input: './global.css' });

// @supabase/supabase-js v2.106+ optionally imports OpenTelemetry via a dynamic
// import(variable) expression that Hermes cannot compile. Stub it out so the
// build succeeds — we don't use tracing in the mobile app.
const originalResolveRequest = finalConfig.resolver.resolveRequest;
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@opentelemetry/')) {
    return { type: 'empty' };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = finalConfig;
