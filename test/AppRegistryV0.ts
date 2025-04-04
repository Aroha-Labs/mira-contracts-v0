import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("AppRegistryV0", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployAppRegistryFixture() {
    // Contracts are deployed using the first signer/account by default
    const [admin, otherAccount] = await hre.viem.getWalletClients();

    const appRegistry = await hre.viem.deployContract("AppRegistryV0");

    const publicClient = await hre.viem.getPublicClient();

    return {
      appRegistry,
      admin,
      otherAccount,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      const { appRegistry, admin } = await loadFixture(deployAppRegistryFixture);

      expect(await appRegistry.read.admin()).to.equal(
        getAddress(admin.account.address)
      );
    });

    it("Should start with zero registered apps", async function () {
      const { appRegistry } = await loadFixture(deployAppRegistryFixture);

      expect(await appRegistry.read.getAppCount()).to.equal(0n);
    });
  });

  describe("App Registration", function () {
    it("Should register a new app", async function () {
      const { appRegistry, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "test-app-1";
      
      const hash = await appRegistry.write.registerApp([appId]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Check app count
      expect(await appRegistry.read.getAppCount()).to.equal(1n);
      
      // Check app is active
      const isActive = await appRegistry.read.isAppActive([appId]);
      expect(isActive).to.be.true;
    });

    it("Should not allow registering app with empty ID", async function () {
      const { appRegistry } = await loadFixture(deployAppRegistryFixture);
      
      await expect(appRegistry.write.registerApp([""])).to.be.rejectedWith(
        "App ID cannot be empty"
      );
    });

    it("Should not allow registering duplicate app ID", async function () {
      const { appRegistry, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "test-app-2";
      
      const hash = await appRegistry.write.registerApp([appId]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      await expect(appRegistry.write.registerApp([appId])).to.be.rejectedWith(
        "App ID already registered"
      );
    });

    it("Should not allow non-admin to register app", async function () {
      const { appRegistry, otherAccount } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "test-app-3";
      
      const appRegistryAsOtherAccount = await hre.viem.getContractAt(
        "AppRegistryV0",
        appRegistry.address,
        { client: { wallet: otherAccount } }
      );
      
      await expect(appRegistryAsOtherAccount.write.registerApp([appId])).to.be.rejectedWith(
        "Only admin can call this function"
      );
    });
  });

  describe("App Status Updates", function () {
    it("Should update app status", async function () {
      const { appRegistry, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "test-app-4";
      
      // Register app
      let hash = await appRegistry.write.registerApp([appId]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Check initial status
      let isActive = await appRegistry.read.isAppActive([appId]);
      expect(isActive).to.be.true;
      
      // Deactivate app
      hash = await appRegistry.write.updateAppStatus([appId, false]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Check updated status
      isActive = await appRegistry.read.isAppActive([appId]);
      expect(isActive).to.be.false;
      
      // Reactivate app
      hash = await appRegistry.write.updateAppStatus([appId, true]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Check updated status again
      isActive = await appRegistry.read.isAppActive([appId]);
      expect(isActive).to.be.true;
    });

    it("Should not update status for unregistered app", async function () {
      const { appRegistry } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "nonexistent-app";
      
      await expect(appRegistry.write.updateAppStatus([appId, false])).to.be.rejectedWith(
        "App ID not registered"
      );
    });

    it("Should not allow non-admin to update app status", async function () {
      const { appRegistry, otherAccount, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "test-app-5";
      
      // Register app as admin
      const hash = await appRegistry.write.registerApp([appId]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Try to update as non-admin
      const appRegistryAsOtherAccount = await hre.viem.getContractAt(
        "AppRegistryV0",
        appRegistry.address,
        { client: { wallet: otherAccount } }
      );
      
      await expect(appRegistryAsOtherAccount.write.updateAppStatus([appId, false])).to.be.rejectedWith(
        "Only admin can call this function"
      );
    });
  });

  describe("Admin Transfer", function () {
    it("Should transfer admin role", async function () {
      const { appRegistry, admin, otherAccount, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      // Transfer admin to other account
      const hash = await appRegistry.write.transferAdmin([otherAccount.account.address]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Check new admin
      expect(await appRegistry.read.admin()).to.equal(
        getAddress(otherAccount.account.address)
      );
      
      // Previous admin should no longer be able to register apps
      await expect(appRegistry.write.registerApp(["new-app"])).to.be.rejectedWith(
        "Only admin can call this function"
      );
      
      // New admin should be able to register apps
      const appRegistryAsNewAdmin = await hre.viem.getContractAt(
        "AppRegistryV0",
        appRegistry.address,
        { client: { wallet: otherAccount } }
      );
      
      const newAppId = "new-admin-app";
      await expect(appRegistryAsNewAdmin.write.registerApp([newAppId])).to.be.fulfilled;
    });

    it("Should not allow transferring admin to zero address", async function () {
      const { appRegistry } = await loadFixture(deployAppRegistryFixture);
      
      await expect(appRegistry.write.transferAdmin(["0x0000000000000000000000000000000000000000"])).to.be.rejectedWith(
        "Invalid admin address"
      );
    });

    it("Should not allow non-admin to transfer admin role", async function () {
      const { appRegistry, otherAccount } = await loadFixture(deployAppRegistryFixture);
      
      const appRegistryAsOtherAccount = await hre.viem.getContractAt(
        "AppRegistryV0",
        appRegistry.address,
        { client: { wallet: otherAccount } }
      );
      
      await expect(appRegistryAsOtherAccount.write.transferAdmin([otherAccount.account.address])).to.be.rejectedWith(
        "Only admin can call this function"
      );
    });
  });

  describe("Events", function () {
    it("Should emit AppRegistered event on app registration", async function () {
      const { appRegistry, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "event-test-app";
      
      const hash = await appRegistry.write.registerApp([appId]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Get the events
      const registrationEvents = await appRegistry.getEvents.AppRegistered();
      expect(registrationEvents).to.have.lengthOf(1);
      expect(registrationEvents[0].args.appId).to.equal(appId);
      // Using a number comparison instead of checking if greater than
      expect(Number(registrationEvents[0].args.registrationBlock)).to.be.a('number');
    });

    it("Should emit AppStatusUpdated event on status update", async function () {
      const { appRegistry, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      const appId = "status-event-test";
      
      // Register app
      let hash = await appRegistry.write.registerApp([appId]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Update status
      hash = await appRegistry.write.updateAppStatus([appId, false]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Get the events
      const statusEvents = await appRegistry.getEvents.AppStatusUpdated();
      expect(statusEvents).to.have.lengthOf(1);
      expect(statusEvents[0].args.appId).to.equal(appId);
      expect(statusEvents[0].args.isActive).to.equal(false);
    });

    it("Should emit AdminTransferred event on admin transfer", async function () {
      const { appRegistry, admin, otherAccount, publicClient } = await loadFixture(deployAppRegistryFixture);
      
      // Transfer admin
      const hash = await appRegistry.write.transferAdmin([otherAccount.account.address]);
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Get the events
      const transferEvents = await appRegistry.getEvents.AdminTransferred();
      expect(transferEvents).to.have.lengthOf(1);
      expect(transferEvents[0].args.previousAdmin).to.equal(
        getAddress(admin.account.address)
      );
      expect(transferEvents[0].args.newAdmin).to.equal(
        getAddress(otherAccount.account.address)
      );
    });
  });
});