'use strict';

let id = 0;

function callAnyOnce(fn1, fn2, context) {
  let group
  let wrapper = fn => value => {
    if (!group.anyCalled) {
      group.anyCalled = true
      return fn.call(context, value)
    }
  }

  group = {
    fn1: wrapper(fn1),
    fn2: wrapper(fn2),
    anyCalled: false
  }

  return group
}

function getThenFromPromise(promise) {
  return promise && (typeof promise === 'object' || typeof promise === 'function') && promise.then;
}

class Promise {
  constructor(func) {
    this.id = ++id
    this.deferreds = [];
    this.value = undefined;
    this.onFulfill = undefined;
    this.onRejected = undefined;
    this.status = 'pending';
    let { fn1: resolve, fn2: reject } = callAnyOnce(this._resolvePromise, this._rejectPromise, this)
    func(resolve, reject)
  }

  then(onFulfill, onRejected) {
    let deferred = Promise.deferred();
    let promise = deferred.promise;

    if (typeof onFulfill === 'function') {
      promise.onFulfill = onFulfill;
    }

    if (typeof onRejected === 'function') {
      promise.onRejected = onRejected;
    }

    this.deferreds.push(deferred);

    this._triggerHandlersForCurrentStatus();

    return deferred.promise;
  }

  _triggerHandlersForCurrentStatus() {
    if (this.status === 'pending') {
      return
    }

    setImmediate(() => {
      while (this.deferreds.length) {
        let deferred = this.deferreds.shift();
        let handler = this.status === 'resolved' ? deferred.promise.onFulfill : deferred.promise.onRejected;

        if (handler) {
          try {
            let result = handler(this.value);
            deferred.resolve(result);
          } catch (error) {
            deferred.reject(error);
          }
        } else {
          if (this.status === 'resolved') {
            deferred.resolve(this.value);
          } else {
            deferred.reject(this.value);
          }
        }
      }
    });
  }

  _resolvePromise(value) {
    if (value === this) {
      this._rejectPromise(new TypeError('Chaining cycle detected'))
      return
    }

    let group = callAnyOnce(this._resolvePromise, this._rejectPromise, this)

    try {
      let then = getThenFromPromise(value)
      if (typeof then === 'function') {
        then.call(value, group.fn1, group.fn2);
      } else {
        this.value = value;
        this.status = 'resolved';
        this._triggerHandlersForCurrentStatus();
      }
    } catch (error) {
      if (this.status === 'pending' && !group.anyCalled) {
        this._rejectPromise(error);
      }
    }
  }

  _rejectPromise(value) {
    if (value === this) {
      this._rejectPromise(new TypeError('Chaining cycle detected'))
      return
    }

    this.value = value;
    this.status = 'rejected';
    this._triggerHandlersForCurrentStatus();
  }
}

Promise.deferred = () => {
  let def = {};
  def.promise = new Promise((resolve, reject) => {
    def.resolve = resolve
    def.reject = reject
  })
  return def
};

Promise.resolve = (value) => {
  let def = Promise.deferred()
  def.resolve(value)
  return def.promise
}

Promise.reject = (value) => {
  let def = Promise.deferred()
  def.reject(value)
  return def.promise
}

module.exports = Promise;
