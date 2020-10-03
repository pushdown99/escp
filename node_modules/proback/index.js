"use strict";

var Promise = require('bluebird');
var slice = Array.prototype.slice;

function createPromiseCallback() {
  var cb;
  var promise = new Promise(function (resolve, reject) {
    cb = function (err, data) {
      if (err) {
        return reject(err);
      }
      if (arguments.length > 2) {
        return resolve(slice.call(arguments, 1));
      }
      return resolve(data);
    };
  });
  cb.promise = promise;
  return cb;
}

module.exports = exports = createPromiseCallback;
exports.createPromiseCallback = createPromiseCallback;
