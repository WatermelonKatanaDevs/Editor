/*!
 * Base-122 encoding and decoding adapted from Kevin Albertson's Base122.
 * Original project: https://github.com/kevinAlbs/Base122
 *
 * Copyright (c) 2016 Kevin Albertson
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function(global) {
  'use strict';

  const ILLEGALS = [0, 10, 13, 34, 38, 92];
  const utf8Decoder = new TextDecoder('utf-8', {fatal:true});

  function encode(rawData) {
    const data = rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData);
    let curIndex = 0;
    let curBit = 0;
    const output = new Uint8Array(Math.ceil(data.length * 8 / 7) + 2);
    let outputIndex = 0;

    function get7() {
      if (curIndex >= data.length) return false;
      const firstByte = data[curIndex];
      let firstPart = ((0b11111110 >>> curBit) & firstByte) << curBit;
      firstPart >>= 1;
      curBit += 7;
      if (curBit < 8) return firstPart;
      curBit -= 8;
      curIndex++;
      if (curIndex >= data.length) return firstPart;
      const secondByte = data[curIndex];
      let secondPart = ((0xFF00 >>> curBit) & secondByte) & 0xFF;
      secondPart >>= 8 - curBit;
      return firstPart | secondPart;
    }

    while (true) {
      const bits = get7();
      if (bits === false) break;
      const illegalIndex = ILLEGALS.indexOf(bits);
      if (illegalIndex !== -1) {
        let nextBits = get7();
        let first = 0b11000010;
        let second = 0b10000000;
        if (nextBits === false) {
          first |= 0b111 << 2;
          nextBits = bits;
        } else {
          first |= illegalIndex << 2;
        }
        first |= (nextBits & 0b01000000) ? 1 : 0;
        second |= nextBits & 0b00111111;
        output[outputIndex++] = first;
        output[outputIndex++] = second;
      } else {
        output[outputIndex++] = bits;
      }
    }

    return utf8Decoder.decode(output.subarray(0, outputIndex));
  }

  function decode(encodedData) {
    const strData = String(encodedData);
    const decoded = new Uint8Array(Math.floor(1.75 * strData.length));
    let decodedIndex = 0;
    let curByte = 0;
    let bitOfByte = 0;
    const illegals = [0, 10, 13, 34, 38, 92];

    function push7(byte) {
      byte <<= 1;
      curByte |= (byte >>> bitOfByte);
      bitOfByte += 7;
      if (bitOfByte >= 8) {
        decoded[decodedIndex++] = curByte;
        bitOfByte -= 8;
        curByte = (byte << (7 - bitOfByte)) & 255;
      }
    }

    for (let i = 0; i < strData.length; i++) {
      const character = strData.charCodeAt(i);
      if (character > 127) {
        const illegalIndex = (character >>> 8) & 7;
        if (illegalIndex !== 7) push7(illegals[illegalIndex]);
        push7(character & 127);
      } else {
        push7(character);
      }
    }
    return decoded.subarray(0, decodedIndex);
  }

  global.Base122 = Object.freeze({encode, decode});
})(window);
