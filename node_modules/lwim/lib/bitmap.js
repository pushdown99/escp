'use strict';

/**
 * @module lwim
 */

var assert = require("assert");
var StructFu = require("struct-fu");
var fs = require('fs');

var Endianness = require('./endianness');

module.exports = Bitmap;

/**
 * Data structure for bitmap files (extension <code>.bmp</code>), taken from the Windows API
 * (BITMAPFILEHEADER and BITMAPINFOHEADER).
 *
 * @private
 */
var BitmapFileHeader = StructFu.struct([
  StructFu.uint16le("signature"),
  StructFu.uint32le("size"),
  StructFu.uint32le("reserved"),
  StructFu.uint32le("dataOffset"),
  StructFu.uint32le("bitmapInfoHeaderSize"),
  StructFu.int32le("width"),
  StructFu.int32le("height"),
  StructFu.uint16le("planes"),
  StructFu.uint16le("bitsPerPixel"),
  StructFu.uint32le("compression"),
  StructFu.uint32le("numberOfDataBytes"),
  StructFu.int32le("pixelsPerMeterX"),
  StructFu.int32le("pixelsPerMeterY"),
  StructFu.uint32le("numberOfUsedColors"),
  StructFu.uint32le("numberOfImportantColors")
]);
var BITMAP_FILE_SIGNATURE = new Buffer("BM").readUInt16LE(0);
var SIZE_OF_FIRST_PART_OF_BITMAP_FILE_HEADER = (16 + 32 + 32 + 32) / 8;  // That is, before
// "bitmapInfoHeaderSize"
var RGB_BITMAP_COMPRESSION = 0;
var BIT_FIELDS_BITMAP_COMPRESSION = 3;

var DEFAULT_PALETTE = [0x000000, 0x800000, 0x008000, 0x808000, 0x000080, 0x800080, 0x008080,
  0xc0c0c0, 0xc0dcc0, 0xa6caf0, 0x402000, 0x602000, 0x802000, 0xa02000, 0xc02000, 0xe02000,
  0x004000, 0x204000, 0x404000, 0x604000, 0x804000, 0xa04000, 0xc04000, 0xe04000, 0x006000,
  0x206000, 0x406000, 0x606000, 0x806000, 0xa06000, 0xc06000, 0xe06000, 0x008000, 0x208000,
  0x408000, 0x608000, 0x808000, 0xa08000, 0xc08000, 0xe08000, 0x00a000, 0x20a000, 0x40a000,
  0x60a000, 0x80a000, 0xa0a000, 0xc0a000, 0xe0a000, 0x00c000, 0x20c000, 0x40c000, 0x60c000,
  0x80c000, 0xa0c000, 0xc0c000, 0xe0c000, 0x00e000, 0x20e000, 0x40e000, 0x60e000, 0x80e000,
  0xa0e000, 0xc0e000, 0xe0e000, 0x000040, 0x200040, 0x400040, 0x600040, 0x800040, 0xa00040,
  0xc00040, 0xe00040, 0x002040, 0x202040, 0x402040, 0x602040, 0x802040, 0xa02040, 0xc02040,
  0xe02040, 0x004040, 0x204040, 0x404040, 0x604040, 0x804040, 0xa04040, 0xc04040, 0xe04040,
  0x006040, 0x206040, 0x406040, 0x606040, 0x806040, 0xa06040, 0xc06040, 0xe06040, 0x008040,
  0x208040, 0x408040, 0x608040, 0x808040, 0xa08040, 0xc08040, 0xe08040, 0x00a040, 0x20a040,
  0x40a040, 0x60a040, 0x80a040, 0xa0a040, 0xc0a040, 0xe0a040, 0x00c040, 0x20c040, 0x40c040,
  0x60c040, 0x80c040, 0xa0c040, 0xc0c040, 0xe0c040, 0x00e040, 0x20e040, 0x40e040, 0x60e040,
  0x80e040, 0xa0e040, 0xc0e040, 0xe0e040, 0x000080, 0x200080, 0x400080, 0x600080, 0x800080,
  0xa00080, 0xc00080, 0xe00080, 0x002080, 0x202080, 0x402080, 0x602080, 0x802080, 0xa02080,
  0xc02080, 0xe02080, 0x004080, 0x204080, 0x404080, 0x604080, 0x804080, 0xa04080, 0xc04080,
  0xe04080, 0x006080, 0x206080, 0x406080, 0x606080, 0x806080, 0xa06080, 0xc06080, 0xe06080,
  0x008080, 0x208080, 0x408080, 0x608080, 0x808080, 0xa08080, 0xc08080, 0xe08080, 0x00a080,
  0x20a080, 0x40a080, 0x60a080, 0x80a080, 0xa0a080, 0xc0a080, 0xe0a080, 0x00c080, 0x20c080,
  0x40c080, 0x60c080, 0x80c080, 0xa0c080, 0xc0c080, 0xe0c080, 0x00e080, 0x20e080, 0x40e080,
  0x60e080, 0x80e080, 0xa0e080, 0xc0e080, 0xe0e080, 0x0000c0, 0x2000c0, 0x4000c0, 0x6000c0,
  0x8000c0, 0xa000c0, 0xc000c0, 0xe000c0, 0x0020c0, 0x2020c0, 0x4020c0, 0x6020c0, 0x8020c0,
  0xa020c0, 0xc020c0, 0xe020c0, 0x0040c0, 0x2040c0, 0x4040c0, 0x6040c0, 0x8040c0, 0xa040c0,
  0xc040c0, 0xe040c0, 0x0060c0, 0x2060c0, 0x4060c0, 0x6060c0, 0x8060c0, 0xa060c0, 0xc060c0,
  0xe060c0, 0x0080c0, 0x2080c0, 0x4080c0, 0x6080c0, 0x8080c0, 0xa080c0, 0xc080c0, 0xe080c0,
  0x00a0c0, 0x20a0c0, 0x40a0c0, 0x60a0c0, 0x80a0c0, 0xa0a0c0, 0xc0a0c0, 0xe0a0c0, 0x00c0c0,
  0x20c0c0, 0x40c0c0, 0x60c0c0, 0x80c0c0, 0xa0c0c0, 0xfffbf0, 0xa0a0a4, 0x808080, 0xff0000,
  0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff];

