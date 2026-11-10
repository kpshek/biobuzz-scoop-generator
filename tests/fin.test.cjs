'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'BioBuzz-Fin-Studio.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);

function openFinApp() {
  const downloads = [], frames = [];
  const drawing = new Proxy({}, { get: () => () => {} });
  function element() {
    return {
      value:'', min:'', max:'', defaultValue:'', checked:false, defaultChecked:false,
      listeners:{}, attributes:{},
      addEventListener(event, listener) { this.listeners[event] = listener; },
      setAttribute(name, value) { this.attributes[name] = value; },
      get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); },
      get validity() {
        const n = this.valueAsNumber;
        const steps = (n - Number(this.min || 0)) * 10;
        return { valid:this.disabled || (Number.isFinite(n) && (!this.min || n >= +this.min) &&
          (!this.max || n <= +this.max) && Math.abs(steps - Math.round(steps)) < 1e-7) };
      },
      append() {}, remove() {},
      getContext(type) { return type === '2d' ? drawing : null; },
      clientWidth:800, clientHeight:460
    };
  }
  const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], element()]));
  for (const [,tag] of html.matchAll(/<input\b([^>]+)>/g)) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
    const checked = /\schecked(?:\s|$)/.test(tag);
    Object.assign(elements[attrs.id], { value:attrs.value || '', defaultValue:attrs.value || '',
      min:attrs.min || '', max:attrs.max || '', checked, defaultChecked:checked });
  }
  const countOptions = html.match(/<select id="fin-count"[^>]*>([\s\S]*?)<\/select>/)[1];
  elements['fin-count'].options = [...countOptions.matchAll(/<option value="(\d+)"([^>]*)>/g)]
    .map(match => ({ value:match[1], defaultSelected:/\bselected\b/.test(match[2]) }));
  elements['fin-count'].value = elements['fin-count'].options.find(option=>option.defaultSelected).value;
  const views = [...html.matchAll(/data-view="([^"]+)"/g)].map(match => ({ ...element(), dataset:{ view:match[1] } }));
  let blob;
  const context = vm.createContext({
    document:{
      getElementById:id => elements[id], querySelectorAll:() => views, body:element(),
      createElement(tag) {
        return tag === 'canvas' ? element() : {
          remove() {}, click() { downloads.push({ name:this.download, blob }); }
        };
      }
    },
    Blob, TextEncoder, devicePixelRatio:1,
    requestAnimationFrame:fn => frames.push(fn), ResizeObserver:class { observe() {} },
    setTimeout(){}, URL:{ createObjectURL(data){blob=data;return 'blob:test';} }
  });
  for (const script of scripts) vm.runInContext(script, context);
  const paint = () => { while (frames.length) frames.shift()(); };
  paint();
  return {
    elements, downloads, context,
    fire(id,event) { elements[id].listeners[event](); paint(); },
    set(id,value,event='input') { elements[id].value=String(value); this.fire(id,event); },
    check(id,value) { elements[id].checked=value; this.fire(id,'change'); }
  };
}

function stlComponents(bytes) {
  const count = bytes.readUInt32LE(80);
  assert.equal(bytes.length, 84 + count * 50);
  const graph = new Map(), orientedEdges = new Map();
  for (let i=0; i<count; i++) {
    const start=96+i*50;
    const vertices=Array.from({length:3}, (_,j) =>
      Array.from({length:3}, (_,k) => bytes.readFloatLE(start+12*j+4*k)).join(','));
    for (let j=0; j<3; j++) {
      const a=vertices[j], b=vertices[(j+1)%3];
      assert.notEqual(a,b);
      if (!graph.has(a)) graph.set(a,new Set());
      if (!graph.has(b)) graph.set(b,new Set());
      graph.get(a).add(b);
      graph.get(b).add(a);
      const [key,direction]=a<b ? [a+'|'+b,1] : [b+'|'+a,-1];
      const edge=orientedEdges.get(key) || [0,0];
      edge[0]++;
      edge[1]+=direction;
      orientedEdges.set(key,edge);
    }
  }
  for (const edge of orientedEdges.values()) assert.deepEqual(edge,[2,0]);
  let components=0;
  const visited=new Set();
  for (const vertex of graph.keys()) {
    if (visited.has(vertex)) continue;
    components++;
    visited.add(vertex);
    const stack=[vertex];
    while (stack.length) {
      for (const neighbor of graph.get(stack.pop())) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }
  }
  return components;
}

