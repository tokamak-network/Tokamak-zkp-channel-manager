const { createConfig, readContracts } = require('@wagmi/core');
const { createPublicClient, http } = require('viem');
const { sepolia } = require('viem/chains');
const fs = require('node:fs');
const path = require('node:path');

const envFilePath = path.join(process.cwd(), '.env.local');

function readEnvValue(key) {
  try {
    const contents = fs.readFileSync(envFilePath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) {
        continue;
      }
      const envKey = trimmed.slice(0, equalsIndex).trim();
      if (envKey !== key) {
        continue;
      }
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
}

const rpcUrl = process.env.NEXT_ETHERS_RPC_URL || readEnvValue('NEXT_ETHERS_RPC_URL');
if (!rpcUrl) {
  throw new Error('NEXT_ETHERS_RPC_URL is not set in .env.local');
}

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl)
});
createConfig({ publicClient });

const ROLLUP_BRIDGE_ADDRESS = '0x23f7b07686866d5bcbfc6c0815aeb02bcbd1ac46';

async function testMptKey() {
  try {
    console.log('Testing getL2MptKey...');
    
    // Test with basic parameters
    const [resultData] = await readContracts({
      contracts: [
        {
          address: ROLLUP_BRIDGE_ADDRESS,
          abi: [{
            inputs: [
              { name: 'channelId', type: 'uint256' },
              { name: 'participant', type: 'address' },
              { name: 'token', type: 'address' }
            ],
            name: 'getL2MptKey',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'getL2MptKey',
          args: [BigInt(0), '0x15759359e60a3b9e59eA7A96D10Fa48829f83bEb', '0x0000000000000000000000000000000000000001']
        }
      ]
    });
    const result = resultData?.result;
    
    console.log('Result:', result?.toString() || '0');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Try to get more details about the error
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

testMptKey();
