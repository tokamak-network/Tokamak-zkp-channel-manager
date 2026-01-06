

import { NUMBER_OF_PREV_BLOCK_HASHES } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/interface/qapCompiler/importedConstants";
import { getBlockInfoFromRPC } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/interface/rpc/rpc";
import { SynthesizerBlockInfo } from "@/Tokamak-Zk-EVM/packages/frontend/synthesizer/src/synthesizer/types";
import { Common } from "@ethereumjs/common";
import { addHexPrefix, hexToBytes } from "@ethereumjs/util";
import { ethers } from "ethers";
import bridgeContractAbi from "./bridge-contract-abi";
import { ROLLUP_BRIDGE_CORE_ABI, ROLLUP_BRIDGE_CORE_ADDRESS } from "./contracts";

export const getBlockInfo = async (
    rpcUrl: string,
    blockNumber: number,
): Promise<SynthesizerBlockInfo> => {
    return await getBlockInfoFromRPC(
        rpcUrl, 
        blockNumber, 
        NUMBER_OF_PREV_BLOCK_HASHES,
    );
}

export const getBlockNumber = async (
    rpcUrl: string,
    initTxHash: `0x${string}`,
): Promise<number> => {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tx = await provider.getTransaction(initTxHash);
    if (tx === null || tx.blockNumber === null) {
        throw new Error('Initialize transaction not found or not yet mined');
    }
    return tx.blockNumber
}

export const getContractCode = async (
    rpcUrl: string,
    contractAddress: `0x${string}`,
    blockNumber: number,
): Promise<Uint8Array> => {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const byteCodeStr = await provider.getCode(contractAddress, blockNumber);
    return hexToBytes(addHexPrefix(byteCodeStr))
}

export async function fetchChannelData(
    rpcUrl: string,
    channelId: number,
): Promise<{
    participants: string[];
    registeredKeys: string[];
    storageEntries: Array<{ key: string; value: string }>;
    contractAddress: string;
    preAllocatedLeaves: Array<{ key: string; value: string }>;
    initialRoot: string;
}> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const bridgeContract = new ethers.Contract(ROLLUP_BRIDGE_CORE_ADDRESS, ROLLUP_BRIDGE_CORE_ABI, provider);

    // Get channel info
    const [targetAddress, state, participantCount, initialRoot] = await bridgeContract.getChannelInfo(channelId);
    const participants: string[] = await bridgeContract.getChannelParticipants(channelId);

    const registeredKeys: string[] = [];
    // Fetch pre-allocated leaves
    const preAllocatedKeysFromContract = await bridgeContract.getPreAllocatedKeys(targetAddress);
    const preAllocatedLeaves: Array<{ key: string; value: string }> = [];

    for (const key of preAllocatedKeysFromContract) {
        let keyHex: string;
        if (typeof key === 'string') {
        keyHex = key.startsWith('0x') ? key : '0x' + key;
        if (keyHex.length < 66) {
            const hexPart = keyHex.slice(2);
            keyHex = '0x' + hexPart.padStart(64, '0');
        }
        } else {
        keyHex = '0x' + key.toString(16).padStart(64, '0');
        }

        const [value, exists] = await bridgeContract.getPreAllocatedLeaf(targetAddress, key);
        let valueHex: string;
        if (typeof value === 'string') {
        valueHex = value.startsWith('0x') ? value : '0x' + value;
        if (valueHex.length < 66) {
            const hexPart = valueHex.slice(2);
            valueHex = '0x' + hexPart.padStart(64, '0');
        }
        } else {
        valueHex = '0x' + value.toString(16).padStart(64, '0');
        }

        registeredKeys.push(keyHex);

        if (exists) {
        preAllocatedLeaves.push({ key: keyHex, value: valueHex });
        }
    }

    // Fetch participants' MPT keys and deposits
    const storageEntries: Array<{ key: string; value: string }> = [];

    for (let i = 0; i < participants.length; i++) {
        const l1Address = participants[i];
        const onChainMptKeyBigInt = await bridgeContract.getL2MptKey(channelId, l1Address);
        const onChainMptKeyHex = '0x' + onChainMptKeyBigInt.toString(16).padStart(64, '0');
        const deposit = await bridgeContract.getParticipantDeposit(channelId, l1Address);

        registeredKeys.push(onChainMptKeyHex);

        const depositHex = '0x' + deposit.toString(16).padStart(64, '0');
        storageEntries.push({
        key: onChainMptKeyHex,
        value: depositHex,
        });
    }

    return {
        participants,
        registeredKeys,
        storageEntries,
        contractAddress: targetAddress,
        preAllocatedLeaves,
        initialRoot,
    };
}

