// @title   NYNJACoin.test.js
// @author  Jose Perez - <jose.perez@diginex.com>

"use strict";

const BigNumber = require('bignumber.js');
const NYNJACoin = artifacts.require('../contracts/NYNJACoin.sol');
const assertRevert = require('./helpers/assertRevert');

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();


contract('NYNJACoin tests', function (accounts) {

    const NUM_PARTICIPANTS = 5

    const owner = accounts[9];
    const assigner = accounts[8];
    const locker = accounts[7];
    const someoneElse = accounts[6];
    const participants = accounts.slice(0, NUM_PARTICIPANTS + 1);
    const tokenDecimals = 18;
    const tokenUnit = new BigNumber(10).pow(tokenDecimals);
    const maxTokenSupply = tokenUnit.times(5000000000); // 5 billion tokens

    let token;

    before(function () {
        for (let i = 0; i < accounts.length; i++) {
            console.log(`${i}: ${accounts[i]}`);
        }
    });

    async function checkTokenSaleStart(tokenSaleStart, tokenSaleId) {
        assert.equal(tokenSaleStart.logs[0].event, 'TokenSaleStarting');
        assert.equal(tokenSaleStart.logs[0].args.tokenSaleId.valueOf(), tokenSaleId);
        const currentTokenSaleId = await token.currentTokenSaleId.call();
        assert.equal(currentTokenSaleId, tokenSaleId);
    }

    async function checkTokenSaleEnd(tokenSaleEnd, tokenSaleId) {
        assert.equal(tokenSaleEnd.logs[0].event, 'TokenSaleEnding');
        assert.equal(tokenSaleEnd.logs[0].args.tokenSaleId.valueOf(), tokenSaleId);
        const currentTokenSaleId = await token.currentTokenSaleId.call();
        assert.equal(currentTokenSaleId, tokenSaleId);
    }

    async function checkTransferAssigner(transferAssigner, assigner, newAssigner) {
        assert.equal(transferAssigner.logs[0].event, 'AssignerTransferred');
        assert.equal(transferAssigner.logs[0].args.previousAssigner.valueOf(), assigner);
        assert.equal(transferAssigner.logs[0].args.newAssigner.valueOf(), newAssigner);
        const currentAssigner = await token.assigner.call();
        assert.equal(currentAssigner, newAssigner);
    }

    async function checkTransferLocker(transferLocker, locker, newLocker) {
        assert.equal(transferLocker.logs[0].event, 'LockerTransferred');
        assert.equal(transferLocker.logs[0].args.previousLocker.valueOf(), locker);
        assert.equal(transferLocker.logs[0].args.newLocker.valueOf(), newLocker);
        const currentLocker = await token.locker.call();
        assert.equal(currentLocker, newLocker);
    }

    async function checkTransferOwnership(transferOwnership, owner, newOwner) {
        assert.equal(transferOwnership.logs[0].event, 'OwnershipTransferred');
        assert.equal(transferOwnership.logs[0].args.previousOwner.valueOf(), owner);
        assert.equal(transferOwnership.logs[0].args.newOwner.valueOf(), newOwner);
        const currentOwner = await token.owner.call();
        assert.equal(currentOwner, newOwner);
    }

    async function checkMint(mint, address, mintedTokens, expectedBalance) {
        assert.equal(mint.logs[0].event, 'Mint');
        assert.equal(mint.logs[0].args.to.valueOf(), address);
        assert.equal(mint.logs[0].args.amount.valueOf(), mintedTokens);
        assert.equal(mint.logs[1].event, 'Transfer');
        assert.equal(mint.logs[1].args.from.valueOf(), 0x0);
        await checkBalance(address, expectedBalance);
        let currentTokenSaleId = (await token.getCurrentTokenSaleId({ from: someoneElse })).toNumber();;
        let addressTokenSaleId = (await token.getAddressTokenSaleId(address, { from: someoneElse })).toNumber();
        assert.equal(addressTokenSaleId, currentTokenSaleId, 'Address token sale ID should be equal to the current token sale ID');
    }

    async function checkAssign(assign, address, numTokens) {
        assert.equal(assign.logs[0].event, 'Assign');
        assert.equal(assign.logs[0].args.to.valueOf(), address);
        assert.equal(assign.logs[0].args.amount.valueOf(), numTokens);
        assert.equal(assign.logs[1].event, 'Transfer');
        assert.equal(assign.logs[1].args.from.valueOf(), 0x0);
        await checkBalance(address, numTokens);
        let currentTokenSaleId = (await token.getCurrentTokenSaleId({ from: someoneElse })).toNumber();;
        let addressTokenSaleId = (await token.getAddressTokenSaleId(address, { from: someoneElse })).toNumber();
    }

    function checkTransfer(transfer, _to, _amount, _from) {
        assert.equal(transfer.logs[0].event, 'Transfer');
        assert.equal(transfer.logs[0].args.from.valueOf(), _from);
        assert.equal(transfer.logs[0].args.to.valueOf(), _to);
        assert.equal(transfer.logs[0].args.value.valueOf(), _amount);
    }

    async function checkBalance(address, numTokens) {
        const balance = await token.balanceOf(address);
        assert.equal(new BigNumber(balance).toFixed(), new BigNumber(numTokens).toFixed());
    }

    async function checkTotalSupply(totalNumTokens) {
        const totalNumTokens2 = await token.totalSupply();
        assert.equal(totalNumTokens2, totalNumTokens);
    }

    async function checkAddressIsLocked(token, address) {
        const isLocked = await token.isLocked(address);
        assert.equal(isLocked, true);
    }

    async function checkAddressIsUnlocked(token, address) {
        const isLocked = await token.isLocked(address);
        assert.equal(isLocked, false);
    }

    async function checkLockAddress(lock, token, address) {
        assert.equal(lock.logs[0].event, 'Lock');
        assert.equal(lock.logs[0].args.addr.valueOf(), address);
        await checkAddressIsLocked(token, address);
    }

    async function checkUnlockAddress(unlock, token, address) {
        assert.equal(unlock.logs[0].event, 'Unlock');
        assert.equal(unlock.logs[0].args.addr.valueOf(), address);
        await checkAddressIsUnlocked(token, address);
    }

    describe('control accounts', function () {

        before(async function () {
            token = await NYNJACoin.new(assigner, locker, { from: owner });
        });

        describe('assigner', async function () {

            let newAssigner = participants[1];

            it('assigner cannot be changed by an account different than owner', async function () {
                await assertRevert(token.transferAssigner(newAssigner, { from: someoneElse }));
            });

            it('new assigner cannot be 0x0', async function () {
                await assertRevert(token.transferAssigner(0x0, { from: owner }));
            });

            it('owner can change assigner', async function () {
                const transferAssigner = await token.transferAssigner(newAssigner, { from: owner });
                await checkTransferAssigner(transferAssigner, assigner, newAssigner);
            });
        });


        describe('locker', async function () {

            let newLocker = participants[2];

            it('locker cannot be changed by an account different than owner', async function () {
                await assertRevert(token.transferLocker(newLocker, { from: someoneElse }));
            });

            it('new locker cannot be 0x0', async function () {
                await assertRevert(token.transferLocker(0x0, { from: owner }));
            });

            it('owner can change locker', async function () {
                const transferLocker = await token.transferLocker(newLocker, { from: owner });
                await checkTransferLocker(transferLocker, locker, newLocker);
            });
        });


        describe('owner', async function () {

            let newOwner = participants[3];

            it('owner cannot be changed by an account different than owner', async function () {
                await assertRevert(token.transferOwnership(newOwner, { from: someoneElse }));
            });

            it('new owner cannot be 0x0', async function () {
                await assertRevert(token.transferOwnership(0x0, { from: owner }));
            });

            it('owner can change owner', async function () {
                const transferOwnership = await token.transferOwnership(newOwner, { from: owner });
                await checkTransferOwnership(transferOwnership, owner, newOwner);
            });
        });

    });

    describe('token sales general workflow', function () {

        before(async function () {
            token = await NYNJACoin.new(assigner, locker, { from: owner });
        });

        describe('token sale start', function () {

            it('check initial token sale ID equals 0', async function () {
                assert.equal(await token.getCurrentTokenSaleId({ from: someoneElse }), 0);
            });

            it('accounts different from owner cannot start a token sale', async function () {
                await assertRevert(token.tokenSaleStart({ from: someoneElse }));
            });

            it('token sale start', async function () {
                let tokenSaleStart = await token.tokenSaleStart({ from: owner });
                await checkTokenSaleStart(tokenSaleStart, 1);
            });

            it('check current token sale ID', async function () {
                assert.equal(await token.getCurrentTokenSaleId({ from: someoneElse }), 1);
            });

            it('cannot start a token sale which has not finished yet', async function () {
                await assertRevert(token.tokenSaleStart({ from: owner }));
            });
        });

        describe('during token sale', function () {

            // participants[0]: will be locked and unlocked during tokenSaleId = 1
            // participants[1]: will be locked during tokenSaleId = 1 and unlocked after tokenSaleId = 1 and before tokenSaleId = 2
            // participants[2]: will be locked during tokenSaleId = 1 and unlocked during tokenSaleId = 2
            // participants[4]: will be never be locked

            describe('minting/assigning', function () {

                it('accounts different from assigner cannot assign or mint tokens', async function () {
                    await assertRevert(token.assign(participants[0], 1, { from: owner }));
                    await assertRevert(token.mint(participants[1], 1, { from: someoneElse }));
                    assert.equal(0, (await token.totalSupply({ from: someoneElse })).toNumber());
                });

                it('minting some tokens', async function () {
                    let expectedTotalSupply = new BigNumber(0);
                    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
                        let address = participants[i];
                        let amount = tokenUnit.times(100).times(i);
                        expectedTotalSupply = expectedTotalSupply.add(amount);
                        let mint = await token.mint(address, amount, { from: assigner });
                        await checkMint(mint, address, amount, amount);
                    }
                    const totalSupply = await token.totalSupply({ from: someoneElse });
                    totalSupply.should.be.bignumber.equal(expectedTotalSupply);
                });

                it('assigning some tokens', async function () {
                    let expectedTotalSupply = new BigNumber(0);
                    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
                        let address = participants[i];
                        let amount = tokenUnit.times(200).times(i);
                        expectedTotalSupply = expectedTotalSupply.add(amount);
                        let assign = await token.assign(address, amount, { from: assigner });
                        await checkAssign(assign, address, amount);
                    }
                    const totalSupply = await token.totalSupply({ from: someoneElse });
                    totalSupply.should.be.bignumber.equal(expectedTotalSupply);
                });

                describe('minting/assigning in batches', function () {

                    const addresses = [];
                    const amounts = []
                    let sumAmounts = new BigNumber(0);
                    let totalSupplyBefore;

                    before(async function () {
                        const batchSize = 5;
                        for (let i = 0; i < batchSize; i++) {
                            let address = participants[i];
                            let amount = tokenUnit.times(100).times(i);
                            addresses.push(address);
                            amounts.push(amount);
                            sumAmounts = sumAmounts.add(amount);
                        }

                        totalSupplyBefore = new BigNumber(await token.totalSupply({ from: someoneElse }));
                    });

                    it('cannot mint/assign a batch of length 0', async function () {
                        await assertRevert(token.mintInBatches([], [], { from: assigner }));
                        await assertRevert(token.assignInBatches([], [], { from: assigner }));
                        const totalSupplyAfter = new BigNumber(await token.totalSupply({ from: someoneElse }));
                        totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
                    });

                    it('cannot mint/assign if number of addresses is not equal to number of amounts', async function () {
                        let addresses2 = participants.slice(0, 2);
                        let amounts2 = [1, 2, 3];
                        await assertRevert(token.mintInBatches(addresses2, amounts2, { from: assigner }));
                        await assertRevert(token.assignInBatches(addresses2, amounts2, { from: assigner }));
                        const totalSupplyAfter = new BigNumber(await token.totalSupply({ from: someoneElse }));
                        totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
                    });

                    it('only assigner can mint/assign in batches', async function () {
                        await assertRevert(token.mintInBatches(addresses, amounts, { from: someoneElse }));
                        await assertRevert(token.assignInBatches(addresses, amounts, { from: owner }));
                        const totalSupplyAfter = new BigNumber(await token.totalSupply({ from: someoneElse }));
                        totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore);
                    });

                    it('mint some tokens in batches', async function () {
                        await token.mintInBatches(addresses, amounts, { from: assigner });
                        const totalSupplyAfter = new BigNumber(await token.totalSupply({ from: someoneElse }));
                        totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(sumAmounts));
                    });

                    it('assign some tokens in batches', async function () {
                        await token.assignInBatches(addresses, amounts, { from: assigner });
                        const totalSupplyAfter = new BigNumber(await token.totalSupply({ from: someoneElse }));
                        totalSupplyAfter.should.be.bignumber.equal(sumAmounts);
                    });
                });
            });

            describe('locking', function () {

                it('locking some tokens', async function () {
                    let lockAddress = await token.lockAddress(participants[0], { from: locker });
                    await checkLockAddress(lockAddress, token, participants[0], true);

                    lockAddress = await token.lockAddress(participants[1], { from: locker });
                    await checkLockAddress(lockAddress, token, participants[1], true);

                    lockAddress = await token.lockAddress(participants[2], { from: locker });
                    await checkLockAddress(lockAddress, token, participants[2], true);
                });

                it('cannot lock tokens that have already been locked', async function () {
                    await assertRevert(token.lockAddress(participants[0], { from: locker }));
                    await checkAddressIsLocked(token, participants[0]);
                });

                it('cannot unlock tokens that have not yet been locked', async function () {
                    await assertRevert(token.unlockAddress(participants[3], { from: locker }));
                    await checkAddressIsUnlocked(token, participants[3]);
                });

                it('accounts different from locker cannot lock tokens', async function () {
                    await assertRevert(token.lockAddress(participants[3], { from: owner }));
                    await checkAddressIsUnlocked(token, participants[3]);
                });

                it('accounts different from locker cannot unlock tokens', async function () {
                    await assertRevert(token.lockAddress(participants[0], { from: owner }));
                    await checkAddressIsLocked(token, participants[0]);
                });

                it('unlocking some tokens during token sale', async function () {
                    let unlockAddress = await token.unlockAddress(participants[0], { from: locker });
                    await checkUnlockAddress(unlockAddress, token, participants[0]);
                });

                it('can lock/unlock tokens back during token sale', async function () {
                    let lockAddress = await token.lockAddress(participants[0], { from: locker });
                    await checkLockAddress(lockAddress, token, participants[0], true);
                    let unlockAddress = await token.unlockAddress(participants[0], { from: locker });
                    await checkUnlockAddress(unlockAddress, token, participants[0]);
                });

            });

            describe('locking/unlocking in batches', function () {

                let token2;
                let addresses = [];

                before(async function () {

                    token2 = await NYNJACoin.new(assigner, locker, { from: owner });
                    await token2.tokenSaleStart({ from: owner });

                    const batchSize = 5;
                    for (let i = 0; i < batchSize; i++) {
                        let address = participants[i];
                        addresses.push(address);
                        token2.assign(address, 1, { from: assigner });
                    }
                });

                it('cannot do that with a batch of length 0', async function () {
                    await assertRevert(token2.lockInBatches([], { from: locker }));
                    await assertRevert(token2.unlockInBatches([], { from: locker }));
                });

                it('do that in batches', async function () {
                    await token2.lockInBatches(addresses, { from: locker });
                    for (let i = 0; i < addresses.length; i++) {
                        await checkAddressIsLocked(token2, addresses[i]);
                    }

                    await token2.unlockInBatches(addresses, { from: locker });
                    for (let i = 0; i < addresses.length; i++) {
                        await checkAddressIsUnlocked(token2, addresses[i]);
                    }
                });
            });
        });

        describe('transferring', function () {

            it('sending/receiving tokens is not allowed for participants of an ongoing token sale', async function () {
                await assertRevert(token.transfer(someoneElse, 1, { from: participants[4] }));

                await token.approve(someoneElse, 1, { from: participants[4] });
                await assertRevert(token.transferFrom(participants[4], someoneElse, 1, { from: someoneElse }));
            });
        });

        describe('token sale end', function () {

            it('accounts different from owner cannot end a token sale', async function () {
                await assertRevert(token.tokenSaleEnd({ from: someoneElse }));
            });

            it('token sale end', async function () {
                let tokenSaleEnd = await token.tokenSaleEnd({ from: owner });
                await checkTokenSaleEnd(tokenSaleEnd, 1);
            });

            it('cannot end a token sale which already ended', async function () {
                await assertRevert(token.tokenSaleEnd({ from: owner }));
            });
        });

        describe('after token sale and before the next token sale', function () {

            describe('locking', function () {

                it('locked tokens cannot be transferred', async function () {
                    await assertRevert(token.transfer(someoneElse, 2, { from: participants[1] }));

                    await token.approve(someoneElse, 2, { from: participants[1] });
                    await assertRevert(token.transferFrom(participants[1], someoneElse, 2, { from: someoneElse }));
                });

                it('unlocking some tokens after token sale', async function () {
                    let unlockAddress = await token.unlockAddress(participants[1], { from: locker });
                    await checkUnlockAddress(unlockAddress, token, participants[1]);
                    let transfer = await token.transfer(participants[0], 1, { from: participants[1] });
                    checkTransfer(transfer, participants[0], 1, participants[1]);
                });

                it('cannot lock tokens if a token sale is not ongoing', async function () {
                    await assertRevert(token.lockAddress(participants[4], { from: locker }));
                });
            });

            describe('transferring', function () {
                it('transferring tokens is allowed if a token sale is not ongoing', async function () {
                    let transfer = await token.transfer(participants[4], 1, { from: participants[3] });
                    checkTransfer(transfer, participants[4], 1, participants[3]);
                });
            });
        });

        describe('next token sale', function () {

            // subsequent token sales              

            it('start a 2nd token sale', async function () {
                let tokenSaleStart2 = await token.tokenSaleStart({ from: owner });
                await checkTokenSaleStart(tokenSaleStart2, 2);
            });

            // locked tokens bought in a previous token sale

            it('cannot lock tokens of an address which participated in a previous token sale', async function () {
                await assertRevert(token.lockAddress(participants[4], { from: locker }));
            });

            it('unlocking some tokens of a previously ended token sale', async function () {
                let unlockAddress = await token.unlockAddress(participants[2], { from: locker });
                await checkUnlockAddress(unlockAddress, token, participants[2]);
                let transfer = await token.transfer(participants[0], 1, { from: participants[2] });
                checkTransfer(transfer, participants[0], 1, participants[2]);
            });

            // transferring tokens bought in a previous token sale

            it('tokens bought in a previously ended token sale can be transferred during another ongoing token sale', async function () {
                let transfer = await token.transfer(participants[4], 1, { from: participants[3] });
                checkTransfer(transfer, participants[4], 1, participants[3]);
            });
        });
    });

    describe('token supply limit', function () {

        const maxTokensTest = maxTokenSupply;

        beforeEach(async function () {
            token = await NYNJACoin.new(assigner, locker, { from: owner });
        });

        it('value of max token supply constant in smart contract', async function () {
            const maxTokensSmartContract = new BigNumber((await token.MAX_TOKEN_SUPPLY.call({ from: someoneElse })).toString());
            assert.equal(maxTokensSmartContract.equals(maxTokensTest), true,
                `MAX_TOKEN_SUPPLY = ${maxTokensSmartContract}, it should be = ${maxTokensTest}`);
        });

        it('initial supply should be 0', async function () {
            let totalSupply;
            totalSupply = new BigNumber((await token.totalSupply.call({ from: someoneElse })).toString());
            assert.equal(totalSupply.equals(new BigNumber(0)), true,
                `totalSupply = ${totalSupply}, it should be = 0`);
        });

        describe('max token supply', function () {
            let token2;

            before(async function () {
                token2 = await NYNJACoin.new(assigner, locker, { from: owner });
                await token2.tokenSaleStart({ from: owner });
            });

            it('token supply can be equal to max token supply constant', async function () {
                token2.assign(participants[0], maxTokensTest, { from: assigner });
                const totalSupply = await token2.totalSupply({ from: someoneElse });
                assert.equal(new BigNumber(totalSupply).toFixed(), maxTokensTest.toFixed());
            });

            it('token supply cannot be greater than max token supply constant', async function () {
                await assertRevert(token2.assign(participants[0], maxTokensTest.plus(1), { from: assigner }));
                await assertRevert(token2.mint(participants[0], 1, { from: assigner }));
                const totalSupply = await token2.totalSupply({ from: someoneElse });
                assert.equal(new BigNumber(totalSupply).toFixed(), maxTokensTest.toFixed());
            });

            it('assignment in batches gets fully reverted if token supply > max token supply constant at any time during the batch', async function () {
                const maxTokensMinus1 = maxTokensTest.minus(1);
                token2.assign(participants[0], maxTokensMinus1, { from: assigner });
                let totalSupply = await token2.totalSupply({ from: someoneElse });
                assert.equal(new BigNumber(totalSupply).toFixed(), maxTokensMinus1.toFixed());

                const ethAddresses = [participants[1], participants[2]];
                const numTokens = [1, 1];
                await assertRevert(token2.assignInBatches(ethAddresses, numTokens, { from: assigner }));

                totalSupply = new BigNumber(await token2.totalSupply({ from: someoneElse }));
                assert.equal(new BigNumber(totalSupply).toFixed(), maxTokensMinus1.toFixed());

                const balancePart0 = new BigNumber((await token2.balanceOf(participants[0], { from: someoneElse })));
                const balancePart1 = new BigNumber((await token2.balanceOf(participants[1], { from: someoneElse })));
                const balancePart2 = new BigNumber((await token2.balanceOf(participants[2], { from: someoneElse })));

                assert.equal(balancePart0.toFixed(), maxTokensMinus1.toFixed());
                assert.equal(balancePart1.toFixed(), "0");
                assert.equal(balancePart2.toFixed(), "0");
            });
        });
    });
});
