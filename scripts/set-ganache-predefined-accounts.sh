#!/usr/bin/env bash
set -e

balance=10000000000000000000000000000
port=8545

# Private keys
acc=( \
    0x646e543f84034fef3d23614685e12e8145b5ee2c2420c67cf4811930ba7a64d1 \
    0xc61552901e80be92bd3c6d4984770fdfe154a6fc273f8d5c86c13032ccb40fbb \
    0xe36293cfa1e33713186c448ad658a770799cbe992b011f3d255aaa5980e94a4b \
    0x827cc7d0bb314aaaa9409926c38d5e8c47c57106cc4cea5d340b76b3a9436449 \
    0x206d215a707b3add19105d449053035b1c03135e587fcddb36d1b1898657615a \
    0x83459b7c4726a9552255f149e4111450ce3bc8aee4a1d5024c0b4a367ad97b62 \
    0x50a9f8ab46a2ee47fb4694b518ed312b99c5ca0d20b02121c4f1926fc4363fdf \
    0xa9d9931711d8b36861d2d8f46ffad9a16e966bc9465bac2ae71e94f5fa3530ad \
    0xe4a81ed62a86961a91b248d01733e7be819e7ef6109b2dff432fd44003401aee \
    0x2f6bb2d431a90c780391e8dfcd9636e4410215f1c96b2028e0160c159dda91a8 \
    0xfcd14bab1fe074ce7c4f15ec62654543269c094252711b4496e0b9283f0919c2 \
    0x77039191bf6e3cf07bc098cc059fd179498ddfd50a4fe7a8ed264a32a0b0c0bb \
    0x9564ad4b42aef4c4cbc2fd154bd1ef0b9e76f979bd4b48a44439814f17851ea9 \
    )

# Prepare a testrpc accounts parameter string like --account="0x646..,1000" --account="0x2f6...,1000" ....
for a in ${acc[@]}; do
    accounts=$accounts$(printf ' --account="%s,%s"' "$a" "$balance")
done

# Helper funcs.

# Test if testrpc is running on port $1. 
# Result is in $?
testrpc_running() {
    nc -z localhost $1
}

# Kills testrpc process with its PID in $testrpc_pid.
cleanup() {
    echo "Cleaning up!"
    # Kill the testrpc instance that we started (if we started one).
    if [ -n "$testrpc_pid" ]; then
        kill -9 $testrpc_pid
    fi
}

# Executes cleanup function at script exit.
trap cleanup EXIT

if testrpc_running $port; then
    echo "Using existing testrpc instance..."
else
    echo "Starting new testrpc instance..."
    eval ganache-cli "$accounts" -p "$port" > /dev/null &
    testrpc_pid=$! &
fi