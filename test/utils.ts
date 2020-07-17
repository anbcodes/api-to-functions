import AsyncMessagesToFunctions from '../src/index';

let clientReceiver: (d: any) => void;

const serverSender = (d: any) => clientReceiver(d);
let serverReceiver: (d: any) => void;
const clientSender = (d: any) => serverReceiver(d);

export type AnyFunction = (...args: any[]) => any

export function promiseTimeout(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  })
}


interface ServerClientInstances {
  client: AsyncMessagesToFunctions,
  server: AsyncMessagesToFunctions,
}

export function createServerAndClientInstances(timeout?: number): ServerClientInstances {
  return {
    client: new AsyncMessagesToFunctions(
      clientSender,
      (func) => clientReceiver = (d) => {
        // console.log('client', d) // For debugging
        func(JSON.parse(JSON.stringify(d)))
      },
      timeout,
    ),
    server: new AsyncMessagesToFunctions(
      serverSender,
      (func) => serverReceiver = (d) => {
        // console.log('server', d) // For debugging
        func(JSON.parse(JSON.stringify(d)))
      },
      timeout,
    ),
  };
}