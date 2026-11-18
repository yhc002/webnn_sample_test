'use strict';

// Minimal .npy binary format parser.
// Based on https://github.com/webmachinelearning/webnn-samples/blob/master/common/libs/numpy.js

class NpyArray {
  constructor(buffer) {
    const reader = new NpyReader(buffer);
    const signature = [0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59];
    if (!reader.bytes(6).every((v, i) => v === signature[i])) {
      throw new Error('Invalid .npy signature.');
    }
    const major = reader.byte();
    reader.byte(); // minor
    if (major !== 1) {
      throw new Error(`Unsupported .npy version ${major}.`);
    }
    const header = JSON.parse(
        reader.string().trim()
            .replace(/'/g, '"')
            .replace('False', 'false')
            .replace('(', '[')
            .replace(/,*\),*/g, ']'));
    if (header.fortran_order) {
      throw new Error('Fortran order is not supported.');
    }
    this.shape = header.shape;
    const byteOrder = header.descr[0];
    if (byteOrder !== '<' && byteOrder !== '>' && byteOrder !== '|') {
      throw new Error(`Unsupported byte order '${byteOrder}'.`);
    }
    this.dataType = header.descr.substring(1);
    if (byteOrder === '|') {
      this.data = reader.bytes(reader.size - reader.position);
    } else {
      const itemSize = parseInt(header.descr[2], 10);
      const totalItems = this.shape.reduce((a, b) => a * b, 1);
      this.data = reader.bytes(itemSize * totalItems);
    }
  }
}

class NpyReader {
  constructor(buffer) {
    this._buffer = buffer;
    this._position = 0;
  }

  get position() {
    return this._position;
  }

  get size() {
    return this._buffer.length;
  }

  byte() {
    return this._buffer[this._position++];
  }

  bytes(size) {
    const value = this._buffer.slice(this._position, this._position + size);
    this._position += size;
    return value;
  }

  string() {
    const size = this.byte() | (this.byte() << 8);
    let value = '';
    for (let i = 0; i < size; i++) {
      value += String.fromCharCode(this.byte());
    }
    return value;
  }
}

export {NpyArray};
