const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');

const html = fs.readFileSync(`${__dirname}/amc8_practice.html`, 'utf8');
const bank = JSON.parse(html.match(/<script id="exam-bank" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const imagePattern = /<img\b(?:[^>'"]|"[^"]*"|'[^']*')*>/g;
const attributes = tag => Object.fromEntries(Array.from(
  tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g),
  match => [match[1], match[2] ?? match[3]]
));

test('every problem and solution embeds diagrams without AoPS file links', () => {
  let diagrams = 0;
  for (const problem of bank) {
    for (const field of ['html', 'solution']) {
      const markup = problem[field];
      const label = `${problem.id} ${field}`;
      assert.doesNotMatch(markup, /<a\b[^>]*href=["'][^"']*(?:File:|wiki\/images)/i, label);
      assert.doesNotMatch(markup, /<a\b[^>]*>\s*<img\b/i, `${label}: diagrams must display directly`);
      for (const tag of markup.match(imagePattern) || []) {
        const { src, alt } = attributes(tag);
        assert.ok(src, `${label}: image source is missing`);
        const diagram = /\[asy\]|diagram/i.test(alt || '') || !src.startsWith('https://latex.artofproblemsolving.com/');
        if (!diagram) continue;
        diagrams++;
        assert.match(src, /^data:image\/(?:png|jpeg|svg\+xml);base64,/, `${label}: diagram must be embedded`);
        assert.ok(alt, `${label}: diagram needs alternate text`);
      }
    }
  }
  assert.ok(diagrams > 400, 'audit must cover the full diagram bank');
});

test('embedded diagrams contain valid self-contained image data', () => {
  const sources = new Set(Array.from(html.matchAll(/data:image\/(png|jpeg|svg\+xml);base64,([A-Za-z0-9+/=]+)/g), m => `${m[1]},${m[2]}`));
  for (const source of sources) {
    const [mime, encoded] = source.split(',');
    const bytes = Buffer.from(encoded, 'base64');
    assert.equal(bytes.toString('base64'), encoded, 'base64 must round-trip');
    if (mime === 'png') {
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      const chunks = [];
      let offset = 8, ended = false;
      while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        assert.ok(offset + length + 12 <= bytes.length, 'PNG chunk must be complete');
        if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
        if (type === 'IEND') ended = true;
        offset += length + 12;
      }
      assert.ok(ended, 'PNG must have an end chunk');
      assert.ok(zlib.inflateSync(Buffer.concat(chunks)).length > 0, 'PNG pixels must decompress');
    } else if (mime === 'svg+xml') {
      const svg = bytes.toString('utf8');
      assert.match(svg, /<svg\b[\s\S]*<\/svg>\s*$/);
      assert.doesNotMatch(svg, /<(?:script|foreignObject)\b|(?:xlink:)?href=["'](?!#)|url\(\s*(?!#)/i, 'SVG must have no active content or external dependencies');
    } else {
      assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
      assert.equal(bytes.subarray(-2).toString('hex'), 'ffd9');
    }
  }
});

test('diagram choices remain labeled A through E for the 2003 visual questions', () => {
  for (const number of [23, 24]) {
    const problem = bank.find(p => p.id === `exam-2003-${number}`);
    assert.deepEqual(Array.from(problem.html.matchAll(/<figcaption>\(([A-E])\)<\/figcaption>/g), m => m[1]), [...'ABCDE']);
  }
});