/**
 * Creates an in-memory bitmap. Bitmaps with 1 byte per pixel are handled in conjunction with a
 * palette.
 *
 * @class
 * @param {number} width
 * @param {number} height
 * @param {number} [bytesPerPixel=1] Possible values: <code>1</code>, <code>2</code>,
 *                                    <code>4</code>
 * @param {Endianness} [endianness=BIG] Use big- or little-endian when storing multiple bytes per
 *                                      pixel
 * @constructor
 */
function Bitmap(width, height, bytesPerPixel, endianness) {
  if (!(this instanceof Bitmap)) {
    return new Bitmap(width, height, bytesPerPixel, endianness);
  }

  // Validate bytes per pixel
  if (bytesPerPixel === undefined) {
    bytesPerPixel = 1;
  }
  if (bytesPerPixel !== 1 && bytesPerPixel !== 2 && bytesPerPixel !== 4) {
    throw new Error("Invalid number of bytes per pixel: " + bytesPerPixel);
  }

  this._width = width;
  this._height = height;
  this._bytesPerPixel = bytesPerPixel;
  this._endianness = endianness === undefined ? Endianness.BIG : endianness;
  this._palette = bytesPerPixel === 1 ? [].concat(DEFAULT_PALETTE) : [];
  this._data = new Buffer(width * height * bytesPerPixel);
  saveReadAndWriteFunction.call(this);

  // Initialize to white
  this.clear(0xFF);
}

Bitmap.load = function (image) {
  if (typeof image === 'string') {
    return Bitmap.fromFile(image);
  } else if (Buffer.isBuffer(image)) {
    return Bitmap.fromBuffer(image);
  } else if (Array.isArray(image)) {
    return Bitmap.fromBuffer(new Buffer(image));
  }
  throw new Error('image should be a string, buffer or an array.');
};

Bitmap.fromBuffer = function (buffer) {
  var size = buffer.length;
  var hasError = size <= BitmapFileHeader.size;
  var errorMessage = null;
  var header;
  var offsetAfterHeader;
  var pos;
  if (!hasError) {
    header = BitmapFileHeader.unpack(buffer);
    offsetAfterHeader = SIZE_OF_FIRST_PART_OF_BITMAP_FILE_HEADER +
      header.bitmapInfoHeaderSize;
    hasError =
      header.signature !== BITMAP_FILE_SIGNATURE ||
      header.size !== size ||
      header.dataOffset < offsetAfterHeader || header.dataOffset >= size ||
      offsetAfterHeader < BitmapFileHeader.size ||
      header.width < 1 || header.height < 1 ||
      header.planes != 1 ||
      [1, 4, 8, 16, 24, 32].indexOf(header.bitsPerPixel) == -1 ||
      header.compression != RGB_BITMAP_COMPRESSION ||
      header.numberOfDataBytes > size - offsetAfterHeader
    ;
    // Go a little further if header is longer than the structure
    if (BitmapFileHeader.size < offsetAfterHeader) {
      hasError |= offsetAfterHeader > size;
    }
  }
  if (!hasError && header.bitsPerPixel != 8) {
    hasError = true;
    errorMessage = 'Unsupported number of bits per pixel in file ' + filePath;
  }
  // Read palette
  var bitmap = null;
  if (!hasError) {
    bitmap = new Bitmap(header.width, header.height);
    pos = offsetAfterHeader;
    var palette = bitmap.palette;
    while (pos < header.dataOffset) {
      if (size < pos + 4) {
        hasError = true;
        errorMessage = 'Invalid buffer size';
        break;
      }
      palette.push(buffer.readUInt32LE(pos) & 0xffffff);
      pos += 4;
    }
    if (pos != header.dataOffset) {  // Palette bytes aren't a multiple of 4
      hasError = true;
    }
  }
  // Read pixels
  if (!hasError) {
    var data = bitmap.data;
    var numberOfBytesPerLine = Math.ceil(header.width * header.bitsPerPixel / 8/*bits*/ / 4/*bytes*/) * 4/*bytes*/;
    var count = header.dataOffset + numberOfBytesPerLine * header.height;
    if (size < count) {
      hasError = true;
      errorMessage = 'Buffer size is not match image size in header marked';
    }

    for (var y = header.height - 1; y >= 0; y--) {
      pos = header.dataOffset + numberOfBytesPerLine * (header.height - 1 - y);
      buffer.copy(data, y * numberOfBytesPerLine, pos, pos + numberOfBytesPerLine);
    }
  }
  // Finish
  if (hasError) {
    throw new Error(errorMessage || 'Could not recognize buffer');
  }
  return bitmap;
};

