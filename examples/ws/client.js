/* eslint-disable @typescript-eslint/no-var-requires */
const WebSocket = require('ws');
const ApiToFunctions = require('@anbcodes/api-to-functions').default;
const ws = new WebSocket('ws://localhost:8081');
ws.on('open', async () => {
  const clientApiCreator = new ApiToFunctions(
    (data) => ws.send(JSON.stringify(data)), // The function API To Functions uses to send data
    (func) => { ws.on('message', (data) => func(JSON.parse(data))); }, // The function API To Functions uses to register a listener for the data
  );

  clientApiCreator.register('logOnClient', (value) => {
    console.log(`serverLog: ${value}`);
    return `success ${value}`;
  });

  const serverApi = clientApiCreator.remoteFunctions; // The Api the server created in server.js

  console.log('Returned:', await serverApi.logOnServer('An awesome value for the server!!!'));
});