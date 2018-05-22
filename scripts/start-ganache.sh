#!/usr/bin/env bash

set -a
. scripts/test.env
set +a

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

ganache_port=8545
seconds_wait=3

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