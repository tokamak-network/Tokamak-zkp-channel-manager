/**
 * MPT Key Generation Utilities
 * 
 * This module provides utilities for generating MPT keys that match
 * the on-chain deposit process.
 */
import { deriveL2AddressFromKeys, deriveL2KeysFromSignature, deriveL2MptKeyFromAddress } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/utils/web";
import { addHexPrefix, bigIntToBytes, bytesToHex, concatBytes, createAddressFromString, hexToBytes, setLengthLeft } from "@ethereumjs/util";
import { TokamakL2Tx } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/tx/TokamakL2Tx";
import { ERC20_TRANSFER, TON_TOKEN_ADDRESS } from "./contracts";
import { Common, CommonOpts, Mainnet } from "@ethereumjs/common";
import { getEddsaPublicKey, poseidon } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/crypto";
import { TokamakL2TxData } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/tx/types";
import { createTokamakL2Tx } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/tx/constructors";

export type DerivedL2Account = {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;
  l2Address: `0x${string}`;
  mptKey: `0x${string}`;
}

export const deriveL2MptKeyFromSignature = (signature: `0x${string}`, slotIndex: number): `0x${string}` => {
  const keys = deriveL2KeysFromSignature(signature);
  const address = deriveL2AddressFromKeys(keys);
  return deriveL2MptKeyFromAddress(address, slotIndex);
}

export const deriveL2KeysAndAddressFromSignature = (signature: `0x${string}`, slotIndex: number): DerivedL2Account => {
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

// Create common with custom crypto
const commonOpts: CommonOpts = {
    chain: {
    ...Mainnet,
    },
    customCrypto: { keccak256: poseidon, ecrecover: getEddsaPublicKey },
};
export const tokamakL2Common = new Common(commonOpts);

// Create a signed TON transfer TX
export const createERC20TransferTx = async (
    nonce: number,
    recipient: `0x${string}`,
    amount: bigint,
    keySeed: `0x${string}`,
    to: `0x${string}`,

): Promise<TokamakL2Tx> => {
    const account = deriveL2KeysAndAddressFromSignature(keySeed, ERC20_TRANSFER[TON_TOKEN_ADDRESS].slot);

    const calldata = concatBytes(
      setLengthLeft(hexToBytes(ERC20_TRANSFER[TON_TOKEN_ADDRESS].selector), 4),
      setLengthLeft(hexToBytes(recipient), 32),
      setLengthLeft(bigIntToBytes(amount), 32),
    );
    
    // Create transaction data
    const transactionData: TokamakL2TxData = {
        nonce: BigInt(nonce),
        to: createAddressFromString(to),
        data: calldata,
        senderPubKey: hexToBytes(account.publicKey),
    };

    // Create unsigned transaction
    const unsignedTransaction = createTokamakL2Tx(transactionData, { common: tokamakL2Common });

    // Sign the transaction with L2 private key
    return unsignedTransaction.sign(hexToBytes(addHexPrefix(account.privateKey)));
}
