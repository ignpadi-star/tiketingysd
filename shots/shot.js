/* Dev-only CDP screenshot helper. Not part of the Apps Script deployment. */
const fs = require('fs');

const CDP = 'http://127.0.0.1:9222';

async function main() {
  const [url, width, height, out, evalJs] = process.argv.slice(2);
  if (!url || !out) throw new Error('usage: node shot.js <url> <width> <height> <out.png> [js]');
  const w = Number(width) || 1280;
  const h = Number(height) || 900;

  const target = await fetch(CDP + '/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 });
  await send('Page.navigate', { url });
  await sleep(1500);
  if (evalJs) {
    const r = await send('Runtime.evaluate', { expression: evalJs, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) console.error('EVAL ERROR', JSON.stringify(r.result.exceptionDetails));
    await sleep(900);
  }
  const metrics = await send('Page.getLayoutMetrics');
  const cs = metrics.result.cssContentSize || metrics.result.contentSize;
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: cs.width, height: Math.min(cs.height, 5000), scale: 1 }
  });
  if (!shot.result || !shot.result.data) throw new Error('screenshot failed: ' + JSON.stringify(shot));
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', out, cs.width + 'x' + Math.min(cs.height, 5000));
  const errs = events.filter(e => e.method === 'Runtime.exceptionThrown');
  if (errs.length) console.log('JS ERRORS', JSON.stringify(errs.map(e => e.params.exceptionDetails.text)));
  ws.close();
  await fetch(CDP + '/json/close/' + target.id).catch(() => {});
}

main().catch(e => { console.error(e.message); process.exit(1); });
