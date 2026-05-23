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

// @supabase/supabase-js v2.106+ added optional OpenTelemetry tracing. Metro
// resolves the package's "import" export condition and picks dist/index.mjs,
// which contains `import(variable)` — a dynamic import with a non-literal
// argument that Hermes cannot compile. Force it to the CJS build instead,
// which uses require(s) and compiles fine.
const path = require('path');
const originalResolveRequest = finalConfig.resolver.resolveRequest;
finalConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/@supabase/supabase-js/dist/index.cjs'),
      type: 'sourceFile',
    };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = finalConfig;
