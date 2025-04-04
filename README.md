# MIRA Contracts

## Inference Tracking Smart Contract System

### Overview

The Inference Tracking System is a blockchain-based solution designed to record and analyze AI inference activities across multiple applications. The system enables secure logging of inference events via events only and provides simple block-based statistical recording through direct admin management.

### Contracts

#### AppRegistry Contract

**Purpose:** Manages the registry of authorized applications.

**Key Features:**

- Store registry of app IDs
- Admin-controlled app registration
- Support admin transfer to new address

#### InferenceListener Contract

**Purpose:** Receives inference logs and emits events.

**Key Features:**

- Accept inference log submissions (user wallet address, log hash) from admin only
- Emit events only, without storing log data on-chain
- Support batch event emission for multiple logs

#### InferenceStats Contract

**Purpose:** Store statistics for each application's inference activity.

**Key Features:**

- Record inference and token counts with associated block numbers for each app
- Allow only admin to directly write statistics
- Support initialization with genesis statistics values during deployment
- Provide admin functionality for management
- Provide query functions for basic statistical analysis

### StakingVault Smart Contract
**Purpose:** Implement a secure, initialization-protected ERC-4626 staking vault for token assets.

**Key Features:**

- ERC-4626 standard compliance for tokenized vault functionality
- Single deployer initialization mechanism
- Minimum initial deposit protection
- Prevents deposits before proper initialization

**Core Constraints(defending inflation attack):**

- Only deployer can initialize the vault
- Minimum initial deposit of 1 full token
- Fixed initial share minting to a dead address
- Deposits and minting blocked until initialization

