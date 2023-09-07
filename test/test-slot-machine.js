const { expect } = require("chai");
const { waffle, ethers, upgrades } = require("hardhat");
const { loadFixture } = waffle;

const EXIT_FEE_BPS = "500";
const PROTOCOL_FEE_BPS = "200";
const REWARD_POOL_MAX_CAP = "1000000000000000000000";
const SUBSCRIPTION_ID = "0";
const KEY_HASH =
  "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314";
const CALLBACK_GAS_LIMIT = "2400000";
const VRF_REQUEST_CONFIRMATIONS = "3";
const NUM_WORDS = "3";
const EPOCH_SECONDS = "3600";
const EPOCH_STARTED_AT = Math.floor(new Date("2022.01.01").getTime() / 1000);
const WITHDRAW_TIME_WINDOW_SECONDS = "60";
const MAX_BET_TO_POOL_RATIO = "10";
const MIN_BET_AMOUNT = "1000000000000000000";
const MAX_BET_AMOUNT = "10000000000000000000";

describe("Slot Machine Tests", () => {
  const deployedContracts = async () => {
    const MockVRFCoordinator = await hre.ethers.getContractFactory(
      "MockVRFCoordinator"
    );
    const mockVRFCoordinator = await MockVRFCoordinator.deploy();

    await mockVRFCoordinator.deployed();

    const GameToken = await hre.ethers.getContractFactory("GameToken");
    const gameToken = await GameToken.deploy("Game Token", "GAMETOKEN");

    await gameToken.deployed();

    const HousePool = await hre.ethers.getContractFactory(
      "HousePool"
    );
    const housePool = await HousePool.deploy(
      EXIT_FEE_BPS,
      REWARD_POOL_MAX_CAP,
      EPOCH_SECONDS,
      EPOCH_STARTED_AT,
      WITHDRAW_TIME_WINDOW_SECONDS,
      MAX_BET_TO_POOL_RATIO
    );

    await housePool.deployed();

    const SlotGame = await hre.ethers.getContractFactory(
      "SlotGame"
    );
    const slotGame = await SlotGame.deploy(
      MIN_BET_AMOUNT,
      MAX_BET_AMOUNT,
      PROTOCOL_FEE_BPS,
      SUBSCRIPTION_ID,
      KEY_HASH,
      CALLBACK_GAS_LIMIT,
      VRF_REQUEST_CONFIRMATIONS,
      NUM_WORDS,
      mockVRFCoordinator.address,
      housePool.address
    );

    await slotGame.deployed();

    await housePool.setAuthorizedGame(
      slotGame.address,
      true
    );

    const SlotGameExecutor = await hre.ethers.getContractFactory(
      "SlotGameExecutor"
    );
    const slotGameExecutor = await SlotGameExecutor.deploy(
      slotGame.address
    );

    await slotGameExecutor.deployed();

    return {
      gameToken,
      mockVRFCoordinator,
      housePool,
      slotGame,
      slotGameExecutor,
    };
  };

  it("should successfully deploy HousePool with correct configuration", async () => {
    const { housePool, gameToken } = await loadFixture(
      deployedContracts
    );

    const exitFeeBps = await housePool.exitFeeBps();
    const poolMaxCap = await housePool.poolMaxCap();
    const epochSeconds = await housePool.epochSeconds();
    const epochStartedAt = await housePool.epochStartedAt();
    const withdrawTimeWindowSeconds =
      await housePool.withdrawTimeWindowSeconds();
    const maxBetToPoolRatio = await housePool.maxBetToPoolRatio();

    expect(exitFeeBps).to.equal(EXIT_FEE_BPS);
    expect(poolMaxCap).to.equal(REWARD_POOL_MAX_CAP);
    expect(epochSeconds).to.equal(EPOCH_SECONDS);
    expect(epochStartedAt).to.equal(EPOCH_STARTED_AT);
    expect(withdrawTimeWindowSeconds).to.equal(WITHDRAW_TIME_WINDOW_SECONDS);
    expect(maxBetToPoolRatio).to.equal(MAX_BET_TO_POOL_RATIO);
  });

  it("should successfully deploy SlotGame with correct configuration", async () => {
    const { housePool, gameToken, slotGame } =
      await loadFixture(deployedContracts);

    const minBetAmount = await slotGame.minBetAmount();
    const maxBetAmount = await slotGame.maxBetAmount();
    const protocolFeeBps = await slotGame.protocolFeeBps();
    const housePoolAddress = await slotGame.housePool();

    expect(minBetAmount).to.equal(MIN_BET_AMOUNT);
    expect(maxBetAmount).to.equal(MAX_BET_AMOUNT);
    expect(protocolFeeBps).to.equal(PROTOCOL_FEE_BPS);
    expect(housePoolAddress).to.equal(housePool.address);
  });

  it("should successfully execute a spin", async () => {
    const { slotGame, housePool } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    await housePool
      .connect(accounts[0])
      .addRewardsLiquidity({ value: "900000000000000000000" });

    // Finalize epoch if ended
    await housePool.finalizeEpoch();

    await expect(
      slotGame
        .connect(accounts[1])
        .makeBet({ value: "1000000000000000000" })
    ).to.be.emit(slotGame, "BetPlaced");
  });

  it("should successfully provide liquidity", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");
  });

  it("should NOT be able to provide liquidity above max cap", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "1000000000000000000001" })
    ).revertedWith("House Pool: Reward Pool Max Cap Exceeded");
  });

  it("should successfully mint LP Rewards Token after liquidity is provided", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    const lpTokenBalance = await housePool.balanceOf(
      accounts[0].address
    );
    expect(lpTokenBalance).to.equal("1000000000000000000");
  });

  it("should successfully withdraw liquidity", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      housePool
        .connect(accounts[0])
        .removeRewardsLiquidity("1000000000000000000")
    ).to.be.emit(housePool, "RewardsLiquidityRemoved");

    const lpTokenBalance = await housePool.balanceOf(
      accounts[0].address
    );
    expect(lpTokenBalance).to.equal("0");
  });

  it("should NOT be able to withdraw liquidity if you have not provided any", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      housePool
        .connect(accounts[1])
        .removeRewardsLiquidity("1000000000000000000")
    ).revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("should successfully deduct exit fee when withdrawing liquidity", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[1])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      housePool
        .connect(accounts[1])
        .removeRewardsLiquidity("1000000000000000000")
    ).to.be.emit(housePool, "RewardsLiquidityRemoved");

    const protocolRewardsBalance =
      await housePool.protocolRewardsBalance();
    expect(protocolRewardsBalance).to.equal("100000000000000000");
  });

  it("Only owner should successfully withdraw protocol funds", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      housePool
        .connect(accounts[0])
        .removeRewardsLiquidity("1000000000000000000")
    ).to.be.emit(housePool, "RewardsLiquidityRemoved");

    await expect(
      housePool.connect(accounts[1]).withdrawProtocolFees()
    ).revertedWith("Ownable: caller is not the owner");
    await housePool.connect(accounts[0]).withdrawProtocolFees();
  });

  it("Only owner should successfully update minBet", async () => {
    const { slotGame } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      slotGame
        .connect(accounts[1])
        .updateMinBetAmount("20000000000000000")
    ).revertedWith("Ownable: caller is not the owner");

    await expect(
      slotGame
        .connect(accounts[0])
        .updateMinBetAmount("20000000000000000")
    ).to.be.emit(slotGame, "MinBetAmountUpdated");

    const newMinBetAmount = await slotGame.minBetAmount();
    expect(newMinBetAmount).to.equal("20000000000000000");
  });

  it("Only owner should successfully update maxBet", async () => {
    const { slotGame } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      slotGame
        .connect(accounts[1])
        .updateMaxBetAmount("20000000000000000")
    ).revertedWith("Ownable: caller is not the owner");

    await expect(
      slotGame
        .connect(accounts[0])
        .updateMaxBetAmount("20000000000000000")
    ).to.be.emit(slotGame, "MaxBetAmountUpdated");

    const newMaxBetAmount = await slotGame.maxBetAmount();
    expect(newMaxBetAmount).to.equal("20000000000000000");
  });

  it("Only owner should successfully update exit fee", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool.connect(accounts[1]).updateExitFeeBps("1000")
    ).revertedWith("Ownable: caller is not the owner");

    await expect(
      housePool.connect(accounts[0]).updateExitFeeBps("1000")
    ).to.be.emit(housePool, "ExitFeeUpdated");

    const newExitFeeBps = await housePool.exitFeeBps();
    expect(newExitFeeBps).to.equal("1000");
  });

  it("Only owner should successfully update protocol fee", async () => {
    const { slotGame } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      slotGame.connect(accounts[1]).updateProtocolFeeBps("1000")
    ).revertedWith("Ownable: caller is not the owner");

    await expect(
      slotGame.connect(accounts[0]).updateProtocolFeeBps("1000")
    ).to.be.emit(slotGame, "ProtocolFeeUpdated");

    const newProtocolFeeBps = await slotGame.protocolFeeBps();
    expect(newProtocolFeeBps).to.equal("1000");
  });

  it("Only owner should successfully update reward pool max cap", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await expect(
      housePool
        .connect(accounts[1])
        .updateRewardPoolMaxCap("1000000000000000000")
    ).revertedWith("Ownable: caller is not the owner");

    await expect(
      housePool
        .connect(accounts[0])
        .updateRewardPoolMaxCap("2000000000000000000")
    ).to.be.emit(housePool, "RewardPoolMaxCapUpdated");

    const newRewardPoolMaxCap = await housePool.poolMaxCap();
    expect(newRewardPoolMaxCap).to.equal("2000000000000000000");
  });

  it("should NOT execute make bet if there are not enough funds to pay the highest possible prize", async () => {
    const { housePool, slotGame } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    // Finalize epoch if ended
    await housePool.finalizeEpoch();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "10000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      slotGame
        .connect(accounts[1])
        .makeBet({ value: "1000000000000000000" })
    ).revertedWith("House Pool: Insufficient liquidity to payout bet");
  });

  it("should NOT be able to make bet below minimum bet", async () => {
    const { slotGame, housePool } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();

    await housePool.finalizeEpoch();

    await expect(
      housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "10000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      slotGame
        .connect(accounts[1])
        .makeBet({ value: "10000000000000000" })
    ).revertedWith("Slot Machine: Invalid bet amount");
  });

  it("should NOT be able to able to execute a roll from a contract", async () => {
    const { housePool, slotGameExecutor } = await loadFixture(
      deployedContracts
    );
    const accounts = await ethers.getSigners();
    expect(
      await housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "900000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    await expect(
      slotGameExecutor
        .connect(accounts[1])
        .executeGameFromContract({ value: "1500000000000000000" })
    ).revertedWith("Slot Machine: Msg sender should be original caller");
  });

  it("should successfully update house pool balance after", async () => {
    const { slotGame, housePool, mockVRFCoordinator } =
      await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await housePool.finalizeEpoch();
    await mockVRFCoordinator.setCombination(1);

    await housePool
      .connect(accounts[1])
      .addRewardsLiquidity({ value: "900000000000000000000" });

    expect(
      await slotGame
        .connect(accounts[2])
        .makeBet({ value: "1000000000000000000" })
    ).to.be.emit(slotGame, "BetPlaced");

    await mockVRFCoordinator.triggerRawFulfillRandomWords();
    const housePoolBalance = await housePool.poolBalance();
    expect(housePoolBalance).to.equal("886280000000000000000");
  });

  it("should successfully update reward pool balance if roll is lost", async () => {
    const { slotGame, housePool, mockVRFCoordinator } =
      await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await housePool.finalizeEpoch();
    await mockVRFCoordinator.setCombination(0);

    await housePool
      .connect(accounts[1])
      .addRewardsLiquidity({ value: "900000000000000000000" });

    expect(
      await slotGame
        .connect(accounts[2])
        .makeBet({ value: "1000000000000000000" })
    ).to.be.emit(slotGame, "BetPlaced");

    await mockVRFCoordinator.triggerRawFulfillRandomWords();
    const housePoolBalance = await housePool.poolBalance();
    expect(housePoolBalance).to.equal("900980000000000000000");
  });

  it("should calculate properly the total LP percentage of the pool when providing liquidity ", async () => {
    const { housePool } = await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    expect(
      await housePool
        .connect(accounts[0])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    const lpTokenBalance1 = await housePool.balanceOf(
      accounts[0].address
    );
    expect(lpTokenBalance1).to.equal("1000000000000000000");

    expect(
      await housePool
        .connect(accounts[1])
        .addRewardsLiquidity({ value: "1000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    const lpTokenBalance2 = await housePool.balanceOf(
      accounts[1].address
    );
    expect(lpTokenBalance2).to.equal("500000000000000000");

    expect(
      await housePool
        .connect(accounts[2])
        .addRewardsLiquidity({ value: "1000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    const lpTokenBalance3 = await housePool.balanceOf(
      accounts[2].address
    );
    expect(lpTokenBalance3).to.equal("500000000000000000");

    expect(
      await housePool
        .connect(accounts[3])
        .addRewardsLiquidity({ value: "2000000000000000000" })
    ).to.be.emit(housePool, "RewardsLiquidityAdded");

    const lpTokenBalance4 = await housePool.balanceOf(
      accounts[3].address
    );
    expect(lpTokenBalance4).to.equal("1000000000000000000");
  });

  it("should successfully deduct roll fee on roll execution", async () => {
    const { slotGame, mockVRFCoordinator, housePool } =
      await loadFixture(deployedContracts);
    const accounts = await ethers.getSigners();

    await housePool.finalizeEpoch();
    await mockVRFCoordinator.setCombination(0);

    await housePool
      .connect(accounts[1])
      .addRewardsLiquidity({ value: "900000000000000000000" });

    expect(
      await slotGame
        .connect(accounts[1])
        .makeBet({ value: "1000000000000000000" })
    ).to.be.emit(slotGame, "BetPlaced");

    const rewardPoolBalance = await housePool.poolBalance();
    expect(rewardPoolBalance).to.equal("900980000000000000000");
  });
});
