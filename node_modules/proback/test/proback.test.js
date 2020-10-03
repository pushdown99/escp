'use strict';

var assert = require('chai').assert;
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
      cb(null, 'ok');
    }
  });
  return cb.promise;
}

function fnResolveWithMultiArgs(cb) {
  cb = cb || proback();
  setTimeout(function () {
    cb(null, 1, 2, 3);
  });
  return cb.promise;
}

describe('proback', function () {
  it('should callback ok', function (done) {
    fn(function (err, data) {
      assert.notOk(err);
      assert.equal(data, 'ok');
      done();
    });
  });

  it('should callback with error', function (done) {
    fn('abc', function (err, data) {
      assert.equal('abc', err);
      assert.notOk(data);
      done();
    });
  });

  it('should resolve promise', function (done) {
    fn().then(function (data) {
      assert.equal(data, 'ok');
      done();
    });
  });

  it('should reject with error', function (done) {
    fn('abc').catch(function (err) {
      assert.equal('abc', err);
      done();
    });
  });

  it('should resolve with array argument', function (done) {
    fnResolveWithMultiArgs().then(function (data) {
      assert.deepEqual(data, [1, 2, 3]);
      done();
    });
  });

  it('should resolve with array argument and spread to multi args function', function (done) {
    fnResolveWithMultiArgs().spread(function (a, b, c) {
      assert.equal(a, 1);
      assert.equal(b, 2);
      assert.equal(c, 3);
      done();
    });
  });
});
