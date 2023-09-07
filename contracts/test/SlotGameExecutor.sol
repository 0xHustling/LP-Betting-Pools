// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../interfaces/ISlotGame.sol";

contract SlotGameExecutor {
    ISlotGame slotGame;

    constructor(address slotGameAddress) {
        slotGame = ISlotGame(slotGameAddress);
    }

    function executeGameFromContract() public payable {
        slotGame.makeBet();
    }
}
