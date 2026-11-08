(function () {
  const TEXT_FRAMES = {
    title: 'TIT2',
    artist: 'TPE1',
    album: 'TALB',
    albumArtist: 'TPE2',
    genre: 'TCON',
    year: 'TDRC',
    track: 'TRCK',
    disc: 'TPOS',
    composer: 'TCOM',
    comment: 'COMM'
  };
  const FRAME_FIELDS = Object.fromEntries(Object.entries(TEXT_FRAMES).map(([key, value]) => [value, key]));
  const INFO_FIELDS = {
    INAM: 'title',
    IART: 'artist',
    IPRD: 'album',
    ICRD: 'year',
    ITRK: 'track',
    IGNR: 'genre',
    ICMT: 'comment'
  };
  const INFO_IDS = Object.fromEntries(Object.entries(INFO_FIELDS).map(([key, value]) => [value, key]));
  const encoder = new TextEncoder();

  function bytesOf(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (Array.isArray(value)) return Uint8Array.from(value);
    throw new TypeError('Audio data must be a byte array.');
  }

  function readSynchsafe(bytes, offset) {
    return ((bytes[offset] & 0x7f) << 21) |
      ((bytes[offset + 1] & 0x7f) << 14) |
      ((bytes[offset + 2] & 0x7f) << 7) |
      (bytes[offset + 3] & 0x7f);
  }

  function writeSynchsafe(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff) {
      throw new Error('The ID3 tag is too large.');
    }
    return Uint8Array.of((value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f);
  }

  function readUint32BE(bytes, offset) {
    return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
  }

  function readUint32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function writeUint32LE(value) {
    return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
  }

  function joinBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function decodeText(data, encoding) {
    try {
      if (encoding === 1) return new TextDecoder('utf-16').decode(data).replace(/\u0000+$/g, '');
      if (encoding === 2) return new TextDecoder('utf-16be').decode(data).replace(/\u0000+$/g, '');
      if (encoding === 3) return new TextDecoder('utf-8').decode(data).replace(/\u0000+$/g, '');
      return new TextDecoder('windows-1252').decode(data).replace(/\u0000+$/g, '');
    } catch (_) {
      return new TextDecoder().decode(data).replace(/\u0000+$/g, '');
    }
  }

  function findTextTerminator(bytes, start, encoding) {
    if (encoding === 1 || encoding === 2) {
      for (let i = start; i + 1 < bytes.length; i += 1) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
      }
    } else {
      for (let i = start; i < bytes.length; i++) if (bytes[i] === 0) return i;
    }
    return bytes.length;
  }

  function decodeTextFrame(frameId, data) {
    if (!data.length) return '';
    const encoding = data[0];
    if (frameId === 'COMM' || frameId === 'USLT') {
      if (data.length < 4) return '';
      const descriptionStart = 4;
      const descriptionEnd = findTextTerminator(data, descriptionStart, encoding);
      const contentStart = descriptionEnd + ((encoding === 1 || encoding === 2) ? 2 : 1);
      return decodeText(data.subarray(contentStart), encoding).trim();
    }
    return decodeText(data.subarray(1), encoding).split('\u0000').map(value => value.trim()).filter(Boolean).join(' / ');
  }

  function parsePicture(data) {
    if (data.length < 5) return null;
    const encoding = data[0];
    let mimeEnd = 1;
    while (mimeEnd < data.length && data[mimeEnd] !== 0) mimeEnd++;
    if (mimeEnd + 1 >= data.length) return null;
    const mime = decodeText(data.subarray(1, mimeEnd), 0) || 'application/octet-stream';
    const pictureType = data[mimeEnd + 1];
    const descriptionStart = mimeEnd + 2;
    const descriptionEnd = findTextTerminator(data, descriptionStart, encoding);
    const dataStart = Math.min(data.length, descriptionEnd + ((encoding === 1 || encoding === 2) ? 2 : 1));
    const image = data.subarray(dataStart);
    if (!image.length) return null;
    return {
      mime,
      type: pictureType,
      description: decodeText(data.subarray(descriptionStart, descriptionEnd), encoding),
      data: new Uint8Array(image)
    };
  }

  function parseID3(bytes, offset = 0) {
    if (offset + 10 > bytes.length || bytes[offset] !== 0x49 || bytes[offset + 1] !== 0x44 || bytes[offset + 2] !== 0x33) return null;
    const major = bytes[offset + 3];
    if (major !== 2 && major !== 3 && major !== 4) return null;
    const tagSize = readSynchsafe(bytes, offset + 6);
    const tagEnd = offset + 10 + tagSize;
    if (tagEnd > bytes.length) return null;
    const flags = bytes[offset + 5];
    let body = bytes.subarray(offset + 10, tagEnd);
    if (flags & 0x40) {
      if (major === 3) {
        if (body.length < 4) return null;
        const extendedSize = readUint32BE(body, 0);
        body = body.subarray(4 + extendedSize);
      } else if (major === 4) {
        if (body.length < 4) return null;
        const extendedSize = readSynchsafe(body, 0);
        body = body.subarray(extendedSize);
      }
    }
    if (flags & 0x80) {
      const decoded = new Uint8Array(body.length);
      let count = 0;
      for (let i = 0; i < body.length; i++) {
        decoded[count++] = body[i];
        if (body[i] === 0xff && body[i + 1] === 0) i++;
      }
      body = decoded.subarray(0, count);
    }

    const frames = [];
    const tags = {};
    let picture = null;
    let cursor = 0;
    const headerSize = major === 2 ? 6 : 10;
    while (cursor + headerSize <= body.length) {
      let id, size;
      if (major === 2) {
        id = String.fromCharCode(body[cursor], body[cursor + 1], body[cursor + 2]);
        size = (body[cursor + 3] << 16) | (body[cursor + 4] << 8) | body[cursor + 5];
      } else {
        id = String.fromCharCode(body[cursor], body[cursor + 1], body[cursor + 2], body[cursor + 3]);
        size = major === 4 ? readSynchsafe(body, cursor + 4) : readUint32BE(body, cursor + 4);
      }
      if (!/^[A-Z0-9]{3,4}$/.test(id) || size <= 0) break;
      const dataStart = cursor + headerSize;
      const dataEnd = dataStart + size;
      if (dataEnd > body.length) break;
      const data = body.subarray(dataStart, dataEnd);
      const normalizedId = major === 2 ? ({ TT2: 'TIT2', TP1: 'TPE1', TAL: 'TALB', TP2: 'TPE2', TCO: 'TCON', TRK: 'TRCK', TYE: 'TYER', PIC: 'APIC' }[id] || id) : id;
      const frame = { id: normalizedId, data: new Uint8Array(data), originalId: id };
      frames.push(frame);
      const field = FRAME_FIELDS[normalizedId] || (normalizedId === 'TYER' ? 'year' : null);
      if (field) tags[field] = decodeTextFrame(normalizedId, data);
      else if (normalizedId === 'APIC' && !picture) picture = parsePicture(data);
      cursor = dataEnd;
    }
    return { tags, picture, frames, major, end: tagEnd };
  }

  function parseInfoList(bytes, start, end) {
    const values = {};
    if (end - start < 4 || String.fromCharCode(...bytes.subarray(start, start + 4)) !== 'INFO') return values;
    let cursor = start + 4;
    while (cursor + 8 <= end) {
      const id = String.fromCharCode(...bytes.subarray(cursor, cursor + 4));
      const size = readUint32LE(bytes, cursor + 4);
      const dataStart = cursor + 8;
      const dataEnd = dataStart + size;
      if (dataEnd > end) break;
      const field = INFO_FIELDS[id];
      if (field) values[field] = decodeText(bytes.subarray(dataStart, dataEnd), 0).trim();
      cursor = dataEnd + (size & 1);
    }
    return values;
  }

  function parseWav(bytes) {
    if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...bytes.subarray(8, 12)) !== 'WAVE') {
      throw new Error('This WAV file is not a supported RIFF/WAVE file.');
    }
    const id3Tags = [];
    const infoTags = {};
    const chunks = [];
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      const size = readUint32LE(bytes, offset + 4);
      const dataStart = offset + 8;
      const dataEnd = dataStart + size;
      if (dataEnd > bytes.length) throw new Error('The WAV file contains an incomplete RIFF chunk.');
      const data = bytes.subarray(dataStart, dataEnd);
      if (id === 'ID3 ' || id === 'id3 ' || id === 'id3') {
        const tag = parseID3(data, 0);
        if (tag) id3Tags.push(tag);
      } else if (id === 'LIST') {
        Object.assign(infoTags, parseInfoList(bytes, dataStart, dataEnd));
      }
      chunks.push({ id, data: new Uint8Array(data) });
      offset = dataEnd + (size & 1);
    }
    if (offset !== bytes.length && offset > bytes.length) throw new Error('The WAV file has invalid RIFF chunk alignment.');
    const primary = id3Tags[0] || { tags: {}, picture: null, frames: [], major: 4 };
    return {
      tags: { ...infoTags, ...primary.tags },
      picture: primary.picture,
      frames: primary.frames,
      version: primary.major,
      chunks
    };
  }

  function read(value, kind) {
    const bytes = bytesOf(value);
    const isWav = kind === 'wav' || (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF');
    if (isWav) {
      const parsed = parseWav(bytes);
      return { ...parsed, format: 'wav' };
    }
    const parsed = parseID3(bytes, 0) || { tags: {}, picture: null, frames: [], major: 4, end: 0 };
    return { ...parsed, format: 'mp3' };
  }

  function encodeFrame(id, data) {
    if (!/^[A-Z0-9]{4}$/.test(id)) throw new Error('Invalid ID3 frame: ' + id);
    return joinBytes([encoder.encode(id), writeSynchsafe(data.length), Uint8Array.of(0, 0), data]);
  }

  function encodeTextFrame(id, value) {
    const text = String(value || '').trim();
    if (!text) return null;
    return encodeFrame(id, joinBytes([Uint8Array.of(3), encoder.encode(text)]));
  }

  function encodeCommentFrame(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    return encodeFrame('COMM', joinBytes([Uint8Array.of(3), encoder.encode('eng'), Uint8Array.of(0), encoder.encode(text)]));
  }

  function encodePictureFrame(picture) {
    if (!picture?.data?.length) return null;
    const mime = String(picture.mime || 'image/jpeg').split(/[;\s]/)[0].toLowerCase();
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(mime)) throw new Error('Album artwork must be JPEG, PNG, WebP, or GIF.');
    return encodeFrame('APIC', joinBytes([
      Uint8Array.of(3),
      encoder.encode(mime),
      Uint8Array.of(0, 3, 0),
      bytesOf(picture.data)
    ]));
  }

  function buildID3(metadata, priorFrames, picture, replacePicture) {
    const frames = [];
    const replacedIds = new Set(['TIT2', 'TPE1', 'TALB', 'TPE2', 'TCON', 'TDRC', 'TYER', 'TRCK', 'TPOS', 'TCOM', 'COMM']);
    for (const frame of priorFrames || []) {
      if (replacedIds.has(frame.id)) continue;
      if (frame.id === 'APIC' && replacePicture) continue;
      frames.push(encodeFrame(frame.id, frame.data));
    }
    for (const [field, frameId] of Object.entries(TEXT_FRAMES)) {
      if (field === 'comment') {
        const frame = encodeCommentFrame(metadata[field]);
        if (frame) frames.push(frame);
      } else {
        const frame = encodeTextFrame(frameId, metadata[field]);
        if (frame) frames.push(frame);
      }
    }
    if (metadata.year && !frames.some(frame => String.fromCharCode(...frame.subarray(0, 4)) === 'TDRC')) {
      const frame = encodeTextFrame('TDRC', metadata.year);
      if (frame) frames.push(frame);
    }
    const coverFrame = encodePictureFrame(picture);
    if (coverFrame) frames.push(coverFrame);
    const body = joinBytes(frames);
    return joinBytes([
      encoder.encode('ID3'),
      Uint8Array.of(4, 0, 0),
      writeSynchsafe(body.length),
      body
    ]);
  }

  function writeMp3(value, metadata, parsed, picture, replacePicture) {
    const bytes = bytesOf(value);
    const tag = buildID3(metadata, parsed.frames, picture, replacePicture);
    const audioOffset = parsed.end || 0;
    const audio = bytes.subarray(audioOffset);
    return joinBytes([tag, audio]);
  }

  function buildChunk(id, data) {
    return joinBytes([encoder.encode(id), writeUint32LE(data.length), data, data.length & 1 ? Uint8Array.of(0) : new Uint8Array()]);
  }

  function updateInfoChunk(oldData, metadata) {
    const preserved = [];
    const fields = new Map();
    const view = oldData.subarray(0, 4);
    if (String.fromCharCode(...view) === 'INFO') {
      let cursor = 4;
      while (cursor + 8 <= oldData.length) {
        const id = String.fromCharCode(...oldData.subarray(cursor, cursor + 4));
        const size = readUint32LE(oldData, cursor + 4);
        const dataStart = cursor + 8;
        const dataEnd = dataStart + size;
        if (dataEnd > oldData.length) break;
        if (!INFO_FIELDS[id]) preserved.push(buildChunk(id, oldData.slice(dataStart, dataEnd)));
        cursor = dataEnd + (size & 1);
      }
    }
    for (const [field, id] of Object.entries(INFO_IDS)) {
      const value = String(metadata[field] || '').trim();
      if (value) fields.set(id, encoder.encode(value + '\0'));
    }
    const chunks = [...preserved, ...[...fields].map(([id, value]) => buildChunk(id, value))];
    if (!chunks.length) return null;
    return joinBytes([encoder.encode('INFO'), ...chunks]);
  }

  function writeWav(value, metadata, parsed, picture, replacePicture) {
    const bytes = bytesOf(value);
    if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...bytes.subarray(8, 12)) !== 'WAVE') {
      throw new Error('This WAV file is not a supported RIFF/WAVE file.');
    }
    const id3 = buildID3(metadata, parsed.frames, picture, replacePicture);
    const chunks = [];
    let existingInfo = null;
    for (const chunk of parsed.chunks || []) {
      if (chunk.id === 'ID3 ' || chunk.id === 'id3 ' || chunk.id === 'id3') continue;
      if (chunk.id === 'LIST' && String.fromCharCode(...chunk.data.subarray(0, 4)) === 'INFO') {
        if (existingInfo) continue;
        existingInfo = chunk.data;
        continue;
      }
      chunks.push(buildChunk(chunk.id, chunk.data));
    }
    const info = updateInfoChunk(existingInfo || new Uint8Array(), metadata);
    if (info) chunks.push(buildChunk('LIST', info));
    if (id3.length > 10) chunks.push(buildChunk('ID3 ', id3));
    const body = joinBytes([encoder.encode('WAVE'), ...chunks]);
    if (body.length > 0xffffffff) throw new Error('The updated WAV file exceeds the RIFF 4 GB size limit.');
    return joinBytes([encoder.encode('RIFF'), writeUint32LE(body.length), body]);
  }

  function write(value, metadata, parsed, options = {}) {
    const format = options.format || parsed?.format || 'mp3';
    const replacePicture = !!options.replacePicture;
    const picture = options.picture || null;
    return format === 'wav'
      ? writeWav(value, metadata || {}, parsed || { frames: [], chunks: [] }, picture, replacePicture)
      : writeMp3(value, metadata || {}, parsed || { frames: [], end: 0 }, picture, replacePicture);
  }

  function readImageMime(data) {
    const bytes = bytesOf(data);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
    if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)).startsWith('GIF8')) return 'image/gif';
    return 'application/octet-stream';
  }

  window.EditorAudioTags = {
    read,
    write,
    readImageMime,
    parseID3,
    parseWav,
    _internals: { buildID3, buildChunk, safe: true }
  };
})();