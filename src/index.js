module.exports = class AsyncMessagesToFunctions {
  constructor(requestFunction, initListener) {
    this.requestFunction = requestFunction;
    this.listenerCreator = initListener;
    this.waiting = {};
    this.functions = {};
    this.initListener();
  }

  registerRemote(name) {
    this.functions[name] = (...args) => new Promise((resolve, reject) => {
      const id = Math.random();
      this.waiting[id] = { resolve, reject };
      this.requestFunction({ type: 'request', options: { name, args, id } });
    });
  }

  registerLocal(name, func) {
    this.functions[name] = func;
  }

  initListener() {
    this.listenerCreator((...args) => {
      const { type, options } = args[0];
      if (type === 'return') {
        const { id, errorValue, returnValue } = options;
        if (errorValue) {
          this.waiting[id].reject(errorValue);
        }
        this.waiting[id].resolve(returnValue);
        delete this.waiting[id];
      } else if (type === 'request') {
        const { id, name } = options;
        const remoteArgs = options.args;
        let returnValue;
        try {
          returnValue = this.functions[name](...remoteArgs);
        } catch (e) {
          this.requestFunction({ type: 'return', options: { errorValue: e, returnValue, id } });
        }
        this.requestFunction({ type: 'return', options: { errorValue: '', returnValue, id } });
      }
    });
  }
};
