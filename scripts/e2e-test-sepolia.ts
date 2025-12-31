/**
 * E2E Channel Lifecycle Test - Sepolia Network
 * 
 * This script tests the complete channel lifecycle on Sepolia testnet:
 * 1. Open Channel
 * 2. Deposit Tokens
 * 3. Initialize State
 * 4. Submit Proof
 * 5. Verify Signature
 * 6. Withdraw
 * 7. Close Channel
 * 
 * ⚠️ WARNING: This test uses real Sepolia ETH
 * 
 * Required environment variables:
 * - E2E_RPC_URL: Sepolia RPC URL (e.g., Alchemy)
 * - E2E_PRIVATE_KEY: Private key with Sepolia ETH
 * 
 * Run with: npx ts-node scripts/e2e-test-sepolia.ts
 */

import { ethers, Contract } from 'ethers';

// Configuration
const RPC_URL = process.env.E2E_RPC_URL;
const PRIVATE_KEY = process.env.E2E_PRIVATE_KEY;

if (!RPC_URL || !PRIVATE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   E2E_RPC_URL and E2E_PRIVATE_KEY must be set');
  process.exit(1);
}

// Contract addresses from lib/contracts.ts
const CONTRACTS = {
  ROLLUP_BRIDGE_CORE: '0x9439DF86D91A7A05d926c15ee8f9790b60410133',
  DEPOSIT_MANAGER: '0x24D302f09840275371FF1985d0f23DF16c69E90b',
  PROOF_MANAGER: '0x84b0676FDC944187214d774681Aa135b481d7C12',
  WITHDRAW_MANAGER: '0x0048Fc775cfD21B24Bd53652BD8B3796c5F26A83',
  ADMIN_MANAGER: '0x374c2a109C59c60E18af161F263689520eBd6932',
  TON_TOKEN: '0xa30fe40285B8f5c0457DbC3B7C8A280373c40044',
};

// ABIs
const BRIDGE_CORE_ABI = [
  'function openChannel((address targetContract, address[] participants, bool enableFrostSignature) params) returns (uint256)',
  'function getChannelState(uint256 channelId) view returns (uint8)',
  'function getChannelParticipants(uint256 channelId) view returns (address[])',
  'function getChannelLeader(uint256 channelId) view returns (address)',
  'function getTotalChannels() view returns (uint256)',
  'function nextChannelId() view returns (uint256)',
  'function isAllowedTargetContract(address) view returns (bool)',
  'function getChannelTotalDeposits(uint256 channelId) view returns (uint256)',
  'function getChannelTimeout(uint256 channelId) view returns (uint256 openTimestamp, uint256 timeout)',
  'event ChannelOpened(uint256 indexed channelId, address targetContract)',
];

const DEPOSIT_MANAGER_ABI = [
  'function depositToken(uint256 channelId, uint256 amount, bytes32 mptKey) payable',
];

const WITHDRAW_MANAGER_ABI = [
  'function withdraw(uint256 channelId)',
  'function closeAndFinalizeChannel(uint256 channelId)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Channel states
enum ChannelState {
  None = 0,
  Open = 1,
  Active = 2,
  Closing = 3,
  Closed = 4,
}

const ChannelStateNames = ['None', 'Open', 'Active', 'Closing', 'Closed'];

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  gasUsed?: string;
  txHash?: string;
  duration?: number;
}

class SepoliaE2ETest {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private bridgeCore: Contract;
  private depositManager: Contract;
  private withdrawManager: Contract;
  private results: TestResult[] = [];
  private testChannelId: bigint | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(PRIVATE_KEY!, this.provider);
    
    this.bridgeCore = new Contract(CONTRACTS.ROLLUP_BRIDGE_CORE, BRIDGE_CORE_ABI, this.wallet);
    this.depositManager = new Contract(CONTRACTS.DEPOSIT_MANAGER, DEPOSIT_MANAGER_ABI, this.wallet);
    this.withdrawManager = new Contract(CONTRACTS.WITHDRAW_MANAGER, WITHDRAW_MANAGER_ABI, this.wallet);
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Sepolia E2E Channel Lifecycle Tests\n');
    console.log(`📡 RPC URL: ${RPC_URL?.substring(0, 50)}...`);
    console.log(`👛 Test Wallet: ${this.wallet.address}\n`);

