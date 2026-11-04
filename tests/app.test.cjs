'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'BioBuzz_Scoop_Generator.html'), 'utf8');
const example = name => JSON.parse(fs.readFileSync(path.join(root, 'examples', name), 'utf8'));

// Run the complete application script without modifying its private functions.
// Capture the same downloaded Blobs and file-input events used by the browser.
function openApp() {
  const controls = new Map(), downloads = [], blobs = new Map(), timers = [];
  const drawing = new Proxy({}, { get: () => () => {} });
  const element = () => ({
    value: '', min: '', max: '', options: [], files: [], textContent: '',
    classList: { toggle() {} }, listeners: {},
    addEventListener(event, handler) { this.listeners[event] = handler; },
    getContext(type) { return type === '2d' ? drawing : null; },
    clientWidth: 800, clientHeight: 460,
    setPointerCapture() {}, click() {}, remove() {}
  });
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) controls.set(match[1], element());
  for (const match of html.matchAll(/<input\b([^>]+)>/g)) {
    const attrs = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    if (attrs.id) Object.assign(controls.get(attrs.id), {
      value: attrs.value || '', min: attrs.min || '', max: attrs.max || ''
    });
  }
  for (const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const control = controls.get(match[1]);
    control.options = [...match[2].matchAll(/<option value="([^"]+)"([^>]*)>/g)]
      .map(m => ({ value: m[1], selected: /\bselected\b/.test(m[2]) }));
    control.value = (control.options.find(o => o.selected) || control.options[0]).value;
  }
  const document = {
    getElementById: id => controls.get(id),
    body: { append() {}, appendChild() {} },
    createElement() {
      return { remove() {}, click() {
        downloads.push({ name: this.download, blob: blobs.get(this.href) });
      } };
    }
  };
  const context = vm.createContext({
    document, Blob, TextEncoder, devicePixelRatio: 1,
    window: { addEventListener() {} },
    URL: {
      createObjectURL(blob) { const key = `blob:test-${blobs.size}`; blobs.set(key, blob); return key; },
      revokeObjectURL() {}
    },
    setTimeout(fn, ms) { if (ms <= 160) timers.push(fn); return timers.length; },
    clearTimeout() {}
  });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(script, { filename: 'BioBuzz_Scoop_Generator.html' }).runInContext(context);
  assert.equal(controls.get('download').disabled, false, 'default configuration must load');
  return {
    controls, downloads,
    async fire(id, event) {
      await controls.get(id).listeners[event]();
      while (timers.length) await timers.shift()();
    },
    async import(doc) {
      const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
      controls.get('settingsFile').files = [{ name: 'settings.json', size: Buffer.byteLength(text), text: async () => text }];
      await this.fire('settingsFile', 'change');
    },
    async export() {
      await this.fire('exportSettings', 'click');
      const download = downloads.at(-1);
      assert.match(download.name, /\.json$/);
      return JSON.parse(await download.blob.text());
    }
  };
}

test('all 15 settings export, import, and round trip', async () => {
  const app = openApp();
  assert.deepEqual((await app.export()).settings, example('default-settings.json').settings);
  const shared = example('120-to-60-20mm-settings.json');
  await app.import(shared);
  assert.match(app.controls.get('settingsStatus').textContent, /Restored all 15 settings/);
  assert.equal(app.controls.get('actual-size').textContent, '140 × 120 × 150');
  const exported = await app.export();
  assert.equal(exported.format, shared.format);
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.units, 'mm');
  assert.ok(Number.isFinite(Date.parse(exported.exportedAt)));
  assert.deepEqual(exported.settings, shared.settings);
  await app.import(example('default-settings.json'));
  await app.import(exported);
  assert.deepEqual((await app.export()).settings, shared.settings);
});

test('bad imports retain the previous settings, including geometry rollback', async () => {
  const app = openApp();
  const valid = example('120-to-60-20mm-settings.json');
  await app.import(valid);
  const cases = [
    '{broken json',
    { ...valid, format: 'other-format' },
    { ...valid, schemaVersion: 99 },
    { ...valid, settings: { ...valid.settings, width: -1 } },
    { ...valid, settings: { ...valid.settings, step: 0.7 } },
    { ...valid, settings: { ...valid.settings, preset: 'unknown' } },
    { ...valid, settings: { ...valid.settings, angle: '65' } },
    // Individually allowed values that violate the pitch/hole relationship.
    { ...valid, settings: { ...valid.settings, pitch: 6, hole: 8 } },
    { ...valid, settings: {} }
  ];
  for (const bad of cases) {
    await app.import(bad);
    assert.match(app.controls.get('settingsStatus').textContent, /^Import failed:/);
    assert.equal(app.controls.get('download').disabled, false);
    assert.deepEqual((await app.export()).settings, valid.settings);
  }
});

for (const name of ['default-settings.json', '120-to-60-20mm-settings.json']) {
  test(`binary STL has finite vertices and expected bounds: ${name}`, async () => {
    const app = openApp(), config = example(name);
    await app.import(config);
    await app.fire('download', 'click');
    const download = app.downloads.at(-1);
    assert.match(download.name, /\.stl$/);
    const bytes = Buffer.from(await download.blob.arrayBuffer());
    const triangles = bytes.readUInt32LE(80);
    assert.ok(triangles > 100);
    assert.equal(bytes.length, 84 + triangles * 50);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < triangles; i++) {
      const start = 84 + i * 50;
      for (let j = 0; j < 12; j++) assert.ok(Number.isFinite(bytes.readFloatLE(start + j * 4)));
      for (let vertex = 0; vertex < 3; vertex++) for (let axis = 0; axis < 3; axis++) {
        const value = bytes.readFloatLE(start + 12 + vertex * 12 + axis * 4);
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
    const s = config.settings;
    const expected = [s.length + s.entryExtension, Math.max(s.width, s.exitWidth), s.height];
    expected.forEach((bound, axis) => assert.ok(Math.abs(max[axis] - min[axis] - bound) < 0.01));
    assert.ok(Math.abs(min[0] + s.entryExtension) < 0.01);
    assert.ok(Math.abs(min[2]) < 0.01);
    assert.equal(app.controls.get('download').disabled, false);
  });
}
