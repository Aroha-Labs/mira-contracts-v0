import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const InferenceListenerV0Module = buildModule("InferenceListenerV0Module", (m) => {
  const lock = m.contract("InferenceListenerV0", [], {});

  return { lock };
});

export default InferenceListenerV0Module;