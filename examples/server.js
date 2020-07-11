const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8081 });
const AsyncMessageFunctions = require('@anbcodes/channel-to-functions');

let client;

wss.on('connection', async (ws) => {
  console.log('connection');
  // ws.on('message', (data) => {
  //   console.log('Message', data);
  // });
  const clientFunctions = new AsyncMessageFunctions(
    (data) => ws.send(JSON.stringify(data)),
    (func) => { ws.on('message', (data) => func(JSON.parse(data))); },
  );

  clientFunctions.registerLocal('talktoserver', (something) => {
    console.log(`client talked to server saying ${something}`);
    return `success saying ${something}`;
  });

  clientFunctions.registerRemote('dosomethingonclient');

  client = clientFunctions.functions;

  console.log('Returned:  ', await client.dosomethingonclient('something awesome!!!'));
});
