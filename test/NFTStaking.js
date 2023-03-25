const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = ethers;

const {
  deployArgs,
  increaseTime,
  mineBlocks
} = require('./helpers');

describe("NFTStaking", function () {
  let erc721;
  let erc20;
  let nftStaking;
  let rewardPer24Hours;
  let owner, signer, user1, user2;

  describe("nft staking", async function () {
    beforeEach(async function () {
        [owner, signer, user1, user2] = await ethers.getSigners();
        erc20 = await deployArgs('DAI', 'DAI', 'DAI');

          erc721 = await deployArgs("ApeNFT", "TestNFT", "TNFT");
          await erc721.deployed();
          rewardPer24Hours = ethers.utils.parseEther('10'); // 10 DAI per 24 hours per NFT
          nftStaking = await deployArgs('NFTStaking', erc721.address, erc20.address, rewardPer24Hours);
  
          // transfer erc20 reward tokens to staking contract
          await erc20.transfer(nftStaking.address, ethers.utils.parseEther('1000000'));
  
          // mint some tokens
          await erc721.connect(user1).publicMint(10);
          await erc721.connect(user2).publicMint(10);
      });
  
      it("should be able to mint ntfs", async function () {
        // approve tokens
        await erc721.connect(user1).publicMint(10);
        await erc721.connect(user2).publicMint(10);
        expect(await erc721.balanceOf(user1.address)).to.be.eq(20);
        expect(await erc721.balanceOf(user2.address)).to.be.eq(20);
      });
  
      it("should revert when attempting to mint more nfts than max supply", async function () {
        // approve tokens
        await expect(erc721.connect(user1).publicMint(1001)).to.be.revertedWithCustomError(erc721, 'MintTooBig');
      });
  
      it('should mint dai tokens on deployment', async function () {
          let amount = BigNumber.from('10000000000000000000').mul(BigNumber.from(10).pow(18))
          const dai = await deployArgs('DAI', 'DAI', 'DAI')
          const balance = await dai.balanceOf(owner.address);
          expect(balance).to.be.eq(amount);
      })
  
      it("should be able to stake nfts in the staking contract", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await erc721.connect(user1).approve(nftStaking.address, 1)
        await erc721.connect(user1).approve(nftStaking.address, 2)
        await nftStaking.connect(user1).stake([0, 1, 2]);
        let stake = await nftStaking.userStake(user1.address);
        expect(stake.totalRewards).to.be.eq(0);
        expect(stake.nftCount).to.be.eq(3);
      });
  
      it("should be able to stake nfts when already staked", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await erc721.connect(user1).approve(nftStaking.address, 1)
        await erc721.connect(user1).approve(nftStaking.address, 2)
        await erc721.connect(user1).approve(nftStaking.address, 3)
        await erc721.connect(user1).approve(nftStaking.address, 4)
        // stake 3 nfts
        await nftStaking.connect(user1).stake([0, 1, 2]);
        let stake = await nftStaking.userStake(user1.address);
        expect(stake.nftCount).to.be.eq(3);
  
        // stake two more nfts
        await nftStaking.connect(user1).stake([3, 4]);
        stake = await nftStaking.userStake(user1.address);
        expect(stake.nftCount).to.be.eq(5);
      });
  
      it("should be able to claim rewards from the staking contract", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await nftStaking.connect(user1).stake([0]);
        let timePassed = 86400;
        let rewardPerSecond = await nftStaking.rewardPerSecond();
        await increaseTime(timePassed);
        await mineBlocks(1);
        let expectedReward = BigNumber.from(timePassed + 2).mul(rewardPerSecond).mul(1);
        await expect(nftStaking.connect(user1).claimReward()).
          to.emit(nftStaking, 'RewardClaimed').
            withArgs(user1.address, expectedReward);
      });
  
      it("should multiply rewards by the number of tokens staked", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await erc721.connect(user1).approve(nftStaking.address, 1)
        await erc721.connect(user1).approve(nftStaking.address, 2)
        await nftStaking.connect(user1).stake([0, 1, 2]);
        let timePassed = 86400;
        let rewardPerSecond = await nftStaking.rewardPerSecond();
        await increaseTime(timePassed);
        await mineBlocks(1);
        let expectedReward = BigNumber.from(timePassed + 2).mul(rewardPerSecond).mul(3);
        await expect(nftStaking.connect(user1).claimReward()).
          to.emit(nftStaking, 'RewardClaimed').
            withArgs(user1.address, expectedReward);
      });
  
      it("should transfer rewards from the staking contract to the user", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await nftStaking.connect(user1).stake([0]);
        let timePassed = 86400;
        let rewardPerSecond = await nftStaking.rewardPerSecond();
        await increaseTime(timePassed);
        await mineBlocks(1);
        let expectedReward = BigNumber.from(timePassed + 2).mul(rewardPerSecond).mul(1);
        let balBefore = await erc20.balanceOf(user1.address);
        await nftStaking.connect(user1).claimReward();
        let balAfter = await erc20.balanceOf(user1.address);
        let gain = balAfter.sub(balBefore);
        expect(gain).to.be.eq(expectedReward)
      });
  
      it("should be able to unstake nfts from staking contract", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await erc721.connect(user1).approve(nftStaking.address, 1)
        await erc721.connect(user1).approve(nftStaking.address, 2)
        await nftStaking.connect(user1).stake([0, 1, 2]);
        let stake = await nftStaking.userStake(user1.address);
        let nft0 = await nftStaking.stakedNFTs(user1.address, 0);
        expect(stake.totalRewards).to.be.eq(0);
        expect(stake.nftCount).to.be.eq(3);
        expect(nft0).to.be.eq(0);
        await nftStaking.connect(user1).unstake([0, 1]);
        stake = await nftStaking.userStake(user1.address);
        nft0 = await nftStaking.stakedNFTs(user1.address, 0);
        expect(stake.totalRewards).to.be.gt(0);
        expect(stake.nftCount).to.be.eq(1);
        expect(nft0).to.be.eq(2);
      });
  
      it("should be able to unstake and claim from staking contract", async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await erc721.connect(user1).approve(nftStaking.address, 1)
        await erc721.connect(user1).approve(nftStaking.address, 2)
        await nftStaking.connect(user1).stake([0, 1, 2]);
        let stake = await nftStaking.userStake(user1.address);
        let nft0 = await nftStaking.stakedNFTs(user1.address, 0);
        expect(stake.totalRewards).to.be.eq(0);
        expect(stake.nftCount).to.be.eq(3);
        expect(nft0).to.be.eq(0);
        let timePassed = 86400;
        let rewardPerSecond = await nftStaking.rewardPerSecond();
        await increaseTime(timePassed);
        await mineBlocks(1);
        let expectedReward = BigNumber.from(timePassed + 2).mul(rewardPerSecond).mul(3);
        await expect(nftStaking.connect(user1).unstakeAndClaimReward([0, 1])).
          to.emit(nftStaking, 'RewardClaimed').
            withArgs(user1.address, expectedReward);
        stake = await nftStaking.userStake(user1.address);
        nft0 = await nftStaking.stakedNFTs(user1.address, 0);
        expect(stake.totalRewards).to.be.eq(0);
        expect(stake.nftCount).to.be.eq(1);
        expect(nft0).to.be.eq(2);
      });
  
      it('should revert unstaking if user hasn\'t staked before', async function () {
        await expect(nftStaking.connect(user1).unstake([0])).to.be.revertedWithCustomError(nftStaking, 'NoStakeForUser');
      })
  
      it('should revert claiming reward if user hasn\'t staked before', async function () {
        await expect(nftStaking.connect(user1).claimReward()).to.be.revertedWithCustomError(nftStaking, 'NoRewardForUser');
      })
  
      it('should revert unstaking if user attempts to unstake more nfts than he has', async function () {
        // approve tokens
        await erc721.connect(user1).approve(nftStaking.address, 0)
        await erc721.connect(user1).approve(nftStaking.address, 1)
        await erc721.connect(user1).approve(nftStaking.address, 2)
        await nftStaking.connect(user1).stake([0, 1, 2]);
  
        // expect unstaking 4 nfts to revert
        await expect(nftStaking.connect(user1).unstake([0, 1, 2, 3])).to.be.revertedWithCustomError(nftStaking, 'WithdrawalTooBig');
      })
  
      it('should be able to calculate reward', async function () {
        let reward = await nftStaking.calculateReward('0', '1');
        expect(reward).to.be.gt(0);
      })
    })
  });
  
