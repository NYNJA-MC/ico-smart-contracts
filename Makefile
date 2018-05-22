
default: ;
.DEFAULT_GOAL: default

run_truffle := docker-compose run --rm truffle

compile:
	$(run_truffle) truffle compile
.PHONY: compile

test:
	$(run_truffle) npm test
.PHONY: test

migrate:
	$(run_truffle) truffle migrate
.PHONY: migrate

build:
	docker-compose build
.PHONY: build

log:
	docker-compose logs
.PHONY: log

sh:
	$(run_truffle) sh
.PHONY: sh

down:
	docker-compose down -v
.PHONY: down

clean: down
	docker-compose down --rmi all
.PHONY: clean
