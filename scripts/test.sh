#!/bin/bash

set -e
set -x

bash ./scripts/set-ganache-predefined-accounts.sh
bash scripts/run-truffle-tests.sh CoreTests
bash scripts/run-truffle-tests.sh VestingTrustee
