//SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @notice NFT Staking contract
 * @notice Accepts NFTs and drips rewards
 * @notice User can stake as many nfts as he wants
 */
contract NFTStaking is IERC721Receiver {

    IERC721 public immutable nft;
    IERC20 public immutable rewardToken;

    uint public rewardPerSecond;

    mapping (address => StakedParams) public userStake;

    mapping (address => uint32[]) public stakedNFTs; // support up to 2^32 nfts per user

    // Staked params struct
    struct StakedParams {
        uint192 totalRewards; // rewards accumulated so far
        uint32 nftCount; // amount of nfts staked
        uint32 lastUpdateTime; // last update time
    }

    error NoRewardForUser();
    error NoStakeForUser();
    error WithdrawalTooBig();

    event RewardClaimed(address indexed user, uint indexed amount);

    constructor(IERC721 _nft, IERC20 _rewardToken, uint _rewardPer24hours) {
        nft = _nft;
        rewardToken = _rewardToken;
        rewardPerSecond = (_rewardPer24hours / 86400);
    }

    /**
     * @dev stake nfts in the contract
     * @param nftIds ids of the nfts
     */
    function stake(uint[] calldata nftIds) external {
        // transfer nfts from user to contract
        for(uint i = 0 ; i < nftIds.length ; ++i) {
            nft.safeTransferFrom(msg.sender, address(this), nftIds[i]);
        }
        StakedParams storage currentStake = userStake[msg.sender];
        // if user hasn't staked before
        if(currentStake.nftCount == 0) {
            // calculate current reward
            userStake[msg.sender] = StakedParams({
                totalRewards: 0,
                nftCount: uint32(nftIds.length),
                lastUpdateTime: uint32(block.timestamp)
            });
            // store user's staked nfts
            stakedNFTs[msg.sender] = _convertToUint32Arr(nftIds);
        } else {
            // if user has staked and is adding nfts
            uint reward = calculateReward(currentStake.lastUpdateTime, currentStake.nftCount);
            userStake[msg.sender] = StakedParams({
                totalRewards: uint192(currentStake.totalRewards + reward),
                nftCount: uint32(nftIds.length) + currentStake.nftCount,
                lastUpdateTime: uint32(block.timestamp)
            });
            // add more nfts to user's stake
            stakedNFTs[msg.sender] = _addNftsToArr(nftIds, stakedNFTs[msg.sender]);
        }
    }

    /**
     * @notice unstake nfts and claim reward
     */
    function unstakeAndClaimReward(uint[] calldata nftIds) external {
        unstake(nftIds);
        claimReward();
    }

    /**
     * @notice unstake nfts for user
     */
    function unstake(uint[] calldata nftIds) public {
        StakedParams storage currentStake = userStake[msg.sender];
        if(currentStake.nftCount == 0) {
            revert NoStakeForUser();
        }
        if(currentStake.nftCount < uint32(nftIds.length)) {
            revert WithdrawalTooBig();
        }
        
        // update rewards and nft count
        uint accumulatedRewards = calculateReward(currentStake.lastUpdateTime, currentStake.nftCount);
        uint currentRewards = currentStake.totalRewards + accumulatedRewards;
        userStake[msg.sender] = StakedParams({
            totalRewards: uint192(currentRewards),
            nftCount: currentStake.nftCount - uint32(nftIds.length),
            lastUpdateTime: uint32(block.timestamp)
        });
        // update stored nfts
        stakedNFTs[msg.sender] = _removeNftsFromArr(nftIds, stakedNFTs[msg.sender]);

        // transfer nfts to user
        for(uint i = 0 ; i < nftIds.length ; ++i) {
            nft.safeTransferFrom(address(this), msg.sender, nftIds[i]);
        }
    }

    /**
     * @notice claim reward for user
     */
    function claimReward() public {
        StakedParams storage currentStake = userStake[msg.sender];
        if(currentStake.nftCount == 0) {
            revert NoRewardForUser();
        }
        // get reward for the time passed since last update
        uint currentReward = calculateReward(currentStake.lastUpdateTime, currentStake.nftCount);
        // transfer rewards accumulated
        uint rewardsToClaim = currentReward + currentStake.totalRewards;
        rewardToken.transfer(msg.sender, currentReward + currentStake.totalRewards);
        currentStake.totalRewards = 0;
        // emit event
        emit RewardClaimed(msg.sender, rewardsToClaim);
    }

    /**
     * @notice calculate reward for a given timeframe [lastUpdateTime - now]
     */
    function calculateReward(uint32 lastUpdateTime, uint32 nftCount) public view returns (uint192 rewards) {
        uint timePassed = uint32(block.timestamp) - lastUpdateTime;
        return uint192(uint(nftCount) * (uint(timePassed) * rewardPerSecond));
    }

    /**
     * @notice add nfts to an array of nfts for user
     */
    function _addNftsToArr(uint[] calldata arr, uint32[] memory currentNftArr) private pure returns (uint32[] memory) {
        // convert the first array to uint32
        uint32[] memory convertedArr = _convertToUint32Arr(arr);
        uint32[] memory newArr = new uint32[](arr.length + currentNftArr.length);
        // fill the first part of the array
        for(uint i = 0 ; i < arr.length ; i++) {
            newArr[i] = convertedArr[i];
        }
        // fill the remaining array items with the current array of nfts user has staked 
        uint startIdx = arr.length;
        uint endIdx = startIdx + currentNftArr.length;
        uint currentArrIndex = 0;
        for(uint i = startIdx ; i < endIdx ; ++i) {
            newArr[i] = currentNftArr[currentArrIndex];
            currentArrIndex++;
        }
        return convertedArr;
    }

    /**
     * @notice remove nfts to an array of nfts for user
     */
    function _removeNftsFromArr(uint[] calldata arr, uint32[] memory currentNftArr) private pure returns (uint32[] memory) {
        uint32[] memory convertedArr = new uint32[](currentNftArr.length - arr.length);
        uint currIdx = 0;
        // create a new array with the remaining array elements from (currentNftArr \ arr)
        // non-optimized version
        for(uint i = 0 ; i < currentNftArr.length ; ++i) {
            bool shouldAdd = true;
            for(uint j = 0 ; j < arr.length ; ++j) {
                if(currentNftArr[i] == arr[j]) {
                    shouldAdd = false;
                    break;
                }
            }
            if(shouldAdd) {
                convertedArr[currIdx] = currentNftArr[i];
                ++currIdx;
            }
        }
        return convertedArr;
    }

    /**
     * @notice convert an array from uint256 to uint32
     */
    function _convertToUint32Arr(uint[] calldata arr) private pure returns (uint32[] memory) {
        uint32[] memory convertedArr = new uint32[](arr.length);
        for(uint i = 0 ; i < arr.length ; ++i) {
            convertedArr[i] = uint32(arr[i]);
        }
        return convertedArr;
    }

    /**
     * @notice ERC-721 receiver impl
     */
     function onERC721Received(
        address ,
        address ,
        uint256 ,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}