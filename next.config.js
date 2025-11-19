/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Support WASM modules
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });
    
    // Ensure WASM files are treated as assets
    config.module.rules.push({
      test: /tokamak_frost_wasm_bg\.wasm$/,
      type: 'asset/resource',
    });
    
    return config;
  },
};

module.exports = nextConfig;