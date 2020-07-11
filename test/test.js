const AsyncMessagesToFunctions = require('@anbcodes/api-to-functions');

let onResponse1;
let onResponse2;

const testRequest1Function = (data) => {
  onResponse2(data);
};

const testRequest2Function = (data) => {
  onResponse1(data);
};

const proxy1 = new AsyncMessagesToFunctions(
  testRequest1Function,
  (func) => { onResponse1 = func; },
);
proxy1.registerLocal('printCool', (name) => {
  console.log('Cool ', name);
  return `Cool Return ${name}`;
});

proxy1.registerRemote('printWow');

const proxy2 = new AsyncMessagesToFunctions(
  testRequest2Function,
  (func) => { onResponse2 = func; },
);

proxy2.registerLocal('printWow', (name) => {
  console.log('Wow ', name);
  return `Wow Return ${name}`;
});

proxy2.registerRemote('printCool');

const run = async () => {
  console.log('proxy1', await proxy1.functions.printWow('Proxy 1'));
  console.log('proxy2', await proxy2.functions.printCool('Proxy 2'));
};

run();
