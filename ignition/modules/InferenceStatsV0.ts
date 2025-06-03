import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const InferenceStatsV0Module = buildModule("InferenceStatsV0Module", (m) => {
  const lock = m.contract("InferenceStatsV0", [], {});

  return { lock };
});

export default InferenceStatsV0Module;