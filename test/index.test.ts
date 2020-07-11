import AsyncMessagesToFunctions from '../src/index';

let serverSender = (d: any) => clientReceiver(d);
let serverReceiver: (d: any) => void;
let clientSender = (d: any) => serverReceiver(d);
let clientReceiver: (d: any) => void;

interface ServerClientInstances<ClientApi, ServerApi> {
  clientMessagesInstance: AsyncMessagesToFunctions<ClientApi>,
  serverMessagesInstance: AsyncMessagesToFunctions<ServerApi>,
}

function createInstances<ClientApi, ServerApi>(): ServerClientInstances<ClientApi, ServerApi> {
  return {
    clientMessagesInstance: new AsyncMessagesToFunctions<ClientApi>(
      clientSender,
      (func) => clientReceiver = func,
    ),
    serverMessagesInstance: new AsyncMessagesToFunctions<ServerApi>(
      serverSender,
      (func) => serverReceiver = func,
    )
  }
};

test('Client can register a function', async () => {
  type ClientApi = Record<string, Function>
  interface ServerApi {
    ping: () => string
  }
  const {clientMessagesInstance} = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => 'pong');
})

test('Client can register a function and the server can call it and get a return value', async () => {
  type ClientApi = Record<string, Function>
  interface ServerApi {
    ping: () => string
  }
  const {clientMessagesInstance, serverMessagesInstance} = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => 'pong');
  expect(await serverMessagesInstance.functions.ping()).toBe('pong');
})

test('Client can throw an error and the server will receive it', async () => {
  type ClientApi = Record<string, Function>
  interface ServerApi {
    ping: () => string
  }
  const {clientMessagesInstance, serverMessagesInstance} = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => { throw new Error('pong'); });
  expect(serverMessagesInstance.functions.ping()).rejects.toThrow('pong');
})

test('Server and client can register a function', async () => {
  interface ClientApi {
    sping: () => string
  }
  interface ServerApi {
    cping: () => string
  }
  const {clientMessagesInstance, serverMessagesInstance} = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('cping', () => 'cpong');
  await serverMessagesInstance.register('sping', () => 'spong');
})

test('Server and client can call each other\'s a functions', async () => {
  interface ClientApi {
    sping: () => string
  }
  interface ServerApi {
    /**
     * @description pings the client.
     */
    cping: () => string
  }
  const {clientMessagesInstance, serverMessagesInstance} = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('cping', () => 'cpong');
  await serverMessagesInstance.register('sping', () => 'spong');
  expect(await serverMessagesInstance.functions.cping()).toBe('cpong');
  expect(await clientMessagesInstance.functions.sping()).toBe('spong');
})