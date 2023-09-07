// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ISlotGame.sol";
import "./interfaces/IHousePool.sol";
import "./VRFv2Consumer.sol";

contract SlotGame is ISlotGame, VRFv2Consumer, Ownable, Pausable {
    using Address for address;

    struct Bet {
        address player;
        uint88 amount;
        bool isSettled;
        uint128 blockNumber;
        uint128 winAmount;
    }

    /* ========== STATE VARIABLES ========== */

    uint256 public minBetAmount;
    uint256 public maxBetAmount;
    uint256 public protocolFeeBps;

    IHousePool public housePool;

    // mapping requestId => Bet
    mapping(uint256 => Bet) public userBets;

    uint8[6] public rewardMultipliers = [40, 30, 20, 15, 10, 5];

    /// @notice Checks if the bet amount is valid before slot machine spin.
    /// @param betAmount The bet amount.
    modifier onlyValidBet(uint256 betAmount) {
        require(
            _msgSender() == tx.origin,
            "Slot Machine: Msg sender should be original caller"
        );
        require(
            minBetAmount <= betAmount && betAmount <= maxBetAmount,
            "Slot Machine: Invalid bet amount"
        );
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(
        uint256 _minBetAmount,
        uint256 _maxBetAmount,
        uint256 _protocolFeeBps,
        uint64 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        uint32 _numWords,
        address _vrfCordinator,
        address _housePool
    )
        VRFv2Consumer(
            _subscriptionId,
            _keyHash,
            _callbackGasLimit,
            _requestConfirmations,
            _numWords,
            _vrfCordinator
        )
    {
        minBetAmount = _minBetAmount;
        maxBetAmount = _maxBetAmount;
        protocolFeeBps = _protocolFeeBps;

        housePool = IHousePool(_housePool);
    }

    /* ========== VIEWS ========== */

    /// TODO: Add different battle-tested logic for reward calculation
    /// @notice Calculates the current reward, based on the rollPrice and random values returned from Chainlink.
    /// @param spinAmount The roll price.
    /// @param randomWords Array of random numbers fulfilled.
    function calculateWinAmount(
        uint256 spinAmount,
        uint256[] memory randomWords
    )
        internal
        view
        returns (
            uint256 firstReelResult,
            uint256 secondReelResult,
            uint256 thirdReelResult,
            uint256 winAmount
        )
    {
        firstReelResult = expandRandomNumber(randomWords[0]);
        secondReelResult = expandRandomNumber(randomWords[1]);
        thirdReelResult = expandRandomNumber(randomWords[2]);

        // Calculate rewards based on the derived combination
        if (
            firstReelResult == 6 &&
            secondReelResult == 6 &&
            thirdReelResult == 6
        ) {
            winAmount = spinAmount * rewardMultipliers[0];
        } else if (
            firstReelResult == 5 &&
            secondReelResult == 5 &&
            thirdReelResult == 5
        ) {
            winAmount = spinAmount * rewardMultipliers[1];
        } else if (
            firstReelResult == 4 &&
            secondReelResult == 4 &&
            thirdReelResult == 4
        ) {
            winAmount = spinAmount * rewardMultipliers[2];
        } else if (
            firstReelResult == 3 &&
            secondReelResult == 3 &&
            thirdReelResult == 3
        ) {
            winAmount = spinAmount * rewardMultipliers[3];
        } else if (
            firstReelResult == 2 &&
            secondReelResult == 2 &&
            thirdReelResult == 2
        ) {
            winAmount = spinAmount * rewardMultipliers[4];
        } else if (
            firstReelResult == 1 &&
            secondReelResult == 1 &&
            thirdReelResult == 1
        ) {
            winAmount = spinAmount * rewardMultipliers[5];
        } else if (
            (firstReelResult == secondReelResult) ||
            (firstReelResult == thirdReelResult) ||
            (secondReelResult == thirdReelResult)
        ) {
            winAmount = spinAmount;
        } else {
            winAmount = 0;
        }
    }

    function expandRandomNumber(uint256 randomValue)
        internal
        pure
        returns (uint256 expandedValue)
    {
        // Expand random number
        expandedValue = (randomValue % 6) + 1;
    }

    /// @notice Calculates the protocol fee
    /// @param _betAmount The bet amount
    /// @param _protocolFeeBps The protocol fee in basis points
    function calculateProtocolFee(
        uint256 _betAmount,
        uint256 _protocolFeeBps
    ) internal pure returns (uint256 protocolFee) {
        protocolFee = (_protocolFeeBps * _betAmount) / 10000;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /// @notice Executes a slot machine roll by player, who has enough balance.
    function makeBet() external payable whenNotPaused onlyValidBet(msg.value) {
        uint256 betAmount = msg.value;
        uint256 protocolFee = calculateProtocolFee(
            betAmount,
            protocolFeeBps
        );
        uint256 requestId = requestRandomWords();

        userBets[requestId].player = _msgSender();
        userBets[requestId].amount = uint88(betAmount);
        userBets[requestId].blockNumber = uint128(block.number);

        emit BetPlaced(betAmount, requestId, _msgSender());

        housePool.placeBet{value: betAmount}(
            protocolFee,
            (betAmount * rewardMultipliers[0])
        );
    }

    /// @notice Updates the min bet amount for playing.
    /// @param newMinBetAmount The new min bet amount.
    function updateMinBetAmount(uint256 newMinBetAmount) external onlyOwner {
        minBetAmount = newMinBetAmount;

        emit MinBetAmountUpdated(newMinBetAmount);
    }

    /// @notice Updates the max bet amount for playing.
    /// @param newMaxBetAmount The new max bet amount.
    function updateMaxBetAmount(uint256 newMaxBetAmount) external onlyOwner {
        maxBetAmount = newMaxBetAmount;

        emit MaxBetAmountUpdated(newMaxBetAmount);
    }

    /// @notice Updates the roll fee deducted on every roll.
    /// @param newProtocolFeeBps The new roll fee in basis points.
    function updateProtocolFeeBps(uint256 newProtocolFeeBps)
        external
        onlyOwner
    {
        protocolFeeBps = newProtocolFeeBps;

        emit ProtocolFeeUpdated(newProtocolFeeBps);
    }

    /// @notice Updates the house pool address
    /// @param newHousePoolAddress The new house pool address.
    function updateHousePoolAddress(address newHousePoolAddress)
        external
        onlyOwner
    {
        require(
            newHousePoolAddress != address(0),
            "Slot Machine: Cannot set address zero"
        );
        housePool = IHousePool(newHousePoolAddress);

        emit HousePoolUpdated(newHousePoolAddress);
    }

    /// @notice Pauses the contract.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Requests randomness from Chainlink. Called inside makeBet.
    /// Assumes the subscription is funded sufficiently.
    function requestRandomWords() internal returns (uint256 _userRequestId) {
        _userRequestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
    }

    /// @notice Callback function, executed by Chainlink's VRF Coordinator contract.
    /// @param requestId The respective request id.
    /// @param randomWords Array of random numbers fulfilled.
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        internal
        override
    {
        settleBet(requestId, randomWords);
    }

    /// @notice Settles the pending bet.
    /// @param requestId The respective request id.
    /// @param randomWords Array of random numbers fulfilled.
    function settleBet(uint256 requestId, uint256[] memory randomWords)
        internal
    {
        // Get the bet which will be settled
        Bet storage bet = userBets[requestId];

        // Get the spin price
        uint256 betAmount = bet.amount;

        // Calculate protocol fee
        uint256 protocolFee = calculateProtocolFee(
            betAmount,
            protocolFeeBps
        );

        // Calculate the win amount if any
        (
            uint256 firstReel,
            uint256 secondReel,
            uint256 thirdReel,
            uint256 winAmount
        ) = calculateWinAmount((betAmount - protocolFee), randomWords);

        // Store the win amount in the struct
        bet.winAmount = uint128(winAmount);

        // Check if there is enough liquidity to payout the pending bet or if bet is already settled
        if (bet.isSettled || housePool.poolBalance() < winAmount) {
            return;
        }

        bet.isSettled = true;

        emit BetSettled(
            firstReel,
            secondReel,
            thirdReel,
            winAmount,
            requestId,
            bet.player
        );

        housePool.settleBet(
            winAmount,
            bet.player,
            (bet.amount * rewardMultipliers[0])
        );
    }

    /// @notice Refunds non payed bet in case VRF callback has reverted.
    /// @param requestId The respective request id.
    function refundBet(uint256 requestId) external {
        // Get the bet which will be settled
        Bet storage bet = userBets[requestId];

        // Get the spin price
        uint256 betAmount = bet.amount;

        // Calculate protocol fee
        uint256 protocolFee = calculateProtocolFee(
            betAmount,
            protocolFeeBps
        );

        // Calculate the win amount if any
        uint256 winAmount = betAmount - protocolFee;

        // Check if there is enough liquidity to payout the pending bet or if bet is already settled
        require(
            winAmount > 0,
            "Slot Machine: Amount should be greater than zero"
        );
        require(!bet.isSettled, "Slot Machine: Bet is already settled");
        require(
            block.number > bet.blockNumber + 43200,
            "Slot Machine: Try requesting a refund later"
        );
        require(
            housePool.poolBalance() >= winAmount,
            "Slot Machine: Insufficient liqudity to payout bet"
        );

        bet.winAmount = uint128(winAmount);
        bet.isSettled = true;

        emit BetRefunded(winAmount, requestId, bet.player);

        housePool.settleBet(
            winAmount,
            bet.player,
            bet.amount * rewardMultipliers[0]
        );
    }

    /* ========== EVENTS ========== */

    event MinBetAmountUpdated(uint256 newMinBetAmount);
    event MaxBetAmountUpdated(uint256 newMaxBetAmount);
    event ProtocolFeeUpdated(uint256 newProtocolFeeBps);
    event HousePoolUpdated(address newHousePoolAddress);
    event BetPlaced(uint256 betAmount, uint256 requestId, address player);
    event BetRefunded(uint256 betAmount, uint256 requestId, address player);
    event BetSettled(uint256 firstReel, uint256 secondReel, uint256 thirdReel, uint256 winAmount, uint256 requestId, address player);
}
