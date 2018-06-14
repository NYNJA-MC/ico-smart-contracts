#!/bin/bash

set -e
set -x

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

unify() {
	grep -v "^[pragma|import]" $dir/$1 >> Unified.sol
}

echo "pragma solidity 0.4.23;" > Unified.sol

unify ../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol
unify ../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol
unify ../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol
unify ../node_modules/openzeppelin-solidity/contracts/token/ERC20/BasicToken.sol
unify ../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol
unify ../node_modules/openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol
unify ../truffle/contracts/NYNJACoin.sol
unify ../truffle/contracts/ExchangeRate.sol
unify ../truffle/contracts/VestingTrustee.sol