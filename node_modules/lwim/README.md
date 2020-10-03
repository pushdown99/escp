# lwim 

[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]

> Light Weight Image Manipulation for NodeJS. It is forked from [mono-bitmap](https://github.com/vonderheide/mono-bitmap)

## Installation

```sh
$ npm install --save lwim
```

## Features

* Creating bitmaps (1, 2 or 4 bytes per pixel, in big- or little-endian)
* Changing the color depth
* Reading 8-bit .bmp files
* Saving .bmp files
* Getting/setting pixels
* Change the color of every pixel in a specific color
* Drawing rectangles (horizontal gradient in greyscale possible)
* Drawing circles/ellipses
* Inverting the bitmap
* Drawing a bitmap or a portion of it on a bitmap
* Drawing text with a bitmap font

## Example

```js
"use strict";

var lwim = require("..");

// Create bitmap
var bitmap = lwim.bitmap(411, 305);

// Draw rectangle with border
bitmap.drawFilledRect(10, 10, 100, 50, 0x00, 0xff);
bitmap.drawEllipse(50, 100, 200, 100, 0x00, 0xff);

// Draw another bitmap with some source pixels in a specific color handled as transparent
var overlayBitmap = lwim.bitmap.fromFile("overlayBitmap.bmp");
bitmap.drawBitmap(overlayBitmap, 200, 0, overlayBitmap.palette.indexOf(0xff00ff/*magenta*/));

// Draw text
var  font = new lwim.Font("P:\\ath\\to\\Font.json");
font.setSize(20);
bitmap.drawText(font, "Hello World!", 10, 100);

// The raw pixel data can also be processed in a user-specific way
var data = bitmap.data;  // Return a Node.js Buffer
```

## Documentation

The documentation can be generated from the source code by:

<pre>
[jsdoc](http://usejsdoc.org/) index.js
</pre>

## License

MIT © [taoyuan]()

[npm-image]: https://badge.fury.io/js/lwim.svg
[npm-url]: https://npmjs.org/package/lwim
[travis-image]: https://travis-ci.org/taoyuan/lwim.svg?branch=master
[travis-url]: https://travis-ci.org/taoyuan/lwim
[daviddm-image]: https://david-dm.org/taoyuan/lwim.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/taoyuan/lwim
[coveralls-image]: https://coveralls.io/repos/taoyuan/lwim/badge.svg
[coveralls-url]: https://coveralls.io/r/taoyuan/lwim
