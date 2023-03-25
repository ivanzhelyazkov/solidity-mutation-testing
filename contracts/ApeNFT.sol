// SPDX-License-Identifier: ISC
pragma solidity 0.8.16;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract ApeNFT is ERC721 {
    uint public constant MAX_SUPPLY = 1000;
    uint public currentNftId;

    error MintTooBig();

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
    }

    /**
     * @dev Public token mint
     * @param _mintNumber Number of tokens to mint
     */
    function publicMint(uint _mintNumber) external {
        // check for max supply
        if(totalSupply() + _mintNumber > MAX_SUPPLY) {
            revert MintTooBig();
        }

        for (uint i = 0; i < _mintNumber; i++) {
            _safeMint(msg.sender, currentNftId);
            currentNftId++;
        }
    }

    /**
     * @notice Returns the total supply of tokens
     */
    function totalSupply() public view returns (uint) {
        return currentNftId;
    }
}