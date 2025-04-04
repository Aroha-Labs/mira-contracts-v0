import {
    time,
    loadFixture,
  } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
  import { expect } from "chai";
  import hre from "hardhat";
  import { parseEther, getAddress } from "viem";
  
  describe("StakingVault", function () {
    // Fixture to reuse setup in every test
    async function deployStakingVaultFixture() {
      // Deploy mock ERC20 token first
      const initialSupply = parseEther("1000000"); // 1 million tokens
      const mockToken = await hre.viem.deployContract("MockERC20", [
        "Mock Token",
        "MTK",
        initialSupply,
      ]);
  
      // Get signers/wallet clients
      const [deployer, user1, user2] = await hre.viem.getWalletClients();
      
      // Deploy the StakingVault
      const stakingVault = await hre.viem.deployContract("StakingVault", [
        mockToken.address,
        "Staking Vault Token",
        "svMTK",
      ]);
  
      // Approve tokens for initialization
      const initialDeposit = parseEther("10"); // 10 tokens for initialization
      
      // Use the deployer wallet to approve tokens
      await mockToken.write.approve([stakingVault.address, initialDeposit], {
        account: deployer.account,
      });
  
      // Get user1 some tokens
      const user1Tokens = parseEther("1000");
      await mockToken.write.transfer([user1.account.address, user1Tokens], {
        account: deployer.account,
      });
  
      // Get user2 some tokens
      const user2Tokens = parseEther("1000");
      await mockToken.write.transfer([user2.account.address, user2Tokens], {
        account: deployer.account,
      });
  
      const publicClient = await hre.viem.getPublicClient();
  
      return {
        stakingVault,
        mockToken,
        initialDeposit,
        deployer,
        user1,
        user2,
        publicClient,
      };
    }
  
    describe("Deployment", function () {
      it("Should set the right asset", async function () {
        const { stakingVault, mockToken } = await loadFixture(deployStakingVaultFixture);
        expect(getAddress(await stakingVault.read.asset())).to.equal(getAddress(mockToken.address));
      });
  
      it("Should set the right deployer", async function () {
        const { stakingVault, deployer } = await loadFixture(deployStakingVaultFixture);
        expect(await stakingVault.read.DEPLOYER()).to.equal(
          getAddress(deployer.account.address)
        );
      });
  
      it("Should start uninitialized", async function () {
        const { stakingVault } = await loadFixture(deployStakingVaultFixture);
        expect(await stakingVault.read.initialized()).to.equal(false);
      });
    });
  
    describe("Initialization", function () {
      it("Should initialize successfully with sufficient deposit", async function () {
        const { stakingVault, initialDeposit } = await loadFixture(deployStakingVaultFixture);
        
        await expect(stakingVault.write.initialize([initialDeposit])).to.be.fulfilled;
        expect(await stakingVault.read.initialized()).to.equal(true);
      });
  
      it("Should fail to initialize with insufficient deposit", async function () {
        const { stakingVault } = await loadFixture(deployStakingVaultFixture);
        
        const tooSmall = parseEther("0.5"); // Half a token, below minimum
        await expect(stakingVault.write.initialize([tooSmall])).to.be.rejectedWith(
          "Initial deposit too small"
        );
      });
  
      it("Should fail if not called by deployer", async function () {
        const { stakingVault, initialDeposit, user1 } = await loadFixture(deployStakingVaultFixture);
        
        // Connect as user1 instead of deployer
        const vaultAsUser1 = await hre.viem.getContractAt(
          "StakingVault",
          stakingVault.address,
          { client: { wallet: user1 } }
        );
        
        await expect(vaultAsUser1.write.initialize([initialDeposit])).to.be.rejectedWith(
          "Only deployer"
        );
      });
  
      it("Should fail if already initialized", async function () {
        const { stakingVault, initialDeposit } = await loadFixture(deployStakingVaultFixture);
        
        // Initialize first time
        await stakingVault.write.initialize([initialDeposit]);
        
        // Try to initialize again
        await expect(stakingVault.write.initialize([initialDeposit])).to.be.rejectedWith(
          "Already initialized"
        );
      });
  
      it("Should mint shares to the dead address", async function () {
        const { stakingVault, initialDeposit } = await loadFixture(deployStakingVaultFixture);
        
        await stakingVault.write.initialize([initialDeposit]);
        
        const deadAddress = "0x0000000000000000000000000000000000000001";
        const minShares = parseEther("1");
        
        expect(await stakingVault.read.balanceOf([deadAddress])).to.equal(minShares);
      });
    });
  
    describe("Deposit and Withdrawal", function () {
      it("Should fail to deposit before initialization", async function () {
        const { stakingVault, user1 } = await loadFixture(deployStakingVaultFixture);
        
        const depositAmount = parseEther("10");
        const vaultAsUser1 = await hre.viem.getContractAt(
          "StakingVault",
          stakingVault.address,
          { client: { wallet: user1 } }
        );
        
        await expect(vaultAsUser1.write.deposit([depositAmount, user1.account.address])).to.be.rejectedWith(
          "Not initialized"
        );
      });
  
      it("Should allow deposits after initialization", async function () {
        const { stakingVault, mockToken, initialDeposit, user1 } = await loadFixture(deployStakingVaultFixture);
        
        // Initialize vault
        await stakingVault.write.initialize([initialDeposit]);
        
        // Approve and deposit as user1
        const depositAmount = parseEther("10");
        
        // Create token contract instance connected to user1
        const mockTokenAsUser1 = await hre.viem.getContractAt(
          "MockERC20",
          mockToken.address,
          { client: { wallet: user1 } }
        );
        
        await mockTokenAsUser1.write.approve([stakingVault.address, depositAmount]);
        
        const vaultAsUser1 = await hre.viem.getContractAt(
          "StakingVault",
          stakingVault.address,
          { client: { wallet: user1 } }
        );
        
        await expect(vaultAsUser1.write.deposit([depositAmount, user1.account.address])).to.be.fulfilled;
        
        // Check the user received shares
        const userShares = await stakingVault.read.balanceOf([user1.account.address]);
        expect(userShares > 0n).to.be.true;
      });
  
      it("Should allow minting after initialization", async function () {
        const { stakingVault, mockToken, initialDeposit, user1 } = await loadFixture(deployStakingVaultFixture);
        
        // Initialize vault
        await stakingVault.write.initialize([initialDeposit]);
        
        // Calculate and approve tokens for minting
        const sharesToMint = parseEther("5");
        // Need to get assets needed for the shares, this is an estimation
        const assetsForShares = await stakingVault.read.previewMint([sharesToMint]);
        
        // Create token contract instance connected to user1
        const mockTokenAsUser1 = await hre.viem.getContractAt(
          "MockERC20",
          mockToken.address,
          { client: { wallet: user1 } }
        );
        
        await mockTokenAsUser1.write.approve([stakingVault.address, assetsForShares]);
        
        const vaultAsUser1 = await hre.viem.getContractAt(
          "StakingVault",
          stakingVault.address,
          { client: { wallet: user1 } }
        );
        
        await expect(vaultAsUser1.write.mint([sharesToMint, user1.account.address])).to.be.fulfilled;
        
        // Verify user has received the requested shares
        const userShares = await stakingVault.read.balanceOf([user1.account.address]);
        expect(userShares >= sharesToMint).to.be.true;
      });
  
      it("Should correctly convert between assets and shares", async function () {
        const { stakingVault, mockToken, initialDeposit, user1 } = await loadFixture(deployStakingVaultFixture);
        
        // Initialize vault
        await stakingVault.write.initialize([initialDeposit]);
        
        // Deposit as user1
        const depositAmount = parseEther("10");
        
        // Create token contract instance connected to user1
        const mockTokenAsUser1 = await hre.viem.getContractAt(
          "MockERC20",
          mockToken.address,
          { client: { wallet: user1 } }
        );
        
        await mockTokenAsUser1.write.approve([stakingVault.address, depositAmount]);
        
        const vaultAsUser1 = await hre.viem.getContractAt(
          "StakingVault",
          stakingVault.address,
          { client: { wallet: user1 } }
        );
        
        // Get expected shares before deposit
        const expectedShares = await stakingVault.read.previewDeposit([depositAmount]);
        
        // Perform deposit
        await vaultAsUser1.write.deposit([depositAmount, user1.account.address]);
        
        // Check that user received correct amount of shares
        const actualShares = await stakingVault.read.balanceOf([user1.account.address]);
        expect(actualShares).to.equal(expectedShares);
        
        // Check that these shares convert back to approximately the same amount of assets
        const withdrawableAssets = await stakingVault.read.previewRedeem([actualShares]);
        
        // Allow for some minor rounding error due to the initial share minting
        const tolerance = parseEther("0.001"); // 0.1% tolerance
        
        // With BigInt, we need to compare manually since closeTo doesn't work with BigInt
        const difference = withdrawableAssets > depositAmount 
          ? withdrawableAssets - depositAmount 
          : depositAmount - withdrawableAssets;
          
        expect(difference <= tolerance).to.be.true;
      });
  
      it("Should allow withdrawal of assets", async function () {
        const { stakingVault, mockToken, initialDeposit, user1, publicClient } = await loadFixture(deployStakingVaultFixture);
        
        // Initialize vault
        await stakingVault.write.initialize([initialDeposit]);
        
        // Deposit as user1
        const depositAmount = parseEther("10");
        
        // Create token contract instance connected to user1
        const mockTokenAsUser1 = await hre.viem.getContractAt(
          "MockERC20",
          mockToken.address,
          { client: { wallet: user1 } }
        );
        
        await mockTokenAsUser1.write.approve([stakingVault.address, depositAmount]);
        
        const vaultAsUser1 = await hre.viem.getContractAt(
          "StakingVault",
          stakingVault.address,
          { client: { wallet: user1 } }
        );
        
        // Perform deposit
        await vaultAsUser1.write.deposit([depositAmount, user1.account.address]);
        
        // Get user's balance before withdrawal
        const userSharesBefore = await stakingVault.read.balanceOf([user1.account.address]);
        const userTokensBefore = await mockToken.read.balanceOf([user1.account.address]);
        
        // Withdraw half of the shares
        const sharesToWithdraw = userSharesBefore / 2n;
        const expectedAssets = await stakingVault.read.previewRedeem([sharesToWithdraw]);
        
        await vaultAsUser1.write.redeem([sharesToWithdraw, user1.account.address, user1.account.address]);
        
        // Check user's balances after withdrawal
        const userSharesAfter = await stakingVault.read.balanceOf([user1.account.address]);
        const userTokensAfter = await mockToken.read.balanceOf([user1.account.address]);
        
        // Verify shares were deducted
        expect(userSharesAfter).to.equal(userSharesBefore - sharesToWithdraw);
        
        // Verify tokens were received
        expect(userTokensAfter - userTokensBefore).to.equal(expectedAssets);
      });
    });

    // tests for redeeming and reward distribution
    describe("StakingVault Operations", function () {
        // Test multiple users depositing and redeeming
        it("Should handle multiple users depositing and redeeming correctly", async function () {
            const { stakingVault, mockToken, initialDeposit, user1, user2 } = await loadFixture(deployStakingVaultFixture);
            
            // Initialize vault
            await stakingVault.write.initialize([initialDeposit]);
            
            // Setup contracts for users
            const mockTokenAsUser1 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user1 } }
            );
            
            const mockTokenAsUser2 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user2 } }
            );
            
            const vaultAsUser1 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user1 } }
            );
            
            const vaultAsUser2 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user2 } }
            );
            
            // User1 and User2 deposit different amounts
            const user1DepositAmount = parseEther("10");
            const user2DepositAmount = parseEther("20");
            
            // Approve and deposit
            await mockTokenAsUser1.write.approve([stakingVault.address, user1DepositAmount]);
            await mockTokenAsUser2.write.approve([stakingVault.address, user2DepositAmount]);
            
            await vaultAsUser1.write.deposit([user1DepositAmount, user1.account.address]);
            await vaultAsUser2.write.deposit([user2DepositAmount, user2.account.address]);
            
            // Get shares
            const user1Shares = await stakingVault.read.balanceOf([user1.account.address]);
            const user2Shares = await stakingVault.read.balanceOf([user2.account.address]);
            
            // Verify share ratio matches deposit ratio (approximately)
            const shareRatio = Number(user2Shares) / Number(user1Shares);
            const depositRatio = Number(user2DepositAmount) / Number(user1DepositAmount);
            
            // Allow for minor rounding differences
            expect(Math.abs(shareRatio - depositRatio) < 0.01).to.be.true;
            
            // Both users redeem half their shares
            const user1RedeemShares = user1Shares / 2n;
            const user2RedeemShares = user2Shares / 2n;
            
            // Track token balances before redemption
            const user1TokensBefore = await mockToken.read.balanceOf([user1.account.address]);
            const user2TokensBefore = await mockToken.read.balanceOf([user2.account.address]);
            
            // Redeem shares
            await vaultAsUser1.write.redeem([user1RedeemShares, user1.account.address, user1.account.address]);
            await vaultAsUser2.write.redeem([user2RedeemShares, user2.account.address, user2.account.address]);
            
            // Check token balances after redemption
            const user1TokensAfter = await mockToken.read.balanceOf([user1.account.address]);
            const user2TokensAfter = await mockToken.read.balanceOf([user2.account.address]);
            
            // Calculate redeemed amounts
            const user1Redeemed = user1TokensAfter - user1TokensBefore;
            const user2Redeemed = user2TokensAfter - user2TokensBefore;
            
            // Verify redeemed amount ratio matches share ratio (approximately)
            const redeemedRatio = Number(user2Redeemed) / Number(user1Redeemed);
            expect(Math.abs(redeemedRatio - depositRatio) < 0.01).to.be.true;
        });

        // Test for distribution of rewards - fixed to use ERC4626 formula
        it("Should distribute rewards according to ERC4626 share distribution", async function () {
            const { stakingVault, mockToken, initialDeposit, deployer, user1, user2 } = await loadFixture(deployStakingVaultFixture);
            
            // Initialize vault
            await stakingVault.write.initialize([initialDeposit]);
            
            // Setup contracts for users
            const mockTokenAsUser1 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user1 } }
            );
            
            const mockTokenAsUser2 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user2 } }
            );
            
            const vaultAsUser1 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user1 } }
            );
            
            const vaultAsUser2 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user2 } }
            );
            
            // User1 and User2 deposit
            const user1DepositAmount = parseEther("10");
            const user2DepositAmount = parseEther("30"); // User2 deposits 3x more than User1
            
            // Approve and deposit
            await mockTokenAsUser1.write.approve([stakingVault.address, user1DepositAmount]);
            await mockTokenAsUser2.write.approve([stakingVault.address, user2DepositAmount]);
            
            await vaultAsUser1.write.deposit([user1DepositAmount, user1.account.address]);
            await vaultAsUser2.write.deposit([user2DepositAmount, user2.account.address]);
            
            // Get share state after deposits
            const user1Shares = await stakingVault.read.balanceOf([user1.account.address]);
            const user2Shares = await stakingVault.read.balanceOf([user2.account.address]);
            const totalShares = await stakingVault.read.totalSupply();
            const totalAssetsBefore = await stakingVault.read.totalAssets();
            
            // Add rewards to the vault (simulating yield/interest)
            const rewardAmount = parseEther("8"); // 8 tokens as reward
            await mockToken.write.transfer([stakingVault.address, rewardAmount], {
                account: deployer.account,
            });
            
            // Total assets after reward
            const totalAssetsAfter = totalAssetsBefore + rewardAmount;
            
            // Calculate expected assets for each user based on ERC4626 formula
            const expectedUser1Assets = (user1Shares * totalAssetsAfter) / totalShares;
            const expectedUser2Assets = (user2Shares * totalAssetsAfter) / totalShares;
            
            // Check token balances before redeeming
            const user1TokensBefore = await mockToken.read.balanceOf([user1.account.address]);
            const user2TokensBefore = await mockToken.read.balanceOf([user2.account.address]);
            
            // Both users redeem all their shares
            await vaultAsUser1.write.redeem([user1Shares, user1.account.address, user1.account.address]);
            await vaultAsUser2.write.redeem([user2Shares, user2.account.address, user2.account.address]);
            
            // Check token balances after redeeming
            const user1TokensAfter = await mockToken.read.balanceOf([user1.account.address]);
            const user2TokensAfter = await mockToken.read.balanceOf([user2.account.address]);
            
            // Calculate actual redemption amounts
            const user1Redeemed = user1TokensAfter - user1TokensBefore;
            const user2Redeemed = user2TokensAfter - user2TokensBefore;
            
            // Allow for rounding errors with BigInt
            const tolerance = parseEther("0.01"); // Small tolerance for rounding
            
            const user1Diff = user1Redeemed > expectedUser1Assets 
                ? user1Redeemed - expectedUser1Assets 
                : expectedUser1Assets - user1Redeemed;
                
            const user2Diff = user2Redeemed > expectedUser2Assets 
                ? user2Redeemed - expectedUser2Assets 
                : expectedUser2Assets - user2Redeemed;
            
            // Verify both users received the expected amount of assets based on share ownership
            expect(user1Diff <= tolerance).to.be.true;
            expect(user2Diff <= tolerance).to.be.true;
            
            // Verify that total rewards distributed match the expected amount
            // The dead address shares aren't redeemed, so some rewards will remain in the vault
            const deadShares = parseEther("1"); // 1 token of shares to dead address
            
            // Rewards received by user1 and user2
            const user1Rewards = user1Redeemed - user1DepositAmount;
            const user2Rewards = user2Redeemed - user2DepositAmount;
            const totalRewardsDistributed = user1Rewards + user2Rewards;
            
            // Expected rewards to be distributed (excluding dead address portion)
            const expectedDistributedRewards = (rewardAmount * (totalShares - deadShares)) / totalShares;
            
            const rewardsDiff = totalRewardsDistributed > expectedDistributedRewards
                ? totalRewardsDistributed - expectedDistributedRewards
                : expectedDistributedRewards - totalRewardsDistributed;
                
            expect(rewardsDiff <= tolerance).to.be.true;
        });

        // Test for redeeming with zero amount
        it("Should handle redeeming zero shares correctly", async function () {
            const { stakingVault, mockToken, initialDeposit, user1 } = await loadFixture(deployStakingVaultFixture);
            
            // Initialize vault
            await stakingVault.write.initialize([initialDeposit]);
            
            // Setup contracts for user
            const mockTokenAsUser1 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user1 } }
            );
            
            const vaultAsUser1 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user1 } }
            );
            
            // User deposits
            const depositAmount = parseEther("10");
            await mockTokenAsUser1.write.approve([stakingVault.address, depositAmount]);
            await vaultAsUser1.write.deposit([depositAmount, user1.account.address]);
            
            // Try to redeem zero shares
            const zeroShares = 0n;
            
            // This should be allowed by ERC4626, but return zero assets
            await expect(vaultAsUser1.write.redeem([zeroShares, user1.account.address, user1.account.address])).to.be.fulfilled;
            
            // The user's share balance should not change
            const userShares = await stakingVault.read.balanceOf([user1.account.address]);
            expect(userShares).to.equal(await stakingVault.read.previewDeposit([depositAmount]));
        });

        // Test for small decimal handling in asset/share conversion
        it("Should handle small decimal amounts correctly", async function () {
            const { stakingVault, mockToken, initialDeposit, user1 } = await loadFixture(deployStakingVaultFixture);
            
            // Initialize vault
            await stakingVault.write.initialize([initialDeposit]);
            
            // Setup contracts for user
            const mockTokenAsUser1 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user1 } }
            );
            
            const vaultAsUser1 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user1 } }
            );
            
            // Deposit a small amount
            const smallDeposit = parseEther("0.000001"); // Very small amount
            await mockTokenAsUser1.write.approve([stakingVault.address, smallDeposit]);
            
            // Small deposit should work
            await expect(vaultAsUser1.write.deposit([smallDeposit, user1.account.address])).to.be.fulfilled;
            
            // Get the shares received
            const userShares = await stakingVault.read.balanceOf([user1.account.address]);
            expect(userShares > 0n).to.be.true;
            
            // Try to redeem all shares
            await expect(vaultAsUser1.write.redeem([userShares, user1.account.address, user1.account.address])).to.be.fulfilled;
            
            // The user's share balance should now be zero
            const sharesAfter = await stakingVault.read.balanceOf([user1.account.address]);
            expect(sharesAfter).to.equal(0n);
        });

        // Test for reward distribution over time - fixed to use ERC4626 formula
        it("Should handle multiple reward distributions correctly", async function () {
            const { stakingVault, mockToken, initialDeposit, deployer, user1, user2 } = await loadFixture(deployStakingVaultFixture);
            
            // Initialize vault
            await stakingVault.write.initialize([initialDeposit]);
            
            // Setup contracts for users
            const mockTokenAsUser1 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user1 } }
            );
            
            const mockTokenAsUser2 = await hre.viem.getContractAt(
                "MockERC20",
                mockToken.address,
                { client: { wallet: user2 } }
            );
            
            const vaultAsUser1 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user1 } }
            );
            
            const vaultAsUser2 = await hre.viem.getContractAt(
                "StakingVault",
                stakingVault.address,
                { client: { wallet: user2 } }
            );
            
            // Initial deposits
            const user1DepositAmount = parseEther("20");
            const user2DepositAmount = parseEther("10");
            
            // Approve and deposit
            await mockTokenAsUser1.write.approve([stakingVault.address, user1DepositAmount]);
            await mockTokenAsUser2.write.approve([stakingVault.address, user2DepositAmount]);
            
            await vaultAsUser1.write.deposit([user1DepositAmount, user1.account.address]);
            await vaultAsUser2.write.deposit([user2DepositAmount, user2.account.address]);
            
            // Get share and asset state after initial deposits
            const totalSharesAfterDeposits = await stakingVault.read.totalSupply();
            const totalAssetsAfterDeposits = await stakingVault.read.totalAssets();
            
            // First reward distribution
            const firstReward = parseEther("6");
            await mockToken.write.transfer([stakingVault.address, firstReward], {
                account: deployer.account,
            });
            
            // Asset state after first reward
            const totalAssetsAfterFirstReward = totalAssetsAfterDeposits + firstReward;
            
            // User2 adds more funds after first reward
            const user2SecondDeposit = parseEther("30");
            await mockTokenAsUser2.write.approve([stakingVault.address, user2SecondDeposit]);
            
            // Calculate shares user2 will receive for second deposit
            // With ERC4626, this depends on the current exchange rate after the first reward
            const user2SharesForSecondDeposit = await stakingVault.read.previewDeposit([user2SecondDeposit]);
            
            await vaultAsUser2.write.deposit([user2SecondDeposit, user2.account.address]);
            
            // Get share and asset state after second deposit
            const totalSharesAfterSecondDeposit = await stakingVault.read.totalSupply();
            const totalAssetsAfterSecondDeposit = await stakingVault.read.totalAssets();
            
            // Second reward distribution
            const secondReward = parseEther("9");
            await mockToken.write.transfer([stakingVault.address, secondReward], {
                account: deployer.account,
            });
            
            // Final asset state
            const totalAssetsFinal = totalAssetsAfterSecondDeposit + secondReward;
            
            // Get final share balances
            const user1SharesFinal = await stakingVault.read.balanceOf([user1.account.address]);
            const user2SharesFinal = await stakingVault.read.balanceOf([user2.account.address]);
            const totalSharesFinal = await stakingVault.read.totalSupply();
            
            // Calculate expected redemption using ERC4626 formula
            const expectedUser1Assets = (user1SharesFinal * totalAssetsFinal) / totalSharesFinal;
            const expectedUser2Assets = (user2SharesFinal * totalAssetsFinal) / totalSharesFinal;
            
            // Get token balances before redeeming
            const user1TokensBefore = await mockToken.read.balanceOf([user1.account.address]);
            const user2TokensBefore = await mockToken.read.balanceOf([user2.account.address]);
            
            // Both users redeem all shares
            await vaultAsUser1.write.redeem([user1SharesFinal, user1.account.address, user1.account.address]);
            await vaultAsUser2.write.redeem([user2SharesFinal, user2.account.address, user2.account.address]);
            
            // Get token balances after redeeming
            const user1TokensAfter = await mockToken.read.balanceOf([user1.account.address]);
            const user2TokensAfter = await mockToken.read.balanceOf([user2.account.address]);
            
            // Calculate actual redemption amounts
            const user1Redeemed = user1TokensAfter - user1TokensBefore;
            const user2Redeemed = user2TokensAfter - user2TokensBefore;
            
            // Verify against expected amounts with tolerance for rounding
            const tolerance = parseEther("0.01");
            
            const user1Diff = user1Redeemed > expectedUser1Assets 
                ? user1Redeemed - expectedUser1Assets 
                : expectedUser1Assets - user1Redeemed;
                
            const user2Diff = user2Redeemed > expectedUser2Assets 
                ? user2Redeemed - expectedUser2Assets 
                : expectedUser2Assets - user2Redeemed;
            
            expect(user1Diff <= tolerance).to.be.true;
            expect(user2Diff <= tolerance).to.be.true;
            
            // Verify that both users received at least their principal
            expect(user1Redeemed >= user1DepositAmount).to.be.true;
            expect(user2Redeemed >= user2DepositAmount + user2SecondDeposit).to.be.true;
            
            // For multiple reward distribution scenarios, the reward percentages can differ
            // significantly from simple share percentages due to the timing of deposits
            // and rewards. Instead, verify that both users receive more than their deposits back.
            
            const user1Rewards = user1Redeemed - user1DepositAmount;
            const user2Rewards = user2Redeemed - (user2DepositAmount + user2SecondDeposit);
            
            // Both users should receive positive rewards
            expect(user1Rewards > 0n).to.be.true;
            expect(user2Rewards > 0n).to.be.true;
            
            // The total distributed rewards should be less than or equal to the total rewards
            // (accounting for the rewards retained by the dead address shares)
            const totalRewards = firstReward + secondReward;
            const distributedRewards = user1Rewards + user2Rewards;
            
            // Some rewards will be attributed to the dead shares and remain in the vault
            const deadShares = parseEther("1");
            const vaultRetainedRewards = (totalRewards * deadShares) / totalSharesFinal;
            
            // Allow some tolerance for rounding
            // const tolerance = parseEther("0.01");
            expect(totalRewards >= distributedRewards - tolerance).to.be.true;
        });
    });
  });