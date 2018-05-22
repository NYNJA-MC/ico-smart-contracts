# NYNJA Coin Smart Contracts

![NYNJA Coin](nynja.png)

[NYNJA Coin][nynjaCoin] is an [ERC20][erc20] token built on top of the [Ethereum][ethereum] blockchain that empowers the NYNJA mobile communication app. The NYNJA app combines voice, text and visual messaging with robust business management and e-commerce features. With NYNJACoin, users can exchange freelance services and virtual goods, access exclusive content and earn tokens for sharing and participating in the community.

## Contracts

Please see the [contracts/](truffle/contracts) directory.

## Develop

Contracts are written in [Solidity][solidity] and tested using [Truffle][truffle] and [ganache-cli][ganache-cli].

### Dependencies

```bash
# Install local node dependencies
$ npm install
```

### Test

```bash
# Compile all smart contracts
$ npm run build

# Run all tests
$ npm test

# Run test coverage analysis
$ npm run coverage
```

### Docker

A Docker image to run containerized testing is provided. Requires [Docker Compose][docker compose].

```bash
# Build the container and run all tests
$ make build test

# Run a test for a single contract
$ docker-compose run --rm truffle npm test test/NYNJACoin.test.js
```


[nynjaCoin]: https://nynjacoin.com/
[ethereum]: https://www.ethereum.org/
[erc20]: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md
[solidity]: https://solidity.readthedocs.io/en/develop/
[truffle]: http://truffleframework.com/
[ganache-cli]: https://github.com/trufflesuite/ganache-cli

[docker compose]: https://docs.docker.com/compose/