/**
 * Reads a bitmap file (extension <code>.bmp</code>). Only those with 1 byte per pixel are
 * supported.
 *
 * @method module:lwim.Bitmap.fromFile
 * @param {string} filePath
 * @returns {Bitmap}
 */
Bitmap.fromFile = function (filePath) {
  var file = fs.openSync(filePath, "r");
  // Read header and validate file by means of it
  var fileBuffer = new Buffer(BitmapFileHeader.size);
  var numberOfBytesRead = fs.readSync(file, fileBuffer, 0, fileBuffer.length, null);
  var hasError = numberOfBytesRead != BitmapFileHeader.size;
  var errorMessage = null;
  var header;
  var offsetAfterHeader;
  if (!hasError) {
    header = BitmapFileHeader.unpack(fileBuffer);
    header.width = Math.abs(header.width);
    header.height = Math.abs(header.height);
    offsetAfterHeader = SIZE_OF_FIRST_PART_OF_BITMAP_FILE_HEADER +
      header.bitmapInfoHeaderSize;
    var fileSize = fs.fstatSync(file).size;
    hasError =
      header.signature !== BITMAP_FILE_SIGNATURE ||
      header.size !== fileSize ||
      header.dataOffset < offsetAfterHeader || header.dataOffset >= fileSize ||
      offsetAfterHeader < BitmapFileHeader.size ||
      header.width < 1 || header.height < 1 ||
      header.planes != 1 ||
      [1, 4, 8, 16, 24, 32].indexOf(header.bitsPerPixel) == -1 ||
      header.compression != RGB_BITMAP_COMPRESSION ||
      header.numberOfDataBytes > fileSize - offsetAfterHeader
    ;
    // Go a little further if header is longer than the structure
    if (BitmapFileHeader.size < offsetAfterHeader) {
      hasError |= fs.readSync(file, fileBuffer, 0, 1, offsetAfterHeader - 1) != 1;
    }
  }
  if (!hasError && header.bitsPerPixel != 8) {
    hasError = true;
    errorMessage = 'Unsupported number of bits per pixel in file ' + filePath;
  }
  // Read palette
  var bitmap = null;
  if (!hasError) {
    bitmap = new Bitmap(header.width, header.height);
    var palette = bitmap.getPalette();
    var filePosition = offsetAfterHeader;
    fileBuffer = new Buffer(4);
    while (filePosition < header.dataOffset) {
      //noinspection JSDuplicatedDeclaration
      numberOfBytesRead = fs.readSync(file, fileBuffer, 0, fileBuffer.length, null);
      if (numberOfBytesRead != fileBuffer.length) {
        hasError = true;
        errorMessage = 'Unexpected end of file in ' + filePath;
        break;
      }
      palette.push(fileBuffer.readUInt32LE(0) & 0xffffff);
      filePosition += fileBuffer.length;
    }
    if (filePosition != header.dataOffset) {  // Palette bytes aren't a multiple of 4
      hasError = true;
    }
  }
  // Read pixels
  if (!hasError) {
    var bitmapData = bitmap.data;
    var numberOfBytesPerLine = Math.ceil(header.width * header.bitsPerPixel / 8/*bits*/ /
        4/*bytes*/) * 4/*bytes*/;
    fileBuffer = new Buffer(numberOfBytesPerLine);
    for (var y = header.height - 1; y >= 0; y--) {
      //noinspection JSDuplicatedDeclaration
      numberOfBytesRead = fs.readSync(file, fileBuffer, 0, numberOfBytesPerLine,
        null);
      if (numberOfBytesRead != numberOfBytesPerLine) {
        hasError = true;
        errorMessage = 'Unexpected end of file in ' + filePath;
        break;
      }
      fileBuffer.copy(bitmapData, y * header.width, 0, header.width);
    }
  }
  // Finish
  fs.closeSync(file);
  if (hasError) {
    throw new Error(errorMessage || 'Could not recognize the file ' + filePath);
  }
  return bitmap;
};

