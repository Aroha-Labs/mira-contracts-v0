import {
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
  import { expect } from "chai";
  import hre from "hardhat";
  import { getAddress } from "viem";
  
  describe("InferenceStatsV0", function () {
    // We define a fixture to reuse the same setup in every test
    async function deployInferenceStatsFixture() {
      // Contracts are deployed using the first signer/account by default
      const [admin, otherAccount, user1, user2, user3] = await hre.viem.getWalletClients();
  
      const inferenceStats = await hre.viem.deployContract("InferenceStatsV0", []);
  
      const publicClient = await hre.viem.getPublicClient();
  
      return {
        inferenceStats,
        admin,
        otherAccount,
        user1,
        user2,
        user3,
        publicClient,
      };
    }
  
    describe("Deployment", function () {
      it("Should set the deployer as admin", async function () {
        const { inferenceStats, admin } = await loadFixture(deployInferenceStatsFixture);
  
        expect(await inferenceStats.read.admin()).to.equal(
          getAddress(admin.account.address)
        );
      });
    });
  
    describe("Admin functions", function () {
      describe("transferAdmin", function () {
        it("Should transfer admin to a new address", async function () {
          const { inferenceStats, admin, otherAccount } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const tx = await inferenceStats.write.transferAdmin([
            getAddress(otherAccount.account.address)
          ]);
  
          // Check if AdminTransferred event was emitted correctly
          const adminEvents = await inferenceStats.getEvents.AdminTransferred();
          expect(adminEvents).to.have.lengthOf(1);
          expect(adminEvents[0].args.previousAdmin).to.equal(getAddress(admin.account.address));
          expect(adminEvents[0].args.newAdmin).to.equal(getAddress(otherAccount.account.address));
  
          // Check if the admin was updated
          expect(await inferenceStats.read.admin()).to.equal(
            getAddress(otherAccount.account.address)
          );
        });
  
        it("Should revert if called by non-admin", async function () {
          const { inferenceStats, otherAccount } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const inferenceStatsAsOther = await hre.viem.getContractAt(
            "InferenceStatsV0",
            inferenceStats.address,
            { client: { wallet: otherAccount } }
          );
  
          await expect(
            inferenceStatsAsOther.write.transferAdmin([getAddress(otherAccount.account.address)])
          ).to.be.rejectedWith("Only admin can call this function");
        });
  
        it("Should revert if new admin is zero address", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          await expect(
            inferenceStats.write.transferAdmin(["0x0000000000000000000000000000000000000000"])
          ).to.be.rejectedWith("Invalid admin address");
        });
      });
    });
  
    describe("Statistics Management", function () {
      describe("writeStats", function () {
        it("Should emit StatsWritten event with correct parameters", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          const inferenceCount = 100n;
          const tokenCount = 5000n;
  
          const tx = await inferenceStats.write.writeStats([
            appId,
            inferenceCount,
            tokenCount
          ]);
          
          await publicClient.waitForTransactionReceipt({ hash: tx });
  
          // Check if StatsWritten event was emitted correctly
          const statsEvents = await inferenceStats.getEvents.StatsWritten();
          expect(statsEvents).to.have.lengthOf(1);
          
          const blockNumber = await publicClient.getBlock({ blockHash: statsEvents[0].blockHash }).then(block => block.number);
          
          expect(statsEvents[0].args.appId).to.equal(appId);
          expect(statsEvents[0].args.blockNumber).to.equal(blockNumber);
          expect(statsEvents[0].args.inferenceCount).to.equal(inferenceCount);
          expect(statsEvents[0].args.tokenCount).to.equal(tokenCount);
        });
        
        it("Should revert if called by non-admin", async function () {
          const { inferenceStats, otherAccount } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const inferenceStatsAsOther = await hre.viem.getContractAt(
            "InferenceStatsV0",
            inferenceStats.address,
            { client: { wallet: otherAccount } }
          );
  
          const appId = "test-app";
          const inferenceCount = 100n;
          const tokenCount = 5000n;
  
          await expect(
            inferenceStatsAsOther.write.writeStats([
              appId,
              inferenceCount,
              tokenCount
            ])
          ).to.be.rejectedWith("Only admin can call this function");
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "";
          const inferenceCount = 100n;
          const tokenCount = 5000n;
  
          await expect(
            inferenceStats.write.writeStats([
              appId,
              inferenceCount,
              tokenCount
            ])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
  
        it("Should successfully write multiple stats entries", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          
          // First entry
          const inferenceCount1 = 100n;
          const tokenCount1 = 5000n;
          
          const tx1 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount1,
            tokenCount1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Second entry with updated counts
          const inferenceCount2 = 200n;
          const tokenCount2 = 10000n;
          
          const tx2 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount2,
            tokenCount2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Verify each submission was successful by checking transaction receipts
          const receipt1 = await publicClient.getTransactionReceipt({ hash: tx1 });
          const receipt2 = await publicClient.getTransactionReceipt({ hash: tx2 });
          
          expect(receipt1.status).to.equal('success');
          expect(receipt2.status).to.equal('success');
          
          // Check stats count
          expect(await inferenceStats.read.getStatsCount([appId])).to.equal(2n);
        });
      });
  
      describe("getLatestStats", function () {
        it("Should return the latest stats entry", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          
          // Write first entry
          const inferenceCount1 = 100n;
          const tokenCount1 = 5000n;
          
          const tx1 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount1,
            tokenCount1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Write second entry
          const inferenceCount2 = 200n;
          const tokenCount2 = 10000n;
          
          const tx2 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount2,
            tokenCount2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Get the latest stats
          const latestStats = await inferenceStats.read.getLatestStats([appId]);
          
          // The latest stats should match the second entry
          expect(latestStats.inferenceCount).to.equal(inferenceCount2);
          expect(latestStats.tokenCount).to.equal(tokenCount2);
        });
  
        it("Should revert if no stats are available", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "nonexistent-app";
  
          await expect(
            inferenceStats.read.getLatestStats([appId])
          ).to.be.rejectedWith("No stats available");
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "";
  
          await expect(
            inferenceStats.read.getLatestStats([appId])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
      });
  
      describe("getStatsHistory", function () {
        it("Should return all stats entries for an app", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          
          // Write first entry
          const inferenceCount1 = 100n;
          const tokenCount1 = 5000n;
          
          const tx1 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount1,
            tokenCount1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Write second entry
          const inferenceCount2 = 200n;
          const tokenCount2 = 10000n;
          
          const tx2 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount2,
            tokenCount2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Get the stats history
          const statsHistory = await inferenceStats.read.getStatsHistory([appId]);
          
          // Should have 2 entries
          expect(statsHistory.length).to.equal(2);
          
          // First entry should match first write
          expect(statsHistory[0].inferenceCount).to.equal(inferenceCount1);
          expect(statsHistory[0].tokenCount).to.equal(tokenCount1);
          
          // Second entry should match second write
          expect(statsHistory[1].inferenceCount).to.equal(inferenceCount2);
          expect(statsHistory[1].tokenCount).to.equal(tokenCount2);
        });
  
        it("Should return empty array if no stats exist", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "nonexistent-app";
          
          // Get the stats history for a non-existent app
          const statsHistory = await inferenceStats.read.getStatsHistory([appId]);
          
          // Should be an empty array
          expect(statsHistory.length).to.equal(0);
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "";
  
          await expect(
            inferenceStats.read.getStatsHistory([appId])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
      });
  
      describe("getStatsByIndex", function () {
        it("Should return stats entry at specific index", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          
          // Write first entry
          const inferenceCount1 = 100n;
          const tokenCount1 = 5000n;
          
          const tx1 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount1,
            tokenCount1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Write second entry
          const inferenceCount2 = 200n;
          const tokenCount2 = 10000n;
          
          const tx2 = await inferenceStats.write.writeStats([
            appId,
            inferenceCount2,
            tokenCount2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Get the first stats entry
          const firstStats = await inferenceStats.read.getStatsByIndex([appId, 0n]);
          
          // Should match the first write
          expect(firstStats.inferenceCount).to.equal(inferenceCount1);
          expect(firstStats.tokenCount).to.equal(tokenCount1);
          
          // Get the second stats entry
          const secondStats = await inferenceStats.read.getStatsByIndex([appId, 1n]);
          
          // Should match the second write
          expect(secondStats.inferenceCount).to.equal(inferenceCount2);
          expect(secondStats.tokenCount).to.equal(tokenCount2);
        });
  
        it("Should revert if index is out of bounds", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          
          // Write one entry
          const inferenceCount = 100n;
          const tokenCount = 5000n;
          
          const tx = await inferenceStats.write.writeStats([
            appId,
            inferenceCount,
            tokenCount
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx });
          
          // Try to get an out-of-bounds index
          await expect(
            inferenceStats.read.getStatsByIndex([appId, 1n])
          ).to.be.rejectedWith("Index out of bounds");
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "";
  
          await expect(
            inferenceStats.read.getStatsByIndex([appId, 0n])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
      });
  
      describe("getStatsCount", function () {
        it("Should return correct count of stats entries", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "test-app";
          
          // Initially there should be no entries
          expect(await inferenceStats.read.getStatsCount([appId])).to.equal(0n);
          
          // Write first entry
          const tx1 = await inferenceStats.write.writeStats([
            appId,
            100n,
            5000n
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Now there should be one entry
          expect(await inferenceStats.read.getStatsCount([appId])).to.equal(1n);
          
          // Write second entry
          const tx2 = await inferenceStats.write.writeStats([
            appId,
            200n,
            10000n
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Now there should be two entries
          expect(await inferenceStats.read.getStatsCount([appId])).to.equal(2n);
        });
  
        it("Should return zero for non-existent app ID", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "nonexistent-app";
          
          // Should return 0 for an app with no stats
          expect(await inferenceStats.read.getStatsCount([appId])).to.equal(0n);
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceStats } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          const appId = "";
  
          await expect(
            inferenceStats.read.getStatsCount([appId])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
      });
  
      describe("Multiple apps", function () {
        it("Should handle multiple apps independently", async function () {
          const { inferenceStats, publicClient } = await loadFixture(
            deployInferenceStatsFixture
          );
  
          // App 1
          const appId1 = "test-app-1";
          const inferenceCount1 = 100n;
          const tokenCount1 = 5000n;
          
          // App 2
          const appId2 = "test-app-2";
          const inferenceCount2 = 200n;
          const tokenCount2 = 10000n;
          
          // Write stats for App 1
          const tx1 = await inferenceStats.write.writeStats([
            appId1,
            inferenceCount1,
            tokenCount1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Write stats for App 2
          const tx2 = await inferenceStats.write.writeStats([
            appId2,
            inferenceCount2,
            tokenCount2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // App 1 should have one entry
          expect(await inferenceStats.read.getStatsCount([appId1])).to.equal(1n);
          
          // App 2 should have one entry
          expect(await inferenceStats.read.getStatsCount([appId2])).to.equal(1n);
          
          // App 1's stats should be as expected
          const app1Stats = await inferenceStats.read.getLatestStats([appId1]);
          expect(app1Stats.inferenceCount).to.equal(inferenceCount1);
          expect(app1Stats.tokenCount).to.equal(tokenCount1);
          
          // App 2's stats should be as expected
          const app2Stats = await inferenceStats.read.getLatestStats([appId2]);
          expect(app2Stats.inferenceCount).to.equal(inferenceCount2);
          expect(app2Stats.tokenCount).to.equal(tokenCount2);
        });
      });
    });
  });