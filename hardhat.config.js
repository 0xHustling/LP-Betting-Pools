require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('hardhat-abi-exporter');
require('dotenv').config();
require("solidity-coverage");
require('hardhat-contract-sizer');
require("hardhat-gas-reporter");  

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
  },
  networks: {
      ropsten: {
        chainId: 3,
        url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts: [process.env.WALLET_PK]
      },
      rinkeby: {
        chainId: 4,
        url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts: [process.env.WALLET_PK]
      },
      mainnet: {
        chainId: 1,
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts: [process.env.WALLET_PK]
      },
      bnbtestnet: {
        chainId: 97,
        url: "https://data-seed-prebsc-1-s1.binance.org:8545",
        accounts: [process.env.WALLET_PK]
      },
      bnb: {
        chainId: 56,
        url: "https://bsc-dataseed1.ninicoin.io",
        accounts: [process.env.WALLET_PK]
      },
      mumbai: {
        chainId: 80001 ,
        url: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts: [process.env.WALLET_PK]
      },
      matic: {
        chainId: 137,
        url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts: [process.env.WALLET_PK]
      },
      hardhat: {
        accounts: {
          count: 150,
        },
        mining: {
          mempool: {
            order: "fifo"
          }
        }
      }
    },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  bscscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 9999,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  gasReporter: {
    enabled: true
  },
};
