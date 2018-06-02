FROM node:8

RUN apt-get -qq update \
    && apt-get -qq install netcat \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN mkdir /code
WORKDIR /code

COPY package.json package-lock.json ./

RUN npm i

ENV PATH="/code/node_modules/.bin:${PATH}"

COPY ./truffle/ ./truffle/
COPY ./scripts/ ./scripts/

RUN bash scripts/build.sh

COPY ./.babelrc ./

RUN babel ./truffle/test --out-dir ./truffle/test.out \
  && rm -rf ./truffle/test \
  && mv ./truffle/test.out ./truffle/test

EXPOSE 8545

CMD ["truffle"]
