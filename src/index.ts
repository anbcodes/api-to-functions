interface RequestMessage {
  name: string,
  args: any[],
  id: number,
  type: "RequestMessage",
}

type returnValue = any;

interface ReturnMessage {
  value: Error | returnValue,
  id: number,
  type: "ReturnMessage"
}

interface RegisterMessage {
  name: string,
  id: number,
  type: "RegisterMessage"
}

interface RegisterSuccessMessage {
  id: number,
  type: "RegisterSuccessMessage",
}

type Message = ReturnMessage | RequestMessage | RegisterMessage | RegisterSuccessMessage;

type TypeMap<U extends {type: ObjectKey}> = {
  [K in U["type"]]: U extends {type: K} ? U : never
}

type Pattern<T, U extends {type: ObjectKey}> = {
  [K in keyof TypeMap<U>]: (type: TypeMap<U>[K]) => T
}

type ObjectKey = string | number | symbol

function match<Type extends {type: ObjectKey},ReturnType>(pattern: Pattern<ReturnType, Type>): (type: Type) => ReturnType {
  return (type) => {
    return pattern[type.type as Type["type"]](type as any)
  }
}


export default class AsyncMessagesToFunctions<ApiType> {
  waiting: Record<string, any>

  functions: ApiType

  constructor(
    private requestFunction: (message: Message) => void,
    private addListener: (func: (message: Message) => void) => void,
  ) {
    this.waiting = {};
    this.functions = {} as ApiType;
    this.createListener();
  }
  /**
   * @description Registers a function from the client which can then be called on the server
   * @param name string
   * @param func any
   */
  register(name: string, func: any): Promise<undefined> {
    return new Promise((resolve, reject) => {
      //@ts-ignore
      this.functions[name] = func;
      const id = Math.random();
      this.waiting[id] = {resolve, reject};
      this.requestFunction({ name, id, type: 'RegisterMessage' });
    })
  }

  private createListener(): void {
    this.addListener(match<Message, void>({
      ReturnMessage: ({ id, value }) => {
        if (value instanceof Error) {
          this.waiting[id].reject(value);
        } else {
          this.waiting[id].resolve(value);
        }
        delete this.waiting[id];
      },
      RequestMessage: ({ id, name, args }) => {
        let returnValue;
        try {
          //@ts-ignore
          returnValue = this.functions[name](...args);
        } catch (e) {
          this.requestFunction({ value: e, id, type: 'ReturnMessage' });
        }
        this.requestFunction({ value: returnValue, id, type: 'ReturnMessage' });
      },
      RegisterMessage: ({ name, id }) => {
        //@ts-ignore
        this.functions[name] = (...args: any[]) => new Promise((resolve, reject) => {
          const id: number = Math.random();
          this.waiting[id] = { resolve, reject };
          this.requestFunction({ name, args, id, type: 'RequestMessage' });
        });
        this.requestFunction({ id, type: 'RegisterSuccessMessage' });
      },
      RegisterSuccessMessage: ({ id }) => {
        this.waiting[id].resolve();
        delete this.waiting[id];
      }
    }).bind(this));
  }
};