/**
 * @method module:lwim.Bitmap#getWidth
 * @returns {number}
 */
Object.defineProperty(Bitmap.prototype, 'width', {
  get: function () {
    return this._width;
  }
});

Bitmap.prototype.getWidth = function () {
  return this._width;
};

/**
 * @method module:lwim.Bitmap#getHeight
 * @returns {number}
 */
Object.defineProperty(Bitmap.prototype, 'height', {
  get: function () {
    return this._height;
  }
});

Bitmap.prototype.getHeight = function () {
  return this._height;
};

/**
 * @method module:lwim.Bitmap#getBytesPerPixel
 * @returns {number}
 */
Object.defineProperty(Bitmap.prototype, 'bytesPerPixel', {
  get: function () {
    return this._bytesPerPixel;
  }
});

Bitmap.prototype.getBytesPerPixel = function () {
  return this._bytesPerPixel;
};

/**
 * @method module:lwim.Bitmap#getEndianness
 * @returns {number}
 */
Object.defineProperty(Bitmap.prototype, 'endianness', {
  get: function () {
    return this._endianness;
  }
});


Bitmap.prototype.getEndianness = function () {
  return this._endianness;
};

/**
 * @method module:lwim.Bitmap#getPalette
 * @returns {number[]} An array of RGB colors (<code>0xRRGGBB</code>) to indices. You can use
 *                      <code>indexOf()</code> to get a color for the other methods
 */
Object.defineProperty(Bitmap.prototype, 'palette', {
  get: function () {
    return this._palette;
  }
});

Bitmap.prototype.getPalette = function () {
  return this._palette;
};

/**
 * @method module:lwim.Bitmap#data
 * @returns {Buffer} The byte data of this bitmap
 */
Object.defineProperty(Bitmap.prototype, 'data', {
  get: function () {
    return this._data;
  }
});

/**
 * Converts the color depth of the pixels. Pixels are viewed as RGB values,
 * <code>0xRRGGBB</code> for 4 bytes per pixel and the same with 5 bits, 6 bits and 5 bits for 2
 * bytes per pixel. 1-byte pixels are handled in conjunction with a palette. When there are more
 * than 256 different colors in the source pixels, the rest is set to <code>0x00</code>.
 *
 * @method module:lwim.Bitmap#changeColorDepth
 * @param {number} bytesPerPixel
 * @throws {Error} Invalid parameter
 */
Bitmap.prototype.changeColorDepth = function (bytesPerPixel) {
  // Parameter validation
  switch (bytesPerPixel) {
    case 1:
    case 2:
    case 4:
    {
      break;
    }
    default:
    {
      throw new Error('Invalid number of bytes per pixel: ' + bytesPerPixel);
    }
  }

  var oldBytesPerPixel = this._bytesPerPixel;
  this._bytesPerPixel = bytesPerPixel;
  var oldPalette = this._palette;
  this._palette = [];
  var oldData = this._data;
  this._data = new Buffer(this._width * this._height * this._bytesPerPixel);
  var oldReadFunction = this._readFunction;
  saveReadAndWriteFunction.call(this);

  var getSourceRgbColor;
  switch (oldBytesPerPixel) {
    case 1:
    {
      for (var i = oldPalette.length; i <= 0xff; i++) {
        oldPalette.push(0x000000/*black*/);
      }
      getSourceRgbColor = function (offset) {
        return oldPalette[oldReadFunction.call(oldData, offset)];
      };
      break;
    }
    case 2:
    {
      getSourceRgbColor = function (offset) {
        var color = oldReadFunction.call(oldData, offset);
        return (
          Math.round((color >> 5 >> 6) / 0x1F * 0xff) << 16 |
          Math.round((color >> 5 & 0x3F) / 0x3F * 0xff) << 8 |
          Math.round((color & 0x1F) / 0x1F * 0xff)
        );
      };
      break;
    }
    case 4:
    {
      getSourceRgbColor = function (offset) {
        return oldReadFunction.call(oldData, offset);
      };
      break;
    }
  }

  var setDestinationRgbColor;
  switch (this._bytesPerPixel) {
    case 1:
    {
      setDestinationRgbColor = function (offset, color) {
        var colorIndex = this._palette.indexOf(color);
        if (colorIndex === -1) {
          if (this._palette.length < 0xff) {
            colorIndex = this._palette.length;
            this._palette[colorIndex] = color;
          } else {
            colorIndex = 0;
          }
        }
        this._writeFunction.call(this._data, colorIndex, offset);
      }.bind(this);
      break;
    }
    case 2:
    {
      setDestinationRgbColor = function (offset, color) {
        color =
          Math.round((color >> 16 & 0xff) / 0xff * 0x1F) << 6 << 5 |
          Math.round((color >> 8 & 0xff) / 0xff * 0x3F) << 5 |
          Math.round((color & 0xff) / 0xff * 0x1F)
        ;
        this._writeFunction.call(this._data, color, offset);
      }.bind(this);
      break;
    }
    case 4:
    {
      setDestinationRgbColor = function (offset, color) {
        this._writeFunction.call(this._data, color, offset);
      }.bind(this);
      break;
    }
  }

  // Convert
  for (
    var sourceOffset = 0,
      destinationOffset = 0;
    sourceOffset < oldData.length;
    sourceOffset += oldBytesPerPixel, destinationOffset += this._bytesPerPixel
  ) {
    setDestinationRgbColor.call(this, destinationOffset,
      getSourceRgbColor.call(this, sourceOffset));
  }

  if (this._bytesPerPixel === 1) {
    // Make sure there are 256 palette entries (fill it with entries from default palette)
    for (var sourceIndex = 0; sourceIndex < DEFAULT_PALETTE.length; sourceIndex++) {
      var color = DEFAULT_PALETTE[sourceIndex];
      var destinationIndex = this._palette.indexOf(color);
      if (destinationIndex === -1) {
        this._palette.push(color);
      }
    }
  }
};

