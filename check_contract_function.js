const { createPublicClient, http, getContract } = require('viem');
const { foundry } = require('viem/chains');

// You'll need to update these addresses
const BRIDGE_CORE_ADDRESS = '0x...'; // Your BridgeCore contract address
const RPC_URL = 'http://localhost:8545'; // Your RPC URL

// Bridge Core ABI - just the parts we need
const bridgeCoreABI = [
  {
    name: 'getTargetContractData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'targetContract', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'isRegistered', type: 'bool' },
          { name: 'registeredFunctions', type: 'tuple[]', components: [
            { name: 'functionSignature', type: 'bytes32' },
            { name: 'instancesHash', type: 'bytes32' },
            { name: 'preprocessedPart1', type: 'uint128[]' },
            { name: 'preprocessedPart2', type: 'uint256[]' }
          ]}
        ]
      }
    ]
  },
  {
    name: 'getChannelTargetContract',
    type: 'function', 
    stateMutability: 'view',
    inputs: [{ name: 'channelId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  }
];

async function checkContractFunction() {
  try {
    console.log('=== CHECKING CONTRACT FUNCTION DATA ===');
    
    // Create client
    const client = createPublicClient({
      chain: foundry, // or whatever chain you're using
      transport: http(RPC_URL)
    });

    const bridgeContract = getContract({
      address: BRIDGE_CORE_ADDRESS,
      abi: bridgeCoreABI,
      client
    });

    // Get target contract for channel 5
    const targetContract = await bridgeContract.read.getChannelTargetContract([5n]);
    console.log('Target contract for channel 5:', targetContract);

    // Get target contract data  
    const targetData = await bridgeContract.read.getTargetContractData([targetContract]);
    console.log('Target contract registered:', targetData.isRegistered);
    console.log('Number of registered functions:', targetData.registeredFunctions.length);

    // Display all registered functions
    for (let i = 0; i < targetData.registeredFunctions.length; i++) {
      const func = targetData.registeredFunctions[i];
      console.log(`\nFunction ${i}:`);
      console.log('  Function signature:', func.functionSignature);
      console.log('  Instance hash:', func.instancesHash);
      console.log('  Preprocessed part1 length:', func.preprocessedPart1.length);
      console.log('  Preprocessed part2 length:', func.preprocessedPart2.length);
    }

    // Expected hashes from our computation
    console.log('\n=== EXPECTED HASHES ===');
    console.log('Expected hash (index 64):', '0xd157cb883adb9cb0e27d9dc419e2a4be817d856281b994583b5bae64be94d35a');
    console.log('Expected hash (index 66):', '0x01971eb2577b2a3be6e747d91774dbb8498ecdc336b478587c7ffaa6880283d9');

  } catch (error) {
    console.error('Error checking contract:', error);
    console.log('\n=== MANUAL CHECK INSTRUCTIONS ===');
    console.log('Since the script failed, you can manually check using cast:');
    console.log(`cast call ${BRIDGE_CORE_ADDRESS} "getChannelTargetContract(uint256)" 5 --rpc-url ${RPC_URL}`);
    console.log('Then use the returned address to call:');
    console.log(`cast call ${BRIDGE_CORE_ADDRESS} "getTargetContractData(address)" <TARGET_ADDRESS> --rpc-url ${RPC_URL}`);
  }
}

// Also provide a simple function to compute hash for any function data
function computeHashFromArray(functionDataArray) {
  const { keccak256, encodePacked } = require('viem');
  
  const functionDataBigInts = functionDataArray.map(x => BigInt(x));
  const hash = keccak256(encodePacked(
    new Array(functionDataBigInts.length).fill('uint256'),
    functionDataBigInts
  ));
  
  return hash;
}

console.log('Expected instance hash (from our proof):', computeHashFromArray([
  '0x01', '0xffffffffffffffffffffffffffffffff', '0xffffffff', 
  // ... you can paste the full a_pub_function array here if needed
]));

checkContractFunction();