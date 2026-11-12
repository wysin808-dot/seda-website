import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { load } from 'cheerio';

const source = fs.readFileSync(new URL('../seda-site.js', import.meta.url), 'utf8').split('/* ── Global WeChat Contact ── */')[0];

function setup({ reduced = false, observers = true, hash = '' } = {}) {
  const classes = new Set();
  const listeners = new Map();
  const animations = [];
  const observed = [];
  const progress = [];
  let preferenceChange;
  let intersect;
  let disconnected = false;
  const heading = {
    parentElement: null,
    contains: () => false,
    animate(frames, options) {
      const animation = { frames, options, finished: new Promise(() => {}), cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    },
  };
  const child = { ...heading, parentElement: heading };
  const preference = { matches: reduced, addEventListener(type, fn) { preferenceChange = fn; } };
  const document = {
    readyState: 'complete', hidden: false,
    documentElement: {
      dataset: {}, scrollHeight: 2000,
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
      },
    },
    querySelector: selector => selector === '.site-header' ? {} : null,
    querySelectorAll: () => [heading, child],
    createElement: () => ({ style: {}, setAttribute() {}, remove() { this.removed = true; } }),
    body: { appendChild: node => progress.push(node) },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type),
  };
  class Observer {
    constructor(callback) { intersect = callback; }
    observe(node) { observed.push(node); }
    unobserve(node) { observed.splice(observed.indexOf(node), 1); }
    disconnect() { disconnected = true; }
  }
  const window = {
    matchMedia: () => preference, innerHeight: 800, scrollY: 600, location: { hash },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
  if (observers) window.IntersectionObserver = Observer;
  const context = vm.createContext({ window, document, IntersectionObserver: Observer });
  vm.runInContext(source, context);
  return { context, classes, listeners, animations, observed, progress, preference,
    heading, enter: () => intersect([{ isIntersecting: true, target: heading }]),
    change: () => preferenceChange(), disconnected: () => disconnected };
}

test('motion observes outer visual units once, without hiding content', () => {
  const state = setup();
  assert.equal(state.observed.length, 1);
  assert.equal(state.animations.length, 0);
  state.enter();
  assert.equal(state.observed.length, 0);
  assert.equal(state.animations.length, 1);
  assert.ok(state.animations[0].frames[0].opacity > 0);
  assert.equal(state.animations[0].options.fill, undefined);
  assert.equal(state.progress[0].style.transform, 'scaleX(0.5)');
});

test('reduced motion disables startup and switching cancels active effects', () => {
  const disabled = setup({ reduced: true });
  assert.equal(disabled.progress.length, 0);
  assert.equal(disabled.observed.length, 0);
  const state = setup();
  state.enter();
  state.preference.matches = true;
  state.change();
  assert.equal(state.animations[0].cancelled, true);
  assert.equal(state.progress[0].removed, true);
  assert.equal(state.disconnected(), true);
  assert.equal(state.listeners.has('scroll'), false);
  assert.equal(state.classes.has('seda-motion-enabled'), false);
});

test('missing observer support and repeated script loads fail open', () => {
  const state = setup({ observers: false });
  assert.equal(state.animations.length, 0);
  assert.equal(state.progress.length, 1);
  vm.runInContext(source, state.context);
  assert.equal(state.progress.length, 1);
});

test('anchor destinations are not moved by entrance animations', () => {
  const state = setup({ hash: '#contact' });
  state.enter();
  assert.equal(state.animations.length, 0);
});

test('legacy course and pathway pages load the shared enhancement exactly once', () => {
  for (const page of ['ib', 'pathway', 'o-level/registration', 'o-level/retake', 'o-level/tips-by-subject', 'o-level/vs-igcse']) {
    const $ = load(fs.readFileSync(new URL(`../${page}/index.html`, import.meta.url), 'utf8'));
    const scripts = $('script[src]').toArray().filter(node => /^\/seda-site\.js(?:\?|$)/.test($(node).attr('src')));
    assert.equal(scripts.length, 1, page);
  }
});
