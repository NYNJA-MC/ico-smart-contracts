"use strict";

// @title   TokenSaleWorkflow.test.js
// @author  Jose Perez - <jose.perez@diginex.com>
// @dev     Token sale workflow with all token sale smart contracts

const NYNJACoin = artifacts.require('../contracts/NYNJACoin.sol');
const VestingTrustee = artifacts.require('../contracts/VestingTrustee.sol');
const ExchangeRate = artifacts.require('../contracts/ExchangeRate.sol');
const MultiSigWalletWithDailyLimit = artifacts.require('../contracts/MultiSigWalletWithDailyLimit.sol');
const Web3 = require('web3');
const time = require('./helpers/time');
const constants = require('./helpers/constants');

contract('TokenSaleWorkflow', function (accounts) {

    const owner = accounts[1];
    const assigner = accounts[2];
    const locker = accounts[3];
    const vester = accounts[4];
    const rateUpdater = accounts[5];
    const clientWallets = accounts.slice(6, 9);
    const someoneElse = accounts[9];
    const revokableAddress = accounts[10];
    const participants = accounts.slice(10, 12);

    let token;
    let vestingTrustee;
    let exchangeRate;
    let multisig;

    before(async function () {
        web3 = new Web3(new Web3.providers.HttpProvider());
        token = await NYNJACoin.new(assigner, locker, { from: owner });
        vestingTrustee = await VestingTrustee.new(token.address, vester, { from: owner });
        exchangeRate = await ExchangeRate.new(rateUpdater, { from: owner });
        multisig = await MultiSigWalletWithDailyLimit.new(clientWallets, 2, 0, { from: someoneElse });
    });

    describe('whole token sale', function () {
        it('vested and unvested token distribution', async function () {
            await token.tokenSaleStart({ from: owner });

            // vested tokens
            await token.assign(vestingTrustee.address, 1000, { from: assigner });
            let vestedToken = [
                // [EthAddress,NumTokens,CliffOffset(Days),EndOffset(Days),InstallmentLength(Days),Revokable]
                ["0xe04c4efcccd105abecb82467bcef6040dd6720ac", 100, 5 * constants.DAY, 5 * constants.DAY, 1 * constants.DAY, false],  // Employee whose tokens are not revokable (e.g. CEO)
                [revokableAddress, 100, 5 * constants.DAY, 5 * constants.DAY, 1 * constants.DAY, true],   // Employee whose tokens are revokable (e.g. a developer)
                [multisig.address, 100, 5 * constants.DAY, 5 * constants.DAY, 1 * constants.DAY, false],  // Company's token reserve
                ["0xf03836dd259784c6070ec505c3f242a393f397f8", 500, 5 * constants.DAY, 5 * constants.DAY, 1 * constants.DAY, false],  // Investor
                ["0xe37604b6b4d790ad8b3fbb3cd12d738d89764f69", 200, 5 * constants.DAY, 5 * constants.DAY, 1 * constants.DAY, true],   // Other third-parties (e.g. bounties, marketing)
            ];
            let now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            for (let i = 0; i < vestedToken.length; i++) {
                let address, numTokens, cliffOffset, endOffset, installmentLength, revokable;
                [address, numTokens, cliffOffset, endOffset, installmentLength, revokable] = vestedToken[i];
                // console.log(`${address},${numTokens},${cliffOffset},${endOffset},${installmentLength},${revokable}`);
                await vestingTrustee.grant(address, numTokens, now, now + cliffOffset, now + endOffset, installmentLength, revokable, { from: vester });
            }

            // unvested tokens
            await token.assign(multisig.address, 30, { from: assigner }); // client's general-purpose token pool (e.g. liquidity, airdrops, etc.)
            await token.mint(participants[0], 10, { from: assigner });
            await token.mint(participants[1], 11, { from: assigner });

            await token.tokenSaleEnd({ from: owner });

            assert.equal(1000, (await token.balanceOf(vestingTrustee.address)).toNumber());
            assert.equal(30, (await token.balanceOf(multisig.address)).toNumber());
            assert.equal(10, (await token.balanceOf(participants[0])).toNumber());
            assert.equal(11, (await token.balanceOf(participants[1])).toNumber());
        });

        it('revoking vested tokens and assign them to client', async function () {
            assert.equal(30, (await token.balanceOf(multisig.address)).toNumber());
            await vestingTrustee.revoke(revokableAddress, { from: vester }); // e.g. the developer is fired
            assert.equal(100, (await token.balanceOf(vester)).toNumber());
            await token.transfer(multisig.address, 100, { from: vester });
            assert.equal(130, (await token.balanceOf(multisig.address)).toNumber());
        });

        it('send vested tokens out of client\'s multisig wallet', async function () {
            await time.increaseTime(15 * constants.DAY);
            await vestingTrustee.unlockVestedTokens(multisig.address, { from: someoneElse });

            assert.equal(230, (await token.balanceOf(multisig.address)).toNumber());

            const transferEncoded = token.contract.transfer.getData(clientWallets[0], 10);
            await multisig.submitTransaction(token.address, 0, transferEncoded, { from: clientWallets[0] });
            await multisig.confirmTransaction(0, { from: clientWallets[1] });

            assert.equal(220, (await token.balanceOf(multisig.address)).toNumber());
            assert.equal(10, (await token.balanceOf(clientWallets[0])).toNumber());
        });

        it('basic token trading', async function () {
            await token.transfer(participants[1], 1, { from: participants[0] });
            await token.approve(someoneElse, 2, { from: participants[1] }); // someoneElse could be e.g. an exchange
            await token.transferFrom(participants[1], participants[0], 2, { from: someoneElse });

            assert.equal(11, (await token.balanceOf(participants[0])).toNumber());
            assert.equal(10, (await token.balanceOf(participants[1])).toNumber());
        });
    });
});
