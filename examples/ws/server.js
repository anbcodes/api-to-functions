/* eslint-disable @typescript-eslint/no-var-requires */
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8081 });
const ApiToFunctions = require('@anbcodes/api-to-functions').default;
wss.on('connection', async (ws) => {
  console.log('connection');

  const ServerApiCreator = new ApiToFunctions(
    (data) => ws.send(JSON.stringify(data)), // The function API To Functions uses to send data
    (func) => { ws.on('message', (data) => func(JSON.parse(data))); } // The function API To Functions uses to register a listener for the data,
  );

  ServerApiCreator.register('logOnServer', (value) => { // Register a function for the client to call in client.js
    console.log(`clientlog: ${value}`);
    return `success ${value}`;
  });

  clientApi = ServerApiCreator.remoteFunctions; // The api which the client created in client.js

  console.log('Client Returned:  ', await clientApi.logOnClient('An awesome value!!!'));
});