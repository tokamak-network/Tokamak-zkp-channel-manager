import { NextResponse } from "next/server";
import { Common, CommonOpts, Mainnet } from "@ethereumjs/common";
import {
  createAddressFromString,
  hexToBytes,
  bytesToHex,
} from "@ethereumjs/util";
// Import directly from specific modules to avoid stateManager dependency
import { createTokamakL2Tx } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/tx/constructors.ts";
import { TokamakL2TxData } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/tx/types.ts";
import { deriveL2KeysFromSignature } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/utils/web.ts";
import {
  poseidon,
  getEddsaPublicKey,
} from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/crypto/index.ts";
import { TokamakL2Tx } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/TokamakL2JS/tx/TokamakL2Tx.ts";

export const runtime = "nodejs";

interface CreateL2TransactionRequest {
  signature: `0x${string}`;
  nonce: number;
  to: `0x${string}`;
  callData: `0x${string}`;
}

// Helper function to serialize Common object
function serializeCommon(common: Common) {
  return {
    _eips: (common as any)._eips || [],
    _paramsCache: (common as any)._paramsCache || {},
    _activatedEIPsCache: (common as any)._activatedEIPsCache || [],
    _chainParams: {
      name: common.chainName(),
      chainId: Number(common.chainId()),
      defaultHardfork: (common as any).DEFAULT_HARDFORK || "prague",
    },
    DEFAULT_HARDFORK: (common as any).DEFAULT_HARDFORK || "prague",
    _hardfork: common.hardfork(),
    customCrypto: {
      keccak256: common.customCrypto?.keccak256?.name || "poseidon",
      ecrecover: common.customCrypto?.ecrecover?.name || "getEddsaPublicKey",
    },
  };
}

// Helper function to convert TokamakL2Tx to JSON-serializable format
function serializeTokamakL2Tx(tx: TokamakL2Tx) {
  return {
    type: tx.type,
    cache: (tx as any).cache || {},
    activeCapabilities: (tx as any).activeCapabilities || [],
    common: serializeCommon(tx.common),
    txOptions: {
      common: serializeCommon(tx.common),
    },
    to: {
      address: tx.to.toString(),
      bytes: Array.from(tx.to.bytes),
    },
    nonce: tx.nonce.toString(),
    gasLimit: tx.gasLimit.toString(),
    gasPrice: tx.gasPrice.toString(),
    value: tx.value.toString(),
    data: Array.from(tx.data),
    dataHex: bytesToHex(tx.data),
    senderPubKey: Array.from(tx.senderPubKeyUnsafe),
    senderPubKeyHex: bytesToHex(tx.senderPubKeyUnsafe),
    v: tx.v !== undefined ? tx.v.toString() : undefined,
    r: tx.r !== undefined ? tx.r.toString() : undefined,
    s: tx.s !== undefined ? tx.s.toString() : undefined,
    keccakFunction: (tx as any).keccakFunction?.name || "poseidon",
    isSigned: tx.isSigned(),
  };
}

export async function POST(req: Request) {
  try {
    const body: CreateL2TransactionRequest = await req.json();
    const { signature, nonce, to, callData } = body;

    // Validate inputs
    if (!signature || !to || callData === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: signature, to, callData" },
        { status: 400 }
      );
    }

    // Derive L2 keys from MetaMask signature
    const l2Keys = deriveL2KeysFromSignature(signature);
    const l2PrivateKey = l2Keys.privateKey;
    const l2PublicKey = l2Keys.publicKey;

    // Create common with custom crypto
    const commonOpts: CommonOpts = {
      chain: {
        ...Mainnet,
      },
      customCrypto: { keccak256: poseidon, ecrecover: getEddsaPublicKey },
    };
    const common = new Common(commonOpts);

    // Create transaction data
    const transactionData: TokamakL2TxData = {
      nonce: BigInt(nonce),
      to: createAddressFromString(to),
      data: hexToBytes(callData),
      senderPubKey: l2PublicKey,
    };

    // Create unsigned transaction
    const unsignedTransaction = createTokamakL2Tx(transactionData, { common });

    // Sign the transaction with L2 private key
    const signedTransaction = unsignedTransaction.sign(l2PrivateKey);

    // Serialize the signed transaction for RLP encoding
    const serializedTx = signedTransaction.serialize();

    return NextResponse.json({
      success: true,
      // Full transaction objects in the format matching TokamakL2Tx structure
      unsignedTransaction: serializeTokamakL2Tx(unsignedTransaction),
      signedTransaction: serializeTokamakL2Tx(signedTransaction),
      // Serialized RLP-encoded transaction for direct use
      serialized: bytesToHex(serializedTx),
      // L2 key information
      l2Keys: {
        privateKey: bytesToHex(l2PrivateKey),
        publicKey: bytesToHex(l2PublicKey),
      },
    });
  } catch (error) {
    console.error("Failed to create L2 signed transaction:", error);
    return NextResponse.json(
      {
        error: "Failed to create L2 signed transaction",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
