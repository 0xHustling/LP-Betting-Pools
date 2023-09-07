//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "hardhat/console.sol";

contract MockVRFCoordinator {
    enum Combination {
        LOSING,
        WINNING
    }

    Combination currentCombination = Combination.LOSING;
    uint256 internal counter = 1;
    uint256 internal lastRequestId;
    uint256[3] internal lastRandomWords;
    VRFConsumerBaseV2 consumer;

    function setCombination(uint256 value) public {
        currentCombination = Combination(value);
    }

    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32
    ) external returns (uint256 requestId) {
        consumer = VRFConsumerBaseV2(msg.sender);
        if (currentCombination == Combination.LOSING) {
            lastRandomWords[0] = 1;
            lastRandomWords[1] = 2;
            lastRandomWords[2] = 3;
        } else if (currentCombination == Combination.WINNING) {
            lastRandomWords[0] = 2;
            lastRandomWords[1] = 2;
            lastRandomWords[2] = 2;
        }
        counter += 1;
        requestId = uint256(
            keccak256(abi.encode(block.difficulty, block.timestamp, counter))
        );
        lastRequestId = requestId;
    }

    function triggerRawFulfillRandomWords() external {
        uint256[] memory randomWords = new uint256[](3);
        randomWords[0] = lastRandomWords[0];
        randomWords[1] = lastRandomWords[1];
        randomWords[2] = lastRandomWords[2];
        consumer.rawFulfillRandomWords(lastRequestId, randomWords);
        lastRequestId = 0;
    }
}