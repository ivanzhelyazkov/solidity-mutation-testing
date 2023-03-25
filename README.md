# Mutation Testing using Vertigo

## 1. NFT Staking contract
- Contract is `NFTStaking.sol`
- Accepts NFTs and immediately starts accumulating rewards for users. Rewards are accumulated per second and paid out in ERC-20 tokens, they are set on deployment.
- Contract works with any ERC-721 for staking and ERC-20 token for reward payment
- Users can stake as many NFTs as they want, each NFT increases user's reward linearly.
- Code coverage to 100%  

# 2. Run mutation testing using vertigo
- Install vertigo:
- `pip3 install --user eth-vertigo`
- `https://github.com/JoranHonig/vertigo`

- Run vertigo:
- `npm run vertigo`

## Setting up the repo
`npm install`   
`npx hardhat test`