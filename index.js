'use strict';

const noop = () => { };
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
    this.parent = undefined;
    let { fn1: resolve, fn2: reject } = callAnyOnce(this._resolvePromise, this._rejectPromise, this)
    func(resolve, reject)
  }

  then(onFulfill, onRejected) {
    let deferred = Promise.deferred();
    let promise = deferred.promise;
    promise.parent = this;

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
    if (this.status === 'resolved') {
      setImmediate(() => {
        while (this.deferreds.length) {
          let deferred = this.deferreds.shift();
          let handler = deferred.promise.onFulfill;

          if (handler) {
            try {
              let result = handler(this.value);

              if (result && result.parent === this) {
                deferred.reject(
                  new TypeError('Cannot return the promise itself inside onFullfill handler')
                );
                continue;
              }

              // TODO maybe this can be removed since it is handled in Promise.resolve
              let then = getThenFromPromise(result)
              if (typeof then === 'function') {
                then.call(result, deferred.resolve, deferred.reject);
              } else {
                deferred.resolve(result);
              }
            } catch (error) {
              deferred.reject(error);
            }
          } else {
            deferred.resolve(this.value);
          }
        }
      });
    }
    if (this.status === 'rejected') {
      setImmediate(() => {
        while (this.deferreds.length) {
          let deferred = this.deferreds.shift();
          let handler = deferred.promise.onRejected;

          if (handler) {
            try {
              let result = handler(this.value);

              if (result && result.parent === this) {
                deferred.reject(
                  new TypeError('Cannot return the promise itself inside onReject handler')
                );
                continue;
              }

              let then = getThenFromPromise(result)
              if (typeof then === 'function') {
                then.call(result, deferred.resolve, deferred.reject);
              } else {
                deferred.resolve(result);
              }
            } catch (error) {
              deferred.reject(error);
            }
          } else {
            deferred.reject(this.value);
          }
        }
      });
    }
  }

  _resolvePromise(value) {
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

if (!module.parent) { // tests
  var dummy = { blah: 1 };
  var sentinel = { foo: 1 };
  var sentinel2 = { foo: 2 };
  var sentinel3 = { foo: 3 };
  var assert = require('assert');
  var nonFunction = undefined

  // resolve/reject soh consideram o primeiro valor
  // promise soh muda de status uma vez q o valor foi resolvido
}
