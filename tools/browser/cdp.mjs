// Kleiner Chrome-Fernsteuerer über das DevTools-Protokoll (ohne Abhängigkeiten).
// Startet Chrome/Edge kopflos, liefert eval / click / screenshot und sammelt
// Konsolenfehler. Nur für automatische Spieltests.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1280, height = 720, port = 9333, headless = true } = {}) {
  const exe = BROWSERS.find((p) => existsSync(p));
  if (!exe) throw new Error('Kein Chrome/Edge gefunden');
  const profile = mkdtempSync(join(tmpdir(), 'c2-cdp-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--allow-file-access-from-files=false',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ];
  if (headless) args.push('--headless=new');
  const proc = spawn(exe, [...args, 'about:blank'], { stdio: 'ignore' });
  let targets = null;
  for (let k = 0; k < 50 && !targets; k++) {
    await sleep(200);
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch {
      /* noch nicht bereit */
    }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  const logs = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push(`${d.exception?.description ?? d.text} @ ${d.url ?? ''}:${d.lineNumber}`);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (msg.params.type === 'error') errors.push(`console.error: ${text}`);
      else logs.push(text);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(`${msg.params.entry.source}: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const api = {
    errors,
    logs,
    send,
    async goto(url) {
      await send('Page.navigate', { url });
      await sleep(1500);
    },
    async eval(expression, timeout = 60000) {
      const r = await Promise.race([
        send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
        sleep(timeout).then(() => {
          throw new Error(`eval-Zeitüberschreitung: ${expression.slice(0, 80)}`);
        }),
      ]);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    /** Wartet, bis der Ausdruck wahr wird. */
    async waitFor(expression, timeout = 20000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (await api.eval(`!!(${expression})`)) return true;
        await sleep(150);
      }
      throw new Error(`Wartezeit abgelaufen: ${expression}`);
    },
    /** Echter Mausklick auf die Mitte des Elements. */
    async click(selector) {
      const r = await api.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
      if (!r) throw new Error(`Nicht gefunden: ${selector}`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
      await sleep(80);
    },
    async screenshot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async close() {
      try {
        await send('Browser.close');
      } catch {
        /* schon zu */
      }
      proc.kill();
    },
  };
  return api;
}
