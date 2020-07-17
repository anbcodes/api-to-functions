import { createServerAndClientInstances, promiseTimeout } from './utils';

describe('A promise', () => {
  it('can be returned from a remote function', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', async () => {
      return 'test value'
    })
    expect(client.remoteFunctions.test()).toBeInstanceOf(Promise);
    //TODO: fix this test

  })

  it('can be resolved from a remote function', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', async () => {
      return 'test value'
    })
    await expect(client.remoteFunctions.test()).resolves.toBe('test value');
  })

  it('can be rejected from a remote function', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', async () => {
      throw 'test value'
    })
    await expect(client.remoteFunctions.test()).rejects.toBe('test value');
  })

  
})

describe('A function', () => {
  it('can be returned from a remote function', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', () => {
      return () => 'test value'
    })

    await expect(client.remoteFunctions.test()).resolves.toBeInstanceOf(Function)
  })

  it('can be returned and then called from a remote function', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', () => {
      return () => 'test value'
    })

    const returnValue = await client.remoteFunctions.test()

    await expect(returnValue()).resolves.toBe('test value')
  })

  it('can be sent to a remote function', (done) => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();

    server.register('test', (func) => {
      expect(func).toBeInstanceOf(Function)
      done()
    })

    client.remoteFunctions.test(() => 'test value')
  })

  it('can be sent to a remote function and be called', (done) => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();

    server.register('test', (func) => {
      func().then((value: string) => {
        expect(value).toBe('test value')
        done()
      })
    })

    client.remoteFunctions.test(() => 'test value')
  })

  it('can be returned from a remote function within an object and be called', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();

    server.register('test', () => {
      return {func: () => 'test value'}
    });

    const returnValue = await client.remoteFunctions.test()

    await expect(returnValue.func()).resolves.toBe('test value')
  })

  it('can be sent to a remote function within an object and be called', (done) => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', ({func}) => {
      func().then((value: string) => {
        expect(value).toBe('test value')
        done()
      })
    })

    client.remoteFunctions.test({func: () => 'test value'})
  })
})

describe('A error', () => {
  it('can be thrown from a remote function and be sent back to the client', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', () => {
      throw new Error('failed')
    })
    await expect(client.remoteFunctions.test()).rejects.toThrowError('failed')
  })
})

describe('A remote function', () => {
  it('can be registered', () => {
    expect.assertions(0);
    const { server } = createServerAndClientInstances();
    server.register('test', () => 'test value')
  })

  it('can return a value', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    server.register('test', () => 'test value')
    await expect(client.remoteFunctions.test()).resolves.toBe('test value')
  })

  it('can be called before it is registered', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances();
    const promise = promiseTimeout(100).then(() => {
      server.register('test', () => 'test value')
    })
    await expect(client.remoteFunctions.test()).resolves.toBe('test value')
    await promise
  })

  it('will not be called and instead throw an error if it is not registered before the specifed timeout', async () => {
    expect.assertions(1);
    const { server, client } = createServerAndClientInstances(100);
    const promise = promiseTimeout(200).then(() => {
      server.register('test', () => 'test value')
    })
    await expect(client.remoteFunctions.test()).rejects.toThrowError('Timeout reached')
    await promise
  })
})