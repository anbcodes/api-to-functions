const WebSocket = require('ws');
const AsyncMessageFunctions = require('@anbcodes/channel-to-functions');

const ws = new WebSocket('ws://localhost:8081');

ws.on('open', async () => {
  const serverFunctions = new AsyncMessageFunctions(
    (data) => ws.send(JSON.stringify(data)),
    (func) => { ws.on('message', (data) => func(JSON.parse(data))); },
  );

  serverFunctions.registerLocal('dosomethingonclient', (something) => {
    console.log(`client did ${something}`);
    return `success doing ${something}`;
  });

  serverFunctions.registerRemote('talktoserver');

  const server = serverFunctions.functions;

  // Real code

  console.log('Returned', await server.talktoserver('Hey server'));
});
