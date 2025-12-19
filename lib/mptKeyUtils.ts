/**
 * MPT Key Generation Utilities
 * 
 * This module provides utilities for generating MPT keys that match
 * the on-chain deposit process.
 */
import "server-only";
import { deriveL2AddressFromKeys, deriveL2KeysFromSignature, deriveL2MptKeyFromAddress } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/utils/web";
import { bytesToHex } from "@ethereumjs/util";

export const deriveL2MptKeyFromSignature = (signature: `0x${string}`, slotIndex: number): `0x${string}` => {
  const keys = deriveL2KeysFromSignature(signature);
  const address = deriveL2AddressFromKeys(keys);
  return deriveL2MptKeyFromAddress(address, slotIndex);
}

export const deriveL2KeysAndAddressFromSignature = (signature: `0x${string}`, slotIndex: number) => {
  const keys = deriveL2KeysFromSignature(signature);
  const address = deriveL2AddressFromKeys(keys);
  const mptKey = deriveL2MptKeyFromAddress(address, slotIndex);
  
  return {
    privateKey: bytesToHex(keys.privateKey),
    publicKey: bytesToHex(keys.publicKey),
    l2Address: address,
    mptKey,
  };
}
