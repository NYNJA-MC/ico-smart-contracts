"use strict";

const assertRevert = require('./helpers/assertRevert');
const time = require('./helpers/time');
const constants = require('./helpers/constants');
const NYNJACoin = artifacts.require('../contracts/NYNJACoin.sol');
const VestingTrustee = artifacts.require('../contracts/VestingTrustee.sol');

/// @title  VestingTrustee.test.js
/// @author Jose Perez - <jose.perez@diginex.com>
/// @notice VestingTrustee smart contract unit test
contract('VestingTrustee', (accounts) => {

    let now;
    let token;
    let trustee;

    const owner = accounts[10];
    const vester = accounts[9];
    const assigner = accounts[8];
    const locker = accounts[7];
    const someoneElse = accounts[6];
    const holder = accounts[5];
    const someoneElse2 = accounts[4];
    const grantees = accounts.slice(0, 4);

    async function checkTransferOwnership(transferOwnership, owner, newOwner) {
        assert.equal(transferOwnership.logs[0].event, 'OwnershipTransferred');
        assert.equal(transferOwnership.logs[0].args.previousOwner.valueOf(), owner);
        assert.equal(transferOwnership.logs[0].args.newOwner.valueOf(), newOwner);
        const currentOwner = await trustee.owner.call();
        assert.equal(currentOwner, newOwner);
    }

    async function checkTransferVester(transferVester, vester, newVester) {
        assert.equal(transferVester.logs[0].event, 'VesterTransferred');
        assert.equal(transferVester.logs[0].args.previousVester.valueOf(), vester);
        assert.equal(transferVester.logs[0].args.newVester.valueOf(), newVester);
        const currentVester = await trustee.vester.call();
        assert.equal(currentVester, newVester);
    }

    async function checkGrant(grant, from, to, value) {
        assert.equal(grant.logs[0].event, 'NewGrant');
        assert.equal(grant.logs[0].args._from.valueOf(), from);
        assert.equal(grant.logs[0].args._to.valueOf(), to);
        assert.equal(grant.logs[0].args._value.valueOf(), value);
    }

    beforeEach(async () => {
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

        token = await NYNJACoin.new(assigner, locker, { from: owner });
        await token.tokenSaleStart({ from: owner });

        trustee = await VestingTrustee.new(token.address, vester, { from: owner });
    });

    const getGrant = async (address) => {
        let grant = await trustee.grants(address, { from: someoneElse });

        return {
            value: grant[0],
            start: grant[1],
            cliff: grant[2],
            end: grant[3],
            installmentLength: grant[4],
            transferred: grant[5],
            revokable: grant[6]
        };
    };

    describe('construction', async () => {
        it('should be initialized with a valid token contract address', async () => {
            await assertRevert(VestingTrustee.new(0x0, vester, { from: owner }));
        });

        it('should be initialized with a valid vester address', async () => {
            await assertRevert(VestingTrustee.new(token.address, 0x0, { from: owner }));
        });

        it('should be ownable', async () => {
            assert.equal(await trustee.owner(), owner);
        });

        let balance = 1000;
        context(`with ${balance} tokens assigned to the trustee`, async () => {
            beforeEach(async () => {
                await token.mint(trustee.address, balance, { from: assigner });
            });

            it(`should equal to ${balance}`, async () => {
                let trusteeBalance = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                assert.equal(trusteeBalance, balance);
            });

            it('should be able to update', async () => {
                let value = 10;

                await token.mint(trustee.address, value, { from: assigner });
                let trusteeBalance = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                assert.equal(trusteeBalance, balance + value);
            });
        });
    });

    describe('control accounts', function () {

        before(async function () {
            trustee = await VestingTrustee.new(token.address, vester, { from: owner });
        });


        describe('owner', async function () {
            let newOwner = someoneElse2;

            it('owner can only be changed by owner', async function () {
                await assertRevert(trustee.transferOwnership(newOwner, { from: someoneElse }));
                assert.equal(await trustee.owner(), owner);
            });

            it('new owner cannot be 0x0', async function () {
                await assertRevert(trustee.transferOwnership(0x0, { from: owner }));
                assert.equal(await trustee.owner(), owner);
            });

            it('change owner', async function () {
                const transferOwnership = await trustee.transferOwnership(newOwner, { from: owner });
                await checkTransferOwnership(transferOwnership, owner, newOwner);
            });
        });

        describe('vester', async function () {
            let newVester = someoneElse2;

            it('only the owner should be able to change the vester', async () => {
                await assertRevert(trustee.transferVester(newVester, { from: vester }));
                assert.equal(await trustee.vester(), vester);
            });

            it('new vester cannot be 0x0', async () => {
                await assertRevert(trustee.transferVester(0x0, { from: owner }));
                assert.equal(await trustee.vester(), vester);
            });

            it('change vester', async function () {
                const transferVester = await trustee.transferVester(newVester, { from: owner });
                await checkTransferVester(transferVester, vester, newVester);
            });
        });
    });

    describe('grant', async () => {
        const balance = 10000;

        context(`with ${balance} tokens assigned to the trustee`, async () => {
            beforeEach(async () => {
                await token.mint(trustee.address, balance, { from: assigner });
            });

            it('should initially have no grants', async () => {
                assert.equal((await trustee.totalVesting({ from: someoneElse })).toNumber(), 0);
            });

            it('should not allow granting to 0x0 address', async () => {
                await assertRevert(trustee.grant(0x0, 1000, now, now, now + 10 * constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting to self', async () => {
                await assertRevert(trustee.grant(trustee.address, 1000, now, now, now + 10 * constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting 0 tokens', async () => {
                await assertRevert(trustee.grant(grantees[0], 0, now, now, now + 3 * constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting with a cliff before the start', async () => {
                await assertRevert(trustee.grant(grantees[0], 0, now, now - 1, now + 10 * constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting with a cliff after the vesting', async () => {
                await assertRevert(trustee.grant(grantees[0], 0, now, now + constants.YEAR, now + constants.MONTH, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting with 0 installment', async () => {
                await assertRevert(trustee.grant(grantees[0], 0, now, now + constants.YEAR, now + constants.MONTH, 0, false, { from: vester }));
            });

            it('should not allow granting with installment longer than the vesting period', async () => {
                await assertRevert(trustee.grant(grantees[0], 0, now, now + constants.YEAR, now + constants.MONTH, 2 * constants.YEAR, false, { from: vester }));
            });

            it('should not allow granting tokens more than once', async () => {
                await trustee.grant(grantees[0], 1000, now, now, now + 10 * constants.YEAR, 1 * constants.DAY, false, { from: vester });
                await assertRevert(trustee.grant(grantees[0], 1000, now, now, now + 10 * constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting from not the vester', async () => {
                await assertRevert(trustee.grant(grantees[0], 1000, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, false, { from: owner }));
            });

            it('should not allow granting more than the balance in a single grant', async () => {
                await assertRevert(trustee.grant(grantees[0], balance + 1, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should not allow granting more than the balance in multiple grants', async () => {
                await trustee.grant(grantees[0], balance - 10, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, false, { from: vester });
                await trustee.grant(grantees[1], 7, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, false, { from: vester });
                await trustee.grant(grantees[2], 3, now, now + 5 * constants.MONTH, now + constants.YEAR, 1 * constants.DAY, false, { from: vester });
                const currentBalance = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber()
                assert.equal(balance, currentBalance);
                await assertRevert(trustee.grant(grantees[3], 1, now, now, now + constants.YEAR, 1 * constants.DAY, false, { from: vester }));
            });

            it('should record a grant and increase grants count and total vesting', async () => {
                let totalVesting = (await trustee.totalVesting({ from: someoneElse })).toNumber();
                assert.equal(totalVesting, 0);

                let value = 1000;
                let start = now;
                let cliff = now + constants.MONTH;
                let end = now + constants.YEAR;
                let installmentLength = 1 * constants.DAY;
                let grantCall = await trustee.grant(grantees[0], value, start, cliff, end, installmentLength, false, { from: vester });
                await checkGrant(grantCall, vester, grantees[0], value);

                assert.equal((await trustee.totalVesting({ from: someoneElse })).toNumber(), totalVesting + value);
                let grant = await getGrant(grantees[0]);
                assert.equal(grant.value, value);
                assert.equal(grant.start, start);
                assert.equal(grant.cliff, cliff);
                assert.equal(grant.end, end);
                assert.equal(grant.installmentLength, installmentLength);
                assert.equal(grant.transferred, 0);

                let value2 = 2300;
                let start2 = now + 2 * constants.MONTH;
                let cliff2 = now + 6 * constants.MONTH;
                let end2 = now + constants.YEAR;
                let installmentLength2 = 3 * constants.MONTH;
                let grantCall2 = await trustee.grant(grantees[1], value2, start2, cliff2, end2, installmentLength2, false, { from: vester });
                await checkGrant(grantCall2, vester, grantees[1], value2);

                assert.equal((await trustee.totalVesting({ from: someoneElse })).toNumber(), totalVesting + value + value2);
                let grant2 = await getGrant(grantees[1], { from: someoneElse });
                assert.equal(grant2.value, value2);
                assert.equal(grant2.start, start2);
                assert.equal(grant2.cliff, cliff2);
                assert.equal(grant2.end, end2);
                assert.equal(grant2.installmentLength, installmentLength2);
                assert.equal(grant2.transferred, 0);
            });
        });
    });

    describe('revoke', async () => {
        const balance = 100000;

        context(`with ${balance} tokens assigned to the trustee`, async () => {

            const grantee = grantees[0];

            beforeEach(async () => {
                await token.mint(trustee.address, balance, { from: assigner });
            });

            context('after minting has ended', async () => {
                beforeEach(async () => {
                    await token.tokenSaleEnd({ from: owner });
                });

                it('should throw an error when revoking a non-existing grant', async () => {
                    await assertRevert(trustee.revoke(someoneElse, { from: vester }));
                });

                it('should not be able to revoke a non-revokable grant', async () => {
                    await trustee.grant(grantee, balance, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, false, { from: vester });

                    await assertRevert(trustee.revoke(grantee, { from: vester }));
                });

                it('should only allow revoking a grant by the vester', async () => {
                    let grantee = grantees[1];

                    await trustee.grant(grantee, balance, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, true, { from: vester });
                    assert.equal((await trustee.totalVesting({ from: someoneElse })).toNumber(), balance);

                    await assertRevert(trustee.revoke(grantee, { from: owner }));
                    assert.equal((await trustee.totalVesting({ from: someoneElse })).toNumber(), balance);

                    await trustee.revoke(grantee, { from: vester });
                    assert.equal((await trustee.totalVesting({ from: someoneElse })).toNumber(), 0);
                });
            });

            [
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: constants.MONTH - constants.DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: constants.DAY, unlocked: 83 },
                        // 1 second after che cliff and previous unlock/withdraw.
                        { diff: 1, unlocked: 0 },
                        // 1 month after the cliff.
                        { diff: constants.MONTH - 1, unlocked: 83 },
                        // At half of the vesting period.
                        { diff: 4 * constants.MONTH, unlocked: 1000 / 2 - 2 * 83 },
                        // At the end of the vesting period.
                        { diff: 6 * constants.MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: constants.DAY, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: constants.MONTH - constants.DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: constants.DAY, unlocked: 83 },
                        // 1 second before the installment length.
                        { diff: constants.DAY - 1, unlocked: 0 },
                        // Instalment length.
                        { diff: 1, unlocked: 2 },
                        // 1 month after the cliff.
                        { diff: constants.MONTH - 1, unlocked: 81 },
                        // 1000 seconds before the installment length.
                        { diff: constants.DAY - 1000, unlocked: 0 },
                        // Another instalment length.
                        { diff: 1000, unlocked: 2 },
                        // At half of the vesting period.
                        { diff: 4 * constants.MONTH, unlocked: 1000 / 2 - 83 - 2 - 81 - 2 },
                        // At the end of the vesting period.
                        { diff: 6 * constants.MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: constants.YEAR + constants.DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: constants.YEAR - constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: constants.MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: constants.YEAR + constants.DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: constants.YEAR - constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: 0, endOffset: constants.YEAR, installmentLength: 3 * constants.MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the start of the vesting.
                        { diff: constants.DAY, unlocked: 0 },
                        // 1 month after the start of the vesting.
                        { diff: constants.MONTH - constants.DAY, unlocked: 0 },
                        // 2 months after the start of the vesting.
                        { diff: constants.MONTH, unlocked: 0 },
                        // 3 months after the start of the vesting.
                        { diff: constants.MONTH, unlocked: 250 },
                        { diff: constants.MONTH, unlocked: 0 },
                        // Another installment.
                        { diff: 2 * constants.MONTH, unlocked: 250 },
                        // After the vesting period.
                        { diff: constants.YEAR, unlocked: 1000 - 2 * 250 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: 2 * constants.YEAR, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 1000000 / 2 },
                        { diff: constants.YEAR, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 1000000 / 2 },
                        { diff: constants.YEAR, unlocked: 0 }
                    ]
                }
            ].forEach(async (grant) => {
                context(`grant: ${grant.tokens}, startOffset: ${grant.startOffset}, cliffOffset: ${grant.cliffOffset}, ` +
                    `endOffset: ${grant.endOffset}, installmentLength: ${grant.installmentLength}`, async () => {
                        // We'd allow (up to) 10 tokens vesting error, due to possible timing differences during the tests.
                        const MAX_ERROR = 10;

                        for (let i = 0; i < grant.results.length; ++i) {
                            it(`should revoke the grant and refund tokens after ${i + 1} transactions`, async () => {
                                trustee = await VestingTrustee.new(token.address, vester, { from: vester });
                                await token.mint(trustee.address, grant.tokens, { from: assigner });
                                await token.tokenSaleEnd({ from: owner });
                                await trustee.grant(holder, grant.tokens, now + grant.startOffset, now + grant.cliffOffset,
                                    now + grant.endOffset, grant.installmentLength, true, { from: vester });

                                // Get previous state.
                                let totalVesting = (await trustee.totalVesting({ from: someoneElse })).toNumber();
                                let trusteeBalance = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                                let userBalance = (await token.balanceOf(holder, { from: someoneElse })).toNumber();
                                let transferred = (await getGrant(holder)).transferred.toNumber();
                                let vesterBalance = (await token.balanceOf(vester)).toNumber();
                                let totalUnlocked = 0;

                                for (let j = 0; j <= i; ++j) {
                                    let res = grant.results[j];

                                    // Jump forward in time by the requested diff.
                                    await time.increaseTime(res.diff);
                                    await trustee.unlockVestedTokens(holder, { from: someoneElse });

                                    totalUnlocked += res.unlocked;
                                }
                                // Verify the state after the multiple unlocks.
                                let totalVesting2 = (await trustee.totalVesting({ from: someoneElse })).toNumber();
                                let trusteeBalance2 = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                                let userBalance2 = (await token.balanceOf(holder, { from: someoneElse })).toNumber();
                                let transferred2 = (await getGrant(holder)).transferred.toNumber();

                                assert.approximately(totalVesting2, totalVesting - totalUnlocked, MAX_ERROR,
                                    `totalVesting2 = ${totalVesting2}, expecting ${totalVesting - totalUnlocked}. Error > ${MAX_ERROR}`);

                                assert.approximately(trusteeBalance2, trusteeBalance - totalUnlocked, MAX_ERROR,
                                    `trusteeBalance2 = ${trusteeBalance2}, expecting ${trusteeBalance - totalUnlocked}. Error > ${MAX_ERROR}`);

                                assert.approximately(userBalance2, userBalance + totalUnlocked, MAX_ERROR,
                                    `userBalance2 = ${userBalance2}, expecting ${userBalance + totalUnlocked}. Error > ${MAX_ERROR}`);

                                assert.approximately(transferred2, transferred + totalUnlocked, MAX_ERROR,
                                    `transferred2 = ${transferred2}, expecting ${transferred + totalUnlocked}. Error > ${MAX_ERROR}`);

                                let refundTokens = grant.tokens - totalUnlocked;

                                console.log(`\texpecting ${refundTokens} tokens refunded after ${i + 1} transactions`);

                                let vestingGrant = await getGrant(holder);
                                assert.equal(vestingGrant.value, grant.tokens);

                                await trustee.revoke(holder, { from: vester });

                                let totalVesting3 = (await trustee.totalVesting({ from: someoneElse })).toNumber();
                                let trusteeBalance3 = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                                let userBalance3 = (await token.balanceOf(holder, { from: someoneElse })).toNumber();
                                let vesterBalance2 = (await token.balanceOf(vester, { from: someoneElse })).toNumber();

                                assert.approximately(totalVesting3, totalVesting2 - refundTokens, MAX_ERROR,
                                    `totalVesting3 = ${totalVesting3}, expecting ${totalVesting2 - refundTokens}. Error > ${MAX_ERROR}`);

                                assert.approximately(trusteeBalance3, trusteeBalance2 - refundTokens, MAX_ERROR,
                                    `trusteeBalance3 = ${trusteeBalance3}, expecting ${trusteeBalance2 - refundTokens}. Error > ${MAX_ERROR}`);

                                assert.equal(userBalance3, userBalance2, `userBalance3 = ${userBalance3}, expecting ${userBalance2}`);

                                assert.approximately(vesterBalance2, vesterBalance + refundTokens, MAX_ERROR,
                                    `vesterBalance2 = ${vesterBalance2}, expecting ${vesterBalance + refundTokens}. Error > ${MAX_ERROR}`);

                                let vestingGrant2 = await getGrant(holder);
                                assert.equal(vestingGrant2.tokens, undefined);
                            });
                        }
                    });
            });
        });
    });

    describe('vestedTokens', async () => {
        const balance = 10 ** 12;

        beforeEach(async () => {
            await token.mint(trustee.address, balance, { from: assigner });
        });

        it('should return 0 for non existing grant', async () => {
            let grant = await getGrant(someoneElse, { from: someoneElse });

            assert.equal(grant.value, 0);
            assert.equal((await trustee.vestedTokens(someoneElse, now + 100 * constants.YEAR, { from: someoneElse })).toNumber(), 0);
        });

        [
            {
                tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH - 1, vested: 0 },
                    { offset: constants.MONTH, vested: Math.floor(1000 / 12) },
                    { offset: constants.MONTH + 0.5 * constants.DAY, vested: Math.floor(1000 / 12) + Math.floor(0.5 * (1000 / 12 / 30)) },
                    { offset: 2 * constants.MONTH, vested: 2 * Math.floor(1000 / 12) },
                    { offset: 0.5 * constants.YEAR, vested: 1000 / 2 },
                    { offset: 0.5 * constants.YEAR + 3 * constants.DAY, vested: 1000 / 2 + Math.floor(3 * (1000 / 12 / 30)) },
                    { offset: constants.YEAR, vested: 1000 },
                    { offset: constants.YEAR + constants.DAY, vested: 1000 }
                ]
            },
            {
                tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: constants.DAY, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.DAY, vested: 0 },
                    { offset: constants.MONTH - 1, vested: 0 },
                    { offset: constants.MONTH, vested: Math.floor(1000 / 12) },
                    { offset: constants.MONTH + 1, vested: Math.floor(1000 / 12) },
                    { offset: constants.MONTH + 1000, vested: Math.floor(1000 / 12) },
                    { offset: constants.MONTH + constants.DAY, vested: Math.floor(1000 / 12 + 1000 / 12 / 30) },
                    { offset: 2 * constants.MONTH, vested: 2 * Math.floor(1000 / 12) },
                    { offset: 2 * constants.MONTH + 1, vested: Math.floor(2 * (1000 / 12)) },
                    { offset: 2 * constants.MONTH + 0.5 * constants.DAY, vested: Math.floor(2 * (1000 / 12)) },
                    { offset: 2 * constants.MONTH + 5 * constants.DAY, vested: Math.floor(2 * (1000 / 12) + 5 * (1000 / 12 / 30)) },
                    { offset: 0.5 * constants.YEAR, vested: 1000 / 2 },
                    { offset: constants.YEAR, vested: 1000 },
                    { offset: constants.YEAR + constants.DAY, vested: 1000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH, vested: Math.floor(10000 / 12 / 4) },
                    { offset: 0.5 * constants.YEAR, vested: 10000 / 8 },
                    { offset: constants.YEAR, vested: 10000 / 4 },
                    { offset: 2 * constants.YEAR, vested: 10000 / 2 },
                    { offset: 3 * constants.YEAR, vested: 10000 * 0.75 },
                    { offset: 4 * constants.YEAR, vested: 10000 },
                    { offset: 4 * constants.YEAR + constants.MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: constants.MONTH, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH, vested: Math.floor(10000 / 12 / 4) },
                    { offset: constants.MONTH + constants.DAY, vested: Math.floor(10000 / 12 / 4) },
                    { offset: constants.MONTH + 10 * constants.DAY, vested: Math.floor(10000 / 12 / 4) },
                    { offset: 2 * constants.MONTH, vested: 2 * Math.floor(10000 / 12 / 4) },
                    { offset: 0.5 * constants.YEAR, vested: 10000 / 8 },
                    { offset: 0.5 * constants.YEAR + 10 * constants.DAY, vested: 10000 / 8 },
                    { offset: constants.YEAR, vested: 10000 / 4 },
                    { offset: constants.YEAR + constants.DAY, vested: 10000 / 4 },
                    { offset: 2 * constants.YEAR, vested: 10000 / 2 },
                    { offset: 3 * constants.YEAR, vested: 10000 * 0.75 },
                    { offset: 4 * constants.YEAR, vested: 10000 },
                    { offset: 4 * constants.YEAR + constants.MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: constants.YEAR, endOffset: 4 * constants.YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH, vested: 0 },
                    { offset: 0.5 * constants.YEAR, vested: 0 },
                    { offset: constants.YEAR, vested: 10000 / 4 },
                    { offset: constants.YEAR + constants.MONTH, vested: Math.floor(10000 / 4 + 10000 / 4 / 12) },
                    { offset: constants.YEAR + 2 * constants.MONTH, vested: Math.floor(10000 / 4 + 2 * (10000 / 4 / 12)) },
                    { offset: constants.YEAR + 3 * constants.MONTH, vested: Math.floor(10000 / 4 + 3 * (10000 / 4 / 12)) },
                    { offset: 2 * constants.YEAR, vested: 10000 / 2 },
                    { offset: 3 * constants.YEAR, vested: 10000 * 0.75 },
                    { offset: 3 * constants.YEAR + constants.MONTH, vested: Math.floor(10000 * 0.75 + 10000 / 4 / 12) },
                    { offset: 3 * constants.YEAR + 2 * constants.MONTH, vested: Math.floor(10000 * 0.75 + 2 * (10000 / 4 / 12)) },
                    { offset: 3 * constants.YEAR + 3 * constants.MONTH, vested: Math.floor(10000 * 0.75 + 3 * (10000 / 4 / 12)) }, { offset: 4 * constants.YEAR, vested: 10000 },
                    { offset: 4 * constants.YEAR + constants.MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 10000, startOffset: 0, cliffOffset: constants.YEAR, endOffset: 4 * constants.YEAR, installmentLength: 3 * constants.MONTH, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH, vested: 0 },
                    { offset: 0.5 * constants.YEAR, vested: 0 },
                    { offset: constants.YEAR, vested: 10000 / 4 },
                    { offset: constants.YEAR + constants.MONTH, vested: 10000 / 4 },
                    { offset: constants.YEAR + 2 * constants.MONTH, vested: 10000 / 4 },
                    { offset: constants.YEAR + 3 * constants.MONTH, vested: Math.floor(10000 / 4 + 3 * (10000 / 4 / 12)) },
                    { offset: 2 * constants.YEAR, vested: 10000 / 2 },
                    { offset: 3 * constants.YEAR, vested: 10000 * 0.75 },
                    { offset: 3 * constants.YEAR + constants.MONTH, vested: 10000 * 0.75 },
                    { offset: 3 * constants.YEAR + 2 * constants.MONTH, vested: 10000 * 0.75 },
                    { offset: 3 * constants.YEAR + 3 * constants.MONTH, vested: Math.floor(10000 * 0.75 + 3 * (10000 / 4 / 12)) },
                    { offset: 4 * constants.YEAR, vested: 10000 },
                    { offset: 4 * constants.YEAR + constants.MONTH, vested: 10000 }
                ]
            },
            {
                tokens: 100000000, startOffset: 0, cliffOffset: 0, endOffset: 2 * constants.YEAR, installmentLength: 1, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH, vested: Math.floor(100000000 / 12 / 2) },
                    { offset: 2 * constants.MONTH, vested: Math.floor(2 * (100000000 / 12 / 2)) },
                    { offset: 0.5 * constants.YEAR, vested: 100000000 / 4 },
                    { offset: constants.YEAR, vested: 100000000 / 2 },
                    { offset: 2 * constants.YEAR, vested: 100000000 },
                    { offset: 3 * constants.YEAR, vested: 100000000 }
                ]
            },
            {
                tokens: 100000000, startOffset: 0, cliffOffset: 0, endOffset: 2 * constants.YEAR, installmentLength: constants.YEAR, results: [
                    { offset: 0, vested: 0 },
                    { offset: constants.MONTH, vested: 0 },
                    { offset: 2 * constants.MONTH, vested: 0 },
                    { offset: 0.5 * constants.YEAR, vested: 0 },
                    { offset: constants.YEAR, vested: 100000000 / 2 },
                    { offset: constants.YEAR + constants.MONTH, vested: 100000000 / 2 },
                    { offset: constants.YEAR + 2 * constants.MONTH, vested: 100000000 / 2 },
                    { offset: constants.YEAR + 10 * constants.MONTH, vested: 100000000 / 2 },
                    { offset: 2 * constants.YEAR, vested: 100000000 },
                    { offset: 3 * constants.YEAR, vested: 100000000 }
                ]
            },
        ].forEach((grant) => {
            context(`grant: ${grant.tokens}, startOffset: ${grant.startOffset}, cliffOffset: ${grant.cliffOffset}, ` +
                `endOffset: ${grant.endOffset}, installmentLength: ${grant.installmentLength}`, async () => {

                    beforeEach(async () => {
                        await trustee.grant(grantees[2], grant.tokens, now + grant.startOffset, now + grant.cliffOffset,
                            now + grant.endOffset, grant.installmentLength, false, { from: vester });
                    });

                    grant.results.forEach(async (res) => {
                        it(`should vest ${res.vested} out of ${grant.tokens} at time offset ${res.offset}`, async () => {
                            let result = (await trustee.vestedTokens(grantees[2], now + res.offset, { from: someoneElse })).toNumber();
                            assert.equal(result, res.vested);
                        });
                    });
                });
        });

    });

    describe('unlockVestedTokens', async () => {
        // We'd allow (up to) 10 tokens vesting error, due to possible timing differences during the tests.
        const MAX_ERROR = 10;

        const balance = 10 ** 12;

        beforeEach(async () => {
            await token.mint(trustee.address, balance, { from: assigner });
        });

        context('after minting has ended', async () => {
            beforeEach(async () => {
                await token.tokenSaleEnd({ from: owner });
            });

            it('should not allow unlocking a non-existing grant', async () => {
                let holder = someoneElse;
                let grant = await getGrant(holder);

                assert.equal(grant.value, 0);

                await assertRevert(trustee.unlockVestedTokens(holder, { from: someoneElse2 }));
            });

            it('should not allow unlocking a revoked grant', async () => {
                let grantee = accounts[1];

                await trustee.grant(grantee, balance, now, now + constants.MONTH, now + constants.YEAR, 1 * constants.DAY, true, { from: vester });
                await trustee.revoke(grantee, { from: vester });
                await assertRevert(trustee.unlockVestedTokens(grantee, { from: someoneElse }));
            });

            [
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: constants.MONTH - constants.DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: constants.DAY, unlocked: 83 },
                        // 1 second after che cliff and previous unlock/withdraw.
                        { diff: 1, unlocked: 0 },
                        // 1 month after the cliff.
                        { diff: constants.MONTH - 1, unlocked: 83 },
                        // At half of the vesting period.
                        { diff: 4 * constants.MONTH, unlocked: 1000 / 2 - 2 * 83 },
                        // At the end of the vesting period.
                        { diff: 6 * constants.MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: constants.DAY, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day before the cliff.
                        { diff: constants.MONTH - constants.DAY, unlocked: 0 },
                        // At the cliff.
                        { diff: constants.DAY, unlocked: 83 },
                        // 1 second before the installment length.
                        { diff: constants.DAY - 1, unlocked: 0 },
                        // Instalment length.
                        { diff: 1, unlocked: 2 },
                        // 1 month after the cliff.
                        { diff: constants.MONTH - 1, unlocked: 81 },
                        // 1000 seconds before the installment length.
                        { diff: constants.DAY - 1000, unlocked: 0 },
                        // Another instalment length.
                        { diff: 1000, unlocked: 2 },
                        // At half of the vesting period.
                        { diff: 4 * constants.MONTH, unlocked: 1000 / 2 - 83 - 2 - 81 - 2 },
                        // At the end of the vesting period.
                        { diff: 6 * constants.MONTH, unlocked: 1000 / 2 },
                        // After the vesting period, with everything already unlocked and withdrawn.
                        { diff: constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: constants.YEAR + constants.DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: constants.YEAR - constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: constants.MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the vesting period.
                        { diff: constants.YEAR + constants.DAY, unlocked: 1000 },
                        // 1 year after the vesting period.
                        { diff: constants.YEAR - constants.DAY, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000, startOffset: 0, cliffOffset: 0, endOffset: constants.YEAR, installmentLength: 3 * constants.MONTH, results: [
                        { diff: 0, unlocked: 0 },
                        // 1 day after the start of the vesting.
                        { diff: constants.DAY, unlocked: 0 },
                        // 1 month after the start of the vesting.
                        { diff: constants.MONTH - constants.DAY, unlocked: 0 },
                        // 2 months after the start of the vesting.
                        { diff: constants.MONTH, unlocked: 0 },
                        // 3 months after the start of the vesting.
                        { diff: constants.MONTH, unlocked: 250 },
                        { diff: constants.MONTH, unlocked: 0 },
                        // Another installment.
                        { diff: 2 * constants.MONTH, unlocked: 250 },
                        // After the vesting period.
                        { diff: constants.YEAR, unlocked: 1000 - 2 * 250 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: 1, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 1000000 / 4 },
                        { diff: constants.YEAR, unlocked: 0 }
                    ]
                },
                {
                    tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: 2 * constants.YEAR, results: [
                        { diff: 0, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 1000000 / 2 },
                        { diff: constants.YEAR, unlocked: 0 },
                        { diff: constants.YEAR, unlocked: 1000000 / 2 },
                        { diff: constants.YEAR, unlocked: 0 }
                    ]
                }
            ].forEach(async (grant) => {
                context(`grant: ${grant.tokens}, startOffset: ${grant.startOffset}, cliffOffset: ${grant.cliffOffset}, ` +
                    `endOffset: ${grant.endOffset}, installmentLength: ${grant.installmentLength}`, async () => {

                        beforeEach(async () => {
                            await trustee.grant(holder, grant.tokens, now + grant.startOffset, now + grant.cliffOffset, now +
                                grant.endOffset, grant.installmentLength, false, { from: vester });
                        });

                        it('should unlock tokens according to the schedule', async () => {
                            for (let res of grant.results) {
                                console.log(`\texpecting ${res.unlocked} tokens unlocked and transferred after another ` +
                                    `${res.diff} seconds`);

                                // Get previous state.
                                let totalVesting = (await trustee.totalVesting({ from: someoneElse })).toNumber();
                                let trusteeBalance = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                                let userBalance = (await token.balanceOf(holder, { from: someoneElse })).toNumber();
                                let transferred = (await getGrant(holder)).transferred.toNumber();

                                // Jump forward in time by the requested diff.
                                await time.increaseTime(res.diff);
                                await trustee.unlockVestedTokens(holder, { from: someoneElse });

                                // Verify new state.
                                let totalVesting2 = (await trustee.totalVesting({ from: someoneElse })).toNumber();
                                let trusteeBalance2 = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
                                let userBalance2 = (await token.balanceOf(holder, { from: someoneElse })).toNumber();
                                let transferred2 = (await getGrant(holder)).transferred.toNumber();

                                assert.approximately(totalVesting2, totalVesting - res.unlocked, MAX_ERROR);
                                assert.approximately(trusteeBalance2, trusteeBalance - res.unlocked, MAX_ERROR);
                                assert.approximately(userBalance2, userBalance + res.unlocked, MAX_ERROR);
                                assert.approximately(transferred2, transferred + res.unlocked, MAX_ERROR);
                            }
                        });
                    });
            });
        });

        it('should allow revoking multiple grants', async () => {
            let grants = [
                { tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, holder: accounts[1] },
                { tokens: 1000, startOffset: 0, cliffOffset: constants.MONTH, endOffset: constants.YEAR, installmentLength: 1, holder: accounts[2] },
                { tokens: 1000000, startOffset: 0, cliffOffset: 0, endOffset: 4 * constants.YEAR, installmentLength: 1, holder: accounts[3] },
                { tokens: 1245, startOffset: 0, cliffOffset: 0, endOffset: 1 * constants.YEAR, installmentLength: 1, holder: accounts[4] },
                { tokens: 233223, startOffset: 0, cliffOffset: 2 * constants.MONTH, endOffset: 2 * constants.YEAR, installmentLength: 1, holder: accounts[5] }
            ];

            let vesterBalance = (await token.balanceOf(vester, { from: someoneElse })).toNumber();
            let trusteeBalance = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
            assert.equal(vesterBalance, 0);
            assert.equal(trusteeBalance, balance);

            let totalGranted = 0;

            for (let grant of grants) {
                await token.mint(trustee.address, grant.tokens, { from: assigner });
                await trustee.grant(grant.holder, grant.tokens, now + grant.startOffset, now + grant.cliffOffset, now +
                    grant.endOffset, grant.installmentLength, true, { from: vester });

                totalGranted += grant.tokens;
            }

            await token.tokenSaleEnd({ from: owner });

            let vesterBalance2 = (await token.balanceOf(vester, { from: someoneElse })).toNumber();
            let trusteeBalance2 = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
            assert.equal(vesterBalance2, 0);
            assert.equal(trusteeBalance2, trusteeBalance + totalGranted);

            for (let grant of grants) {
                await trustee.revoke(grant.holder, { from: vester });
            }

            let vesterBalance3 = (await token.balanceOf(vester, { from: someoneElse })).toNumber();
            let trusteeBalance3 = (await token.balanceOf(trustee.address, { from: someoneElse })).toNumber();
            assert.equal(vesterBalance3, totalGranted);
            assert.equal(trusteeBalance3, trusteeBalance2 - totalGranted);
        });
    });

    describe('events', async () => {
        const balance = 10000;
        const grantee = grantees[0];

        let value;
        let start;
        let cliff;
        let end;
        let installmentLength;

        beforeEach(async () => {
            await token.mint(trustee.address, balance, { from: assigner });
            await token.tokenSaleEnd({ from: owner });

            value = 1000;
            start = now;
            cliff = now + constants.MONTH;
            end = now + constants.YEAR;
            installmentLength = 1 * constants.DAY;
        });

        it('should emit events when granting vesting', async () => {
            let result = await trustee.grant(grantee, value, start, cliff, end, installmentLength, false, { from: vester });

            assert.lengthOf(result.logs, 1);

            let event = result.logs[0];
            assert.equal(event.event, 'NewGrant');
            assert.equal(event.args._from, vester);
            assert.equal(event.args._to, grantee);
            assert.equal(Number(event.args._value), value);
        });

        it('should emit events when revoking a grant', async () => {
            await trustee.grant(grantee, value, start, cliff, end, installmentLength, true, { from: vester });
            let result = await trustee.revoke(grantee, { from: vester });

            assert.lengthOf(result.logs, 1);

            let event = result.logs[0];
            assert.equal(event.event, 'GrantRevoked');
            assert.equal(event.args._holder, grantee);
            assert.equal(Number(event.args._refund), value);
        });

        it('should emit events when unlocking tokens', async () => {
            await trustee.grant(grantee, value, start, cliff, end, installmentLength, true, { from: vester });
            await time.increaseTime(cliff);
            let result = await trustee.unlockVestedTokens(grantee, { from: someoneElse });

            assert.lengthOf(result.logs, 1);

            let event = result.logs[0];
            assert.equal(event.event, 'TokensUnlocked');
            assert.equal(event.args._to, grantee);
            assert.equal(Number(event.args._value), value);
        });
    });
});