// Bitmap.prototype.greyscale = Bitmap.prototype.grayscale = function () {
//   this._palette = [];
// };

/**
 * Sets all data bytes (not necessarily pixels) to the specified value.
 *
 * @method module:lwim.Bitmap#clear
 * @param {number} [byteValue=0]
 */
Bitmap.prototype.clear = function (byteValue) {
  if (!byteValue) {
    byteValue = 0;
  }
  this._data.fill(byteValue);
};

/**
 * @method module:lwim.Bitmap#getPixel
 * @param {number} x X-coordinate
 * @param {number} y Y-coordinate
 * @returns {number|null} The pixel color or <code>null</code> when the coordinates are out of the
 *                    bitmap surface
 */
Bitmap.prototype.getPixel = function (x, y) {
  if (x < 0 || x >= this._width) {
    return null;
  }
  try {
    return this._readFunction.call(this._data, (y * this._width + x) * this._bytesPerPixel);
  } catch (error) {
    return null;
  }
};

/**
 * Sets the pixel at the given coordinates.
 *
 * @method module:lwim.Bitmap#setPixel
 * @param {number} x X-coordinate
 * @param {number} y Y-coordinate
 * @param {number} color The raw pixel value according to the bytes per pixel
 */
Bitmap.prototype.setPixel = function (x, y, color) {
  if (x >= 0 && x < this._width) {
    this._writeFunction.call(this._data, color, (y * this._width + x) * this._bytesPerPixel, true);
  }
};

/**
 * Sets the color of every pixel in a specific color to a new color.
 *
 * @method module:lwim.Bitmap#replaceColor
 * @param {number} color The current color to get rid of
 * @param {number} newColor The new color to use for the identified pixels
 */
Bitmap.prototype.replaceColor = function (color, newColor) {
  for (var offset = 0; offset < this._data.length; offset += this._bytesPerPixel) {
    if (this._readFunction.call(this._data, offset) === color) {
      this._writeFunction.call(this._data, newColor, offset);
    }
  }
};

/**
 * Draws a rectangle, optionally filled, optionally with a border.
 *
 * @method module:lwim.Bitmap#drawRectangle
 * @param {number} left Starting x coordinate
 * @param {number} top Starting y coordinate
 * @param {number} width Width of the rectangle
 * @param {number} height Height of the rectangle
 * @param {?number} borderColor Color of the border. Pass <code>null</code> to indicate
 *                        no border
 * @param {?number} fillColor Color to fill the rectangle with. Pass <code>null</code> to indicate
 *                        no filling
 * @param {number} [borderWidth=1]
 */
