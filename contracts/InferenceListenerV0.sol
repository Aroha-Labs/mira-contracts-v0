// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title InferenceListenerV0
 * @dev Receives inference logs and emits events without storing data on-chain
 */
contract InferenceListenerV0 {
    // Admin address - initialized to deployer
    address public admin;
    
    // Rate limiting: max submissions per block per app
    uint256 public maxSubmissionsPerBlock = 100;
    
    // Track submissions per block per app to enforce rate limiting
    mapping(string => mapping(uint256 => uint256)) private submissionsCount;

    // Events
    event InferenceLog(
        uint256 blockNumber,
        string appId,
        address userWallet,
        bytes32 logHash
    );

    event BatchInferenceLogs(
        uint256 blockNumber,
        string appId,
        address[] userWallets,
        bytes32[] logHashes,
        uint256 count
    );

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event MaxSubmissionsUpdated(uint256 previousLimit, uint256 newLimit);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    /**
     * @dev Constructor sets deployer as admin
     */
    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Submit a single inference log
     * @param appId The application identifier
     * @param userWallet The user's wallet address
     * @param logHash Hash of the inference log data
     */
    function submitInferenceLog(
        string memory appId,
        address userWallet,
        bytes32 logHash
    ) external onlyAdmin {
        // Check rate limiting
        require(
            submissionsCount[appId][block.number] < maxSubmissionsPerBlock,
            "Rate limit exceeded for this block"
        );
        
        // Increment submission count for this block
        submissionsCount[appId][block.number]++;
        
        // Validate inputs
        require(bytes(appId).length > 0, "App ID cannot be empty");
        require(userWallet != address(0), "Invalid user wallet address");
        require(logHash != bytes32(0), "Invalid log hash");
        
        // Emit the event without storing data
        emit InferenceLog(block.number, appId, userWallet, logHash);
    }

    /**
     * @dev Submit multiple inference logs in a batch
     * @param appId The application identifier
     * @param userWallets Array of user wallet addresses
     * @param logHashes Array of inference log hashes
     */
    function submitBatchInferenceLogs(
        string memory appId,
        address[] memory userWallets,
        bytes32[] memory logHashes
    ) external onlyAdmin {
        // Validate input lengths match
        uint256 count = userWallets.length;
        require(count > 0, "Empty batch");
        require(count == logHashes.length, "Array length mismatch");
        
        // Check rate limiting
        require(
            submissionsCount[appId][block.number] + count <= maxSubmissionsPerBlock,
            "Rate limit exceeded for this block"
        );
        
        // Increment submission count for this block
        submissionsCount[appId][block.number] += count;
        
        // Validate app ID
        require(bytes(appId).length > 0, "App ID cannot be empty");
        
        // Validate each input in the arrays
        for (uint256 i = 0; i < count; i++) {
            require(userWallets[i] != address(0), "Invalid user wallet address");
            require(logHashes[i] != bytes32(0), "Invalid log hash");
        }
        
        // Emit batch event
        emit BatchInferenceLogs(block.number, appId, userWallets, logHashes, count);
    }

    /**
     * @dev Update the maximum submissions per block for rate limiting
     * @param newLimit New maximum submissions limit
     */
    function updateMaxSubmissions(uint256 newLimit) external onlyAdmin {
        require(newLimit > 0, "Limit must be greater than zero");
        
        uint256 previousLimit = maxSubmissionsPerBlock;
        maxSubmissionsPerBlock = newLimit;
        
        emit MaxSubmissionsUpdated(previousLimit, newLimit);
    }

    /**
     * @dev Transfer admin privileges to another wallet address
     * @param newAdmin Address of the new admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        
        address previousAdmin = admin;
        admin = newAdmin;
        
        emit AdminTransferred(previousAdmin, newAdmin);
    }
}