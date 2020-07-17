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
      (func) => clientReceiver = (d) => {
        // console.log('client', d) // For debugging
        func(JSON.parse(JSON.stringify(d)))
      },
      timeout,
    ),
    serverMessagesInstance: new AsyncMessagesToFunctions<ServerApi>(
      serverSender,
      (func) => serverReceiver = (d) => {
        // console.log('server', d) // For debugging
        func(JSON.parse(JSON.stringify(d)))
      },
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
  expect(await serverMessagesInstance.remoteFunctions.ping()).toBe('pong');
});

test('Client can throw an error and the server will receive it', async () => {
  type ClientApi = Record<string, AnyFunction>
  interface ServerApi {
    ping: () => Promise<string>
  }
  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  await clientMessagesInstance.register('ping', () => { throw new Error('pong'); });
  await expect(serverMessagesInstance.remoteFunctions.ping()).rejects.toThrow('pong');
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
  expect(await serverMessagesInstance.remoteFunctions.cping()).toBe('cpong');
  expect(await clientMessagesInstance.remoteFunctions.sping()).toBe('spong');
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
  await expect(clientMessagesInstance.remoteFunctions.ping()).resolves.toBe('cpong');
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
  await expect(clientMessagesInstance.remoteFunctions.mping()).rejects.toThrow('Timeout reached')
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
  const func = await clientMessagesInstance.remoteFunctions.getFunc()

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
  const ret = await clientMessagesInstance.remoteFunctions.getFunc()

  await expect(ret.end('myName')).resolves.toBe('Hello myName')
})


test('Client can send a function and the server can call it.', async (done) => {
  expect.assertions(1);
  type ClientApi = Record<string, AnyFunction>

  type ServerApi = Record<string, AnyFunction>

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  serverMessagesInstance.register('getFunc', (getName: any) => {
    getName().then((name: string) => {
      expect(name).toBe('Hey!!')
      done()
    })
  })
  await clientMessagesInstance.remoteFunctions.getFunc(() => 'Hey!!')
})

test('Client can send an object with a function and the server can call it.', async (done) => {
  expect.assertions(1);
  type ClientApi = Record<string, AnyFunction>

  type ServerApi = Record<string, AnyFunction>

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  serverMessagesInstance.register('getFunc', ({getName}) => {
    getName().then((name: string) => {
      expect(name).toBe('Hey!!')
      done()
    })
  })
  await clientMessagesInstance.remoteFunctions.getFunc({ getName: () => 'Hey!!' })
})

test('Client can send a function and the server can call it and return a promise.', async () => {
  expect.assertions(1);
  type ClientApi = Record<string, AnyFunction>

  type ServerApi = Record<string, AnyFunction>

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  serverMessagesInstance.register('runFunc', async (getName: any) => {
    const name = await getName()
    return `Hello ${name}`
  })
  await expect(clientMessagesInstance.remoteFunctions.runFunc(() => 'Hey!!')).resolves.toBe('Hello Hey!!')
})

test('Client can send a function within a object and the server can call it and return a promise.', async () => {
  expect.assertions(1);
  type ClientApi = Record<string, AnyFunction>

  type ServerApi = Record<string, AnyFunction>

  const { clientMessagesInstance, serverMessagesInstance } = createInstances<ClientApi, ServerApi>();
  serverMessagesInstance.register('runFunc', async ({getName}) => {
    const name = await getName()
    return `Hello ${name}`
  })
  await expect(clientMessagesInstance.remoteFunctions.runFunc({getName: () => 'Hey!!'})).resolves.toBe('Hello Hey!!')
})