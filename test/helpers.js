const { ethers, network } = require('hardhat');

/**
 * Deploy a contract by name without constructor arguments
 */
async function deploy(contractName) {
  const Contract = await ethers.getContractFactory(contractName);
  return await Contract.deploy();
}

/**
 * Deploy a contract by name with constructor arguments
 */
async function deployArgs(contractName, ...args) {
  const Contract = await ethers.getContractFactory(contractName);
  return await Contract.deploy(...args);
}

/**
 * Return a number with 18 decimals
 * @param {*} amount 
 * @returns 
 */
function toWei(amount) {
  return ethers.utils.parseEther(amount);
}

/*
* Return pending block timestamp
*/
async function getBlockTimestamp() {
 const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
 return pendingBlock.timestamp;
}

/**
* Increase time in Hardhat Network
*/
async function increaseTime(time) {
 await network.provider.send("evm_increaseTime", [time]);
 await network.provider.send("evm_mine");
}

/**
* Mine several blocks in network
* @param {Number} blockCount how many blocks to mine
*/
async function mineBlocks(blockCount) {
   for(let i = 0 ; i < blockCount ; ++i) {
       await network.provider.send("evm_mine");
   }
}

module.exports = {
  deploy, deployArgs, toWei, getBlockTimestamp, increaseTime, mineBlocks
}