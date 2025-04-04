// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title InferenceStatsV0
 * @dev Stores statistics for each application's inference activity
 */
contract InferenceStatsV0 {
    // Admin address - initialized to deployer
    address public admin;

    struct StatEntry {
        uint256 blockNumber;
        uint256 inferenceCount;
        uint256 tokenCount;
    }

    // Mapping from appId to array of StatEntry
    mapping(string => StatEntry[]) public appStats;

    // Events
    event StatsWritten(
        string appId,
        uint256 blockNumber,
        uint256 inferenceCount,
        uint256 tokenCount
    );

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
     * @dev Write statistics for an app
     * @param appId The application identifier
     * @param inferenceCount Cumulative inference count
     * @param tokenCount Cumulative token count
     */
    function writeStats(
        string memory appId,
        uint256 inferenceCount,
        uint256 tokenCount
    ) external onlyAdmin {
        require(bytes(appId).length > 0, "App ID cannot be empty");
        
        StatEntry memory entry = StatEntry({
            blockNumber: block.number,
            inferenceCount: inferenceCount,
            tokenCount: tokenCount
        });
        
        appStats[appId].push(entry);
        
        emit StatsWritten(appId, block.number, inferenceCount, tokenCount);
    }

    /**
     * @dev Get the latest statistics for an app
     * @param appId The application identifier
     * @return StatEntry The latest statistics entry
     */
    function getLatestStats(string memory appId) external view returns (StatEntry memory) {
        require(bytes(appId).length > 0, "App ID cannot be empty");
        require(appStats[appId].length > 0, "No stats available");
        
        uint256 length = appStats[appId].length;
        return appStats[appId][length - 1];
    }

    /**
     * @dev Get the complete statistics history for an app
     * @param appId The application identifier
     * @return StatEntry[] Array of all statistic entries
     */
    function getStatsHistory(string memory appId) external view returns (StatEntry[] memory) {
        require(bytes(appId).length > 0, "App ID cannot be empty");
        return appStats[appId];
    }

    /**
     * @dev Get statistics at a specific index for an app
     * @param appId The application identifier
     * @param index The index of the statistic entry to retrieve
     * @return StatEntry The statistic entry at the specified index
     */
    function getStatsByIndex(string memory appId, uint256 index) external view returns (StatEntry memory) {
        require(bytes(appId).length > 0, "App ID cannot be empty");
        require(index < appStats[appId].length, "Index out of bounds");
        
        return appStats[appId][index];
    }

    /**
     * @dev Get the number of statistics entries for an app
     * @param appId The application identifier
     * @return uint256 The number of statistic entries
     */
    function getStatsCount(string memory appId) external view returns (uint256) {
        require(bytes(appId).length > 0, "App ID cannot be empty");
        return appStats[appId].length;
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