Bitmap.prototype.drawFilledRect = function (left, top, width, height, borderColor, fillColor, borderWidth) {
  if (borderWidth === undefined) {
    borderWidth = 1;
  }
  var x = void 0,
    y = void 0,
    right = void 0,
    bottom = void 0;
  // Draw border
  if (borderColor !== null) {
    // Draw left and right border (without the parts that intersect with the horizontal
    // borders)
    bottom = top + height - borderWidth;
    for (y = top + borderWidth; y < bottom; y++) {
      right = Math.min(left + borderWidth, left + width);
      for (x = left; x < right; x++) {
        this.setPixel(x, y, borderColor);
      }
      right = left + width;
      for (x = Math.max(left + width - borderWidth, left); x < right; x++) {
        this.setPixel(x, y, borderColor);
      }
    }
    // Draw top and bottom border
    right = left + width;
    for (x = left; x < right; x++) {
      bottom = Math.min(top + borderWidth, top + height);
      for (y = top; y < bottom; y++) {
        this.setPixel(x, y, borderColor);
      }
      bottom = top + height;
      for (y = Math.max(top + height - borderWidth, top); y < bottom; y++) {
        this.setPixel(x, y, borderColor);
      }
    }
    left += borderWidth;
    //noinspection JSSuspiciousNameCombination
    top += borderWidth;
    width = Math.max(width - borderWidth * 2, 0);
    height = Math.max(height - borderWidth * 2, 0);
  }
  // Draw filled area
  if (fillColor !== null) {
    right = left + width;
    bottom = top + height;
    for (y = top; y < bottom; y++) {
      for (x = left; x < right; x++) {
        this.setPixel(x, y, fillColor);
      }
    }
  }
};

/**
 * Draws a rectangle that's filled with a horizontal gradient.
 *
 * @method module:lwim.Bitmap#drawGradientRectangle
 * @param {number} left Starting x coordinate
 * @param {number} top Starting y coordinate
 * @param {number} width Width of the rectangle
 * @param {number} height Height of the rectangle
 * @param {number} leftColor Greyscale color of the leftmost pixel
 * @param {number} rightColor Greyscale color of the rightmost pixel
 */
Bitmap.prototype.drawGradientRect = function (left, top, width, height, leftColor, rightColor) {
  for (var x = left; x < left + width; ++x) {
    var value = calculateGradientValue(x - left, width, leftColor, rightColor);
    for (var y = top; y < top + height; ++y) {
      this.setPixel(x, y, value);
    }
  }
};

function calculateGradientValue(step, numSteps, leftColor, rightColor) {
  if (step === 0) {
    return leftColor;
  }
  if (step === numSteps - 1) {
    return rightColor;
  }
  var changePerStep = (rightColor - leftColor + .5) / numSteps;
  return Math.round(step * changePerStep) + leftColor;
}

/**
 * Draws a circle or ellipse.
 *
 * <em>Note:</em> Drawing borders lacks quality. Consider drawing a filled shape on top of
 * another.
 *
 * @method module:lwim.Bitmap#drawEllipse
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 * @param {?number} [borderColor] Color of the border. Pass <code>null</code> for transparency
 * @param {?number} [fillColor] Color of the filling. Pass <code>null</code> for transparency
 * @param {number} [borderWidth=1]
 */
Bitmap.prototype.drawEllipse = function (left, top, width, height, borderColor, fillColor, borderWidth) {
  borderWidth = borderColor !== undefined && borderColor !== null ? borderWidth ? borderWidth : 1 : 0;

  var hasSolidFilling = fillColor !== null;
  var centerX = width / 2;
  var centerY = height / 2;
  var circleFactorY = width / height; // Used to convert the ellipse to a circle for an
  // easier algorithm
  var circleRadiusSquared = Math.pow(width / 2, 2);
  var right = left + width;
  var bottom = top + height;
  for (var y = top; y < bottom; y++) {
    var circleYSquared = Math.pow((y - top - centerY + 0.5) * circleFactorY, 2);
    var intermediateY = y - top - centerY;
    var innerCircleYSquared = Math.pow((intermediateY + Math.sign(intermediateY) * borderWidth + 0.5) * circleFactorY, 2);
    for (var x = left; x < right; x++) {
      var currentCircleRadiusSquared = Math.pow(x - left - centerX + 0.5, 2) + circleYSquared;
      if (currentCircleRadiusSquared <= circleRadiusSquared) {
        var intermediateX = x - left - centerX;
        currentCircleRadiusSquared = Math.pow(intermediateX + Math.sign(intermediateX) * borderWidth + 0.5, 2) + innerCircleYSquared;
        if (currentCircleRadiusSquared <= circleRadiusSquared) {
          hasSolidFilling && this.setPixel(x, y, fillColor);
        } else {
          this.setPixel(x, y, borderColor);
        }
      }
    }
  }
};

/**
 * Inverts the image by negating every data bit.
 *
 * @method module:lwim.Bitmap#invert
 */
Bitmap.prototype.invert = function () {
  for (var i = 0; i < this._data.length; i++) {
    this._data[i] = ~this._data[i];
  }
};

/**
 * Draws another bitmap or a portion of it on this bitmap. You can specify a color from the
 * source bitmap to be handled as transparent.
 *
 * @method module:lwim.Bitmap#drawBitmap
 * @param {Bitmap} bitmap
 * @param {number} x
 * @param {number} y
 * @param {number} [transparentColor]
 * @param {number} [sourceX]
 * @param {number} [sourceY]
 * @param {number} [width]
 * @param {number} [height]
 */
