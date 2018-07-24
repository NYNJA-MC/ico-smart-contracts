/// @title  ExchangeRate.test.js
/// @author Jose Perez - <jose.perez@diginex.com>
/// @notice ExchangeRate smart contract unit test

'use strict';

const BigNumber = web3.BigNumber;
const assertRevert = require('./helpers/assertRevert');
const ExchangeRate = artifacts.require('../contracts/ExchangeRate.sol');

const trimHex = (x) => x.replace(/^0x0+/, '0x');

contract('ExchangeRate', (accounts) => {
    const owner = accounts[9];
    const updater = accounts[8];
    const someoneElse = accounts[7];
    const updater1 = accounts[6];

    const RATE_BTC = 1234570000;
    const RATE_ETH = 2234570000;
    const RATE_ETH_2 = 2234570001;

    let contract;

    before(async () => {
        contract = await ExchangeRate.new(updater, { from: owner });
    });

    it('should allow updater to update the rate', async () => {
        const tx1 = await contract.updateRate('BTC', RATE_BTC, { from: updater });
        assert.equal(tx1.logs[0].event, 'RateUpdated');
        assert.equal(tx1.logs[0].args.id, 'BTC');
        assert.equal(tx1.logs[0].args.rate, RATE_BTC);

        const tx2 = await contract.updateRate('ETH', RATE_ETH, { from: updater });
        assert.equal(tx2.logs[0].event, 'RateUpdated');
        assert.equal(tx2.logs[0].args.id, 'ETH');
        assert.equal(tx2.logs[0].args.rate, RATE_ETH);

        assert.equal(await contract.getRate('BTC'), RATE_BTC, { from: someoneElse });
        assert.equal(await contract.getRate('ETH'), RATE_ETH, { from: someoneElse });
    });

    it('should only allow updater to update the rate', async () => {
        assertRevert(contract.updateRate('ETH', 1234, { from: owner }));
        assert.equal(await contract.getRate('ETH'), RATE_ETH, { from: someoneElse });
    });

    it('should not allow to update rates to 0', async () => {
        assertRevert(contract.updateRate('ETH', 0, { from: updater }));
        assert.equal(await contract.getRate('ETH'), RATE_ETH, { from: someoneElse });
    });

    it('should allow owner to transfer updater', async () => {
        assertRevert(contract.updateRate('ETH', RATE_ETH_2, { from: updater1 }));
        assert.equal(await contract.getRate('ETH'), RATE_ETH, { from: someoneElse });

        const tx1 = await contract.transferUpdater(updater1, { from: owner });

        assert.equal(tx1.logs[0].event, 'UpdaterTransferred');
        assert.equal(tx1.logs[0].args.previousUpdater, updater);
        assert.equal(tx1.logs[0].args.newUpdater, updater1);

        assert.equal(tx1.receipt.logs[0].topics.length, 3);
        assert.equal(trimHex(tx1.receipt.logs[0].topics[1]), updater);
        assert.equal(trimHex(tx1.receipt.logs[0].topics[2]), updater1);

        await contract.updateRate('ETH', RATE_ETH_2, { from: updater1 });
        assert.equal(await contract.getRate('ETH'), RATE_ETH_2, { from: someoneElse });
    });

    it('should only allow owner to transfer updater', async () => {
        assertRevert(contract.transferUpdater(updater1, { from: someoneElse }));
    });

    it('should not allow changing updater to 0x0', async () => {
        assertRevert(contract.transferUpdater('0x0', { from: owner }));
    });
});
