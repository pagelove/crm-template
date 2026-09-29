const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Point CRM_TEST_JSDOM at an installed jsdom package, or install jsdom locally.
const { JSDOM } = require(process.env.CRM_TEST_JSDOM || 'jsdom');
const root = path.resolve(__dirname, '../public/crm-demo');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const fixed = Date.parse('2026-09-05T16:00:00Z');
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };

function setup(options = {}) {
  const dom = new JSDOM(source, { url: 'https://example.test/crm-demo/', runScripts: 'outside-only' });
  const server = new JSDOM(source);
  const w = dom.window;
  const calls = [];
  let putFailures = options.putFailures || 0;
  let getFailures = options.getFailures || 0;
  let ambiguousPost = !!options.ambiguousPost;
  let blocker = options.blocker;
  w.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
  w.matchMedia = query => ({ matches: query === "(max-width: 800px)" ? !!options.stacked : query === "(prefers-reduced-motion: reduce)" ? !!options.reducedMotion : false });
  w.CSS = { escape: text => String(text).replace(/["\\]/g, '\\$&') };
  w.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const requestURL = new URL(url, w.location.origin);
    assert.equal(requestURL.pathname, '/crm-demo/index.html', 'all calls address the concrete authorized page');
    if (method === 'HEAD') return new Response(null, { headers: options.preview ? { 'X-Pagelove-Preview': 'local' } : {} });
    const selector = init.headers.Range.slice('selector='.length);
    calls.push({ method, selector, body: init.body });
    if (method === 'GET') {
      if (getFailures-- > 0) return new Response('unavailable', { status: 503 });
      return new Response(server.serialize());
    }
    if (blocker) { const wait = blocker; blocker = null; await wait; }
    const target = server.window.document.querySelector(selector);
    assert.ok(target, 'the selector must address an actual target');
    if (method === 'POST') {
      target.insertAdjacentHTML('beforeend', init.body);
      if (ambiguousPost) { ambiguousPost = false; throw new TypeError('connection lost after commit'); }
    } else if (method === 'PUT') {
      if (putFailures-- > 0) return new Response('Denied', { status: 401 });
      target.outerHTML = init.body;
    } else assert.fail('unexpected mutation method');
    return new Response('', { status: 206 });
  };
  w.eval(script);
  const q = selector => w.document.querySelector(selector);
  const submit = selector => q(selector).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const set = (selector, value) => { q(selector).value = value; };
  return { w, dom, server, q, set, submit, calls };
}

function note(app, text = 'Talked about the new project') {
  app.set('#add-log [name=note]', text);
  app.set('#add-log [name=when]', '2026-09-05');
}

test('contact search includes conversation notes, due filters and person/date context', () => {
  const app = setup();
  assert.equal(app.q('.stats [peoplecount]').textContent, '2');
  assert.equal(app.q('.stats [overduecount]').textContent, '1');
  assert.match(app.q('#contacts-view').textContent, /Every 30 days/);
  assert.match(app.q('#activity-view').textContent, /Ana Ruiz/);
  assert.equal(app.q('#activity-view time').getAttribute('datetime'), '2026-01-15');
  app.set('#contact-search', 'conference');
  app.q('#contact-search').dispatchEvent(new app.w.Event('input'));
  assert.equal(app.w.document.querySelectorAll('.contact-card').length, 1);
  assert.match(app.q('.contact-card').textContent, /Ben Okafor/);
  app.set('#contact-search', '');
  app.q('[data-filter=due]').click();
  assert.equal(app.w.document.querySelectorAll('.contact-card').length, 1);
  assert.match(app.q('.contact-card').textContent, /Ana Ruiz/);
  app.q('[data-filter=upcoming]').click();
  assert.match(app.q('.contact-card').textContent, /Ben Okafor/);
  app.dom.window.close();
});

test('double submit produces one escaped, closed-shape person record', async () => {
  let release;
  const app = setup({ blocker: new Promise(resolve => { release = resolve; }) });
  const hostileName = 'Sam "><img src=x onerror=alert(1)> & Casey';
  app.set('#add-person [name=name]', hostileName);
  app.submit('#add-person');
  app.submit('#add-person');
  assert.equal(app.calls.filter(call => call.method === 'POST').length, 1);
  release();
  await settle();
  assert.equal(app.q('#people').children.length, 3);
  assert.equal(app.q('#people').lastElementChild.querySelector('[itemprop=name]').textContent, hostileName);
  assert.equal(app.q('#people').querySelectorAll('img').length, 0);
  assert.equal(app.q('#contacts-view').querySelectorAll('img').length, 0);
  const row = app.q('#people').lastElementChild;
  assert.deepEqual([...row.attributes].map(a => a.name).sort(), ['data-contact', 'itemscope', 'itemtype']);
  assert.ok([...row.children].every(el => ['META', 'SPAN'].includes(el.tagName)));
  app.dom.window.close();
});

test('POST success then due PUT failure reports partial success and retries only PUT', async () => {
  const app = setup({ putFailures: 1 });
  note(app);
  app.submit('#add-log');
  await settle();
  assert.equal(app.q('#log').children.length, 3);
  assert.match(app.q('#status').textContent, /conversation is saved/);
  assert.match(app.q('#retry').textContent, /Retry date update/);
  assert.equal(app.q('#refresh').disabled, true, 'only the explicit retry button may retry a pending write');
  assert.equal(app.q('#add-log [name=note]').value, '');
  assert.equal(app.q('#add-log button').disabled, true);
  app.q('#retry').click();
  await settle();
  assert.equal(app.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(app.calls.filter(call => call.method === 'PUT').length, 2);
  assert.equal(app.q('#log').children.length, 3);
  assert.match(app.q('#status').textContent, /next check-in date is updated/);
  assert.equal(app.q('#add-log button').disabled, false);
  assert.equal(app.q('#refresh').disabled, false);
  assert.equal(Number(app.q('#people > li [itemprop=dueEpoch]').content), Date.parse('2026-10-05T00:00:00Z') / 1000);
  app.dom.window.close();
});

test('failed refresh after a committed write is explicit and recoverable', async () => {
  const app = setup({ getFailures: 1 });
  app.set('#add-person [name=name]', 'Mina Patel');
  app.submit('#add-person');
  await settle();
  assert.match(app.q('#status').textContent, /Added Mina Patel/);
  assert.match(app.q('#status').textContent, /could not be refreshed/);
  assert.equal(app.w.document.activeElement, app.q('#retry'), 'a saved contact with refresh failure must keep recovery visible and focused');
  assert.equal(app.q('#people').children.length, 3);
  assert.equal(app.q('#add-person button').disabled, true);
  app.q('#retry').click();
  await settle();
  assert.equal(app.q('#add-person button').disabled, false);
  assert.match(app.q('#status').textContent, /up to date/);
  assert.equal(app.calls.filter(call => call.method === 'POST').length, 1);
  app.dom.window.close();
});

test('a lost POST response verifies the generated record ID before any retry', async () => {
  const app = setup({ ambiguousPost: true });
  note(app);
  app.submit('#add-log');
  await settle();
  assert.match(app.q('#status').textContent, /save could not be confirmed/);
  app.q('#retry').click();
  await settle();
  assert.equal(app.calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(app.calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(app.q('#log').children.length, 3);
  assert.match(app.q('#status').textContent, /Conversation saved/);
  app.dom.window.close();
});

test('backdated conversations do not move the next check-in behind a newer conversation', async () => {
  const app = setup();
  app.q('[data-person="c-seed2"]').click();
  note(app);
  app.set('#add-log [name=when]', '2026-01-10');
  app.submit('#add-log');
  await settle();
  const due = Number(app.q('#people > li[data-contact="c-seed2"] [itemprop=dueEpoch]').content);
  assert.equal(due, Date.parse('2026-09-01T00:00:00Z') / 1000 + 90 * 86400);
  app.dom.window.close();
});

test('a draft cannot silently move to another person through either selector', () => {
  const app = setup();
  note(app, 'A note for Ana');
  app.q('[data-person="c-seed2"]').click();
  assert.equal(app.q('#add-log [name=target]').value, 'c-seed1');
  app.set('#add-log [name=target]', 'c-seed2');
  app.q('#add-log [name=target]').dispatchEvent(new app.w.Event('change'));
  assert.equal(app.q('#add-log [name=target]').value, 'c-seed1');
  assert.equal(app.q('#add-log [name=note]').value, 'A note for Ana');
  assert.match(app.q('#status').textContent, /Save your current note/);
  app.dom.window.close();
});

test('private variant retains anonymous denial and shared interface contract', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/index-private.html'), 'utf8');
  const doc = new JSDOM(html).window.document;
  const rules = [...doc.querySelectorAll('[itemtype="https://pagelove.org/AuthorizationRule"]')];
  assert.equal(rules.length, 2);
  assert.ok(rules.some(rule => rule.querySelector('[itemprop=actor]').content === '*' && rule.querySelector('[itemprop=action]').content === 'Deny'));
  for (const rule of rules) assert.equal(rule.querySelector('[itemprop=resource]').content, '/crm/index.html');
  for (const selector of ['#contacts-view', '#person-context', '#add-person', '#add-log', '#retry', '#people', '#log']) assert.ok(doc.querySelector(selector));
});


test('adding a person preserves the original person on an existing conversation draft', async () => {
  const app = setup();
  note(app, 'A note that belongs to Ana');
  app.set('#add-person [name=name]', 'Mina Patel');
  app.submit('#add-person');
  await settle();
  assert.equal(app.q('#add-log [name=target]').value, 'c-seed1');
  assert.equal(app.q('#add-log [name=note]').value, 'A note that belongs to Ana');
  app.dom.window.close();
});

test('a deleted draft contact cannot silently become a different person on refresh', async () => {
  const app = setup();
  note(app, 'A note that belongs to Ana');
  app.server.window.document.querySelector('#people > li[data-contact="c-seed1"]').remove();
  app.q('#refresh').click();
  await settle();
  assert.equal(app.q('#add-log [name=target]').value, '');
  assert.equal(app.q('#add-log button').disabled, true);
  assert.equal(app.q('#add-log [name=note]').value, 'A note that belongs to Ana');
  assert.equal(app.q('#add-log [name=note]').disabled, false);
  app.dom.window.close();
});

test('server preview marker labels local-only persistence without claiming live state', async () => {
  const app = setup({ preview: true });
  await settle();
  assert.equal(app.q('.edition').textContent, 'Local preview · sample data');
  assert.match(app.q('footer details p').textContent, /Changes are saved only in this local preview/);
  app.dom.window.close();
});


test('fictional portraits stay limited to seed IDs and new people use initials', async () => {
  const app = setup();
  assert.ok(app.q('[data-person="c-seed1"] .portrait-ana'));
  assert.ok(app.q('[data-person="c-seed2"] .portrait-ben'));
  assert.equal(app.q('.profile-art, .cadence-dial'), null, 'identifying avatars must not become a decorative profile or progress meter');
  assert.match(app.q('.contact-facts').textContent, /Last conversation/);
  assert.match(app.q('.contact-facts').textContent, /Next follow-up/);
  assert.match(app.q('#person-context .context-note').textContent, /Coffee, talked about the new role/);
  assert.equal(app.q('#person-context .portrait-swatch').getAttribute('aria-label'), 'Fictional sample portrait for Ana Ruiz');
  app.set('#add-person [name=name]', 'Mina Patel');
  app.submit('#add-person');
  await settle();
  assert.equal(app.q('#person-context .portrait-swatch'), null);
  assert.equal(app.q('#person-context .profile-monogram').textContent, 'MP');
  assert.equal(app.q('#people').lastElementChild.querySelectorAll('img,svg').length, 0);
  assert.match(app.q('#contacts-view').textContent, /Every 30 days/);
  app.dom.window.close();
});


test('offscreen error recovery is revealed without scrolling already visible feedback', () => {
  const app = setup();
  const moves = [];
  app.q('#feedback').getBoundingClientRect = () => ({ top: -120, bottom: -30 });
  app.q('#feedback').scrollIntoView = options => moves.push(options);
  app.set('#add-person [name=name]', '   ');
  app.submit('#add-person');
  assert.equal(moves.length, 1);
  assert.equal(moves[0].block, 'nearest');
  assert.equal(moves[0].behavior, 'auto');
  assert.equal(app.q('#feedback').hidden, false);
  app.q('#feedback').getBoundingClientRect = () => ({ top: 15, bottom: 80 });
  app.submit('#add-person');
  assert.equal(moves.length, 1, 'visible feedback must not force another scroll');
  assert.equal(app.calls.length, 0, 'validation does not attempt a write');
  app.dom.window.close();
});


test('adding a person restores visible focus after the disclosure closes and controls unlock', async () => {
  for (const stacked of [false, true]) {
    const app = setup({ stacked, reducedMotion: true });
    const moves = [];
    app.q('#person-context').scrollIntoView = options => moves.push(options);
    app.q('#new-person').open = true;
    app.set('#add-person [name=name]', 'Mina Patel');
    app.q('#add-person button').focus();
    app.submit('#add-person');
    await settle();
    assert.equal(app.q('#new-person').open, false);
    const focused = app.w.document.activeElement;
    if (stacked) {
      assert.equal(focused, app.q('#person-context'));
      assert.match(focused.textContent, /Mina Patel/);
      assert.equal(moves.length, 1);
      assert.equal(moves[0].behavior, 'auto');
    } else {
      assert.equal(focused, app.q('.contact-card[aria-pressed="true"]'));
      assert.equal(focused.disabled, false);
      assert.match(focused.textContent, /Mina Patel/);
      assert.equal(moves.length, 0);
    }
    app.dom.window.close();
  }
});

test('stacked contact selection focuses and reveals a stable summary while desktop stays in the roster', () => {
  for (const stacked of [false, true]) {
    const app = setup({ stacked, reducedMotion: true });
    const summary = app.q('#person-context');
    const moves = [];
    summary.scrollIntoView = options => moves.push(options);
    app.q('[data-person="c-seed2"]').click();
    assert.equal(app.q('#person-context'), summary, 'the summary element survives rendering');
    if (stacked) {
      assert.equal(app.w.document.activeElement, summary);
      assert.equal(summary.getAttribute('aria-labelledby'), 'selected-person-name');
      assert.equal(app.q('#selected-person-name').textContent, 'Ben Okafor');
      assert.equal(moves.length, 1);
      assert.equal(moves[0].block, 'start');
      assert.equal(moves[0].behavior, 'auto');
    } else {
      assert.equal(app.w.document.activeElement.getAttribute('data-person'), 'c-seed2');
      assert.equal(moves.length, 0);
    }
    app.dom.window.close();
  }
});
