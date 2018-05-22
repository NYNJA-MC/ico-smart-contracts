#!/usr/bin/env bash
set -e

set -a
. scripts/test.env
set +a

ganache_port=8545
seconds_wait=5
TEST_TYPE="$1"

# Exit script as soon as a command fails.
set -o errexit

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
    echo "Waiting $seconds_wait sec for ganache to shutdown..."
    sleep $seconds_wait
  fi
}

# Executes cleanup function at script exit.
trap cleanup EXIT

if ([ "$#" != "1" ]); then
    echo "Illegal number of parameters"
    exit 1
fi

if ([ $TEST_TYPE != "CoreTests" ] && [ $TEST_TYPE != "Workflow" ] && [ $TEST_TYPE != "VestingTrustee" ]); then
    echo "Please pass a correct test type"
    exit 1
fi

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
  echo "Creating $NUM_ACCOUNTS accounts"
  node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff --accounts $NUM_ACCOUNTS > /dev/null &

  ganache_pid=$!
  echo "Waiting $seconds_wait sec for ganache to boot..."
  sleep $seconds_wait
}

if ganache_running; then
  echo "Using existing ganache instance"
else
  echo "Starting our own ganache instance"
  start_ganache
fi


pushd truffle

truffle=../node_modules/.bin/truffle

if ([ $TEST_TYPE == "CoreTests" ]); then
    echo "Running smart contract CoreTests test batch"
    $truffle test --network development ./test/NYNJACoin.DetailedERC20.test.js
    $truffle test --network development ./test/NYNJACoin.StandardToken.test.js
    $truffle test --network development ./test/NYNJACoin.test.js
    $truffle test --network development ./test/ExchangeRate.test.js
fi

if ([ $TEST_TYPE == "Workflow" ]); then
    echo "Running smart contract Workflow test batch"
    $truffle test --network development ./test/TokenSaleWorkflow.test.js
fi

if ([ $TEST_TYPE == "VestingTrustee" ]); then
    echo "Running smart contract VestingTrustee test batch"
    $truffle test --network development ./test/VestingTrustee.test.js
fi

popd
