#!/usr/bin/env bash
set -e

TEST_TYPE="$1"

if ([ "$#" != "1" ]); then
    echo "Illegal number of parameters"
    exit 1
fi

if ([ $TEST_TYPE != "CoreTests" ] && [ $TEST_TYPE != "VestingTrustee" ]); then
    echo "Please pass a correct test type"
    exit 1
fi

# let ganache-cli breath room to start...
sleep 5

pushd truffle

truffle=../node_modules/.bin/truffle

if ([ $TEST_TYPE == "CoreTests" ]); then
    echo "Running smart contract CoreTests test batch"
    $truffle test --network development ./test/NYNJACoin.DetailedERC20.test.js
    $truffle test --network development ./test/NYNJACoin.StandardToken.test.js    
    $truffle test --network development ./test/NYNJACoin.test.js
    $truffle test --network development ./test/TokenSaleWorkflow.test.js
    $truffle test --network development ./test/ExchangeRate.test.js
fi

if ([ $TEST_TYPE == "VestingTrustee" ]); then
    echo "Running smart contract VestingTrustee test batch"
    $truffle test --network development ./test/VestingTrustee.test.js
fi