Bitmap.prototype.drawBitmap = function (bitmap, x, y, transparentColor, sourceX, sourceY, width, height) {
  // Validate parameters
  if (bitmap.getBytesPerPixel() !== this._bytesPerPixel) {
    throw new Error("The number of bytes per pixel from both bitmaps don't match");
  }
  var bitmapWidth = bitmap.getWidth();
  var bitmapHeight = bitmap.getHeight();
  sourceX = sourceX === undefined ? 0 : sourceX;
  sourceY = sourceY === undefined ? 0 : sourceY;
  width = width === undefined ? bitmapWidth : width;
  height = height === undefined ? bitmapHeight : height;
  transparentColor = transparentColor === undefined ? null : transparentColor;

  // Correct coordinates
  // Prevent coordinates out of the source bitmap
  var correction = -Math.min(sourceX, 0);
  sourceX += correction;
  width = Math.max(width - correction, 0);
  width -= width - Math.min(bitmapWidth - sourceX, width);
  correction = -Math.min(sourceY, 0);
  sourceY += correction;
  height = Math.max(height - correction, 0);
  height -= height - Math.min(bitmapHeight - sourceY, height);
  // Prevent coordinates out of the destination bitmap
  correction = -Math.min(x, 0);
  sourceX += correction;
  x += correction;
  width -= correction;
  correction = -Math.min(y, 0);
  sourceY += correction;
  y += correction;
  height -= correction;
  width -= width - Math.min(this._width - x, width);
  height -= height - Math.min(this._height - y, height);

  // Transfer pixels
  var bitmapData = bitmap.data;
  for (
    var lineOffset = (y * this._width + x) * this._bytesPerPixel,
      endOffset = ((y + height - 1) * this._width + x + width) * this._bytesPerPixel,
      bitmapLineOffset = (sourceY * bitmapWidth + sourceX) * this._bytesPerPixel,
      numberOfBytesPerLine = this._width * this._bytesPerPixel,
      numberOfBytesPerBitmapLine = bitmapWidth * this._bytesPerPixel,
      numberOfBytesPerPortionLine = width * this._bytesPerPixel;
    lineOffset < endOffset;
    lineOffset += numberOfBytesPerLine, bitmapLineOffset += numberOfBytesPerBitmapLine
  ) {
    for (
      var offset = lineOffset,
        lineEndOffset = lineOffset + numberOfBytesPerPortionLine,
        bitmapOffset = bitmapLineOffset;
      offset < lineEndOffset;
      offset += this._bytesPerPixel, bitmapOffset += this._bytesPerPixel
    ) {
      var color = this._readFunction.call(bitmapData, bitmapOffset);
      if (color !== transparentColor) {
        this._writeFunction.call(this._data, color, offset);
      }
    }
  }
};

/**
 * Draws text with a bitmap font by drawing a bitmap portion for each character. The text may
 * contain line breaks. The position is specified as the upper left coordinate of the rectangle
 * that will contain the text.
 *
 * @method module:lwim.Bitmap#drawText
 * @param {Font} font
 * @param {string} text
 * @param {number} x
 * @param {number} y
 */
Bitmap.prototype.drawText = function (font, text, x, y) {
  var fontBitmap = font.getBitmap();
  var lineHeight = font.getLineHeight();
  var fontDetails = font.getDetails();
  var characterInfoMap = fontDetails.chars;
  var kernings = fontDetails.kernings;
  var transparentColor = font.getTransparentColor();
  var lines = text.split(/\r?\n|\r/);
  var lineX = x;
  var that = this;
  lines.forEach(function (line) {
    var lastCharacter = null;
    for (var i = 0; i < line.length; i++) {
      var character = line[i];
      var characterInfo = characterInfoMap[character];
      if (!characterInfo) {
        return;
      }
      var kerning = kernings[character];
      if (kerning && lastCharacter) {
        kerning = kerning[lastCharacter];
        kerning && (x += kerning.amount);
      }
      that.drawBitmap(fontBitmap, x + characterInfo.xoffset, y + characterInfo.yoffset,
        transparentColor, characterInfo.x, characterInfo.y, characterInfo.width,
        characterInfo.height);
      x += characterInfo.xadvance;
    }
    x = lineX;
    y += lineHeight;
  });
};

