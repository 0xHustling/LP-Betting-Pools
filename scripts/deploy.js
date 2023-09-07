const hre = require("hardhat");

async function main() {
  console.log("Starting deploy Game Token...");

  const GameToken = await hre.ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy(process.env.TOKEN_NAME, process.env.TOKEN_SYMBOL);

  await gameToken.deployed();

  console.log(
    `Game Token deployed to: https://etherscan.io/address/${gameToken.address}`
  );

  console.log("Starting deploy House Pool...");

  const HousePool = await hre.ethers.getContractFactory(
    "HousePool"
  );
  const housePool = await HousePool.deploy(
    process.env.EXIT_FEE_BPS,
    process.env.POOL_MAX_CAP,
    process.env.EPOCH_SECONDS,
    process.env.EPOCH_STARTED_AT,
    process.env.WITHDRAW_WINDOW_SECONDS,
    process.env.MAX_BET_TO_POOL_RATIO,
  );

  await housePool.deployed();

  console.log(
    `House Pool deployed to: https://etherscan.io/address/${housePool.address}`
  );

  console.log("Starting deploy Slot Game...");

  const SlotGame = await hre.ethers.getContractFactory(
    "SlotGame"
  );
  const slotGame = await SlotGame.deploy(
    process.env.MIN_BET_AMOUNT,
    process.env.MAX_BET_AMOUNT,
    process.env.PROTOCOL_FEE_BPS,
    process.env.SUBSCRIPTION_ID,
    process.env.KEY_HASH,
    process.env.CALLBACK_GAS_LIMIT,
    process.env.VRF_REQUEST_CONFIRMATIONS,
    process.env.NUM_WORDS,
    process.env.VRF_COORDINATOR,
    process.env.HOUSE_POOL_ADDRESS
  );

  await slotGame.deployed();

  console.log(
    `Slot Game deployed to: https://etherscan.io/address/${slotGame.address}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
