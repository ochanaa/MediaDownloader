var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, { get: all[name], enumerable: true });
};

// MediaDrop/node_modules/googlevideo/dist/src/core/CompositeBuffer.js
var CompositeBuffer;
var init_CompositeBuffer = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/core/CompositeBuffer.js"() {
    CompositeBuffer = class _CompositeBuffer {
      chunks;
      currentChunkOffset;
      currentChunkIndex;
      currentDataView;
      totalLength;
      constructor(chunks = []) {
        this.chunks = [];
        this.currentChunkOffset = this.currentChunkIndex = 0;
        this.currentDataView = void 0;
        this.totalLength = 0;
        for (const chunk of chunks)
          this.append(chunk);
      }
      /**
       * Appends a chunk or all chunks from another {@link CompositeBuffer} to this buffer.
       * Chunks using the same `ArrayBuffer` are merged into a single `Uint8Array` to reduce memory usage and keep the number of chunks low.
       * @param data - A `Uint8Array` to append, or another `CompositeBuffer` whose chunks will be appended individually.
       */
      append(data) {
        if (data instanceof Uint8Array) {
          if (this.canMergeWithLastChunk(data)) {
            const lastChunk = this.chunks[this.chunks.length - 1];
            this.chunks[this.chunks.length - 1] = new Uint8Array(lastChunk.buffer, lastChunk.byteOffset, lastChunk.length + data.length);
            this.resetFocus();
          } else
            this.chunks.push(data);
          this.totalLength += data.length;
        } else {
          for (const chunk of data.chunks)
            this.append(chunk);
        }
      }
      /**
       * Splits this buffer at a specified position.
       * @param position - Offset at which to split the buffer.
       * @returns Obj containing the bytes before `position` as `extractedBuffer` and the bytes from `position` onward as `remainingBuffer`.
       */
      split(position) {
        const extractedBuffer = new _CompositeBuffer();
        const remainingBuffer = new _CompositeBuffer();
        for (const chunk of this.chunks) {
          if (position >= chunk.length) {
            extractedBuffer.append(chunk);
            position -= chunk.length;
          } else if (position > 0) {
            extractedBuffer.append(new Uint8Array(chunk.buffer, chunk.byteOffset, position));
            remainingBuffer.append(new Uint8Array(chunk.buffer, chunk.byteOffset + position, chunk.length - position));
            position = 0;
          } else
            remainingBuffer.append(chunk);
        }
        return { extractedBuffer, remainingBuffer };
      }
      getLength() {
        return this.totalLength;
      }
      canReadBytes(position, length) {
        return position + length <= this.totalLength;
      }
      /**
       * Reads a single unsigned byte at the given position.
       */
      getUint8(position) {
        this.focus(position);
        return this.chunks[this.currentChunkIndex][position - this.currentChunkOffset];
      }
      /**
       * Moves the internal focus to the chunk containing the specified position.
       * If the position is before the currently focused chunk, focus is reset first.
       * Cached `currentDataView` is also invalidated.
       */
      focus(position) {
        if (!this.isFocused(position)) {
          for (position < this.currentChunkOffset && this.resetFocus(); this.currentChunkOffset + this.chunks[this.currentChunkIndex].length <= position && this.currentChunkIndex < this.chunks.length; ) {
            this.currentChunkOffset += this.chunks[this.currentChunkIndex].length;
            this.currentChunkIndex += 1;
          }
          this.currentDataView = void 0;
        }
      }
      /**
       * Checks whether the internal focus already covers the specified position.
       * @returns `true` if `position` is within the currently focused chunk.
       */
      isFocused(position) {
        return position >= this.currentChunkOffset && position < this.currentChunkOffset + this.chunks[this.currentChunkIndex].length;
      }
      /**
       * Resets the internal focus to the beginning of the buffer.
       */
      resetFocus() {
        this.currentDataView = void 0;
        this.currentChunkIndex = 0;
        this.currentChunkOffset = 0;
      }
      /**
       * Determines whether the given chunk can be merged with the last chunk.
       * Merging is possible when both reference the same buffer and the
       * new chunk starts exactly where the current last chunk ends.
       */
      canMergeWithLastChunk(chunk) {
        if (this.chunks.length === 0)
          return false;
        const lastChunk = this.chunks[this.chunks.length - 1];
        return lastChunk.buffer === chunk.buffer && lastChunk.byteOffset + lastChunk.length === chunk.byteOffset;
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/core/UmpReader.js
var UmpReader;
var init_UmpReader = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/core/UmpReader.js"() {
    init_CompositeBuffer();
    UmpReader = class {
      callbacks;
      compositeBuffer;
      pendingType;
      pendingOffset;
      pendingTotalSize;
      constructor(callbacks) {
        this.callbacks = callbacks;
        this.compositeBuffer = new CompositeBuffer();
      }
      async feed(chunk) {
        this.compositeBuffer.append(chunk);
        return this.parse();
      }
      async parse() {
        if (this.pendingType !== void 0) {
          if (this.compositeBuffer.totalLength === 0)
            return;
          const needed = this.pendingTotalSize - this.pendingOffset;
          const split = this.compositeBuffer.split(needed);
          if (!this.callbacks.onPartialPart)
            return;
          if (!this.callbacks.onPartialPart(this.pendingType, split.extractedBuffer, this.pendingOffset, this.pendingTotalSize))
            return;
          this.pendingOffset += split.extractedBuffer.totalLength;
          this.compositeBuffer = split.remainingBuffer;
          if (this.pendingOffset === this.pendingTotalSize) {
            this.pendingType = void 0;
            this.pendingTotalSize = void 0;
            this.pendingOffset = void 0;
          }
        }
        while (true) {
          let offset = 0;
          const [partType, newOffset] = this.readVarInt(offset);
          offset = newOffset;
          const [partSize, finalOffset] = this.readVarInt(offset);
          offset = finalOffset;
          if (partType < 0 || partSize < 0)
            break;
          if (!this.compositeBuffer.canReadBytes(offset, partSize)) {
            if (!(this.callbacks.onPartialPart && this.compositeBuffer.canReadBytes(offset, 1)))
              break;
            const remainingBuff = this.compositeBuffer.split(offset).remainingBuffer;
            if (this.callbacks.onPartialPart(partType, remainingBuff, 0, partSize)) {
              this.pendingType = partType;
              this.pendingOffset = remainingBuff.totalLength;
              this.pendingTotalSize = partSize;
              this.compositeBuffer = new CompositeBuffer();
            }
            break;
          }
          const payloadStart = this.compositeBuffer.split(offset).remainingBuffer;
          const finalSplit = payloadStart.split(partSize);
          await this.callbacks.onPart(partType, finalSplit.extractedBuffer);
          this.compositeBuffer = finalSplit.remainingBuffer;
        }
      }
      /**
       * Reads a specific varint from the current buffer offset.
       * @returns [decodedValue, updatedOffset] or [-1, originalOffset] if incomplete.
       */
      readVarInt(offset) {
        if (!this.compositeBuffer.canReadBytes(offset, 1)) {
          return [-1, offset];
        }
        const firstByte = this.compositeBuffer.getUint8(offset);
        const byteLength = firstByte < 128 ? 1 : firstByte < 192 ? 2 : firstByte < 224 ? 3 : firstByte < 240 ? 4 : 5;
        if (!this.compositeBuffer.canReadBytes(offset, byteLength))
          return [-1, offset];
        let value = 0;
        switch (byteLength) {
          case 1: {
            value = this.compositeBuffer.getUint8(offset++);
            break;
          }
          case 2: {
            const b1 = this.compositeBuffer.getUint8(offset++);
            const b2 = this.compositeBuffer.getUint8(offset++);
            value = b1 & 63 | b2 << 6;
            break;
          }
          case 3: {
            const b1 = this.compositeBuffer.getUint8(offset++);
            const b2 = this.compositeBuffer.getUint8(offset++);
            const b3 = this.compositeBuffer.getUint8(offset++);
            value = b1 & 31 | b2 << 5 | b3 << 13;
            break;
          }
          case 4: {
            const b1 = this.compositeBuffer.getUint8(offset++);
            const b2 = this.compositeBuffer.getUint8(offset++);
            const b3 = this.compositeBuffer.getUint8(offset++);
            const b4 = this.compositeBuffer.getUint8(offset++);
            value = b1 & 15 | b2 << 4 | b3 << 12 | b4 << 20;
            break;
          }
          default: {
            const dataOffset = offset + 1;
            this.compositeBuffer.focus(dataOffset);
            if (this.canReadFromCurrentChunk(dataOffset, 4)) {
              const relativeOffset = dataOffset - this.compositeBuffer.currentChunkOffset;
              value = this.getCurrentDataView().getUint32(relativeOffset, true);
            } else {
              const b1 = this.compositeBuffer.getUint8(dataOffset);
              const b2 = this.compositeBuffer.getUint8(dataOffset + 1);
              const b3 = this.compositeBuffer.getUint8(dataOffset + 2);
              const b4 = this.compositeBuffer.getUint8(dataOffset + 3);
              value = (b1 | b2 << 8 | b3 << 16 | b4 << 24) >>> 0;
            }
            offset += 5;
            break;
          }
        }
        return [value, offset];
      }
      /**
       * Checks if the specified bytes can be read from the current chunk.
       * @param offset - Position to start reading from.
       * @param length - Number of bytes to read.
       * @returns True if bytes can be read from current chunk, false otherwise.
       */
      canReadFromCurrentChunk(offset, length) {
        const activeChunk = this.compositeBuffer.chunks[this.compositeBuffer.currentChunkIndex];
        return offset - this.compositeBuffer.currentChunkOffset + length <= activeChunk.length;
      }
      /**
       * Gets a DataView of the current chunk, creating it if necessary.
       * @returns DataView for the current chunk.
       */
      getCurrentDataView() {
        if (!this.compositeBuffer.currentDataView) {
          const currentChunk = this.compositeBuffer.chunks[this.compositeBuffer.currentChunkIndex];
          this.compositeBuffer.currentDataView = new DataView(currentChunk.buffer, currentChunk.byteOffset, currentChunk.length);
        }
        return this.compositeBuffer.currentDataView;
      }
      dispose() {
        this.compositeBuffer = new CompositeBuffer();
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/Logger.js
var LogLevel, Logger;
var init_Logger = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/Logger.js"() {
    LogLevel = {
      NONE: 0,
      0: "NONE",
      ERROR: 1,
      1: "ERROR",
      WARN: 2,
      2: "WARN",
      INFO: 3,
      3: "INFO",
      DEBUG: 4,
      4: "DEBUG",
      ALL: 99,
      99: "ALL"
    };
    Logger = class _Logger {
      static instance;
      currentLogLevels = /* @__PURE__ */ new Set([LogLevel.INFO, LogLevel.ERROR]);
      static getInstance() {
        if (!_Logger.instance)
          _Logger.instance = new _Logger();
        return _Logger.instance;
      }
      /**
       * Sets the active log levels.
       * Call with {@link LogLevel.NONE} or no arguments to turn off all logging.
       * Otherwise, specify one or more log levels to be active.
       * Use {@link LogLevel.ALL} to enable all log levels.
       */
      setLogLevels(...levels) {
        if (levels.length === 0 || levels.includes(LogLevel.NONE)) {
          this.currentLogLevels = /* @__PURE__ */ new Set();
        } else if (levels.includes(LogLevel.ALL)) {
          this.currentLogLevels = /* @__PURE__ */ new Set([
            LogLevel.ERROR,
            LogLevel.WARN,
            LogLevel.INFO,
            LogLevel.DEBUG
          ]);
        } else
          this.currentLogLevels = new Set(levels.filter((level) => level !== LogLevel.NONE && level !== LogLevel.ALL));
      }
      /**
       * Gets the current set of active log levels.
       * @returns A new Set containing the active LogLevel enums.
       */
      getLogLevels() {
        return new Set(this.currentLogLevels);
      }
      log(level, tag, ...messages) {
        if (level !== LogLevel.NONE && this.currentLogLevels.has(level)) {
          const prefix = `[${LogLevel[level]}] [${tag}]`;
          switch (level) {
            case LogLevel.ERROR:
              console.error(prefix, ...messages);
              break;
            case LogLevel.WARN:
              console.warn(prefix, ...messages);
              break;
            case LogLevel.INFO:
              console.info(prefix, ...messages);
              break;
            case LogLevel.DEBUG:
              console.debug(prefix, ...messages);
              break;
          }
        }
      }
      error(tag, ...messages) {
        this.log(LogLevel.ERROR, tag, ...messages);
      }
      warn(tag, ...messages) {
        this.log(LogLevel.WARN, tag, ...messages);
      }
      info(tag, ...messages) {
        this.log(LogLevel.INFO, tag, ...messages);
      }
      debug(tag, ...messages) {
        this.log(LogLevel.DEBUG, tag, ...messages);
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/uint8arrayUtils.js
function u8ToBase64(u8) {
  return btoa(String.fromCharCode.apply(null, Array.from(u8)));
}
function base64ToU8(base64) {
  const standardBase64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = standardBase64.padEnd(standardBase64.length + (4 - standardBase64.length % 4) % 4, "=");
  return new Uint8Array(atob(paddedBase64).split("").map((char) => char.charCodeAt(0)));
}
function concatenateChunks(chunks) {
  const chunkCount = chunks.length;
  let totalLength = 0;
  for (let i = 0; i < chunkCount; i++)
    totalLength += chunks[i].length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < chunkCount; i++) {
    const chunk = chunks[i];
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
function decodePart(chunks, decoder) {
  if (!chunks.length)
    return void 0;
  try {
    return decoder.decode(concatenateChunks(chunks));
  } catch {
    return void 0;
  }
}
var init_uint8arrayUtils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/uint8arrayUtils.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/mediaCapabilityUtils.js
function buildAudioCapability(format, isSurroundSupported = true) {
  const codecCode = format.codecCode;
  if (!codecCode || codecCode === "f")
    return void 0;
  if (!isSurroundSupported && surroundAudioCodes.has(codecCode))
    return void 0;
  return {
    audioCodec: AUDIO_CODECS[codecCode],
    spatialCapabilityBitmask: SPATIAL_AUDIO_CODECS[codecCode],
    numChannels: format.numChannels
  };
}
function buildVideoCapability(format) {
  const codecCode = format.codecCode;
  if (!codecCode || codecCode === "f")
    return void 0;
  return {
    videoCodec: VIDEO_CODECS[codecCode],
    maxWidth: format.width || 0,
    maxHeight: format.height || 0,
    maxFramerate: format.fps || 0,
    is10BitSupported: !!format.isHdr,
    maxBitrateBps: format.bitrate || 0,
    efficient: true
  };
}
function buildMediaCapabilities(videoFormat, audioFormat, isSurroundSupported = true) {
  const video = videoFormat ? buildVideoCapability(videoFormat) : void 0;
  const audio = audioFormat ? buildAudioCapability(audioFormat, isSurroundSupported) : void 0;
  if (!video && !audio)
    return void 0;
  return {
    videoFormatCapabilities: video ? [video] : [],
    audioFormatCapabilities: audio ? [audio] : [],
    hdrModeBitmask: 3
  };
}
var CODEC_CODES, AUDIO_CODECS, SPATIAL_AUDIO_CODECS, VIDEO_CODECS, surroundAudioCodes;
var init_mediaCapabilityUtils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/mediaCapabilityUtils.js"() {
    CODEC_CODES = {
      0: "f",
      160: "h",
      133: "h",
      134: "h",
      135: "h",
      136: "h",
      137: "h",
      264: "h",
      266: "h",
      138: "h",
      298: "h",
      299: "h",
      304: "h",
      305: "h",
      214: "h",
      216: "h",
      374: "h",
      375: "h",
      140: "a",
      141: "a",
      327: "sa",
      258: "m",
      380: "mac3",
      328: "meac3",
      161: "H",
      142: "H",
      143: "H",
      144: "H",
      222: "H",
      223: "H",
      145: "H",
      224: "H",
      225: "H",
      146: "H",
      226: "H",
      227: "H",
      147: "H",
      384: "H",
      376: "H",
      385: "H",
      377: "H",
      149: "A",
      261: "M",
      381: "MAC3",
      329: "MEAC3",
      598: "9",
      278: "9",
      242: "9",
      243: "9",
      244: "9",
      775: "9",
      776: "9",
      777: "9",
      778: "9",
      779: "9",
      780: "9",
      781: "9",
      782: "9",
      783: "9",
      247: "9",
      248: "9",
      353: "9",
      355: "9",
      356: "9",
      271: "9",
      577: "9",
      313: "9",
      579: "9",
      272: "9",
      302: "9",
      303: "9",
      407: "9",
      408: "9",
      308: "9",
      315: "9",
      330: "9h",
      331: "9h",
      332: "9h",
      333: "9h",
      334: "9h",
      335: "9h",
      336: "9h",
      337: "9h",
      338: "so",
      600: "o",
      250: "o",
      251: "o",
      774: "o",
      194: "*",
      195: "*",
      220: "*",
      221: "*",
      196: "*",
      197: "*",
      279: "(",
      280: "(",
      317: "(",
      318: "(",
      273: "(",
      274: "(",
      357: "(",
      358: "(",
      275: "(",
      359: "(",
      360: "(",
      276: "(",
      583: "(",
      584: "(",
      314: "(",
      585: "(",
      561: "(",
      277: "(",
      361: "(h",
      362: "(h",
      363: "(h",
      364: "(h",
      365: "(h",
      366: "(h",
      591: "(h",
      592: "(h",
      367: "(h",
      586: "(h",
      587: "(h",
      368: "(h",
      588: "(h",
      562: "(h",
      409: "(",
      410: "(",
      411: "(",
      412: "(",
      557: "(",
      558: "(",
      394: "1",
      395: "1",
      396: "1",
      397: "1",
      716: "1",
      717: "1",
      919: "1",
      398: "1",
      718: "1",
      719: "1",
      399: "1",
      720: "1",
      721: "1",
      400: "1",
      722: "1",
      723: "1",
      401: "1",
      724: "1",
      725: "1",
      571: "1",
      402: "1",
      694: "1h",
      695: "1h",
      696: "1h",
      697: "1h",
      698: "1h",
      699: "1h",
      700: "1h",
      701: "1h",
      702: "1h",
      703: "1h",
      386: "3",
      387: "w",
      406: "6",
      787: "1",
      788: "1",
      917: "1",
      918: "1",
      548: "1e",
      549: "1e",
      550: "1e",
      551: "1e",
      809: "1e",
      810: "1e",
      552: "1e",
      811: "1e",
      812: "1e",
      553: "1e",
      813: "1e",
      814: "1e",
      554: "1e",
      815: "1e",
      816: "1e",
      555: "1e",
      817: "1e",
      818: "1e",
      572: "1e",
      556: "1e",
      645: "(",
      646: "(",
      647: "(",
      648: "(",
      649: "(",
      650: "(",
      651: "(",
      652: "(",
      653: "(",
      654: "(",
      655: "(",
      656: "(",
      657: "(",
      658: "(",
      659: "(",
      660: "(",
      661: "(",
      662: "(",
      663: "(",
      664: "(",
      665: "(",
      666: "(",
      667: "(",
      668: "(",
      669: "(",
      670: "(",
      671: "(",
      672: "(",
      673: "(",
      674: "(h",
      675: "(h",
      676: "(h",
      677: "(h",
      678: "(h",
      679: "(h",
      680: "(h",
      681: "(h",
      682: "(h",
      683: "(h",
      684: "(h",
      685: "(h",
      686: "(h",
      687: "(h",
      688: "A",
      689: "A",
      690: "A",
      691: "MEAC3",
      773: "i",
      806: "I",
      805: "I",
      829: "9",
      830: "9",
      831: "9",
      832: "9",
      833: "9",
      834: "9",
      835: "9",
      836: "9",
      892: "9",
      893: "9",
      837: "9",
      838: "9",
      839: "9",
      840: "9",
      841: "(",
      842: "(",
      843: "(",
      844: "(",
      845: "(",
      846: "(",
      847: "(",
      848: "(",
      894: "(",
      895: "(",
      849: "(",
      850: "(",
      851: "(",
      852: "(",
      865: "9",
      866: "9",
      867: "9",
      868: "9",
      869: "9",
      870: "9",
      871: "9",
      872: "9",
      896: "9",
      897: "9",
      873: "9",
      874: "9",
      875: "9",
      876: "9",
      877: "(",
      878: "(",
      879: "(",
      880: "(",
      881: "(",
      882: "(",
      883: "(",
      884: "(",
      898: "(",
      899: "(",
      885: "(",
      886: "(",
      887: "(",
      888: "(",
      900: "2",
      901: "2",
      902: "2",
      903: "2",
      904: "2",
      905: "2",
      906: "2",
      907: "2",
      908: "2",
      911: "9",
      912: "9",
      913: "9",
      914: "1",
      915: "1",
      916: "1"
    };
    AUDIO_CODECS = {
      o: 3,
      O: 3,
      so: 3,
      a: 1,
      ah: 1,
      A: 1,
      m: 1,
      M: 1,
      sa: 1,
      mac3: 7,
      MAC3: 7,
      meac3: 5,
      MEAC3: 5,
      i: 13,
      I: 13
    };
    SPATIAL_AUDIO_CODECS = {
      o: 0,
      O: 0,
      a: 0,
      ah: 0,
      A: 0,
      m: 1,
      M: 1,
      mac3: 1,
      MAC3: 1,
      meac3: 1,
      MEAC3: 1,
      so: 4,
      sa: 4,
      i: 0,
      I: 0
    };
    VIDEO_CODECS = {
      ["1h"]: 8,
      ["9h"]: 4,
      ["1"]: 8,
      ["9"]: 4,
      ["("]: 4,
      h: 2,
      H: 2
    };
    surroundAudioCodes = /* @__PURE__ */ new Set(["m", "M", "mac3", "MAC3", "meac3", "MEAC3", "i", "I"]);
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  const buf = this.buf;
  let pos = this.pos;
  let lo = 0;
  let hi = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    const b = buf[pos++];
    lo |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  const middleByte = buf[pos++];
  lo |= (middleByte & 15) << 28;
  hi = (middleByte & 112) >> 4;
  if ((middleByte & 128) == 0) {
    this.pos = pos;
    this.assertBounds();
    this.varint64Lo = lo;
    this.varint64Hi = hi;
    return;
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    const b = buf[pos++];
    hi |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.pos = pos;
      this.assertBounds();
      this.varint64Lo = lo;
      this.varint64Hi = hi;
      return;
    }
  }
  throw new Error("invalid varint");
}
function int64FromString(dec) {
  const minus = dec[0] === "-";
  if (minus) {
    dec = dec.slice(1);
  }
  const base2 = 1e6;
  let lowBits = 0;
  let highBits = 0;
  function add1e6digit(begin, end) {
    const digit1e6 = Number(dec.slice(begin, end));
    highBits *= base2;
    lowBits = lowBits * base2 + digit1e6;
    if (lowBits >= TWO_PWR_32_DBL) {
      highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
      lowBits = lowBits % TWO_PWR_32_DBL;
    }
  }
  add1e6digit(-24, -18);
  add1e6digit(-18, -12);
  add1e6digit(-12, -6);
  add1e6digit(-6);
  return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi);
  const negative = bits.hi & 2147483648;
  if (negative) {
    bits = negate(bits.lo, bits.hi);
  }
  const result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
  ({ lo, hi } = toUnsigned(lo, hi));
  if (hi <= 2097151) {
    return String(TWO_PWR_32_DBL * hi + lo);
  }
  const low = lo & 16777215;
  const mid = (lo >>> 24 | hi << 8) & 16777215;
  const high = hi >> 16 & 65535;
  let digitA = low + mid * 6777216 + high * 6710656;
  let digitB = mid + high * 8147497;
  let digitC = high * 2;
  const base2 = 1e7;
  if (digitA >= base2) {
    digitB += Math.floor(digitA / base2);
    digitA %= base2;
  }
  if (digitB >= base2) {
    digitC += Math.floor(digitB / base2);
    digitB %= base2;
  }
  return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
function negate(lowBits, highBits) {
  highBits = ~highBits;
  if (lowBits) {
    lowBits = ~lowBits + 1;
  } else {
    highBits += 1;
  }
  return newBits(lowBits, highBits);
}
function varint32read() {
  let b = this.buf[this.pos++];
  if ((b & 128) === 0) {
    this.assertBounds();
    return b;
  }
  let result = b & 127;
  b = this.buf[this.pos++];
  result |= (b & 127) << 7;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 14;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 21;
  if ((b & 128) === 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) !== 0)
    throw new Error("invalid varint");
  this.assertBounds();
  return result >>> 0;
}
var TWO_PWR_32_DBL, decimalFrom1e7WithLeadingZeros;
var init_varint = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js"() {
    TWO_PWR_32_DBL = 4294967296;
    decimalFrom1e7WithLeadingZeros = (digit1e7) => {
      const partial = String(digit1e7);
      return "0000000".slice(partial.length) + partial;
    };
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
function makeInt64Support() {
  const dv = new DataView(new ArrayBuffer(8));
  const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
  if (ok) {
    const MIN = BigInt("-9223372036854775808");
    const MAX = BigInt("9223372036854775807");
    const UMIN = BigInt("0");
    const UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: true,
      parse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN) {
          throw new Error(`invalid int64: ${value}`);
        }
        return bi;
      },
      uParse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN) {
          throw new Error(`invalid uint64: ${value}`);
        }
        return bi;
      },
      enc(value) {
        dv.setBigInt64(0, this.parse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      uEnc(value) {
        dv.setBigInt64(0, this.uParse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      dec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
      },
      uDec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigUint64(0, true);
      }
    };
  }
  return {
    zero: "0",
    supported: false,
    parse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return value;
    },
    uParse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return value;
    },
    enc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return int64FromString(value);
    },
    uEnc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value)) {
    throw new Error("invalid int64: " + value);
  }
}
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error("invalid uint64: " + value);
  }
}
var protoInt64;
var init_proto_int64 = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js"() {
    init_varint();
    protoInt64 = /* @__PURE__ */ makeInt64Support();
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
function configureTextEncoding(textEncoding) {
  var _a;
  te = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
}
function getTextEncoding() {
  if (!te) {
    const globals = globalThis;
    if (!globals.TextEncoder || !globals.TextDecoder) {
      throw new Error("encoding API missing: install TextEncoder and TextDecoder on globalThis");
    }
    const textEncoder = new globals.TextEncoder();
    const textDecoder2 = new globals.TextDecoder("utf-8", {
      ignoreBOM: true
    });
    let textDecoderStrict;
    const config = {
      encodeUtf8(text2) {
        return textEncoder.encode(text2);
      },
      decodeUtf8(bytes, strict) {
        if (strict) {
          if (!textDecoderStrict) {
            textDecoderStrict = new globals.TextDecoder("utf-8", {
              fatal: true,
              ignoreBOM: true
            });
          }
          return textDecoderStrict.decode(bytes);
        }
        return textDecoder2.decode(bytes);
      },
      checkUtf8(text2) {
        try {
          encodeURIComponent(text2);
          return true;
        } catch (_) {
          return false;
        }
      }
    };
    if (textEncoder.encodeInto) {
      config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder);
    }
    const nativeStringIsWellFormed = String.prototype.isWellFormed;
    if (nativeStringIsWellFormed) {
      config.checkUtf8 = (text2) => {
        return nativeStringIsWellFormed.call(text2);
      };
    }
    configureTextEncoding(config);
  }
  return te;
}
function emulateEncodeInto(encodeUtf8) {
  return (text2, dest) => {
    const bytes = encodeUtf8(text2);
    dest.set(bytes);
    return { written: bytes.byteLength };
  };
}
var te;
var init_text_encoding = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js"() {
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
function varint32Size(value) {
  if (value < 128)
    return 1;
  if (value < 16384)
    return 2;
  if (value < 2097152)
    return 3;
  if (value < 268435456)
    return 4;
  return 5;
}
function assertInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid int32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
function assertUInt32(arg) {
  if (typeof arg == "string") {
    arg = Number(arg);
  } else if (typeof arg != "number") {
    throw new Error("invalid uint32: " + typeof arg);
  }
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
function assertFloat32(arg) {
  if (typeof arg == "string") {
    const o = arg;
    arg = Number(arg);
    if (Number.isNaN(arg) && o !== "NaN") {
      throw new Error("invalid float32: " + o);
    }
  } else if (typeof arg != "number") {
    throw new Error("invalid float32: " + typeof arg);
  }
  if (!Number.isFinite(Math.fround(arg)) && Number.isFinite(arg)) {
    throw new Error("invalid float32: " + arg);
  }
}
var WireType, UINT32_MAX, INT32_MAX, INT32_MIN, BinaryWriter, INITIAL_SIZE, DEFAULT_LEN_PREFIX_SIZE, EMPTY_BUFFER, EMPTY_VIEW, ASCII_MAX_LENGTH, BinaryReader;
var init_binary_encoding = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js"() {
    init_varint();
    init_proto_int64();
    init_text_encoding();
    (function(WireType2) {
      WireType2[WireType2["Varint"] = 0] = "Varint";
      WireType2[WireType2["Bit64"] = 1] = "Bit64";
      WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
      WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
      WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
      WireType2[WireType2["Bit32"] = 5] = "Bit32";
    })(WireType || (WireType = {}));
    UINT32_MAX = 4294967295;
    INT32_MAX = 2147483647;
    INT32_MIN = -2147483648;
    BinaryWriter = class {
      constructor(encodeUtf8) {
        this.stackPos = [];
        this.encodeUtf8Into = encodeUtf8 ? emulateEncodeInto(encodeUtf8) : getTextEncoding().encodeUtf8Into;
        this.buffer = EMPTY_BUFFER;
        this.viewCache = EMPTY_VIEW;
        this.pos = 0;
      }
      ensureCapacity(size) {
        const required = this.pos + size;
        if (required > this.buffer.length) {
          let newLen = this.buffer.length || INITIAL_SIZE;
          while (newLen < required)
            newLen *= 2;
          const newBuf = new Uint8Array(newLen);
          if (this.pos > 0)
            newBuf.set(this.buffer);
          this.buffer = newBuf;
        }
      }
      /**
       * The DataView over `buffer`, rebuilt only if the buffer has grown since it
       * was last used.
       */
      view() {
        const bytes = this.buffer;
        const view = this.viewCache;
        if (view.byteLength === bytes.byteLength)
          return view;
        const newView = new DataView(bytes.buffer);
        this.viewCache = newView;
        return newView;
      }
      /**
       * Return all bytes written and reset this writer.
       */
      finish() {
        const result = this.buffer.slice(0, this.pos);
        this.pos = 0;
        this.stackPos = [];
        return result;
      }
      /**
       * Start a new fork for length-delimited data like a message
       * or a packed repeated field.
       *
       * Must be joined later with `join()`.
       */
      fork() {
        this.stackPos.push(this.pos);
        this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE);
        this.buffer[this.pos++] = 0;
        return this;
      }
      /**
       * Join the last fork. Write its length and bytes, then
       * return to the previous state.
       */
      join() {
        const forkPos = this.stackPos.pop();
        if (forkPos === void 0)
          throw new Error("invalid state, fork stack empty");
        const len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE;
        const lenPrefixSize = varint32Size(len);
        if (lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE) {
          this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE);
          this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos);
        }
        this.pos = forkPos;
        this.uint32(len);
        this.pos += len;
        return this;
      }
      /**
       * Writes a tag (field number and wire type).
       *
       * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
       *
       * Generated code should compute the tag ahead of time and call `uint32()`.
       */
      tag(fieldNo, type) {
        return this.uint32((fieldNo << 3 | type) >>> 0);
      }
      /**
       * Write a chunk of raw bytes.
       */
      raw(chunk) {
        this.ensureCapacity(chunk.length);
        this.buffer.set(chunk, this.pos);
        this.pos += chunk.length;
        return this;
      }
      /**
       * Write a `uint32` value, an unsigned 32 bit varint.
       */
      uint32(value) {
        assertUInt32(value);
        this.ensureCapacity(5);
        if (value < 128) {
          this.buffer[this.pos++] = value;
          return this;
        }
        while (value > 127) {
          this.buffer[this.pos++] = value & 127 | 128;
          value >>>= 7;
        }
        this.buffer[this.pos++] = value;
        return this;
      }
      /**
       * Write a `int32` value, a signed 32 bit varint.
       */
      int32(value) {
        assertInt32(value);
        if (value >= 0) {
          return this.uint32(value);
        }
        this.ensureCapacity(10);
        for (let i = 0; i < 9; i++) {
          this.buffer[this.pos++] = value & 127 | 128;
          value >>= 7;
        }
        this.buffer[this.pos++] = 1;
        return this;
      }
      /**
       * Write a `bool` value, a varint.
       */
      bool(value) {
        this.ensureCapacity(1);
        this.buffer[this.pos++] = value ? 1 : 0;
        return this;
      }
      /**
       * Write a `bytes` value, length-delimited arbitrary data.
       */
      bytes(value) {
        this.uint32(value.byteLength);
        return this.raw(value);
      }
      /**
       * Write a `string` value, length-delimited data converted to UTF-8 text.
       */
      string(value) {
        if (typeof value !== "string") {
          value = String(value);
        }
        const len = value.length;
        if (len <= ASCII_MAX_LENGTH) {
          this.ensureCapacity(len + 1);
          const ascii = this.buffer;
          let pos = this.pos;
          ascii[pos++] = len;
          let i = 0;
          for (; i < len; i++) {
            const code = value.charCodeAt(i);
            if (code > 127)
              break;
            ascii[pos++] = code;
          }
          if (i == len) {
            this.pos = pos;
            return this;
          }
        }
        this.ensureCapacity(len * 3 + 5);
        const lenPrefixSizeGuess = varint32Size(len);
        const buf = this.buffer;
        const start = this.pos;
        const { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess));
        const lenPrefixSize = varint32Size(written);
        if (lenPrefixSize != lenPrefixSizeGuess) {
          buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written);
        }
        this.uint32(written);
        this.pos += written;
        return this;
      }
      /**
       * Write a `float` value, 32-bit floating point number.
       */
      float(value) {
        assertFloat32(value);
        this.ensureCapacity(4);
        this.view().setFloat32(this.pos, value, true);
        this.pos += 4;
        return this;
      }
      /**
       * Write a `double` value, a 64-bit floating point number.
       */
      double(value) {
        this.ensureCapacity(8);
        this.view().setFloat64(this.pos, value, true);
        this.pos += 8;
        return this;
      }
      /**
       * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
       */
      fixed32(value) {
        assertUInt32(value);
        this.ensureCapacity(4);
        this.view().setUint32(this.pos, value, true);
        this.pos += 4;
        return this;
      }
      /**
       * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
       */
      sfixed32(value) {
        assertInt32(value);
        this.ensureCapacity(4);
        this.view().setInt32(this.pos, value, true);
        this.pos += 4;
        return this;
      }
      /**
       * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
       */
      sint32(value) {
        assertInt32(value);
        return this.uint32((value << 1 ^ value >> 31) >>> 0);
      }
      /**
       * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
       */
      sfixed64(value) {
        const tc = protoInt64.enc(value);
        this.ensureCapacity(8);
        const view = this.view();
        view.setInt32(this.pos, tc.lo, true);
        view.setInt32(this.pos + 4, tc.hi, true);
        this.pos += 8;
        return this;
      }
      /**
       * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
       */
      fixed64(value) {
        const tc = protoInt64.uEnc(value);
        this.ensureCapacity(8);
        const view = this.view();
        view.setInt32(this.pos, tc.lo, true);
        view.setInt32(this.pos + 4, tc.hi, true);
        this.pos += 8;
        return this;
      }
      /**
       * Write a `int64` value, a signed 64-bit varint.
       */
      int64(value) {
        const tc = protoInt64.enc(value);
        return this.writeVarint64(tc.lo, tc.hi);
      }
      /**
       * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
       */
      sint64(value) {
        const tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
        return this.writeVarint64(lo, hi);
      }
      /**
       * Write a `uint64` value, an unsigned 64-bit varint.
       */
      uint64(value) {
        const tc = protoInt64.uEnc(value);
        return this.writeVarint64(tc.lo, tc.hi);
      }
      /**
       * Write a 64-bit varint directly into the buffer. Accepts the value as
       * split low/high 32-bit words.
       *
       * Ported from varint64write() to avoid the intermediate number[] buffer.
       * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
       */
      writeVarint64(lo, hi) {
        this.ensureCapacity(10);
        const buf = this.buffer;
        let pos = this.pos;
        for (let i = 0; i < 28; i = i + 7) {
          const shift = lo >>> i;
          const hasNext = !(shift >>> 7 == 0 && hi == 0);
          buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
          if (!hasNext) {
            this.pos = pos;
            return this;
          }
        }
        const splitBits = lo >>> 28 & 15 | (hi & 7) << 4;
        const hasMoreBits = !(hi >> 3 == 0);
        buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255;
        if (!hasMoreBits) {
          this.pos = pos;
          return this;
        }
        for (let i = 3; i < 31; i = i + 7) {
          const shift = hi >>> i;
          const hasNext = !(shift >>> 7 == 0);
          buf[pos++] = (hasNext ? shift | 128 : shift) & 255;
          if (!hasNext) {
            this.pos = pos;
            return this;
          }
        }
        buf[pos++] = hi >>> 31 & 1;
        this.pos = pos;
        return this;
      }
    };
    INITIAL_SIZE = 128;
    DEFAULT_LEN_PREFIX_SIZE = 1;
    EMPTY_BUFFER = new Uint8Array(0);
    EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer);
    ASCII_MAX_LENGTH = 32;
    BinaryReader = class {
      constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
        this.decodeUtf8 = decodeUtf8;
        this.varint64Lo = 0;
        this.varint64Hi = 0;
        this.varint64 = varint64read;
        this.uint32 = varint32read;
        this.buf = buf;
        this.len = buf.length;
        this.pos = 0;
        this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      }
      /**
       * Reads a tag - field number and wire type. Tags are uint32 varints; values
       * that do not fit in uint32 are rejected.
       */
      tag() {
        const start = this.pos;
        const tag = this.uint32();
        const bytesRead = this.pos - start;
        if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15) {
          throw new Error("illegal tag: varint overflows uint32");
        }
        const fieldNo = tag >>> 3;
        const wireType = tag & 7;
        if (fieldNo <= 0 || wireType > 5) {
          throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
        }
        return [fieldNo, wireType];
      }
      /**
       * Skip one element and return the skipped data.
       *
       * When skipping StartGroup, provide the tags field number to check for
       * matching field number in the EndGroup tag. Recursion into nested groups
       * is guarded by the `recursionLimit` argument: When the limit is reached,
       * this method throws.
       */
      skip(wireType, fieldNo, recursionLimit = 100) {
        let start = this.pos;
        switch (wireType) {
          case WireType.Varint:
            while (this.buf[this.pos++] & 128) {
            }
            break;
          // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
          case WireType.Bit64:
            this.pos += 4;
          case WireType.Bit32:
            this.pos += 4;
            break;
          case WireType.LengthDelimited:
            let len = this.uint32();
            this.pos += len;
            break;
          case WireType.StartGroup:
            if (recursionLimit <= 0) {
              throw new Error("maximum recursion depth reached");
            }
            for (; ; ) {
              const [fn, wt] = this.tag();
              if (wt === WireType.EndGroup) {
                if (fieldNo !== void 0 && fn !== fieldNo) {
                  throw new Error("invalid end group tag");
                }
                break;
              }
              this.skip(wt, fn, recursionLimit - 1);
            }
            break;
          default:
            throw new Error("cant skip wire type " + wireType);
        }
        this.assertBounds();
        return this.buf.subarray(start, this.pos);
      }
      /**
       * Throws error if position in byte array is out of range.
       */
      assertBounds() {
        if (this.pos > this.len)
          throw new RangeError("premature EOF");
      }
      /**
       * Read a `int32` field, a signed 32 bit varint.
       */
      int32() {
        return this.uint32() | 0;
      }
      /**
       * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
       */
      sint32() {
        let zze = this.uint32();
        return zze >>> 1 ^ -(zze & 1);
      }
      /**
       * Read a `int64` field, a signed 64-bit varint.
       */
      int64() {
        this.varint64();
        return protoInt64.dec(this.varint64Lo, this.varint64Hi);
      }
      /**
       * Read a `uint64` field, an unsigned 64-bit varint.
       */
      uint64() {
        this.varint64();
        return protoInt64.uDec(this.varint64Lo, this.varint64Hi);
      }
      /**
       * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
       */
      sint64() {
        this.varint64();
        let lo = this.varint64Lo;
        let hi = this.varint64Hi;
        let s = -(lo & 1);
        lo = (lo >>> 1 | (hi & 1) << 31) ^ s;
        hi = hi >>> 1 ^ s;
        return protoInt64.dec(lo, hi);
      }
      /**
       * Read a `bool` field, a variant.
       */
      bool() {
        const b = this.buf[this.pos];
        if (b < 128) {
          this.pos++;
          return b !== 0;
        }
        this.varint64();
        return this.varint64Lo !== 0 || this.varint64Hi !== 0;
      }
      /**
       * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
       */
      fixed32() {
        return this.view.getUint32((this.pos += 4) - 4, true);
      }
      /**
       * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
       */
      sfixed32() {
        return this.view.getInt32((this.pos += 4) - 4, true);
      }
      /**
       * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
       */
      fixed64() {
        return protoInt64.uDec(this.sfixed32(), this.sfixed32());
      }
      /**
       * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
       */
      sfixed64() {
        return protoInt64.dec(this.sfixed32(), this.sfixed32());
      }
      /**
       * Read a `float` field, 32-bit floating point number.
       */
      float() {
        return this.view.getFloat32((this.pos += 4) - 4, true);
      }
      /**
       * Read a `double` field, a 64-bit floating point number.
       */
      double() {
        return this.view.getFloat64((this.pos += 8) - 8, true);
      }
      /**
       * Read a `bytes` field, length-delimited arbitrary data.
       */
      bytes() {
        let len = this.uint32(), start = this.pos;
        this.pos += len;
        this.assertBounds();
        return this.buf.subarray(start, start + len);
      }
      /**
       * Read a `string` field, length-delimited data converted to UTF-8 text. If
       * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
       */
      string(strict) {
        const len = this.uint32();
        const start = this.pos;
        this.pos += len;
        this.assertBounds();
        const buf = this.buf;
        if (len <= ASCII_MAX_LENGTH) {
          const codes = new Array(len);
          for (let i = 0; i < len; i++) {
            const byte = buf[start + i];
            if (byte > 127) {
              return this.decodeUtf8(buf.subarray(start, this.pos), strict);
            }
            codes[i] = byte;
          }
          return String.fromCharCode.apply(String, codes);
        }
        return this.decodeUtf8(buf.subarray(start, this.pos), strict);
      }
    };
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js
var nativeSetFromBase64, nativeToBase64;
var init_base64_encoding = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js"() {
    nativeSetFromBase64 = Uint8Array.prototype.setFromBase64;
    nativeToBase64 = Uint8Array.prototype.toBase64;
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js
var init_text_format = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js"() {
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/size-delimited.js
var defaultReadMaxBytes;
var init_size_delimited = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/size-delimited.js"() {
    defaultReadMaxBytes = 64 * 1024 * 1024;
  }
});

// MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/index.js
var init_wire = __esm({
  "MediaDrop/node_modules/@bufbuild/protobuf/dist/esm/wire/index.js"() {
    init_binary_encoding();
    init_base64_encoding();
    init_text_format();
    init_size_delimited();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/misc/common.js
function createBaseFormatId() {
  return { itag: void 0, lastModified: void 0, xtags: void 0 };
}
function createBaseRange() {
  return { legacyStart: void 0, legacyEnd: void 0, start: void 0, end: void 0 };
}
function createBaseKeyValuePair() {
  return { key: void 0, value: void 0 };
}
function createBaseFormatXTags() {
  return { xtags: [] };
}
function createBaseAuthorizedFormat() {
  return { trackType: void 0, isHdr: void 0 };
}
function createBasePlaybackAuthorization() {
  return { authorizedFormats: [], sabrLicenseConstraint: void 0 };
}
var SeekSource, FormatId, Range, KeyValuePair, FormatXTags, AuthorizedFormat, PlaybackAuthorization;
var init_common = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/misc/common.js"() {
    init_wire();
    SeekSource = {
      UNKNOWN: 0,
      0: "UNKNOWN",
      TIMESTAMP_IN_COMMENTS: 1,
      1: "TIMESTAMP_IN_COMMENTS",
      TIMESTAMP_IN_DESCRIPTION: 2,
      2: "TIMESTAMP_IN_DESCRIPTION",
      MACRO_MARKER_LIST_ITEM: 3,
      3: "MACRO_MARKER_LIST_ITEM",
      DOUBLE_TAP_TO_SEEK: 4,
      4: "DOUBLE_TAP_TO_SEEK",
      DOUBLE_TAP_TO_SKIP_CHAPTER: 5,
      5: "DOUBLE_TAP_TO_SKIP_CHAPTER",
      PICK_UP_PLAY_HEAD: 6,
      6: "PICK_UP_PLAY_HEAD",
      SLIDE_ON_SCRUBBER_BAR: 7,
      7: "SLIDE_ON_SCRUBBER_BAR",
      SLIDE_ON_PLAYER: 8,
      8: "SLIDE_ON_PLAYER",
      SABR_PARTIAL_CHUNK: 9,
      9: "SABR_PARTIAL_CHUNK",
      SABR_SEEK_TO_HEAD: 10,
      10: "SABR_SEEK_TO_HEAD",
      SABR_LIVE_DVR_USER_SEEK: 11,
      11: "SABR_LIVE_DVR_USER_SEEK",
      SABR_SEEK_TO_DVR_LOWER_BOUND: 12,
      12: "SABR_SEEK_TO_DVR_LOWER_BOUND",
      SABR_SEEK_TO_DVR_UPPER_BOUND: 13,
      13: "SABR_SEEK_TO_DVR_UPPER_BOUND",
      SSDAI_INTERNAL: 14,
      14: "SSDAI_INTERNAL",
      START_PLAYBACK: 15,
      15: "START_PLAYBACK",
      SABR_ACCURATE_SEEK: 17,
      17: "SABR_ACCURATE_SEEK",
      START_PLAYBACK_SEEK_TO_END: 18,
      18: "START_PLAYBACK_SEEK_TO_END",
      IOS_PLAYER_REMOVED_SEGMENTS: 19,
      19: "IOS_PLAYER_REMOVED_SEGMENTS",
      IOS_PLAYER_SEGMENT_LIST: 20,
      20: "IOS_PLAYER_SEGMENT_LIST",
      IOS_PLAYER_ITEM_SEEK: 21,
      21: "IOS_PLAYER_ITEM_SEEK",
      IOS_PLAYER_ITEM_SEEK_TO_END: 22,
      22: "IOS_PLAYER_ITEM_SEEK_TO_END",
      IOS_PLAYER_SEEK_TO_END_TO_RESYNC: 23,
      23: "IOS_PLAYER_SEEK_TO_END_TO_RESYNC",
      IOS_SEEK_ACCESSIBILITY_BUTTON: 24,
      24: "IOS_SEEK_ACCESSIBILITY_BUTTON",
      FINE_SCRUBBER_SLIDE_ON_FILMSTRIP: 25,
      25: "FINE_SCRUBBER_SLIDE_ON_FILMSTRIP",
      FINE_SCRUBBER_TAP_ON_FILMSTRIP: 26,
      26: "FINE_SCRUBBER_TAP_ON_FILMSTRIP",
      FINE_SCRUBBER_SLIDE_ON_SCRUBBER_BAR: 27,
      27: "FINE_SCRUBBER_SLIDE_ON_SCRUBBER_BAR",
      SEEK_BUTTON_ON_PLAYER_CONTROL: 28,
      28: "SEEK_BUTTON_ON_PLAYER_CONTROL",
      SABR_INGESTION_WALL_TIME_SEEK: 29,
      29: "SABR_INGESTION_WALL_TIME_SEEK",
      PLAYER_VIEW_REPARENT_INTERNAL: 30,
      30: "PLAYER_VIEW_REPARENT_INTERNAL",
      PRESS_REWIND_PLAY_BACK_CONTROL: 31,
      31: "PRESS_REWIND_PLAY_BACK_CONTROL",
      PRESS_FAST_FORWARD_PLAY_BACK_CONTROL: 32,
      32: "PRESS_FAST_FORWARD_PLAY_BACK_CONTROL",
      PRESS_LIVE_SYNC_ICON: 33,
      33: "PRESS_LIVE_SYNC_ICON",
      PEG_TO_LIVE: 34,
      34: "PEG_TO_LIVE",
      ANDROID_MEDIA_SESSION: 35,
      35: "ANDROID_MEDIA_SESSION",
      TAP_ON_REPLAY_ACTION: 36,
      36: "TAP_ON_REPLAY_ACTION",
      AUTOMATIC_REPLAY_ACTION: 37,
      37: "AUTOMATIC_REPLAY_ACTION",
      NON_USER_SEEK_TO_PREVIOUS: 38,
      38: "NON_USER_SEEK_TO_PREVIOUS",
      NON_USER_SEEK_TO_NEXT: 39,
      39: "NON_USER_SEEK_TO_NEXT",
      HIGHLIGHTS_TAP_PREVIOUS_PLAY: 66,
      66: "HIGHLIGHTS_TAP_PREVIOUS_PLAY",
      HIGHLIGHTS_TAP_NEXT_PLAY: 40,
      40: "HIGHLIGHTS_TAP_NEXT_PLAY",
      HIGHLIGHTS_TAP_HIDDEN_NEXT_PLAY: 41,
      41: "HIGHLIGHTS_TAP_HIDDEN_NEXT_PLAY",
      HIGHLIGHTS_TAP_LIST_ITEM: 42,
      42: "HIGHLIGHTS_TAP_LIST_ITEM",
      HIGHLIGHTS_AUTOMATIC_NEXT_PLAY: 43,
      43: "HIGHLIGHTS_AUTOMATIC_NEXT_PLAY",
      HIGHLIGHTS_SEEK_TO_FIRST_PLAY: 44,
      44: "HIGHLIGHTS_SEEK_TO_FIRST_PLAY",
      HIGHLIGHTS_SEEK_TO_END: 45,
      45: "HIGHLIGHTS_SEEK_TO_END",
      SEGMENTS_TAP_LIST_ITEM: 46,
      46: "SEGMENTS_TAP_LIST_ITEM",
      PIP_FAST_FORWARD_BUTTON: 47,
      47: "PIP_FAST_FORWARD_BUTTON",
      PIP_REWIND_BUTTON: 48,
      48: "PIP_REWIND_BUTTON",
      PIP_RESUME_ON_HEAD: 49,
      49: "PIP_RESUME_ON_HEAD",
      MOVING_CLIP_FRAME: 50,
      50: "MOVING_CLIP_FRAME",
      RESUME_CLIP_PREVIOUS_POSITION: 51,
      51: "RESUME_CLIP_PREVIOUS_POSITION",
      SEEK_TO_NEXT_CHAPTER: 52,
      52: "SEEK_TO_NEXT_CHAPTER",
      SEEK_TO_PREVIOUS_CHAPTER: 53,
      53: "SEEK_TO_PREVIOUS_CHAPTER",
      IOS_SHAREPLAY_PAUSE: 54,
      54: "IOS_SHAREPLAY_PAUSE",
      IOS_SHAREPLAY_SEEK: 55,
      55: "IOS_SHAREPLAY_SEEK",
      IOS_SHAREPLAY_SYNC_RESPONSE: 56,
      56: "IOS_SHAREPLAY_SYNC_RESPONSE",
      SEEK_TO_HEAD_IMMERSIVE_LIVE_VIDEO: 57,
      57: "SEEK_TO_HEAD_IMMERSIVE_LIVE_VIDEO",
      SEEK_TO_START_OF_LOOPING_RANGE_OF_SHORTS: 58,
      58: "SEEK_TO_START_OF_LOOPING_RANGE_OF_SHORTS",
      SABR_SEEK_TO_CLOSEST_KEYFRAME: 59,
      59: "SABR_SEEK_TO_CLOSEST_KEYFRAME",
      SEEK_TO_END_OF_LOOPING_RANGE_OF_SHORTS: 60,
      60: "SEEK_TO_END_OF_LOOPING_RANGE_OF_SHORTS",
      CLIP_SLIDE_ON_FLIMSTRIP: 61,
      61: "CLIP_SLIDE_ON_FLIMSTRIP",
      PICK_UP_CLIP_SLIDER: 62,
      62: "PICK_UP_CLIP_SLIDER",
      FINE_SCRUBBER_CANCELLED: 63,
      63: "FINE_SCRUBBER_CANCELLED",
      INLINE_PLAYER_SEEK_CHAPTER: 64,
      64: "INLINE_PLAYER_SEEK_CHAPTER",
      INLINE_PLAYER_SEEK_SECONDS: 65,
      65: "INLINE_PLAYER_SEEK_SECONDS",
      HIGHLIGHTS_PLAYER_EXIT_FULLSCREEN: 67,
      67: "HIGHLIGHTS_PLAYER_EXIT_FULLSCREEN",
      LARGE_CONTROLS_FORWARD_BUTTON: 68,
      68: "LARGE_CONTROLS_FORWARD_BUTTON",
      LARGE_CONTROLS_REWIND_BUTTON: 69,
      69: "LARGE_CONTROLS_REWIND_BUTTON",
      LARGE_CONTROLS_SCRUBBER_BAR: 70,
      70: "LARGE_CONTROLS_SCRUBBER_BAR",
      SEEK_BACKWARD_5S: 71,
      71: "SEEK_BACKWARD_5S",
      SEEK_FORWARD_5S: 72,
      72: "SEEK_FORWARD_5S",
      SEEK_BACKWARD_10S: 73,
      73: "SEEK_BACKWARD_10S",
      SEEK_FORWARD_10S: 74,
      74: "SEEK_FORWARD_10S",
      SEEK_FORWARD_60S: 75,
      75: "SEEK_FORWARD_60S",
      SEEK_BACKWARD_60S: 76,
      76: "SEEK_BACKWARD_60S",
      SEEK_TO_NEXT_FRAME: 77,
      77: "SEEK_TO_NEXT_FRAME",
      SEEK_TO_PREV_FRAME: 78,
      78: "SEEK_TO_PREV_FRAME",
      KEYBOARD_SEEK_TO_BEGINNING: 79,
      79: "KEYBOARD_SEEK_TO_BEGINNING",
      KEYBOARD_SEEK_TO_END: 80,
      80: "KEYBOARD_SEEK_TO_END",
      SEEK_PERCENT_OF_VIDEO: 81,
      81: "SEEK_PERCENT_OF_VIDEO",
      HIDDEN_FAST_FORWARD_BUTTON: 82,
      82: "HIDDEN_FAST_FORWARD_BUTTON",
      HIDDEN_REWIND_BUTTON: 83,
      83: "HIDDEN_REWIND_BUTTON",
      TIMESTAMP: 84,
      84: "TIMESTAMP",
      LR_MEDIA_SESSION_SEEK: 87,
      87: "LR_MEDIA_SESSION_SEEK",
      MIDROLLS_WITH_TIME_RANGE: 88,
      88: "MIDROLLS_WITH_TIME_RANGE",
      SKIP_AD: 89,
      89: "SKIP_AD",
      SEEK_TO_PREVIOUS: 90,
      90: "SEEK_TO_PREVIOUS",
      SEEK_TO_NEXT: 91,
      91: "SEEK_TO_NEXT",
      LR_QUICK_SEEK: 92,
      92: "LR_QUICK_SEEK",
      ONESIE_LIVE: 93,
      93: "ONESIE_LIVE",
      LR_PLAYER_CONTROL_ACTION: 94,
      94: "LR_PLAYER_CONTROL_ACTION",
      UNPLUGGED_LENS_START_CLIP: 95,
      95: "UNPLUGGED_LENS_START_CLIP",
      LR_KEY_PLAYS: 96,
      96: "LR_KEY_PLAYS",
      SSAP_AD_FMT_FATAL: 97,
      97: "SSAP_AD_FMT_FATAL",
      TVHTML5_INPUT_SOURCE_KEY_EVENT: 98,
      98: "TVHTML5_INPUT_SOURCE_KEY_EVENT",
      TVHTML5_INPUT_SOURCE_CONTROLS: 99,
      99: "TVHTML5_INPUT_SOURCE_CONTROLS",
      TVHTML5_INPUT_SOURCE_TOUCH: 100,
      100: "TVHTML5_INPUT_SOURCE_TOUCH",
      TVHTML5_INPUT_SOURCE_TOUCHPAD: 101,
      101: "TVHTML5_INPUT_SOURCE_TOUCHPAD",
      SEEK_TO_HEAD: 102,
      102: "SEEK_TO_HEAD",
      AUTOMATIC_PREVIEW_REPLAY_ACTION: 103,
      103: "AUTOMATIC_PREVIEW_REPLAY_ACTION",
      H5_MEDIA_ELEMENT_EVENT: 104,
      104: "H5_MEDIA_ELEMENT_EVENT",
      H5_WORKAROUND_SEEK: 105,
      105: "H5_WORKAROUND_SEEK",
      MINIPLAYER_REWIND_BUTTON: 106,
      106: "MINIPLAYER_REWIND_BUTTON",
      MINIPLAYER_FAST_FORWARD_BUTTON: 107,
      107: "MINIPLAYER_FAST_FORWARD_BUTTON",
      SABR_RELOAD_PLAYER_RESPONSE_TOKEN_SEEK: 108,
      108: "SABR_RELOAD_PLAYER_RESPONSE_TOKEN_SEEK",
      SLIDE_ON_SCRUBBER_BAR_CHAPTER: 109,
      109: "SLIDE_ON_SCRUBBER_BAR_CHAPTER",
      ANDROID_CLEAR_BUFFER: 110,
      110: "ANDROID_CLEAR_BUFFER",
      UNRECOGNIZED: -1,
      "-1": "UNRECOGNIZED"
    };
    FormatId = {
      encode(message, writer = new BinaryWriter()) {
        if (message.itag !== void 0) {
          writer.uint32(8).int32(message.itag);
        }
        if (message.lastModified !== void 0) {
          writer.uint32(16).uint64(message.lastModified);
        }
        if (message.xtags !== void 0) {
          writer.uint32(26).string(message.xtags);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseFormatId();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.itag = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.lastModified = reader.uint64().toString();
                continue;
              }
              case 3: {
                if (tag !== 26) {
                  break;
                }
                message.xtags = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    Range = {
      encode(message, writer = new BinaryWriter()) {
        if (message.legacyStart !== void 0) {
          writer.uint32(8).int32(message.legacyStart);
        }
        if (message.legacyEnd !== void 0) {
          writer.uint32(16).int32(message.legacyEnd);
        }
        if (message.start !== void 0) {
          writer.uint32(24).int32(message.start);
        }
        if (message.end !== void 0) {
          writer.uint32(32).int32(message.end);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseRange();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.legacyStart = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.legacyEnd = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.start = reader.int32();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.end = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    KeyValuePair = {
      encode(message, writer = new BinaryWriter()) {
        if (message.key !== void 0) {
          writer.uint32(10).string(message.key);
        }
        if (message.value !== void 0) {
          writer.uint32(18).string(message.value);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseKeyValuePair();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.key = reader.string();
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.value = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    FormatXTags = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.xtags) {
          KeyValuePair.encode(v, writer.uint32(10).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseFormatXTags();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.xtags.push(KeyValuePair.decode(reader, reader.uint32()));
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    AuthorizedFormat = {
      encode(message, writer = new BinaryWriter()) {
        if (message.trackType !== void 0) {
          writer.uint32(8).int32(message.trackType);
        }
        if (message.isHdr !== void 0) {
          writer.uint32(16).bool(message.isHdr);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseAuthorizedFormat();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.trackType = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.isHdr = reader.bool();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    PlaybackAuthorization = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.authorizedFormats) {
          AuthorizedFormat.encode(v, writer.uint32(10).fork()).join();
        }
        if (message.sabrLicenseConstraint !== void 0) {
          writer.uint32(18).bytes(message.sabrLicenseConstraint);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBasePlaybackAuthorization();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.authorizedFormats.push(AuthorizedFormat.decode(reader, reader.uint32()));
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.sabrLicenseConstraint = reader.bytes();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/format_initialization_metadata.js
function createBaseFormatInitializationMetadata() {
  return {
    videoId: void 0,
    formatId: void 0,
    endTimeMs: void 0,
    endSegmentNum: void 0,
    mimeType: void 0,
    initSegmentRange: void 0,
    indexRange: void 0,
    field8: void 0,
    endTimeTicks: void 0,
    endTimeTimescale: void 0,
    clipId: void 0,
    formatStream: void 0
  };
}
var FormatInitializationMetadata;
var init_format_initialization_metadata = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/format_initialization_metadata.js"() {
    init_wire();
    init_common();
    FormatInitializationMetadata = {
      encode(message, writer = new BinaryWriter()) {
        if (message.videoId !== void 0) {
          writer.uint32(10).string(message.videoId);
        }
        if (message.formatId !== void 0) {
          FormatId.encode(message.formatId, writer.uint32(18).fork()).join();
        }
        if (message.endTimeMs !== void 0) {
          writer.uint32(24).int64(message.endTimeMs);
        }
        if (message.endSegmentNum !== void 0) {
          writer.uint32(32).int64(message.endSegmentNum);
        }
        if (message.mimeType !== void 0) {
          writer.uint32(42).string(message.mimeType);
        }
        if (message.initSegmentRange !== void 0) {
          Range.encode(message.initSegmentRange, writer.uint32(50).fork()).join();
        }
        if (message.indexRange !== void 0) {
          Range.encode(message.indexRange, writer.uint32(58).fork()).join();
        }
        if (message.field8 !== void 0) {
          writer.uint32(64).int64(message.field8);
        }
        if (message.endTimeTicks !== void 0) {
          writer.uint32(72).int64(message.endTimeTicks);
        }
        if (message.endTimeTimescale !== void 0) {
          writer.uint32(80).int64(message.endTimeTimescale);
        }
        if (message.clipId !== void 0) {
          writer.uint32(90).string(message.clipId);
        }
        if (message.formatStream !== void 0) {
          writer.uint32(98).bytes(message.formatStream);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseFormatInitializationMetadata();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.videoId = reader.string();
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.formatId = FormatId.decode(reader, reader.uint32());
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.endTimeMs = reader.int64().toString();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.endSegmentNum = reader.int64().toString();
                continue;
              }
              case 5: {
                if (tag !== 42) {
                  break;
                }
                message.mimeType = reader.string();
                continue;
              }
              case 6: {
                if (tag !== 50) {
                  break;
                }
                message.initSegmentRange = Range.decode(reader, reader.uint32());
                continue;
              }
              case 7: {
                if (tag !== 58) {
                  break;
                }
                message.indexRange = Range.decode(reader, reader.uint32());
                continue;
              }
              case 8: {
                if (tag !== 64) {
                  break;
                }
                message.field8 = reader.int64().toString();
                continue;
              }
              case 9: {
                if (tag !== 72) {
                  break;
                }
                message.endTimeTicks = reader.int64().toString();
                continue;
              }
              case 10: {
                if (tag !== 80) {
                  break;
                }
                message.endTimeTimescale = reader.int64().toString();
                continue;
              }
              case 11: {
                if (tag !== 90) {
                  break;
                }
                message.clipId = reader.string();
                continue;
              }
              case 12: {
                if (tag !== 98) {
                  break;
                }
                message.formatStream = reader.bytes();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/time_range.js
function createBaseTimeRange() {
  return { startTicks: void 0, durationTicks: void 0, timescale: void 0 };
}
var TimeRange;
var init_time_range = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/time_range.js"() {
    init_wire();
    TimeRange = {
      encode(message, writer = new BinaryWriter()) {
        if (message.startTicks !== void 0) {
          writer.uint32(8).int64(message.startTicks);
        }
        if (message.durationTicks !== void 0) {
          writer.uint32(16).int64(message.durationTicks);
        }
        if (message.timescale !== void 0) {
          writer.uint32(24).int32(message.timescale);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseTimeRange();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.startTicks = reader.int64().toString();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.durationTicks = reader.int64().toString();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.timescale = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/media_header.js
function createBaseMediaHeader() {
  return {
    headerId: void 0,
    videoId: void 0,
    itag: void 0,
    lmt: void 0,
    xtags: void 0,
    segmentByteRangeStart: void 0,
    compressionType: void 0,
    isInitializationSegment: void 0,
    segmentNum: void 0,
    bitrateBps: void 0,
    startMs: void 0,
    durationMs: void 0,
    formatId: void 0,
    segmentLengthBytes: void 0,
    timeRange: void 0,
    segmentLmt: void 0,
    offsetFromStartOfSegment: void 0,
    partialBytesToReturn: void 0
  };
}
var MediaHeader;
var init_media_header = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/media_header.js"() {
    init_wire();
    init_common();
    init_time_range();
    MediaHeader = {
      encode(message, writer = new BinaryWriter()) {
        if (message.headerId !== void 0) {
          writer.uint32(8).uint32(message.headerId);
        }
        if (message.videoId !== void 0) {
          writer.uint32(18).string(message.videoId);
        }
        if (message.itag !== void 0) {
          writer.uint32(24).int32(message.itag);
        }
        if (message.lmt !== void 0) {
          writer.uint32(32).uint64(message.lmt);
        }
        if (message.xtags !== void 0) {
          writer.uint32(42).string(message.xtags);
        }
        if (message.segmentByteRangeStart !== void 0) {
          writer.uint32(48).int64(message.segmentByteRangeStart);
        }
        if (message.compressionType !== void 0) {
          writer.uint32(56).int32(message.compressionType);
        }
        if (message.isInitializationSegment !== void 0) {
          writer.uint32(64).bool(message.isInitializationSegment);
        }
        if (message.segmentNum !== void 0) {
          writer.uint32(72).int32(message.segmentNum);
        }
        if (message.bitrateBps !== void 0) {
          writer.uint32(80).int64(message.bitrateBps);
        }
        if (message.startMs !== void 0) {
          writer.uint32(88).int64(message.startMs);
        }
        if (message.durationMs !== void 0) {
          writer.uint32(96).int64(message.durationMs);
        }
        if (message.formatId !== void 0) {
          FormatId.encode(message.formatId, writer.uint32(106).fork()).join();
        }
        if (message.segmentLengthBytes !== void 0) {
          writer.uint32(112).int64(message.segmentLengthBytes);
        }
        if (message.timeRange !== void 0) {
          TimeRange.encode(message.timeRange, writer.uint32(122).fork()).join();
        }
        if (message.segmentLmt !== void 0) {
          writer.uint32(128).uint64(message.segmentLmt);
        }
        if (message.offsetFromStartOfSegment !== void 0) {
          writer.uint32(136).int64(message.offsetFromStartOfSegment);
        }
        if (message.partialBytesToReturn !== void 0) {
          writer.uint32(144).int64(message.partialBytesToReturn);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseMediaHeader();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.headerId = reader.uint32();
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.videoId = reader.string();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.itag = reader.int32();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.lmt = reader.uint64().toString();
                continue;
              }
              case 5: {
                if (tag !== 42) {
                  break;
                }
                message.xtags = reader.string();
                continue;
              }
              case 6: {
                if (tag !== 48) {
                  break;
                }
                message.segmentByteRangeStart = reader.int64().toString();
                continue;
              }
              case 7: {
                if (tag !== 56) {
                  break;
                }
                message.compressionType = reader.int32();
                continue;
              }
              case 8: {
                if (tag !== 64) {
                  break;
                }
                message.isInitializationSegment = reader.bool();
                continue;
              }
              case 9: {
                if (tag !== 72) {
                  break;
                }
                message.segmentNum = reader.int32();
                continue;
              }
              case 10: {
                if (tag !== 80) {
                  break;
                }
                message.bitrateBps = reader.int64().toString();
                continue;
              }
              case 11: {
                if (tag !== 88) {
                  break;
                }
                message.startMs = reader.int64().toString();
                continue;
              }
              case 12: {
                if (tag !== 96) {
                  break;
                }
                message.durationMs = reader.int64().toString();
                continue;
              }
              case 13: {
                if (tag !== 106) {
                  break;
                }
                message.formatId = FormatId.decode(reader, reader.uint32());
                continue;
              }
              case 14: {
                if (tag !== 112) {
                  break;
                }
                message.segmentLengthBytes = reader.int64().toString();
                continue;
              }
              case 15: {
                if (tag !== 122) {
                  break;
                }
                message.timeRange = TimeRange.decode(reader, reader.uint32());
                continue;
              }
              case 16: {
                if (tag !== 128) {
                  break;
                }
                message.segmentLmt = reader.uint64().toString();
                continue;
              }
              case 17: {
                if (tag !== 136) {
                  break;
                }
                message.offsetFromStartOfSegment = reader.int64().toString();
                continue;
              }
              case 18: {
                if (tag !== 144) {
                  break;
                }
                message.partialBytesToReturn = reader.int64().toString();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/buffered_range.js
function createBaseBufferedRange() {
  return {
    formatId: void 0,
    startTimeMs: void 0,
    durationMs: void 0,
    startSegmentIndex: void 0,
    endSegmentIndex: void 0,
    timeRange: void 0,
    field9: void 0,
    field11: void 0,
    field12: void 0
  };
}
function createBaseBufferedRange_UnknownMessage1() {
  return { field1: [] };
}
function createBaseBufferedRange_UnknownMessage1_UnknownInnerMessage() {
  return { videoId: void 0, lmt: void 0 };
}
function createBaseBufferedRange_UnknownMessage2() {
  return { field1: void 0, field2: void 0, field3: void 0 };
}
var BufferedRange, BufferedRange_UnknownMessage1, BufferedRange_UnknownMessage1_UnknownInnerMessage, BufferedRange_UnknownMessage2;
var init_buffered_range = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/buffered_range.js"() {
    init_wire();
    init_common();
    init_time_range();
    BufferedRange = {
      encode(message, writer = new BinaryWriter()) {
        if (message.formatId !== void 0) {
          FormatId.encode(message.formatId, writer.uint32(10).fork()).join();
        }
        if (message.startTimeMs !== void 0) {
          writer.uint32(16).int64(message.startTimeMs);
        }
        if (message.durationMs !== void 0) {
          writer.uint32(24).int64(message.durationMs);
        }
        if (message.startSegmentIndex !== void 0) {
          writer.uint32(32).int32(message.startSegmentIndex);
        }
        if (message.endSegmentIndex !== void 0) {
          writer.uint32(40).int32(message.endSegmentIndex);
        }
        if (message.timeRange !== void 0) {
          TimeRange.encode(message.timeRange, writer.uint32(50).fork()).join();
        }
        if (message.field9 !== void 0) {
          BufferedRange_UnknownMessage1.encode(message.field9, writer.uint32(74).fork()).join();
        }
        if (message.field11 !== void 0) {
          BufferedRange_UnknownMessage2.encode(message.field11, writer.uint32(90).fork()).join();
        }
        if (message.field12 !== void 0) {
          BufferedRange_UnknownMessage2.encode(message.field12, writer.uint32(98).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseBufferedRange();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.formatId = FormatId.decode(reader, reader.uint32());
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.startTimeMs = reader.int64().toString();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.durationMs = reader.int64().toString();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.startSegmentIndex = reader.int32();
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.endSegmentIndex = reader.int32();
                continue;
              }
              case 6: {
                if (tag !== 50) {
                  break;
                }
                message.timeRange = TimeRange.decode(reader, reader.uint32());
                continue;
              }
              case 9: {
                if (tag !== 74) {
                  break;
                }
                message.field9 = BufferedRange_UnknownMessage1.decode(reader, reader.uint32());
                continue;
              }
              case 11: {
                if (tag !== 90) {
                  break;
                }
                message.field11 = BufferedRange_UnknownMessage2.decode(reader, reader.uint32());
                continue;
              }
              case 12: {
                if (tag !== 98) {
                  break;
                }
                message.field12 = BufferedRange_UnknownMessage2.decode(reader, reader.uint32());
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    BufferedRange_UnknownMessage1 = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.field1) {
          BufferedRange_UnknownMessage1_UnknownInnerMessage.encode(v, writer.uint32(10).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseBufferedRange_UnknownMessage1();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.field1.push(BufferedRange_UnknownMessage1_UnknownInnerMessage.decode(reader, reader.uint32()));
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    BufferedRange_UnknownMessage1_UnknownInnerMessage = {
      encode(message, writer = new BinaryWriter()) {
        if (message.videoId !== void 0) {
          writer.uint32(10).string(message.videoId);
        }
        if (message.lmt !== void 0) {
          writer.uint32(16).uint64(message.lmt);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseBufferedRange_UnknownMessage1_UnknownInnerMessage();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.videoId = reader.string();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.lmt = reader.uint64().toString();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    BufferedRange_UnknownMessage2 = {
      encode(message, writer = new BinaryWriter()) {
        if (message.field1 !== void 0) {
          writer.uint32(8).int32(message.field1);
        }
        if (message.field2 !== void 0) {
          writer.uint32(16).int32(message.field2);
        }
        if (message.field3 !== void 0) {
          writer.uint32(24).int32(message.field3);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseBufferedRange_UnknownMessage2();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.field1 = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.field2 = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.field3 = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/cuepoint.js
function createBaseCuepoint() {
  return {
    type: void 0,
    event: void 0,
    totalDurationSec: void 0,
    playheadTimeSec: void 0,
    context: void 0,
    identifier: void 0,
    playheadTimeAtStartSec: void 0,
    mediaTimeSinceStartSec: void 0,
    startSequenceNumber: void 0
  };
}
var Cuepoint_CuepointEvent, Cuepoint;
var init_cuepoint = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/cuepoint.js"() {
    init_wire();
    Cuepoint_CuepointEvent = {
      UNKNOWN: 0,
      0: "UNKNOWN",
      START: 1,
      1: "START",
      CONTINUE: 2,
      2: "CONTINUE",
      STOP: 3,
      3: "STOP",
      INSERTION: 4,
      4: "INSERTION",
      PREDICT_START: 5,
      5: "PREDICT_START",
      /** PREFETCH - @NOTE: A request to https://www.youtube.com/youtubei/v1/player/ad_break?prettyPrint=false is made to get the ads_config bytes */
      PREFETCH: 6,
      /** PREFETCH - @NOTE: A request to https://www.youtube.com/youtubei/v1/player/ad_break?prettyPrint=false is made to get the ads_config bytes */
      6: "PREFETCH",
      UNRECOGNIZED: -1,
      "-1": "UNRECOGNIZED"
    };
    Cuepoint = {
      encode(message, writer = new BinaryWriter()) {
        if (message.type !== void 0) {
          writer.uint32(8).int32(message.type);
        }
        if (message.event !== void 0) {
          writer.uint32(16).int32(message.event);
        }
        if (message.totalDurationSec !== void 0) {
          writer.uint32(25).double(message.totalDurationSec);
        }
        if (message.playheadTimeSec !== void 0) {
          writer.uint32(33).double(message.playheadTimeSec);
        }
        if (message.context !== void 0) {
          writer.uint32(42).string(message.context);
        }
        if (message.identifier !== void 0) {
          writer.uint32(50).string(message.identifier);
        }
        if (message.playheadTimeAtStartSec !== void 0) {
          writer.uint32(57).double(message.playheadTimeAtStartSec);
        }
        if (message.mediaTimeSinceStartSec !== void 0) {
          writer.uint32(65).double(message.mediaTimeSinceStartSec);
        }
        if (message.startSequenceNumber !== void 0) {
          writer.uint32(72).int32(message.startSequenceNumber);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseCuepoint();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.type = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.event = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 25) {
                  break;
                }
                message.totalDurationSec = reader.double();
                continue;
              }
              case 4: {
                if (tag !== 33) {
                  break;
                }
                message.playheadTimeSec = reader.double();
                continue;
              }
              case 5: {
                if (tag !== 42) {
                  break;
                }
                message.context = reader.string();
                continue;
              }
              case 6: {
                if (tag !== 50) {
                  break;
                }
                message.identifier = reader.string();
                continue;
              }
              case 7: {
                if (tag !== 57) {
                  break;
                }
                message.playheadTimeAtStartSec = reader.double();
                continue;
              }
              case 8: {
                if (tag !== 65) {
                  break;
                }
                message.mediaTimeSinceStartSec = reader.double();
                continue;
              }
              case 9: {
                if (tag !== 72) {
                  break;
                }
                message.startSequenceNumber = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/cuepoint_info.js
function createBaseCuepointInfo() {
  return {
    cuepoint: void 0,
    trackType: void 0,
    sequenceNumber: void 0,
    timeRange: void 0,
    tileContext: void 0,
    unknownField6: void 0,
    unknownField7: void 0,
    opportunityId: void 0,
    serializedPrefetchContext: void 0
  };
}
var CuepointInfo;
var init_cuepoint_info = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/cuepoint_info.js"() {
    init_wire();
    init_cuepoint();
    init_time_range();
    CuepointInfo = {
      encode(message, writer = new BinaryWriter()) {
        if (message.cuepoint !== void 0) {
          Cuepoint.encode(message.cuepoint, writer.uint32(10).fork()).join();
        }
        if (message.trackType !== void 0) {
          writer.uint32(16).int32(message.trackType);
        }
        if (message.sequenceNumber !== void 0) {
          writer.uint32(24).int32(message.sequenceNumber);
        }
        if (message.timeRange !== void 0) {
          TimeRange.encode(message.timeRange, writer.uint32(34).fork()).join();
        }
        if (message.tileContext !== void 0) {
          writer.uint32(42).string(message.tileContext);
        }
        if (message.unknownField6 !== void 0) {
          writer.uint32(48).int32(message.unknownField6);
        }
        if (message.unknownField7 !== void 0) {
          writer.uint32(56).int32(message.unknownField7);
        }
        if (message.opportunityId !== void 0) {
          writer.uint32(66).string(message.opportunityId);
        }
        if (message.serializedPrefetchContext !== void 0) {
          writer.uint32(74).bytes(message.serializedPrefetchContext);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseCuepointInfo();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.cuepoint = Cuepoint.decode(reader, reader.uint32());
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.trackType = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.sequenceNumber = reader.int32();
                continue;
              }
              case 4: {
                if (tag !== 34) {
                  break;
                }
                message.timeRange = TimeRange.decode(reader, reader.uint32());
                continue;
              }
              case 5: {
                if (tag !== 42) {
                  break;
                }
                message.tileContext = reader.string();
                continue;
              }
              case 6: {
                if (tag !== 48) {
                  break;
                }
                message.unknownField6 = reader.int32();
                continue;
              }
              case 7: {
                if (tag !== 56) {
                  break;
                }
                message.unknownField7 = reader.int32();
                continue;
              }
              case 8: {
                if (tag !== 66) {
                  break;
                }
                message.opportunityId = reader.string();
                continue;
              }
              case 9: {
                if (tag !== 74) {
                  break;
                }
                message.serializedPrefetchContext = reader.bytes();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/cuepoint_list.js
function createBaseCuepointList() {
  return { ssapInfos: [] };
}
var CuepointList;
var init_cuepoint_list = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/cuepoint_list.js"() {
    init_wire();
    init_cuepoint_info();
    CuepointList = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.ssapInfos) {
          CuepointInfo.encode(v, writer.uint32(10).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseCuepointList();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.ssapInfos.push(CuepointInfo.decode(reader, reader.uint32()));
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/media_capabilities.js
function createBaseMediaCapabilities() {
  return {
    videoFormatCapabilities: [],
    audioFormatCapabilities: [],
    perPlaybackAttributes: void 0,
    hdrModeBitmask: void 0
  };
}
function createBaseMediaCapabilities_PerPlaybackAttributes() {
  return { itagDenylist: [] };
}
function createBaseMediaCapabilities_VideoFormatCapability() {
  return {
    videoCodec: void 0,
    efficient: void 0,
    maxHeight: void 0,
    maxWidth: void 0,
    maxFramerate: void 0,
    maxBitrateBps: void 0,
    is10BitSupported: void 0
  };
}
function createBaseMediaCapabilities_AudioFormatCapability() {
  return {
    audioCodec: void 0,
    numChannels: void 0,
    maxBitrateBps: void 0,
    spatialCapabilityBitmask: void 0
  };
}
var MediaCapabilities, MediaCapabilities_PerPlaybackAttributes, MediaCapabilities_VideoFormatCapability, MediaCapabilities_AudioFormatCapability;
var init_media_capabilities = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/media_capabilities.js"() {
    init_wire();
    MediaCapabilities = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.videoFormatCapabilities) {
          MediaCapabilities_VideoFormatCapability.encode(v, writer.uint32(10).fork()).join();
        }
        for (const v of message.audioFormatCapabilities) {
          MediaCapabilities_AudioFormatCapability.encode(v, writer.uint32(18).fork()).join();
        }
        if (message.perPlaybackAttributes !== void 0) {
          MediaCapabilities_PerPlaybackAttributes.encode(message.perPlaybackAttributes, writer.uint32(34).fork()).join();
        }
        if (message.hdrModeBitmask !== void 0) {
          writer.uint32(40).int32(message.hdrModeBitmask);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseMediaCapabilities();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.videoFormatCapabilities.push(MediaCapabilities_VideoFormatCapability.decode(reader, reader.uint32()));
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.audioFormatCapabilities.push(MediaCapabilities_AudioFormatCapability.decode(reader, reader.uint32()));
                continue;
              }
              case 4: {
                if (tag !== 34) {
                  break;
                }
                message.perPlaybackAttributes = MediaCapabilities_PerPlaybackAttributes.decode(reader, reader.uint32());
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.hdrModeBitmask = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    MediaCapabilities_PerPlaybackAttributes = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.itagDenylist) {
          writer.uint32(8).int32(v);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseMediaCapabilities_PerPlaybackAttributes();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag === 8) {
                  message.itagDenylist.push(reader.int32());
                  continue;
                }
                if (tag === 10) {
                  const end2 = reader.uint32() + reader.pos;
                  while (reader.pos < end2) {
                    message.itagDenylist.push(reader.int32());
                  }
                  continue;
                }
                break;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    MediaCapabilities_VideoFormatCapability = {
      encode(message, writer = new BinaryWriter()) {
        if (message.videoCodec !== void 0) {
          writer.uint32(8).int32(message.videoCodec);
        }
        if (message.efficient !== void 0) {
          writer.uint32(16).bool(message.efficient);
        }
        if (message.maxHeight !== void 0) {
          writer.uint32(24).int32(message.maxHeight);
        }
        if (message.maxWidth !== void 0) {
          writer.uint32(32).int32(message.maxWidth);
        }
        if (message.maxFramerate !== void 0) {
          writer.uint32(88).int32(message.maxFramerate);
        }
        if (message.maxBitrateBps !== void 0) {
          writer.uint32(96).int32(message.maxBitrateBps);
        }
        if (message.is10BitSupported !== void 0) {
          writer.uint32(120).bool(message.is10BitSupported);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseMediaCapabilities_VideoFormatCapability();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.videoCodec = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.efficient = reader.bool();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.maxHeight = reader.int32();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.maxWidth = reader.int32();
                continue;
              }
              case 11: {
                if (tag !== 88) {
                  break;
                }
                message.maxFramerate = reader.int32();
                continue;
              }
              case 12: {
                if (tag !== 96) {
                  break;
                }
                message.maxBitrateBps = reader.int32();
                continue;
              }
              case 15: {
                if (tag !== 120) {
                  break;
                }
                message.is10BitSupported = reader.bool();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    MediaCapabilities_AudioFormatCapability = {
      encode(message, writer = new BinaryWriter()) {
        if (message.audioCodec !== void 0) {
          writer.uint32(8).int32(message.audioCodec);
        }
        if (message.numChannels !== void 0) {
          writer.uint32(16).int32(message.numChannels);
        }
        if (message.maxBitrateBps !== void 0) {
          writer.uint32(24).int32(message.maxBitrateBps);
        }
        if (message.spatialCapabilityBitmask !== void 0) {
          writer.uint32(48).int32(message.spatialCapabilityBitmask);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseMediaCapabilities_AudioFormatCapability();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.audioCodec = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.numChannels = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.maxBitrateBps = reader.int32();
                continue;
              }
              case 6: {
                if (tag !== 48) {
                  break;
                }
                message.spatialCapabilityBitmask = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/crypto_params.js
var init_crypto_params = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/crypto_params.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/allowed_cached_formats.js
var init_allowed_cached_formats = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/allowed_cached_formats.js"() {
    init_common();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/selectable_formats.js
var init_selectable_formats = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/selectable_formats.js"() {
    init_common();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/prewarm_connection.js
var init_prewarm_connection = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/prewarm_connection.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/playback_cookie.js
var init_playback_cookie = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/playback_cookie.js"() {
    init_common();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/playback_start_policy.js
var init_playback_start_policy = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/playback_start_policy.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/client_abr_state.js
function createBaseClientAbrState() {
  return {
    timeSinceLastManualFormatSelectionMs: void 0,
    lastManualDirection: void 0,
    lastManualSelectedResolution: void 0,
    detailedNetworkType: void 0,
    clientViewportWidth: void 0,
    clientViewportHeight: void 0,
    clientBitrateCapBytesPerSec: void 0,
    stickyResolution: void 0,
    clientViewportIsFlexible: void 0,
    bandwidthEstimate: void 0,
    minAudioQuality: void 0,
    maxAudioQuality: void 0,
    videoQualitySetting: void 0,
    audioRoute: void 0,
    playerTimeMs: void 0,
    timeSinceLastSeek: void 0,
    dataSaverMode: void 0,
    networkMeteredState: void 0,
    visibility: void 0,
    playbackRate: void 0,
    elapsedWallTimeMs: void 0,
    mediaCapabilities: void 0,
    timeSinceLastActionMs: void 0,
    enabledTrackTypesBitfield: void 0,
    maxPacingRate: void 0,
    playerState: void 0,
    drcEnabled: void 0,
    field48: void 0,
    field50: void 0,
    field51: void 0,
    sabrReportRequestCancellationInfo: void 0,
    disableStreamingXhr: void 0,
    field57: void 0,
    preferVp9: void 0,
    av1QualityThreshold: void 0,
    field60: void 0,
    isPrefetch: void 0,
    sabrSupportQualityConstraints: void 0,
    sabrLicenseConstraint: void 0,
    allowProximaLiveLatency: void 0,
    sabrForceProxima: void 0,
    field67: void 0,
    sabrForceMaxNetworkInterruptionDurationMs: void 0,
    audioTrackId: void 0,
    enableSabrHostFallback: void 0,
    enableVoiceBoost: void 0,
    playbackAuthorization: void 0,
    unknownField80: void 0,
    supportsChangeType: void 0,
    unknownField86: void 0
  };
}
var ClientAbrState;
var init_client_abr_state = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/client_abr_state.js"() {
    init_wire();
    init_common();
    init_media_capabilities();
    ClientAbrState = {
      encode(message, writer = new BinaryWriter()) {
        if (message.timeSinceLastManualFormatSelectionMs !== void 0) {
          writer.uint32(104).int64(message.timeSinceLastManualFormatSelectionMs);
        }
        if (message.lastManualDirection !== void 0) {
          writer.uint32(112).sint32(message.lastManualDirection);
        }
        if (message.lastManualSelectedResolution !== void 0) {
          writer.uint32(128).int32(message.lastManualSelectedResolution);
        }
        if (message.detailedNetworkType !== void 0) {
          writer.uint32(136).int32(message.detailedNetworkType);
        }
        if (message.clientViewportWidth !== void 0) {
          writer.uint32(144).int32(message.clientViewportWidth);
        }
        if (message.clientViewportHeight !== void 0) {
          writer.uint32(152).int32(message.clientViewportHeight);
        }
        if (message.clientBitrateCapBytesPerSec !== void 0) {
          writer.uint32(160).int64(message.clientBitrateCapBytesPerSec);
        }
        if (message.stickyResolution !== void 0) {
          writer.uint32(168).int32(message.stickyResolution);
        }
        if (message.clientViewportIsFlexible !== void 0) {
          writer.uint32(176).bool(message.clientViewportIsFlexible);
        }
        if (message.bandwidthEstimate !== void 0) {
          writer.uint32(184).int64(message.bandwidthEstimate);
        }
        if (message.minAudioQuality !== void 0) {
          writer.uint32(192).int32(message.minAudioQuality);
        }
        if (message.maxAudioQuality !== void 0) {
          writer.uint32(200).int32(message.maxAudioQuality);
        }
        if (message.videoQualitySetting !== void 0) {
          writer.uint32(208).int32(message.videoQualitySetting);
        }
        if (message.audioRoute !== void 0) {
          writer.uint32(216).int32(message.audioRoute);
        }
        if (message.playerTimeMs !== void 0) {
          writer.uint32(224).int64(message.playerTimeMs);
        }
        if (message.timeSinceLastSeek !== void 0) {
          writer.uint32(232).int64(message.timeSinceLastSeek);
        }
        if (message.dataSaverMode !== void 0) {
          writer.uint32(240).bool(message.dataSaverMode);
        }
        if (message.networkMeteredState !== void 0) {
          writer.uint32(256).int32(message.networkMeteredState);
        }
        if (message.visibility !== void 0) {
          writer.uint32(272).int32(message.visibility);
        }
        if (message.playbackRate !== void 0) {
          writer.uint32(285).float(message.playbackRate);
        }
        if (message.elapsedWallTimeMs !== void 0) {
          writer.uint32(288).int64(message.elapsedWallTimeMs);
        }
        if (message.mediaCapabilities !== void 0) {
          MediaCapabilities.encode(message.mediaCapabilities, writer.uint32(306).fork()).join();
        }
        if (message.timeSinceLastActionMs !== void 0) {
          writer.uint32(312).int64(message.timeSinceLastActionMs);
        }
        if (message.enabledTrackTypesBitfield !== void 0) {
          writer.uint32(320).int32(message.enabledTrackTypesBitfield);
        }
        if (message.maxPacingRate !== void 0) {
          writer.uint32(344).int32(message.maxPacingRate);
        }
        if (message.playerState !== void 0) {
          writer.uint32(352).int64(message.playerState);
        }
        if (message.drcEnabled !== void 0) {
          writer.uint32(368).bool(message.drcEnabled);
        }
        if (message.field48 !== void 0) {
          writer.uint32(384).int32(message.field48);
        }
        if (message.field50 !== void 0) {
          writer.uint32(400).int32(message.field50);
        }
        if (message.field51 !== void 0) {
          writer.uint32(408).int32(message.field51);
        }
        if (message.sabrReportRequestCancellationInfo !== void 0) {
          writer.uint32(432).int32(message.sabrReportRequestCancellationInfo);
        }
        if (message.disableStreamingXhr !== void 0) {
          writer.uint32(448).bool(message.disableStreamingXhr);
        }
        if (message.field57 !== void 0) {
          writer.uint32(456).int64(message.field57);
        }
        if (message.preferVp9 !== void 0) {
          writer.uint32(464).bool(message.preferVp9);
        }
        if (message.av1QualityThreshold !== void 0) {
          writer.uint32(472).int32(message.av1QualityThreshold);
        }
        if (message.field60 !== void 0) {
          writer.uint32(480).int32(message.field60);
        }
        if (message.isPrefetch !== void 0) {
          writer.uint32(488).bool(message.isPrefetch);
        }
        if (message.sabrSupportQualityConstraints !== void 0) {
          writer.uint32(496).bool(message.sabrSupportQualityConstraints);
        }
        if (message.sabrLicenseConstraint !== void 0) {
          writer.uint32(506).bytes(message.sabrLicenseConstraint);
        }
        if (message.allowProximaLiveLatency !== void 0) {
          writer.uint32(512).int32(message.allowProximaLiveLatency);
        }
        if (message.sabrForceProxima !== void 0) {
          writer.uint32(528).int32(message.sabrForceProxima);
        }
        if (message.field67 !== void 0) {
          writer.uint32(536).int32(message.field67);
        }
        if (message.sabrForceMaxNetworkInterruptionDurationMs !== void 0) {
          writer.uint32(544).int64(message.sabrForceMaxNetworkInterruptionDurationMs);
        }
        if (message.audioTrackId !== void 0) {
          writer.uint32(554).string(message.audioTrackId);
        }
        if (message.enableSabrHostFallback !== void 0) {
          writer.uint32(568).bool(message.enableSabrHostFallback);
        }
        if (message.enableVoiceBoost !== void 0) {
          writer.uint32(608).bool(message.enableVoiceBoost);
        }
        if (message.playbackAuthorization !== void 0) {
          PlaybackAuthorization.encode(message.playbackAuthorization, writer.uint32(634).fork()).join();
        }
        if (message.unknownField80 !== void 0) {
          writer.uint32(640).int32(message.unknownField80);
        }
        if (message.supportsChangeType !== void 0) {
          writer.uint32(680).bool(message.supportsChangeType);
        }
        if (message.unknownField86 !== void 0) {
          writer.uint32(688).bool(message.unknownField86);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseClientAbrState();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 13: {
                if (tag !== 104) {
                  break;
                }
                message.timeSinceLastManualFormatSelectionMs = reader.int64().toString();
                continue;
              }
              case 14: {
                if (tag !== 112) {
                  break;
                }
                message.lastManualDirection = reader.sint32();
                continue;
              }
              case 16: {
                if (tag !== 128) {
                  break;
                }
                message.lastManualSelectedResolution = reader.int32();
                continue;
              }
              case 17: {
                if (tag !== 136) {
                  break;
                }
                message.detailedNetworkType = reader.int32();
                continue;
              }
              case 18: {
                if (tag !== 144) {
                  break;
                }
                message.clientViewportWidth = reader.int32();
                continue;
              }
              case 19: {
                if (tag !== 152) {
                  break;
                }
                message.clientViewportHeight = reader.int32();
                continue;
              }
              case 20: {
                if (tag !== 160) {
                  break;
                }
                message.clientBitrateCapBytesPerSec = reader.int64().toString();
                continue;
              }
              case 21: {
                if (tag !== 168) {
                  break;
                }
                message.stickyResolution = reader.int32();
                continue;
              }
              case 22: {
                if (tag !== 176) {
                  break;
                }
                message.clientViewportIsFlexible = reader.bool();
                continue;
              }
              case 23: {
                if (tag !== 184) {
                  break;
                }
                message.bandwidthEstimate = reader.int64().toString();
                continue;
              }
              case 24: {
                if (tag !== 192) {
                  break;
                }
                message.minAudioQuality = reader.int32();
                continue;
              }
              case 25: {
                if (tag !== 200) {
                  break;
                }
                message.maxAudioQuality = reader.int32();
                continue;
              }
              case 26: {
                if (tag !== 208) {
                  break;
                }
                message.videoQualitySetting = reader.int32();
                continue;
              }
              case 27: {
                if (tag !== 216) {
                  break;
                }
                message.audioRoute = reader.int32();
                continue;
              }
              case 28: {
                if (tag !== 224) {
                  break;
                }
                message.playerTimeMs = reader.int64().toString();
                continue;
              }
              case 29: {
                if (tag !== 232) {
                  break;
                }
                message.timeSinceLastSeek = reader.int64().toString();
                continue;
              }
              case 30: {
                if (tag !== 240) {
                  break;
                }
                message.dataSaverMode = reader.bool();
                continue;
              }
              case 32: {
                if (tag !== 256) {
                  break;
                }
                message.networkMeteredState = reader.int32();
                continue;
              }
              case 34: {
                if (tag !== 272) {
                  break;
                }
                message.visibility = reader.int32();
                continue;
              }
              case 35: {
                if (tag !== 285) {
                  break;
                }
                message.playbackRate = reader.float();
                continue;
              }
              case 36: {
                if (tag !== 288) {
                  break;
                }
                message.elapsedWallTimeMs = reader.int64().toString();
                continue;
              }
              case 38: {
                if (tag !== 306) {
                  break;
                }
                message.mediaCapabilities = MediaCapabilities.decode(reader, reader.uint32());
                continue;
              }
              case 39: {
                if (tag !== 312) {
                  break;
                }
                message.timeSinceLastActionMs = reader.int64().toString();
                continue;
              }
              case 40: {
                if (tag !== 320) {
                  break;
                }
                message.enabledTrackTypesBitfield = reader.int32();
                continue;
              }
              case 43: {
                if (tag !== 344) {
                  break;
                }
                message.maxPacingRate = reader.int32();
                continue;
              }
              case 44: {
                if (tag !== 352) {
                  break;
                }
                message.playerState = reader.int64().toString();
                continue;
              }
              case 46: {
                if (tag !== 368) {
                  break;
                }
                message.drcEnabled = reader.bool();
                continue;
              }
              case 48: {
                if (tag !== 384) {
                  break;
                }
                message.field48 = reader.int32();
                continue;
              }
              case 50: {
                if (tag !== 400) {
                  break;
                }
                message.field50 = reader.int32();
                continue;
              }
              case 51: {
                if (tag !== 408) {
                  break;
                }
                message.field51 = reader.int32();
                continue;
              }
              case 54: {
                if (tag !== 432) {
                  break;
                }
                message.sabrReportRequestCancellationInfo = reader.int32();
                continue;
              }
              case 56: {
                if (tag !== 448) {
                  break;
                }
                message.disableStreamingXhr = reader.bool();
                continue;
              }
              case 57: {
                if (tag !== 456) {
                  break;
                }
                message.field57 = reader.int64().toString();
                continue;
              }
              case 58: {
                if (tag !== 464) {
                  break;
                }
                message.preferVp9 = reader.bool();
                continue;
              }
              case 59: {
                if (tag !== 472) {
                  break;
                }
                message.av1QualityThreshold = reader.int32();
                continue;
              }
              case 60: {
                if (tag !== 480) {
                  break;
                }
                message.field60 = reader.int32();
                continue;
              }
              case 61: {
                if (tag !== 488) {
                  break;
                }
                message.isPrefetch = reader.bool();
                continue;
              }
              case 62: {
                if (tag !== 496) {
                  break;
                }
                message.sabrSupportQualityConstraints = reader.bool();
                continue;
              }
              case 63: {
                if (tag !== 506) {
                  break;
                }
                message.sabrLicenseConstraint = reader.bytes();
                continue;
              }
              case 64: {
                if (tag !== 512) {
                  break;
                }
                message.allowProximaLiveLatency = reader.int32();
                continue;
              }
              case 66: {
                if (tag !== 528) {
                  break;
                }
                message.sabrForceProxima = reader.int32();
                continue;
              }
              case 67: {
                if (tag !== 536) {
                  break;
                }
                message.field67 = reader.int32();
                continue;
              }
              case 68: {
                if (tag !== 544) {
                  break;
                }
                message.sabrForceMaxNetworkInterruptionDurationMs = reader.int64().toString();
                continue;
              }
              case 69: {
                if (tag !== 554) {
                  break;
                }
                message.audioTrackId = reader.string();
                continue;
              }
              case 71: {
                if (tag !== 568) {
                  break;
                }
                message.enableSabrHostFallback = reader.bool();
                continue;
              }
              case 76: {
                if (tag !== 608) {
                  break;
                }
                message.enableVoiceBoost = reader.bool();
                continue;
              }
              case 79: {
                if (tag !== 634) {
                  break;
                }
                message.playbackAuthorization = PlaybackAuthorization.decode(reader, reader.uint32());
                continue;
              }
              case 80: {
                if (tag !== 640) {
                  break;
                }
                message.unknownField80 = reader.int32();
                continue;
              }
              case 85: {
                if (tag !== 680) {
                  break;
                }
                message.supportsChangeType = reader.bool();
                continue;
              }
              case 86: {
                if (tag !== 688) {
                  break;
                }
                message.unknownField86 = reader.bool();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/ssap_playback_info.js
function createBaseSsapPlaybackInfo() {
  return {
    adCpns: [],
    adsConfig: void 0,
    daiState: void 0,
    skipSequence: void 0,
    unknownField5: void 0,
    unknownField6: void 0,
    cuepointId: void 0,
    state: void 0,
    tileContext: void 0,
    startTimeMs: void 0,
    durationMs: void 0
  };
}
var SsapPlaybackInfo_AdState, SsapPlaybackInfo;
var init_ssap_playback_info = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/ssap_playback_info.js"() {
    init_wire();
    SsapPlaybackInfo_AdState = {
      UNKNOWN: 0,
      0: "UNKNOWN",
      TIMEOUT: 1,
      1: "TIMEOUT",
      /** RATECONTROL - when /ad_break returns adThrottled=true */
      RATECONTROL: 2,
      /** RATECONTROL - when /ad_break returns adThrottled=true */
      2: "RATECONTROL",
      /** RATECONTROL_CLIENT - when the client itself throttles ad requests? */
      RATECONTROL_CLIENT: 11,
      /** RATECONTROL_CLIENT - when the client itself throttles ad requests? */
      11: "RATECONTROL_CLIENT",
      SERVER_ERROR: 3,
      3: "SERVER_ERROR",
      DELETED: 4,
      4: "DELETED",
      WAITING: 5,
      5: "WAITING",
      READY: 6,
      6: "READY",
      SSDISABLED: 7,
      7: "SSDISABLED",
      SSDISABLED_USTREAMER: 9,
      9: "SSDISABLED_USTREAMER",
      SSDISABLED_NO_CONFIG: 10,
      10: "SSDISABLED_NO_CONFIG",
      NO_DAI_CONFIG_RETURNED_IN_GAB: 12,
      12: "NO_DAI_CONFIG_RETURNED_IN_GAB",
      INACTIVE: 8,
      8: "INACTIVE",
      CACHE_MISS: 13,
      13: "CACHE_MISS",
      UNRECOGNIZED: -1,
      "-1": "UNRECOGNIZED"
    };
    SsapPlaybackInfo = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.adCpns) {
          writer.uint32(10).string(v);
        }
        if (message.adsConfig !== void 0) {
          writer.uint32(18).bytes(message.adsConfig);
        }
        if (message.daiState !== void 0) {
          writer.uint32(26).string(message.daiState);
        }
        if (message.skipSequence !== void 0) {
          writer.uint32(32).int32(message.skipSequence);
        }
        if (message.unknownField5 !== void 0) {
          writer.uint32(40).int32(message.unknownField5);
        }
        if (message.unknownField6 !== void 0) {
          writer.uint32(50).string(message.unknownField6);
        }
        if (message.cuepointId !== void 0) {
          writer.uint32(58).string(message.cuepointId);
        }
        if (message.state !== void 0) {
          writer.uint32(64).int32(message.state);
        }
        if (message.tileContext !== void 0) {
          writer.uint32(74).string(message.tileContext);
        }
        if (message.startTimeMs !== void 0) {
          writer.uint32(80).int64(message.startTimeMs);
        }
        if (message.durationMs !== void 0) {
          writer.uint32(88).int64(message.durationMs);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSsapPlaybackInfo();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.adCpns.push(reader.string());
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.adsConfig = reader.bytes();
                continue;
              }
              case 3: {
                if (tag !== 26) {
                  break;
                }
                message.daiState = reader.string();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.skipSequence = reader.int32();
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.unknownField5 = reader.int32();
                continue;
              }
              case 6: {
                if (tag !== 50) {
                  break;
                }
                message.unknownField6 = reader.string();
                continue;
              }
              case 7: {
                if (tag !== 58) {
                  break;
                }
                message.cuepointId = reader.string();
                continue;
              }
              case 8: {
                if (tag !== 64) {
                  break;
                }
                message.state = reader.int32();
                continue;
              }
              case 9: {
                if (tag !== 74) {
                  break;
                }
                message.tileContext = reader.string();
                continue;
              }
              case 10: {
                if (tag !== 80) {
                  break;
                }
                message.startTimeMs = reader.int64().toString();
                continue;
              }
              case 11: {
                if (tag !== 88) {
                  break;
                }
                message.durationMs = reader.int64().toString();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/streamer_context.js
function createBaseStreamerContext() {
  return {
    clientInfo: void 0,
    poToken: void 0,
    playbackCookie: void 0,
    field4: void 0,
    sabrContexts: [],
    unsentSabrContexts: [],
    field7: void 0,
    field8: void 0
  };
}
function createBaseStreamerContext_ClientInfo() {
  return {
    hl: void 0,
    deviceMake: void 0,
    deviceModel: void 0,
    clientName: void 0,
    clientVersion: void 0,
    osName: void 0,
    osVersion: void 0
  };
}
function createBaseStreamerContext_SabrContext() {
  return { type: void 0, value: void 0 };
}
function createBaseStreamerContext_UnknownMessage1() {
  return { field1: void 0, field2: void 0 };
}
function createBaseStreamerContext_UnknownMessage1_UnknownInnerMessage1() {
  return { code: void 0, message: void 0 };
}
var StreamerContext, StreamerContext_ClientInfo, StreamerContext_SabrContext, StreamerContext_UnknownMessage1, StreamerContext_UnknownMessage1_UnknownInnerMessage1;
var init_streamer_context = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/streamer_context.js"() {
    init_wire();
    StreamerContext = {
      encode(message, writer = new BinaryWriter()) {
        if (message.clientInfo !== void 0) {
          StreamerContext_ClientInfo.encode(message.clientInfo, writer.uint32(10).fork()).join();
        }
        if (message.poToken !== void 0) {
          writer.uint32(18).bytes(message.poToken);
        }
        if (message.playbackCookie !== void 0) {
          writer.uint32(26).bytes(message.playbackCookie);
        }
        if (message.field4 !== void 0) {
          writer.uint32(34).bytes(message.field4);
        }
        for (const v of message.sabrContexts) {
          StreamerContext_SabrContext.encode(v, writer.uint32(42).fork()).join();
        }
        for (const v of message.unsentSabrContexts) {
          writer.uint32(48).int32(v);
        }
        if (message.field7 !== void 0) {
          writer.uint32(58).string(message.field7);
        }
        if (message.field8 !== void 0) {
          StreamerContext_UnknownMessage1.encode(message.field8, writer.uint32(66).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseStreamerContext();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.clientInfo = StreamerContext_ClientInfo.decode(reader, reader.uint32());
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.poToken = reader.bytes();
                continue;
              }
              case 3: {
                if (tag !== 26) {
                  break;
                }
                message.playbackCookie = reader.bytes();
                continue;
              }
              case 4: {
                if (tag !== 34) {
                  break;
                }
                message.field4 = reader.bytes();
                continue;
              }
              case 5: {
                if (tag !== 42) {
                  break;
                }
                message.sabrContexts.push(StreamerContext_SabrContext.decode(reader, reader.uint32()));
                continue;
              }
              case 6: {
                if (tag === 48) {
                  message.unsentSabrContexts.push(reader.int32());
                  continue;
                }
                if (tag === 50) {
                  const end2 = reader.uint32() + reader.pos;
                  while (reader.pos < end2) {
                    message.unsentSabrContexts.push(reader.int32());
                  }
                  continue;
                }
                break;
              }
              case 7: {
                if (tag !== 58) {
                  break;
                }
                message.field7 = reader.string();
                continue;
              }
              case 8: {
                if (tag !== 66) {
                  break;
                }
                message.field8 = StreamerContext_UnknownMessage1.decode(reader, reader.uint32());
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    StreamerContext_ClientInfo = {
      encode(message, writer = new BinaryWriter()) {
        if (message.hl !== void 0) {
          writer.uint32(10).string(message.hl);
        }
        if (message.deviceMake !== void 0) {
          writer.uint32(98).string(message.deviceMake);
        }
        if (message.deviceModel !== void 0) {
          writer.uint32(106).string(message.deviceModel);
        }
        if (message.clientName !== void 0) {
          writer.uint32(128).int32(message.clientName);
        }
        if (message.clientVersion !== void 0) {
          writer.uint32(138).string(message.clientVersion);
        }
        if (message.osName !== void 0) {
          writer.uint32(146).string(message.osName);
        }
        if (message.osVersion !== void 0) {
          writer.uint32(154).string(message.osVersion);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseStreamerContext_ClientInfo();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.hl = reader.string();
                continue;
              }
              case 12: {
                if (tag !== 98) {
                  break;
                }
                message.deviceMake = reader.string();
                continue;
              }
              case 13: {
                if (tag !== 106) {
                  break;
                }
                message.deviceModel = reader.string();
                continue;
              }
              case 16: {
                if (tag !== 128) {
                  break;
                }
                message.clientName = reader.int32();
                continue;
              }
              case 17: {
                if (tag !== 138) {
                  break;
                }
                message.clientVersion = reader.string();
                continue;
              }
              case 18: {
                if (tag !== 146) {
                  break;
                }
                message.osName = reader.string();
                continue;
              }
              case 19: {
                if (tag !== 154) {
                  break;
                }
                message.osVersion = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    StreamerContext_SabrContext = {
      encode(message, writer = new BinaryWriter()) {
        if (message.type !== void 0) {
          writer.uint32(8).int32(message.type);
        }
        if (message.value !== void 0) {
          writer.uint32(18).bytes(message.value);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseStreamerContext_SabrContext();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.type = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.value = reader.bytes();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    StreamerContext_UnknownMessage1 = {
      encode(message, writer = new BinaryWriter()) {
        if (message.field1 !== void 0) {
          writer.uint32(10).bytes(message.field1);
        }
        if (message.field2 !== void 0) {
          StreamerContext_UnknownMessage1_UnknownInnerMessage1.encode(message.field2, writer.uint32(18).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseStreamerContext_UnknownMessage1();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.field1 = reader.bytes();
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.field2 = StreamerContext_UnknownMessage1_UnknownInnerMessage1.decode(reader, reader.uint32());
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    StreamerContext_UnknownMessage1_UnknownInnerMessage1 = {
      encode(message, writer = new BinaryWriter()) {
        if (message.code !== void 0) {
          writer.uint32(8).int32(message.code);
        }
        if (message.message !== void 0) {
          writer.uint32(18).string(message.message);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseStreamerContext_UnknownMessage1_UnknownInnerMessage1();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.code = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.message = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/video_playback_abr_request.js
function createBaseVideoPlaybackAbrRequest() {
  return {
    clientAbrState: void 0,
    initializationFormatIds: [],
    bufferedRanges: [],
    mediaStartTimeMs: void 0,
    videoPlaybackUstreamerConfig: void 0,
    field6: void 0,
    selectedAudioFormatIds: [],
    selectedVideoFormatIds: [],
    selectedCaptionFormatIds: [],
    streamerContext: void 0,
    serverStitchedDaiInfo: void 0,
    lastVideoItag: void 0,
    lastAudioItag: void 0,
    ssapPlaybackInfos: [],
    unusedBloatSizeBytes: void 0,
    field1000: []
  };
}
function createBaseUnknownMessage1() {
  return { formatId: void 0, lmt: void 0, sequenceNumber: void 0, timeRange: void 0, field5: void 0 };
}
function createBaseUnknownMessage2() {
  return { formatIds: [], ud: [], clipId: void 0 };
}
var VideoPlaybackAbrRequest, UnknownMessage1, UnknownMessage2;
var init_video_playback_abr_request = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/video_playback_abr_request.js"() {
    init_wire();
    init_common();
    init_buffered_range();
    init_client_abr_state();
    init_ssap_playback_info();
    init_streamer_context();
    init_time_range();
    VideoPlaybackAbrRequest = {
      encode(message, writer = new BinaryWriter()) {
        if (message.clientAbrState !== void 0) {
          ClientAbrState.encode(message.clientAbrState, writer.uint32(10).fork()).join();
        }
        for (const v of message.initializationFormatIds) {
          FormatId.encode(v, writer.uint32(18).fork()).join();
        }
        for (const v of message.bufferedRanges) {
          BufferedRange.encode(v, writer.uint32(26).fork()).join();
        }
        if (message.mediaStartTimeMs !== void 0) {
          writer.uint32(32).int64(message.mediaStartTimeMs);
        }
        if (message.videoPlaybackUstreamerConfig !== void 0) {
          writer.uint32(42).bytes(message.videoPlaybackUstreamerConfig);
        }
        if (message.field6 !== void 0) {
          UnknownMessage1.encode(message.field6, writer.uint32(50).fork()).join();
        }
        for (const v of message.selectedAudioFormatIds) {
          FormatId.encode(v, writer.uint32(130).fork()).join();
        }
        for (const v of message.selectedVideoFormatIds) {
          FormatId.encode(v, writer.uint32(138).fork()).join();
        }
        for (const v of message.selectedCaptionFormatIds) {
          FormatId.encode(v, writer.uint32(146).fork()).join();
        }
        if (message.streamerContext !== void 0) {
          StreamerContext.encode(message.streamerContext, writer.uint32(154).fork()).join();
        }
        if (message.serverStitchedDaiInfo !== void 0) {
          SsapPlaybackInfo.encode(message.serverStitchedDaiInfo, writer.uint32(170).fork()).join();
        }
        if (message.lastVideoItag !== void 0) {
          writer.uint32(176).int32(message.lastVideoItag);
        }
        if (message.lastAudioItag !== void 0) {
          writer.uint32(184).int32(message.lastAudioItag);
        }
        for (const v of message.ssapPlaybackInfos) {
          SsapPlaybackInfo.encode(v, writer.uint32(194).fork()).join();
        }
        if (message.unusedBloatSizeBytes !== void 0) {
          writer.uint32(202).bytes(message.unusedBloatSizeBytes);
        }
        for (const v of message.field1000) {
          UnknownMessage2.encode(v, writer.uint32(8002).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseVideoPlaybackAbrRequest();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.clientAbrState = ClientAbrState.decode(reader, reader.uint32());
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.initializationFormatIds.push(FormatId.decode(reader, reader.uint32()));
                continue;
              }
              case 3: {
                if (tag !== 26) {
                  break;
                }
                message.bufferedRanges.push(BufferedRange.decode(reader, reader.uint32()));
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.mediaStartTimeMs = reader.int64().toString();
                continue;
              }
              case 5: {
                if (tag !== 42) {
                  break;
                }
                message.videoPlaybackUstreamerConfig = reader.bytes();
                continue;
              }
              case 6: {
                if (tag !== 50) {
                  break;
                }
                message.field6 = UnknownMessage1.decode(reader, reader.uint32());
                continue;
              }
              case 16: {
                if (tag !== 130) {
                  break;
                }
                message.selectedAudioFormatIds.push(FormatId.decode(reader, reader.uint32()));
                continue;
              }
              case 17: {
                if (tag !== 138) {
                  break;
                }
                message.selectedVideoFormatIds.push(FormatId.decode(reader, reader.uint32()));
                continue;
              }
              case 18: {
                if (tag !== 146) {
                  break;
                }
                message.selectedCaptionFormatIds.push(FormatId.decode(reader, reader.uint32()));
                continue;
              }
              case 19: {
                if (tag !== 154) {
                  break;
                }
                message.streamerContext = StreamerContext.decode(reader, reader.uint32());
                continue;
              }
              case 21: {
                if (tag !== 170) {
                  break;
                }
                message.serverStitchedDaiInfo = SsapPlaybackInfo.decode(reader, reader.uint32());
                continue;
              }
              case 22: {
                if (tag !== 176) {
                  break;
                }
                message.lastVideoItag = reader.int32();
                continue;
              }
              case 23: {
                if (tag !== 184) {
                  break;
                }
                message.lastAudioItag = reader.int32();
                continue;
              }
              case 24: {
                if (tag !== 194) {
                  break;
                }
                message.ssapPlaybackInfos.push(SsapPlaybackInfo.decode(reader, reader.uint32()));
                continue;
              }
              case 25: {
                if (tag !== 202) {
                  break;
                }
                message.unusedBloatSizeBytes = reader.bytes();
                continue;
              }
              case 1e3: {
                if (tag !== 8002) {
                  break;
                }
                message.field1000.push(UnknownMessage2.decode(reader, reader.uint32()));
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    UnknownMessage1 = {
      encode(message, writer = new BinaryWriter()) {
        if (message.formatId !== void 0) {
          FormatId.encode(message.formatId, writer.uint32(10).fork()).join();
        }
        if (message.lmt !== void 0) {
          writer.uint32(16).sint64(message.lmt);
        }
        if (message.sequenceNumber !== void 0) {
          writer.uint32(24).int32(message.sequenceNumber);
        }
        if (message.timeRange !== void 0) {
          TimeRange.encode(message.timeRange, writer.uint32(34).fork()).join();
        }
        if (message.field5 !== void 0) {
          writer.uint32(40).int32(message.field5);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseUnknownMessage1();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.formatId = FormatId.decode(reader, reader.uint32());
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.lmt = reader.sint64().toString();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.sequenceNumber = reader.int32();
                continue;
              }
              case 4: {
                if (tag !== 34) {
                  break;
                }
                message.timeRange = TimeRange.decode(reader, reader.uint32());
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.field5 = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    UnknownMessage2 = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.formatIds) {
          FormatId.encode(v, writer.uint32(10).fork()).join();
        }
        for (const v of message.ud) {
          BufferedRange.encode(v, writer.uint32(18).fork()).join();
        }
        if (message.clipId !== void 0) {
          writer.uint32(26).string(message.clipId);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseUnknownMessage2();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.formatIds.push(FormatId.decode(reader, reader.uint32()));
                continue;
              }
              case 2: {
                if (tag !== 18) {
                  break;
                }
                message.ud.push(BufferedRange.decode(reader, reader.uint32()));
                continue;
              }
              case 3: {
                if (tag !== 26) {
                  break;
                }
                message.clipId = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/next_request_policy.js
function createBaseNextRequestPolicy() {
  return {
    targetAudioReadaheadMs: void 0,
    targetVideoReadaheadMs: void 0,
    maxTimeSinceLastRequestMs: void 0,
    backoffTimeMs: void 0,
    minAudioReadaheadMs: void 0,
    minVideoReadaheadMs: void 0,
    playbackCookie: void 0,
    videoId: void 0
  };
}
var NextRequestPolicy;
var init_next_request_policy = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/next_request_policy.js"() {
    init_wire();
    NextRequestPolicy = {
      encode(message, writer = new BinaryWriter()) {
        if (message.targetAudioReadaheadMs !== void 0) {
          writer.uint32(8).int32(message.targetAudioReadaheadMs);
        }
        if (message.targetVideoReadaheadMs !== void 0) {
          writer.uint32(16).int32(message.targetVideoReadaheadMs);
        }
        if (message.maxTimeSinceLastRequestMs !== void 0) {
          writer.uint32(24).int32(message.maxTimeSinceLastRequestMs);
        }
        if (message.backoffTimeMs !== void 0) {
          writer.uint32(32).int32(message.backoffTimeMs);
        }
        if (message.minAudioReadaheadMs !== void 0) {
          writer.uint32(40).int32(message.minAudioReadaheadMs);
        }
        if (message.minVideoReadaheadMs !== void 0) {
          writer.uint32(48).int32(message.minVideoReadaheadMs);
        }
        if (message.playbackCookie !== void 0) {
          writer.uint32(58).bytes(message.playbackCookie);
        }
        if (message.videoId !== void 0) {
          writer.uint32(66).string(message.videoId);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseNextRequestPolicy();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.targetAudioReadaheadMs = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.targetVideoReadaheadMs = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.maxTimeSinceLastRequestMs = reader.int32();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.backoffTimeMs = reader.int32();
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.minAudioReadaheadMs = reader.int32();
                continue;
              }
              case 6: {
                if (tag !== 48) {
                  break;
                }
                message.minVideoReadaheadMs = reader.int32();
                continue;
              }
              case 7: {
                if (tag !== 58) {
                  break;
                }
                message.playbackCookie = reader.bytes();
                continue;
              }
              case 8: {
                if (tag !== 66) {
                  break;
                }
                message.videoId = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/request_cancellation_policy.js
var init_request_cancellation_policy = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/request_cancellation_policy.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/request_identifier.js
var init_request_identifier = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/request_identifier.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_error.js
function createBaseSabrError() {
  return { type: void 0, code: void 0 };
}
var SabrError;
var init_sabr_error = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_error.js"() {
    init_wire();
    SabrError = {
      encode(message, writer = new BinaryWriter()) {
        if (message.type !== void 0) {
          writer.uint32(10).string(message.type);
        }
        if (message.code !== void 0) {
          writer.uint32(16).int32(message.code);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSabrError();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.type = reader.string();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.code = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_redirect.js
function createBaseSabrRedirect() {
  return { url: void 0 };
}
var SabrRedirect;
var init_sabr_redirect = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_redirect.js"() {
    init_wire();
    SabrRedirect = {
      encode(message, writer = new BinaryWriter()) {
        if (message.url !== void 0) {
          writer.uint32(10).string(message.url);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSabrRedirect();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.url = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_seek.js
function createBaseSabrSeek() {
  return { seekMediaTime: void 0, seekMediaTimescale: void 0, seekSource: void 0 };
}
var SabrSeek;
var init_sabr_seek = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_seek.js"() {
    init_wire();
    SabrSeek = {
      encode(message, writer = new BinaryWriter()) {
        if (message.seekMediaTime !== void 0) {
          writer.uint32(8).int64(message.seekMediaTime);
        }
        if (message.seekMediaTimescale !== void 0) {
          writer.uint32(16).int32(message.seekMediaTimescale);
        }
        if (message.seekSource !== void 0) {
          writer.uint32(24).int32(message.seekSource);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSabrSeek();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.seekMediaTime = reader.int64().toString();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.seekMediaTimescale = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.seekSource = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/innertube_request.js
var init_innertube_request = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/innertube_request.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/reload_player_response.js
function createBaseReloadPlaybackParams() {
  return { token: void 0 };
}
function createBaseReloadPlaybackContext() {
  return { reloadPlaybackParams: void 0 };
}
var ReloadPlaybackParams, ReloadPlaybackContext;
var init_reload_player_response = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/reload_player_response.js"() {
    init_wire();
    ReloadPlaybackParams = {
      encode(message, writer = new BinaryWriter()) {
        if (message.token !== void 0) {
          writer.uint32(10).string(message.token);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseReloadPlaybackParams();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.token = reader.string();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
    ReloadPlaybackContext = {
      encode(message, writer = new BinaryWriter()) {
        if (message.reloadPlaybackParams !== void 0) {
          ReloadPlaybackParams.encode(message.reloadPlaybackParams, writer.uint32(10).fork()).join();
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseReloadPlaybackContext();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.reloadPlaybackParams = ReloadPlaybackParams.decode(reader, reader.uint32());
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_request.js
var init_onesie_request = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_request.js"() {
    init_buffered_range();
    init_client_abr_state();
    init_innertube_request();
    init_reload_player_response();
    init_streamer_context();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_header.js
var init_onesie_header = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_header.js"() {
    init_crypto_params();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_header_type.js
var init_onesie_header_type = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_header_type.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_innertube_request.js
var init_onesie_innertube_request = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_innertube_request.js"() {
    init_common();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_innertube_response.js
var init_onesie_innertube_response = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_innertube_response.js"() {
    init_common();
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_proxy_status.js
var init_onesie_proxy_status = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/onesie_proxy_status.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_context_update.js
function createBaseSabrContextUpdate() {
  return { type: void 0, scope: void 0, value: void 0, sendByDefault: void 0, writePolicy: void 0 };
}
var SabrContextUpdate_SabrContextWritePolicy, SabrContextUpdate;
var init_sabr_context_update = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_context_update.js"() {
    init_wire();
    SabrContextUpdate_SabrContextWritePolicy = {
      UNSPECIFIED: 0,
      0: "UNSPECIFIED",
      OVERWRITE: 1,
      1: "OVERWRITE",
      KEEP_EXISTING: 2,
      2: "KEEP_EXISTING",
      UNRECOGNIZED: -1,
      "-1": "UNRECOGNIZED"
    };
    SabrContextUpdate = {
      encode(message, writer = new BinaryWriter()) {
        if (message.type !== void 0) {
          writer.uint32(8).int32(message.type);
        }
        if (message.scope !== void 0) {
          writer.uint32(16).int32(message.scope);
        }
        if (message.value !== void 0) {
          writer.uint32(26).bytes(message.value);
        }
        if (message.sendByDefault !== void 0) {
          writer.uint32(32).bool(message.sendByDefault);
        }
        if (message.writePolicy !== void 0) {
          writer.uint32(40).int32(message.writePolicy);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSabrContextUpdate();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.type = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.scope = reader.int32();
                continue;
              }
              case 3: {
                if (tag !== 26) {
                  break;
                }
                message.value = reader.bytes();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.sendByDefault = reader.bool();
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.writePolicy = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_context_sending_policy.js
function createBaseSabrContextSendingPolicy() {
  return { startPolicy: [], stopPolicy: [], discardPolicy: [] };
}
var SabrContextSendingPolicy;
var init_sabr_context_sending_policy = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_context_sending_policy.js"() {
    init_wire();
    SabrContextSendingPolicy = {
      encode(message, writer = new BinaryWriter()) {
        for (const v of message.startPolicy) {
          writer.uint32(8).int32(v);
        }
        for (const v of message.stopPolicy) {
          writer.uint32(16).int32(v);
        }
        for (const v of message.discardPolicy) {
          writer.uint32(24).int32(v);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSabrContextSendingPolicy();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag === 8) {
                  message.startPolicy.push(reader.int32());
                  continue;
                }
                if (tag === 10) {
                  const end2 = reader.uint32() + reader.pos;
                  while (reader.pos < end2) {
                    message.startPolicy.push(reader.int32());
                  }
                  continue;
                }
                break;
              }
              case 2: {
                if (tag === 16) {
                  message.stopPolicy.push(reader.int32());
                  continue;
                }
                if (tag === 18) {
                  const end2 = reader.uint32() + reader.pos;
                  while (reader.pos < end2) {
                    message.stopPolicy.push(reader.int32());
                  }
                  continue;
                }
                break;
              }
              case 3: {
                if (tag === 24) {
                  message.discardPolicy.push(reader.int32());
                  continue;
                }
                if (tag === 26) {
                  const end2 = reader.uint32() + reader.pos;
                  while (reader.pos < end2) {
                    message.discardPolicy.push(reader.int32());
                  }
                  continue;
                }
                break;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_live_metadata.js
function createBaseSabrLiveMetadata() {
  return {
    broadcastId: void 0,
    headSequenceNumber: void 0,
    headTimeMs: void 0,
    wallTimeMs: void 0,
    videoId: void 0,
    postLiveDvr: void 0,
    headm: void 0,
    minSeekableTimeTicks: void 0,
    minSeekableTimescale: void 0,
    maxSeekableTimeTicks: void 0,
    maxSeekableTimescale: void 0
  };
}
var SabrLiveMetadata;
var init_sabr_live_metadata = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/sabr_live_metadata.js"() {
    init_wire();
    SabrLiveMetadata = {
      encode(message, writer = new BinaryWriter()) {
        if (message.broadcastId !== void 0) {
          writer.uint32(10).string(message.broadcastId);
        }
        if (message.headSequenceNumber !== void 0) {
          writer.uint32(24).int64(message.headSequenceNumber);
        }
        if (message.headTimeMs !== void 0) {
          writer.uint32(32).int64(message.headTimeMs);
        }
        if (message.wallTimeMs !== void 0) {
          writer.uint32(40).int64(message.wallTimeMs);
        }
        if (message.videoId !== void 0) {
          writer.uint32(50).string(message.videoId);
        }
        if (message.postLiveDvr !== void 0) {
          writer.uint32(64).bool(message.postLiveDvr);
        }
        if (message.headm !== void 0) {
          writer.uint32(80).int64(message.headm);
        }
        if (message.minSeekableTimeTicks !== void 0) {
          writer.uint32(96).int64(message.minSeekableTimeTicks);
        }
        if (message.minSeekableTimescale !== void 0) {
          writer.uint32(104).int32(message.minSeekableTimescale);
        }
        if (message.maxSeekableTimeTicks !== void 0) {
          writer.uint32(112).int64(message.maxSeekableTimeTicks);
        }
        if (message.maxSeekableTimescale !== void 0) {
          writer.uint32(120).int32(message.maxSeekableTimescale);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseSabrLiveMetadata();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 10) {
                  break;
                }
                message.broadcastId = reader.string();
                continue;
              }
              case 3: {
                if (tag !== 24) {
                  break;
                }
                message.headSequenceNumber = reader.int64().toString();
                continue;
              }
              case 4: {
                if (tag !== 32) {
                  break;
                }
                message.headTimeMs = reader.int64().toString();
                continue;
              }
              case 5: {
                if (tag !== 40) {
                  break;
                }
                message.wallTimeMs = reader.int64().toString();
                continue;
              }
              case 6: {
                if (tag !== 50) {
                  break;
                }
                message.videoId = reader.string();
                continue;
              }
              case 8: {
                if (tag !== 64) {
                  break;
                }
                message.postLiveDvr = reader.bool();
                continue;
              }
              case 10: {
                if (tag !== 80) {
                  break;
                }
                message.headm = reader.int64().toString();
                continue;
              }
              case 12: {
                if (tag !== 96) {
                  break;
                }
                message.minSeekableTimeTicks = reader.int64().toString();
                continue;
              }
              case 13: {
                if (tag !== 104) {
                  break;
                }
                message.minSeekableTimescale = reader.int32();
                continue;
              }
              case 14: {
                if (tag !== 112) {
                  break;
                }
                message.maxSeekableTimeTicks = reader.int64().toString();
                continue;
              }
              case 15: {
                if (tag !== 120) {
                  break;
                }
                message.maxSeekableTimescale = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/stream_protection_status.js
function createBaseStreamProtectionStatus() {
  return { status: void 0, maxRetries: void 0 };
}
var StreamProtectionStatus;
var init_stream_protection_status = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/stream_protection_status.js"() {
    init_wire();
    StreamProtectionStatus = {
      encode(message, writer = new BinaryWriter()) {
        if (message.status !== void 0) {
          writer.uint32(8).int32(message.status);
        }
        if (message.maxRetries !== void 0) {
          writer.uint32(16).int32(message.maxRetries);
        }
        return writer;
      },
      decode(input, length) {
        const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
        const previousRecursionDepth = reader.__tsProtoDecodeDepth ?? 0;
        if (previousRecursionDepth >= 100) {
          throw new globalThis.Error("protobuf decode recursion limit exceeded");
        }
        reader.__tsProtoDecodeDepth = previousRecursionDepth + 1;
        try {
          const end = length === void 0 ? reader.len : reader.pos + length;
          const message = createBaseStreamProtectionStatus();
          while (reader.pos < end) {
            const tag = reader.uint32();
            switch (tag >>> 3) {
              case 1: {
                if (tag !== 8) {
                  break;
                }
                message.status = reader.int32();
                continue;
              }
              case 2: {
                if (tag !== 16) {
                  break;
                }
                message.maxRetries = reader.int32();
                continue;
              }
            }
            if ((tag & 7) === 4 || tag === 0) {
              break;
            }
            reader.skip(tag & 7);
          }
          return message;
        } finally {
          reader.__tsProtoDecodeDepth = previousRecursionDepth;
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/snackbar_message.js
var init_snackbar_message = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/snackbar_message.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/ump_part_id.js
var UMPPartId;
var init_ump_part_id = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/ump_part_id.js"() {
    UMPPartId = {
      UNKNOWN: 0,
      0: "UNKNOWN",
      ONESIE_HEADER: 10,
      10: "ONESIE_HEADER",
      ONESIE_DATA: 11,
      11: "ONESIE_DATA",
      ONESIE_ENCRYPTED_MEDIA: 12,
      12: "ONESIE_ENCRYPTED_MEDIA",
      MEDIA_HEADER: 20,
      20: "MEDIA_HEADER",
      MEDIA: 21,
      21: "MEDIA",
      MEDIA_END: 22,
      22: "MEDIA_END",
      CONFIG: 30,
      30: "CONFIG",
      LIVE_METADATA: 31,
      31: "LIVE_METADATA",
      HOSTNAME_CHANGE_HINT_DEPRECATED: 32,
      32: "HOSTNAME_CHANGE_HINT_DEPRECATED",
      LIVE_METADATA_PROMISE: 33,
      33: "LIVE_METADATA_PROMISE",
      LIVE_METADATA_PROMISE_CANCELLATION: 34,
      34: "LIVE_METADATA_PROMISE_CANCELLATION",
      NEXT_REQUEST_POLICY: 35,
      35: "NEXT_REQUEST_POLICY",
      USTREAMER_VIDEO_AND_FORMAT_METADATA: 36,
      36: "USTREAMER_VIDEO_AND_FORMAT_METADATA",
      FORMAT_SELECTION_CONFIG: 37,
      37: "FORMAT_SELECTION_CONFIG",
      USTREAMER_SELECTED_MEDIA_STREAM: 38,
      38: "USTREAMER_SELECTED_MEDIA_STREAM",
      FORMAT_INITIALIZATION_METADATA: 42,
      42: "FORMAT_INITIALIZATION_METADATA",
      SABR_REDIRECT: 43,
      43: "SABR_REDIRECT",
      SABR_ERROR: 44,
      44: "SABR_ERROR",
      SABR_SEEK: 45,
      45: "SABR_SEEK",
      RELOAD_PLAYER_RESPONSE: 46,
      46: "RELOAD_PLAYER_RESPONSE",
      PLAYBACK_START_POLICY: 47,
      47: "PLAYBACK_START_POLICY",
      ALLOWED_CACHED_FORMATS: 48,
      48: "ALLOWED_CACHED_FORMATS",
      START_BW_SAMPLING_HINT: 49,
      49: "START_BW_SAMPLING_HINT",
      PAUSE_BW_SAMPLING_HINT: 50,
      50: "PAUSE_BW_SAMPLING_HINT",
      SELECTABLE_FORMATS: 51,
      51: "SELECTABLE_FORMATS",
      REQUEST_IDENTIFIER: 52,
      52: "REQUEST_IDENTIFIER",
      REQUEST_CANCELLATION_POLICY: 53,
      53: "REQUEST_CANCELLATION_POLICY",
      ONESIE_PREFETCH_REJECTION: 54,
      54: "ONESIE_PREFETCH_REJECTION",
      TIMELINE_CONTEXT: 55,
      55: "TIMELINE_CONTEXT",
      REQUEST_PIPELINING: 56,
      56: "REQUEST_PIPELINING",
      SABR_CONTEXT_UPDATE: 57,
      57: "SABR_CONTEXT_UPDATE",
      STREAM_PROTECTION_STATUS: 58,
      58: "STREAM_PROTECTION_STATUS",
      SABR_CONTEXT_SENDING_POLICY: 59,
      59: "SABR_CONTEXT_SENDING_POLICY",
      LAWNMOWER_POLICY: 60,
      60: "LAWNMOWER_POLICY",
      SABR_ACK: 61,
      61: "SABR_ACK",
      END_OF_TRACK: 62,
      62: "END_OF_TRACK",
      CACHE_LOAD_POLICY: 63,
      63: "CACHE_LOAD_POLICY",
      LAWNMOWER_MESSAGING_POLICY: 64,
      64: "LAWNMOWER_MESSAGING_POLICY",
      PREWARM_CONNECTION: 65,
      65: "PREWARM_CONNECTION",
      PLAYBACK_DEBUG_INFO: 66,
      66: "PLAYBACK_DEBUG_INFO",
      SNACKBAR_MESSAGE: 67,
      67: "SNACKBAR_MESSAGE",
      NETWORK_TIMING: 68,
      68: "NETWORK_TIMING",
      CUEPOINT_LIST: 69,
      69: "CUEPOINT_LIST",
      STITCHED_REGIONS_OF_INTEREST: 70,
      70: "STITCHED_REGIONS_OF_INTEREST",
      STITCHED_SEGMENTS_METADATA_LIST: 71,
      71: "STITCHED_SEGMENTS_METADATA_LIST",
      PROBE_SUCCESS: 72,
      72: "PROBE_SUCCESS",
      UNRECOGNIZED: -1,
      "-1": "UNRECOGNIZED"
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/format_selection_config.js
var init_format_selection_config = __esm({
  "MediaDrop/node_modules/googlevideo/dist/protos/generated/video_streaming/format_selection_config.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/Protos.js
var init_Protos = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/Protos.js"() {
    init_format_initialization_metadata();
    init_media_header();
    init_buffered_range();
    init_cuepoint_list();
    init_cuepoint_info();
    init_cuepoint();
    init_media_capabilities();
    init_crypto_params();
    init_time_range();
    init_allowed_cached_formats();
    init_selectable_formats();
    init_prewarm_connection();
    init_playback_cookie();
    init_playback_start_policy();
    init_video_playback_abr_request();
    init_client_abr_state();
    init_next_request_policy();
    init_request_cancellation_policy();
    init_request_identifier();
    init_sabr_error();
    init_sabr_redirect();
    init_sabr_seek();
    init_onesie_request();
    init_onesie_header();
    init_onesie_header_type();
    init_onesie_innertube_request();
    init_onesie_innertube_response();
    init_onesie_proxy_status();
    init_innertube_request();
    init_streamer_context();
    init_sabr_context_update();
    init_sabr_context_sending_policy();
    init_sabr_live_metadata();
    init_ssap_playback_info();
    init_stream_protection_status();
    init_snackbar_message();
    init_ump_part_id();
    init_reload_player_response();
    init_format_selection_config();
    init_common();
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/formatUtils.js
function describeMissingFormat(type, formatOption, formats) {
  const available = filterFormatsByType(formats, type === "audio").map((f) => `${f.itag}[qualityLabel=${f.qualityLabel || f.audioQuality || ""}, mimeType=${f.mimeType || ""}, isVb=${f.isVb || false}, isDrc=${f.isDrc || false}]`).join(", ") || "none";
  if (typeof formatOption === "number")
    return `no ${type} format with itag ${formatOption} found (available ${type} formats: ${available})`;
  if (typeof formatOption === "function")
    return `no ${type} format matched the provided selector function (available ${type} formats: ${available})`;
  return `no ${type} format matched the given criteria (available ${type} formats: ${available})`;
}
function chooseFormat2(formats, formatOption, preferences) {
  if (!formats.length)
    return void 0;
  const typeFormats = filterFormatsByType(formats, preferences.isAudio);
  if (!typeFormats.length)
    return void 0;
  if (typeof formatOption === "number")
    return typeFormats.find((format) => format.itag === formatOption);
  if (formatOption && typeof formatOption !== "function")
    return formatOption;
  if (typeof formatOption === "function")
    return formatOption(typeFormats);
  let filteredFormats = typeFormats;
  const language = preferences.language;
  if (language && preferences.isAudio)
    filteredFormats = filteredFormats.filter((format) => format.language === language);
  const quality = preferences.quality;
  if (quality !== void 0)
    filteredFormats = filteredFormats.filter((format) => preferences.isAudio ? !!format.audioQuality?.toLowerCase().includes(quality?.toLowerCase() || "") : !!format.qualityLabel?.toLowerCase().includes(quality?.toLowerCase() || ""));
  const container = preferences.container;
  if (container !== void 0)
    filteredFormats = filteredFormats.filter((format) => format.mimeType?.includes(container));
  const voiceBoost = preferences.voiceBoost;
  if (voiceBoost !== void 0)
    filteredFormats = filteredFormats.filter((format) => format.isVb === voiceBoost);
  const dynamicRangeCompression = preferences.dynamicRangeCompression;
  if (dynamicRangeCompression !== void 0)
    filteredFormats = filteredFormats.filter((format) => format.isDrc === dynamicRangeCompression);
  const superResolution = preferences.superResolution;
  if (superResolution !== void 0)
    filteredFormats = filteredFormats.filter((format) => format.isSr === superResolution);
  const hdr = preferences.hdr;
  if (hdr !== void 0)
    filteredFormats = filteredFormats.filter((format) => format.isHdr === hdr);
  return filteredFormats.sort((a, b) => {
    const preferredCodec = preferences.isAudio ? preferences.preferredAudioCodec : preferences.preferredVideoCodec;
    const preferenceDifference = Number(matchesCodec(b, preferredCodec)) - Number(matchesCodec(a, preferredCodec));
    if (preferenceDifference)
      return preferenceDifference;
    return preferences.isAudio ? (b.bitrate || 0) - (a.bitrate || 0) : (b.height || 0) - (a.height || 0);
  })[0];
}
function matchesCodec(format, codec) {
  if (!codec)
    return false;
  const codecMimeTypePrefixes = {
    h264: ["avc1", "avc3"],
    vp9: ["vp9", "vp09"],
    av1: ["av01"],
    aac: ["mp4a"],
    opus: ["opus"]
  };
  return codecMimeTypePrefixes[codec].some((prefix) => format.mimeType?.includes(prefix));
}
function filterFormatsByType(formats, isAudio) {
  return formats.filter((format) => {
    if (!format.mimeType)
      return false;
    return isAudio ? format.mimeType.includes("audio") : format.mimeType.includes("video");
  });
}
function buildSabrFormat(formatStream) {
  const transferCharacteristics = formatStream.color_info?.transfer_characteristics || formatStream.colorInfo?.transferCharacteristics || "";
  const decodedXtags = formatStream.xtags ? FormatXTags.decode(base64ToU8(decodeURIComponent(formatStream.xtags))).xtags : [];
  const hasVideo = !!(formatStream.qualityLabel || formatStream.quality_label);
  const hasAudio = !!(formatStream.audioQuality || formatStream.audio_quality);
  const hasText = !!(formatStream.captionTrack || formatStream.caption_track);
  const isHdr = transferCharacteristics.includes("SMPTEST2084") || transferCharacteristics.includes("ARIB_STD_B67");
  const sabrFormat = {
    itag: formatStream.itag,
    lastModified: formatStream.last_modified_ms || formatStream.lastModified || "0",
    xtags: formatStream.xtags,
    width: formatStream.width,
    height: formatStream.height,
    fps: formatStream.fps,
    mimeType: formatStream.mime_type || formatStream.mimeType,
    audioQuality: formatStream.audio_quality || formatStream.audioQuality,
    numChannels: formatStream.audio_channels || formatStream.audioChannels,
    bitrate: formatStream.bitrate,
    averageBitrate: formatStream.average_bitrate || formatStream.averageBitrate,
    quality: formatStream.quality,
    qualityLabel: formatStream.quality_label || formatStream.qualityLabel,
    audioTrackId: formatStream.audio_track?.id || formatStream.audioTrack?.id,
    approxDurationMs: formatStream.approx_duration_ms || parseInt(formatStream.approxDurationMs || "0"),
    contentLength: parseInt(formatStream.contentLength || "0") || formatStream.content_length,
    // @NOTE: "target_duration_dec" is there because some older versions of YouTube.js had a typo.
    targetDurationSec: formatStream.targetDurationSec || formatStream.target_duration_sec || formatStream.target_duration_dec,
    hasAudio,
    hasVideo,
    hasText,
    isHdr,
    codecCode: CODEC_CODES[formatStream.itag]
  };
  if (hasVideo)
    sabrFormat.isSr = decodedXtags.some((tag) => tag.key === "sr" && tag.value === "1");
  if (hasAudio || hasText) {
    sabrFormat.language = formatStream.language ?? decodedXtags.find((tag) => tag.key === "lang")?.value;
    if (hasAudio) {
      sabrFormat.isDrc = !!formatStream.isDrc || !!formatStream.is_drc || decodedXtags.some((tag) => tag.key === "drc" && tag.value === "1");
      sabrFormat.isVb = !!formatStream.isVb || !!formatStream.is_vb || decodedXtags.some((tag) => tag.key === "vb" && tag.value === "1");
      const audioContent = decodedXtags.find((tag) => tag.key === "acont")?.value;
      sabrFormat.isDubbed = audioContent === "dubbed";
      sabrFormat.isDescriptive = audioContent === "descriptive";
      sabrFormat.isSecondary = audioContent === "secondary";
      sabrFormat.isAutoDubbed = audioContent === "dubbed-auto";
      sabrFormat.isOriginal = audioContent === "original" || !sabrFormat.isDubbed && !sabrFormat.isDescriptive && !sabrFormat.isSecondary && !sabrFormat.isAutoDubbed && !sabrFormat.isDrc;
    }
    if (hasText && !sabrFormat.language && (formatStream.captionTrack || formatStream.caption_track))
      sabrFormat.language = formatStream.caption_track?.language_code || formatStream.captionTrack?.languageCode;
  }
  return sabrFormat;
}
function createFormatKey(input) {
  if ("formatId" in input && (input.formatId?.itag !== void 0 || input.formatId?.xtags !== void 0))
    return `${input.formatId?.itag || ""}:${input.formatId?.xtags || ""}`;
  if (("itag" in input || "xtags" in input) && (input.itag !== void 0 || input.xtags !== void 0))
    return `${input.itag || ""}:${input.xtags || ""}`;
  throw new Error("Unsupported format type");
}
function createSegmentCacheKey(mediaHeader, format) {
  if (mediaHeader.isInitializationSegment && format)
    return `${mediaHeader.itag}:${mediaHeader.xtags || ""}:${format.contentLength || ""}:${format.mimeType || ""}`;
  return `${mediaHeader.segmentByteRangeStart || "0"}-${mediaHeader.itag}-${mediaHeader.xtags || ""}`;
}
function createSegmentCacheKeyFromMetadata(requestMetadata) {
  if (!requestMetadata.byteRange || !requestMetadata.format)
    throw new Error("Invalid metadata: byteRange or format is missing");
  const pseudoMediaHeader = {
    itag: requestMetadata.format.itag,
    xtags: requestMetadata.format.xtags || "",
    segmentByteRangeStart: requestMetadata.byteRange.start.toString(),
    isInitializationSegment: requestMetadata.isInit
  };
  return createSegmentCacheKey(pseudoMediaHeader, requestMetadata.isInit ? requestMetadata.format : void 0);
}
function getUniqueFormatId(format) {
  if (format.width)
    return format.itag.toString();
  const uidParts = [format.itag.toString()];
  if (format.audioTrackId)
    uidParts.push(format.audioTrackId);
  if (format.isDrc)
    uidParts.push("drc");
  return uidParts.join("-");
}
var MAX_INT32_VALUE, EnabledTrackTypes;
var init_formatUtils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/formatUtils.js"() {
    init_uint8arrayUtils();
    init_mediaCapabilityUtils();
    init_Protos();
    MAX_INT32_VALUE = "2147483647";
    EnabledTrackTypes = {
      VIDEO_AND_AUDIO: 0,
      0: "VIDEO_AND_AUDIO",
      AUDIO_ONLY: 1,
      1: "AUDIO_ONLY",
      VIDEO_ONLY: 2,
      2: "VIDEO_ONLY"
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/mediaTimeUtils.js
function ticksToMs(ticks, timescale, round) {
  return round(ticks / timescale * 1e3);
}
function getDurationMs(mediaHeader) {
  const durationMsFromHeader = Number(mediaHeader.durationMs ?? 0);
  if (Number.isFinite(durationMsFromHeader) && durationMsFromHeader > 0)
    return durationMsFromHeader;
  const durationTicks = Number(mediaHeader.timeRange?.durationTicks ?? 0);
  const timescale = Number(mediaHeader.timeRange?.timescale ?? 0);
  if (durationTicks > 0 && timescale > 0)
    return ticksToMs(durationTicks, timescale, Math.ceil);
  return 0;
}
function getStartMs(mediaHeader) {
  const startMsFromHeader = Number(mediaHeader.startMs ?? 0);
  if (Number.isFinite(startMsFromHeader) && startMsFromHeader > 0)
    return startMsFromHeader;
  const startTicks = Number(mediaHeader.timeRange?.startTicks ?? 0);
  const timescale = Number(mediaHeader.timeRange?.timescale ?? 0);
  if (startTicks > 0 && timescale > 0)
    return ticksToMs(startTicks, timescale, Math.floor);
  return 0;
}
var init_mediaTimeUtils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/mediaTimeUtils.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/EmsgSegmentMetadata.js
function makeBoxReader(data, offset) {
  const size = data.getUint32(offset);
  const type = data.getUint32(offset + 4);
  return { data, offset, size, type, cursor: 8 };
}
function readUint32Field(box) {
  const value = box.data.getUint32(box.offset + box.cursor);
  box.cursor += 4;
  return value;
}
function bytesToString(bytes) {
  if (!bytes.length)
    return "";
  if (textDecoder)
    return textDecoder.decode(bytes);
  let str2 = "";
  for (let i = 0; i < bytes.length; i++) {
    str2 += String.fromCharCode(bytes[i]);
  }
  return str2;
}
function readString(box, terminator) {
  let end;
  if (terminator === void 0) {
    end = box.size;
  } else {
    end = box.cursor;
    while (end < box.size && box.data.getUint8(box.offset + end) !== terminator) {
      end++;
    }
  }
  const bytes = new Uint8Array(box.data.buffer, box.data.byteOffset + box.offset + box.cursor, end - box.cursor);
  box.cursor = Math.min(end + 1, box.size);
  return bytesToString(bytes);
}
function looksLikeBox(data, offset) {
  if (data.byteLength - offset < 8)
    return false;
  const size = data.getUint32(offset);
  if (size < 8 || data.byteLength - offset < size)
    return false;
  for (let i = 4; i < 8; i++) {
    const byte = data.getUint8(offset + i);
    if (byte < 48 || byte > 122)
      return false;
  }
  return true;
}
function findBox(data, offset, targetType) {
  while (looksLikeBox(data, offset)) {
    const box = makeBoxReader(data, offset);
    if (box.type === targetType)
      return box;
    offset += box.size;
  }
  return null;
}
function parseEmsgBody(box) {
  box.cursor += 4;
  return {
    schemeIdUri: readString(box, 0),
    value: readString(box, 0),
    timescale: readUint32Field(box),
    presentationTimeDelta: readUint32Field(box),
    eventDuration: readUint32Field(box),
    id: readUint32Field(box),
    messageData: readString(box)
  };
}
function parseHeaderBlock(text2) {
  const lines = text2.split("\r\n");
  const headers = {};
  for (const line of lines) {
    if (line.length === 0)
      return headers;
    const match = line.match(/([^:]+):\s+([\S\s]+)/);
    if (match)
      headers[match[1]] = match[2];
  }
  return null;
}
function getNumber(headers, key) {
  return Number(headers[key]) || 0;
}
var EMSG_BOX_TYPE, textDecoder, EmsgSegmentMetadata;
var init_EmsgSegmentMetadata = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/EmsgSegmentMetadata.js"() {
    EMSG_BOX_TYPE = 1701671783;
    textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
    EmsgSegmentMetadata = class {
      data;
      uri;
      receivedAtMs = Date.now();
      segmentNumber;
      totalSegmentCount;
      segmentDurationsMs;
      ingestionTimeSec;
      ingestionUncertaintySec;
      safeFirstFrameTimeSec;
      targetDurationSec;
      cryptoPeriodIndex;
      cryptoPeriodSeconds;
      currentAbsoluteLoudnessLkfs;
      constructor(data, uri = "https://youtube.com") {
        this.data = data;
        this.uri = uri;
        this.segmentNumber = getNumber(this.data, "Sequence-Number");
        this.totalSegmentCount = getNumber(this.data, "Segment-Count");
        this.segmentDurationsMs = this.data["Segment-Durations-Ms"] || "";
        this.ingestionTimeSec = getNumber(this.data, "Ingestion-Walltime-Us") / 1e6;
        this.ingestionUncertaintySec = getNumber(this.data, "Ingestion-Uncertainty-Us") / 1e6;
        this.safeFirstFrameTimeSec = (getNumber(this.data, "First-Frame-Time-Us") + getNumber(this.data, "First-Frame-Uncertainty-Us")) / 1e6;
        this.targetDurationSec = getNumber(this.data, "Target-Duration-Us") / 1e6;
        this.cryptoPeriodIndex = getNumber(this.data, "Crypto-Period-Index");
        this.cryptoPeriodSeconds = getNumber(this.data, "Crypto-Period-Seconds");
        this.currentAbsoluteLoudnessLkfs = "Current-Absolute-Loudness-Lkfs" in this.data ? getNumber(this.data, "Current-Absolute-Loudness-Lkfs") : null;
      }
      get latencyMs() {
        const ingestionTimeMs = this.ingestionTimeSec * 1e3;
        const uncertaintyMs = this.ingestionUncertaintySec * 1e3;
        return Math.max(0, this.receivedAtMs - ingestionTimeMs + uncertaintyMs);
      }
      getStitchedCPNs() {
        return this.data["Stitched-Video-Cpn"] ? this.data["Stitched-Video-Cpn"].split(",").slice(0, -1) : [];
      }
      hasStitchedAdBreakMetadata() {
        return !!(this.data["Stitched-Video-Id"] || this.data["Stitched-Video-Cpn"] || this.data["Stitched-Video-Duration-Us"] || this.data["Stitched-Video-Start-Frame-Index"] || this.data["Stitched-Video-Absolute-Loudness-Lkfs"] || this.data["Serialized-State"] || this.data["Is-Ad-Break-Finished"]);
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/mediaSegmentUtils.js
function stripMp4Init(segment) {
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  let offset = 0;
  while (offset < segment.length - 8) {
    let size = view.getUint32(offset, false);
    const type = String.fromCharCode(segment[offset + 4], segment[offset + 5], segment[offset + 6], segment[offset + 7]);
    if (type === "moof" || type === "mdat")
      return segment.subarray(offset);
    if (size === 1) {
      if (offset + 16 > segment.length)
        break;
      size = Number(view.getBigUint64(offset + 8, false));
    } else if (size === 0)
      break;
    offset += size;
  }
  return segment;
}
function stripWebmInit(segment) {
  let offset = 0;
  while (offset < segment.length) {
    let firstByte = segment[offset];
    let idLength = 1;
    let mask = 128;
    while (idLength <= 4 && !(firstByte & mask)) {
      idLength++;
      mask >>= 1;
    }
    if (idLength > 4 || offset + idLength >= segment.length)
      break;
    let id = 0;
    for (let i = 0; i < idLength; i++)
      id = id * 256 + segment[offset + i];
    if (id === 524531317)
      return segment.subarray(offset);
    offset += idLength;
    firstByte = segment[offset];
    let sizeLength = 1;
    mask = 128;
    while (sizeLength <= 8 && !(firstByte & mask)) {
      sizeLength++;
      mask >>= 1;
    }
    if (sizeLength > 8 || offset + sizeLength > segment.length)
      break;
    let size = firstByte & ~mask;
    let isUnknown = firstByte === (mask | mask - 1);
    for (let i = 1; i < sizeLength; i++) {
      const b = segment[offset + i];
      size = size * 256 + b;
      if (b !== 255)
        isUnknown = false;
    }
    offset += sizeLength;
    if (id === 408125543)
      continue;
    if (isUnknown)
      break;
    offset += size;
  }
  return segment;
}
function parseEmsgSegmentMetadata(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const firstBox = findBox(view, 0, EMSG_BOX_TYPE);
  if (!firstBox)
    return;
  const firstBody = parseEmsgBody(firstBox);
  let headers = parseHeaderBlock(firstBody.messageData);
  const secondBox = findBox(view, firstBox.offset + firstBox.size, EMSG_BOX_TYPE);
  if (secondBox) {
    const secondBody = parseEmsgBody(secondBox);
    const secondHeaders = parseHeaderBlock(secondBody.messageData);
    if (headers && secondHeaders)
      headers = { ...headers, ...secondHeaders };
  }
  if (headers)
    return new EmsgSegmentMetadata(headers, firstBody.schemeIdUri);
}
var init_mediaSegmentUtils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/mediaSegmentUtils.js"() {
    init_EmsgSegmentMetadata();
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/SabrSegmentBuffer.js
var TAG, SabrSegmentBuffer;
var init_SabrSegmentBuffer = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/SabrSegmentBuffer.js"() {
    init_Logger();
    init_formatUtils();
    init_mediaTimeUtils();
    init_mediaSegmentUtils();
    init_uint8arrayUtils();
    TAG = "SabrSegmentBuffer";
    SabrSegmentBuffer = class {
      trackMetadata;
      isBroadcast;
      stripDuplicateInit;
      logger = Logger.getInstance();
      pendingSegments = /* @__PURE__ */ new Map();
      constructor(trackMetadata, isBroadcast = false, stripDuplicateInit = true) {
        this.trackMetadata = trackMetadata;
        this.isBroadcast = isBroadcast;
        this.stripDuplicateInit = stripDuplicateInit;
      }
      reset() {
        this.trackMetadata.initializedTracksMap.clear();
        this.pendingSegments.clear();
      }
      queueMediaHeader(mediaHeader) {
        const headerId = mediaHeader.headerId ?? 0;
        const formatKey = createFormatKey(mediaHeader);
        const track = this.trackMetadata.initializedTracksMap.get(formatKey);
        if (!track) {
          this.logger.warn(TAG, `No track found: formatKey=${formatKey}, headerId=${headerId}`);
          return;
        }
        const segmentNumber = mediaHeader.isInitializationSegment ? 0 : mediaHeader.segmentNum;
        if (track.trackedSegments.has(segmentNumber)) {
          this.logger.debug(TAG, `Ignoring recently downloaded segment: formatKey=${formatKey}, segmentNumber=${segmentNumber}`);
          return;
        }
        this.pendingSegments.set(headerId, {
          formatKey,
          segmentNumber,
          mediaHeader,
          startTimeMs: getStartMs(mediaHeader),
          durationMs: getDurationMs(mediaHeader),
          bufferedChunks: [],
          loadedLengthBytes: 0,
          type: track.type
        });
      }
      appendMediaData(headerId, buffer) {
        const pendingSegment = this.pendingSegments.get(headerId);
        if (!pendingSegment) {
          this.logger.debug(TAG, `Received MEDIA for unknown header id ${headerId}`);
          return;
        }
        pendingSegment.bufferedChunks.push(...buffer.chunks);
        pendingSegment.loadedLengthBytes += buffer.getLength();
      }
      finalizeSegment(headerId) {
        const pendingSegment = this.pendingSegments.get(headerId);
        if (!pendingSegment) {
          this.logger.debug(TAG, `Received MEDIA_END for unknown header id ${headerId}`);
          return false;
        }
        const track = this.trackMetadata.getInitializedTrack(pendingSegment.formatKey);
        if (!track) {
          this.pendingSegments.delete(headerId);
          return false;
        }
        const expectedLengthBytes = parseInt(pendingSegment.mediaHeader.segmentLengthBytes || "0");
        const loadedLengthBytes = pendingSegment.loadedLengthBytes;
        if (expectedLengthBytes > 0 && loadedLengthBytes !== expectedLengthBytes) {
          this.logger.warn(TAG, `Ignoring partial segment ${pendingSegment.segmentNumber} for ${pendingSegment.formatKey}.
expected=${expectedLengthBytes}, received=${loadedLengthBytes}`);
          this.pendingSegments.delete(headerId);
          return false;
        }
        let segment = concatenateChunks(pendingSegment.bufferedChunks);
        const emsgMetadata = parseEmsgSegmentMetadata(segment);
        if (this.isBroadcast && this.stripDuplicateInit && track.trackedSegments.size !== 0)
          segment = track.mimeType?.includes("webm") ? stripWebmInit(segment) : stripMp4Init(segment);
        if (track.streamLocked || track.streamDesiredSize > 0)
          track.streamController.enqueue(segment);
        track.recordCompletedSegment(pendingSegment, emsgMetadata);
        this.pendingSegments.delete(headerId);
        return !pendingSegment.mediaHeader.isInitializationSegment;
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/EventEmitterLike.js
var EventEmitterLike;
var init_EventEmitterLike = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/EventEmitterLike.js"() {
    EventEmitterLike = class {
      listeners = /* @__PURE__ */ new Map();
      onceWrappers = /* @__PURE__ */ new Map();
      emit(type, ...args) {
        const listeners = this.listeners.get(type);
        if (!listeners || listeners.size === 0)
          return;
        for (const listener of [...listeners])
          listener(...args);
      }
      on(type, listener) {
        let listeners = this.listeners.get(type);
        if (!listeners) {
          listeners = /* @__PURE__ */ new Set();
          this.listeners.set(type, listeners);
        }
        listeners.add(listener);
      }
      once(type, listener) {
        const wrapper = (...args) => {
          this.off(type, listener);
          listener(...args);
        };
        let wrappersByType = this.onceWrappers.get(listener);
        if (!wrappersByType) {
          wrappersByType = /* @__PURE__ */ new Map();
          this.onceWrappers.set(listener, wrappersByType);
        }
        wrappersByType.set(type, wrapper);
        this.on(type, wrapper);
      }
      off(type, listener) {
        const listeners = this.listeners.get(type);
        if (!listeners)
          return;
        let target2 = listener;
        const wrappersByType = this.onceWrappers.get(listener);
        if (wrappersByType) {
          const onceWrapper = wrappersByType.get(type);
          if (onceWrapper) {
            target2 = onceWrapper;
            wrappersByType.delete(type);
            if (wrappersByType.size === 0)
              this.onceWrappers.delete(listener);
          }
        }
        listeners.delete(target2);
        if (listeners.size === 0)
          this.listeners.delete(type);
      }
      removeAllListeners(type) {
        if (!type) {
          this.listeners.clear();
          this.onceWrappers.clear();
          return;
        }
        this.listeners.delete(type);
        for (const [listener, wrappersByType] of this.onceWrappers.entries()) {
          wrappersByType.delete(type);
          if (wrappersByType.size === 0)
            this.onceWrappers.delete(listener);
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/misc.js
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function assert(condition, msg) {
  if (!condition)
    throw new Error(msg);
}
function assertIsDefined(val, msg) {
  if (val === void 0 || val === null)
    throw new Error(msg ?? `Expected value to be defined, but got ${val}`);
}
function getMediaType(input) {
  return input.mimeType?.includes("audio") ? "audio" : "video";
}
var init_misc = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/misc.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/urlUtils.js
function parseRangeHeader(rangeHeaderValue) {
  if (!rangeHeaderValue)
    return void 0;
  const parts = rangeHeaderValue.split("=")[1]?.split("-");
  if (parts?.length) {
    const start = Number(parts[0]);
    const end = Number(parts[1]);
    return { start, end };
  }
  return void 0;
}
function getBroadcastId(url) {
  const idParam = url.searchParams.get("id");
  if (!idParam)
    return void 0;
  const parts = idParam.split(".");
  return parts.length === 2 ? parts[1] : void 0;
}
function getNextFallbackUrl(input) {
  const urlMod = input instanceof URL ? new URL(input.href) : new URL(input);
  const fvip = urlMod.searchParams.get("fvip");
  const mnRaw = urlMod.searchParams.get("mn");
  const fallbackCount = parseInt(urlMod.searchParams.get("fallback_count") ?? "0", 10);
  if (fvip && mnRaw) {
    const mn = mnRaw.split(",");
    const nextIndex = fallbackCount + 1;
    if (nextIndex < mn.length && mn[nextIndex]) {
      const nextNode = mn[nextIndex];
      const currentHost = urlMod.hostname;
      const suffix = currentHost.replace(/^[^.]*/, "");
      const prefix = currentHost.startsWith("rr") ? "rr" : "r";
      urlMod.hostname = `${prefix}${fvip}---${nextNode}${suffix}`;
      urlMod.searchParams.set("fallback_count", String(fallbackCount + 1));
      return urlMod;
    }
  }
  return void 0;
}
var init_urlUtils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/urlUtils.js"() {
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/Track.js
var MAX_TRACKED_SEGMENTS, Track;
var init_Track = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/Track.js"() {
    init_mediaTimeUtils();
    init_misc();
    MAX_TRACKED_SEGMENTS = 64;
    Track = class {
      type;
      formatId;
      mimeType;
      endSegmentNum;
      endTimeTicks;
      endTimescale;
      targetDurationSec;
      trackedSegments = /* @__PURE__ */ new Map();
      bufferedRangeSummary;
      emsgSegmentMetadata;
      _output;
      constructor(type) {
        this.type = type;
      }
      set output(value) {
        this._output = value;
      }
      get output() {
        return this._output;
      }
      get streamLocked() {
        return this.output.stream.locked;
      }
      get streamDesiredSize() {
        return this.output.controller.desiredSize ?? 0;
      }
      get streamController() {
        return this.output.controller;
      }
      get streamFull() {
        return this.streamLocked && this.streamDesiredSize <= 0;
      }
      get endTimeMs() {
        if (this.endTimeTicks === void 0 || this.endTimescale === void 0)
          return 0;
        return ticksToMs(this.endTimeTicks, this.endTimescale, Math.ceil);
      }
      get endOfStreamReached() {
        return this.endSegmentNum !== void 0 && this.endSegmentNum > 0 && this.trackedSegments.has(this.endSegmentNum);
      }
      get latencyMs() {
        if (!this.emsgSegmentMetadata)
          return void 0;
        return this.emsgSegmentMetadata.latencyMs;
      }
      update(state) {
        if ("formatId" in state)
          this.formatId = state.formatId;
        if ("mimeType" in state)
          this.mimeType = state.mimeType;
        if ("endSegmentNum" in state)
          this.endSegmentNum = state.endSegmentNum;
        if ("endTimeTicks" in state)
          this.endTimeTicks = state.endTimeTicks;
        if ("endTimescale" in state)
          this.endTimescale = state.endTimescale;
        if ("targetDurationSec" in state)
          this.targetDurationSec = state.targetDurationSec;
        if ("trackedSegments" in state)
          this.trackedSegments = new Map(state.trackedSegments);
        if ("bufferedRangeSummary" in state)
          this.bufferedRangeSummary = state.bufferedRangeSummary;
      }
      snapshot() {
        return {
          formatId: this.formatId,
          mimeType: this.mimeType,
          endSegmentNum: this.endSegmentNum,
          endTimeTicks: this.endTimeTicks,
          endTimescale: this.endTimescale,
          targetDurationSec: this.targetDurationSec,
          trackedSegments: Array.from(this.trackedSegments.entries()),
          bufferedRangeSummary: this.bufferedRangeSummary
        };
      }
      recordCompletedSegment(info, emsgMetadata) {
        let durationMs = info.durationMs;
        if (durationMs <= 0 && !info.mediaHeader.isInitializationSegment)
          durationMs = this.targetDurationSec ? this.targetDurationSec * 1e3 : void 0;
        if (emsgMetadata) {
          this.emsgSegmentMetadata = emsgMetadata;
          if (emsgMetadata.targetDurationSec > 0)
            durationMs = emsgMetadata.targetDurationSec * 1e3;
        }
        assertIsDefined(durationMs, `Track is missing durationMs: formatKey=${info.formatKey}, segmentNumber=${info.segmentNumber}`);
        const segmentNumber = info.segmentNumber;
        const mediaHeader = info.mediaHeader;
        const startTimeMs = info.startTimeMs;
        const endTimeMs = startTimeMs + durationMs;
        this.trackedSegments.set(segmentNumber, {
          segmentNumber,
          startTimeMs,
          endTimeMs,
          durationMs,
          mediaHeader
        });
        this.evictOldestTrackedSegments();
        this.refreshBufferedRanges();
      }
      refreshBufferedRanges() {
        let first;
        let last;
        for (const segment of this.trackedSegments.values()) {
          if (segment.mediaHeader.isInitializationSegment)
            continue;
          if (!first || segment.segmentNumber < first.segmentNumber)
            first = segment;
          if (!last || segment.segmentNumber > last.segmentNumber)
            last = segment;
        }
        if (!first || !last) {
          this.bufferedRangeSummary = void 0;
          return;
        }
        this.bufferedRangeSummary = {
          startTimeMs: first.startTimeMs,
          durationMs: Math.max(0, last.endTimeMs - first.startTimeMs),
          startSegmentIndex: first.segmentNumber,
          endSegmentIndex: last.segmentNumber
        };
      }
      evictOldestTrackedSegments() {
        while (this.trackedSegments.size > MAX_TRACKED_SEGMENTS) {
          const oldestKey = this.trackedSegments.keys().next().value;
          if (oldestKey === void 0)
            break;
          this.trackedSegments.delete(oldestKey);
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/TrackCollection.js
var TrackCollection;
var init_TrackCollection = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/TrackCollection.js"() {
    init_formatUtils();
    init_Track();
    TrackCollection = class {
      video = new Track("video");
      audio = new Track("audio");
      initializedTracksMap = /* @__PURE__ */ new Map();
      get needsDrain() {
        return this.video.streamFull || this.audio.streamFull;
      }
      get buffered() {
        let bufferedUntil = Infinity;
        for (const track of this.initializedTracks) {
          const summary2 = track.bufferedRangeSummary;
          if (!summary2)
            return 0;
          bufferedUntil = Math.min(bufferedUntil, summary2.startTimeMs + summary2.durationMs);
        }
        return bufferedUntil;
      }
      get bufferedRanges() {
        const ranges = [];
        for (const track of this.initializedTracks) {
          const summary2 = track.bufferedRangeSummary;
          if (!summary2)
            continue;
          ranges.push({
            formatId: track.formatId,
            startTimeMs: summary2.startTimeMs === 0 ? "" : String(summary2.startTimeMs),
            durationMs: String(summary2.durationMs),
            startSegmentIndex: summary2.startSegmentIndex,
            endSegmentIndex: summary2.endSegmentIndex,
            timeRange: {
              startTicks: String(summary2.startTimeMs),
              durationTicks: String(summary2.durationMs),
              timescale: 1e3
            }
          });
        }
        return ranges;
      }
      get initializedTracks() {
        return this.initializedTracksMap.values();
      }
      get initializationFormatIds() {
        const formatIds = [];
        if (this.video.formatId)
          formatIds.push(this.video.formatId);
        if (this.audio.formatId)
          formatIds.push(this.audio.formatId);
        return formatIds;
      }
      get livePlaybackLatencyMs() {
        const videoLatency = this.video.latencyMs;
        const audioLatency = this.audio.latencyMs;
        if (videoLatency === void 0 && audioLatency === void 0)
          return void 0;
        return Math.max(videoLatency ?? 0, audioLatency ?? 0);
      }
      initialize(type, metadata) {
        this[type].update(metadata);
        if ("formatId" in metadata && metadata.formatId !== void 0)
          this.initializedTracksMap.set(createFormatKey(metadata.formatId), this[type]);
      }
      getInitializedTrack(formatKey) {
        return this.initializedTracksMap.get(formatKey);
      }
      endOfStreamReached(enabledTrackTypes) {
        const videoEndOfStreamReached = this.video.endOfStreamReached;
        const audioEndOfStreamReached = this.audio.endOfStreamReached;
        return videoEndOfStreamReached && audioEndOfStreamReached || enabledTrackTypes === EnabledTrackTypes.VIDEO_ONLY && videoEndOfStreamReached || enabledTrackTypes === EnabledTrackTypes.AUDIO_ONLY && audioEndOfStreamReached;
      }
      snapshot() {
        const trackStates = [];
        for (const initializedTrack of this.initializedTracksMap.values())
          trackStates.push(initializedTrack.snapshot());
        return trackStates;
      }
      error(err) {
        const errorInstance = typeof err === "string" ? new Error(err) : err;
        this.video.streamController.error(errorInstance);
        this.audio.streamController.error(errorInstance);
      }
      close() {
        this.video.streamController.close();
        this.audio.streamController.close();
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/BandwidthEstimator.js
var BandwidthEstimator;
var init_BandwidthEstimator = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/BandwidthEstimator.js"() {
    BandwidthEstimator = class {
      halfLifeFastSec;
      halfLifeSlowSec;
      safetyFactor;
      maxSampleDurationSec;
      seedMinDurationSec;
      fast = 0;
      slow = 0;
      hasValue = false;
      pendingBytes = 0;
      pendingSec = 0;
      constructor(options = {}) {
        this.halfLifeFastSec = options.halfLifeFastSec ?? 1;
        this.halfLifeSlowSec = options.halfLifeSlowSec ?? 5;
        this.safetyFactor = options.safetyFactor ?? 0.9;
        this.maxSampleDurationSec = options.maxSampleDurationSec ?? 5;
        this.seedMinDurationSec = options.seedMinDurationSec ?? 0.1;
      }
      reset() {
        this.fast = this.slow = 0;
        this.hasValue = false;
        this.pendingBytes = this.pendingSec = 0;
      }
      /**
       * Bytes received, and the seconds the network made us wait for them.
       */
      add(bytes, seconds) {
        if (!(bytes > 0) || !(seconds > 0))
          return;
        if (seconds > this.maxSampleDurationSec)
          return;
        if (!this.hasValue) {
          this.pendingBytes += bytes;
          this.pendingSec += seconds;
          if (this.pendingSec >= this.seedMinDurationSec) {
            this.fast = this.slow = this.pendingBytes / this.pendingSec;
            this.hasValue = true;
            this.pendingBytes = this.pendingSec = 0;
          }
          return;
        }
        const rate = bytes / seconds;
        const aFast = 1 - Math.exp(-seconds / this.halfLifeFastSec);
        const aSlow = 1 - Math.exp(-seconds / this.halfLifeSlowSec);
        this.fast += aFast * (rate - this.fast);
        this.slow += aSlow * (rate - this.slow);
      }
      /**
       * Returns bytes/sec.
       * @NOTE: 0 until there's data...
       */
      get() {
        if (!this.hasValue)
          return 0;
        return Math.min(this.fast, this.slow) * this.safetyFactor;
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/core/SabrStream.js
var TAG2, MAX_STALLS, DEFAULT_MAX_RETRIES, DEFAULT_STALL_DETECTION_MS, REQUEST_TIMEOUT_MS, INITIAL_RETRY_BACKOFF_MS, MAX_RETRY_BACKOFF_MS, OFFLINE_GRACE_PERIOD_MS, DEFAULT_HEARTBEAT_INTERVAL_MS, LIVE_EDGE_SENTINEL_MS, DEFAULT_VIDEO_HWM, DEFAULT_AUDIO_HWM, SabrStream;
var init_SabrStream = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/core/SabrStream.js"() {
    init_UmpReader();
    init_Logger();
    init_SabrSegmentBuffer();
    init_EventEmitterLike();
    init_formatUtils();
    init_misc();
    init_Protos();
    init_mediaTimeUtils();
    init_uint8arrayUtils();
    init_urlUtils();
    init_mediaCapabilityUtils();
    init_TrackCollection();
    init_BandwidthEstimator();
    TAG2 = "SabrStream";
    MAX_STALLS = 3;
    DEFAULT_MAX_RETRIES = 10;
    DEFAULT_STALL_DETECTION_MS = 3e4;
    REQUEST_TIMEOUT_MS = 3e4;
    INITIAL_RETRY_BACKOFF_MS = 500;
    MAX_RETRY_BACKOFF_MS = 5e3;
    OFFLINE_GRACE_PERIOD_MS = 15e3;
    DEFAULT_HEARTBEAT_INTERVAL_MS = 1e4;
    LIVE_EDGE_SENTINEL_MS = Number.MAX_SAFE_INTEGER;
    DEFAULT_VIDEO_HWM = 1024 * 1024 * 16;
    DEFAULT_AUDIO_HWM = 1024 * 1024 * 3;
    SabrStream = class extends EventEmitterLike {
      logger = Logger.getInstance();
      formats = [];
      segmentBuffer;
      fetchFunction;
      abortController;
      requestTimeoutId;
      serverAbrStreamingUrl;
      videoPlaybackUstreamerConfig;
      clientInfo;
      proofOfOriginToken;
      heartbeatParams;
      nextRequestPolicy;
      ssapPlaybackInfos = /* @__PURE__ */ new Map();
      sabrContextUpdates = /* @__PURE__ */ new Map();
      activeSabrContextTypes = /* @__PURE__ */ new Set();
      trackCollection = new TrackCollection();
      bandwidth = new BandwidthEstimator();
      videoId;
      broadcastId;
      idleResolvers = [];
      drainResolver;
      shouldStop = false;
      isMintingPoToken = false;
      isBroadcast = false;
      runtime = {
        playerTimeMs: 0,
        requestNumber: 0,
        lastHeartbeatTimeMs: 0,
        playbackSessionStartMs: void 0,
        poTokenGenerationId: 0,
        spsRejectCount: 0
      };
      lifecycle = {
        aborted: false,
        errored: false,
        busy: false
      };
      health = {
        lastProgressTime: Date.now(),
        lastBufferedTimeMs: 0,
        stallCount: 0
      };
      callbacks;
      constructor(config) {
        super();
        this.fetchFunction = config.fetchFunction || fetch;
        this.videoId = config.videoId;
        this.formats = config.formats || [];
        this.clientInfo = config.clientInfo;
        this.videoPlaybackUstreamerConfig = config.videoPlaybackUstreamerConfig;
        this.proofOfOriginToken = config.poToken ? base64ToU8(config.poToken) : void 0;
        this.heartbeatParams = config.heartbeatParams || {};
        this.callbacks = config.callbacks || {};
        this.setStreamingURL(config.serverAbrStreamingUrl);
        this.isBroadcast = ["yt_premiere_broadcast", "yt_live_broadcast"].includes(this.streamingURL.searchParams.get("source") || "");
        this.broadcastId = this.isBroadcast ? getBroadcastId(this.streamingURL) : void 0;
        this.trackCollection.video.output = this.createTrackStream(config.videoHighWaterMark ?? DEFAULT_VIDEO_HWM);
        this.trackCollection.audio.output = this.createTrackStream(config.audioHighWaterMark ?? DEFAULT_AUDIO_HWM);
        this.segmentBuffer = new SabrSegmentBuffer(this.trackCollection, this.isBroadcast, config.stripDuplicateInit);
      }
      //#region Public API
      get isLive() {
        return this.isBroadcast;
      }
      get isBusy() {
        return this.lifecycle.busy;
      }
      get isAborted() {
        return this.lifecycle.aborted;
      }
      get isErrored() {
        return this.lifecycle.errored;
      }
      get videoEndTimeMs() {
        return this.trackCollection.video.endTimeMs;
      }
      get audioEndTimeMs() {
        return this.trackCollection.audio.endTimeMs;
      }
      get livePlaybackLatencyMs() {
        if (!this.isBroadcast)
          return;
        return this.trackCollection.livePlaybackLatencyMs;
      }
      get streamingURL() {
        assertIsDefined(this.serverAbrStreamingUrl, "Streaming URL is not set");
        return this.serverAbrStreamingUrl;
      }
      setStreamingURL(url) {
        this.serverAbrStreamingUrl = url instanceof URL ? url : new URL(url);
        this.validateStreamingUrl(this.serverAbrStreamingUrl);
      }
      setUstreamerConfig(config) {
        this.videoPlaybackUstreamerConfig = config;
      }
      async waitForIdle() {
        if (this.lifecycle.busy)
          await new Promise((resolve) => this.idleResolvers.push(resolve));
      }
      async snapshot() {
        await this.waitForIdle();
        return {
          playerTimeMs: this.runtime.playerTimeMs,
          tracks: this.trackCollection.snapshot()
        };
      }
      async abort(options = {}) {
        let snapshotData;
        if (options.snapshot)
          snapshotData = await this.snapshot();
        this.emit("abort");
        this.lifecycle.aborted = true;
        this.abortController?.abort();
        this.trackCollection.error("Stream aborted");
        this.drainResolver?.();
        this.drainResolver = void 0;
        return snapshotData;
      }
      start(options) {
        assert(this.runtime.playbackSessionStartMs === void 0, "This stream instance has already been started and cannot be reused");
        const { videoFormat, audioFormat } = this.selectFormats(options);
        this.setupStreaming(options, audioFormat, videoFormat).catch(() => {
        });
        return {
          videoStream: this.trackCollection.video.output.stream,
          audioStream: this.trackCollection.audio.output.stream,
          selectedFormats: { videoFormat, audioFormat }
        };
      }
      //#endregion
      //#region Internal
      createTrackStream(highWaterMark) {
        let controller;
        const stream = new ReadableStream({
          start: (c) => controller = c,
          pull: () => this.notifyDrain(),
          cancel: (reason) => {
            this.logger.debug(TAG2, `Stream cancelled by consumer. Reason: ${reason || "N/A"}`);
            this.abort().catch(() => {
            });
          }
        }, new ByteLengthQueuingStrategy({ highWaterMark }));
        return { stream, controller };
      }
      notifyDrain() {
        if (!this.trackCollection.needsDrain && this.drainResolver) {
          this.drainResolver();
          this.drainResolver = void 0;
        }
      }
      waitForDrain() {
        if (!this.trackCollection.needsDrain)
          return Promise.resolve();
        this.logger.debug(TAG2, "Waiting for drain");
        return new Promise((resolve) => this.drainResolver = resolve);
      }
      validateStreamingUrl(url) {
        const broadcastId = getBroadcastId(url);
        if (broadcastId)
          this.validateBroadcastId(broadcastId);
      }
      validateBroadcastId(bid) {
        if (this.isBroadcast && (!!this.broadcastId && this.broadcastId !== bid)) {
          this.logger.warn(TAG2, `Broadcast ID changed from ${this.broadcastId} to ${bid}. Stopping.`);
          this.shouldStop = true;
        }
      }
      selectFormats(options) {
        const audioOnly = options.enabledTrackTypes === EnabledTrackTypes.AUDIO_ONLY;
        const needsVideo = !audioOnly;
        const hasAudioSpecs = !!(options.audioFormat || options.audioPreferences);
        const hasVideoSpecs = !!(options.videoFormat || options.videoPreferences);
        if (audioOnly)
          assert(hasAudioSpecs, "Expected audio format or preferences to be provided");
        else
          assert(hasAudioSpecs && hasVideoSpecs, "Expected both video and audio format or preferences to be provided");
        const audioFormat = chooseFormat2(this.formats, options.audioFormat, {
          isAudio: true,
          ...options.audioPreferences
        });
        const videoFormat = needsVideo ? chooseFormat2(this.formats, options.videoFormat, {
          isAudio: false,
          ...options.videoPreferences
        }) : void 0;
        const missing = [];
        if (needsVideo && !videoFormat)
          missing.push(describeMissingFormat("video", options.videoFormat, this.formats));
        if (!audioFormat)
          missing.push(describeMissingFormat("audio", options.audioFormat, this.formats));
        if (missing.length > 0)
          throw new Error(`Could not select formats: ${missing.join("; ")}`);
        assertIsDefined(audioFormat, "Expected selected audio format");
        return { videoFormat, audioFormat };
      }
      async setupStreaming(options, audioFormat, videoFormat) {
        try {
          this.logger.debug(TAG2, `Starting SABR stream: videoFormat=${videoFormat?.itag ?? "n/a"}, audioFormat=${audioFormat.itag}, isBroadcast=${this.isBroadcast}, isPostLiveDvr=${options.isPostLiveDvr}`);
          this.tryMintPoToken();
          const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
          const enabledTrackTypesBitfield = options.enabledTrackTypes ?? EnabledTrackTypes.VIDEO_AND_AUDIO;
          if (options.snapshot && options.snapshot.tracks.length > 0) {
            const snapshot = options.snapshot;
            if (videoFormat)
              assert(snapshot.tracks.some((track) => createFormatKey(track) === createFormatKey(videoFormat)), "The selected video format does not match any format in the provided snapshot");
            assert(snapshot.tracks.some((track) => createFormatKey(track) === createFormatKey(audioFormat)), "The selected audio format does not match any format in the provided snapshot");
            for (const state of snapshot.tracks)
              this.trackCollection.initialize(getMediaType(state), state);
            this.seekTo(snapshot.playerTimeMs, "client");
          } else
            this.seekTo(options.startTimeMs ?? (this.isBroadcast && !options.isPostLiveDvr ? LIVE_EDGE_SENTINEL_MS : 0), "client");
          const abrState = {
            playerTimeMs: this.runtime.playerTimeMs.toString(),
            audioTrackId: audioFormat?.audioTrackId,
            clientViewportIsFlexible: false,
            drcEnabled: audioFormat?.isVb ? false : audioFormat?.isDrc ?? false,
            mediaCapabilities: buildMediaCapabilities(videoFormat, audioFormat),
            enableVoiceBoost: audioFormat?.isVb,
            stickyResolution: videoFormat?.height,
            elapsedWallTimeMs: "0",
            timeSinceLastActionMs: "0",
            timeSinceLastSeek: "0",
            visibility: 2,
            enableSabrHostFallback: true,
            supportsChangeType: false,
            enabledTrackTypesBitfield
          };
          this.runtime.playbackSessionStartMs = Date.now();
          while (!this.shouldStop) {
            if (this.lifecycle.aborted) {
              this.logger.debug(TAG2, "Stream aborted");
              break;
            }
            const elapsedTimeMs = this.getElapsedWallTimeMs().toString();
            abrState.timeSinceLastSeek = elapsedTimeMs;
            abrState.timeSinceLastActionMs = elapsedTimeMs;
            abrState.elapsedWallTimeMs = elapsedTimeMs;
            abrState.bandwidthEstimate = Math.round(this.bandwidth.get()).toString();
            this.logger.debug(TAG2, `Starting new segment fetch, playerTimeMs=${abrState.playerTimeMs}, bandwidthEstimate=${abrState.bandwidthEstimate ?? "n/a"}, elapsedWallTimeMs=${abrState.elapsedWallTimeMs}`);
            this.checkForStall(options.stallDetectionMs);
            const success = await this.executeWithRetry(() => this.fetchAndProcess(abrState, audioFormat, videoFormat), maxRetries);
            abrState.playerTimeMs = this.runtime.playerTimeMs.toString();
            if (this.trackCollection.endOfStreamReached(enabledTrackTypesBitfield))
              this.shouldStop = true;
            if (this.isBroadcast)
              this.heartbeat().then();
            if (!success)
              break;
          }
        } catch (error) {
          if (!this.lifecycle.aborted)
            this.errorHandler(error);
        } finally {
          if (!this.lifecycle.aborted && !this.lifecycle.errored) {
            this.trackCollection.close();
            this.emit("finish");
          }
          this.dispose();
        }
      }
      async heartbeat() {
        const heartbeatParams = this.heartbeatParams;
        const heartbeatCallback = this.callbacks.onCheckHeartbeat;
        if (!heartbeatCallback || !this.videoId)
          return;
        const intervalMs = heartbeatParams.intervalMilliseconds !== void 0 ? parseInt(heartbeatParams.intervalMilliseconds, 10) : DEFAULT_HEARTBEAT_INTERVAL_MS;
        const timeSinceLastHeartbeat = Date.now() - this.runtime.lastHeartbeatTimeMs;
        if (timeSinceLastHeartbeat < intervalMs)
          return;
        try {
          this.runtime.lastHeartbeatTimeMs = Date.now();
          const heartbeatBody = {
            heartbeatRequestParams: {
              heartbeatChecks: ["HEARTBEAT_CHECK_TYPE_LIVE_STREAM_STATUS"]
            },
            videoId: this.videoId
          };
          if ("heartbeatToken" in heartbeatParams)
            heartbeatBody.heartbeatToken = heartbeatParams.heartbeatToken;
          if ("heartbeatServerData" in heartbeatParams)
            heartbeatBody.heartbeatServerData = heartbeatParams.heartbeatServerData;
          const response = await heartbeatCallback(heartbeatBody);
          if (this.shouldStop)
            return;
          if ("heartbeatServerData" in response)
            this.heartbeatParams.heartbeatServerData = response.heartbeatServerData;
          if ("broadcastId" in response && response.broadcastId !== void 0)
            this.validateBroadcastId(response.broadcastId);
          if (response.status === "OK") {
            this.logger.debug(TAG2, "Live stream is online");
            return;
          }
          if (response.status === "LIVE_STREAM_OFFLINE") {
            if (response.offlineSlatePresent && !response.displayEndscreen) {
              this.logger.debug(TAG2, "Live stream is offline but not displaying end screen. Continuing.");
              return;
            }
            if (!(response.displayEndscreen || response.offlineSlateButtonsPresent))
              return;
            const elapsedTimeSinceLastProgress = Date.now() - this.health.lastProgressTime;
            if (elapsedTimeSinceLastProgress > OFFLINE_GRACE_PERIOD_MS) {
              this.logger.debug(TAG2, `Heartbeat check indicates live stream is offline and no activity for ${elapsedTimeSinceLastProgress}ms. Stopping stream.`);
              this.shouldStop = true;
              return;
            }
            this.logger.debug(TAG2, `Heartbeat check indicates live stream is offline, but progress was made ${elapsedTimeSinceLastProgress}ms ago. Continuing.`);
          }
        } catch (error) {
          this.logger.warn(TAG2, "Heartbeat check failed:", error.message);
        }
      }
      dispose() {
        this.sabrContextUpdates.clear();
        this.ssapPlaybackInfos.clear();
        this.activeSabrContextTypes.clear();
        this.segmentBuffer.reset();
        this.abortController = void 0;
        this.nextRequestPolicy = void 0;
        this.runtime.spsRejectCount = 0;
        this.runtime.playerTimeMs = 0;
        this.runtime.requestNumber = 0;
        this.bandwidth.reset();
        this.isMintingPoToken = false;
        this.recordActivity(0, true);
        this.clearRequestTimeout();
        this.setBusyState(false);
      }
      getElapsedWallTimeMs() {
        if (this.runtime.playbackSessionStartMs === void 0)
          return 0;
        return Date.now() - this.runtime.playbackSessionStartMs;
      }
      checkForStall(stallDetectionMs) {
        if (this.isBroadcast && this.runtime.playerTimeMs === LIVE_EDGE_SENTINEL_MS)
          return;
        const currentTime = Date.now();
        const stallThreshold = stallDetectionMs ?? DEFAULT_STALL_DETECTION_MS;
        if (currentTime - this.health.lastProgressTime > stallThreshold) {
          this.health.stallCount++;
          this.logger.warn(TAG2, `Stream stalled for ${stallThreshold}ms (stall #${this.health.stallCount})`);
          if (this.health.stallCount >= MAX_STALLS) {
            if (this.isBroadcast) {
              this.logger.warn(TAG2, "Live stream stalled. Assuming end of stream and stopping download");
              this.shouldStop = true;
            } else
              throw new Error(`Stream stalled ${MAX_STALLS} times. Aborting`);
          }
          this.health.lastProgressTime = currentTime;
        }
      }
      async executeWithRetry(fetchFn, maxRetries) {
        const backoffTimeMs = this.nextRequestPolicy?.backoffTimeMs || 0;
        if (backoffTimeMs > 0) {
          this.logger.debug(TAG2, `Backing off for ${backoffTimeMs}ms before next request`);
          await wait(backoffTimeMs);
        }
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          if (this.lifecycle.aborted) {
            this.logger.debug(TAG2, "Abort requested, preventing new requests");
            return false;
          }
          try {
            this.setBusyState(true);
            await fetchFn();
            this.setBusyState(false);
            return true;
          } catch (e) {
            this.setBusyState(false);
            const error = e;
            if (this.lifecycle.aborted) {
              this.logger.debug(TAG2, "Abort requested, not retrying fetch");
              return false;
            }
            if (attempt > maxRetries) {
              this.logger.warn(TAG2, `Retries exhausted while fetching segment: ${error.message}`);
              this.errorHandler(error);
              break;
            }
            const retryBackoffMs = Math.min(INITIAL_RETRY_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_RETRY_BACKOFF_MS);
            this.logger.warn(TAG2, `Segment fetch attempt ${attempt}/${maxRetries} failed - retrying in ${retryBackoffMs}ms`, error);
            await wait(retryBackoffMs);
          }
        }
        return false;
      }
      setBusyState(newState) {
        this.lifecycle.busy = newState;
        if (!newState) {
          this.idleResolvers.forEach((resolve) => resolve());
          this.idleResolvers = [];
        }
      }
      errorHandler(err) {
        this.lifecycle.errored = true;
        this.trackCollection.error(err);
        this.emit("error", err);
      }
      async fetchAndProcess(abrState, selectedAudioFormat, selectedVideoFormat) {
        const requestPoTokenGeneration = this.runtime.poTokenGenerationId;
        const requestBody = this.buildRequestBody(abrState, selectedAudioFormat, selectedVideoFormat);
        const response = await this.makeStreamingRequest(requestBody);
        const contentType = response.headers.get("content-type");
        if (response.status === 403 && this.hasExpired())
          await this.tryReloadStreamingData();
        assert(response.ok, `Server returned ${response.status} ${response.statusText}`);
        assert(contentType === "application/vnd.yt-ump", `Unexpected content type from server: ${contentType}`);
        assertIsDefined(response.body, "Response body is null");
        const reader = response.body.getReader();
        let serverSeek = false;
        const umpReader = new UmpReader({
          onPart: async (type, data) => {
            switch (type) {
              case UMPPartId.SABR_ERROR: {
                const sabrError = decodePart(data.chunks, SabrError);
                if (!sabrError)
                  break;
                throw new Error(`SABR Error: ${sabrError.type} - ${sabrError.code}`);
              }
              case UMPPartId.FORMAT_INITIALIZATION_METADATA: {
                const formatInitializationMetadata = decodePart(data.chunks, FormatInitializationMetadata);
                if (!formatInitializationMetadata)
                  break;
                if (this.videoId !== formatInitializationMetadata.videoId) {
                  this.logger.warn(TAG2, `Video ID mismatch: expected ${this.videoId}, got ${formatInitializationMetadata.videoId}. Ignoring format initialization metadata.`);
                  return;
                }
                if (!this.trackCollection.initializedTracksMap.has(createFormatKey(formatInitializationMetadata))) {
                  const formatType = getMediaType(formatInitializationMetadata);
                  const selectedFormat = formatType === "video" ? selectedVideoFormat : selectedAudioFormat;
                  this.trackCollection.initialize(formatType, {
                    formatId: formatInitializationMetadata.formatId,
                    mimeType: formatInitializationMetadata.mimeType,
                    endTimeTicks: parseInt(formatInitializationMetadata.endTimeTicks || "0"),
                    endTimescale: parseInt(formatInitializationMetadata.endTimeTimescale || "1000"),
                    endSegmentNum: parseInt(formatInitializationMetadata.endSegmentNum || "0"),
                    targetDurationSec: selectedFormat?.targetDurationSec
                    // @NOTE: Not a requirement. We always get it from the EMSG box anyway.
                  });
                  this.logger.debug(TAG2, `Initialized format: itag=${formatInitializationMetadata.formatId?.itag}, mimeType=${formatInitializationMetadata.mimeType}`);
                  this.emit("formatInitialization", this.trackCollection[formatType]);
                }
                break;
              }
              case UMPPartId.MEDIA_HEADER: {
                const mediaHeader = decodePart(data.chunks, MediaHeader);
                if (!mediaHeader)
                  break;
                if (this.videoId !== mediaHeader.videoId) {
                  this.logger.warn(TAG2, `Video ID mismatch: expected ${this.videoId}, got ${mediaHeader.videoId}. Ignoring media header.`);
                  break;
                }
                this.logger.debug(TAG2, `Received media header: headerId=${mediaHeader.headerId}, itag=${mediaHeader.itag}, segmentNum=${mediaHeader.segmentNum}, startMs=${mediaHeader.startMs}, durationMs=${mediaHeader.durationMs}, segmentLengthBytes=${mediaHeader.segmentLengthBytes}`);
                this.segmentBuffer.queueMediaHeader(mediaHeader);
                break;
              }
              case UMPPartId.MEDIA: {
                const headerId = data.getUint8(0);
                const dataBuffer = data.split(1).remainingBuffer;
                this.segmentBuffer.appendMediaData(headerId, dataBuffer);
                break;
              }
              case UMPPartId.MEDIA_END: {
                const headerId = data.getUint8(0);
                if (this.segmentBuffer.finalizeSegment(headerId)) {
                  this.recordActivity(this.trackCollection.buffered);
                  this.logger.debug(TAG2, `Finalized segment: headerId=${headerId}`);
                  this.emit("trackStateUpdate", this.trackCollection);
                }
                break;
              }
              case UMPPartId.LIVE_METADATA: {
                const sabrLiveMetadata = decodePart(data.chunks, SabrLiveMetadata);
                if (!sabrLiveMetadata)
                  break;
                const broadcastId = sabrLiveMetadata.broadcastId;
                if (broadcastId)
                  this.validateBroadcastId(broadcastId);
                this.emit("liveMetadataUpdate", sabrLiveMetadata);
                break;
              }
              case UMPPartId.SABR_SEEK: {
                const sabrSeek = decodePart(data.chunks, SabrSeek);
                if (!sabrSeek)
                  break;
                if (sabrSeek.seekSource === SeekSource.SABR_SEEK_TO_HEAD) {
                  const seekTimeMs = ticksToMs(parseInt(sabrSeek.seekMediaTime || "0"), sabrSeek.seekMediaTimescale || 1e3, Math.floor);
                  this.seekTo(seekTimeMs, "server");
                  this.recordActivity(seekTimeMs, true);
                  this.ssapPlaybackInfos.clear();
                  serverSeek = true;
                }
                break;
              }
              case UMPPartId.CUEPOINT_LIST: {
                const cuepointList = decodePart(data.chunks, CuepointList);
                if (!(cuepointList && "ssapInfos" in cuepointList))
                  break;
                for (const info of cuepointList.ssapInfos) {
                  const cuepoint = info.cuepoint;
                  const cuepointId = cuepoint?.identifier || "";
                  const timeRange = info.timeRange;
                  if (!cuepoint || !timeRange)
                    continue;
                  if (cuepoint.event === Cuepoint_CuepointEvent.STOP) {
                    this.ssapPlaybackInfos.delete(cuepointId);
                    this.logger.debug(TAG2, `Removed cuepoint: identifier=${cuepointId}`);
                  } else {
                    if (this.ssapPlaybackInfos.has(cuepointId))
                      continue;
                    const timescale = timeRange.timescale || 1e3;
                    const startTicks = parseInt(timeRange.startTicks || "0");
                    const startTimeMs = String(Math.floor(ticksToMs(startTicks, timescale, Math.floor) - (cuepoint.playheadTimeSec ?? 0) * 1e3));
                    const durationMs = String((cuepoint.totalDurationSec ?? 0) * 1e3);
                    this.ssapPlaybackInfos.set(cuepointId, {
                      adCpns: [],
                      cuepointId,
                      startTimeMs,
                      durationMs,
                      state: SsapPlaybackInfo_AdState.RATECONTROL_CLIENT
                    });
                    this.logger.debug(TAG2, `Added new cuepoint: cuepointId=${cuepointId}, startTimeMs=${startTimeMs}, durationMs=${durationMs}`);
                  }
                }
                break;
              }
              case UMPPartId.SABR_CONTEXT_UPDATE: {
                const contextUpdate = decodePart(data.chunks, SabrContextUpdate);
                if (!contextUpdate || contextUpdate.type === void 0 || !contextUpdate.value?.length)
                  break;
                if (contextUpdate.writePolicy === SabrContextUpdate_SabrContextWritePolicy.KEEP_EXISTING && this.sabrContextUpdates.has(contextUpdate.type))
                  break;
                this.sabrContextUpdates.set(contextUpdate.type, contextUpdate);
                if (contextUpdate.sendByDefault)
                  this.activeSabrContextTypes.add(contextUpdate.type);
                break;
              }
              case UMPPartId.SABR_CONTEXT_SENDING_POLICY: {
                const contextSendingPolicy = decodePart(data.chunks, SabrContextSendingPolicy);
                if (!contextSendingPolicy)
                  break;
                for (const startPolicy of contextSendingPolicy.startPolicy) {
                  if (!this.activeSabrContextTypes.has(startPolicy)) {
                    this.activeSabrContextTypes.add(startPolicy);
                    this.logger.debug(TAG2, `Activated SABR context: type=${startPolicy}`);
                  }
                }
                for (const stopPolicy of contextSendingPolicy.stopPolicy) {
                  if (this.activeSabrContextTypes.has(stopPolicy)) {
                    this.activeSabrContextTypes.delete(stopPolicy);
                    this.logger.debug(TAG2, `Deactivated SABR context: type=${stopPolicy}`);
                  }
                }
                for (const discardPolicy of contextSendingPolicy.discardPolicy) {
                  if (this.sabrContextUpdates.has(discardPolicy)) {
                    this.sabrContextUpdates.delete(discardPolicy);
                    this.logger.debug(TAG2, `Discarded SABR context: type=${discardPolicy}`);
                  }
                }
                break;
              }
              case UMPPartId.NEXT_REQUEST_POLICY: {
                this.nextRequestPolicy = decodePart(data.chunks, NextRequestPolicy);
                break;
              }
              case UMPPartId.STREAM_PROTECTION_STATUS: {
                const streamProtectionStatus = decodePart(data.chunks, StreamProtectionStatus);
                if (!streamProtectionStatus || !streamProtectionStatus.status)
                  break;
                this.emit("streamProtectionStatusUpdate", streamProtectionStatus);
                if (requestPoTokenGeneration !== this.runtime.poTokenGenerationId)
                  break;
                const isRejected = streamProtectionStatus.status === 3;
                const isPending = streamProtectionStatus.status === 2;
                const maxRetries = streamProtectionStatus.maxRetries || 5;
                const spsRejectCount = this.runtime.spsRejectCount;
                assert(spsRejectCount < maxRetries, `Stream protection attestation rejected after ${spsRejectCount} attempts`);
                if ((isRejected || isPending) && !this.isMintingPoToken) {
                  this.logger.warn(TAG2, isRejected ? `Stream protection attestation rejected: attempt ${spsRejectCount} of ${maxRetries}` : "Stream protection attestation pending");
                  if (isRejected)
                    this.runtime.spsRejectCount += 1;
                  this.tryMintPoToken();
                }
                break;
              }
              case UMPPartId.SABR_REDIRECT: {
                const sabrRedirect = decodePart(data.chunks, SabrRedirect);
                if (!sabrRedirect || !sabrRedirect.url)
                  break;
                this.setStreamingURL(sabrRedirect.url);
                this.logger.debug(TAG2, `Received SABR redirect: newUrl=${sabrRedirect.url}`);
                break;
              }
              case UMPPartId.RELOAD_PLAYER_RESPONSE: {
                const reloadPlaybackContext = decodePart(data.chunks, ReloadPlaybackContext);
                if (!reloadPlaybackContext)
                  break;
                this.logger.debug(TAG2, `Reload requested: reloadPlaybackParams=${reloadPlaybackContext.reloadPlaybackParams}`);
                await this.tryReloadStreamingData(reloadPlaybackContext);
                break;
              }
            }
          }
        });
        const abortController = this.abortController;
        let isFirstChunk = true;
        try {
          while (true) {
            await this.waitForDrain();
            if (abortController?.signal.aborted && !this.lifecycle.aborted)
              throw new Error("Request timed out");
            if (this.lifecycle.aborted)
              break;
            const readStart = performance.now();
            const { done, value } = await reader.read();
            const readSec = (performance.now() - readStart) / 1e3;
            if (done)
              break;
            if (value.length > 0) {
              if (!isFirstChunk)
                this.bandwidth.add(value.length, readSec);
              isFirstChunk = false;
              this.resetRequestTimeout();
              await umpReader.feed(value);
            }
          }
        } finally {
          this.clearRequestTimeout();
          reader.cancel().catch(() => {
          });
          reader.releaseLock();
          umpReader.dispose();
        }
        if (!serverSeek) {
          const buffered = this.trackCollection.buffered;
          if (buffered !== Infinity)
            this.seekTo(buffered, "client");
        }
      }
      tryMintPoToken() {
        const onMintPoToken = this.callbacks.onMintPoToken;
        if (onMintPoToken) {
          this.isMintingPoToken = true;
          (async () => {
            try {
              this.proofOfOriginToken = await onMintPoToken();
              this.runtime.poTokenGenerationId += 1;
            } catch (err) {
              this.logger.warn(TAG2, `An error occurred while minting proof of origin token: ${err?.message}`);
            } finally {
              this.isMintingPoToken = false;
            }
          })();
        }
      }
      buildRequestBody(abrState, selectedAudioFormat, selectedVideoFormat) {
        const ssapPlaybackInfos = Array.from(this.ssapPlaybackInfos.values());
        const videoPlaybackUstreamerConfig = base64ToU8(this.videoPlaybackUstreamerConfig);
        const bufferedRanges = this.trackCollection.bufferedRanges;
        const playbackCookie = this.nextRequestPolicy?.playbackCookie;
        const clientInfo = this.clientInfo;
        const poToken = this.proofOfOriginToken;
        const initializationFormatIds = !this.isBroadcast ? this.trackCollection.initializationFormatIds : [];
        const selectedAudioFormatIds = selectedAudioFormat ? [selectedAudioFormat] : [];
        const selectedVideoFormatIds = selectedVideoFormat ? [selectedVideoFormat] : [];
        const { sabrContexts, unsentSabrContexts } = this.prepareSabrContexts();
        return VideoPlaybackAbrRequest.encode({
          clientAbrState: abrState,
          bufferedRanges,
          ssapPlaybackInfos,
          initializationFormatIds,
          selectedAudioFormatIds,
          selectedVideoFormatIds,
          selectedCaptionFormatIds: [],
          videoPlaybackUstreamerConfig,
          streamerContext: {
            clientInfo,
            playbackCookie,
            unsentSabrContexts,
            sabrContexts,
            poToken
          },
          field1000: []
        }).finish();
      }
      prepareSabrContexts() {
        const sabrContexts = [];
        const unsentSabrContexts = [];
        for (const [type, ctxUpdate] of this.sabrContextUpdates.entries()) {
          if (this.activeSabrContextTypes.has(type))
            sabrContexts.push(ctxUpdate);
          else
            unsentSabrContexts.push(type);
        }
        return { sabrContexts, unsentSabrContexts };
      }
      async makeStreamingRequest(body) {
        this.streamingURL.searchParams.set("rn", this.runtime.requestNumber.toString());
        this.abortController = new AbortController();
        this.resetRequestTimeout();
        try {
          return await this.fetchFunction(this.streamingURL, {
            body,
            method: "POST",
            headers: {
              "content-type": "application/x-protobuf",
              "accept-encoding": "identity",
              "accept": "application/vnd.yt-ump"
            },
            signal: this.abortController.signal
          });
        } catch (error) {
          this.clearRequestTimeout();
          const nextFallbackUrl = getNextFallbackUrl(this.streamingURL);
          if (nextFallbackUrl) {
            this.logger.warn(TAG2, `Switching to fallback URL: ${nextFallbackUrl.hostname}`);
            this.setStreamingURL(nextFallbackUrl);
          }
          throw error;
        } finally {
          this.runtime.requestNumber += 1;
        }
      }
      hasExpired() {
        const expireRawValue = this.streamingURL.searchParams.get("expire");
        if (!expireRawValue)
          return false;
        const expireTimestampMs = parseInt(expireRawValue, 10) * 1e3;
        const msRemaining = expireTimestampMs - Date.now();
        return msRemaining <= 0;
      }
      async tryReloadStreamingData(reloadPlaybackContext) {
        const onReloadPlayerResponseCb = this.callbacks.onReloadPlayerResponse;
        if (onReloadPlayerResponseCb) {
          try {
            const response = await onReloadPlayerResponseCb(reloadPlaybackContext);
            this.setStreamingURL(response.serverAbrStreamingUrl);
            this.setUstreamerConfig(response.videoPlaybackUstreamerConfig);
            this.sabrContextUpdates.clear();
            this.activeSabrContextTypes.clear();
            this.ssapPlaybackInfos.clear();
          } catch (err) {
            throw new Error(`An error occurred while reloading streaming data: ${err?.message}`);
          }
        } else
          throw new Error("Streaming data reload requested but no handler was found");
      }
      resetRequestTimeout() {
        this.clearRequestTimeout();
        const abortController = this.abortController;
        this.requestTimeoutId = setTimeout(() => abortController?.abort(), REQUEST_TIMEOUT_MS);
      }
      clearRequestTimeout() {
        if (this.requestTimeoutId !== void 0) {
          clearTimeout(this.requestTimeoutId);
          this.requestTimeoutId = void 0;
        }
      }
      recordActivity(progressMs, reset = false) {
        if (!reset && (!Number.isFinite(progressMs) || progressMs <= this.health.lastBufferedTimeMs))
          return;
        this.health.lastProgressTime = Date.now();
        this.health.lastBufferedTimeMs = progressMs;
        this.health.stallCount = 0;
      }
      seekTo(timeMs, source) {
        this.logger.debug(TAG2, `Seeking: timeMs=${timeMs}, source=${source}`);
        this.runtime.playerTimeMs = Math.round(timeMs);
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/exports/sabr-stream.js
var sabr_stream_exports = {};
__export(sabr_stream_exports, {
  SabrStream: () => SabrStream
});
var init_sabr_stream = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/exports/sabr-stream.js"() {
    init_SabrStream();
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/CacheManager.js
var TAG3, CacheManager;
var init_CacheManager = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/CacheManager.js"() {
    init_Logger();
    TAG3 = "CacheManager";
    CacheManager = class {
      initSegmentCache = /* @__PURE__ */ new Map();
      segmentCache = /* @__PURE__ */ new Map();
      currentSize = 0;
      timerId;
      maxCacheSize;
      maxAge;
      logger = Logger.getInstance();
      constructor(maxSizeMB = 50, maxAgeSeconds = 600) {
        this.maxCacheSize = maxSizeMB * 1024 * 1024;
        this.maxAge = maxAgeSeconds * 1e3;
        this.startGarbageCollection();
      }
      getCacheEntries() {
        return {
          initSegmentCache: this.initSegmentCache,
          segmentCache: this.segmentCache
        };
      }
      setInitSegment(key, data) {
        const entry = {
          data,
          timestamp: Date.now(),
          size: data.byteLength
        };
        if (!this.initSegmentCache.has(key)) {
          this.currentSize += entry.size;
          this.enforceStorageLimit();
        }
        this.initSegmentCache.set(key, entry);
      }
      setSegment(key, data) {
        const entry = {
          data,
          timestamp: Date.now(),
          size: data.byteLength
        };
        this.currentSize += entry.size;
        this.enforceStorageLimit();
        this.segmentCache.set(key, entry);
      }
      getInitSegment(key) {
        const entry = this.initSegmentCache.get(key);
        if (entry && !this.isExpired(entry)) {
          this.logger.debug(TAG3, `Cache hit for init segment: ${key}`);
          entry.timestamp = Date.now();
          return entry.data;
        }
        if (entry) {
          this.initSegmentCache.delete(key);
          this.currentSize -= entry.size;
        }
        return void 0;
      }
      getSegment(key) {
        const entry = this.segmentCache.get(key);
        if (entry && !this.isExpired(entry)) {
          this.logger.debug(TAG3, `Cache hit for segment: ${key}`);
          const data = entry.data;
          this.segmentCache.delete(key);
          this.currentSize -= entry.size;
          return data;
        }
        if (entry) {
          this.segmentCache.delete(key);
          this.currentSize -= entry.size;
        }
        return void 0;
      }
      isExpired(entry) {
        return Date.now() - entry.timestamp > this.maxAge;
      }
      enforceStorageLimit() {
        if (this.currentSize <= this.maxCacheSize)
          return;
        this.clearExpiredEntries();
        if (this.currentSize > this.maxCacheSize) {
          this.removeOldestEntries();
        }
      }
      clearExpiredEntries() {
        const now = Date.now();
        for (const [key, entry] of this.segmentCache.entries()) {
          if (now - entry.timestamp > this.maxAge) {
            this.logger.debug(TAG3, `Removing expired segment from cache: ${key}`);
            this.segmentCache.delete(key);
            this.currentSize -= entry.size;
          }
        }
        for (const [key, entry] of this.initSegmentCache.entries()) {
          if (now - entry.timestamp > this.maxAge) {
            this.logger.debug(TAG3, `Removing expired init segment from cache: ${key}`);
            this.initSegmentCache.delete(key);
            this.currentSize -= entry.size;
          }
        }
      }
      removeOldestEntries() {
        const segments = Array.from(this.segmentCache.entries());
        const initSegments = Array.from(this.initSegmentCache.entries());
        const allEntries = [...segments, ...initSegments].sort((a, b) => a[1].timestamp - b[1].timestamp);
        while (this.currentSize > this.maxCacheSize && allEntries.length > 0) {
          const [key, entry] = allEntries.shift();
          this.segmentCache.delete(key);
          this.initSegmentCache.delete(key);
          this.currentSize -= entry.size;
        }
      }
      startGarbageCollection() {
        this.timerId = setInterval(() => {
          this.clearExpiredEntries();
        }, 6e4);
      }
      dispose() {
        this.initSegmentCache.clear();
        this.segmentCache.clear();
        this.currentSize = 0;
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = void 0;
        }
        this.logger.debug(TAG3, "Disposed");
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/RequestMetadataManager.js
var RequestMetadataManager;
var init_RequestMetadataManager = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/RequestMetadataManager.js"() {
    RequestMetadataManager = class {
      metadataMap;
      lastCleanup;
      CLEANUP_INTERVAL = 3e4;
      ENTRY_EXPIRATION_TIME = 1e3 * 60 * 3;
      constructor() {
        this.metadataMap = /* @__PURE__ */ new Map();
        this.lastCleanup = Date.now();
      }
      getRequestMetadata(url, del = false) {
        const requestNumber = new URL(url).searchParams.get("rn") || "";
        const streamingContext = this.metadataMap.get(requestNumber);
        if (streamingContext && Date.now() - streamingContext.timestamp > this.ENTRY_EXPIRATION_TIME) {
          this.metadataMap.delete(requestNumber);
          return void 0;
        }
        if (del) {
          this.metadataMap.delete(requestNumber);
        }
        this.conditionalCleanUp();
        return streamingContext;
      }
      setRequestMetadata(url, context) {
        const requestNumber = new URL(url).searchParams.get("rn");
        if (requestNumber) {
          this.metadataMap.set(requestNumber, context);
          this.conditionalCleanUp();
        }
      }
      conditionalCleanUp() {
        const now = Date.now();
        if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
          this.cleanUp();
          this.lastCleanup = now;
        }
      }
      cleanUp() {
        for (const [key, context] of this.metadataMap.entries()) {
          if (Date.now() - context.timestamp > this.ENTRY_EXPIRATION_TIME) {
            this.metadataMap.delete(key);
          }
        }
      }
    };
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/utils/index.js
var init_utils = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/utils/index.js"() {
    init_Logger();
    init_Track();
    init_TrackCollection();
    init_CacheManager();
    init_EventEmitterLike();
    init_RequestMetadataManager();
    init_BandwidthEstimator();
    init_formatUtils();
    init_mediaSegmentUtils();
    init_mediaTimeUtils();
    init_uint8arrayUtils();
    init_urlUtils();
    init_mediaCapabilityUtils();
  }
});

// MediaDrop/node_modules/googlevideo/dist/src/exports/utils.js
var utils_exports = {};
__export(utils_exports, {
  AUDIO_CODECS: () => AUDIO_CODECS,
  BandwidthEstimator: () => BandwidthEstimator,
  CODEC_CODES: () => CODEC_CODES,
  CacheManager: () => CacheManager,
  EnabledTrackTypes: () => EnabledTrackTypes,
  EventEmitterLike: () => EventEmitterLike,
  LogLevel: () => LogLevel,
  Logger: () => Logger,
  MAX_INT32_VALUE: () => MAX_INT32_VALUE,
  RequestMetadataManager: () => RequestMetadataManager,
  SPATIAL_AUDIO_CODECS: () => SPATIAL_AUDIO_CODECS,
  Track: () => Track,
  TrackCollection: () => TrackCollection,
  VIDEO_CODECS: () => VIDEO_CODECS,
  base64ToU8: () => base64ToU8,
  buildAudioCapability: () => buildAudioCapability,
  buildMediaCapabilities: () => buildMediaCapabilities,
  buildSabrFormat: () => buildSabrFormat,
  buildVideoCapability: () => buildVideoCapability,
  chooseFormat: () => chooseFormat2,
  concatenateChunks: () => concatenateChunks,
  createFormatKey: () => createFormatKey,
  createSegmentCacheKey: () => createSegmentCacheKey,
  createSegmentCacheKeyFromMetadata: () => createSegmentCacheKeyFromMetadata,
  decodePart: () => decodePart,
  describeMissingFormat: () => describeMissingFormat,
  getBroadcastId: () => getBroadcastId,
  getDurationMs: () => getDurationMs,
  getNextFallbackUrl: () => getNextFallbackUrl,
  getStartMs: () => getStartMs,
  getUniqueFormatId: () => getUniqueFormatId,
  parseEmsgSegmentMetadata: () => parseEmsgSegmentMetadata,
  parseRangeHeader: () => parseRangeHeader,
  stripMp4Init: () => stripMp4Init,
  stripWebmInit: () => stripWebmInit,
  surroundAudioCodes: () => surroundAudioCodes,
  ticksToMs: () => ticksToMs,
  u8ToBase64: () => u8ToBase64
});
var init_utils2 = __esm({
  "MediaDrop/node_modules/googlevideo/dist/src/exports/utils.js"() {
    init_utils();
  }
});

// MediaDrop/node_modules/@distube/ytdl-core/dist/auth.js
import { createHash } from "node:crypto";

// MediaDrop/node_modules/@distube/ytdl-core/dist/clients.js
var Client = {
  /** Apple Vision Pro app. Needs no player script. */
  VisionOS: "visionos",
  /** Embedded player on a third-party page. Accepts a cookie. */
  WebEmbedded: "web_embedded",
  /** Samsung Tizen TV app. Accepts a cookie. */
  Tv: "tv",
  /** Mobile website. Accepts a cookie; needs a PO token. */
  Mweb: "mweb",
  /** YouTube Studio. Needs a cookie and a PO token. */
  WebCreator: "web_creator",
  /** YouTube Music website. Needs a PO token; plays songs, not other videos. */
  WebMusic: "web_music"
};
var DEFAULT_CLIENTS = [
  Client.VisionOS,
  Client.WebEmbedded,
  Client.Tv,
  Client.Mweb,
  Client.WebCreator,
  Client.WebMusic
];
var YOUTUBE_ORIGIN = "https://www.youtube.com";
var CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
var SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15,gzip(gfe)";
var BROWSER = { "User-Agent": CHROME };
var base = {
  context: {},
  origin: YOUTUBE_ORIGIN,
  needsPlayer: true,
  poToken: false,
  account: "optional",
  embedded: false
};
function userAgentHeader(client) {
  const { userAgent } = typeof client === "string" ? CLIENTS[client] : client;
  return userAgent ? { "User-Agent": userAgent } : {};
}
var WEB_MUSIC = {
  ...base,
  name: "WEB_REMIX",
  nameId: 67,
  version: "1.20261025.12.00",
  userAgent: CHROME,
  origin: "https://music.youtube.com",
  poToken: true,
  account: "none"
};
var CLIENTS = {
  visionos: {
    ...base,
    name: "VISIONOS",
    nameId: 101,
    version: "1.02",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    context: { deviceMake: "Apple", deviceModel: "RealityDevice17,1", osName: "visionOS", osVersion: "26.5.23O471" },
    needsPlayer: false,
    account: "none"
  },
  web_embedded: {
    ...base,
    name: "WEB_EMBEDDED_PLAYER",
    nameId: 56,
    version: "2.20261027.01.00",
    userAgent: SAFARI,
    embedded: true
  },
  tv: {
    ...base,
    name: "TVHTML5",
    nameId: 7,
    version: "5.20260707",
    userAgent: "Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1",
    context: { deviceMake: "Samsung", deviceModel: "UKS9800", osName: "Tizen", osVersion: "2.4.0" }
  },
  mweb: {
    ...base,
    name: "MWEB",
    nameId: 2,
    version: "2.20261027.01.00",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1,gzip(gfe)",
    poToken: true
  },
  web_creator: {
    ...base,
    name: "WEB_CREATOR",
    nameId: 62,
    version: "1.20260708.06.00",
    userAgent: CHROME,
    poToken: true,
    account: "required"
  },
  web_music: WEB_MUSIC
};
var WEB = {
  ...base,
  name: "WEB",
  nameId: 1,
  version: "2.20261027.01.00",
  userAgent: CHROME
};

// MediaDrop/node_modules/@distube/ytdl-core/dist/errors.js
import { inspect } from "node:util";
var YtdlError = class _YtdlError extends Error {
  name = "YtdlError";
  code;
  attempts;
  startTime;
  availableCountries;
  constructor(code, message, details = {}) {
    super(redact(message), details.cause === void 0 ? void 0 : { cause: redactCause(details.cause) });
    this.code = code;
    this.attempts = Object.freeze((details.attempts ?? []).map(({ cause, ...attempt }) => ({
      ...attempt,
      reason: redact(attempt.reason),
      ...cause === void 0 ? {} : { cause: redactCause(cause) }
    })));
    this.startTime = details.startTime;
    this.availableCountries = details.availableCountries && Object.freeze([...details.availableCountries]);
  }
  static is(error, code) {
    return error instanceof _YtdlError && (code === void 0 || error.code === code);
  }
};
var SIGNED_PARAMS = /([?&](?:sig|signature|n|pot|lsig|s)=)[^&#\s"']*/giu;
var SIGNED_PATH_SEGMENTS = /(\/(?:sig|signature|n|pot|lsig|s)\/)(?!player\/)[^/?#\s"']*/giu;
var SECRETS = /* @__PURE__ */ new Set();
function registerSecret(secret) {
  if (secret.length >= 8)
    SECRETS.add(secret);
}
function redact(text2) {
  let out = text2.replace(SIGNED_PARAMS, "$1[redacted]").replace(SIGNED_PATH_SEGMENTS, "$1[redacted]");
  for (const secret of SECRETS)
    out = out.split(secret).join("[redacted]");
  return out;
}
function redactCause(cause) {
  if (typeof cause === "string")
    return redact(cause);
  if (cause instanceof YtdlError)
    return cause;
  const shown = inspect(cause, {
    depth: Infinity,
    showHidden: true,
    maxArrayLength: Infinity,
    maxStringLength: Infinity
  });
  if (redact(shown) === shown)
    return cause;
  if (!(cause instanceof Error))
    return new Error(redact(shown));
  const { code } = cause;
  return Object.assign(new Error(redact(cause.message)), { name: cause.name }, code === void 0 ? {} : { code });
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/http.js
var ignore = () => {
};
function abortable(promise, signal) {
  if (!signal)
    return promise;
  if (signal.aborted) {
    promise.catch(ignore);
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
var timeoutError = (ms) => new DOMException(`No response within ${ms} ms`, "TimeoutError");
function timed(fetchFn, ms) {
  return (async (input, init) => {
    const controller = new AbortController();
    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
    let timer = setTimeout(() => controller.abort(timeoutError(ms)), ms);
    let response;
    try {
      response = await fetchFn(input, { ...init, signal });
    } finally {
      clearTimeout(timer);
    }
    const source = response.body;
    if (!source)
      return response;
    const reader = source.getReader();
    const body = new ReadableStream({
      async pull(stream) {
        const stalled = new Promise((_, reject) => {
          timer = setTimeout(() => reject(timeoutError(ms)), ms);
        });
        try {
          const result = await Promise.race([abortable(reader.read(), signal), stalled]);
          if (result.done)
            stream.close();
          else
            stream.enqueue(result.value);
        } catch (error) {
          controller.abort(error);
          reader.cancel(error).catch(ignore);
          throw error;
        } finally {
          clearTimeout(timer);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      }
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  });
}
async function send(fetchFn, url, init, what) {
  try {
    return await fetchFn(url, init);
  } catch (cause) {
    init.signal?.throwIfAborted();
    throw new YtdlError("REQUEST_FAILED", `${what} request failed`, { cause });
  }
}
function statusError(status, what, detail = "") {
  const code = status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED";
  return new YtdlError(code, `${what} answered HTTP ${status}${detail ? ` (${detail})` : ""}`);
}
function expectOk(response, what) {
  if (response.ok)
    return response;
  response.body?.cancel().catch(ignore);
  throw statusError(response.status, what);
}
async function bodyText(response, signal, what) {
  try {
    return await response.text();
  } catch (cause) {
    signal?.throwIfAborted();
    throw new YtdlError("REQUEST_FAILED", `${what} response broke off`, { cause });
  }
}
async function fetchText(fetchFn, url, init, what) {
  return bodyText(expectOk(await send(fetchFn, url, init, what), what), init.signal, what);
}
var YOUTUBE_HOST = /(?:^|\.)youtube\.com$/u;
function consented(fetchFn) {
  return ((input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    if (!YOUTUBE_HOST.test(url.hostname) || headers.has("Cookie"))
      return fetchFn(input, init);
    headers.set("Cookie", "SOCS=CAI");
    return fetchFn(input, { ...init, headers });
  });
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/json.js
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function at(value, ...path) {
  let current = value;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current))
        return void 0;
      current = current[key];
    } else {
      if (!isRecord(current))
        return void 0;
      current = current[key];
    }
  }
  return current;
}
function num(value) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : void 0;
}
function str(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function text(value) {
  if (typeof value === "string")
    return value;
  const simple = at(value, "simpleText");
  if (typeof simple === "string")
    return simple;
  const content = at(value, "content");
  if (typeof content === "string")
    return content;
  const runs = at(value, "runs");
  if (Array.isArray(runs)) {
    const joined = runs.map((run) => str(at(run, "text")) ?? "").join("");
    return joined || void 0;
  }
  return void 0;
}
function list(value) {
  return Array.isArray(value) ? value : [];
}
function ytcfg(page) {
  const merged = {};
  for (const [, body] of page.matchAll(/ytcfg\.set\s*\(\s*(\{.+?\})\s*\)\s*;/gsu)) {
    try {
      const parsed = JSON.parse(body ?? "");
      if (isRecord(parsed))
        Object.assign(merged, parsed);
    } catch {
    }
  }
  return merged;
}
function collect(value, key, found = []) {
  if (Array.isArray(value)) {
    for (const item of value)
      collect(item, key, found);
  } else if (isRecord(value)) {
    for (const [name, child] of Object.entries(value)) {
      if (name === key && isRecord(child))
        found.push(child);
      else
        collect(child, key, found);
    }
  }
  return found;
}
function thumbnails(value) {
  if (!Array.isArray(value))
    return [];
  return value.flatMap((item) => {
    const url = str(at(item, "url"));
    return url ? [
      {
        url: url.startsWith("//") ? `https:${url}` : url,
        width: num(at(item, "width")),
        height: num(at(item, "height"))
      }
    ] : [];
  });
}
function parseAbbreviated(input) {
  const match = input?.replace(/,/gu, "").match(/([\d.]+)\s*([KMB])?/iu);
  if (!match?.[1])
    return void 0;
  const base2 = Number(match[1]);
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[(match[2] ?? "").toUpperCase()] ?? 1;
  return Number.isFinite(base2) ? Math.round(base2 * scale) : void 0;
}
function parseClock(input) {
  if (!input || !/^\d+(?::[0-5]\d){1,2}$/u.test(input.trim()))
    return void 0;
  return input.trim().split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/auth.js
function parseCookieHeader(header) {
  const cookies = /* @__PURE__ */ new Map();
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0)
      continue;
    cookies.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return cookies;
}
function netscapeToCookieHeader(text2) {
  const cookies = /* @__PURE__ */ new Map();
  for (const raw of text2.split(/\r?\n/u)) {
    const line = raw.startsWith("#HttpOnly_") ? raw.slice("#HttpOnly_".length) : raw;
    if (line.startsWith("#") || line.trim() === "")
      continue;
    const [domain, , , , , name, value] = line.split("	");
    if (domain === void 0 || !name || value === void 0)
      continue;
    const host = domain.replace(/^\./u, "");
    if (host !== "youtube.com" && !host.endsWith(".youtube.com"))
      continue;
    cookies.set(name, value);
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}
function sapisidOf(cookies) {
  return cookies.get("SAPISID") || cookies.get("__Secure-3PAPISID") || void 0;
}
var CookieAuth = class {
  #cookie;
  #sids;
  #fetch;
  #session;
  constructor(options) {
    const text2 = typeof options.cookie === "string" ? options.cookie.trim() : options.cookie;
    const header = typeof text2 === "string" && text2.includes("	") ? netscapeToCookieHeader(text2) : text2;
    if (typeof header !== "string" || !sapisidOf(parseCookieHeader(header))) {
      throw new YtdlError("INVALID_ARGUMENT", "The cookie has no SAPISID or __Secure-3PAPISID value; it is signed out");
    }
    const cookies = parseCookieHeader(header);
    registerSecret(header);
    for (const value of cookies.values())
      registerSecret(value);
    this.#cookie = header;
    this.#sids = [
      ["SAPISIDHASH", sapisidOf(cookies)],
      ["SAPISID1PHASH", cookies.get("__Secure-1PAPISID")],
      ["SAPISID3PHASH", cookies.get("__Secure-3PAPISID")]
    ];
    this.#fetch = options.fetch;
  }
  async headers(origin, signal) {
    const session = await abortable(this.#loadSession(), signal);
    const headers = {
      Cookie: this.#cookie,
      Authorization: this.#authorization(session.userSessionId, origin),
      "X-Origin": origin,
      "X-Goog-AuthUser": session.sessionIndex
    };
    if (session.delegatedSessionId)
      headers["X-Goog-PageId"] = session.delegatedSessionId;
    return headers;
  }
  async dataSyncId(signal) {
    return (await abortable(this.#loadSession(), signal)).dataSyncId;
  }
  #authorization(userSessionId, origin) {
    const timestamp = String(Math.round(Date.now() / 1e3));
    const prefix = userSessionId ? `${userSessionId} ` : "";
    const suffix = userSessionId ? "_u" : "";
    const authorizations = [];
    for (const [scheme, sid] of this.#sids) {
      if (!sid)
        continue;
      const hash = createHash("sha1").update(`${prefix}${timestamp} ${sid} ${origin}`).digest("hex");
      authorizations.push(`${scheme} ${timestamp}_${hash}${suffix}`);
    }
    return authorizations.join(" ");
  }
  #loadSession() {
    this.#session ??= this.#fetchSession().catch((error) => {
      this.#session = void 0;
      throw error;
    });
    return this.#session;
  }
  // The home page ytcfg carries `SESSION_INDEX` and `LOGGED_IN`, which an InnerTube `responseContext` lacks.
  async #fetchSession() {
    const page = await fetchText(this.#fetch, `${YOUTUBE_ORIGIN}/`, { headers: { Cookie: this.#cookie, ...BROWSER } }, "The signed-in YouTube home page");
    const config = ytcfg(page);
    if (config.LOGGED_IN === false) {
      throw new YtdlError("AUTH_FAILED", "YouTube treats the cookie as signed out; export a fresh one");
    }
    const field = (name) => str(config[name]) || void 0;
    const dataSyncId = field("DATASYNC_ID");
    if (dataSyncId)
      registerSecret(dataSyncId);
    const [first, second] = (dataSyncId ?? "").split("||");
    const delegatedSessionId = field("DELEGATED_SESSION_ID") ?? (second ? first : void 0);
    const userSessionId = field("USER_SESSION_ID") ?? (second || first || void 0);
    return {
      dataSyncId,
      userSessionId,
      delegatedSessionId,
      sessionIndex: String(config.SESSION_INDEX ?? "0")
    };
  }
};

// MediaDrop/node_modules/@distube/ytdl-core/dist/delivery/index.js
import { addAbortSignal, Readable } from "node:stream";

// MediaDrop/node_modules/@distube/ytdl-core/dist/delivery/session.js
import { setTimeout as sleep } from "node:timers/promises";
var MAX_RESUMES_WITHOUT_PROGRESS = 3;
var LIVE_IDLE_MS = 3e4;
async function waitUntil(time, signal) {
  signal.throwIfAborted();
  const delay = time - Date.now();
  if (delay > 0)
    await sleep(delay, void 0, { signal });
}
var Session = class {
  delivery;
  #playback;
  #options;
  #signal;
  #downloaded = 0;
  #attempt = 0;
  constructor(delivery, playback, options, signal) {
    this.delivery = delivery;
    this.#playback = playback;
    this.#options = options;
    this.#signal = signal;
  }
  get info() {
    return this.#playback.info;
  }
  get format() {
    return this.#playback.format;
  }
  get downloaded() {
    return this.#downloaded;
  }
  async ensureFresh() {
    await waitUntil(this.info.playableAt, this.#signal);
    if (Date.now() < this.info.expiresAt)
      return true;
    await this.resume("URL expired", new YtdlError("REQUEST_FAILED", `itag ${this.format.itag}: URL expired`));
    return false;
  }
  async request(url, { allowNotFound = false, allowBadRequest = false, allowServerError = false, retryLaterMs } = {}) {
    if (!await this.ensureFresh())
      return void 0;
    const { itag } = this.format;
    const what = `itag ${itag}: media`;
    const init = { headers: userAgentHeader(this.format.client), signal: this.#signal };
    let response;
    try {
      response = await send(this.delivery.fetch, url, init, what);
    } catch (error) {
      if (!YtdlError.is(error, "REQUEST_FAILED"))
        throw error;
      await this.resume("request failed", error);
      return void 0;
    }
    if (allowNotFound && response.status === 404 || allowBadRequest && response.status === 400 || allowServerError && response.status >= 500) {
      return response;
    }
    if (response.status === 403)
      await this.retry(response, 0);
    else if (retryLaterMs !== void 0 && (response.status === 429 || response.status >= 500)) {
      await this.retry(response, retryLaterMs);
    } else
      return expectOk(response, what);
    return void 0;
  }
  async retry(response, delayMs) {
    response.body?.cancel().catch(ignore);
    const { status } = response;
    await this.resume(`HTTP ${status}`, statusError(status, `itag ${this.format.itag}: media`));
    if (delayMs > 0)
      await sleep(delayMs, void 0, { signal: this.#signal });
  }
  /** Reads a whole body; one that breaks off or stalls resumes and gives `undefined`. */
  async read(response, parse) {
    try {
      return await parse(response);
    } catch (cause) {
      const what = `itag ${this.format.itag}: media response broke off`;
      await this.resume("response broke off", new YtdlError("REQUEST_FAILED", what, { cause }));
      return void 0;
    }
  }
  progress(bytes, total) {
    this.#attempt = 0;
    this.#downloaded += bytes;
    this.#options.onProgress?.({ chunkBytes: bytes, downloaded: this.#downloaded, total });
  }
  async resume(reason, cause) {
    this.#signal.throwIfAborted();
    const { itag, client } = this.format;
    const attempt = ++this.#attempt;
    if (attempt > MAX_RESUMES_WITHOUT_PROGRESS) {
      throw new YtdlError("REQUEST_FAILED", `itag ${itag}: gave up after ${MAX_RESUMES_WITHOUT_PROGRESS} resumes without progress`, {
        cause
      });
    }
    this.#options.onRetry?.({ attempt, client, reason });
    let next;
    try {
      next = await this.delivery.resume({ ...this.#playback, attempt, reason, signal: this.#signal });
    } catch (error) {
      this.#signal.throwIfAborted();
      if (YtdlError.is(error) && error.cause === void 0) {
        throw new YtdlError(error.code, error.message, {
          attempts: error.attempts,
          startTime: error.startTime,
          availableCountries: error.availableCountries,
          cause
        });
      }
      throw error;
    }
    this.#playback.info = next.info;
    this.#playback.format = next.format;
  }
};
async function* readBody(response, itag) {
  if (!response.body)
    return;
  const reader = response.body.getReader();
  try {
    for (; ; ) {
      const result = await reader.read().catch((error) => {
        throw new YtdlError("REQUEST_FAILED", `itag ${itag}: media response broke off`, { cause: error });
      });
      if (result.done)
        return;
      yield result.value;
    }
  } finally {
    reader.cancel().catch(ignore);
  }
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/delivery/dash.js
var DEFAULT_SEGMENT_MS = 5e3;
function headOf(response) {
  const sequence = Number(response.headers.get("x-head-seqnum"));
  const timeMs = Number(response.headers.get("x-head-time-millis"));
  if (!Number.isSafeInteger(sequence) || sequence < 1)
    return void 0;
  return { sequence, segmentMs: timeMs > 0 ? timeMs / sequence : DEFAULT_SEGMENT_MS };
}
async function* readDash(session, liveBuffer, signal) {
  const ended = !session.format.isLive;
  let next;
  let lastHead;
  let freshAt = Date.now();
  for (; ; ) {
    const polledAt = Date.now();
    const { url, itag } = session.format;
    if (url === void 0)
      throw new YtdlError("INVALID_STATE", `itag ${itag}: a live DASH format has no URL`);
    const segmentMs = lastHead?.segmentMs ?? DEFAULT_SEGMENT_MS;
    const response = await session.request(next === void 0 ? url : `${url}&sq=${next}`, {
      allowNotFound: true,
      allowServerError: true,
      retryLaterMs: segmentMs
    });
    if (!response)
      continue;
    const idle = response.status === 404 || response.status === 204;
    const head = headOf(response) ?? (idle ? lastHead : void 0);
    const expired = response.status === 500 && next !== void 0 && head !== void 0 && next < head.sequence;
    if (response.status >= 500 && !expired) {
      await session.retry(response, segmentMs);
      continue;
    }
    if (!head) {
      response.body?.cancel().catch(ignore);
      throw new YtdlError("REQUEST_FAILED", `itag ${itag}: the live answer names no head segment`);
    }
    if (head.sequence > (lastHead?.sequence ?? 0))
      lastHead = head;
    if (next === void 0) {
      response.body?.cancel().catch(ignore);
      const behind = ended ? Math.floor((session.format.maxDvrDurationSec ?? Infinity) * 1e3 / head.segmentMs) : Math.ceil(liveBuffer / head.segmentMs);
      next = Math.max(0, head.sequence - behind);
      continue;
    }
    if (expired && ended) {
      response.body?.cancel().catch(ignore);
      next++;
      continue;
    }
    if (idle || expired) {
      response.body?.cancel().catch(ignore);
      if (next < head.sequence) {
        next = head.sequence;
        continue;
      }
      if (Date.now() - freshAt >= LIVE_IDLE_MS)
        return;
      await waitUntil(polledAt + head.segmentMs, signal);
      continue;
    }
    const bytes = await session.read(response, (body) => body.bytes());
    if (!bytes)
      continue;
    if (bytes.length > 0) {
      session.progress(bytes.length, void 0);
      yield bytes;
    }
    next++;
    if (ended && next > head.sequence)
      return;
    freshAt = Date.now();
  }
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/delivery/hls.js
var DEFAULT_TARGET_DURATION = 5;
function parsePlaylist(text2, baseUrl) {
  const lines = text2.split(/\r?\n/u).map((line) => line.trim());
  if (lines[0] !== "#EXTM3U")
    throw new YtdlError("REQUEST_FAILED", "The live playlist is not an HLS playlist");
  let sequence = 0;
  let targetDuration = DEFAULT_TARGET_DURATION;
  let duration = 0;
  let ended = false;
  const segments = [];
  for (const line of lines) {
    if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:"))
      sequence = Number.parseInt(line.slice(22), 10);
    else if (line.startsWith("#EXT-X-TARGETDURATION:"))
      targetDuration = Number.parseFloat(line.slice(22));
    else if (line.startsWith("#EXTINF:"))
      duration = Number.parseFloat(line.slice(8));
    else if (line === "#EXT-X-ENDLIST")
      ended = true;
    else if (line !== "" && !line.startsWith("#")) {
      segments.push({ sequence: sequence++, duration, uri: new URL(line, baseUrl).href });
      duration = 0;
    }
  }
  return { targetDuration, segments, ended };
}
function startSequence(playlist, liveBuffer) {
  const { segments } = playlist;
  let start = (segments.at(-1)?.sequence ?? -1) + 1;
  if (playlist.ended)
    return segments[0]?.sequence ?? start;
  let buffered = 0;
  for (const segment of segments.toReversed()) {
    if (buffered >= liveBuffer / 1e3)
      break;
    buffered += segment.duration;
    start = segment.sequence;
  }
  return start;
}
async function* readLive(session, liveBuffer, signal) {
  let next;
  let freshAt = Date.now();
  let targetDuration = DEFAULT_TARGET_DURATION;
  poll: for (; ; ) {
    const polledAt = Date.now();
    const url = session.format.url ?? "";
    const response = await session.request(url, { retryLaterMs: targetDuration * 1e3 });
    if (!response)
      continue;
    const text2 = await session.read(response, (body) => body.text());
    if (text2 === void 0)
      continue;
    const playlist = parsePlaylist(text2, url);
    ({ targetDuration } = playlist);
    next ??= startSequence(playlist, liveBuffer);
    let fresh = false;
    for (const segment of playlist.segments) {
      if (segment.sequence < next)
        continue;
      const media = await session.request(segment.uri, { retryLaterMs: targetDuration * 1e3 });
      if (!media)
        continue poll;
      const bytes = await session.read(media, (body) => body.bytes());
      if (!bytes)
        continue poll;
      if (bytes.length > 0) {
        session.progress(bytes.length, void 0);
        yield bytes;
      }
      next = segment.sequence + 1;
      fresh = true;
      freshAt = Date.now();
    }
    if (playlist.ended || Date.now() - freshAt >= LIVE_IDLE_MS)
      return;
    await waitUntil(polledAt + (fresh ? 1e3 : 500) * targetDuration, signal);
  }
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/formats.js
import { inspect as inspect2 } from "node:util";
var Quality = {
  /** The top format when ranked by known size, then audio and video together, then resolution and bitrate. */
  Highest: "highest",
  /** The bottom format of the `Highest` ranking that has a known bitrate; the bottom one when none has. */
  Lowest: "lowest",
  /** The format with the best audio; among equals, the smallest video. */
  HighestAudio: "highestaudio",
  /** The format with the smallest audio and a known bitrate; the smallest when none has. */
  LowestAudio: "lowestaudio",
  /** The format with the best video; among equals, the smallest audio. */
  HighestVideo: "highestvideo",
  /** The format with the smallest video and a known bitrate; the smallest when none has. */
  LowestVideo: "lowestvideo"
};
var FIXED_AUDIO_KBPS = {
  18: 96,
  22: 192,
  91: 48,
  92: 48,
  93: 128,
  94: 128,
  95: 256,
  96: 256,
  233: 48,
  234: 128
};
function splitCodecs(mimeType) {
  const [type = "", params = ""] = mimeType.split(";");
  const container = type.split("/")[1]?.trim() ?? "";
  const codecs = /codecs="([^"]*)"/u.exec(params)?.[1] ?? "";
  return {
    container,
    codecs,
    list: codecs.split(",").map((codec) => codec.trim()).filter(Boolean)
  };
}
var AUDIO_CODEC = /^(?:mp4a|opus|vorbis|ac-3|ec-3|flac|mp3)/u;
var bool = (value) => typeof value === "boolean" ? value : void 0;
function range(value) {
  const start = num(at(value, "start"));
  const end = num(at(value, "end"));
  return start === void 0 || end === void 0 ? void 0 : { start, end };
}
function audioTrack(value) {
  if (!isRecord(value))
    return void 0;
  return {
    id: str(value.id) ?? "",
    displayName: str(value.displayName) ?? "",
    audioIsDefault: value.audioIsDefault === true
  };
}
function captionTrack(value) {
  if (!isRecord(value))
    return void 0;
  return defined({
    id: str(value.id) ?? "",
    displayName: str(value.displayName) ?? "",
    vssId: str(value.vssId) ?? "",
    languageCode: str(value.languageCode) ?? "",
    kind: str(value.kind)
  });
}
function colorInfo(value) {
  if (!isRecord(value))
    return void 0;
  return defined({
    primaries: str(value.primaries),
    transferCharacteristics: str(value.transferCharacteristics),
    matrixCoefficients: str(value.matrixCoefficients)
  });
}
function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : void 0;
}
function defined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== void 0));
}
function parseFormat(entry, client, isLive = false) {
  const itag = num(entry.itag);
  const mimeType = str(entry.mimeType);
  if (itag === void 0 || mimeType === void 0)
    return void 0;
  const { container, codecs, list: list2 } = splitCodecs(mimeType);
  const isVideoType = mimeType.startsWith("video/");
  const audioCodec = list2.find((codec) => AUDIO_CODEC.test(codec));
  const videoCodec = isVideoType ? list2.find((codec) => !AUDIO_CODEC.test(codec)) : void 0;
  const hasAudio = mimeType.startsWith("audio/") || audioCodec !== void 0;
  const bitrate = num(entry.averageBitrate) ?? num(entry.bitrate);
  const drmFamilies = strings(entry.drmFamilies);
  const type = str(entry.type);
  return {
    url: str(entry.url),
    signatureCipher: str(entry.signatureCipher),
    metadata: defined({
      itag,
      mimeType,
      container,
      codecs,
      videoCodec,
      audioCodec,
      audioBitrate: !hasAudio ? void 0 : isVideoType ? FIXED_AUDIO_KBPS[itag] : bitrate === void 0 ? void 0 : Math.round(bitrate / 1e3),
      isDrc: entry.isDrc === true,
      hasAudio,
      hasVideo: isVideoType,
      isLive,
      isHLS: false,
      isDrm: drmFamilies !== void 0 && drmFamilies.length > 0,
      isOtf: type === "FORMAT_STREAM_TYPE_OTF",
      client,
      bitrate: num(entry.bitrate),
      averageBitrate: num(entry.averageBitrate),
      width: num(entry.width),
      height: num(entry.height),
      fps: num(entry.fps),
      quality: str(entry.quality),
      qualityLabel: str(entry.qualityLabel),
      qualityOrdinal: str(entry.qualityOrdinal),
      audioQuality: str(entry.audioQuality),
      audioSampleRate: num(entry.audioSampleRate),
      audioChannels: num(entry.audioChannels),
      contentLength: num(entry.contentLength),
      approxDurationMs: num(entry.approxDurationMs),
      lastModified: num(entry.lastModified),
      initRange: range(entry.initRange),
      indexRange: range(entry.indexRange),
      targetDurationSec: num(entry.targetDurationSec),
      maxDvrDurationSec: num(entry.maxDvrDurationSec),
      audioTrack: audioTrack(entry.audioTrack),
      captionTrack: captionTrack(entry.captionTrack),
      loudnessDb: num(entry.loudnessDb),
      trackAbsoluteLoudnessLkfs: num(entry.trackAbsoluteLoudnessLkfs),
      isVb: bool(entry.isVb),
      appliedDrcTargetCenterForBackgroundDb: num(entry.appliedDrcTargetCenterForBackgroundDb),
      appliedVocalsGainFactor: num(entry.appliedVocalsGainFactor),
      vocalsBackgroundLoudnessDifferenceDb: num(entry.vocalsBackgroundLoudnessDifferenceDb),
      colorInfo: colorInfo(entry.colorInfo),
      projectionType: str(entry.projectionType),
      xtags: str(entry.xtags),
      highReplication: bool(entry.highReplication),
      drmFamilies,
      type
    })
  };
}
function sabrSession(player) {
  const url = str(at(player, "streamingData", "serverAbrStreamingUrl"));
  const config = str(at(player, "playerConfig", "mediaCommonConfig", "mediaUstreamerRequestConfig", "videoPlaybackUstreamerConfig"));
  const adaptive = at(player, "streamingData", "adaptiveFormats");
  if (!url || !config || !Array.isArray(adaptive))
    return void 0;
  return { url, config };
}
function parseFormats(player, client) {
  const streaming = at(player, "streamingData");
  const isLive = at(player, "videoDetails", "isLive") === true;
  const sabr = !isLive && sabrSession(player) !== void 0;
  const muxed = at(streaming, "formats");
  const adaptive = at(streaming, "adaptiveFormats");
  const entries = [
    ...Array.isArray(muxed) ? muxed.map((entry) => ({ entry, isAdaptive: false })) : [],
    ...Array.isArray(adaptive) ? adaptive.map((entry) => ({ entry, isAdaptive: true })) : []
  ];
  const out = [];
  for (const { entry, isAdaptive } of entries) {
    if (!isRecord(entry))
      continue;
    const parsed = parseFormat(entry, client, isLive);
    if (parsed && (parsed.url || parsed.signatureCipher || sabr && isAdaptive))
      out.push(parsed);
  }
  return out;
}
var VIDEO_ENCODINGS = ["mp4v", "avc1", "Sorenson H.283", "MPEG-4 Visual", "VP8", "VP9", "vp09", "av01", "H.264"];
var AUDIO_ENCODINGS = ["mp4a", "mp3", "vorbis", "aac", "opus", "flac"];
var qualityHeight = (format) => Number.parseInt(format.qualityLabel ?? "", 10) || 0;
var videoBitrate = (format) => format.hasVideo ? format.bitrate ?? 0 : 0;
var audioBitrate = (format) => format.audioBitrate ?? 0;
var videoEncoding = (format) => VIDEO_ENCODINGS.findIndex((encoding) => format.codecs.includes(encoding));
var audioEncoding = (format) => AUDIO_ENCODINGS.findIndex((encoding) => format.codecs.includes(encoding));
function compare(ranks) {
  return (a, b) => {
    for (const rank of ranks) {
      const difference = rank(b) - rank(a);
      if (difference !== 0)
        return difference;
    }
    return 0;
  };
}
var byVideo = compare([qualityHeight, videoBitrate, videoEncoding]);
var byAudio = compare([audioBitrate, audioEncoding]);
var sortFormats = compare([
  (format) => Number(format.contentLength !== void 0 && format.contentLength > 0),
  (format) => Number(format.hasVideo && format.hasAudio),
  (format) => Number(format.hasVideo),
  qualityHeight,
  videoBitrate,
  audioBitrate,
  videoEncoding,
  audioEncoding
]);
var CRITERIA = {
  hasAudio: "boolean",
  hasVideo: "boolean",
  audioCodec: "string",
  videoCodec: "string",
  container: "string",
  isDrc: "boolean",
  isLive: "boolean"
};
var isCriterion = (key) => Object.hasOwn(CRITERIA, key);
function fieldMatches(format, key, wanted) {
  const value = format[key];
  if (value === wanted)
    return true;
  return (key === "audioCodec" || key === "videoCodec") && typeof value === "string" && value.split(".")[0] === wanted;
}
function matcher(filter) {
  if (typeof filter === "function")
    return (format) => Boolean(filter(format));
  if (!isRecord(filter)) {
    throw new YtdlError("INVALID_ARGUMENT", `Unknown filter ${inspect2(filter)}; pass criteria such as { hasAudio: true, hasVideo: false } or a predicate`);
  }
  const criteria = filter;
  const fields = [];
  for (const [key, wanted] of Object.entries(criteria)) {
    if (wanted === void 0)
      continue;
    if (!isCriterion(key))
      throw new YtdlError("INVALID_ARGUMENT", `Unknown filter criterion ${JSON.stringify(key)}`);
    if (typeof wanted !== CRITERIA[key]) {
      throw new YtdlError("INVALID_ARGUMENT", `Filter criterion ${key} must be a ${CRITERIA[key]}`);
    }
    fields.push([key, wanted]);
  }
  return (format) => fields.every(([key, wanted]) => fieldMatches(format, key, wanted));
}
function matchers(filter) {
  if (filter === void 0)
    return [() => true];
  if (!Array.isArray(filter))
    return [matcher(filter)];
  if (filter.length === 0)
    throw new YtdlError("INVALID_ARGUMENT", "A filter list needs at least one entry");
  return filter.map(matcher);
}
function isPlayable(format) {
  return !format.isDrm && !format.isOtf;
}
function checkPlayable(format) {
  if (!isPlayable(format)) {
    throw new YtdlError("NO_FORMAT", `itag ${format.itag} is ${format.isDrm ? "DRM-protected" : "OTF"}`);
  }
}
function sameFormat(a, b) {
  return a.itag === b.itag && a.isDrc === b.isDrc && a.audioTrack?.id === b.audioTrack?.id;
}
function lengthDelimitedFields(bytes) {
  const fields = [];
  let offset = 0;
  const varint = () => {
    let value = 0;
    for (let shift = 0; ; shift += 7) {
      const byte = bytes[offset++] ?? 0;
      value += (byte & 127) * 2 ** shift;
      if ((byte & 128) === 0)
        return value;
    }
  };
  while (offset < bytes.length) {
    const tag = varint();
    if (tag % 8 === 0)
      varint();
    else if (tag % 8 === 2) {
      const length = varint();
      fields.push([Math.floor(tag / 8), bytes.subarray(offset, offset += length)]);
    } else
      break;
  }
  return fields;
}
function xtag(format, key) {
  if (!format.xtags)
    return void 0;
  const text2 = new TextDecoder();
  for (const [field, pair] of lengthDelimitedFields(Buffer.from(format.xtags, "base64url"))) {
    if (field !== 1)
      continue;
    const entry = new Map(lengthDelimitedFields(pair));
    if (text2.decode(entry.get(1)) === key)
      return text2.decode(entry.get(2));
  }
  return void 0;
}
function isDubbed(format) {
  const content = xtag(format, "acont");
  return content !== void 0 && content !== "original";
}
var PREFERENCE = [
  (format) => !format.isDrc && !isDubbed(format),
  (format) => !isDubbed(format),
  (format) => !format.isDrc,
  () => true
];
function chooseFormat(formats, options = {}) {
  const quality = options.quality ?? Quality.Highest;
  if (!isQuality(quality))
    throw new YtdlError("INVALID_ARGUMENT", `Unknown quality ${inspect2(quality)}`);
  const wanted = options.format;
  if (wanted) {
    const own = formats.find((format) => sameFormat(format, wanted));
    if (!own)
      throw new YtdlError("NO_FORMAT", `itag ${wanted.itag} is not one of the given formats`);
    checkPlayable(own);
    return own;
  }
  const playable = formats.filter(isPlayable);
  for (const matches of matchers(options.filter)) {
    const matching = playable.filter(matches);
    for (const preferred of PREFERENCE) {
      const chosen = pick(matching.filter(preferred), quality);
      if (chosen)
        return chosen;
    }
  }
  throw new YtdlError("NO_FORMAT", `No format matches quality ${JSON.stringify(quality)}`);
}
var QUALITIES = Object.values(Quality);
var isItag = (value) => typeof value === "number";
function isQuality(value) {
  return QUALITIES.includes(value) || isItag(value) || Array.isArray(value) && value.every(isItag);
}
function lowest(sorted, bitrate) {
  return sorted.findLast((format) => bitrate(format) !== void 0) ?? sorted.at(-1);
}
function pick(candidates, quality) {
  if (typeof quality === "number")
    return candidates.find((format) => format.itag === quality);
  if (Array.isArray(quality)) {
    for (const itag of quality) {
      const chosen = candidates.find((format) => format.itag === itag);
      if (chosen)
        return chosen;
    }
    return void 0;
  }
  if (quality === "highest" || quality === "lowest") {
    const sorted = candidates.toSorted(sortFormats);
    return quality === "highest" ? sorted[0] : lowest(sorted, (format) => format.hasVideo ? format.bitrate : format.audioBitrate);
  }
  if (quality === "highestaudio" || quality === "lowestaudio") {
    const sorted = candidates.filter((format) => format.hasAudio).toSorted(byAudio);
    if (quality === "lowestaudio")
      return lowest(sorted, (format) => format.audioBitrate);
    const best = sorted[0];
    return best && sorted.filter((format) => byAudio(best, format) === 0).toSorted((a, b) => qualityHeight(a) - qualityHeight(b))[0];
  }
  if (quality === "highestvideo" || quality === "lowestvideo") {
    const sorted = candidates.filter((format) => format.hasVideo).toSorted(byVideo);
    if (quality === "lowestvideo")
      return lowest(sorted, (format) => format.bitrate);
    const best = sorted[0];
    return best && sorted.filter((format) => byVideo(best, format) === 0).toSorted((a, b) => audioBitrate(a) - audioBitrate(b))[0];
  }
  return void 0;
}
function attributeList(text2) {
  return new Map(Array.from(text2.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/gu), ([, name = "", value = ""]) => [
    name,
    value.replace(/"/gu, "")
  ]));
}
function codecList(codecs) {
  return (codecs ?? "").split(",").map((codec) => codec.trim()).filter(Boolean);
}
function parseHlsMaster(playlist, base2, client) {
  const lines = playlist.split(/\r?\n/u);
  const entries = lines.flatMap((line, index) => {
    const tag = /^#EXT-X-(STREAM-INF|MEDIA):/u.exec(line);
    if (!tag)
      return [];
    const variant = tag[1] === "STREAM-INF";
    const attributes = attributeList(line.slice(tag[0].length));
    if (!variant && attributes.get("TYPE") !== "AUDIO")
      return [];
    const uri = variant ? lines.slice(index + 1).find((next) => next.trim() && !next.startsWith("#")) : attributes.get("URI");
    return uri ? [{ variant, url: new URL(uri.trim(), base2).href, attributes }] : [];
  });
  const separateAudio = new Set(entries.filter((entry) => !entry.variant).map((entry) => entry.attributes.get("GROUP-ID")));
  const variants = entries.filter((entry) => entry.variant);
  return entries.flatMap(({ variant, url, attributes }) => {
    const itag = num(/\/itag\/(\d+)\//u.exec(url)?.[1]);
    if (itag === void 0)
      return [];
    const group = attributes.get(variant ? "AUDIO" : "GROUP-ID");
    const usedBy = variant ? void 0 : variants.find((entry) => group && entry.attributes.get("AUDIO") === group);
    const list2 = variant ? codecList(attributes.get("CODECS")) : codecList(usedBy?.attributes.get("CODECS")).filter((codec) => AUDIO_CODEC.test(codec));
    const codecs = list2.join(",");
    const audioCodec = list2.find((codec) => AUDIO_CODEC.test(codec));
    const hasAudio = variant ? audioCodec !== void 0 && !(group && separateAudio.has(group)) : true;
    const [width, height] = (attributes.get("RESOLUTION") ?? "").split("x").map(Number);
    const hasVideo = width !== void 0 && height !== void 0 && Number.isFinite(height) && height > 0;
    return [
      {
        itag,
        url,
        mimeType: `${hasVideo ? "video" : "audio"}/ts; codecs="${codecs}"`,
        container: "ts",
        codecs,
        videoCodec: list2.find((codec) => !AUDIO_CODEC.test(codec)),
        audioCodec: hasAudio ? audioCodec : void 0,
        bitrate: num(attributes.get("BANDWIDTH")),
        audioBitrate: hasAudio ? FIXED_AUDIO_KBPS[itag] : void 0,
        ...hasVideo ? { width, height, qualityLabel: `${height}p` } : {},
        fps: num(attributes.get("FRAME-RATE")),
        isDrc: false,
        isDrm: false,
        isOtf: false,
        hasAudio,
        hasVideo,
        isLive: true,
        isHLS: true,
        client
      }
    ];
  });
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/delivery/sabr.js
var SABR_REQUEST_RETRIES = 2;
function tracks(info, client, build) {
  return list(at(info.playerResponse, "streamingData", "adaptiveFormats")).filter(isRecord).flatMap((entry) => {
    const metadata = parseFormat(entry, client)?.metadata;
    if (!metadata)
      return [];
    const built = build(entry);
    return [{ metadata, sabr: { ...built, isDrc: metadata.isDrc, audioTrackId: metadata.audioTrack?.id } }];
  });
}
function cheapestAudio(available) {
  return available.filter(({ metadata }) => metadata.hasAudio && !metadata.hasVideo && !metadata.isDrc).toSorted((a, b) => (a.metadata.bitrate ?? 0) - (b.metadata.bitrate ?? 0))[0];
}
async function drain(stream) {
  const reader = stream.getReader();
  for (; ; )
    if ((await reader.read()).done)
      return;
}
function lastBoundaryAtOrBefore(timeAtByte, position) {
  let found;
  for (const [byte, timeMs] of timeAtByte) {
    if (byte <= position && byte > (found?.byte ?? -1))
      found = { byte, timeMs };
  }
  return found;
}
function tokenBytes(token) {
  return Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));
}
async function* readSabr(session, start, last, total, startTimeMs, signal) {
  const [{ SabrStream: SabrStream2 }, { buildSabrFormat: buildSabrFormat2, EnabledTrackTypes: EnabledTrackTypes2 }] = await Promise.all([
    Promise.resolve().then(() => (init_sabr_stream(), sabr_stream_exports)),
    Promise.resolve().then(() => (init_utils2(), utils_exports))
  ]);
  let position = start;
  const timeAtByte = /* @__PURE__ */ new Map();
  let initSent = false;
  let lastSentStartMs;
  const switched = (cause) => {
    if (startTimeMs === void 0)
      return;
    const { itag } = session.format;
    throw new YtdlError("NO_FORMAT", `itag ${itag}: the resumed format has a URL and cannot start at a time`, {
      cause
    });
  };
  for (; ; ) {
    if (!await session.ensureFresh()) {
      if (session.format.url !== void 0) {
        return switched(new YtdlError("REQUEST_FAILED", `itag ${session.format.itag}: URL expired`));
      }
      continue;
    }
    const { info, format, delivery } = session;
    const source = info.sabr;
    if (!source)
      throw new YtdlError("NO_FORMAT", `itag ${format.itag}: the info has no SABR session`);
    const available = tracks(info, format.client, buildSabrFormat2);
    const wanted = available.find((track) => sameFormat(track.metadata, format))?.sabr;
    const audio = format.hasVideo ? cheapestAudio(available)?.sabr : wanted;
    if (!wanted || !audio)
      throw new YtdlError("NO_FORMAT", `itag ${format.itag}: missing from the SABR session`);
    const client = CLIENTS[format.client];
    let mintFailure;
    let lastStatus;
    const stream = new SabrStream2({
      videoId: info.videoDetails.id,
      fetchFunction: (async (url, init) => {
        const headers = new Headers(init?.headers);
        for (const [name, value] of Object.entries(userAgentHeader(format.client)))
          headers.set(name, value);
        lastStatus = void 0;
        const response = await delivery.fetch(url, { ...init, headers });
        lastStatus = response.status;
        return response;
      }),
      serverAbrStreamingUrl: source.url,
      videoPlaybackUstreamerConfig: source.config,
      clientInfo: { clientName: client.nameId, clientVersion: client.version },
      formats: available.map((track) => track.sabr),
      callbacks: {
        // googlevideo logs a failed mint and carries on without a token.
        onMintPoToken: () => delivery.mintPoToken(info, signal).then((token) => {
          mintFailure = void 0;
          return tokenBytes(token);
        }, (error) => {
          mintFailure = error;
          throw error;
        })
      }
    });
    let wantedTrack;
    const unread = [];
    const queued = /* @__PURE__ */ new WeakSet();
    const queueRecorded = () => {
      for (const segment of wantedTrack?.trackedSegments.values() ?? []) {
        if (queued.has(segment))
          continue;
        queued.add(segment);
        unread.push(segment);
      }
    };
    stream.on("formatInitialization", (track) => {
      if (track.type === (format.hasVideo ? "video" : "audio"))
        wantedTrack = track;
    });
    stream.on("trackStateUpdate", queueRecorded);
    const sessionStartMs = startTimeMs === void 0 ? lastBoundaryAtOrBefore(timeAtByte, position)?.timeMs : lastSentStartMs ?? startTimeMs;
    const { audioStream, videoStream } = stream.start({
      audioFormat: audio,
      videoFormat: format.hasVideo ? wanted : void 0,
      enabledTrackTypes: format.hasVideo ? EnabledTrackTypes2.VIDEO_AND_AUDIO : EnabledTrackTypes2.AUDIO_ONLY,
      isPostLiveDvr: false,
      maxRetries: SABR_REQUEST_RETRIES,
      startTimeMs: sessionStartMs
    });
    const abort = () => void stream.abort().catch(ignore);
    signal.addEventListener("abort", abort, { once: true });
    if (format.hasVideo)
      drain(audioStream).catch(ignore);
    const reader = (format.hasVideo ? videoStream : audioStream).getReader();
    let offset = 0;
    let failure2;
    try {
      for (; ; ) {
        const read = await reader.read().catch((error) => {
          signal.throwIfAborted();
          failure2 = error;
          return void 0;
        });
        if (!read)
          break;
        const { done, value } = read;
        if (done) {
          if (last === Infinity)
            return;
          failure2 = new Error(`session ended at byte ${offset}`);
          break;
        }
        const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        queueRecorded();
        const segment = unread.shift();
        if (startTimeMs !== void 0) {
          if (!segment) {
            failure2 = new Error("a media chunk arrived without its segment header");
            break;
          }
          if (segment.mediaHeader.isInitializationSegment) {
            if (initSent)
              continue;
            initSent = true;
          } else {
            if (segment.endTimeMs <= startTimeMs || segment.startTimeMs <= (lastSentStartMs ?? -1))
              continue;
            lastSentStartMs = segment.startTimeMs;
          }
          position += chunk.length;
          session.progress(chunk.length, total);
          yield chunk;
          continue;
        }
        if (!segment?.mediaHeader.isInitializationSegment) {
          const byteStart = Number(segment?.mediaHeader.segmentByteRangeStart);
          if (byteStart > position) {
            failure2 = new Error(`segment at byte ${byteStart} skips byte ${position}`);
            break;
          }
          if (segment && byteStart > 0) {
            offset = byteStart;
            timeAtByte.set(byteStart, segment.startTimeMs);
          } else if ((sessionStartMs ?? 0) > 0) {
            failure2 = new Error(`a session started at ${sessionStartMs} ms sent media without a byte offset`);
            timeAtByte.clear();
            break;
          }
        }
        const from = Math.max(position - offset, 0);
        const to = Math.min(chunk.length, last - offset + 1);
        offset += chunk.length;
        if (to > from) {
          position += to - from;
          session.progress(to - from, total);
          yield chunk.subarray(from, to);
        }
        if (position > last)
          return;
      }
    } finally {
      signal.removeEventListener("abort", abort);
      abort();
      reader.cancel().catch(ignore);
    }
    if (mintFailure !== void 0) {
      throw new YtdlError("REQUEST_FAILED", `itag ${format.itag}: PO token minting failed`, { cause: mintFailure });
    }
    const reason = redact(failure2 instanceof Error ? failure2.message : String(failure2));
    const failed = new YtdlError("REQUEST_FAILED", `itag ${format.itag}: SABR session failed: ${reason}`, {
      cause: failure2
    });
    await session.resume(lastStatus === 403 ? "HTTP 403" : "SABR session failed", failed);
    if (session.format.url !== void 0)
      return switched(failed);
  }
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/delivery/index.js
var Media = class {
  #delivery;
  #playback;
  constructor(delivery, info, format) {
    this.#delivery = delivery;
    this.#playback = { info, format };
  }
  /** The info the next read starts from; a read that re-resolves replaces it. */
  get info() {
    return this.#playback.info;
  }
  get format() {
    return this.#playback.format;
  }
  /** Streams the format's bytes as a Node `Readable`. */
  read(options = {}) {
    return deliver(this.#delivery, async () => this.#playback, options);
  }
};
var DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024;
var DEFAULT_LIVE_BUFFER_MS = 2e4;
function deliver(delivery, prepare2, options = {}) {
  const controller = new AbortController();
  const chunks = generate(delivery, prepare2, options, controller.signal);
  const stream = new Readable({
    highWaterMark: options.highWaterMark,
    read() {
      chunks.next().then((result) => this.push(result.done ? null : result.value), (error) => this.destroy(error instanceof Error ? error : new Error(String(error))));
    },
    destroy(error, callback) {
      controller.abort(error ?? void 0);
      chunks.return(void 0).catch(ignore);
      callback(error);
    }
  });
  return options.signal ? addAbortSignal(options.signal, stream) : stream;
}
async function* generate(delivery, prepare2, options, signal) {
  try {
    const playback = await prepare2(signal);
    checkStartTime(options, playback.format);
    const session = new Session(delivery, playback, options, signal);
    const liveBuffer = options.liveBuffer ?? DEFAULT_LIVE_BUFFER_MS;
    if (playback.format.isHLS)
      yield* readLive(session, liveBuffer, signal);
    else if (playback.format.isLive || playback.format.targetDurationSec !== void 0) {
      yield* readDash(session, liveBuffer, signal);
    } else
      yield* readFile(session, options, signal);
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  }
}
function checkStartTime({ startTimeMs, range: range2 }, { itag, url }) {
  if (startTimeMs === void 0)
    return;
  if (!Number.isFinite(startTimeMs) || startTimeMs < 0) {
    throw new YtdlError("INVALID_ARGUMENT", `startTimeMs must be a finite number from 0, got ${startTimeMs}`);
  }
  if (range2 !== void 0)
    throw new YtdlError("INVALID_ARGUMENT", "startTimeMs cannot be combined with range");
  if (url !== void 0)
    throw new YtdlError("INVALID_ARGUMENT", `itag ${itag}: startTimeMs needs a SABR format`);
}
async function* readFile(session, options, signal) {
  const { itag, contentLength } = session.format;
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const { startTimeMs } = options;
  const start = options.range?.start ?? 0;
  const last = startTimeMs === void 0 ? Math.min(options.range?.end ?? Infinity, contentLength === void 0 ? Infinity : contentLength - 1) : Infinity;
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new YtdlError("INVALID_ARGUMENT", `chunkSize must be a positive integer, got ${chunkSize}`);
  }
  if (!Number.isSafeInteger(start) || start < 0 || !(start <= last)) {
    throw new YtdlError("INVALID_ARGUMENT", `Range start ${start} is outside itag ${itag}`);
  }
  const total = contentLength !== void 0 && Number.isFinite(last) ? last - start + 1 : void 0;
  for (; ; ) {
    const sabr = session.format.url === void 0;
    const position = start + session.downloaded;
    if (sabr)
      yield* readSabr(session, position, last, total, startTimeMs, signal);
    else
      yield* readRanged(session, position, last, total, chunkSize);
    if (session.format.url === void 0 === sabr)
      return;
  }
}
async function* readRanged(session, start, last, total, chunkSize) {
  const { itag } = session.format;
  let position = start;
  while (position <= last) {
    const windowEnd = Math.min(position + chunkSize - 1, last);
    const url = session.format.url;
    if (url === void 0)
      return;
    const response = await session.request(`${url}${url.includes("?") ? "&" : "?"}range=${position}-${windowEnd}`, {
      allowBadRequest: session.format.contentLength === void 0 && session.downloaded > 0
    });
    if (!response)
      continue;
    if (response.status === 400) {
      response.body?.cancel().catch(ignore);
      return;
    }
    const windowStart = position;
    try {
      for await (const piece of readBody(response, itag)) {
        const bytes = piece.subarray(0, windowEnd - position + 1);
        if (bytes.length === 0)
          continue;
        position += bytes.length;
        session.progress(bytes.length, total);
        yield bytes;
        if (position > windowEnd)
          break;
      }
    } catch (error) {
      if (!YtdlError.is(error, "REQUEST_FAILED"))
        throw error;
      await session.resume("response broke off", error);
      continue;
    }
    if (position > windowEnd)
      continue;
    if (position === windowStart) {
      throw new YtdlError("REQUEST_FAILED", `itag ${itag}: empty media response at byte ${position}`);
    }
  }
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/captions.js
var CaptionFormat = {
  /** WebVTT, which players, `ffmpeg` and `<track>` read directly. */
  Vtt: "vtt",
  /** YouTube's XML timed text with per-word timing and styling. */
  Srv3: "srv3",
  /** JSON events. */
  Json3: "json3"
};
function chooseTrack(tracks2, lang) {
  const found = lang === void 0 ? tracks2.find((track) => track.isDefault) ?? tracks2.find((track) => !track.isAutoGenerated) ?? tracks2[0] : tracks2.find((track) => track.languageCode === lang && !track.isAutoGenerated) ?? tracks2.find((track) => track.languageCode === lang);
  if (found)
    return found;
  const offered = [...new Set(tracks2.map((track) => track.languageCode))];
  throw new YtdlError("NO_CAPTIONS", offered.length === 0 ? "The video has no captions" : `No caption track in ${lang}; available: ${offered.join(", ")}`);
}
function captionUrl(track, format) {
  const url = new URL(track.url);
  url.searchParams.set("fmt", format);
  return url.href;
}
function checkFormat(format) {
  if (format !== void 0 && !Object.values(CaptionFormat).includes(format)) {
    throw new YtdlError("INVALID_ARGUMENT", `format must be one of ${Object.values(CaptionFormat).join(", ")}`);
  }
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/url.js
var ID = /^[\w-]{11}$/u;
var PLAYLIST_ID = /^(?!RD(?!CLAK5uy_))(?!UC[\w-]{22}$)[\w-]{12,64}$/u;
var CHANNEL_ID = /^UC[\w-]{22}$/u;
var HOSTS = /* @__PURE__ */ new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com"
]);
var PATH_PREFIXES = ["/shorts/", "/embed/", "/live/", "/v/", "/e/"];
var CHANNEL_LIVE = /^\/(?:@[^/]+|channel\/[\w-]+|c\/[^/]+|user\/[^/]+)\/live\/?$/u;
var CHANNEL_PAGE = /^(?<channel>\/(?:channel\/(?<id>UC[\w-]{22})|@[^/]+|c\/[^/]+|user\/[^/]+))(?:\/videos|\/featured)?\/?$/u;
var EMBED_PLAYERS = /* @__PURE__ */ new Set(["videoseries", "live_stream"]);
function youtubeUrl(text2) {
  let url;
  try {
    url = new URL(/^https?:\/\//iu.test(text2) ? text2 : `https://${text2}`);
  } catch {
    return void 0;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return void 0;
  const host = url.hostname.toLowerCase();
  return host === "youtu.be" || HOSTS.has(host) ? url : void 0;
}
function parseVideoId(input) {
  const text2 = input.trim();
  if (ID.test(text2))
    return text2;
  const url = youtubeUrl(text2);
  if (!url)
    return void 0;
  let candidate;
  if (url.hostname.toLowerCase() === "youtu.be")
    candidate = url.pathname.split("/")[1];
  else if (url.pathname === "/watch")
    candidate = url.searchParams.get("v") ?? void 0;
  else {
    const prefix = PATH_PREFIXES.find((p) => url.pathname.startsWith(p));
    if (prefix)
      candidate = url.pathname.slice(prefix.length).split("/")[0];
  }
  return candidate !== void 0 && ID.test(candidate) && !EMBED_PLAYERS.has(candidate) ? candidate : void 0;
}
function getVideoTarget(input) {
  const id = parseVideoId(input);
  if (id !== void 0)
    return { id };
  const url = youtubeUrl(input.trim());
  if (url && url.hostname.toLowerCase() !== "youtu.be" && CHANNEL_LIVE.test(url.pathname)) {
    return { channelLive: `https://www.youtube.com${url.pathname.replace(/\/$/u, "")}` };
  }
  throw new YtdlError("INVALID_URL", `Not a YouTube video URL, channel live URL or ID: ${input.slice(0, 200)}`);
}
function parsePlaylistId(input) {
  const text2 = typeof input === "string" ? input.trim() : "";
  const id = PLAYLIST_ID.test(text2) ? text2 : youtubeUrl(text2)?.searchParams.get("list");
  return id && PLAYLIST_ID.test(id) ? id : void 0;
}
var uploads = (channelId) => `UU${channelId.slice(2)}`;
function getPlaylistTarget(input) {
  const id = parsePlaylistId(input);
  if (id !== void 0)
    return { id };
  const text2 = typeof input === "string" ? input.trim() : "";
  if (CHANNEL_ID.test(text2))
    return { id: uploads(text2) };
  const url = youtubeUrl(text2);
  const page = url && url.hostname.toLowerCase() !== "youtu.be" ? CHANNEL_PAGE.exec(url.pathname) : null;
  if (url && page) {
    const { channel, id: channelId } = page.groups ?? {};
    return channelId ? { id: uploads(channelId) } : { channel: `https://www.youtube.com${channel}` };
  }
  throw new YtdlError("INVALID_URL", `Not a YouTube playlist, channel or ID: ${String(input).slice(0, 200)}`);
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/discovery.js
var SearchType = {
  /** {@link VideoSummary} values. */
  Video: "video",
  /** {@link PlaylistSummary} values. */
  Playlist: "playlist",
  /** YouTube Music songs as {@link VideoSummary} values, with the artists as `author`. */
  Song: "song"
};
var FILTERS = {
  video: "EgIQAQ%3D%3D",
  playlist: "EgIQAw%3D%3D",
  song: "EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D"
};
var YOUTUBE = "https://www.youtube.com";
var SUGGEST_URL = "https://suggestqueries-clients6.youtube.com/complete/search";
var SUMMARY_KINDS = ["videoRenderer", "compactVideoRenderer", "playlistVideoRenderer", "lockupViewModel"];
function checkQuery(query) {
  if (typeof query !== "string" || query.trim() === "") {
    throw new YtdlError("INVALID_ARGUMENT", "query must be a non-empty string");
  }
}
function checkLimit(limit) {
  if (limit !== void 0 && !(Number.isInteger(limit) && limit > 0)) {
    throw new YtdlError("INVALID_ARGUMENT", "limit must be a positive integer");
  }
  return limit;
}
var isSearchType = (value) => Object.values(SearchType).includes(value);
function checkSearchType(type) {
  if (type === void 0)
    return SearchType.Video;
  if (!isSearchType(type))
    throw new YtdlError("INVALID_ARGUMENT", "type must be a SearchType value");
  return type;
}
function checkMusic(music) {
  if (music !== void 0 && typeof music !== "boolean") {
    throw new YtdlError("INVALID_ARGUMENT", "music must be a boolean");
  }
  return music ?? false;
}
function checkRadioSeed(radioSeed, music) {
  if (radioSeed === void 0)
    return void 0;
  if (!music)
    throw new YtdlError("INVALID_ARGUMENT", "radioSeed needs music: true");
  const id = typeof radioSeed === "string" ? parseVideoId(radioSeed) : void 0;
  if (!id)
    throw new YtdlError("INVALID_ARGUMENT", "radioSeed must be a video ID or URL");
  return id;
}
function checkSafeSearch(safeSearch) {
  if (safeSearch !== void 0 && typeof safeSearch !== "boolean") {
    throw new YtdlError("INVALID_ARGUMENT", "safeSearch must be a boolean");
  }
  return safeSearch ?? false;
}
function owner(id, name, path, avatars, badges) {
  return {
    id,
    name,
    url: path?.startsWith("/") ? `${YOUTUBE}${path}` : id ? `${YOUTUBE}/channel/${id}` : void 0,
    thumbnails: avatars,
    verified: badges.some((badge) => badge.verified),
    badges: badges.flatMap((badge) => badge.label ?? [])
  };
}
function byline(value, badges = [], avatars = []) {
  const endpoint = at(value, "runs", 0, "navigationEndpoint");
  return owner(str(at(endpoint, "browseEndpoint", "browseId")), text(value), str(at(endpoint, "commandMetadata", "webCommandMetadata", "url")) ?? str(at(endpoint, "browseEndpoint", "canonicalBaseUrl")), avatars, badges);
}
var rendererOwnerBadges = (renderer) => list(at(renderer, "ownerBadges")).map((badge) => {
  const meta = at(badge, "metadataBadgeRenderer");
  return {
    label: str(at(meta, "tooltip")) ?? str(at(meta, "accessibilityData", "label")),
    verified: /VERIFIED/u.test(String(at(meta, "style")))
  };
});
function lockupOwner(metadata) {
  const part = at(metadata, "metadata", "contentMetadataViewModel", "metadataRows", 0, "metadataParts", 0);
  const endpoint = at(part, "text", "commandRuns", 0, "onTap", "innertubeCommand");
  const icon = at(part, "icon");
  const image = at(metadata, "image");
  return owner(str(at(endpoint, "browseEndpoint", "browseId")) ?? str(collect(image, "browseEndpoint").map((browse) => at(browse, "browseId"))[0]), text(at(part, "text")), str(at(endpoint, "browseEndpoint", "canonicalBaseUrl")) ?? str(at(endpoint, "commandMetadata", "webCommandMetadata", "url")), thumbnails(collect(image, "avatarViewModel").map((avatar) => at(avatar, "image", "sources"))[0]), isRecord(icon) ? [
    {
      label: str(at(icon, "accessibilityLabel")),
      verified: /CHECK_CIRCLE|AUDIO_BADGE/u.test(String(at(icon, "name")))
    }
  ] : []);
}
var isLiveBadge = (badge) => /LIVE/u.test(String(at(badge, "style")));
function rendererSummary(renderer) {
  const id = str(at(renderer, "videoId"));
  const title = text(at(renderer, "title"));
  if (!id || !title || at(renderer, "isPlayable") === false)
    return void 0;
  if (at(renderer, "style") === "PLAYLIST_VIDEO_RENDERER_STYLE_RECOMMENDED_VIDEO")
    return void 0;
  const isLive = collect(renderer, "metadataBadgeRenderer").some(isLiveBadge) || collect(renderer, "thumbnailOverlayTimeStatusRenderer").some((overlay) => at(overlay, "style") === "LIVE") || at(renderer, "lengthText") === void 0 && at(renderer, "lengthSeconds") === void 0 && at(renderer, "upcomingEventData") === void 0;
  const startTime = num(at(renderer, "upcomingEventData", "startTime"));
  return {
    id,
    url: watchUrl(id),
    title,
    author: byline(at(renderer, "ownerText") ?? at(renderer, "longBylineText") ?? at(renderer, "shortBylineText"), rendererOwnerBadges(renderer), thumbnails(at(renderer, "channelThumbnailSupportedRenderers", "channelThumbnailWithLinkRenderer", "thumbnail", "thumbnails"))),
    lengthSeconds: isLive ? void 0 : num(at(renderer, "lengthSeconds")) ?? parseClock(text(at(renderer, "lengthText"))),
    viewCount: isLive ? void 0 : parseAbbreviated(text(at(renderer, "viewCountText")) ?? text(at(renderer, "shortViewCountText"))),
    thumbnails: thumbnails(at(renderer, "thumbnail", "thumbnails")),
    badges: list(at(renderer, "badges")).flatMap((badge) => {
      const meta = at(badge, "metadataBadgeRenderer");
      return isLiveBadge(meta) ? [] : str(at(meta, "label")) ?? [];
    }),
    isLive,
    isUpcoming: at(renderer, "upcomingEventData") !== void 0,
    upcomingAt: startTime === void 0 ? void 0 : startTime * 1e3
  };
}
var isLiveLockupBadge = (badge) => at(badge, "badgeStyle") === "THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE";
var isUpcomingLockupBadge = (badge) => at(badge, "text") === "Upcoming";
function lockupSummary(lockup) {
  const id = str(at(lockup, "contentId"));
  const type = at(lockup, "contentType");
  const station = type === "LOCKUP_CONTENT_TYPE_STATION" && id !== void 0 && parseVideoId(id) === id;
  if (type !== "LOCKUP_CONTENT_TYPE_VIDEO" && !station)
    return void 0;
  const metadata = at(lockup, "metadata", "lockupMetadataViewModel");
  const title = text(at(metadata, "title"));
  if (!id || !title)
    return void 0;
  const badgeViews = collect(lockup, "thumbnailBadgeViewModel");
  const isLive = badgeViews.some(isLiveLockupBadge);
  const isUpcoming = badgeViews.some(isUpcomingLockupBadge);
  const badges = badgeViews.flatMap((badge) => isLiveLockupBadge(badge) || isUpcomingLockupBadge(badge) ? [] : str(at(badge, "text")) ?? []);
  const rows = at(metadata, "metadata", "contentMetadataViewModel", "metadataRows");
  const image = at(lockup, "contentImage");
  return {
    id,
    url: watchUrl(id),
    title,
    author: lockupOwner(metadata),
    lengthSeconds: badges.map(parseClock).find((value) => value !== void 0),
    viewCount: isLive || isUpcoming ? void 0 : parseAbbreviated(text(at(rows, 1, "metadataParts", 0, "text"))),
    thumbnails: thumbnails(at(image, "thumbnailViewModel", "image", "sources") ?? at(image, "collectionThumbnailViewModel", "primaryThumbnail", "thumbnailViewModel", "image", "sources")),
    badges: badges.filter((badge) => badge !== "" && parseClock(badge) === void 0),
    isLive,
    isUpcoming,
    upcomingAt: void 0
  };
}
function playlistSummary(lockup) {
  if (at(lockup, "contentType") !== "LOCKUP_CONTENT_TYPE_PLAYLIST")
    return void 0;
  const id = str(at(lockup, "contentId"));
  const metadata = at(lockup, "metadata", "lockupMetadataViewModel");
  const title = text(at(metadata, "title"));
  if (!id || !title || parsePlaylistId(id) !== id)
    return void 0;
  const updated = list(at(metadata, "metadata", "contentMetadataViewModel", "metadataRows")).filter((row) => at(row, "lockupContentMetadataRowExtension") === void 0).map((row) => at(row, "metadataParts", 0, "text")).find((part) => part !== void 0 && at(part, "commandRuns") === void 0);
  return {
    id,
    url: playlistUrl(id),
    title,
    author: lockupOwner(metadata),
    videoCount: parseAbbreviated(str(at(collect(lockup, "thumbnailBadgeViewModel")[0], "text"))),
    updatedText: text(updated),
    thumbnails: thumbnails(at(lockup, "contentImage", "collectionThumbnailViewModel", "primaryThumbnail", "thumbnailViewModel", "image", "sources"))
  };
}
function summary(kind, value) {
  return kind === "lockupViewModel" ? lockupSummary(value) : rendererSummary(value);
}
function summaries(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value)
      summaries(item, found);
  } else if (isRecord(value)) {
    for (const [name, child] of Object.entries(value)) {
      if (SUMMARY_KINDS.includes(name) && isRecord(child)) {
        const video = summary(name, child);
        if (video)
          found.push(video);
      } else
        summaries(child, found);
    }
  }
  return found;
}
function artists(value) {
  const runs = list(at(value, "runs"));
  const end = runs.findIndex((run) => at(run, "text") === " \u2022 ");
  const names = end === -1 ? runs : runs.slice(0, end);
  return owner(names.map((run) => str(at(run, "navigationEndpoint", "browseEndpoint", "browseId"))).find(Boolean), text({ runs: names }), void 0, [], []);
}
function musicSummary(id, title, credits, lengthSeconds, rest) {
  return {
    id,
    url: watchUrl(id),
    title,
    author: artists(credits),
    lengthSeconds,
    ...rest,
    isLive: false,
    isUpcoming: false,
    upcomingAt: void 0
  };
}
function songSummary(row) {
  const id = str(at(row, "playlistItemData", "videoId"));
  const [title, credits, plays] = list(at(row, "flexColumns")).map((column) => at(column, "musicResponsiveListItemFlexColumnRenderer", "text"));
  const name = text(title);
  if (!id || !name)
    return void 0;
  return musicSummary(id, name, credits, parseClock(str(at(list(at(credits, "runs")).at(-1), "text"))), {
    viewCount: parseAbbreviated(text(plays)),
    thumbnails: thumbnails(at(row, "thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails")),
    badges: list(at(row, "badges")).flatMap((badge) => str(at(badge, "musicInlineBadgeRenderer", "accessibilityData", "accessibilityData", "label")) ?? [])
  });
}
function radioSummary(entry) {
  const id = str(at(entry, "videoId"));
  const title = text(at(entry, "title"));
  if (!id || !title)
    return void 0;
  return musicSummary(id, title, at(entry, "longBylineText"), parseClock(text(at(entry, "lengthText"))), {
    viewCount: void 0,
    thumbnails: thumbnails(at(entry, "thumbnail", "thumbnails")),
    badges: []
  });
}
var watchUrl = (id) => `${YOUTUBE}/watch?v=${id}`;
var playlistUrl = (id) => `${YOUTUBE}/playlist?list=${id}`;
var sectionItems = (page) => collect(page, "itemSectionRenderer").flatMap((section) => list(at(section, "contents")));
var videoResults = (page) => sectionItems(page).flatMap((item) => SUMMARY_KINDS.flatMap((kind) => {
  const value = at(item, kind);
  const video = isRecord(value) ? summary(kind, value) : void 0;
  return video ? [video] : [];
}));
var playlistResults = (page) => sectionItems(page).flatMap((item) => {
  const lockup = at(item, "lockupViewModel");
  const playlist = isRecord(lockup) ? playlistSummary(lockup) : void 0;
  return playlist ? [playlist] : [];
});
function withoutRepeats(entries, seen = /* @__PURE__ */ new Set()) {
  return entries.filter((entry) => {
    if (seen.has(entry.id))
      return false;
    seen.add(entry.id);
    return true;
  });
}
function relatedVideos(next) {
  return withoutRepeats(summaries(next));
}
var appended = (page) => collect(page, "appendContinuationItemsAction").map((action) => list(at(action, "continuationItems")));
var musicShelves = (page) => [
  ...collect(page, "musicShelfRenderer"),
  ...collect(page, "musicShelfContinuation")
];
var songResults = (page) => musicShelves(page).flatMap((shelf) => list(at(shelf, "contents")).flatMap((item) => {
  const row = at(item, "musicResponsiveListItemRenderer");
  const song = isRecord(row) ? songSummary(row) : void 0;
  return song ? [song] : [];
}));
var songLists = (page) => musicShelves(page).map((shelf) => list(at(shelf, "continuations")));
var searchLists = (page) => [
  ...collect(page, "sectionListRenderer").map((section) => list(at(section, "contents"))),
  ...appended(page)
];
var playlistLists = (page) => [
  ...[...collect(page, "itemSectionRenderer"), ...collect(page, "playlistVideoListRenderer")].map((section) => list(at(section, "contents"))),
  ...appended(page)
];
function continuation(lists) {
  return lists.flat().map((item) => str(at(item, "continuationItemRenderer", "continuationEndpoint", "continuationCommand", "token")) ?? str(at(item, "nextContinuationData", "continuation")) ?? str(at(item, "continuationItemViewModel", "continuationCommand", "innertubeCommand", "continuationCommand", "token"))).find((token) => token !== void 0);
}
var MAX_PAGES = 1e3;
async function collectPages({ first, more, entries, lists, limit, unique, signal }) {
  const videos = [];
  const seen = /* @__PURE__ */ new Set();
  const followed = /* @__PURE__ */ new Set();
  for (let page = first, pages = 1; ; pages++) {
    videos.push(...unique ? withoutRepeats(entries(page), seen) : entries(page));
    const token = continuation(lists(page));
    if (videos.length >= limit || !token || followed.has(token))
      return videos.slice(0, limit);
    if (pages >= MAX_PAGES)
      throw new YtdlError("REQUEST_FAILED", `YouTube offered more than ${MAX_PAGES} pages`);
    followed.add(token);
    signal?.throwIfAborted();
    page = await more(token);
  }
}
async function searchPages(innertube, query, { type, identity, entries, lists }, { safeSearch, limit, signal }) {
  const visitorData = await innertube.visitorData(signal);
  const search = (page) => innertube.search(identity, page, safeSearch, visitorData, signal);
  return collectPages({
    first: await search({ query, params: FILTERS[type] }),
    more: (token) => search({ continuation: token }),
    entries,
    lists,
    limit,
    unique: true,
    signal
  });
}
var searchVideos = (innertube, query, request) => searchPages(innertube, query, { type: SearchType.Video, identity: WEB, entries: videoResults, lists: searchLists }, request);
var searchPlaylists = (innertube, query, request) => searchPages(innertube, query, { type: SearchType.Playlist, identity: WEB, entries: playlistResults, lists: searchLists }, request);
var searchSongs = (innertube, query, request) => searchPages(innertube, query, { type: SearchType.Song, identity: WEB_MUSIC, entries: songResults, lists: songLists }, request);
async function radioEntries(innertube, videoId, seed, signal) {
  const visitorData = await innertube.visitorData(signal);
  const page = await innertube.musicRadio(videoId, `RDAMVM${seed}`, visitorData, signal);
  return collect(page, "playlistPanelRenderer").flatMap((panel) => list(at(panel, "contents"))).flatMap((item) => {
    const entry = at(item, "playlistPanelVideoRenderer") ?? at(item, "playlistPanelVideoWrapperRenderer", "primaryRenderer", "playlistPanelVideoRenderer");
    const song = isRecord(entry) ? radioSummary(entry) : void 0;
    return song ? [song] : [];
  });
}
async function musicRadio(innertube, videoId, seed, signal) {
  return withoutRepeats(await radioEntries(innertube, videoId, seed, signal), /* @__PURE__ */ new Set([videoId]));
}
async function musicSong(innertube, videoId, signal) {
  const song = (await radioEntries(innertube, videoId, videoId, signal)).find((entry) => entry.id === videoId);
  if (!song)
    throw new YtdlError("NOT_FOUND", `YouTube Music lists no song ${videoId}`);
  return song;
}
async function fetchMusicSuggestions(innertube, query, signal) {
  const visitorData = await innertube.visitorData(signal);
  const page = await innertube.musicSuggestions(query, visitorData, signal);
  return collect(page, "searchSuggestionRenderer").flatMap((suggestion) => str(at(suggestion, "navigationEndpoint", "searchEndpoint", "query")) ?? []);
}
function headerCounts(header, pageHeader) {
  if (header !== void 0) {
    return {
      videoCount: parseAbbreviated(text(at(header, "numVideosText"))),
      viewCount: parseAbbreviated(text(at(header, "viewCountText")))
    };
  }
  const [videos, views] = list(at(pageHeader, "metadata", "contentMetadataViewModel", "metadataRows")).slice(1).flatMap((row) => list(at(row, "metadataParts"))).flatMap((part) => text(at(part, "text")) ?? []).filter((part) => /\d/u.test(part));
  return { videoCount: parseAbbreviated(videos), viewCount: parseAbbreviated(views) };
}
async function browsePlaylist(innertube, id, limit, signal) {
  const visitorData = await innertube.visitorData(signal);
  const first = await innertube.browse({ playlistId: id }, visitorData, signal);
  const metadata = collect(first, "playlistMetadataRenderer")[0];
  const header = collect(first, "playlistHeaderRenderer")[0];
  const pageHeader = collect(first, "pageHeaderViewModel")[0];
  if (!metadata && !header && !pageHeader && summaries(first).length === 0) {
    throw new YtdlError("NOT_FOUND", `Playlist ${id} does not exist`);
  }
  const videos = await collectPages({
    first,
    more: (token) => innertube.browse({ continuation: token }, visitorData, signal),
    entries: summaries,
    lists: playlistLists,
    limit,
    unique: false,
    signal
  });
  return {
    id,
    url: playlistUrl(id),
    title: text(at(metadata, "title")) ?? text(at(header, "title")) ?? text(at(pageHeader, "title", "dynamicTextViewModel", "text")),
    description: str(at(metadata, "description")) ?? text(at(pageHeader, "description", "descriptionPreviewViewModel", "description")) ?? text(at(header, "descriptionText")),
    author: byline(at(collect(first, "videoOwnerRenderer")[0], "title") ?? at(header, "ownerText")),
    thumbnails: thumbnails(at(collect(first, "playlistVideoThumbnailRenderer")[0], "thumbnail", "thumbnails")),
    ...headerCounts(header, pageHeader),
    videos
  };
}
async function fetchSuggestions(innertube, query, signal) {
  const url = new URL(SUGGEST_URL);
  url.search = new URLSearchParams({
    client: "youtube",
    ds: "yt",
    hl: innertube.lang,
    gl: innertube.country,
    q: query
  }).toString();
  const what = "YouTube suggestions";
  const body = await innertube.text(url.href, { headers: userAgentHeader(WEB), signal }, what);
  let parsed;
  try {
    parsed = JSON.parse(/^[^(]*\((.*)\)\s*;?\s*$/su.exec(body)?.[1] ?? "");
  } catch (cause) {
    throw new YtdlError("REQUEST_FAILED", `${what} were not JSONP`, { cause });
  }
  const entries = at(parsed, 1);
  if (!Array.isArray(entries))
    throw new YtdlError("REQUEST_FAILED", `${what} had no completions`);
  return entries.flatMap((entry) => str(at(entry, 0)) ?? []);
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/info.js
function author(player, next) {
  const details = at(player, "videoDetails");
  const micro = at(player, "microformat", "playerMicroformatRenderer");
  const owner2 = collect(next, "videoOwnerRenderer")[0];
  const id = str(at(details, "channelId")) ?? str(at(micro, "externalChannelId")) ?? "";
  const badges = collect(owner2, "metadataBadgeRenderer");
  return {
    id,
    name: str(at(details, "author")) ?? str(at(micro, "ownerChannelName")) ?? text(at(owner2, "title")) ?? "",
    url: str(at(micro, "ownerProfileUrl")) ?? (id ? `https://www.youtube.com/channel/${id}` : ""),
    thumbnails: thumbnails(at(owner2, "thumbnail", "thumbnails")),
    verified: owner2 ? badges.some((badge) => /VERIFIED/u.test(String(at(badge, "style")))) : void 0,
    subscriberCount: parseAbbreviated(text(at(owner2, "subscriberCountText")))
  };
}
function storyboards(player) {
  const spec = str(at(player, "storyboards", "playerStoryboardSpecRenderer", "spec"));
  if (!spec)
    return [];
  const [base2, ...levels] = spec.split("|");
  if (!base2)
    return [];
  return levels.flatMap((level, index) => {
    const [width, height, count, columns, rows, interval, name, sigh] = level.split("#");
    const values = [width, height, count, columns, rows, interval].map(Number);
    if (values.some((value) => !Number.isFinite(value)) || !name || !sigh)
      return [];
    const [thumbnailWidth = 0, thumbnailHeight = 0, thumbnailCount = 0, cols = 1, rowCount = 1, ms = 0] = values;
    const url = new URL(base2.replace("$L", String(index)).replace("$N", name));
    url.searchParams.set("sigh", sigh);
    return [
      {
        templateUrl: url.href.replaceAll("%24M", "$M"),
        thumbnailWidth,
        thumbnailHeight,
        thumbnailCount,
        interval: ms,
        columns: cols,
        rows: rowCount,
        storyboardCount: Math.ceil(thumbnailCount / (cols * rowCount))
      }
    ];
  });
}
function chapters(next) {
  const fromMarkers = collect(next, "chapterRenderer").flatMap((chapter) => {
    const title = text(at(chapter, "title"));
    const start = num(at(chapter, "timeRangeStartMillis"));
    return title !== void 0 && start !== void 0 ? [{ title, startTime: start / 1e3 }] : [];
  });
  if (fromMarkers.length > 0)
    return fromMarkers;
  return collect(next, "macroMarkersListItemRenderer").flatMap((item) => {
    const title = text(at(item, "title"));
    const start = num(at(item, "onTap", "watchEndpoint", "startTimeSeconds")) ?? parseClock(text(at(item, "timeDescription")));
    return title !== void 0 && start !== void 0 ? [{ title, startTime: start }] : [];
  });
}
function likes(next) {
  for (const button of collect(next, "likeButtonViewModel")) {
    for (const label of collect(button, "buttonViewModel")) {
      const accessibility = str(at(label, "accessibilityText"));
      if (accessibility && /along with/iu.test(accessibility))
        return parseAbbreviated(accessibility.split(/along with/iu)[1]);
    }
  }
  return void 0;
}
function videoDetails(player, next, context) {
  const details = at(player, "videoDetails");
  const micro = at(player, "microformat", "playerMicroformatRenderer");
  const id = str(at(details, "videoId")) ?? "";
  const countries = at(micro, "availableCountries");
  const keywords = at(details, "keywords");
  const familySafe = at(micro, "isFamilySafe");
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: str(at(details, "title")) ?? text(at(micro, "title")) ?? "",
    description: str(at(details, "shortDescription")) ?? text(at(micro, "description")),
    lengthSeconds: num(at(details, "lengthSeconds")) ?? 0,
    viewCount: num(at(details, "viewCount")),
    likes: likes(next),
    publishDate: str(at(micro, "publishDate")),
    uploadDate: str(at(micro, "uploadDate")),
    keywords: Array.isArray(keywords) ? keywords.filter((word) => typeof word === "string") : [],
    category: str(at(micro, "category")),
    thumbnails: thumbnails(at(details, "thumbnail", "thumbnails")),
    author: author(player, next),
    isLive: at(details, "isLive") === true,
    isUpcoming: at(details, "isUpcoming") === true,
    isUnlisted: typeof at(micro, "isUnlisted") === "boolean" ? at(micro, "isUnlisted") : void 0,
    isFamilySafe: typeof familySafe === "boolean" ? familySafe : void 0,
    isAgeRestricted: context.ageRestricted || familySafe === false,
    availableCountries: Array.isArray(countries) ? countries.filter((c) => typeof c === "string") : void 0,
    chapters: chapters(next),
    storyboards: storyboards(player)
  };
}
function captionTracks(player) {
  const renderer = at(player, "captions", "playerCaptionsTracklistRenderer");
  const audioTrack2 = at(renderer, "audioTracks", num(at(renderer, "defaultAudioTrackIndex")) ?? 0);
  const defaultIndex = num(at(audioTrack2, "defaultCaptionTrackIndex"));
  return list(at(renderer, "captionTracks")).flatMap((track, index) => {
    const url = str(at(track, "baseUrl"));
    const languageCode = str(at(track, "languageCode"));
    if (!url || !languageCode)
      return [];
    return [
      {
        languageCode,
        name: text(at(track, "name")) ?? languageCode,
        isAutoGenerated: at(track, "kind") === "asr",
        isDefault: index === defaultIndex,
        url
      }
    ];
  });
}
function toInfo(base2, resolution, formats) {
  return {
    videoDetails: base2.videoDetails,
    relatedVideos: base2.relatedVideos,
    playerResponse: base2.playerResponse,
    captionTracks: base2.captionTracks,
    formats,
    client: resolution.client,
    hlsManifestUrl: resolution.hlsManifestUrl,
    sabr: resolution.sabr,
    visitorData: resolution.visitorData,
    expiresAt: resolution.expiresAt,
    playableAt: resolution.playableAt
  };
}
async function basicInfo(innertube, id, resolution, signal) {
  const visitor = resolution.visitorData;
  const [next, web] = await Promise.all([
    innertube.next(id, visitor, signal).catch(() => ({})),
    at(resolution.player, "microformat") === void 0 ? innertube.webMetadata(id, visitor, signal).catch(() => ({})) : Promise.resolve({})
  ]);
  signal?.throwIfAborted();
  const microformat = at(resolution.player, "microformat") ?? at(web, "microformat");
  const player = isRecord(microformat) ? { ...resolution.player, microformat } : resolution.player;
  const ageRestricted = resolution.attempts.some((attempt) => attempt.code === "AGE_RESTRICTED");
  return {
    videoDetails: videoDetails(player, next, { ageRestricted }),
    relatedVideos: relatedVideos(next),
    playerResponse: player,
    captionTracks: captionTracks(player)
  };
}
async function playableFormats(innertube, resolution, signal) {
  if (at(resolution.player, "videoDetails", "isLive") !== true || !resolution.hlsManifestUrl) {
    return resolution.formats;
  }
  let playlist;
  try {
    playlist = await innertube.text(resolution.hlsManifestUrl, { headers: userAgentHeader(resolution.client), signal }, "YouTube HLS manifest");
  } catch (error) {
    const failed = YtdlError.is(error, "REQUEST_FAILED") || YtdlError.is(error, "RATE_LIMITED");
    if (signal?.aborted || !failed || !resolution.formats.some((format) => format.isLive))
      throw error;
    return resolution.formats;
  }
  return [...parseHlsMaster(playlist, resolution.hlsManifestUrl, resolution.client), ...resolution.formats];
}
async function lookupInfo(innertube, resolver, id, signal, format) {
  const resolution = await resolver.resolve(id, { signal, format });
  const [base2, formats] = await Promise.all([
    basicInfo(innertube, id, resolution, signal),
    playableFormats(innertube, resolution, signal)
  ]);
  return toInfo(base2, resolution, formats);
}
async function resumeInfo(innertube, resolver, request) {
  const { info: previous, format: failed, attempt, reason, signal } = request;
  if (attempt <= 1) {
    if (previous.visitorData)
      await innertube.replaceVisitorData(previous.visitorData, signal, { keepOnFailure: true }).catch(ignore);
  } else if (reason === "HTTP 403") {
    resolver.block(failed.client);
  }
  const resolution = await resolver.resolve(previous.videoDetails.id, {
    signal,
    format: failed,
    prefer: attempt <= 1 ? [failed.client] : void 0
  });
  const formats = await playableFormats(innertube, resolution, signal);
  const format = formats.find((candidate) => sameFormat(candidate, failed) && candidate.contentLength === failed.contentLength);
  if (!format)
    throw new YtdlError("NO_FORMAT", `No client offers the same itag ${failed.itag} file after ${reason}`);
  const base2 = { ...previous, playerResponse: resolution.player, captionTracks: captionTracks(resolution.player) };
  return { info: toInfo(base2, resolution, formats), format };
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/innertube.js
var EMBED_HOST = "https://www.reddit.com/";
var InnerTube = class {
  fetch;
  lang;
  country;
  utcOffsetMinutes;
  #visitor;
  constructor(options) {
    this.fetch = options.fetch;
    this.lang = options.lang ?? "en";
    this.country = options.country ?? "US";
    this.utcOffsetMinutes = options.utcOffsetMinutes ?? 0;
  }
  text(url, init, what) {
    return fetchText(this.fetch, url, init, what);
  }
  visitorData(signal) {
    return abortable(this.#sharedVisitor(), signal);
  }
  replaceVisitorData(stale, signal, { keepOnFailure = false } = {}) {
    const current = this.#visitor;
    const fresh = () => {
      this.#visitor = void 0;
      const pending = this.#sharedVisitor();
      if (keepOnFailure && current) {
        pending.catch(() => {
          this.#visitor ??= current;
        });
      }
      return abortable(pending, signal);
    };
    if (!current || stale === void 0)
      return fresh();
    const settle = (value) => !signal?.aborted && this.#visitor === current && (value === void 0 || value === stale) ? fresh() : this.visitorData(signal);
    return abortable(current.then(settle, () => settle(void 0)), signal);
  }
  #sharedVisitor() {
    if (!this.#visitor) {
      const pending = this.#fetchVisitorData();
      this.#visitor = pending;
      pending.catch(() => {
        if (this.#visitor === pending)
          this.#visitor = void 0;
      });
    }
    return this.#visitor;
  }
  async embedContext(videoId, signal) {
    const page = await this.text(`${YOUTUBE_ORIGIN}/embed/${encodeURIComponent(videoId)}?html5=1`, { headers: { ...BROWSER, Referer: EMBED_HOST }, signal }, "YouTube embed page");
    const config = ytcfg(page);
    return {
      visitorData: str(config.VISITOR_DATA),
      hostFlags: str(at(config, "WEB_PLAYER_CONTEXT_CONFIGS", "WEB_PLAYER_CONTEXT_CONFIG_ID_EMBEDDED_PLAYER", "encryptedHostFlags"))
    };
  }
  player(request, signal) {
    return this.#post("player", CLIENTS[request.client], signal, {
      videoId: request.videoId,
      visitorData: request.visitorData,
      headers: request.authHeaders,
      thirdParty: request.embed && { embedUrl: EMBED_HOST },
      body: {
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: "HTML5_PREF_WANTS",
            signatureTimestamp: request.signatureTimestamp,
            encryptedHostFlags: request.embed?.hostFlags
          }
        },
        serviceIntegrityDimensions: request.poToken ? { poToken: request.poToken } : void 0
      }
    });
  }
  // Only `microformat` is read: the WEB formats are SABR-only and the playback clients omit it.
  webMetadata(videoId, visitorData, signal) {
    return this.#post("player", WEB, signal, { videoId, visitorData });
  }
  next(videoId, visitorData, signal) {
    return this.#post("next", WEB, signal, { videoId, visitorData });
  }
  musicRadio(videoId, playlistId, visitorData, signal) {
    return this.#post("next", WEB_MUSIC, signal, { videoId, visitorData, body: { playlistId } });
  }
  musicSuggestions(input, visitorData, signal) {
    return this.#post("music/get_search_suggestions", WEB_MUSIC, signal, {
      visitorData,
      hl: this.lang,
      body: { input }
    });
  }
  search(identity, page, safeSearch, visitorData, signal) {
    return this.#post("search", identity, signal, {
      visitorData,
      user: safeSearch ? { enableSafetyMode: true } : void 0,
      body: "query" in page ? { query: page.query, params: page.params } : { continuation: page.continuation }
    });
  }
  browse(page, visitorData, signal) {
    return this.#post("browse", WEB, signal, {
      visitorData,
      body: "playlistId" in page ? { browseId: `VL${page.playlistId}` } : { continuation: page.continuation }
    });
  }
  async channelId(url, signal) {
    const id = str(at(await this.#resolveUrl(url, signal), "endpoint", "browseEndpoint", "browseId"));
    if (!id || !/^UC[\w-]{22}$/u.test(id))
      throw new YtdlError("NOT_FOUND", `${url} names no channel`);
    return id;
  }
  async channelLiveVideo(url, signal) {
    const videoId = str(at(await this.#resolveUrl(url, signal), "endpoint", "watchEndpoint", "videoId"));
    if (!videoId || !/^[\w-]{11}$/u.test(videoId))
      throw new YtdlError("NOT_FOUND", `${url} has no live stream`);
    return videoId;
  }
  #resolveUrl(url, signal) {
    return this.#post("navigation/resolve_url", WEB, signal, {
      visitorData: void 0,
      body: { url },
      notFound: `${url} names no channel`
    });
  }
  // Without visitor data every client answers "confirm you're not a bot"; `sw.js_data` hands one out.
  async #fetchVisitorData() {
    const what = "YouTube visitor data";
    const body = await this.text(`${YOUTUBE_ORIGIN}/sw.js_data`, { headers: BROWSER }, what);
    let parsed;
    try {
      parsed = JSON.parse(body.replace(/^\)\]\}'\s*/u, ""));
    } catch (cause) {
      throw new YtdlError("REQUEST_FAILED", `${what} was not JSON`, { cause });
    }
    const visitor = str(at(parsed, 0, 2, 0, 0, 13));
    if (!visitor)
      throw new YtdlError("REQUEST_FAILED", `${what} had no visitor ID`);
    return visitor;
  }
  async #post(endpoint, identity, signal, request) {
    const what = `YouTube ${identity.name} ${endpoint}`;
    const response = await send(this.fetch, `${identity.origin}/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...identity.userAgent ? { "User-Agent": identity.userAgent } : {},
        "X-YouTube-Client-Name": String(identity.nameId),
        "X-YouTube-Client-Version": identity.version,
        Origin: identity.origin,
        ...request.visitorData ? { "X-Goog-Visitor-Id": request.visitorData } : {},
        ...request.headers
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: identity.name,
            clientVersion: identity.version,
            ...identity.context,
            userAgent: identity.userAgent,
            hl: request.hl ?? "en",
            gl: this.country,
            utcOffsetMinutes: this.utcOffsetMinutes,
            visitorData: request.visitorData
          },
          thirdParty: request.thirdParty,
          user: request.user
        },
        videoId: request.videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        ...request.body
      }),
      signal
    }, what);
    if (response.status === 404 && request.notFound) {
      response.body?.cancel().catch(ignore);
      throw new YtdlError("NOT_FOUND", request.notFound);
    }
    if (!response.ok)
      throw await answerError(response, signal, what);
    const text2 = await bodyText(response, signal, what);
    let json;
    try {
      json = JSON.parse(text2);
    } catch (cause) {
      throw new YtdlError("REQUEST_FAILED", `${what} returned invalid JSON`, { cause });
    }
    if (!isRecord(json))
      throw new YtdlError("REQUEST_FAILED", `${what} returned no object`);
    return json;
  }
};
async function answerError(response, signal, what) {
  const body = await bodyText(response, signal, what).catch(() => "");
  signal?.throwIfAborted();
  let error;
  try {
    error = at(JSON.parse(body), "error");
  } catch {
  }
  const detail = [str(at(error, "status")), str(at(error, "message"))].filter(Boolean).join(": ");
  return statusError(response.status, what, detail);
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/playability.js
function playabilityReason(status) {
  const parts = [
    text(at(status, "reason")),
    text(at(status, "errorScreen", "playerErrorMessageRenderer", "reason")),
    text(at(status, "errorScreen", "playerErrorMessageRenderer", "subreason")),
    ...Array.isArray(at(status, "messages")) ? at(status, "messages").map(text) : []
  ];
  return [...new Set(parts.filter((part) => !!part))].join(" ");
}
function availableCountries(player) {
  const countries = at(player, "microformat", "playerMicroformatRenderer", "availableCountries");
  return Array.isArray(countries) ? countries.filter((country) => typeof country === "string") : void 0;
}
var REGION_PHRASES = ["in your country", "your location"];
var COPYRIGHT_PHRASES = ["copyright claim", "copyright grounds"];
var PRIVATE_PHRASES = ["video is private", "private video"];
var PREMIUM_PHRASES = ["music premium", "premium members"];
var MEMBERS_PHRASES = ["members-only", "join this channel"];
var says = (reason, phrases) => phrases.some((phrase) => reason.includes(phrase));
function classifyPlayability(player) {
  const status = at(player, "playabilityStatus");
  const value = at(status, "status");
  if (value === "OK")
    return { ok: true };
  const reason = playabilityReason(status) || `status ${String(value)}`;
  const lower = reason.toLowerCase();
  const fail = (code, extra = {}) => ({ ok: false, code, reason, ...extra });
  if (value === "LIVE_STREAM_OFFLINE" || lower.includes("live event will begin")) {
    const start = Number(at(status, "liveStreamability", "liveStreamabilityRenderer", "offlineSlate", "liveStreamOfflineSlateRenderer", "scheduledStartTime"));
    return fail("NOT_STARTED", Number.isFinite(start) && start > 0 ? { startTime: new Date(start * 1e3) } : {});
  }
  if (value === "AGE_CHECK_REQUIRED" || value === "AGE_VERIFICATION_REQUIRED" || lower.includes("confirm your age") || lower.includes("age-restricted")) {
    return fail("AGE_RESTRICTED");
  }
  if (lower.includes("not a bot"))
    return fail("BOT_CHECK");
  if (says(lower, REGION_PHRASES)) {
    const countries = availableCountries(player);
    return fail("REGION_BLOCKED", countries ? { availableCountries: countries } : {});
  }
  if (says(lower, COPYRIGHT_PHRASES))
    return fail("NOT_FOUND");
  if (says(lower, PRIVATE_PHRASES))
    return fail("PRIVATE");
  if (says(lower, PREMIUM_PHRASES))
    return fail("PREMIUM_ONLY");
  if (says(lower, MEMBERS_PHRASES))
    return fail("MEMBERS_ONLY");
  if (lower.includes("try again later") || lower.includes("too many requests"))
    return fail("RATE_LIMITED");
  if (lower.includes("recording is not available"))
    return fail("NOT_FOUND");
  if (value === "LOGIN_REQUIRED")
    return fail("BOT_CHECK");
  if (value === "ERROR" && (lower.includes("unavailable") || lower.includes("removed") || lower.includes("does not exist") || lower.includes("terminated"))) {
    return fail("NOT_FOUND");
  }
  return fail("NO_FORMAT");
}
function prerollEnd(player, answeredAt) {
  const renderers = [];
  for (const placement of list(at(player, "adPlacements"))) {
    if (at(placement, "adPlacementRenderer", "config", "adPlacementConfig", "kind") !== "AD_PLACEMENT_KIND_START")
      continue;
    renderers.push(at(placement, "adPlacementRenderer", "renderer", "instreamVideoAdRenderer"));
  }
  for (const slot of list(at(player, "adSlots"))) {
    if (at(slot, "adSlotRenderer", "adSlotMetadata", "triggerEvent") !== "SLOT_TRIGGER_EVENT_BEFORE_CONTENT")
      continue;
    const content = at(slot, "adSlotRenderer", "fulfillmentContent", "fulfilledLayout", "playerBytesAdLayoutRenderer", "renderingContent");
    renderers.push(at(content, "instreamVideoAdRenderer"));
    for (const layout of list(at(content, "playerBytesSequentialLayoutRenderer", "sequentialLayouts"))) {
      renderers.push(at(layout, "playerBytesAdLayoutRenderer", "renderingContent", "instreamVideoAdRenderer"));
    }
  }
  let waitMs = 0;
  for (const renderer of renderers) {
    const skip = Number(at(renderer, "skipOffsetMilliseconds"));
    if (Number.isFinite(skip) && skip > 0) {
      waitMs += skip;
      continue;
    }
    const vars = at(renderer, "playerVars");
    const length = typeof vars === "string" ? Number(new URLSearchParams(vars).get("length_seconds")) : Number.NaN;
    if (Number.isFinite(length) && length > 0)
      waitMs += length * 1e3;
  }
  return answeredAt + waitMs;
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/worker-rpc.js
import { parentPort, Worker } from "node:worker_threads";
var isReply = (message) => typeof message === "object" && message !== null && "reply" in message;
function startWorker(file, events = {}) {
  const worker2 = new Worker(file);
  const pending = /* @__PURE__ */ new Map();
  let nextCall = 0;
  let stopped = false;
  worker2.unref();
  const stop = (cause) => {
    if (stopped)
      return;
    stopped = true;
    const waiters = [...pending.values()];
    pending.clear();
    for (const waiter of waiters)
      waiter.reject(cause);
    events.onStop?.();
  };
  worker2.on("message", (message) => {
    if (!isReply(message)) {
      events.onMessage?.(message);
      return;
    }
    const waiter = pending.get(message.reply);
    pending.delete(message.reply);
    if (pending.size === 0)
      worker2.unref();
    if ("error" in message)
      waiter?.reject(Object.assign(new Error(message.error), { name: message.name }));
    else
      waiter?.resolve(message.result);
  });
  worker2.on("error", stop);
  worker2.on("exit", (code) => stop(new Error(`Worker exited with code ${code}`)));
  return {
    call(request) {
      if (stopped)
        return Promise.reject(new Error("Worker stopped"));
      const call2 = nextCall++;
      worker2.ref();
      return new Promise((resolve, reject) => {
        pending.set(call2, { resolve, reject });
        worker2.postMessage({ call: call2, request });
      });
    },
    post(message, transfer) {
      if (!stopped)
        worker2.postMessage(message, transfer);
    },
    async terminate() {
      stop(new Error("Worker terminated"));
      await worker2.terminate();
    }
  };
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/solver/index.js
var CACHE_LIMIT = 4;
var cache = /* @__PURE__ */ new Map();
var handles = /* @__PURE__ */ new WeakMap();
var nextHandle = 0;
var solver;
function worker() {
  if (solver)
    return solver;
  const file = new URL(import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js", import.meta.url);
  const started = startWorker(file, {
    onStop: () => {
      if (solver !== started)
        return;
      solver = void 0;
      cache.clear();
    }
  });
  solver = started;
  return started;
}
var CALL_DEADLINE_MS = 1e4;
async function call(rpc, request) {
  const deadline = setTimeout(() => rpc.terminate().catch(ignore), CALL_DEADLINE_MS);
  try {
    return await rpc.call(request);
  } finally {
    clearTimeout(deadline);
  }
}
async function loadPlayer({ fetch: fetch2, playerId, signal }) {
  signal?.throwIfAborted();
  const id = playerId ?? await discoverPlayerId(fetch2, signal);
  let entry = cache.get(id);
  cache.delete(id);
  if (!entry) {
    const created = prepare(id, fetch2);
    created.catch(() => cache.get(id) === created && cache.delete(id));
    entry = created;
  }
  cache.set(id, entry);
  for (const [oldId, old] of cache) {
    if (cache.size <= CACHE_LIMIT)
      break;
    cache.delete(oldId);
    old.then((player) => {
      const handle = handles.get(player);
      if (solver && handle !== void 0)
        call(solver, { kind: "drop", handle }).catch(ignore);
    }, ignore);
  }
  return abortable(entry, signal);
}
var DISCOVERY_TTL_MS = 10 * 60 * 1e3;
var discovery;
function discoverPlayerId(fetchFn, signal) {
  if (!discovery || Date.now() - discovery.at >= DISCOVERY_TTL_MS) {
    const id = fetchText(fetchFn, `${YOUTUBE_ORIGIN}/iframe_api`, {}, "YouTube iframe API").then((text2) => {
      const found = /player\\?\/([\da-f]{8})\\?\//u.exec(text2)?.[1];
      if (!found)
        throw new Error("No player ID in the iframe API script");
      return found;
    }).catch((cause) => {
      throw new YtdlError("PLAYER_SOLVE_FAILED", "Could not find the current player version", { cause });
    });
    const entry = { id, at: Date.now() };
    discovery = entry;
    id.catch(() => {
      if (discovery === entry)
        discovery = void 0;
    });
  }
  return abortable(discovery.id, signal);
}
var playerUrl = (id) => `${YOUTUBE_ORIGIN}/s/player/${encodeURIComponent(id)}/player_ias.vflset/en_US/base.js`;
async function prepare(id, fetchFn) {
  const source = await fetchText(fetchFn, playerUrl(id), {}, `YouTube player ${id}`).catch((cause) => {
    throw new YtdlError("PLAYER_SOLVE_FAILED", `Could not load player ${id}`, { cause });
  });
  const timestamp = /signatureTimestamp:(\d+)/u.exec(source)?.[1];
  if (!timestamp)
    throw new YtdlError("PLAYER_SOLVE_FAILED", `No signature timestamp in player ${id}`);
  const rpc = worker();
  const handle = ++nextHandle;
  await call(rpc, { kind: "load", handle, source }).catch((cause) => {
    throw new YtdlError("PLAYER_SOLVE_FAILED", `Could not prepare player ${id}`, { cause });
  });
  const player = {
    id,
    signatureTimestamp: Number(timestamp),
    solve: (urls) => solveUrls(rpc, id, handle, urls)
  };
  handles.set(player, handle);
  return player;
}
function target(format) {
  const params = format.signatureCipher === void 0 ? void 0 : new URLSearchParams(format.signatureCipher);
  const raw = params ? params.get("url") : format.url;
  if (!raw || !URL.canParse(raw))
    throw new YtdlError("PLAYER_SOLVE_FAILED", "Format has no valid URL");
  const url = new URL(raw);
  const sig = params?.get("s") ?? void 0;
  const segments = url.pathname.split("/");
  const pathN = url.searchParams.has("n") ? -1 : segments.indexOf("n") + 1;
  const n = url.searchParams.get("n") ?? (pathN > 0 ? segments[pathN] : void 0);
  return {
    url,
    segments,
    pathN,
    sigParam: params?.get("sp") ?? "signature",
    challenge: sig === void 0 && n === void 0 ? void 0 : { sig, n }
  };
}
var challengeKey = ({ sig, n }) => JSON.stringify([sig ?? null, n ?? null]);
async function solveUrls(rpc, id, handle, formats) {
  const targets = formats.map(target);
  const unique = /* @__PURE__ */ new Map();
  for (const { challenge } of targets)
    if (challenge)
      unique.set(challengeKey(challenge), challenge);
  let answers = /* @__PURE__ */ new Map();
  if (unique.size > 0) {
    const challenges = [...unique.values()];
    const solved = await call(rpc, { kind: "solve", handle, challenges }).catch((cause) => {
      throw new YtdlError("PLAYER_SOLVE_FAILED", `Could not solve URLs with player ${id}`, { cause });
    });
    answers = new Map([...unique.keys()].map((key, index) => [key, solved[index] ?? {}]));
  }
  return targets.map(({ url, segments, pathN, sigParam, challenge }) => {
    const solved = challenge && answers.get(challengeKey(challenge));
    if (solved?.sig !== void 0)
      url.searchParams.set(sigParam, solved.sig);
    if (solved?.n !== void 0) {
      if (pathN > 0) {
        segments[pathN] = solved.n;
        url.pathname = segments.join("/");
      } else
        url.searchParams.set("n", solved.n);
    }
    return url.toString();
  });
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/resolve.js
var BLOCK_PERIOD_MS = 10 * 60 * 1e3;
function planClients(config, blocked, now) {
  const rungs = config.clients.flatMap((client) => {
    const { account: account2 } = CLIENTS[client];
    if (account2 === "required")
      return config.cookie ? [{ client, signedIn: true }] : [];
    const anonymous = { client, signedIn: false };
    return account2 === "optional" && config.cookie ? [anonymous, { client, signedIn: true }] : [anonymous];
  });
  const isBlocked = (rung) => {
    const since = blocked.get(rung.client);
    return since !== void 0 && now - since < BLOCK_PERIOD_MS;
  };
  return [...rungs.filter((rung) => !isBlocked(rung)), ...rungs.filter(isBlocked)];
}
var DEFAULT_EXPIRY_MS = 5 * 60 * 60 * 1e3;
function expiry(urls, now) {
  for (const url of urls) {
    const expire = url === void 0 ? Number.NaN : Number(new URL(url).searchParams.get("expire"));
    if (Number.isFinite(expire) && expire > 0)
      return expire * 1e3;
  }
  return now + DEFAULT_EXPIRY_MS;
}
var records = (attempts) => attempts.map(({ client, signedIn, step, code, reason, cause }) => ({ client, signedIn, step, code, reason, cause }));
var RANK = {
  PRIVATE: 0,
  MEMBERS_ONLY: 1,
  PREMIUM_ONLY: 2,
  REGION_BLOCKED: 3,
  NOT_STARTED: 4,
  NOT_FOUND: 5,
  PLAYER_SOLVE_FAILED: 6,
  INVALID_STATE: 7,
  AGE_RESTRICTED: 8,
  AUTH_FAILED: 9,
  RATE_LIMITED: 10,
  BOT_CHECK: 11,
  REQUEST_FAILED: 12,
  NO_FORMAT: 13,
  INVALID_URL: 14,
  INVALID_ARGUMENT: 14,
  NO_CAPTIONS: 14
};
var credentialFailure = (attempt) => attempt.step === "po-token" || attempt.signedIn && attempt.code === "AUTH_FAILED";
var anonymousUnplayable = (attempt) => !attempt.signedIn && attempt.step === "playability" && attempt.code === "NO_FORMAT";
function highest(attempts) {
  const rank = Math.min(...attempts.map((attempt) => RANK[attempt.code]));
  const tied = attempts.filter((attempt) => RANK[attempt.code] === rank);
  return tied.find((attempt) => attempt.availableCountries || attempt.startTime) ?? tied[0];
}
function mostSpecific(attempts) {
  const verdicts = attempts.filter((attempt) => !credentialFailure(attempt));
  const verdict = highest(verdicts);
  return verdict?.code === "NO_FORMAT" && verdicts.some(anonymousUnplayable) ? verdict : highest(attempts);
}
function failure(attempts, best, videoId, account2, countries) {
  const code = best?.code ?? "NO_FORMAT";
  let message = `Could not play ${videoId}: ${best?.reason ?? "no client returned a playable answer"}`;
  if (code === "AGE_RESTRICTED" && !account2) {
    const sentence = /[.!?]$/u.test(message) ? message : `${message}.`;
    message = `${sentence} This video needs a signed-in, age-verified account: pass \`cookie\` to new Ytdl().`;
  }
  const allowed = best?.availableCountries ?? countries;
  return new YtdlError(code, message, {
    attempts: records(attempts),
    ...best?.startTime ? { startTime: best.startTime } : {},
    ...allowed ? { availableCountries: allowed } : {},
    ...best?.cause === void 0 ? {} : { cause: best.cause }
  });
}
var Resolver = class {
  #options;
  #blocked = /* @__PURE__ */ new Map();
  #auth;
  constructor(options) {
    this.#options = options;
    this.#auth = options.auth;
  }
  block(client) {
    this.#blocked.set(client, Date.now());
  }
  setAuth(auth) {
    this.#auth = auth;
    for (const client of this.#blocked.keys()) {
      if (CLIENTS[client].account !== "none")
        this.#blocked.delete(client);
    }
  }
  async resolve(videoId, options) {
    const { innertube, clients } = this.#options;
    const auth = this.#auth;
    const attempts = [];
    let rungs = planClients({ clients, cookie: auth !== void 0 }, this.#blocked, Date.now());
    if (options.prefer) {
      const preferred = options.prefer.flatMap((client) => rungs.filter((rung) => rung.client === client));
      rungs = [...preferred, ...rungs.filter((rung) => !preferred.includes(rung))];
    }
    for (const rung of rungs) {
      options.signal?.throwIfAborted();
      let replacedVisitor = false;
      for (; ; ) {
        const result = await this.#tryRung(rung, auth, videoId, options);
        if ("formats" in result)
          return { ...result, attempts: records(attempts) };
        if (result.code === "BOT_CHECK" && !rung.signedIn && !replacedVisitor) {
          replacedVisitor = true;
          if (await innertube.replaceVisitorData(result.visitorData, options.signal).then(() => true, () => false))
            continue;
        }
        attempts.push({ client: rung.client, signedIn: rung.signedIn, ...result });
        break;
      }
    }
    const best = mostSpecific(attempts);
    const countries = best?.code === "REGION_BLOCKED" && !best.availableCountries ? await this.#regionCountries(videoId, options.signal) : void 0;
    throw failure(attempts, best, videoId, auth !== void 0, countries);
  }
  async #regionCountries(videoId, signal) {
    const { innertube } = this.#options;
    const metadata = await innertube.visitorData(signal).then((visitor) => innertube.webMetadata(videoId, visitor, signal)).catch(() => void 0);
    signal?.throwIfAborted();
    return availableCountries(metadata);
  }
  async #tryRung(rung, auth, videoId, options) {
    const { innertube, getPoToken, playerId } = this.#options;
    const { signal } = options;
    const client = CLIENTS[rung.client];
    let step = "player";
    try {
      const player = client.needsPlayer ? await loadPlayer({ fetch: innertube.fetch, playerId, signal }) : void 0;
      step = "embed";
      const embed = client.embedded ? await innertube.embedContext(videoId, signal) : void 0;
      step = "visitor";
      const dataSyncId = rung.signedIn ? await auth?.dataSyncId(signal) : void 0;
      const visitor = dataSyncId ?? embed?.visitorData ?? await innertube.visitorData(signal);
      step = "po-token";
      const poToken = client.poToken ? await getPoToken({ contentBinding: videoId, client: rung.client, signal }) : void 0;
      step = "request";
      const authHeaders = rung.signedIn ? await auth?.headers(client.origin, signal) : void 0;
      const response = await innertube.player({
        client: rung.client,
        videoId,
        visitorData: visitor,
        signatureTimestamp: player?.signatureTimestamp,
        poToken,
        authHeaders,
        embed
      }, signal);
      const answeredAt = Date.now();
      const playability = classifyPlayability(response);
      if (!playability.ok) {
        const { ok: _, ...outcome } = playability;
        if (rung.signedIn && outcome.code === "BOT_CHECK") {
          return {
            step: "playability",
            code: "AUTH_FAILED",
            reason: `${outcome.reason} (signed-in request was treated as logged out)`
          };
        }
        return { step: "playability", ...outcome, visitorData: visitor };
      }
      const answeredId = at(response, "videoDetails", "videoId");
      if (answeredId !== videoId) {
        return {
          step: "request",
          code: "REQUEST_FAILED",
          reason: `${client.name} answered for another video (${String(answeredId)})`
        };
      }
      step = "formats";
      const isLive = at(response, "videoDetails", "isLive") === true;
      const hls = str(at(response, "streamingData", "hlsManifestUrl"));
      const raw = parseFormats(response, rung.client);
      if (!raw.some((format) => isPlayable(format.metadata)) && !(isLive && hls)) {
        return { step, code: "NO_FORMAT", reason: `${client.name} returned no downloadable format` };
      }
      const wanted = options.format;
      if (wanted && !wanted.isHLS) {
        const offered = raw.filter((format) => sameFormat(format.metadata, wanted));
        if (offered.length === 0) {
          return { step, code: "NO_FORMAT", reason: `${client.name} does not offer itag ${wanted.itag}` };
        }
        if (wanted.contentLength !== void 0 && !offered.some((format) => format.metadata.contentLength === wanted.contentLength)) {
          return { step, code: "NO_FORMAT", reason: `${client.name} serves another file as itag ${wanted.itag}` };
        }
      }
      step = "solve";
      const session = raw.some((format) => !format.url && !format.signatureCipher) ? sabrSession(response) : void 0;
      const signed = raw.filter((format) => format.url || format.signatureCipher);
      const inputs = [
        ...signed,
        ...hls ? [{ url: hls }] : [],
        ...session ? [{ url: session.url }] : []
      ];
      if (!player && inputs.some((input) => input.signatureCipher)) {
        throw new YtdlError("PLAYER_SOLVE_FAILED", `${client.name} sent ciphered formats but no player was loaded`);
      }
      const outputs = player ? await player.solve(inputs) : inputs.map((input) => input.url);
      const urls = new Map(signed.map((format, index) => [format, outputs[index]]));
      const hlsManifestUrl = hls ? outputs[signed.length] : void 0;
      const sabrUrl = session ? outputs.at(-1) : void 0;
      const formats = raw.map((format) => {
        const url = urls.get(format) ?? format.url;
        return { ...format.metadata, url: url && poToken ? withPoToken(url, poToken) : url };
      });
      const sabr = session && sabrUrl ? { ...session, url: sabrUrl } : void 0;
      return {
        client: rung.client,
        visitorData: dataSyncId ? void 0 : visitor,
        player: response,
        formats,
        hlsManifestUrl,
        sabr,
        expiresAt: expiry([...formats.map((format) => format.url), sabr?.url], Date.now()),
        playableAt: prerollEnd(response, answeredAt)
      };
    } catch (error) {
      signal?.throwIfAborted();
      return YtdlError.is(error) ? { step, code: error.code, reason: error.message, cause: error } : {
        step,
        code: "REQUEST_FAILED",
        reason: error instanceof Error ? error.message : String(error),
        cause: error
      };
    }
  }
};
function withPoToken(url, poToken) {
  const signed = new URL(url);
  signed.searchParams.set("pot", poToken);
  return signed.href;
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/po-token/index.js
var disposedError = () => new YtdlError("INVALID_STATE", "The PO token provider is disposed");
var WORKER_URL = new URL(import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js", import.meta.url);
async function createPoTokenProvider(options = {}) {
  const timeoutMs = options.timeoutMs ?? 3e4;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new YtdlError("INVALID_ARGUMENT", "timeoutMs must be a finite number above 0");
  }
  options.signal?.throwIfAborted();
  const fetchFn = timed(options.fetch ?? globalThis.fetch, timeoutMs);
  const requests = new AbortController();
  const requestSignal = options.signal ? AbortSignal.any([options.signal, requests.signal]) : requests.signal;
  let worker2;
  let disposed = false;
  const proxy = async (target2, request) => {
    let reply;
    try {
      const response = await fetchFn(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: requestSignal
      });
      reply = { type: "fetched", id: request.id, status: response.status, body: await response.arrayBuffer() };
    } catch (error) {
      reply = error instanceof Error ? { type: "fetched", id: request.id, error: error.message, name: error.name } : { type: "fetched", id: request.id, error: String(error), name: "Error" };
    }
    target2.post(reply, "body" in reply ? [reply.body] : []);
  };
  const start = () => {
    const started = startWorker(WORKER_URL, {
      onMessage: (message) => void proxy(started, message),
      onStop: () => {
        if (worker2 === started)
          worker2 = void 0;
      }
    });
    return started;
  };
  const mint = (contentBinding, signal) => {
    if (disposed)
      return Promise.reject(disposedError());
    if (signal?.aborted)
      return Promise.reject(signal.reason);
    worker2 ??= start();
    const minted = worker2.call(contentBinding).catch((cause) => {
      throw disposed ? disposedError() : new YtdlError("REQUEST_FAILED", "PO token minting failed", { cause });
    });
    return abortable(minted, signal);
  };
  const dispose = async () => {
    disposed = true;
    requests.abort(disposedError());
    options.signal?.removeEventListener("abort", disposeOnAbort);
    const stopping = worker2;
    worker2 = void 0;
    await stopping?.terminate();
  };
  const disposeOnAbort = () => void dispose();
  const getPoToken = async ({ contentBinding, signal }) => {
    if (typeof contentBinding !== "string" || contentBinding === "") {
      throw new YtdlError("INVALID_ARGUMENT", "A PO token needs a non-empty contentBinding");
    }
    const token = await mint(contentBinding, signal);
    if (typeof token !== "string")
      throw new YtdlError("REQUEST_FAILED", "The PO token worker returned no token");
    return token;
  };
  try {
    await mint(void 0, options.signal);
    options.signal?.throwIfAborted();
  } catch (error) {
    await dispose();
    throw error;
  }
  options.signal?.addEventListener("abort", disposeOnAbort, { once: true });
  return Object.assign(getPoToken, { dispose });
}
function lazyPoTokenProvider(options) {
  let provider;
  return async (request) => {
    provider ??= createPoTokenProvider(options).catch((error) => {
      provider = void 0;
      throw error;
    });
    return (await abortable(provider, request.signal))(request);
  };
}

// MediaDrop/node_modules/@distube/ytdl-core/dist/ytdl.js
var DEFAULT_TIMEOUT_MS = 3e4;
function account(cookie, clients, fetcher) {
  if (planClients({ clients, cookie: cookie !== void 0 }, /* @__PURE__ */ new Map(), 0).length === 0) {
    throw new YtdlError("INVALID_ARGUMENT", "every listed client needs a cookie this instance lacks");
  }
  return cookie === void 0 ? void 0 : new CookieAuth({ cookie, fetch: fetcher });
}
var Ytdl = class {
  #clients;
  #fetch;
  #innertube;
  #resolver;
  #delivery;
  constructor(options = {}) {
    if (options.getPoToken !== void 0 && typeof options.getPoToken !== "function") {
      throw new YtdlError("INVALID_ARGUMENT", "getPoToken must be a function");
    }
    if (options.fetch !== void 0 && typeof options.fetch !== "function") {
      throw new YtdlError("INVALID_ARGUMENT", "fetch must be a function");
    }
    if (options.utcOffsetMinutes !== void 0 && !Number.isInteger(options.utcOffsetMinutes)) {
      throw new YtdlError("INVALID_ARGUMENT", "utcOffsetMinutes must be an integer");
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new YtdlError("INVALID_ARGUMENT", "timeoutMs must be a finite number above 0");
    }
    const clients = options.clients ?? DEFAULT_CLIENTS;
    if (!Array.isArray(clients) || clients.length === 0 || new Set(clients).size !== clients.length || !clients.every((client) => Object.hasOwn(CLIENTS, client))) {
      throw new YtdlError("INVALID_ARGUMENT", "clients must list distinct Client values");
    }
    const fetcher = timed(consented(options.fetch ?? globalThis.fetch.bind(globalThis)), timeoutMs);
    const auth = account(options.cookie, clients, fetcher);
    this.#clients = clients;
    this.#fetch = fetcher;
    this.#innertube = new InnerTube({
      fetch: fetcher,
      lang: options.lang,
      country: options.country,
      utcOffsetMinutes: options.utcOffsetMinutes
    });
    const getPoToken = options.getPoToken ?? lazyPoTokenProvider({ fetch: options.fetch, timeoutMs });
    this.#resolver = new Resolver({
      innertube: this.#innertube,
      clients,
      auth,
      getPoToken,
      playerId: options.playerId
    });
    this.#delivery = {
      fetch: fetcher,
      resume: (request) => resumeInfo(this.#innertube, this.#resolver, request),
      mintPoToken: (info, signal) => getPoToken({ contentBinding: info.videoDetails.id, client: info.client, signal })
    };
  }
  /**
   * Signs lookups that start from now on in with `cookie`, in any form the `cookie` option takes, or signs them out
   * with `undefined`. Lookups already running finish with the previous cookie, and a running download or `Media` read
   * re-resolves with the new one. Forgets the blocks of clients that can sign in. Throws `INVALID_ARGUMENT` and keeps
   * the previous cookie when `cookie` is signed out, or when every listed client needs a cookie and it is `undefined`.
   */
  setCookie(cookie) {
    this.#resolver.setAuth(account(cookie, this.#clients, this.#fetch));
  }
  /**
   * Video details, related videos and formats whose URLs are ready to request. A channel's live URL,
   * such as `https://www.youtube.com/@NASA/live`, looks up the stream it plays now.
   */
  async getInfo(video, options = {}) {
    const id = await this.#videoId(getVideoTarget(video), options.signal);
    return lookupInfo(this.#innertube, this.#resolver, id, options.signal);
  }
  /**
   * Streams the format `chooseFormat` picks as a Node `Readable`. An unexpired info is used as is; otherwise the
   * video is looked up again, with an explicit `format` until a client offers that same file. `Readable.toWeb`
   * turns the stream into a web `ReadableStream`.
   */
  download(video, options = {}) {
    const target2 = typeof video === "string" ? getVideoTarget(video) : { id: video.videoDetails.id };
    return deliver(this.#delivery, (signal) => this.#prepare(target2, video, options, signal), options);
  }
  /**
   * One format of `info`, read as often as needed without another lookup. A read that re-resolves after a 403 or
   * an expired URL refreshes `Media#info`, and later reads start from it.
   */
  open(info, format) {
    return new Media(this.#delivery, info, chooseFormat(info.formats, { format }));
  }
  /**
   * YouTube's own text for one caption track, not parsed into cues. The format is `CaptionFormat.Vtt` unless
   * `format` says otherwise. `lang` must equal a track's `languageCode`, so `de` does not match `de-DE`.
   * YouTube's timedtext endpoint answers HTTP 429 after a few quick requests from one IP, which rejects with
   * `RATE_LIMITED` and is not retried, so cache the text.
   */
  async getCaptions(video, options = {}) {
    const { signal } = options;
    checkFormat(options.format);
    const info = this.#unexpired(video) ?? await this.getInfo(typeof video === "string" ? video : video.videoDetails.id, { signal });
    signal?.throwIfAborted();
    const track = chooseTrack(info.captionTracks, options.lang);
    const url = captionUrl(track, options.format ?? CaptionFormat.Vtt);
    return this.#innertube.text(url, { headers: userAgentHeader(info.client), signal }, "YouTube captions");
  }
  async search(query, options = {}) {
    checkQuery(query);
    const request = {
      limit: checkLimit(options.limit) ?? 20,
      safeSearch: checkSafeSearch(options.safeSearch),
      signal: options.signal
    };
    const type = checkSearchType(options.type);
    if (type === SearchType.Playlist)
      return searchPlaylists(this.#innertube, query, request);
    return type === SearchType.Song ? searchSongs(this.#innertube, query, request) : searchVideos(this.#innertube, query, request);
  }
  /**
   * A playlist by ID or by a YouTube URL with a `list` parameter, or a channel's uploads by channel ID or channel URL,
   * with its entries in playlist order across pages: all of them, or the first `limit`. Entries YouTube marks
   * unplayable are left out.
   */
  async getPlaylist(playlist, options = {}) {
    const target2 = getPlaylistTarget(playlist);
    const limit = checkLimit(options.limit) ?? Number.POSITIVE_INFINITY;
    const id = "id" in target2 ? target2.id : uploads(await this.#innertube.channelId(target2.channel, options.signal));
    return browsePlaylist(this.#innertube, id, limit, options.signal);
  }
  /**
   * The related videos `getInfo` returns as `relatedVideos`, from one `next` request and no player lookup.
   * With `music`, the video's YouTube Music radio instead, without the video itself, artists as `author`. YouTube Music
   * builds the radio for each request, so two calls can return different entries and orders.
   * Takes the same input as {@link getInfo}.
   */
  async getRelated(video, options = {}) {
    const target2 = getVideoTarget(video);
    const music = checkMusic(options.music);
    const radioSeed = checkRadioSeed(options.radioSeed, music);
    const id = await this.#videoId(target2, options.signal);
    if (music)
      return musicRadio(this.#innertube, id, radioSeed ?? id, options.signal);
    const visitor = await this.#innertube.visitorData(options.signal);
    return relatedVideos(await this.#innertube.next(id, visitor, options.signal));
  }
  /**
   * The video as YouTube Music lists it, from one `next` request and no player lookup: its title, its artists as
   * `author`, its listed length and YouTube Music's art. Rejects `NOT_FOUND` when YouTube Music lists no entry for it.
   * Takes the same input as {@link getInfo}.
   */
  async getSong(video, options = {}) {
    const id = await this.#videoId(getVideoTarget(video), options.signal);
    return musicSong(this.#innertube, id, options.signal);
  }
  /**
   * YouTube's autocomplete completions for `query`, or YouTube Music's with `music`, in provider order, asked in the
   * instance's `lang` and `country`. YouTube Music's song and artist suggestions are left out.
   */
  async getSuggestions(query, options = {}) {
    checkQuery(query);
    return checkMusic(options.music) ? fetchMusicSuggestions(this.#innertube, query, options.signal) : fetchSuggestions(this.#innertube, query, options.signal);
  }
  #unexpired(video) {
    return typeof video !== "string" && video.expiresAt > Date.now() + 6e4 ? video : void 0;
  }
  #videoId(target2, signal) {
    return "id" in target2 ? target2.id : this.#innertube.channelLiveVideo(target2.channelLive, signal);
  }
  async #prepare(target2, video, options, signal) {
    const { format } = options;
    if (format && typeof video !== "string")
      chooseFormat(video.formats, { format });
    const info = this.#unexpired(video) ?? await lookupInfo(this.#innertube, this.#resolver, await this.#videoId(target2, signal), signal, format);
    return { info, format: chooseFormat(info.formats, options) };
  }
};

// MediaDrop/netlify/functions/download.mjs
var download_default = async (req, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  try {
    const requestUrl = new URL(req.url);
    const targetUrl = requestUrl.searchParams.get("url");
    const format = (requestUrl.searchParams.get("format") || "mp3").toLowerCase();
    const quality = requestUrl.searchParams.get("quality") || "max";
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }
    const ytdl = new Ytdl();
    let processUrl = targetUrl;
    if (targetUrl.includes("spotify.com")) {
      const title = requestUrl.searchParams.get("title") || "";
      const author2 = requestUrl.searchParams.get("author") || "";
      const query = `${title} ${author2}`.trim();
      if (query) {
        processUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      }
    }
    const info = await ytdl.getInfo(processUrl);
    const rawTitle = info.videoDetails.title || "media";
    const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "-").trim();
    const fileExt = format === "mp3" ? "mp3" : "mp4";
    const fileName = `${safeTitle}.${fileExt}`;
    const encodedFileName = encodeURIComponent(fileName);
    let selectedFormat;
    if (format === "mp3") {
      selectedFormat = chooseFormat(info.formats, { quality: "highestaudio" });
    } else {
      selectedFormat = chooseFormat(info.formats, { quality: "highestvideo" });
    }
    if (!selectedFormat || !selectedFormat.url) {
      throw new Error("No compatible stream format found");
    }
    const stream = await ytdl.download(processUrl, {
      format: selectedFormat
    });
    return new Response(stream, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": format === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename="${safeTitle}.${fileExt}"; filename*=UTF-8''${encodedFileName}`
      }
    });
  } catch (err) {
    console.error("Netlify Function Download Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Cloud download failed" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
};
export {
  download_default as default
};