test('page load and reset use the requested single-fin defaults', async () => {
  const app=openFinApp();
  const expected={finCount:1,length:52,height:48,thickness:2,cutLength:33,
    cutAngle:35,roundedRoots:true,extraTopMargin:5,independentFins:true};
  async function assertSettings() {
    app.fire('export-settings','click');
    const json=JSON.parse(await app.downloads.at(-1).blob.text());
    assert.deepEqual(json.settings,expected);
    assert.equal(app.elements['length-slider'].value,'52');
    assert.equal(app.elements['height-slider'].value,'48');
  }
  await assertSettings();
  assert.equal(app.elements.footprint.textContent,'95.0 × 53.0 mm');
  app.fire('export','click');
  const stl=app.downloads.at(-1);
  assert.equal(stl.name,'biobuzz-one-fin-L52-H53-C33-A35-M5-independent.stl');
  assert.equal(stlComponents(Buffer.from(await stl.blob.arrayBuffer())),1);

  app.set('fin-count',4,'change');
  app.set('length-slider',55);
  app.set('height-slider',40);
  app.set('thickness',3);
  app.set('cut-length',11);
  app.set('cut-angle',45);
  app.set('extra-top-margin',0);
  app.check('independent-fins',false);
  app.check('rounded-roots',false);
  app.fire('reset','click');
  await assertSettings();
});

test('extra top margin holds the screw row fixed and updates every side-profile edge', async () => {
  const app=openFinApp();
  app.set('fin-count',4,'change');
  app.check('independent-fins',false);
  app.set('length',55);
  app.set('height',40);
  app.set('cut-angle',45);
  app.set('extra-top-margin',5);
  app.set('cut-length',11);
  assert.equal(app.elements.overall.textContent,'45.0 mm');
  assert.equal(app.elements['hole-margin'].textContent,'2.0 / 9.0 mm');
  const points=vm.runInContext('model.faces.flat()',app.context);
  for (const offset of [-16,16]) {
    const rim=points.filter(([x,y,z]) => Math.abs(y+21.7)<1e-8 &&
      Math.abs(Math.hypot(x-offset,z-36)-2.2)<1e-8);
    assert.ok(rim.length>=60,'the hole stays 36 mm above the bottom');
  }
  const readout=app.elements['edge-readout'].innerHTML;
  for (const [label,length] of [['Top',87.4],['Diagonal',15.6],['Tip',34],['Bottom',98.4],['Mount end',45]]) {
    assert.ok(readout.includes('<dt>'+label+'</dt><dd>'+length.toFixed(1)+' mm</dd>'));
  }
  app.set('dimension-fin',3,'change');
  assert.equal(app.elements['edge-readout'].innerHTML,readout);
  assert.match(app.elements['edge-overlay'].innerHTML,/<line /);
  app.fire('export','click');
  assert.equal(stlComponents(Buffer.from(await app.downloads.at(-1).blob.arrayBuffer())),1);
});

test('independent fin STL has one closed, flat component per fin and exports its settings', async () => {
  const app=openFinApp();
  app.set('fin-count',3,'change');
  app.set('length',55);
  app.set('height',40);
  app.set('cut-angle',45);
  app.set('extra-top-margin',5);
  app.set('thickness',3);
  app.set('cut-length',11);
  app.check('independent-fins',true);
  assert.equal(app.elements['rounded-roots'].disabled,true);
  assert.equal(app.elements['hole-spec'].textContent,'6 × Ø4.4 mm for M4');
  assert.equal(app.elements.overall.textContent,'3.0 mm');
  assert.equal(app.elements.sweep.textContent,'—');
  app.fire('export','click');
  const stl=app.downloads.at(-1);
  assert.match(stl.name,/-M5-independent\.stl$/);
  assert.equal(stlComponents(Buffer.from(await stl.blob.arrayBuffer())),3);
  const points=vm.runInContext('model.faces.flat()',app.context);
  for (const [x,y] of [[0,0],[104,0],[0,51]]) {
    for (const hole of [5.3,37.3]) {
      assert.ok(points.filter(([px,py,pz])=>pz===0 &&
        Math.abs(Math.hypot(px-x-hole,py-y-36)-2.2)<1e-8).length>=60);
    }
  }
  app.fire('export-settings','click');
  const json=JSON.parse(await app.downloads.at(-1).blob.text());
  assert.equal(json.format,'biobuzz-fin-settings');
  assert.equal(json.units,'mm');
  assert.deepEqual(json.settings,{finCount:3,length:55,height:40,thickness:3,cutLength:11,
    cutAngle:45,roundedRoots:true,extraTopMargin:5,independentFins:true});
  app.set('extra-top-margin',21);
  assert.equal(app.elements.export.disabled,true);
  assert.equal(app.elements['export-settings'].disabled,true);
});
