// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title AppRegistryV0
 * @dev Manages the registry of authorized applications for the Inference Tracking System
 */
contract AppRegistryV0 {
    // Admin address - initialized to deployer
    address public admin;
    struct AppInfo {
        uint256 registrationBlock;
        bool isActive;
    }
    // Mapping from appId to AppInfo
    mapping(string => AppInfo) public appRegistry;
    
    // Array to store all registered appIds
    string[] public appIds;
    // Events
    event AppRegistered(string appId, uint256 registrationBlock);
    event AppStatusUpdated(string appId, bool isActive);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

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
     * @dev Register a new application with a unique ID
     * @param appId Unique identifier for the application
     */
    function registerApp(string memory appId) external onlyAdmin {
        require(bytes(appId).length > 0, "App ID cannot be empty");
        require(appRegistry[appId].registrationBlock == 0, "App ID already registered");
        
        appRegistry[appId] = AppInfo({
            registrationBlock: block.number,
            isActive: true
        });
        
        appIds.push(appId);
        
        emit AppRegistered(appId, block.number);
    }

    /**
     * @dev Update the active status of a registered application
     * @param appId Identifier of the application to update
     * @param isActive New active status
     */
    function updateAppStatus(string memory appId, bool isActive) external onlyAdmin {
        require(appRegistry[appId].registrationBlock > 0, "App ID not registered");
        
        appRegistry[appId].isActive = isActive;
        
        emit AppStatusUpdated(appId, isActive);
    }

    /**
     * @dev Check if an app ID is registered and active
     * @param appId The app ID to check
     * @return bool True if the app is registered and active
     */
    function isAppActive(string memory appId) external view returns (bool) {
        return appRegistry[appId].isActive && appRegistry[appId].registrationBlock > 0;
    }

    /**
     * @dev Get the total number of registered apps
     * @return uint256 The number of registered apps
     */
    function getAppCount() external view returns (uint256) {
        return appIds.length;
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