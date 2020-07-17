interface PromiseInfo {
  resolve: (a?: any) => void
  reject: (a?: any) => void
}

interface SimpleError {
  name: string
  message: string
}

interface RunMessage {
  args: any[]
  name: string
  id: number
  type: "RunMessage"
}

interface ReturnMessage {
  error?: SimpleError
  value?: any
  id: number
  type: "ReturnMessage"
}



type messageID = number
type Dictionary<K extends keyof any, T> = Partial<Record<K, T>>
type AnyFunction = (...args: any[]) => any
type ObjectKey = string | number | symbol
type Message = RunMessage | ReturnMessage
type functionName = string

function match<Type extends {type: ObjectKey},ReturnType>(pattern: Pattern<ReturnType, Type>): (type: Type) => Promise<ReturnType> {
  return async (type) => {
    return await pattern[type.type as Type["type"]](type as any)
  }
}
type TypeMap<U extends {type: ObjectKey}> = {
  [K in U["type"]]: U extends {type: K} ? U : never
}

type Pattern<T, U extends {type: ObjectKey}> = {
  [K in keyof TypeMap<U>]: (type: TypeMap<U>[K]) => T
}


/**
 * A class which provides a way to create an api through methods.
 */
export default class ApiToFunctions<Api = Record<string, AnyFunction>> {
  remoteFunctions: Api
  localFunctions: Dictionary<string, AnyFunction>
  listenersForFunctionRegistration: Dictionary<functionName, PromiseInfo[]>
  pendingRequests: Dictionary<messageID, PromiseInfo>

  /**
   * 
   * @param sendMessage a function which the class calls to send data to the server (The data is not a string)
   * @param addMessageListener a function which the class calls with a function as an argument to register a listener for messages.
   * @param timeout the amount of time the handler should wait for a function to be registered before returning an error
   */
  constructor(private sendMessage: (d: Message) => void, private addMessageListener: (func: AnyFunction) => void, public timeout = 5000) {
    this.remoteFunctions = new Proxy({}, {get: this.onRemoteFunctionRequest.bind(this)}) as Api
    this.localFunctions = {}
    this.listenersForFunctionRegistration = {}
    this.pendingRequests = {}
    this.createListener()
  }

  private onRemoteFunctionRequest(target: any, prop: ObjectKey, receiver: any): (...args: any[]) => Promise<any> {
    if (typeof prop === 'string') {
      return (...args) => this.runRemoteFunction(prop, args)
    } else {
      return Reflect.get(target, prop, receiver)
    }
  }

  private runRemoteFunction(name: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const safeArgs = this.replaceFunctionsWithTemplateAndRegisterThem(args, id).map((v: any) => v instanceof Error ? {message: v.message, name: v.name, __ISERROR__: true} : v);
      this.pendingRequests[id] = {resolve, reject};
      this.sendMessage({args: safeArgs, name, id, type: 'RunMessage'})
    });
  }

  private replaceFunctionsWithTemplateAndRegisterThem(data: any, id: messageID): any {
    return this.replaceMatchesWithValue(data, (d) => typeof d === 'function', (key, func) => {
      this.register(`${key}-+-${id}`, func)
      return {__REMOTECALL__: true, __KEY__:key, __ID__: id}
    })
  }

  private replaceTemplateWithFunction(data: any, id: messageID): any {
    return this.replaceMatchesWithValue(data, (d) => d?.__REMOTECALL__, (key) => (...args: any[]) => this.runRemoteFunction(`${key}-+-${id}`, args))
  }

  private replaceMatchesWithValue(data: any, matcher: (d: any) => boolean, replacer: (key: string, currentData: any) => any, prefix = ''): any {
    if (matcher(data)) {
      data = replacer(prefix, data)
    } else if (typeof data === 'object') {
      Object.keys(data).forEach(key => {
        data[key] = this.replaceMatchesWithValue(data[key], matcher, replacer, prefix + key + '.')
      })
    }

    return data
  }

  private onReturnMessage({value, error, id}: ReturnMessage) {
    if (error) {
      const e = new Error(error.message)
      e.name = error.name
      this.pendingRequests[id]?.reject(e)
    } else if (value?.__RETURNTYPE__ === 'promise') {
      this.pendingRequests[id]?.resolve(new Promise((resolve, reject) => {
        this.register(`${id}-+-resolve`, resolve);
        this.register(`${id}-+-reject`, reject);
      }))
    } else {
      const replacedValue = this.replaceTemplateWithFunction(value, id);
      this.pendingRequests[id]?.resolve(replacedValue)
    }
  }

  private objToError(obj: SimpleError): Error {
    const e = new Error(obj.message);
    e.name = obj.name;
    return e
  }

  private async onRunMessage({ args, name, id }: RunMessage) {
    const replacedArgs = this.replaceTemplateWithFunction(args, id).map((v: any) => v.message && v.name && v.__ISERROR__ ? this.objToError(v) : v);
    let returnValue;
    try {
      await (new Promise((resolve, reject) => {
        if (!this.localFunctions[name]) {
          const listeners = this.listenersForFunctionRegistration[name]
          if (!listeners) {
            this.listenersForFunctionRegistration[name] = [{resolve, reject}]
          } else {
            listeners.push({resolve, reject})
          }
        } else {
          resolve()
        }

        setTimeout(() => {
          reject(new Error('Timeout reached'))
        }, this.timeout)
      }))
      returnValue = this.localFunctions[name]?.(...replacedArgs)
    } catch (e) {
      const simpleError: SimpleError = {name: e.name, message: e.message}
      this.sendMessage({error: simpleError, id, type: 'ReturnMessage'})
      return
    }
    if (returnValue instanceof Promise) {
      //@ts-ignore
      returnValue.then((d) => this.remoteFunctions[`${id}-+-resolve`](d), (d) => this.remoteFunctions[`${id}-+-reject`](d))
      this.sendMessage({value: {__RETURNTYPE__: 'promise'}, id, type: 'ReturnMessage'})
    } else {
      const safeReturnValue = this.replaceFunctionsWithTemplateAndRegisterThem(returnValue, id);
      this.sendMessage({value: safeReturnValue, id, type: 'ReturnMessage'})
    }
    
  }

  private createListener() {
    this.addMessageListener(match<Message, void>({
      ReturnMessage: this.onReturnMessage.bind(this),
      RunMessage: this.onRunMessage.bind(this),
    }))
  }

  /**
   * @description Registers a function from the client which can then be called on the server
   * @param name string
   * @param func AnyFunction
   */
  public register(name: string, func: AnyFunction): void {
    this.localFunctions[name] = func;
    const listeners = this.listenersForFunctionRegistration[name];
    if (listeners) {
      listeners.forEach(listener => {
        listener.resolve()
      });
    }
  }
}