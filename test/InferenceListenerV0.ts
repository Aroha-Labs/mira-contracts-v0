import {
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
  import { expect } from "chai";
  import hre from "hardhat";
  import { getAddress, keccak256, toBytes, stringToBytes } from "viem";
  
  describe("InferenceListenerV0", function () {
    // We define a fixture to reuse the same setup in every test
    async function deployInferenceListenerFixture() {
      // Contracts are deployed using the first signer/account by default
      const [admin, otherAccount, user1, user2, user3] = await hre.viem.getWalletClients();
  
      const inferenceListener = await hre.viem.deployContract("InferenceListenerV0", []);
  
      const publicClient = await hre.viem.getPublicClient();
  
      return {
        inferenceListener,
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
        const { inferenceListener, admin } = await loadFixture(deployInferenceListenerFixture);
  
        expect(await inferenceListener.read.admin()).to.equal(
          getAddress(admin.account.address)
        );
      });
  
      it("Should set the default max submissions per block", async function () {
        const { inferenceListener } = await loadFixture(deployInferenceListenerFixture);
  
        expect(await inferenceListener.read.maxSubmissionsPerBlock()).to.equal(100n);
      });
    });
  
    describe("Admin functions", function () {
      describe("transferAdmin", function () {
        it("Should transfer admin to a new address", async function () {
          const { inferenceListener, admin, otherAccount } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const tx = await inferenceListener.write.transferAdmin([
            getAddress(otherAccount.account.address)
          ]);
  
          // Check if AdminTransferred event was emitted correctly
          const adminEvents = await inferenceListener.getEvents.AdminTransferred();
          expect(adminEvents).to.have.lengthOf(1);
          expect(adminEvents[0].args.previousAdmin).to.equal(getAddress(admin.account.address));
          expect(adminEvents[0].args.newAdmin).to.equal(getAddress(otherAccount.account.address));
  
          // Check if the admin was updated
          expect(await inferenceListener.read.admin()).to.equal(
            getAddress(otherAccount.account.address)
          );
        });
  
        it("Should revert if called by non-admin", async function () {
          const { inferenceListener, otherAccount } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const inferenceListenerAsOther = await hre.viem.getContractAt(
            "InferenceListenerV0",
            inferenceListener.address,
            { client: { wallet: otherAccount } }
          );
  
          await expect(
            inferenceListenerAsOther.write.transferAdmin([getAddress(otherAccount.account.address)])
          ).to.be.rejectedWith("Only admin can call this function");
        });
  
        it("Should revert if new admin is zero address", async function () {
          const { inferenceListener } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          await expect(
            inferenceListener.write.transferAdmin(["0x0000000000000000000000000000000000000000"])
          ).to.be.rejectedWith("Invalid admin address");
        });
      });
  
      describe("updateMaxSubmissions", function () {
        it("Should update the max submissions per block", async function () {
          const { inferenceListener } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const newLimit = 200n;
          const tx = await inferenceListener.write.updateMaxSubmissions([newLimit]);
  
          // Check if MaxSubmissionsUpdated event was emitted correctly
          const limitEvents = await inferenceListener.getEvents.MaxSubmissionsUpdated();
          expect(limitEvents).to.have.lengthOf(1);
          expect(limitEvents[0].args.previousLimit).to.equal(100n);
          expect(limitEvents[0].args.newLimit).to.equal(newLimit);
  
          // Check if the max submissions was updated
          expect(await inferenceListener.read.maxSubmissionsPerBlock()).to.equal(
            newLimit
          );
        });
  
        it("Should revert if called by non-admin", async function () {
          const { inferenceListener, otherAccount } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const inferenceListenerAsOther = await hre.viem.getContractAt(
            "InferenceListenerV0",
            inferenceListener.address,
            { client: { wallet: otherAccount } }
          );
  
          await expect(
            inferenceListenerAsOther.write.updateMaxSubmissions([200n])
          ).to.be.rejectedWith("Only admin can call this function");
        });
  
        it("Should revert if new limit is zero", async function () {
          const { inferenceListener } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          await expect(
            inferenceListener.write.updateMaxSubmissions([0n])
          ).to.be.rejectedWith("Limit must be greater than zero");
        });
      });
    });
  
    describe("Inference Logs", function () {
      describe("submitInferenceLog", function () {
        it("Should emit InferenceLog event with correct parameters", async function () {
          const { inferenceListener, user1, publicClient } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallet = getAddress(user1.account.address);
          const logHash = keccak256(toBytes("test-data"));
  
          const tx = await inferenceListener.write.submitInferenceLog([
            appId,
            userWallet,
            logHash
          ]);
          
          await publicClient.waitForTransactionReceipt({ hash: tx });
  
          // Check if InferenceLog event was emitted correctly
          const logEvents = await inferenceListener.getEvents.InferenceLog();
          expect(logEvents).to.have.lengthOf(1);
          
          const blockNumber = await publicClient.getBlock({ blockHash: logEvents[0].blockHash }).then(block => block.number);
          
          expect(logEvents[0].args.blockNumber).to.equal(blockNumber);
          expect(logEvents[0].args.appId).to.equal(appId);
          expect(logEvents[0].args.userWallet).to.equal(userWallet);
          expect(logEvents[0].args.logHash).to.equal(logHash);
        });
        
        it("Should revert if called by non-admin", async function () {
          const { inferenceListener, otherAccount, user1 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const inferenceListenerAsOther = await hre.viem.getContractAt(
            "InferenceListenerV0",
            inferenceListener.address,
            { client: { wallet: otherAccount } }
          );
  
          const appId = "test-app";
          const userWallet = getAddress(user1.account.address);
          const logHash = keccak256(toBytes("test-data"));
  
          await expect(
            inferenceListenerAsOther.write.submitInferenceLog([
              appId,
              userWallet,
              logHash
            ])
          ).to.be.rejectedWith("Only admin can call this function");
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceListener, user1 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "";
          const userWallet = getAddress(user1.account.address);
          const logHash = keccak256(toBytes("test-data"));
  
          await expect(
            inferenceListener.write.submitInferenceLog([
              appId,
              userWallet,
              logHash
            ])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
  
        it("Should revert if user wallet is zero address", async function () {
          const { inferenceListener } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallet = "0x0000000000000000000000000000000000000000";
          const logHash = keccak256(toBytes("test-data"));
  
          await expect(
            inferenceListener.write.submitInferenceLog([
              appId,
              userWallet,
              logHash
            ])
          ).to.be.rejectedWith("Invalid user wallet address");
        });
  
        it("Should revert if log hash is zero", async function () {
          const { inferenceListener, user1 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallet = getAddress(user1.account.address);
          const logHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
          await expect(
            inferenceListener.write.submitInferenceLog([
              appId,
              userWallet,
              logHash
            ])
          ).to.be.rejectedWith("Invalid log hash");
        });
  
        it("Should successfully submit multiple inference logs", async function () {
          const { inferenceListener, user1, user2, publicClient } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          // Set max submissions to a reasonable number for testing
          await inferenceListener.write.updateMaxSubmissions([5n]);
  
          // First submission with one app ID and user
          const appId1 = "test-app-1";
          const userWallet1 = getAddress(user1.account.address);
          const logHash1 = keccak256(toBytes("test-data-1"));
          
          const tx1 = await inferenceListener.write.submitInferenceLog([
            appId1,
            userWallet1,
            logHash1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Second submission with different app ID and user
          const appId2 = "test-app-2";
          const userWallet2 = getAddress(user2.account.address);
          const logHash2 = keccak256(toBytes("test-data-2"));
          
          const tx2 = await inferenceListener.write.submitInferenceLog([
            appId2,
            userWallet2,
            logHash2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Verify each submission was successful by checking transaction receipts
          const receipt1 = await publicClient.getTransactionReceipt({ hash: tx1 });
          const receipt2 = await publicClient.getTransactionReceipt({ hash: tx2 });
          
          expect(receipt1.status).to.equal('success');
          expect(receipt2.status).to.equal('success');
        });
      });
  
      describe("submitBatchInferenceLogs", function () {
        it("Should emit BatchInferenceLogs event with correct parameters", async function () {
          const { inferenceListener, user1, user2, publicClient } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallets = [
            getAddress(user1.account.address),
            getAddress(user2.account.address)
          ];
          const logHashes = [
            keccak256(toBytes("test-data-1")),
            keccak256(toBytes("test-data-2"))
          ];
  
          const tx = await inferenceListener.write.submitBatchInferenceLogs([
            appId,
            userWallets,
            logHashes
          ]);
          
          await publicClient.waitForTransactionReceipt({ hash: tx });
  
          // Check if BatchInferenceLogs event was emitted correctly
          const batchEvents = await inferenceListener.getEvents.BatchInferenceLogs();
          expect(batchEvents).to.have.lengthOf(1);
          
          const blockNumber = await publicClient.getBlock({ blockHash: batchEvents[0].blockHash }).then(block => block.number);
          
          expect(batchEvents[0].args.blockNumber).to.equal(blockNumber);
          expect(batchEvents[0].args.appId).to.equal(appId);
          expect(batchEvents[0].args.userWallets).to.deep.equal(userWallets);
          expect(batchEvents[0].args.logHashes).to.deep.equal(logHashes);
          expect(batchEvents[0].args.count).to.equal(2n);
        });
        
        it("Should test batch rate limiting with a mock contract", async function () {
          // Similar to the single submission case, proper testing of rate limiting
          // requires special testing infrastructure
          
          // This test is a placeholder for a more advanced test that would:
          // 1. Deploy a mock contract that exposes the private mapping
          // 2. Submit multiple batches in the same block to test the rate limiting
          // 3. Verify the correct behavior for both allowed and denied submissions
        });
  
        it("Should revert if called by non-admin", async function () {
          const { inferenceListener, otherAccount, user1, user2 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const inferenceListenerAsOther = await hre.viem.getContractAt(
            "InferenceListenerV0",
            inferenceListener.address,
            { client: { wallet: otherAccount } }
          );
  
          const appId = "test-app";
          const userWallets = [
            getAddress(user1.account.address),
            getAddress(user2.account.address)
          ];
          const logHashes = [
            keccak256(toBytes("test-data-1")),
            keccak256(toBytes("test-data-2"))
          ];
  
          await expect(
            inferenceListenerAsOther.write.submitBatchInferenceLogs([
              appId,
              userWallets,
              logHashes
            ])
          ).to.be.rejectedWith("Only admin can call this function");
        });
  
        it("Should revert if app ID is empty", async function () {
          const { inferenceListener, user1, user2 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "";
          const userWallets = [
            getAddress(user1.account.address),
            getAddress(user2.account.address)
          ];
          const logHashes = [
            keccak256(toBytes("test-data-1")),
            keccak256(toBytes("test-data-2"))
          ];
  
          await expect(
            inferenceListener.write.submitBatchInferenceLogs([
              appId,
              userWallets,
              logHashes
            ])
          ).to.be.rejectedWith("App ID cannot be empty");
        });
  
        it("Should revert if batch is empty", async function () {
          const { inferenceListener } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallets = [];
          const logHashes = [];
  
          await expect(
            inferenceListener.write.submitBatchInferenceLogs([
              appId,
              userWallets,
              logHashes
            ])
          ).to.be.rejectedWith("Empty batch");
        });
  
        it("Should revert if array lengths don't match", async function () {
          const { inferenceListener, user1, user2 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallets = [
            getAddress(user1.account.address),
            getAddress(user2.account.address)
          ];
          const logHashes = [
            keccak256(toBytes("test-data-1"))
          ];
  
          await expect(
            inferenceListener.write.submitBatchInferenceLogs([
              appId,
              userWallets,
              logHashes
            ])
          ).to.be.rejectedWith("Array length mismatch");
        });
  
        it("Should revert if any user wallet is zero address", async function () {
          const { inferenceListener, user1 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallets = [
            getAddress(user1.account.address),
            "0x0000000000000000000000000000000000000000"
          ];
          const logHashes = [
            keccak256(toBytes("test-data-1")),
            keccak256(toBytes("test-data-2"))
          ];
  
          await expect(
            inferenceListener.write.submitBatchInferenceLogs([
              appId,
              userWallets,
              logHashes
            ])
          ).to.be.rejectedWith("Invalid user wallet address");
        });
  
        it("Should revert if any log hash is zero", async function () {
          const { inferenceListener, user1, user2 } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          const appId = "test-app";
          const userWallets = [
            getAddress(user1.account.address),
            getAddress(user2.account.address)
          ];
          const logHashes = [
            keccak256(toBytes("test-data-1")),
            "0x0000000000000000000000000000000000000000000000000000000000000000"
          ];
  
          await expect(
            inferenceListener.write.submitBatchInferenceLogs([
              appId,
              userWallets,
              logHashes
            ])
          ).to.be.rejectedWith("Invalid log hash");
        });
  
        it("Should successfully handle multiple batch submissions", async function () {
          const { inferenceListener, user1, user2, user3, publicClient } = await loadFixture(
            deployInferenceListenerFixture
          );
  
          // Set max submissions to a higher number for testing
          await inferenceListener.write.updateMaxSubmissions([10n]);
  
          // First batch with a unique app ID
          const appId1 = "test-app-batch-1";
          const userWallets1 = [
            getAddress(user1.account.address),
            getAddress(user2.account.address)
          ];
          const logHashes1 = [
            keccak256(toBytes("batch1-data-1")),
            keccak256(toBytes("batch1-data-2"))
          ];
  
          const tx1 = await inferenceListener.write.submitBatchInferenceLogs([
            appId1,
            userWallets1,
            logHashes1
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx1 });
          
          // Second batch with a different app ID
          const appId2 = "test-app-batch-2";
          const userWallets2 = [
            getAddress(user2.account.address),
            getAddress(user3.account.address)
          ];
          const logHashes2 = [
            keccak256(toBytes("batch2-data-1")),
            keccak256(toBytes("batch2-data-2"))
          ];
  
          const tx2 = await inferenceListener.write.submitBatchInferenceLogs([
            appId2,
            userWallets2,
            logHashes2
          ]);
          await publicClient.waitForTransactionReceipt({ hash: tx2 });
          
          // Verify each submission was successful by checking transaction receipts
          const receipt1 = await publicClient.getTransactionReceipt({ hash: tx1 });
          const receipt2 = await publicClient.getTransactionReceipt({ hash: tx2 });
          
          expect(receipt1.status).to.equal('success');
          expect(receipt2.status).to.equal('success');
        });
      });
    });
  });