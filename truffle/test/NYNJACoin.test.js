/// @title  NYNJACoin.test.js
/// @author Jose Perez - <jose.perez@diginex.com>
/// @notice NYNJACoin smart contract unit test

'use strict';

const BigNumber = web3.BigNumber;
require('chai')
    .use(require('chai-bignumber')(BigNumber))
    .use(require('chai-as-promised'))
    .should();
import assertRevert from './helpers/assertRevert';
import expectEvent from './helpers/expectEvent';
const NYNJACoin = artifacts.require('../contracts/NYNJACoin.sol');

contract('NYNJACoin tests', function (accounts) {
    const NYNJA_TOKENS_SUPPLY = 5000000000; // 5 billion tokens

    const owner = accounts[1];
    const assigner = accounts[2];
    const locker = accounts[3];
    const someoneElse = accounts[4];
    const participants = accounts.slice(5, 15);  // participants in the first token sale
    const participants2 = accounts.slice(15, 25); // participants in the second token sale
    const tokenDecimals = 18;
    const tokenUnit = new BigNumber(10).pow(tokenDecimals);
    const maxTokenMinUnitSupply = tokenUnit.times(NYNJA_TOKENS_SUPPLY);

    let token;

    async function checkTokenSaleStart(tokenSaleEndStart, tokenSaleId) {
        const eventLog = await expectEvent.inLogs(tokenSaleEndStart.logs, 'TokenSaleStarting');
        eventLog.args.tokenSaleId.should.be.bignumber.equal(tokenSaleId);
        const currentTokenSaleId = await token.currentTokenSaleId.call();
        currentTokenSaleId.should.be.bignumber.equal(tokenSaleId);
    }

    async function checkTokenSaleEnd(tokenSaleEnd, tokenSaleId) {
        const eventLog = await expectEvent.inLogs(tokenSaleEnd.logs, 'TokenSaleEnding');
        eventLog.args.tokenSaleId.should.be.bignumber.equal(tokenSaleId);
        const currentTokenSaleId = await token.currentTokenSaleId.call();
        currentTokenSaleId.should.be.bignumber.equal(tokenSaleId);
    }

    async function checkTransferAssigner(transferAssigner, assigner, newAssigner) {
        const eventLog = await expectEvent.inLogs(transferAssigner.logs, 'AssignerTransferred');
        assert.equal(eventLog.args.previousAssigner.valueOf(), assigner);
        assert.equal(eventLog.args.newAssigner.valueOf(), newAssigner);
        const currentAssigner = await token.assigner.call();
        assert.equal(currentAssigner, newAssigner);
    }

    async function checkTransferLocker(transferLocker, locker, newLocker) {
        const eventLog = await expectEvent.inLogs(transferLocker.logs, 'LockerTransferred');
        assert.equal(eventLog.args.previousLocker.valueOf(), locker);
        assert.equal(eventLog.args.newLocker.valueOf(), newLocker);
        const currentLocker = await token.locker.call();
        assert.equal(currentLocker, newLocker);
    }

    async function checkTransferOwnership(transferOwnership, owner, newOwner) {
        const eventLog = await expectEvent.inLogs(transferOwnership.logs, 'OwnershipTransferred');
        assert.equal(eventLog.args.previousOwner.valueOf(), owner);
        assert.equal(eventLog.args.newOwner.valueOf(), newOwner);
        const currentOwner = await token.owner.call();
        assert.equal(currentOwner, newOwner);
    }

    async function checkMint(mint, address, mintedTokens, expectedBalance) {
        const eventLog1 = await expectEvent.inLogs(mint.logs, 'Mint');
        assert.equal(eventLog1.args.to.valueOf(), address);
        mintedTokens.should.be.bignumber.equal(eventLog1.args.amount.valueOf());
        const eventLog2 = await expectEvent.inLogs(mint.logs, 'Transfer');
        assert.equal(eventLog2.args.from.valueOf(), 0x0);
        assert.equal(eventLog2.args.to.valueOf(), address);
        mintedTokens.should.be.bignumber.equal(eventLog2.args.value.valueOf());

        await checkBalance(address, expectedBalance);

        let currentTokenSaleId = await token.getCurrentTokenSaleId({ from: someoneElse });
        let addressTokenSaleId = await token.getAddressTokenSaleId(address, { from: someoneElse });
        currentTokenSaleId.should.be.bignumber.equal(addressTokenSaleId);
    }

    async function checkAssign(assign, address, expectedBalance) {
        const eventLog1 = await expectEvent.inLogs(assign.logs, 'Assign');
        assert.equal(eventLog1.args.to.valueOf(), address);
        expectedBalance.should.be.bignumber.equal(eventLog1.args.amount.valueOf());
        const eventLog2 = await expectEvent.inLogs(assign.logs, 'Transfer');
        assert.equal(eventLog2.args.from.valueOf(), 0x0);
        assert.equal(eventLog2.args.to.valueOf(), address);
        expectedBalance.should.be.bignumber.equal(eventLog2.args.value.valueOf());

        await checkBalance(address, expectedBalance);

        let currentTokenSaleId = await token.getCurrentTokenSaleId({ from: someoneElse });
        let addressTokenSaleId = await token.getAddressTokenSaleId(address, { from: someoneElse });
        currentTokenSaleId.should.be.bignumber.equal(addressTokenSaleId);
    }

    async function assertedMint(address, amount) {
        const expectedTotalSupply = (await token.totalSupply({ from: someoneElse })).plus(amount);
        const expectedBalanceOf = (await token.balanceOf(address, { from: someoneElse })).plus(amount);
        const mint = await token.mint(address, amount, { from: assigner });
        await checkMint(mint, address, amount, expectedBalanceOf);
        expectedTotalSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
    }

    async function assertedAssign(address, amount) {
        const balanceDiff = new BigNumber(amount).minus(await token.balanceOf(address, { from: someoneElse }));
        const expectedTotalSupply = (await token.totalSupply({ from: someoneElse })).plus(balanceDiff);
        const assign = await token.assign(address, amount, { from: assigner });
        await checkAssign(assign, address, amount);
        expectedTotalSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
    }

    async function checkTransfer(transfer, to, amount, from) {
        const eventLog = await expectEvent.inLogs(transfer.logs, 'Transfer');
        assert.equal(eventLog.args.from.valueOf(), from);
        assert.equal(eventLog.args.to.valueOf(), to);
        amount.should.be.bignumber.equal(eventLog.args.value.valueOf());
    }

    async function assertedTransfer(to, amount, from) {
        const expectedBalanceTo = (await token.balanceOf(to, { from: someoneElse })).plus(amount);
        const expectedBalanceFrom = (await token.balanceOf(from, { from: someoneElse })).minus(amount);
        const expectedTotalSupply = await token.totalSupply({ from: someoneElse });

        const transfer = await token.transfer(to, amount, { from: from });
        await checkTransfer(transfer, to, 1, from);

        expectedBalanceTo.should.be.bignumber.equal(await token.balanceOf(to, { from: someoneElse }));
        expectedBalanceFrom.should.be.bignumber.equal(await token.balanceOf(from, { from: someoneElse }));
        expectedTotalSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
    }

    async function assertedTransferFrom(to, amount, from, approved) {
        const expectedBalanceTo = (await token.balanceOf(to, { from: someoneElse })).plus(amount);
        const expectedBalanceFrom = (await token.balanceOf(from, { from: someoneElse })).minus(amount);
        const expectedBalanceApproved = await token.balanceOf(approved, { from: someoneElse });
        const expectedTotalSupply = await token.totalSupply({ from: someoneElse });

        const approve = await token.approve(approved, amount, { from: from });
        // TODO: check approve
        const transfer = await token.transferFrom(from, to, amount, { from: approved });
        await checkTransfer(transfer, to, amount, from);

        expectedBalanceTo.should.be.bignumber.equal(await token.balanceOf(to, { from: someoneElse }));
        expectedBalanceFrom.should.be.bignumber.equal(await token.balanceOf(from, { from: someoneElse }));
        expectedBalanceApproved.should.be.bignumber.equal(await token.balanceOf(approved, { from: someoneElse }));
        expectedTotalSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
    }

    async function checkBalance(address, expectedBalance) {
        expectedBalance.should.be.bignumber.equal(await token.balanceOf(address, { from: someoneElse }));
    }

    async function checkTotalSupply(expectedTotalNumTokens) {
        expectedTotalNumTokens.should.be.bignumber.equal(await token.totalSupply());
    }

    async function checkAddressIsLocked(token, address) {
        assert.equal(await token.isLocked(address), true);
    }

    async function checkAddressIsUnlocked(token, address) {
        assert.equal(await token.isLocked(address), false);
    }

    async function checkLockAddress(lock, token, address) {
        const eventLog = await expectEvent.inLogs(lock.logs, 'Lock');
        assert.equal(eventLog.args.addr.valueOf(), address);
        await checkAddressIsLocked(token, address);
    }

    async function checkUnlockAddress(unlock, token, address) {
        const eventLog = await expectEvent.inLogs(unlock.logs, 'Unlock');
        assert.equal(eventLog.args.addr.valueOf(), address);
        await checkAddressIsUnlocked(token, address);
    }

    describe('constructor', function () {
        before(async function () {
            token = await NYNJACoin.new(assigner, locker, { from: owner });
        });

        describe('control accounts', async function () {
            it('check the owner', async function () {
                assert.equal(await token.owner.call({ from: someoneElse }), owner);
            });

            it('check the assigner', async function () {
                assert.equal(await token.assigner.call({ from: someoneElse }), assigner);
            });

            it('check the locker', async function () {
                assert.equal(await token.locker.call({ from: someoneElse }), locker);
            });
        });

        describe('token supply', async function () {
            it('initial supply should be 0', async function () {
                '0'.should.be.bignumber.equal(await token.totalSupply.call({ from: someoneElse }));
            });

            it('value of max token supply constant in smart contract', async function () {
                maxTokenMinUnitSupply.should.be.bignumber.equal(await token.MAX_TOKEN_SUPPLY.call({ from: someoneElse }));
            });
        });

        describe('token sale id ', async function () {
            it('check inital token sale id', async function () {
                '0'.should.be.bignumber.equal(await token.currentTokenSaleId.call({ from: someoneElse }));
            });

            it('check no token sale is ongoing', async function () {
                assert.equal(await token.tokenSaleOngoing.call({ from: someoneElse }), false);
            });
        });
    });

    describe('control accounts', function () {
        before(async function () {
            token = await NYNJACoin.new(assigner, locker, { from: owner });
        });

        describe('assigner', async function () {
            let newAssigner = participants[1];

            it('assigner cannot be changed by an account different than owner', async function () {
                await assertRevert(token.transferAssigner(newAssigner, { from: assigner }));
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
                await assertRevert(token.transferLocker(newLocker, { from: locker }));
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
        console.log(`participants = ${JSON.stringify(participants)}`);
        describe('token sale start', function () {
            it('accounts different from owner cannot start a token sale', async function () {
                await assertRevert(token.tokenSaleStart({ from: someoneElse }));
            });

            it('cannot assign/mint if a token sale has not started yet', async function () {
                await assertRevert(token.assign(participants[0], 1, { from: assigner }));
                await assertRevert(token.mint(participants[1], 1, { from: assigner }));
                '0'.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
            });

            it('token sale start', async function () {
                await checkTokenSaleStart(await token.tokenSaleStart({ from: owner }), 1);
            });

            it('check current token sale id', async function () {
                '1'.should.be.bignumber.equal(await token.getCurrentTokenSaleId({ from: someoneElse }));
            });

            it('cannot start a new token sale if the current one has not finished yet', async function () {
                await assertRevert(token.tokenSaleStart({ from: owner }));
            });
        });

        describe('during token sale', function () {
            describe('minting/assigning', function () {
                it('accounts different from assigner cannot assign or mint tokens', async function () {
                    await assertRevert(token.assign(participants[0], 1, { from: owner }));
                    await assertRevert(token.mint(participants[1], 1, { from: someoneElse }));
                    '0'.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                });

                it('minting some tokens', async function () {
                    let expectedTotalSupply = new BigNumber(0);
                    for (let i = 0; i < participants.length; i++) {
                        const address = participants[i];
                        const amount = tokenUnit.times(100).times(i);
                        expectedTotalSupply = expectedTotalSupply.plus(amount);
                        await assertedMint(address, amount);
                    }
                    expectedTotalSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                });

                it('assigning some tokens', async function () {
                    let expectedTotalSupply = new BigNumber(0);
                    for (let i = 0; i < participants.length; i++) {
                        const address = participants[i];
                        const amount = tokenUnit.times(200).times(i);
                        expectedTotalSupply = expectedTotalSupply.plus(amount);
                        await assertedAssign(address, amount);
                    }
                    expectedTotalSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                });

                describe('minting/assigning in batches', function () {
                    const amounts = []
                    let sumAmounts = new BigNumber(0);
                    let totalSupplyBefore;

                    before(async function () {
                        for (let i = 0; i < participants.length; i++) {
                            const amount = tokenUnit.times(100).times(i);
                            amounts.push(amount);
                            sumAmounts = sumAmounts.plus(amount);
                        }
                        totalSupplyBefore = new BigNumber(await token.totalSupply({ from: someoneElse }));
                    });

                    it('cannot mint/assign a batch of length 0', async function () {
                        await assertRevert(token.mintInBatches([], [], { from: assigner }));
                        await assertRevert(token.assignInBatches([], [], { from: assigner }));
                        totalSupplyBefore.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                    });

                    it('cannot mint/assign a batch if number of addresses is not equal to number of amounts', async function () {
                        let addresses2 = participants.slice(0, 2);
                        let amounts2 = [1, 2, 3];
                        await assertRevert(token.mintInBatches(addresses2, amounts2, { from: assigner }));
                        await assertRevert(token.assignInBatches(addresses2, amounts2, { from: assigner }));
                        totalSupplyBefore.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                    });

                    it('only assigner can mint/assign in batches', async function () {
                        await assertRevert(token.mintInBatches(participants, amounts, { from: someoneElse }));
                        await assertRevert(token.assignInBatches(participants, amounts, { from: owner }));
                        totalSupplyBefore.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                    });

                    it('mint some tokens in batches', async function () {
                        await token.mintInBatches(participants, amounts, { from: assigner });
                        totalSupplyBefore.plus(sumAmounts).should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                    });

                    it('assign some tokens in batches', async function () {
                        await token.assignInBatches(participants, amounts, { from: assigner });
                        sumAmounts.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                    });
                });
            });

            describe('locking', function () {

                it('accounts different from locker cannot lock tokens', async function () {
                    await assertRevert(token.lockAddress(participants[0], { from: owner }));
                    await checkAddressIsUnlocked(token, participants[0]);
                });

                it('locking a single address', async function () {
                    // NOTE: locking is allowed for participants[0] eventhough its balance is 0 tokens
                    await checkLockAddress(await token.lockAddress(participants[0], { from: locker }), token, participants[0]);
                    await checkLockAddress(await token.lockAddress(participants[1], { from: locker }), token, participants[1]);
                    await checkLockAddress(await token.lockAddress(participants[2], { from: locker }), token, participants[2]);
                });

                it('cannot lock an address that has already been locked', async function () {
                    await assertRevert(token.lockAddress(participants[0], { from: locker }));
                    await checkAddressIsLocked(token, participants[0]);
                });

                it('cannot lock an address that has not participated in a token sale', async function () {
                    await assertRevert(token.lockAddress(someoneElse, { from: locker }));
                    await checkAddressIsUnlocked(token, someoneElse);
                });

                it('cannot unlock an address that has not yet been locked', async function () {
                    await assertRevert(token.unlockAddress(participants[3], { from: locker }));
                    await checkAddressIsUnlocked(token, participants[3]);
                });

                it('accounts different from locker cannot unlock tokens', async function () {
                    await assertRevert(token.lockAddress(participants[0], { from: owner }));
                    await checkAddressIsLocked(token, participants[0]);
                });

                it('unlocking a single address', async function () {
                    await checkUnlockAddress(await token.unlockAddress(participants[0], { from: locker }), token, participants[0]);
                });

                it('can lock/unlock tokens back during token sale', async function () {
                    await checkLockAddress(await token.lockAddress(participants[0], { from: locker }), token, participants[0], true);
                    await checkUnlockAddress(await token.unlockAddress(participants[0], { from: locker }), token, participants[0]);
                });

                describe('locking/unlocking in batches', function () {
                    let token2;

                    it('lock/unlock a batch', async function () {
                        token2 = await NYNJACoin.new(assigner, locker, { from: owner });
                        await token2.tokenSaleStart({ from: owner });
                        for (let i = 0; i < participants.length; i++) {
                            await token2.mint(participants[i], 1, { from: assigner });
                        }

                        await token2.lockInBatches(participants, { from: locker });
                        for (let i = 0; i < participants.length; i++) {
                            await checkAddressIsLocked(token2, participants[i]);
                        }
                        await token2.unlockInBatches(participants, { from: locker });
                        for (let i = 0; i < participants.length; i++) {
                            await checkAddressIsUnlocked(token2, participants[i]);
                        }
                    });

                    describe('cannot lock', function () {
                        before(async function () {
                            token2 = await NYNJACoin.new(assigner, locker, { from: owner });
                            await token2.tokenSaleStart({ from: owner });
                            for (let i = 0; i < participants.length; i++) {
                                await token2.mint(participants[i], 1, { from: assigner });
                            }
                        });

                        it('only locker can lock in batches', async function () {
                            await assertRevert(token2.lockInBatches(participants, { from: owner }));
                        });

                        it('cannot lock a batch of length 0', async function () {
                            await assertRevert(token2.lockInBatches([], { from: locker }));
                        });

                        after(async function () {
                            for (let i = 0; i < participants.length; i++) {
                                await checkAddressIsUnlocked(token2, participants[i]);
                            }
                        });
                    });

                    describe('cannot unlock', function () {
                        before(async function () {
                            token2 = await NYNJACoin.new(assigner, locker, { from: owner });
                            await token2.tokenSaleStart({ from: owner });
                            for (let i = 0; i < participants.length; i++) {
                                await token2.mint(participants[i], 1, { from: assigner });
                            }
                            await token2.lockInBatches(participants, { from: locker });
                        });

                        it('only locker can unlock in batches', async function () {
                            await assertRevert(token2.unlockInBatches(participants, { from: owner }));
                        });

                        it('cannot lock a batch of length 0', async function () {
                            await assertRevert(token2.unlockInBatches([], { from: locker }));
                        });

                        after(async function () {
                            for (let i = 0; i < participants.length; i++) {
                                await checkAddressIsLocked(token2, participants[i]);
                            }
                        });
                    });
                });
            });

            describe('transferring', function () {
                it('sending tokens is not allowed for participants of the ongoing token sale', async function () {
                    const unlockedTokensHolder = participants[0];
                    await checkAddressIsUnlocked(token, unlockedTokensHolder);
                    await token.assign(unlockedTokensHolder, 2, { from: assigner });

                    await assertRevert(token.transfer(someoneElse, 1, { from: unlockedTokensHolder }));

                    await token.approve(someoneElse, 1, { from: unlockedTokensHolder });
                    await assertRevert(token.transferFrom(unlockedTokensHolder, someoneElse, 1, { from: someoneElse }));

                    '0'.should.be.bignumber.equal(await token.balanceOf(someoneElse, { from: someoneElse }));
                });
            });
        });

        describe('token sale ending', function () {
            it('accounts different from owner cannot end a token sale', async function () {
                await assertRevert(token.tokenSaleEnd({ from: someoneElse }));
            });

            it('token sale end', async function () {
                await checkTokenSaleEnd(await token.tokenSaleEnd({ from: owner }), 1);
            });

            it('cannot end a token sale which already ended', async function () {
                await assertRevert(token.tokenSaleEnd({ from: owner }));
            });
        });

        describe('after token sale and before the next token sale', function () {
            describe('minting/assigning', function () {
                it('cannot mint/assign tokens if a token sale is not ongoing', async function () {
                    await assertRevert(token.assign(participants[0], 1, { from: assigner }));
                    await assertRevert(token.mint(participants[0], 1, { from: assigner }));
                });
            });

            describe('locking', function () {
                before(async function () {
                    // checking participant account states
                    await checkAddressIsLocked(token, participants[1]);
                    await checkAddressIsUnlocked(token, participants[0]);
                    await checkAddressIsLocked(token, participants[2]);
                    '1'.should.be.bignumber.lessThan(await token.balanceOf(participants[1], { from: someoneElse }));
                });

                it('locked address tokens cannot be transferred', async function () {
                    const lockedTokensHolder = participants[1];

                    await assertRevert(token.transfer(someoneElse, 1, { from: lockedTokensHolder }));

                    await token.approve(someoneElse, 1, { from: lockedTokensHolder });
                    await assertRevert(token.transferFrom(lockedTokensHolder, someoneElse, 1, { from: someoneElse }));

                    '0'.should.be.bignumber.equal(await token.balanceOf(someoneElse, { from: someoneElse }));
                });

                it('unlock address', async function () {
                    let unlockAddress = await token.unlockAddress(participants[1], { from: locker });
                    await checkUnlockAddress(unlockAddress, token, participants[1]);
                });

                it('cannot lock tokens if a token sale is not ongoing', async function () {
                    await assertRevert(token.lockAddress(participants[4], { from: locker }));
                });
            });

            describe('transferring', function () {
                // current account statuses:
                // participants[0] is unlocked
                // participants[1] is unlocked
                // participants[2] is locked
                // participants[3] is unlocked

                it('`transferFrom` with an account which did not participate in the token sale', async function () {
                    assert.equal(0, await token.getAddressTokenSaleId(someoneElse, { from: someoneElse }));
                    await assertedTransferFrom(participants[0], 1, participants[1], someoneElse);
                });

                it('transferring from unlocked account', async function () {
                    await assertedTransferFrom(participants[0], 1, participants[3], participants[1]);
                    await assertedTransfer(participants[0], 1, participants[1]);
                });

                it('locked addresses can receive tokens', async function () {
                    await checkAddressIsLocked(token, participants[2]);
                    await assertedTransferFrom(participants[2], 1, participants[3], participants[1]);
                    await assertedTransfer(participants[2], 1, participants[1]);
                });
            });
        });

        describe('2nd token sale start', function () {
            it('start token sale', async function () {
                await checkTokenSaleStart(await token.tokenSaleStart({ from: owner }), 2);
            });
        });

        describe('during 2nd token sale', function () {
            describe('minting/assigning', function () {
                it('minting/assigning of new addresses', async function () {
                    await assertedMint(participants2[0], 100);
                    await assertedMint(participants2[1], 101);
                });
                describe('participant addresses in a previous token sale cannot be minted/assigned tokens in the current sale', async function () {
                    it('minting', async function () {
                        await assertRevert(token.mint(participants[4], 1, { from: assigner }));
                    });

                    it('assigning', async function () {
                        await assertRevert(token.assign(participants[5], 1, { from: assigner }));
                    });
                });
            });

            describe('locking', function () {
                it('locking of new addresses', async function () {
                    await checkLockAddress(await token.lockAddress(participants2[0], { from: locker }), token, participants2[0]);
                });
                it('should not be able to lock tokens belonging to an address which participated in a previous token sale but not in the current token sake', async function () {
                    await assertRevert(token.lockAddress(participants[4], { from: locker }));
                });
                it('unlocking some tokens of a previously ended token sale', async function () {
                    let unlockAddress = await token.unlockAddress(participants[2], { from: locker });
                    await checkUnlockAddress(unlockAddress, token, participants[2]);

                    await assertedTransfer(participants[0], 1, participants[2]);

                    // current account statuses:
                    // participants[0] is unlocked
                    // participants[1] is unlocked
                    // participants[2] is unlocked
                    // participants[3] is unlocked
                });
            });

            describe('transferring', function () {
                it('should not be able to send tokens from current token sale unlocked addresses', async function () {
                    await assertRevert(token.transfer(someoneElse, 1, { from: participants2[1] }));
                    await token.approve(someoneElse, 1, { from: participants2[1] });
                    await assertRevert(token.transferFrom(participants2[1], someoneElse, 1, { from: someoneElse }));
                });

                it('should be able to send tokens from previous token sale unlocked addresses', async function () {
                    await assertedTransfer(participants[4], 1, participants[3]);
                    await assertedTransferFrom(participants[0], 1, participants[1], participants[2]);
                });
            });
        });
    });

    describe('max token supply limit', function () {
        before(async function () {
            token = await NYNJACoin.new(assigner, locker, { from: owner });
            await token.tokenSaleStart({ from: owner });
        });

        it('token supply can be equal to max token supply constant', async function () {
            token.assign(participants[0], maxTokenMinUnitSupply, { from: assigner });
            maxTokenMinUnitSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
        });

        it('token supply cannot be greater than max token supply constant', async function () {
            await assertRevert(token.assign(participants[0], maxTokenMinUnitSupply.plus(1), { from: assigner }));
            await assertRevert(token.mint(participants[0], 1, { from: assigner }));
            maxTokenMinUnitSupply.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
        });

        describe('minting/assigning in batches gets fully reverted if token supply > max token supply constant during the batch transaction', function () {
            const maxTokensMinus1 = maxTokenMinUnitSupply.minus(1);
            const ethAddresses = [participants[1], participants[2]];
            const numTokens = [1, 1];

            before(async function () {
                await token.assign(participants[0], maxTokensMinus1, { from: assigner });
                maxTokensMinus1.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
            });

            it('minting', async function () {
                await assertRevert(token.mintInBatches(ethAddresses, numTokens, { from: assigner }));

                maxTokensMinus1.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                maxTokensMinus1.should.be.bignumber.equal(await token.balanceOf(participants[0], { from: someoneElse }));
                '0'.should.be.bignumber.equal(await token.balanceOf(participants[1], { from: someoneElse }));
                '0'.should.be.bignumber.equal(await token.balanceOf(participants[2], { from: someoneElse }));
            });

            it('assigning', async function () {
                await assertRevert(token.assignInBatches(ethAddresses, numTokens, { from: assigner }));

                maxTokensMinus1.should.be.bignumber.equal(await token.totalSupply({ from: someoneElse }));
                maxTokensMinus1.should.be.bignumber.equal(await token.balanceOf(participants[0], { from: someoneElse }));
                '0'.should.be.bignumber.equal(await token.balanceOf(participants[1], { from: someoneElse }));
                '0'.should.be.bignumber.equal(await token.balanceOf(participants[2], { from: someoneElse }));
            });
        });
    });
});