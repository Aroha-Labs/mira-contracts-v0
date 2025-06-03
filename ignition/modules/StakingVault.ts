import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const StakingVaultModule = buildModule("StakingVaultModule", (m) => {
  const assetAddress = m.getParameter("assetAddress");
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");

  const lock = m.contract("StakingVault", [assetAddress, name, symbol], {});

  return { lock };
});

export default StakingVaultModule;