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
⚠️ **64 leaves (N6)**: WASM available, zkey requires setup (GitHub size limit: 51MB)
⚠️ **128 leaves (N7)**: WASM available, zkey requires setup (GitHub size limit: 102MB)

**Local Development**: 16 and 32-leaf circuits work out of the box. Larger circuits need setup.
**GitHub Limitation**: Files >50MB cannot be stored in git. Large zkey files need external hosting.

## Setup Instructions

### For 16-leaf trees (currently working):
Files are already copied and working.

### For 32-leaf trees:
Already set up and working.

### For 64 and 128-leaf trees:
1. Generate the large zkey files from `Tokamak-Zk-EVM/packages/BLS12-Poseidon-Merkle-tree-Groth16/circuits/`
2. Place them in `/public/zk-assets/zkey/` directory:
   - `circuit_final_64.zkey` (51MB) 
   - `circuit_final_128.zkey` (102MB)
3. For production, host these files externally (S3, CDN, IPFS)

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