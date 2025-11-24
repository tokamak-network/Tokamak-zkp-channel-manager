const { createPublicClient, http } = require('viem');
const { sepolia } = require('viem/chains');

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://eth-sepolia.g.alchemy.com/v2/N-Gnpjy1WvCfokwj6fiOfuAVL_At6IvE')
});

const ROLLUP_BRIDGE_ADDRESS = '0x23f7b07686866d5bcbfc6c0815aeb02bcbd1ac46';

async function testMptKey() {
  try {
    console.log('Testing getL2MptKey...');
    
    // Test with basic parameters
    const result = await publicClient.readContract({
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
    });
    
    console.log('Result:', result.toString());
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Try to get more details about the error
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

testMptKey();