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

type Message = ReturnMessage | RequestMessage;

type TypeMap<U extends {type: ObjectKey}> = {
  [K in U["type"]]: U extends {type: K} ? U : never
}

type Pattern<T, U extends {type: ObjectKey}> = {
  [K in keyof TypeMap<U>]: (type: TypeMap<U>[K]) => T
}

type ObjectKey = string | number | symbol

function match<Type extends {type: ObjectKey},ReturnType>(pattern: Pattern<ReturnType, Type>): (type: Type) => ReturnType {
  return (type) => pattern[type.type as Type["type"]](type as any)
}

type Obj<T> = Record<string, T>

module.exports = class AsyncMessagesToFunctions {
  waiting: Record<string, any>

  functions: Record<string, any>

  constructor(
    private requestFunction: (message: Message) => void,
    private addListener: (func: (message: Message) => void) => void,
  ) {
    this.waiting = {};
    this.functions = {};
    this.createListener();
  }

  registerRemote(name: string) {
    this.functions[name] = (...args: any[]) => new Promise((resolve, reject) => {
      const id: number = Math.random();
      this.waiting[id] = { resolve, reject };
      this.requestFunction({ name, args, id } as RequestMessage);
    });
  }

  registerLocal(name: string, func: any) {
    this.functions[name] = func;
  }

  private createListener() {
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
          returnValue = this.functions[name](...args);
        } catch (e) {
          this.requestFunction({ value: e, id } as ReturnMessage);
        }
        this.requestFunction({ value: returnValue, id } as ReturnMessage);
      }
    }).bind(this));
  }
};
