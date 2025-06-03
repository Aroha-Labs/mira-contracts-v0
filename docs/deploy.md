Deploy
======

# Deploy contracts

The following commands combine deployment and verification into one step.


If you want to deploy and leave the verification for later, do the following:

a)

- `npx hardhat ignition deploy ignition/modules/Lock.ts --network <network> --deployment-id <some deployment id mentioning the contract>`
- `npx hardhat ignition verify --network <network> <deployment id used earlier>`

b)

- `npx hardhat ignition deploy ignition/modules/Lock.ts --network <network>`
- `npx hardhat verify --network <network> <DEPLOYED_CONTRACT_ADDRESS>`


Notes:
- if, while verifying a contract on the appchain, the call to sourcify responds with "Failed to send contract verification request.", try setting `sourcify.enabled: true` in hardhat config


## Prerequisites

1) Store the private key of the deployer:

    npx hardhat vars set DEPLOYER_PRIVATE_KEY

2) Store the etherscan APIKey to verify contracts with (ensure it's the right apikey depending on the deployment chain):

    npx hardhat vars set ETHERSCAN_API_KEY

## Deploy AppRegistryV0.sol

    npx hardhat ignition deploy ignition/modules/AppRegistryV0.ts \
        --network <network> \
        --verify

## Deploy InferenceListenerV0.sol

    npx hardhat ignition deploy ignition/modules/InferenceListenerV0.ts \
        --network <network> \
        --verify

## Deploy InferenceStatsV0.sol

    npx hardhat ignition deploy ignition/modules/InferenceStatsV0.ts \
        --network <network> \
        --verify

## Deploy StakingVault.sol

Ensure parameters are ok by checking the file `ignition/modules/parameters.json`

Run:

    npx hardhat ignition deploy ignition/modules/StakingVault.ts \
        --network <network> \
        --parameters ignition/modules/parameters.json \
        --verify

# Transfer ownership

Call this foundry command to transfer ownership of a contract:

    cast send <contract> "transferAdmin(address)" <new admin> --rpc-url https://voyager-rpc-testnet.appchain.base.org
