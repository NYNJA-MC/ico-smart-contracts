#!/usr/bin/env bash
set -e

BIN_PATH=node_modules/.bin/
dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

pushd truffle
$dir/../$BIN_PATH/truffle compile
popd
