# ZK Proof Generation Assets

This directory contains the cryptographic assets required for client-side zero-knowledge proof generation.

## Structure

```
zk-assets/
├── zkey/                    # Trusted setup files (zkey format)
│   ├── circuit_final_16.zkey   # For 16-leaf merkle trees
│   ├── circuit_final_32.zkey   # For 32-leaf merkle trees
│   ├── circuit_final_64.zkey   # For 64-leaf merkle trees
│   └── circuit_final_128.zkey  # For 128-leaf merkle trees
│
└── wasm/                    # Compiled circuit WebAssembly files
    ├── circuit_N4.wasm         # For 16-leaf merkle trees
    ├── circuit_N5.wasm         # For 32-leaf merkle trees (TODO)
    ├── circuit_N6.wasm         # For 64-leaf merkle trees (TODO) 
    ├── circuit_N7.wasm         # For 128-leaf merkle trees (TODO)
    └── witness_calculator.js   # Witness calculation helper
```

## Current Status

✅ **16 leaves (N4)**: Fully supported with circuit_N4.wasm and circuit_final_16.zkey (12MB)
✅ **32 leaves (N5)**: Fully supported with circuit_N5.wasm and circuit_final_32.zkey (25MB)
✅ **64 leaves (N6)**: Fully supported - WASM local, zkey served from Cloudflare R2 (51MB)
✅ **128 leaves (N7)**: Fully supported - WASM local, zkey served from Cloudflare R2 (102MB)

**Production Ready**: All circuit sizes now work out of the box!
**Architecture**: Large zkey files hosted on Cloudflare R2, served via Next.js API proxy.

## Setup Instructions

### For 16-leaf trees (currently working):
Files are already copied and working.

### For all tree sizes (16, 32, 64, 128):
Everything is now set up and working automatically!

**Small circuits (16, 32)**: Files stored locally in git repository
**Large circuits (64, 128)**: Files hosted on Cloudflare R2, accessed via API proxy

**External URLs**:
- 64-leaf: `https://pub-30801471f84a46049e31eea6c3395e00.r2.dev/my-bucket/tokamak-zkp-channles/circuit_final_64.zkey`
- 128-leaf: `https://pub-30801471f84a46049e31eea6c3395e00.r2.dev/my-bucket/tokamak-zkp-channles/circuit_final_128.zkey`

**API Proxy**: `/api/proxy-large-zkey?size={64|128}` handles CORS and caching

### Browser Requirements

- **WebAssembly support**: All modern browsers
- **Memory requirements**:
  - 16 leaves: ~512MB RAM
  - 32 leaves: ~1GB RAM  
  - 64 leaves: ~2GB RAM
  - 128 leaves: ~4GB RAM

### Performance Notes

- Proof generation happens entirely in the browser
- No server-side dependencies required
- Works on Vercel and other serverless platforms
- Users need sufficient RAM for larger tree sizes

## Security

These files are cryptographic assets used for zero-knowledge proof generation:
- **zkey files**: Trusted setup ceremony outputs (publicly verifiable)
- **WASM files**: Compiled circuits (deterministic from source code)
- All files can be independently verified and regenerated