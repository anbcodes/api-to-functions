interface RequestMessage {
  name: string,
  args: any[],
  id: number,
  type: "RequestMessage",
}

type AnyFunction = (...args: any[]) => any

type returnValue = any;

interface ReturnMessage {
  value: Error | returnValue,
  id: number,
  type: "ReturnMessage"
}

// interface RegisterMessage {
//   name: string,
//   id: number,
//   type: "RegisterMessage"
// }

// interface RegisterSuccessMessage {
//   id: number,
//   type: "RegisterSuccessMessage",
// }

// type Message = ReturnMessage | RequestMessage | RegisterMessage | RegisterSuccessMessage;
type Message = ReturnMessage | RequestMessage;

type TypeMap<U extends {type: ObjectKey}> = {
  [K in U["type"]]: U extends {type: K} ? U : never
}

type Pattern<T, U extends {type: ObjectKey}> = {
  [K in keyof TypeMap<U>]: (type: TypeMap<U>[K]) => T
}

type ObjectKey = string | number | symbol

function match<Type extends {type: ObjectKey},ReturnType>(pattern: Pattern<ReturnType, Type>): (type: Type) => Promise<ReturnType> {
  return async (type) => {
    return await pattern[type.type as Type["type"]](type as any)
  }
}

type Dictionary<K extends keyof any, T> = Partial<Record<K, T>>


export default class AsyncMessagesToFunctions<ApiType = Dictionary<string,AnyFunction>> {
  waiting: Dictionary<string, any>
  waitersForFunctions: Dictionary<string,Dictionary<string,AnyFunction>[]>

  functions: ApiType

  pid: number

  private localFunctions: Dictionary<string, any>

  constructor(
    private requestFunction: (message: Message) => void,
    private addListener: (func: (message: Message) => void) => void,
    public timeout: number = 5000,
  ) {
    this.pid = 0;
    this.waiting = {};
    this.waitersForFunctions = {};
    this.functions = new Proxy({}, {
      get: (target, property, receiver) => {
        if (typeof property === 'string') {
          return (...args: any[]) => this.sendRequestMessage(property, args)
        } else {
          return Reflect.get(target, property, receiver);
        }
      }
    }) as ApiType;
    this.localFunctions = {};
    this.createListener();
  }
  /**
   * @description Registers a function from the client which can then be called on the server
   * @param name string
   * @param func AnyFunction
   */
  register(name: string, func: AnyFunction): void {
    this.localFunctions[name] = func;
    const waiters = this.waitersForFunctions[name];
    if (waiters) {
      waiters.forEach(waiter => {
        waiter.resolve?.()
      });
    }
  }

  sendRequestMessage(name: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id: number = Math.random();
      this.waiting[id] = { resolve, reject };
      this.requestFunction({ name, args, id, type: 'RequestMessage' });
    }) 
  }

  private createListener(): void {
    this.addListener(match<Message, void>({
      ReturnMessage: ({ id, value }) => {
        try {
          if (value instanceof Error) {
            this.waiting[id].reject(value);
          } else {
            this.waiting[id].resolve(value);
          }
          delete this.waiting[id];
        } catch (e) {
          throw e
        }
        this.pid = id;
        

      },
      RequestMessage: async ({ id, name, args }) => {
        let returnValue;
        let promiseFinished = false;
        try {
          await (new Promise((resolve, reject) => {
            //@ts-ignore
            if (!this.localFunctions[name]) {
              let waiter = this.waitersForFunctions[name]
              if (waiter === undefined) {
                this.waitersForFunctions[name] = [] as Dictionary<string,AnyFunction>[];
              }
              waiter = this.waitersForFunctions[name]
              if (waiter !== undefined) {
                waiter.push({resolve, reject})
              }
            } else {
              if (!promiseFinished) {
                resolve()
                promiseFinished = true;
              }
            }
  
            setTimeout(() => {
              if (!promiseFinished) {
                reject(new Error('Timeout reached'))
                promiseFinished = true;
              }
            }, this.timeout)
          }))
          //@ts-ignore
          returnValue = this.localFunctions[name](...args);
        } catch (e) {
          this.requestFunction({ value: e, id, type: 'ReturnMessage' });
          return
        }
        this.requestFunction({ value: returnValue, id, type: 'ReturnMessage' });
      },
      // RegisterMessage: ({ name, id }) => {
      //   //@ts-ignore
      //   this.functions[name] = (...args: any[]) => new Promise((resolve, reject) => {
      //     const id: number = Math.random();
      //     this.waiting[id] = { resolve, reject };
      //     this.requestFunction({ name, args, id, type: 'RequestMessage' });
      //   });
      //   this.requestFunction({ id, type: 'RegisterSuccessMessage' });
      //   let waiters = this.waitersForFunctions[name]
      //   if (waiters) {
      //     waiters.forEach((waiter) => {
      //       if (waiter.resolve) {
      //         waiter.resolve()
      //       }
      //     })
      //   }
      // },
      // RegisterSuccessMessage: ({ id }) => {
      //   this.waiting[id].resolve();
      //   delete this.waiting[id];
      // }
    }).bind(this));
  }
}
