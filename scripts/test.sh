#!/bin/bash

set -e
set -x

bash scripts/run-truffle-tests.sh CoreTests
bash scripts/run-truffle-tests.sh VestingTrustee
bash scripts/run-truffle-tests.sh Workflow
