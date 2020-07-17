# API To Functions

This package allows you to declare an api and then will wrap it in functions.

## Examples

A simple example using (node) websockets from examples/ws

> Note: API To Functions has no server/client module but websockets does which is why there is a server/client.js file (the client can also register functions)

`client.js`
```js
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
```

`server.js`
```js
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
```

Client output
```
> node client.js
serverLog: An awesome value!!!
Returned: success An awesome value for the server!!!
```

Server output
```
> node server.js
connection
clientlog: An awesome value for the server!!!
Client Returned:   success An awesome value!!!
```

> Note: `require(...).default` is required for nodejs

## Typescript

This library is written in typescript. It also supports setting a interface as the type of the remote api as in this example (examples/typescript)

```ts
/* A typescript type checking example. This is NOT a working example */
import ApiToFunctions from '@anbcodes/api-to-functions'

interface RemoteAPI {
  exampleFunction: (data: string) => Promise<string>
}

const placeholderFunction = () => ''

const apiCreator = new ApiToFunctions<RemoteAPI>(placeholderFunction, placeholderFunction)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const remoteApi = apiCreator.remoteFunctions

// remoteApi now has the type of RemoteAPI for things like autocompletion
```

## Documentation

### `ApiToFunctions`

A class which provides a way to create an api through methods.

<h4> Parameters </h4>

* `sendMessage`: a function which the class calls to send data to the server (The data is not a string)
* `addMessageListener`: a function which the class calls with a function as an argument to register a listener for messages.
* `timeout`: the amount of time the handler should wait for a function to be registered before returning an error

### `ApiToFunctions.register`

Registers a function from the client which can then be called on the server

<h4> Parameters </h4>

* `name`: the name of the function
* `func`: the function to register