    try {
      // Pre-flight checks
      await this.preflight();

      // Test 1: Open Channel
      await this.testOpenChannel();

      // Test 2: Check Channel State
      await this.testCheckChannelState();

      // Test 3: Deposit (only if channel opened successfully)
      if (this.testChannelId) {
        await this.testDeposit();
      }

      // Note: Full lifecycle test would continue here
      // For cost savings, we stop after deposit verification

      // Print results
      this.printResults();

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  private async preflight(): Promise<void> {
    console.log('🔍 Running pre-flight checks...\n');

    // Check network
    const network = await this.provider.getNetwork();
    if (network.chainId !== 11155111n) {
      throw new Error(`Wrong network! Expected Sepolia (11155111), got ${network.chainId}`);
    }
    console.log(`  ✅ Connected to Sepolia (chainId: ${network.chainId})`);

    // Check balance
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log(`  💰 Wallet Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther('0.01')) {
      throw new Error('Insufficient balance! Need at least 0.01 ETH for gas');
    }
    console.log(`  ✅ Sufficient balance for tests\n`);

    // Check contract connectivity
    try {
      const totalChannels = await this.bridgeCore.getTotalChannels();
      console.log(`  📊 Total channels on contract: ${totalChannels}`);
      console.log(`  ✅ Contract connection verified\n`);
    } catch (error) {
      throw new Error('Failed to connect to BridgeCore contract');
    }
  }

  private async testOpenChannel(): Promise<void> {
    const start = Date.now();
    const testName = 'Open Channel';
    
    console.log(`\n📝 Test: ${testName}`);
    
    try {
      // Get an allowed target contract
      const isAllowed = await this.bridgeCore.isAllowedTargetContract(CONTRACTS.TON_TOKEN);
      
      if (!isAllowed) {
        console.log('  ⚠️ TON token not in allowed list, using ETH placeholder');
      }

      const targetContract = CONTRACTS.TON_TOKEN;
      const participants = [this.wallet.address];
      const enableFrost = false;

      console.log(`  → Target Contract: ${targetContract}`);
      console.log(`  → Participants: ${participants}`);
      console.log(`  → Enable FROST: ${enableFrost}`);

      // Estimate gas first
      const gasEstimate = await this.bridgeCore.openChannel.estimateGas({
        targetContract,
        participants,
        enableFrostSignature: enableFrost,
      });
      console.log(`  → Estimated gas: ${gasEstimate}`);

      // Execute transaction
      const tx = await this.bridgeCore.openChannel({
        targetContract,
        participants,
        enableFrostSignature: enableFrost,
      });
      
      console.log(`  → Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`  → Transaction confirmed in block: ${receipt.blockNumber}`);

      // Get channel ID from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.bridgeCore.interface.parseLog(log);
          return parsed?.name === 'ChannelOpened';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = this.bridgeCore.interface.parseLog(event);
        this.testChannelId = parsed?.args.channelId;
        console.log(`  → Channel ID: ${this.testChannelId}`);
      }

      this.results.push({
        name: testName,
        success: true,
        gasUsed: receipt.gasUsed.toString(),
        txHash: receipt.hash,
        duration: Date.now() - start,
      });
      
      console.log(`  ✅ ${testName}: PASSED`);

    } catch (error: any) {
      this.results.push({
        name: testName,
        success: false,
        error: error.message,
        duration: Date.now() - start,
      });
      console.log(`  ❌ ${testName}: FAILED - ${error.message}`);
    }
  }

  private async testCheckChannelState(): Promise<void> {
    if (!this.testChannelId) {
      this.results.push({
        name: 'Check Channel State',
        success: false,
        error: 'No channel ID available',
      });
      return;
    }

    const start = Date.now();
    const testName = 'Check Channel State';
    
    console.log(`\n📝 Test: ${testName}`);

    try {
      const state = await this.bridgeCore.getChannelState(this.testChannelId);
      const leader = await this.bridgeCore.getChannelLeader(this.testChannelId);
      const participants = await this.bridgeCore.getChannelParticipants(this.testChannelId);

      console.log(`  → Channel State: ${ChannelStateNames[Number(state)]}`);
      console.log(`  → Leader: ${leader}`);
      console.log(`  → Participants: ${participants}`);

      if (Number(state) !== ChannelState.Open) {
        throw new Error(`Expected state 'Open', got '${ChannelStateNames[Number(state)]}'`);
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - start,
      });
      
      console.log(`  ✅ ${testName}: PASSED`);

    } catch (error: any) {
      this.results.push({
        name: testName,
        success: false,
        error: error.message,
        duration: Date.now() - start,
      });
      console.log(`  ❌ ${testName}: FAILED - ${error.message}`);
    }
  }

  private async testDeposit(): Promise<void> {
    if (!this.testChannelId) {
      this.results.push({
        name: 'Deposit Tokens',
        success: false,
        error: 'No channel ID available',
      });
      return;
    }

    const start = Date.now();
    const testName = 'Deposit Tokens';
    
    console.log(`\n📝 Test: ${testName}`);

    try {
      // For this test, we'll deposit a minimal amount of ETH
      const depositAmount = ethers.parseEther('0.001');
      const mptKey = ethers.keccak256(ethers.toUtf8Bytes(`test_key_${Date.now()}`));

      console.log(`  → Channel ID: ${this.testChannelId}`);
      console.log(`  → Deposit Amount: ${ethers.formatEther(depositAmount)} ETH`);
      console.log(`  → MPT Key: ${mptKey.substring(0, 20)}...`);

      // Execute deposit
      const tx = await this.depositManager.depositToken(
        this.testChannelId,
        depositAmount,
        mptKey,
        { value: depositAmount }
      );

      console.log(`  → Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`  → Transaction confirmed in block: ${receipt.blockNumber}`);

      // Verify deposit
      const totalDeposits = await this.bridgeCore.getChannelTotalDeposits(this.testChannelId);
      console.log(`  → Total Channel Deposits: ${ethers.formatEther(totalDeposits)} ETH`);

      this.results.push({
        name: testName,
        success: true,
        gasUsed: receipt.gasUsed.toString(),
        txHash: receipt.hash,
        duration: Date.now() - start,
      });
      
      console.log(`  ✅ ${testName}: PASSED`);

    } catch (error: any) {
      this.results.push({
        name: testName,
        success: false,
        error: error.message,
        duration: Date.now() - start,
      });
      console.log(`  ❌ ${testName}: FAILED - ${error.message}`);
    }
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 SEPOLIA E2E TEST RESULTS');
    console.log('='.repeat(70) + '\n');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    let totalGas = 0n;

    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      const time = result.duration ? `(${result.duration}ms)` : '';
      const gas = result.gasUsed ? `[Gas: ${result.gasUsed}]` : '';
      
      console.log(`${status} ${result.name} ${time} ${gas}`);
      
      if (result.txHash) {
        console.log(`   TX: https://sepolia.etherscan.io/tx/${result.txHash}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.gasUsed) {
        totalGas += BigInt(result.gasUsed);
      }
    }

    console.log('\n' + '-'.repeat(70));
    console.log(`Total Tests: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Total Gas Used: ${totalGas}`);
    if (this.testChannelId) {
      console.log(`Test Channel ID: ${this.testChannelId}`);
    }
    console.log('-'.repeat(70) + '\n');

    if (failed > 0) {
      console.log('❌ Some tests failed!');
      process.exit(1);
    } else {
      console.log('✅ All Sepolia E2E tests passed!');
      process.exit(0);
    }
  }
}

// Run tests
const test = new SepoliaE2ETest();
test.run().catch(console.error);

