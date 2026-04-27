const encoder = new TextEncoder();

function toBytes(value: string | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return encoder.encode(value);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value & 0xffff, true);
  return offset + 2;
}

function writeU32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value >>> 0, true);
  return offset + 4;
}

function msDosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = Math.floor(date.getSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hour << 11) | (minute << 5) | second,
  };
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function createZipBuffer(entries: Record<string, string | Uint8Array>): Uint8Array {
  const files = Object.entries(entries)
    .filter(([name]) => !!name)
    .sort(([a], [b]) => a.localeCompare(b));

  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  const now = msDosDateTime(new Date());

  for (const [nameRaw, value] of files) {
    const name = nameRaw.replace(/^\/+/, '');
    const nameBytes = toBytes(name);
    const content = toBytes(value);
    const checksum = crc32(content);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    let o = 0;
    o = writeU32(localView, o, 0x04034b50);
    o = writeU16(localView, o, 20);
    o = writeU16(localView, o, 0);
    o = writeU16(localView, o, 0);
    o = writeU16(localView, o, now.time);
    o = writeU16(localView, o, now.date);
    o = writeU32(localView, o, checksum);
    o = writeU32(localView, o, content.length);
    o = writeU32(localView, o, content.length);
    o = writeU16(localView, o, nameBytes.length);
    o = writeU16(localView, o, 0);
    localHeader.set(nameBytes, o);

    localChunks.push(localHeader, content);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    o = 0;
    o = writeU32(centralView, o, 0x02014b50);
    o = writeU16(centralView, o, 0x0314);
    o = writeU16(centralView, o, 20);
    o = writeU16(centralView, o, 0);
    o = writeU16(centralView, o, 0);
    o = writeU16(centralView, o, now.time);
    o = writeU16(centralView, o, now.date);
    o = writeU32(centralView, o, checksum);
    o = writeU32(centralView, o, content.length);
    o = writeU32(centralView, o, content.length);
    o = writeU16(centralView, o, nameBytes.length);
    o = writeU16(centralView, o, 0);
    o = writeU16(centralView, o, 0);
    o = writeU16(centralView, o, 0);
    o = writeU16(centralView, o, 0);
    o = writeU32(centralView, o, 0);
    o = writeU32(centralView, o, localOffset);
    centralHeader.set(nameBytes, o);

    centralChunks.push(centralHeader);
    localOffset += localHeader.length + content.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  let p = 0;
  p = writeU32(eocdView, p, 0x06054b50);
  p = writeU16(eocdView, p, 0);
  p = writeU16(eocdView, p, 0);
  p = writeU16(eocdView, p, files.length);
  p = writeU16(eocdView, p, files.length);
  p = writeU32(eocdView, p, centralSize);
  p = writeU32(eocdView, p, localOffset);
  writeU16(eocdView, p, 0);

  return concatChunks([...localChunks, ...centralChunks, eocd]);
}

export function createZipBlob(entries: Record<string, string | Uint8Array>): Blob {
  const buffer = createZipBuffer(entries);
  return new Blob([buffer], { type: 'application/zip' });
}
