import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AppRegistryV0Module = buildModule("AppRegistryV0Module", (m) => {
  const lock = m.contract("AppRegistryV0", [], {});

  return { lock };
});

export default AppRegistryV0Module;