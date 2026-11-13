// Shared by the dashboard scripts: reads .env, and reads video sizes from MP4 headers.
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';

export const ROOT = new URL('..', import.meta.url);

if (existsSync(new URL('.env', ROOT))) process.loadEnvFile(new URL('.env', ROOT));

// Width, height and running time read from the MP4 header (moov → mvhd / tkhd), wherever the moov box sits in the file.
export const probe = (path) => {
  const fd = openSync(path, 'r');
  const size = statSync(path).size;
  const read = (pos, len) => {
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, pos);
    return buf;
  };
  const boxes = (start, end, cb) => {
    let pos = start;
    while (pos + 8 <= end) {
      const head = read(pos, 16);
      let len = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      let headLen = 8;
      if (len === 1) {
        len = Number(head.readBigUInt64BE(8));
        headLen = 16;
      } else if (len === 0) len = end - pos;
      if (len < 8) break;
      cb(type, pos + headLen, pos + len);
      pos += len;
    }
  };
  const out = { width: 0, height: 0, duration: 0 };
  try {
    boxes(0, size, (type, start, end) => {
      if (type !== 'moov') return;
      boxes(start, end, (t, s, e) => {
        if (t === 'mvhd') {
          const b = read(s, 32);
          const v1 = b[0] === 1;
          const timescale = v1 ? b.readUInt32BE(20) : b.readUInt32BE(12);
          const duration = v1 ? Number(b.readBigUInt64BE(24)) : b.readUInt32BE(16);
          out.duration = timescale ? Math.round(duration / timescale) : 0;
        }
        if (t === 'trak') {
          boxes(s, e, (tt, ts, te) => {
            if (tt !== 'tkhd' || out.width) return;
            const b = read(ts, te - ts);
            const w = b.readUInt32BE(b.length - 8) / 65536;
            const h = b.readUInt32BE(b.length - 4) / 65536;
            if (w && h) Object.assign(out, { width: Math.round(w), height: Math.round(h) });
          });
        }
      });
    });
  } finally {
    closeSync(fd);
  }
  return out;
};

