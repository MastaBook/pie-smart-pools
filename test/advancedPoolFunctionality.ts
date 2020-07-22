// This way of importing is a bit funky. We should fix this in the Mock Contracts package
import {MockTokenFactory} from "@pie-dao/mock-contracts/dist/typechain/MockTokenFactory";
import {MockToken} from "@pie-dao/mock-contracts/typechain/MockToken";
import {ethers, run} from "@nomiclabs/buidler";
import {Signer, Wallet, utils, constants} from "ethers";
import {BigNumber, BigNumberish} from "ethers/utils";
import chai from "chai";
import {deployContract, solidity} from "ethereum-waffle";

import {deployBalancerPool, linkArtifact} from "../utils";
import {IbPool} from "../typechain/IBPool";
import {IbPoolFactory} from "../typechain/IBPoolFactory";
import {Pv2SmartPool} from "../typechain/PV2SmartPool";
import PV2SmartPoolArtifact from "../artifacts/PV2SmartPool.json";

chai.use(solidity);
const {expect} = chai;

const NAME = "TEST POOL";
const SYMBOL = "TPL";
const INITIAL_SUPPLY = constants.WeiPerEther;

describe("Advanced Pool Functionality", function () {
  this.timeout(3000000);
  let signers: Signer[];
  let account: string;
  let account2: string;
  let tokens: MockToken[];
  let pool: IbPool;
  let smartpool: Pv2SmartPool;
  let startBlock: number;
  let endBlock: number;

  beforeEach(async () => {
    signers = await ethers.signers();
    account = await signers[0].getAddress();
    account2 = await signers[1].getAddress();

    pool = IbPoolFactory.connect(await deployBalancerPool(signers[0]), signers[0]);

    const tokenFactory = new MockTokenFactory(signers[0]);
    tokens = [];

    for (let i = 0; i < 8; i++) {
      const token: MockToken = await tokenFactory.deploy(`Mock ${i}`, `M${i}`, 18);
      await token.mint(account, constants.WeiPerEther.mul(1000000));
      await token.mint(await signers[1].getAddress(), constants.WeiPerEther.mul(1000000));
      await token.approve(pool.address, constants.MaxUint256);
      pool.bind(token.address, constants.WeiPerEther, constants.WeiPerEther.mul(2));
      tokens.push(token);
    }

    smartpool = (await run("deploy-libraries-and-smartpool")) as Pv2SmartPool;

    await smartpool.init(pool.address, NAME, SYMBOL, INITIAL_SUPPLY);
    await smartpool.approveTokens();
    await pool.setController(smartpool.address);

    for (const token of tokens) {
      await token.approve(smartpool.address, constants.MaxUint256);
      // Attach alt signer to token and approve pool
      await MockTokenFactory.connect(token.address, signers[1]).approve(
        smartpool.address,
        constants.MaxUint256
      );
    }

    startBlock = (await ethers.provider.getBlockNumber()) + 1;
    endBlock = startBlock + 100;
  });

  describe("updateWeight()", async () => {
    it("Updating the weigth from a non controller should fail", async () => {
      smartpool = smartpool.connect(signers[1]);
      await expect(
        smartpool.updateWeight(tokens[0].address, constants.WeiPerEther)
      ).to.be.revertedWith("PV2SmartPool.onlyController: not controller");
    });

    it("Updating down should work", async () => {
      const weightBefore = await smartpool.getDenormalizedWeight(tokens[0].address);
      const totalWeightBefore = await pool.getTotalDenormalizedWeight();
      const poolTokenBalanceBefore = await tokens[0].balanceOf(pool.address);
      const userTokenBalanceBefore = await tokens[0].balanceOf(account);
      const userSmartPoolTokenBalanceBefore = await smartpool.balanceOf(account);
      const poolSmartPoolTokenTotalSupplyBefore = await smartpool.totalSupply();

      await smartpool.updateWeight(tokens[0].address, constants.WeiPerEther);

      const newWeight = await smartpool.getDenormalizedWeight(tokens[0].address);
      const totalWeightAfter = await pool.getTotalDenormalizedWeight();
      const poolTokenBalanceAfter = await tokens[0].balanceOf(pool.address);
      const userTokenBalanceAfter = await tokens[0].balanceOf(account);
      const userSmartPoolTokenBalanceAfter = await smartpool.balanceOf(account);
      const poolSmartPoolTokenTotalSupplyAfter = await smartpool.totalSupply();

      const expectedBurn = poolSmartPoolTokenTotalSupplyBefore
        .mul(totalWeightBefore.sub(totalWeightAfter))
        .div(totalWeightBefore);
      const expectedTokenWithdraw = poolTokenBalanceBefore.mul(newWeight).div(weightBefore);

      expect(newWeight).to.eq(constants.WeiPerEther);
      expect(userSmartPoolTokenBalanceAfter).to.eq(
        userSmartPoolTokenBalanceBefore.sub(expectedBurn)
      );
      expect(poolSmartPoolTokenTotalSupplyAfter).to.eq(
        poolSmartPoolTokenTotalSupplyBefore.sub(expectedBurn)
      );
      expect(userTokenBalanceAfter).to.eq(userTokenBalanceBefore.add(expectedTokenWithdraw));
      expect(poolTokenBalanceAfter).to.eq(poolTokenBalanceBefore.sub(expectedTokenWithdraw));
      expect(totalWeightAfter).to.eq(totalWeightBefore.sub(constants.WeiPerEther));
    });

    it("Updating down while the token transfer returns false should fail", async () => {
      await tokens[0].setTransferReturnFalse(true);
      await expect(
        smartpool.updateWeight(tokens[0].address, constants.WeiPerEther)
      ).to.be.revertedWith("ERR_ERC20_FALSE");
    });

    it("Updating down while not having enough pool tokens should fail", async () => {
      const balance = await smartpool.balanceOf(account);
      await smartpool.transfer(account2, balance);

      await expect(
        smartpool.updateWeight(tokens[0].address, constants.WeiPerEther)
      ).to.be.revertedWith("ERR_INSUFFICIENT_BAL");
    });

    it("Updating up should work", async () => {
      const weightBefore = await smartpool.getDenormalizedWeight(tokens[0].address);
      const totalWeightBefore = await pool.getTotalDenormalizedWeight();
      const poolTokenBalanceBefore = await tokens[0].balanceOf(pool.address);
      const userTokenBalanceBefore = await tokens[0].balanceOf(account);
      const userSmartPoolTokenBalanceBefore = await smartpool.balanceOf(account);
      const poolSmartPoolTokenTotalSupplyBefore = await smartpool.totalSupply();

      await smartpool.updateWeight(tokens[0].address, constants.WeiPerEther.mul(4));

      const newWeight = await smartpool.getDenormalizedWeight(tokens[0].address);
      const totalWeightAfter = await pool.getTotalDenormalizedWeight();
      const poolTokenBalanceAfter = await tokens[0].balanceOf(pool.address);
      const userTokenBalanceAfter = await tokens[0].balanceOf(account);
      const userSmartPoolTokenBalanceAfter = await smartpool.balanceOf(account);
      const poolSmartPoolTokenTotalSupplyAfter = await smartpool.totalSupply();

      const expectedMint = poolSmartPoolTokenTotalSupplyBefore
        .mul(totalWeightAfter.sub(totalWeightBefore))
        .div(totalWeightBefore);
      const expectedTokenDeposit = poolTokenBalanceBefore
        .mul(newWeight)
        .div(weightBefore)
        .sub(poolTokenBalanceBefore);

      expect(newWeight).to.eq(constants.WeiPerEther.mul(4));
      expect(userSmartPoolTokenBalanceAfter).to.eq(
        userSmartPoolTokenBalanceBefore.add(expectedMint)
      );
      expect(poolSmartPoolTokenTotalSupplyAfter).to.eq(
        poolSmartPoolTokenTotalSupplyBefore.add(expectedMint)
      );
      expect(userTokenBalanceAfter).to.eq(userTokenBalanceBefore.sub(expectedTokenDeposit));
      expect(poolTokenBalanceAfter).to.eq(poolTokenBalanceBefore.add(expectedTokenDeposit));
      expect(totalWeightAfter).to.eq(totalWeightBefore.add(constants.WeiPerEther.mul(2)));
    });

    it("Updating up while not having enough of the underlying should fail", async () => {
      const balance = await tokens[0].balanceOf(account);
      await tokens[0].transfer(account2, balance);

      await expect(
        smartpool.updateWeight(tokens[0].address, constants.WeiPerEther.mul(4))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Updating up while the token transferFrom returns false should fail", async () => {
      await tokens[0].setTransferFromReturnFalse(true);
      await expect(
        smartpool.updateWeight(tokens[0].address, constants.WeiPerEther.mul(4))
      ).to.be.revertedWith("TRANSFER_FAILED");
    });

    it("Updating up while the underlying token is not approved should fail", async () => {
      await tokens[0].approve(smartpool.address, 0);
      await expect(
        smartpool.updateWeight(tokens[0].address, constants.WeiPerEther.mul(4))
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });
  });

  describe("updateWeightsGradually()", async () => {
    const weightsFixtureUp = [
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
    ];

    const weightsFixtureTokenAboveMax = [
      constants.WeiPerEther.mul(51),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
    ];

    const weightsFixtureTokenBelowMin = [
      constants.WeiPerEther.div(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
      constants.WeiPerEther.mul(2),
    ];

    const weightsFixtureTotalAboveMax = [
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
      constants.WeiPerEther.mul(10),
    ];

    it("Updating from a non controller should fail", async () => {
      smartpool = smartpool.connect(signers[1]);
      await expect(
        smartpool.updateWeightsGradually(weightsFixtureUp, startBlock, endBlock)
      ).to.be.revertedWith("PV2SmartPool.onlyController: not controller");
    });

    it("Updating should work", async () => {
      const currentWeights = await smartpool.getDenormalizedWeights();

      await smartpool.updateWeightsGradually(weightsFixtureUp, startBlock, endBlock);

      const newWeights = await smartpool.getNewWeights();
      const newCurrentWeights = await smartpool.getDenormalizedWeights();

      expect(newWeights).to.eql(weightsFixtureUp);
      expect(newCurrentWeights).to.eql(currentWeights);
    });

    it("Setting a start block in the past should set it to the current block", async () => {
      const currentWeights = await smartpool.getDenormalizedWeights();

      await smartpool.updateWeightsGradually(weightsFixtureUp, 0, endBlock);
      const currentBlock = await ethers.provider.getBlockNumber();

      const newWeights = await smartpool.getNewWeights();
      const newCurrentWeights = await smartpool.getDenormalizedWeights();
      const startBlockVal = await smartpool.getStartBlock();

      expect(startBlockVal).to.eq(currentBlock);

      expect(newWeights).to.eql(weightsFixtureUp);
      expect(newCurrentWeights).to.eql(currentWeights);
    });

    it("Updating the weight of a token above the max should fail", async () => {
      await expect(
        smartpool.updateWeightsGradually(weightsFixtureTokenAboveMax, startBlock, endBlock)
      ).to.be.revertedWith("ERR_WEIGHT_ABOVE_MAX");
    });

    it("Updating the weight of a token below the minimum should fail", async () => {
      await expect(
        smartpool.updateWeightsGradually(weightsFixtureTokenBelowMin, startBlock, endBlock)
      ).to.be.revertedWith("ERR_WEIGHT_BELOW_MIN");
    });

    it("Updating the weights above the total max weight should fail", async () => {
      await expect(
        smartpool.updateWeightsGradually(weightsFixtureTotalAboveMax, startBlock, endBlock)
      ).to.be.revertedWith("ERR_MAX_TOTAL_WEIGHT");
    });

    it("Updating to a start block which is bigger before the end block should fail", async () => {
      await expect(
        smartpool.updateWeightsGradually(weightsFixtureUp, endBlock + 1, endBlock)
      ).to.be.revertedWith(
        "PWeightControlledSmartPool.updateWeightsGradually: End block must be after start block"
      );
    });
  });

  describe("pokeWeight()", async () => {
    const weigthsFixturePokeWeightsUp = [
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
      constants.WeiPerEther.mul(4),
    ];

    const weigthsFixturePokeWeightsDown = [
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
      constants.WeiPerEther.mul(1),
    ];

    it("Poking the weights up should work", async () => {
      await smartpool.updateWeightsGradually(weigthsFixturePokeWeightsUp, startBlock, endBlock);
      const weightsBefore = await smartpool.getDenormalizedWeights();
      await smartpool.pokeWeights();
      const currentBlock = await ethers.provider.getBlockNumber();
      const weightsAfter = await smartpool.getDenormalizedWeights();

      for (let i = 0; i < weightsAfter.length; i++) {
        const expectedIncrease = weigthsFixturePokeWeightsUp[i]
          .sub(weightsBefore[i])
          .mul(currentBlock - startBlock)
          .div(endBlock - startBlock);
        expect(weightsAfter[i]).to.eq(
          weightsBefore[i].add(expectedIncrease),
          "Weight increase incorrect"
        );
      }
    });

    it("Poking the weights down should work", async () => {
      await smartpool.updateWeightsGradually(weigthsFixturePokeWeightsDown, startBlock, endBlock);
      const weightsBefore = await smartpool.getDenormalizedWeights();
      await smartpool.pokeWeights();
      const currentBlock = await ethers.provider.getBlockNumber();
      const weightsAfter = await smartpool.getDenormalizedWeights();

      for (let i = 0; i < weightsAfter.length; i++) {
        const expectedDecrease = weightsBefore[i]
          .sub(weigthsFixturePokeWeightsDown[i])
          .mul(currentBlock - startBlock)
          .div(endBlock - startBlock);
        expect(weightsAfter[i]).to.eq(
          weightsBefore[i].sub(expectedDecrease),
          "Weight decrease incorrect"
        );
      }
    });

    it("Poking the weight after the end block should work", async () => {
      await smartpool.updateWeightsGradually(weigthsFixturePokeWeightsUp, startBlock, endBlock);
      await mine_blocks(200);

      await smartpool.pokeWeights();
      const weightsAfter = await smartpool.getDenormalizedWeights();

      expect(weightsAfter).to.eql(weigthsFixturePokeWeightsUp, "Weight increase incorrect");
    });

    describe("Adding tokens", async () => {
      let newToken: MockToken;

      beforeEach(async () => {
        // Pop off the last token for testing
        await smartpool.removeToken(tokens[tokens.length - 1].address);
        newToken = tokens[tokens.length - 1];
      });

      it("commitAddToken should work", async () => {
        const balance = constants.WeiPerEther.mul(100);
        const weight = constants.WeiPerEther.mul(2);
        await smartpool.commitAddToken(newToken.address, balance, weight);
        const blockNumber = await ethers.provider.getBlockNumber();
        const newTokenStruct = await smartpool.getNewToken();

        expect(newTokenStruct.addr).to.eq(newToken.address);
        expect(newTokenStruct.isCommitted).to.eq(true);
        expect(newTokenStruct.balance).to.eq(balance);
        expect(newTokenStruct.denorm).to.eq(weight);
        expect(newTokenStruct.commitBlock).to.eq(blockNumber);
      });

      it("commitAddToken from a non controller should fail", async () => {
        await smartpool.setController(account2);
        await expect(
          smartpool.commitAddToken(newToken.address, new BigNumber(1), constants.WeiPerEther.mul(2))
        ).to.be.revertedWith("PV2SmartPool.onlyController: not controller");
      });

      it("Apply add token should work", async () => {
        const balance = constants.WeiPerEther.mul(100);
        const weight = constants.WeiPerEther.mul(2);
        await smartpool.commitAddToken(newToken.address, balance, weight);
        const blockNumber = await ethers.provider.getBlockNumber();

        const tokensBefore = await smartpool.getTokens();
        const totalWeightBefore = await pool.getTotalDenormalizedWeight();
        const totalSupplyBefore = await smartpool.totalSupply();
        const expectedMint = await totalSupplyBefore.mul(weight).div(totalWeightBefore);
        const userPoolBalanceBefore = await smartpool.balanceOf(account);

        await smartpool.applyAddToken();
        const newTokenStruct = await smartpool.getNewToken();

        const tokensAfter = await smartpool.getTokens();
        const poolNewTokenBalance = await newToken.balanceOf(pool.address);
        const totalWeightAfter = await pool.getTotalDenormalizedWeight();
        const totalSupplyAfter = await smartpool.totalSupply();
        const userPoolBalanceAfter = await smartpool.balanceOf(account);

        expect(newTokenStruct.addr).to.eq(newToken.address);
        expect(newTokenStruct.isCommitted).to.eq(false);
        expect(newTokenStruct.balance).to.eq(balance);
        expect(newTokenStruct.denorm).to.eq(weight);
        expect(newTokenStruct.commitBlock).to.eq(blockNumber);
        expect(tokensAfter.length).to.eq(tokensBefore.length + 1);
        expect(poolNewTokenBalance).to.eq(balance);
        expect(totalWeightAfter).to.eq(totalWeightBefore.add(weight));
        expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(expectedMint));
        expect(userPoolBalanceAfter).to.eq(userPoolBalanceBefore.add(expectedMint));
      });
    });

    describe("removeToken", async () => {
      it("removeToken should work", async () => {
        const removedToken = tokens[0];
        const tokenWeight = await smartpool.getDenormalizedWeight(removedToken.address);

        const totalWeightBefore = await pool.getTotalDenormalizedWeight();
        const totalSupplyBefore = await smartpool.totalSupply();
        const userPoolBalanceBefore = await smartpool.balanceOf(account);
        const userTokenBalanceBefore = await removedToken.balanceOf(account);
        const poolTokenBalanceBefore = await removedToken.balanceOf(pool.address);
        const tokensBefore = await smartpool.getTokens();

        const expectedPoolBurn = totalSupplyBefore.mul(tokenWeight).div(totalWeightBefore);

        await smartpool.removeToken(removedToken.address);

        const totalWeightAfter = await pool.getTotalDenormalizedWeight();
        const totalSupplyAfter = await smartpool.totalSupply();
        const userPoolBalanceAfter = await smartpool.balanceOf(account);
        const userTokenBalanceAfter = await removedToken.balanceOf(account);
        const poolTokenBalanceAfter = await removedToken.balanceOf(pool.address);
        const tokensAfter = await smartpool.getTokens();

        expect(totalWeightAfter).to.eq(totalWeightBefore.sub(tokenWeight));
        expect(totalSupplyAfter).to.eq(totalSupplyBefore.sub(expectedPoolBurn));
        expect(userPoolBalanceAfter).to.eq(userPoolBalanceBefore.sub(expectedPoolBurn));
        expect(userTokenBalanceAfter).to.eq(userTokenBalanceBefore.add(poolTokenBalanceBefore));
        expect(poolTokenBalanceAfter).to.eq(0);
        expect(tokensAfter.length).to.eq(tokensBefore.length - 1);
      });

      it("removeToken should fail when controller does not have enough pool tokens", async () => {
        const removedToken = tokens[0];
        const balance = await smartpool.balanceOf(account);
        await smartpool.transfer(account2, balance);

        await expect(smartpool.removeToken(removedToken.address)).to.be.revertedWith(
          "ERR_INSUFFICIENT_BAL"
        );
      });

      it("removeToken should fail if underlying token transfer returns false", async () => {
        const removedToken = tokens[0];
        await removedToken.setTransferReturnFalse(true);
        await expect(smartpool.removeToken(removedToken.address)).to.be.revertedWith(
          "ERR_ERC20_FALSE"
        );
      });
    });

    describe("Setting joining and exiting enabled", async () => {
      it("setJoinExitEnabled should work", async () => {
        await smartpool.setJoinExitEnabled(true);
        const joinExitEnabled = await smartpool.getJoinExitEnabled();
        expect(joinExitEnabled).to.eq(true);
      });
      it("setJoinExitEnabled from a non controller address should fail", async () => {
        await smartpool.setController(account2);
        await expect(smartpool.setJoinExitEnabled(true)).to.be.revertedWith(
          "PV2SmartPool.onlyController: not controller"
        );
      });
    });

    describe("Circuit Breaker", async () => {
      it("setCircuitBreaker should work", async () => {
        await smartpool.setCircuitBreaker(account2);
        const circuitBreaker = await smartpool.getCircuitBreaker();
        expect(circuitBreaker).to.eq(account2);
      });

      it("setCircuitBreaker from a non controller should fail", async () => {
        await smartpool.setController(account2);
        await expect(smartpool.setCircuitBreaker(account2)).to.be.revertedWith(
          "PV2SmartPool.onlyController: not controller"
        );
      });
      it("tripCircuitBreaker should work", async () => {
        await smartpool.setCircuitBreaker(account);
        await smartpool.setPublicSwap(true);
        await smartpool.setJoinExitEnabled(true);
        await smartpool.tripCircuitBreaker();

        const publicSwapEnabled = await smartpool.isPublicSwap();
        const joinExitEnabled = await smartpool.getJoinExitEnabled();

        expect(publicSwapEnabled).to.eq(false);
        expect(joinExitEnabled).to.eq(false);
      });

      it("tripCircuitBreaker from a non circuitbreaker address should fail", async () => {
        await expect(smartpool.tripCircuitBreaker()).to.be.revertedWith(
          "PV2SmartPool.onlyCircuitBreaker: not circuit breaker"
        );
      });
    });

    describe("Annual Fee", async () => {
      it("Charging the fee should work", async () => {});
      it("Setting the fee should work", async () => {});
  
      it("Zero fee should work", async () => {});
      it("Changing the fee should charge it", async () => {});
    });
  });
});

async function mine_blocks(amount: number) {
  for (let i = 0; i < amount; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}
