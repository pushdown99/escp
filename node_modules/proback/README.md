# proback 
[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]
> A utility to create a promise callback

## Installation

```sh
$ npm install --save proback
```

## Usage

### Generic usage

```js
var proback = require('proback');

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
  console.log('callback done', arguments);    // callback done {}
});

fn('abc', function () {
  console.log('callback done', arguments);    // callback done { '0': 'abc' }
});

fn().then(function () {
  console.log('promise resolved', arguments); // promise resolved { '0': undefined }
});

fn('def').catch(function () {
  console.log('promise reject', arguments);   //promise reject { '0': 'def' }
});

```

### Resolve with multiple arguments

```js
function fnResolveWithMultiArgs(cb) {
  cb = cb || proback();
  setTimeout(function () {
    cb(null, 1, 2, 3);
  });
  return cb.promise;
}

fnResolveWithMultiArgs().then(function (data) {
  console.log(data);    // [1, 2, 3]
});
    
fnResolveWithMultiArgs().spread(function (a, b, c) {
  console.log(a, b, c); // 1, 2, 3
});
```

## License

MIT © [taoyuan]()


[npm-image]: https://badge.fury.io/js/proback.svg
[npm-url]: https://npmjs.org/package/proback
[travis-image]: https://travis-ci.org/taoyuan/proback.svg?branch=master
[travis-url]: https://travis-ci.org/taoyuan/proback
[daviddm-image]: https://david-dm.org/taoyuan/proback.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/taoyuan/proback
[coveralls-image]: https://coveralls.io/repos/taoyuan/proback/badge.svg
[coveralls-url]: https://coveralls.io/r/taoyuan/proback
