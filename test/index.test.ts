import AsyncMessagesToFunctions from '../src/index';

let clientReceiver: (d: any) => void;

const serverSender = (d: any) => clientReceiver(d);
let serverReceiver: (d: any) => void;
const clientSender = (d: any) => serverReceiver(d);

type AnyFunction = (...args: any[]) => any

function promiseTimeout(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  })
}


interface ServerClientInstances<ClientApi, ServerApi> {
  clientMessagesInstance: AsyncMessagesToFunctions<ClientApi>,
  serverMessagesInstance: AsyncMessagesToFunctions<ServerApi>,
}

function createInstances<ClientApi, ServerApi>(timeout?: number): ServerClientInstances<ClientApi, ServerApi> {
  return {
    clientMessagesInstance: new AsyncMessagesToFunctions<ClientApi>(
      clientSender,
      (func) => clientReceiver = (d) => func(JSON.parse(JSON.stringify(d))),
      timeout,
    ),
    serverMessagesInstance: new AsyncMessagesToFunctions<ServerApi>(
      serverSender,
      (func) => serverReceiver = (d) => func(JSON.parse(JSON.stringify(d))),
      timeout,
    ),
  };
}

test('Client can register a function', async () => {
  type ClientApi = Record<string, AnyFunction>
  interface ServerApi {
    ping: () => string
  }
  const { clientMessagesInstance } = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => 'pong');
});

test('Client can register a function and the server can call it and get a return value', async () => {
  type ClientApi = Record<string, AnyFunction>
  interface ServerApi {
    ping: () => string
  }
  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => 'pong');
  expect(await serverMessagesInstance.functions.ping()).toBe('pong');
});

test('Client can throw an error and the server will receive it', async () => {
  type ClientApi = Record<string, AnyFunction>
  interface ServerApi {
    ping: () => Promise<string>
  }
  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => { throw new Error('pong'); });
  await expect(serverMessagesInstance.functions.ping()).rejects.toThrow('pong');
});

test('Server and client can register a function', async () => {
  interface ClientApi {
    sping: () => string
  }
  interface ServerApi {
    cping: () => string
  }
  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('cping', () => 'cpong');
  await serverMessagesInstance.register('sping', () => 'spong');
});

test('Server and client can call each other\'s a functions', async () => {
  interface ClientApi {
    sping: () => string
  }
  interface ServerApi {
    cping: () => string
  }
  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('cping', () => 'cpong');
  await serverMessagesInstance.register('sping', () => 'spong');
  expect(await serverMessagesInstance.functions.cping()).toBe('cpong');
  expect(await clientMessagesInstance.functions.sping()).toBe('spong');
});

test('Client can call a server function before it is registered', async () => {
  interface ClientApi {
    ping: () => string
  }
  type ServerApi = Record<string, AnyFunction>

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  const promise = promiseTimeout(500).then(() => {
    serverMessagesInstance.register('ping', () => 'cpong');
  });
  await expect(clientMessagesInstance.functions.ping()).resolves.toBe('cpong');
  await promise
});

test('If a client calls a server function and it is not registered after n milliseconds it errors', async () => {
  expect.assertions(1);
  interface ClientApi {
    mping: () => Promise<string>
  }
  type ServerApi = Record<string, AnyFunction>

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>(250);
  const promise = promiseTimeout(500).then(() => {
    serverMessagesInstance.register('mping', () => 'pong');
  })
  await expect(clientMessagesInstance.functions.mping()).rejects.toThrow('Timeout reached')
  await promise
});


test('Server can return a function and the client can call it.', async () => {
  expect.assertions(2);
  type ClientApi = Record<string, AnyFunction>

  type ServerApi = Record<string, AnyFunction>

  const end = (name: string) => {
    expect(name).toBe('myName')
    return `Hello ${name}`
  }

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  serverMessagesInstance.register('getFunc', () => end)
  const func = await clientMessagesInstance.functions.getFunc()

  await expect(func('myName')).resolves.toBe('Hello myName')
})

test('Server can return an object with a function and the client can call it.', async () => {
  expect.assertions(2);
  type ClientApi = Record<string, AnyFunction>

  type ServerApi = Record<string, AnyFunction>

  const end = (name: string) => {
    expect(name).toBe('myName')
    return `Hello ${name}`
  }

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  serverMessagesInstance.register('getFunc', () => ({end}))
  const ret = await clientMessagesInstance.functions.getFunc()

  await expect(ret.end('myName')).resolves.toBe('Hello myName')
})