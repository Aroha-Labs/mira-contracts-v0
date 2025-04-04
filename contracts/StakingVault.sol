// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title StakingVault
 * @dev A ERC-4626 staking vault protected by initial deposit
 */
contract StakingVault is ERC4626 {
    address public immutable DEPLOYER;
    bool public initialized = false;
    
    // Constants for initialization
    uint256 public constant MIN_DEPOSIT_AMOUNT = 1e18; // Minimum initial deposit (1 full token)
    uint256 public constant MIN_DEPOSIT_SHARES = 1e18; // Fixed initial shares (1 full share token)

    /**
     * @dev Constructor for the StakingVault
     * @param _asset The address of the underlying asset to be staked
     * @param _name The name of the vault token
     * @param _symbol The symbol of the vault token
     */
    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) ERC4626(_asset) {
        DEPLOYER = msg.sender;
    }
    
    /**
     * @dev Function to initialize the vault with an initial deposit
     * @param initialAmount The amount of assets to deposit as protection
     */
    function initialize(uint256 initialAmount) external {
        require(!initialized, "Already initialized");
        require(msg.sender == DEPLOYER, "Only deployer");
        require(initialAmount >= MIN_DEPOSIT_AMOUNT, "Initial deposit too small");
        
        // Ensure deployer has approved the contract to spend tokens
        require(IERC20(asset()).transferFrom(msg.sender, address(this), initialAmount), "Transfer failed");
        
        // Mint fixed amount of shares to dead address
        _mint(address(1), MIN_DEPOSIT_SHARES);
        
        initialized = true;
    }
    
    /**
     * @dev Override deposit to ensure initialization
     */
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        require(initialized, "Not initialized");
        return super.deposit(assets, receiver);
    }
    
    /**
     * @dev Override mint to ensure initialization
     */
    function mint(uint256 shares, address receiver) public override returns (uint256) {
        require(initialized, "Not initialized");
        return super.mint(shares, receiver);
    }
}