"use strict";

var proback = require('..');

function fn(throws, cb) {
  if (typeof throws === 'function') {
    cb = throws;
    throws = null;
  }
  cb = cb || proback();
  setTimeout(function () {
    if (throws) {
      cb(throws);
    } else {
      cb();
    }
  });
  return cb.promise;
}

fn(function () {
  console.log('callback done', arguments);
});

fn('abc', function () {
  console.log('callback done', arguments);
});

fn().then(function () {
  console.log('promise resolved', arguments);
});

fn('def').catch(function () {
  console.log('promise reject', arguments);
});
