"use strict";

// @notice Tests the functionality inherited by NYNJACoin from openzeppelin-solidity DetailedERC20 implementation

const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const NYNJACoin = artifacts.require('NYNJACoin');

contract('NYNJACoin', accounts => {
    let detailedERC20 = null;

    const _name = 'NYNJACoin';
    const _symbol = 'NYN';
    const _decimals = 18;

    beforeEach(async function () {
        detailedERC20 = await NYNJACoin.new(accounts[0], accounts[1]);
    });

    it('has a name', async function () {
        const name = await detailedERC20.name();
        name.should.be.equal(_name);
    });

    it('has a symbol', async function () {
        const symbol = await detailedERC20.symbol();
        symbol.should.be.equal(_symbol);
    });

    it('has an amount of decimals', async function () {
        const decimals = await detailedERC20.decimals();
        decimals.should.be.bignumber.equal(_decimals);
    });
});
