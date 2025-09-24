// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import {Test, console2} from "forge-std/Test.sol";
import {ERC1967Proxy} from "lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "../src/RollupBridge.sol";
import "../src/verifier/Verifier.sol";
import "../src/interface/IZecFrost.sol";

import {IERC20Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/IERC20Upgradeable.sol";
import {ERC20Upgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC20/ERC20Upgradeable.sol";

/**
 * @title MockERC20Upgradeable
 * @dev Mock ERC20 token for testing purposes
 */
contract MockERC20Upgradeable is ERC20Upgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory name, string memory symbol) public initializer {
        __ERC20_init(name, symbol);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockVerifier
 * @dev Mock verifier for testing - always returns true
 */
contract MockVerifier is IVerifier {
    function verify(
        uint128[] calldata,
        uint256[] calldata,
        uint128[] calldata,
        uint256[] calldata,
        uint256[] calldata,
        uint256
    ) external pure returns (bool) {
        return true;
    }
}

contract MockZecFrost is IZecFrost {
    function verify(bytes32 message, uint256 pkx, uint256 pky, uint256 rx, uint256 ry, uint256 z)
        external
        view
        returns (address recovered)
    {
        // For testing purposes, just return the derived address from the public key
        return address(uint160(uint256(keccak256(abi.encodePacked(pkx, pky)))));
    }
}

/**
 * @title RollupBridgeV2
 * @dev V2 implementation for upgrade testing - adds new functionality
 */
contract RollupBridgeV2 is RollupBridge {
    // Additional events for V2
    event EmergencyPauseActivated();
    event BatchVerifierUpdate(address[] oldVerifiers, address[] newVerifiers);

    /**
     * @notice New function added in V2
     * @return version The contract version
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }

    /**
     * @notice New emergency pause functionality
     */
    function emergencyPause() external onlyOwner {
        // Emergency pause logic would go here
        emit EmergencyPauseActivated();
    }

    /**
     * @notice Enhanced verifier management - batch updates (V2 feature)
     * @param _newVerifiers Array of verifier addresses to cycle through
     * @dev Example of how V2 could add enhanced verifier management
     */
    function batchUpdateVerifiers(address[] calldata _newVerifiers) external onlyOwner {
        require(_newVerifiers.length > 0, "Empty verifiers array");

        // In a real implementation, this might store multiple verifiers
        // or implement a rotation system
        address[] memory oldVerifiers = new address[](1);
        oldVerifiers[0] = address(zkVerifier());

        // For demo, just update to the first verifier
        // Note: In a real implementation, we'd have a more sophisticated approach
        // Access storage directly since we're already in onlyOwner context
        require(_newVerifiers[0] != address(0), "Invalid verifier address");
        require(_newVerifiers[0] != oldVerifiers[0], "Same verifier address");

        RollupBridgeStorage storage $ = _getRollupBridgeStorage();
        $.zkVerifier = IVerifier(_newVerifiers[0]);

        emit VerifierUpdated(oldVerifiers[0], _newVerifiers[0]);
        emit BatchVerifierUpdate(oldVerifiers, _newVerifiers);
    }

    /**
     * @notice Get verifier info (V2 enhancement)
     * @return verifier Current verifier address
     * @return isValid Whether the verifier appears to be valid
     */
    function getVerifierInfo() external view returns (address verifier, bool isValid) {
        verifier = address(zkVerifier());
        // Basic validation - in real implementation might check interface support
        isValid = verifier != address(0) && verifier.code.length > 0;
    }
}

/**
 * @title BasicUpgradeableTest
 * @dev Basic test suite for UUPS upgradeable contracts using ERC1967Proxy directly
 */
contract BasicUpgradeableTest is Test {
    // Test addresses
    address public owner = makeAddr("owner");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public attacker = makeAddr("attacker");

    // Contract instances
    ERC1967Proxy public rollupBridgeProxy;
    MockERC20Upgradeable public token;
    MockVerifier public verifier;

    RollupBridge public rollupBridge;

    // Test data
    address public constant ETH_TOKEN_ADDRESS = address(1);

    event ChannelOpened(uint256 indexed channelId, address indexed targetContract);
    event Upgraded(address indexed implementation);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event BatchVerifierUpdate(address[] oldVerifiers, address[] newVerifiers);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock contracts
        verifier = new MockVerifier();

        // Deploy implementation contract
        RollupBridge rollupBridgeImpl = new RollupBridge();

        // Deploy proxy
        rollupBridgeProxy = new ERC1967Proxy(
            address(rollupBridgeImpl),
            abi.encodeCall(RollupBridge.initialize, (address(verifier), address(new MockZecFrost()), owner))
        );
        rollupBridge = RollupBridge(payable(address(rollupBridgeProxy)));

        // Deploy and setup mock ERC20
        MockERC20Upgradeable tokenImpl = new MockERC20Upgradeable();
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl), abi.encodeCall(MockERC20Upgradeable.initialize, ("Test Token", "TEST"))
        );
        token = MockERC20Upgradeable(address(tokenProxy));

        // Mint tokens for testing
        token.mint(user1, 1000 ether);
        token.mint(user2, 1000 ether);
        token.mint(user3, 1000 ether);

        vm.stopPrank();

        // Give users ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
    }

    // ============ Deployment Tests ============

    function test_InitialDeployment() public view {
        // Check RollupBridge initialization
        assertEq(rollupBridge.owner(), owner);
        assertEq(address(rollupBridge.zkVerifier()), address(verifier));
        assertEq(rollupBridge.nextChannelId(), 0);
    }

    function test_CannotInitializeTwice() public {
        vm.expectRevert();
        rollupBridge.initialize(address(verifier), address(0), owner);
    }

    // ============ Basic Functionality Tests ============

    function test_BasicChannelFlow() public {
        vm.startPrank(owner);

        // Authorize user1 as creator
        rollupBridge.authorizeCreator(user1);

        vm.stopPrank();
        vm.startPrank(user1);

        // Prepare channel data
        address[] memory participants = new address[](3);
        participants[0] = user1;
        participants[1] = user2;
        participants[2] = user3;

        address[] memory l2PublicKeys = new address[](3);
        l2PublicKeys[0] = makeAddr("l2user1");
        l2PublicKeys[1] = makeAddr("l2user2");
        l2PublicKeys[2] = makeAddr("l2user3");

        uint128[] memory preprocessedPart1 = new uint128[](2);
        preprocessedPart1[0] = 1;
        preprocessedPart1[1] = 2;

        uint256[] memory preprocessedPart2 = new uint256[](2);
        preprocessedPart2[0] = 3;
        preprocessedPart2[1] = 4;

        // Open channel
        vm.expectEmit(true, true, false, true);
        emit ChannelOpened(0, ETH_TOKEN_ADDRESS);

        IRollupBridge.ChannelParams memory params = IRollupBridge.ChannelParams({
            targetContract: ETH_TOKEN_ADDRESS,
            participants: participants,
            l2PublicKeys: l2PublicKeys,
            preprocessedPart1: preprocessedPart1,
            preprocessedPart2: preprocessedPart2,
            timeout: 1 hours,
            pkx: 0x4F6340CFDD930A6F54E730188E3071D150877FA664945FB6F120C18B56CE1C09,
            pky: 0x802A5E67C00A70D85B9A088EAC7CF5B9FB46AC5C0B2BD7D1E189FAC210F6B7EF
        });
        uint256 channelId = rollupBridge.openChannel(params);

        assertEq(channelId, 0);
        assertTrue(rollupBridge.isChannelLeader(user1));

        // Deposit ETH
        rollupBridge.depositETH{value: 1 ether}(channelId);
        assertEq(rollupBridge.getParticipantDeposit(channelId, user1), 1 ether);

        vm.stopPrank();
    }

    // ============ Manual Upgrade Tests ============

    function test_UpgradeRollupBridge() public {
        // Store initial state
        vm.prank(owner);
        rollupBridge.authorizeCreator(user1);

        assertTrue(rollupBridge.isAuthorizedCreator(user1));
        uint256 initialChannelId = rollupBridge.nextChannelId();

        // Deploy new implementation
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        vm.prank(owner);
        // Upgrade to V2 using upgradeTo (without calling)
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));

        RollupBridgeV2 rollupBridgeV2 = RollupBridgeV2(payable(address(rollupBridgeProxy)));

        // Check state preservation
        assertEq(rollupBridgeV2.owner(), owner);
        assertEq(address(rollupBridgeV2.zkVerifier()), address(verifier));
        assertTrue(rollupBridgeV2.isAuthorizedCreator(user1));
        assertEq(rollupBridgeV2.nextChannelId(), initialChannelId);

        // Test new functionality
        assertEq(rollupBridgeV2.version(), "2.0.0");

        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit RollupBridgeV2.EmergencyPauseActivated();
        rollupBridgeV2.emergencyPause();
    }

    // ============ Access Control Tests ============

    function test_OnlyOwnerCanUpgrade() public {
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        vm.prank(attacker);
        vm.expectRevert();
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));
    }

    // ============ Storage Layout Tests ============

    function test_StorageLayoutPreservation() public {
        // Setup initial state with complex data
        vm.startPrank(owner);
        rollupBridge.authorizeCreator(user1);
        rollupBridge.authorizeCreator(user2);
        vm.stopPrank();

        // Create a channel with deposits
        vm.startPrank(user1);

        address[] memory participants = new address[](3);
        participants[0] = user1;
        participants[1] = user2;
        participants[2] = user3;

        address[] memory l2PublicKeys = new address[](3);
        l2PublicKeys[0] = makeAddr("l2user1");
        l2PublicKeys[1] = makeAddr("l2user2");
        l2PublicKeys[2] = makeAddr("l2user3");

        uint128[] memory preprocessedPart1 = new uint128[](2);
        preprocessedPart1[0] = 100;
        preprocessedPart1[1] = 200;

        uint256[] memory preprocessedPart2 = new uint256[](2);
        preprocessedPart2[0] = 300;
        preprocessedPart2[1] = 400;

        IRollupBridge.ChannelParams memory params = IRollupBridge.ChannelParams({
            targetContract: address(token),
            participants: participants,
            l2PublicKeys: l2PublicKeys,
            preprocessedPart1: preprocessedPart1,
            preprocessedPart2: preprocessedPart2,
            timeout: 2 hours,
            pkx: 0x4F6340CFDD930A6F54E730188E3071D150877FA664945FB6F120C18B56CE1C09,
            pky: 0x802A5E67C00A70D85B9A088EAC7CF5B9FB46AC5C0B2BD7D1E189FAC210F6B7EF
        });
        uint256 channelId = rollupBridge.openChannel(params);

        // Approve and deposit tokens
        token.approve(address(rollupBridgeProxy), 100 ether);
        rollupBridge.depositToken(channelId, address(token), 50 ether);

        vm.stopPrank();

        // Store pre-upgrade state
        (
            address targetContract,
            IRollupBridge.ChannelState state,
            uint256 participantCount,
            bytes32 initialRoot,
            bytes32 finalRoot
        ) = rollupBridge.getChannelInfo(channelId);

        uint256 deposit = rollupBridge.getParticipantDeposit(channelId, user1);
        uint256 nextChannelId = rollupBridge.nextChannelId();
        bool isAuthorizedUser1 = rollupBridge.isAuthorizedCreator(user1);
        bool isAuthorizedUser2 = rollupBridge.isAuthorizedCreator(user2);
        bool isLeader = rollupBridge.isChannelLeader(user1);

        // Upgrade contract
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        vm.prank(owner);
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));

        RollupBridgeV2 rollupBridgeV2 = RollupBridgeV2(payable(address(rollupBridgeProxy)));

        // Verify all state preserved after upgrade
        (
            address newTargetContract,
            IRollupBridge.ChannelState newState,
            uint256 newParticipantCount,
            bytes32 newInitialRoot,
            bytes32 newFinalRoot
        ) = rollupBridgeV2.getChannelInfo(channelId);

        assertEq(newTargetContract, targetContract);
        assertEq(uint256(newState), uint256(state));
        assertEq(newParticipantCount, participantCount);
        assertEq(newInitialRoot, initialRoot);
        assertEq(newFinalRoot, finalRoot);

        assertEq(rollupBridgeV2.getParticipantDeposit(channelId, user1), deposit);
        assertEq(rollupBridgeV2.nextChannelId(), nextChannelId);
        assertEq(rollupBridgeV2.isAuthorizedCreator(user1), isAuthorizedUser1);
        assertEq(rollupBridgeV2.isAuthorizedCreator(user2), isAuthorizedUser2);
        assertEq(rollupBridgeV2.isChannelLeader(user1), isLeader);

        // Verify contracts still work after upgrade
        vm.startPrank(user2);
        token.approve(address(rollupBridgeProxy), 100 ether);
        rollupBridgeV2.depositToken(channelId, address(token), 25 ether);
        assertEq(rollupBridgeV2.getParticipantDeposit(channelId, user2), 25 ether);
        vm.stopPrank();
    }

    // ============ Integration Tests ============

    function test_FullChannelLifecycleAfterUpgrade() public {
        // Upgrade contract first
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        vm.startPrank(owner);
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));

        RollupBridgeV2 rollupBridgeV2 = RollupBridgeV2(payable(address(rollupBridgeProxy)));

        // Authorize user1 as creator
        rollupBridgeV2.authorizeCreator(user1);
        vm.stopPrank();

        // Test full channel lifecycle with upgraded contracts
        vm.startPrank(user1);

        // Open channel
        address[] memory participants = new address[](3);
        participants[0] = user1;
        participants[1] = user2;
        participants[2] = user3;

        address[] memory l2PublicKeys = new address[](3);
        l2PublicKeys[0] = makeAddr("l2user1");
        l2PublicKeys[1] = makeAddr("l2user2");
        l2PublicKeys[2] = makeAddr("l2user3");

        uint128[] memory preprocessedPart1 = new uint128[](1);
        preprocessedPart1[0] = 1;

        uint256[] memory preprocessedPart2 = new uint256[](1);
        preprocessedPart2[0] = 1;

        IRollupBridge.ChannelParams memory params = IRollupBridge.ChannelParams({
            targetContract: ETH_TOKEN_ADDRESS,
            participants: participants,
            l2PublicKeys: l2PublicKeys,
            preprocessedPart1: preprocessedPart1,
            preprocessedPart2: preprocessedPart2,
            timeout: 1 hours,
            pkx: 0x4F6340CFDD930A6F54E730188E3071D150877FA664945FB6F120C18B56CE1C09,
            pky: 0x802A5E67C00A70D85B9A088EAC7CF5B9FB46AC5C0B2BD7D1E189FAC210F6B7EF
        });
        uint256 channelId = rollupBridgeV2.openChannel(params);

        // Deposit ETH
        rollupBridgeV2.depositETH{value: 1 ether}(channelId);

        vm.stopPrank();

        // Other users deposit
        vm.prank(user2);
        rollupBridgeV2.depositETH{value: 2 ether}(channelId);

        vm.prank(user3);
        rollupBridgeV2.depositETH{value: 1.5 ether}(channelId);

        // Initialize channel state
        vm.prank(user1);
        rollupBridgeV2.initializeChannelState(channelId);

        // Verify channel state
        (, IRollupBridge.ChannelState state,,,) = rollupBridgeV2.getChannelInfo(channelId);
        assertEq(uint256(state), uint256(IRollupBridge.ChannelState.Open));

        // Test new V2 functionality
        assertEq(rollupBridgeV2.version(), "2.0.0");
    }

    // ============ Verifier Update Tests ============

    function test_UpdateVerifier() public {
        // Deploy new mock verifier
        MockVerifier newVerifier = new MockVerifier();
        address oldVerifier = address(rollupBridge.zkVerifier());

        // Update verifier (owner only)
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit VerifierUpdated(oldVerifier, address(newVerifier));
        rollupBridge.updateVerifier(address(newVerifier));

        // Verify verifier was updated
        assertEq(address(rollupBridge.zkVerifier()), address(newVerifier));
        assertTrue(address(rollupBridge.zkVerifier()) != oldVerifier);
    }

    function test_UpdateVerifierOnlyOwner() public {
        MockVerifier newVerifier = new MockVerifier();

        // Non-owner cannot update verifier
        vm.prank(attacker);
        vm.expectRevert();
        rollupBridge.updateVerifier(address(newVerifier));

        // User cannot update verifier
        vm.prank(user1);
        vm.expectRevert();
        rollupBridge.updateVerifier(address(newVerifier));
    }

    function test_UpdateVerifierInvalidAddress() public {
        // Cannot set verifier to zero address
        vm.prank(owner);
        vm.expectRevert("Invalid verifier address");
        rollupBridge.updateVerifier(address(0));
    }

    function test_UpdateVerifierSameAddress() public {
        address currentVerifier = address(rollupBridge.zkVerifier());

        // Cannot update to same address
        vm.prank(owner);
        vm.expectRevert("Same verifier address");
        rollupBridge.updateVerifier(currentVerifier);
    }

    function test_VerifierUpdatePreservesState() public {
        // Setup initial state
        vm.prank(owner);
        rollupBridge.authorizeCreator(user1);

        // Deploy new verifier
        MockVerifier newVerifier = new MockVerifier();

        // Update verifier
        vm.prank(owner);
        rollupBridge.updateVerifier(address(newVerifier));

        // Verify state is preserved
        assertTrue(rollupBridge.isAuthorizedCreator(user1));
        assertEq(rollupBridge.nextChannelId(), 0);
        assertEq(rollupBridge.owner(), owner);
    }

    function test_VerifierUpdateAfterUpgrade() public {
        // First upgrade the contract
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        vm.prank(owner);
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));

        RollupBridgeV2 rollupBridgeV2 = RollupBridgeV2(payable(address(rollupBridgeProxy)));

        // Then update verifier on upgraded contract
        MockVerifier newVerifier = new MockVerifier();
        address oldVerifier = address(rollupBridgeV2.zkVerifier());

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit VerifierUpdated(oldVerifier, address(newVerifier));
        rollupBridgeV2.updateVerifier(address(newVerifier));

        // Verify update worked
        assertEq(address(rollupBridgeV2.zkVerifier()), address(newVerifier));

        // Verify V2 functionality still works
        assertEq(rollupBridgeV2.version(), "2.0.0");
    }

    function test_V2VerifierEnhancements() public {
        // Upgrade to V2 first
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        vm.prank(owner);
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));

        RollupBridgeV2 rollupBridgeV2 = RollupBridgeV2(payable(address(rollupBridgeProxy)));

        // Test V2 verifier info function
        (address currentVerifier, bool isValid) = rollupBridgeV2.getVerifierInfo();
        assertTrue(isValid);
        assertTrue(currentVerifier != address(0));

        // Test batch verifier update
        address[] memory newVerifiers = new address[](2);
        newVerifiers[0] = address(new MockVerifier());
        newVerifiers[1] = address(new MockVerifier());

        address oldVerifier = address(rollupBridgeV2.zkVerifier());

        vm.prank(owner);
        rollupBridgeV2.batchUpdateVerifiers(newVerifiers);

        // Verify verifier was updated to first in array
        assertEq(address(rollupBridgeV2.zkVerifier()), newVerifiers[0]);

        // Verify it's different from the old one
        assertTrue(address(rollupBridgeV2.zkVerifier()) != oldVerifier);
    }

    // ============ Gas Usage Tests ============

    function test_UpgradeGasCost() public {
        RollupBridgeV2 rollupBridgeV2Impl = new RollupBridgeV2();

        uint256 gasBefore = gasleft();

        vm.prank(owner);
        rollupBridge.upgradeTo(address(rollupBridgeV2Impl));

        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for RollupBridge upgrade:", gasUsed);

        // Upgrade should be reasonable (less than 200k gas)
        assertLt(gasUsed, 200_000);
    }

    receive() external payable {}
}