Bitmap.prototype.toBuffer = function () {
  var header = {
    signature: BITMAP_FILE_SIGNATURE,
    size: null /*later*/,
    reserved: 0,
    dataOffset: BitmapFileHeader.size,
    bitmapInfoHeaderSize: BitmapFileHeader.size - SIZE_OF_FIRST_PART_OF_BITMAP_FILE_HEADER,
    width: this._width,
    height: this._height,
    planes: 1,
    bitsPerPixel: this._bytesPerPixel * 8,
    compression: RGB_BITMAP_COMPRESSION,
    numberOfDataBytes: null /*later*/,
    pixelsPerMeterX: Math.round(96/*DPI*/ / 2.54/*cm/inch*/ * 100/*cm/m*/),
    numberOfUsedColors: 0,
    numberOfImportantColors: 0
  };
  header.pixelsPerMeterY = header.pixelsPerMeterX;

  var palette;

  switch (this._bytesPerPixel) {
    case 1:
    {
      if (!this._palette || !this._palette.length) {
        palette = [];
      } else {
        // Make sure there are exactly 256 palette entries
        palette = this._palette.slice(0, 0xff + 1);
        for (var i = palette.length; i <= 0xff; i++) {
          palette.push(0x000000/*black*/);
        }
      }
      break;
    }
    case 2:
    {
      header.compression = BIT_FIELDS_BITMAP_COMPRESSION;
      palette = [0x1F << 6 << 5, 0x3F << 5, 0x1F];  // Masks indicating the used
      // bits (5 bits red, 6 bits
      // green, 5 bits blue)
      break;
    }
    case 4:
    {
      palette = [];
      break;
    }
  }
  header.dataOffset += palette.length * 4/*bytes*/;

  var numberOfBytesPerLine = this._width * this._bytesPerPixel; // Math.ceil(this._width * this._bytesPerPixel / 4/*bytes*/) *  4/*bytes*/;
  var extraBytes = numberOfBytesPerLine & 0x3;
  if (extraBytes) extraBytes = 4 - extraBytes;
  numberOfBytesPerLine += extraBytes;

  header.numberOfDataBytes = numberOfBytesPerLine * this._height;
  header.size = header.dataOffset + header.numberOfDataBytes;

  // Write header to file buffer
  var buffer = new Buffer(header.size);
  BitmapFileHeader.pack(header, buffer);

  var offset = BitmapFileHeader.size;
  // Write palette to file buffer
  palette.forEach(function (color) {
    buffer.writeUInt32LE(color, offset);
    offset += 4;
  });

  // Write pixels to file buffer
  var sourceOffset;
  var transferPixel;
  switch (this._bytesPerPixel) {
    case 1:
    {
      transferPixel = function () {
        buffer.writeUInt8(this._readFunction.call(this._data, sourceOffset), offset);
      };
      break;
    }
    case 2:
    {
      transferPixel = function () {
        buffer.writeUInt16LE(this._readFunction.call(this._data, sourceOffset), offset);
      };
      break;
    }
    case 4:
    {
      transferPixel = function () {
        buffer.writeUInt32LE(this._readFunction.call(this._data, sourceOffset), offset);
      };
      break;
    }
  }
  var numberOfSourceBytesPerLine = this._width * this._bytesPerPixel;
  for (var y = this._height - 1; y >= 0; y--) {
    // buffer.writeUInt32LE(0, offset + numberOfBytesPerLine - 4);  // Ensure that padding
    // bytes are zeroes
    sourceOffset = y * numberOfSourceBytesPerLine;
    for (var x = 0; x < this._width; x++) {
      transferPixel.call(this);
      sourceOffset += this._bytesPerPixel;
      offset += this._bytesPerPixel;
    }
    if (extraBytes > 0) {
      buffer.fill(0, offset, offset + extraBytes);
      offset += extraBytes;
    }
  }

  return buffer;
};

/**
 * Saves the bitmap to a file in the <code>.bmp</code> format.
 *
 * @method module:lwim.Bitmap#save
 * @param {string} filePath
 */
Bitmap.prototype.save = function (filePath, options) {
  // Write file
  fs.writeFileSync(filePath, this.toBuffer(options));
};

function saveReadAndWriteFunction() {
  // Get read and write function according to bytes per pixel to be used directly
  switch (this._bytesPerPixel) {
    case 1:
    {
      this._readFunction = Buffer.prototype.readUInt8;
      this._writeFunction = Buffer.prototype.writeUInt8;
      break;
    }
    case 2:
    {
      if (this._endianness === Endianness.BIG) {
        this._readFunction = Buffer.prototype.readUInt16BE;
        this._writeFunction = Buffer.prototype.writeUInt16BE;
      } else {
        this._readFunction = Buffer.prototype.readUInt16LE;
        this._writeFunction = Buffer.prototype.writeUInt16LE;
      }
      break;
    }
    case 4:
    {
      if (this._endianness === Endianness.BIG) {
        this._readFunction = Buffer.prototype.readUInt32BE;
        this._writeFunction = Buffer.prototype.writeUInt32BE;
      } else {
        this._readFunction = Buffer.prototype.readUInt32LE;
        this._writeFunction = Buffer.prototype.writeUInt32LE;
      }
      break;
    }
  }
}
