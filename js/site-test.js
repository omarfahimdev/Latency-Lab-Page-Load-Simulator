/* Latency Lab | site-test.js: Test your own site: live probe, curl parser, findings and preview */
/* ---- test your own site ---- */
const W = { m: {}, h: {}, s: [], st: null },
  nu = (v) => {
    v = v.trim();
    return v && !/^https?:[/][/]/i.test(v) ? 'https://' + v : v;
  },
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function stat(k, a, b) {
  $('#dot').className = 'dot ' + k;
  $('#stt').textContent = a;
  $('#stm').textContent = b || '';
}
function samp() {
  const ok = W.s.filter((x) => x != null),
    mx = Math.max(1, ...ok);
  $('#ssamp').innerHTML = W.s
    .map((x) =>
      x == null
        ? '<i class="x" style="height:100%" title="failed"></i>'
        : `<i style="height:${Math.max(4, (x / mx) * 100)}%" title="${f(x)}"></i>`,
    )
    .join('');
}
function rt(u) {
  const e = performance.getEntriesByName(u)[0];
  if (!e) return;
  const m = W.m;
  if (e.nextHopProtocol)
    m.http = { h2: '2', h3: '3', 'http/1.1': '1.1' }[e.nextHopProtocol] || e.nextHopProtocol;
  if (e.requestStart > 0) {
    const s = e.secureConnectionStart > 0;
    m.dns = e.domainLookupEnd - e.domainLookupStart;
    m.tcp = s ? e.secureConnectionStart - e.connectStart : e.connectEnd - e.connectStart;
    m.tls = s ? e.connectEnd - e.secureConnectionStart : 0;
    m.wait = e.responseStart - e.requestStart;
    if (m.tcp > 0) m.rtt = m.tcp;
  }
}
async function probe() {
  const u = nu($('#url').value);
  let x;
  try {
    x = new URL(u);
  } catch {
    return stat('bad', 'Invalid URL', 'Enter something like https://example.com');
  }
  $('#url').value = u;
  cmdUpd();
  const N = 8;
  W.s = [];
  W.h = {};
  W.st = null;
  W.m = { src: 'live', url: u, host: x.host, scheme: x.protocol, path: x.pathname + x.search };
  render();
  stat('run', 'Probing…', '8 requests from your browser');
  $('#probe').disabled = true;
  performance.clearResourceTimings();
  let fails = 0;
  for (let i = 0; i < N; i++) {
    const c = new AbortController(),
      to = setTimeout(() => c.abort(), 8000),
      t0 = performance.now();
    let v = null;
    try {
      await fetch(u, { mode: 'no-cors', cache: 'no-store', signal: c.signal });
      v = performance.now() - t0;
    } catch (e) {
      fails++;
    }
    clearTimeout(to);
    W.s.push(v);
    samp();
    await sleep(150);
  }
  $('#probe').disabled = false;
  const ok = W.s.filter((v) => v != null);
  if (!ok.length)
    return stat(
      'bad',
      'Unreachable or blocked',
      'No answer. The site may be down, this page may not be allowed to call other sites, or an http:// link was opened from https. Use the curl method below.',
    );
  rt(u);
  const m = W.m,
    w = W.s
      .slice(1)
      .filter((v) => v != null)
      .sort((a, b) => a - b),
    med = w.length ? w[w.length >> 1] : ok[0],
    avg = ok.reduce((a, b) => a + b) / ok.length,
    sd = Math.sqrt(ok.reduce((a, b) => a + (b - avg) ** 2, 0) / ok.length);
  const cold = W.s[0] ?? ok[0];
  W.st = {
    min: w[0] ?? ok[0],
    med,
    p95: w[Math.min(w.length - 1, Math.ceil(w.length * 0.95) - 1)] ?? med,
    sd,
    loss: (fails / N) * 100,
  };
  const hs = Math.max(0, cold - med);
  if (m.rtt == null) m.rtt = Math.min(W.st.min, hs / (m.scheme === 'https:' ? 2 : 1));
  m.server = Math.max(0, med - m.rtt);
  m.ttfb = cold;
  m.hs = m.dns != null ? m.dns + m.tcp + m.tls : hs;
  try {
    const r = await fetch(u, { cache: 'no-store' });
    m.status = r.status;
    r.headers.forEach((v, k) => (W.h[k] = v));
    m.bytes = (await r.arrayBuffer()).byteLength;
  } catch {}
  stat('ok', 'Reachable', `${ok.length} of ${N} probes answered · ${m.host}`);
  render();
}
function parseCurl(x) {
  x = x.split('\r').join('');
  const p = x.split(/-{3} timing -{3}/);
  if (p.length < 2) return null;
  const t = {};
  p[1].split('\n').forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) t[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
  const bl = p[0].split('\n\n').filter((b) => /^HTTP[/]/i.test(b.trim())),
    last = (bl[bl.length - 1] || '').trim().split('\n'),
    h = {};
  last.slice(1).forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) h[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  });
  const ms = (k) => parseFloat(t[k]) * 1000,
    dns = ms('dns'),
    cn = ms('connect'),
    ap = ms('tls'),
    tt = ms('ttfb'),
    tcp = cn - dns,
    tls = ap > 0 ? ap - cn : 0,
    wait = tt - Math.max(ap, cn);
  if (isNaN(tt)) return null;
  return {
    h,
    m: {
      status: +t.status,
      http: t.http_version,
      ip: t.ip,
      bytes: +t.size,
      dns,
      tcp,
      tls,
      wait,
      ttfb: tt,
      total: ms('total'),
      rtt: tcp > 0 ? tcp : undefined,
      server: Math.max(0, wait - (tcp > 0 ? tcp : 0)),
      hs: dns + tcp + tls,
    },
  };
}
function analyze() {
  const r = parseCurl($('#cpaste').value);
  if (!r)
    return stat(
      'bad',
      'Could not read the output',
      'Paste everything the command printed, including the --- timing --- block.',
    );
  const u = nu($('#url').value);
  let x = { host: '', protocol: 'https:', pathname: '' };
  try {
    x = new URL(u);
  } catch {}
  W.s = [];
  W.st = null;
  W.h = r.h;
  W.m = { ...r.m, src: 'curl', url: u, host: x.host, scheme: x.protocol, path: x.pathname };
  samp();
  stat('ok', 'curl result loaded', 'HTTP ' + r.m.status + (r.m.http ? ' · HTTP/' + r.m.http : ''));
  render();
}
function cmdUpd() {
  $('#ccmd').value =
    `curl -sS -o /dev/null -D - -H 'Accept-Encoding: gzip, br' -w '\\n--- timing ---\\ndns:%{time_namelookup}\\nconnect:%{time_connect}\\ntls:%{time_appconnect}\\nttfb:%{time_starttransfer}\\ntotal:%{time_total}\\nsize:%{size_download}\\nhttp_version:%{http_version}\\nip:%{remote_ip}\\nstatus:%{http_code}\\n' '${nu($('#url').value) || 'https://your-site.com'}'`;
}
function render() {
  const m = W.m,
    h = W.h,
    st = W.st;
  if (m.ttfb == null) {
    ['smets', 'sdet', 'shdr', 'sfind', 'sproj'].forEach((i) => ($('#' + i).innerHTML = ''));
    return;
  }
  const tl = (l, v, s, c) => `<div class="m ${c || ''}"><span>${l}</span><b>${v}</b><i>${s || ''}</i></div>`,
    rate = (v, g, p) => (v <= g ? 'good' : v <= p ? 'warn' : 'bad'),
    n = (v) => (v == null || isNaN(v) ? 'n/a' : f(v));
  let t = '';
  if (m.status) t += tl('Status', m.status, m.http ? 'HTTP/' + m.http : '', m.status < 400 ? 'good' : 'bad');
  t += tl('TTFB (cold)', n(m.ttfb), 'first request', rate(m.ttfb, 800, 1800));
  if (st)
    t +=
      tl('Warm response', n(st.med), `min ${n(st.min)} · p95 ${n(st.p95)}`) +
      tl('Jitter', n(st.sd), 'std deviation') +
      tl('Packet loss', st.loss.toFixed(0) + '%', 'failed probes', st.loss ? 'bad' : 'good');
  if (m.dns != null && !isNaN(m.dns))
    t += tl('DNS', n(m.dns)) + tl('TCP connect', n(m.tcp), 'about 1 RTT') + tl('TLS', n(m.tls));
  t +=
    tl('Server time', n(m.server), 'estimate: wait minus RTT') +
    tl('Handshake', n(m.hs), 'DNS + TCP + TLS') +
    (m.bytes ? tl('Document', kb(m.bytes), m.src === 'curl' ? 'on the wire' : 'decoded') : '');
  $('#smets').innerHTML = t;
  const kv = (a, b) => (b == null || b === '' ? '' : `<tr><td>${a}</td><td>${esc(String(b))}</td></tr>`);
  $('#sdet').innerHTML =
    kv('Host', m.host) +
    kv('Scheme', (m.scheme || '').replace(':', '')) +
    kv('Path', m.path) +
    kv('Resolved IP', m.ip) +
    kv('Protocol', m.http ? 'HTTP/' + m.http : '') +
    kv('Status', m.status) +
    kv('Estimated RTT', m.rtt != null ? f(m.rtt) : '') +
    kv('Source', m.src === 'curl' ? 'curl (full data)' : 'Browser probe (limited by CORS)');
  const keys = [
    'server',
    'content-type',
    'content-encoding',
    'content-length',
    'cache-control',
    'etag',
    'age',
    'alt-svc',
    'via',
    'strict-transport-security',
    'content-security-policy',
    'x-frame-options',
    'x-powered-by',
    'x-cache',
    'cf-ray',
    'location',
  ];
  $('#shdr').innerHTML =
    keys
      .filter((k) => h[k])
      .map((k) => kv(k, h[k].length > 110 ? h[k].slice(0, 110) + '…' : h[k]))
      .join('') ||
    '<tr><td colspan="2">Hidden by the browser. Most sites do not allow cross-site header reads. Use the curl method for the full list.</td></tr>';
  const fd = [],
    add = (l, x) => fd.push([l, x]),
    hv = Object.keys(h).length > 0;
  add(rate(m.ttfb, 800, 1800), `Cold TTFB is ${f(m.ttfb)} from your location (good is under 800 ms).`);
  if (m.hs > 0)
    add(
      m.hs > 300 ? 'warn' : 'good',
      `Connection setup costs about ${f(m.hs)} before the request. Keep-alive and HTTP/2 or 3 avoid paying it again.`,
    );
  if (m.server > 200)
    add(
      m.server > 500 ? 'bad' : 'warn',
      `Server or app time is about ${f(m.server)}. Check slow queries, cold starts and caching.`,
    );
  if (m.http === '1.1') add('warn', 'HTTP/1.1 in use. HTTP/2 or HTTP/3 helps a lot on high latency.');
  if (hv && !h['content-encoding'] && /html|json|text/.test(h['content-type'] || ''))
    add('warn', 'No compression on this response. Enable gzip or brotli.');
  if (hv && !h['cache-control']) add('warn', 'No Cache-Control header on the document.');
  if (hv && m.scheme === 'https:' && !h['strict-transport-security']) add('warn', 'No HSTS header.');
  if (/^3/.test(m.status))
    add(
      'warn',
      'This URL redirects' +
        (h.location ? ' to ' + h.location : '') +
        '. Each redirect adds a full round trip. Test the final URL.',
    );
  if (m.status >= 400) add('bad', 'The server answered with an error status.');
  const cdn = h['cf-ray']
    ? 'Cloudflare'
    : h['x-amz-cf-id']
      ? 'CloudFront'
      : h['x-served-by'] || h['x-vercel-id']
        ? 'Fastly or Vercel'
        : '';
  if (cdn)
    add('good', 'CDN headers found (' + cdn + '). Visitors may reach a nearby edge instead of the origin.');
  if (st && st.sd > 15 && st.sd > st.med * 0.3)
    add('warn', 'Response times vary a lot (jitter ' + f(st.sd) + ').');
  if (st && st.loss) add('bad', st.loss.toFixed(0) + '% of probes failed.');
  $('#sfind').innerHTML = fd.map(([l, x]) => `<li><span class="tg ${l}">●</span> ${esc(x)}</li>`).join('');
  const tn = m.scheme === 'http:' ? 0 : P.tls === 'none' ? 0 : P.tls === '1.2' ? 2 : 1,
    S = m.server || 0,
    pr = [['Measured from you', m.rtt || 0], ...REG].map(([a, r]) => [a, r, P.dns + r * (2 + tn) + S]),
    mx = Math.max(...pr.map((x) => x[2]));
  $('#sproj').innerHTML = pr
    .map(
      ([a, r, v], i) =>
        `<div class="cr" data-r="${Math.round(r)}"><span>${a} <small>${Math.round(r)} ms</small></span><div><i style="width:${(v / mx) * 100}%"></i></div><b>${f(v)}</b></div>`,
    )
    .join('');
  $('#sproj')
    .querySelectorAll('.cr')
    .forEach((e) => (e.onclick = () => SET.rtt(+e.dataset.r || 1)));
}
$('#probe').onclick = probe;
$('#url').onkeydown = (e) => {
  if (e.key === 'Enter') probe();
};
$('#url').oninput = cmdUpd;
$('#canal').onclick = analyze;
$('#ccopy').onclick = () => {
  const c = $('#ccmd');
  c.select();
  try {
    navigator.clipboard.writeText(c.value);
  } catch {
    document.execCommand('copy');
  }
};
$('#ssim').onclick = () => {
  const m = W.m;
  if (m.server == null) return;
  SET.server(Math.round(m.server));
  if (m.bytes) SET.html(Math.min(500, Math.max(5, Math.round(m.bytes / 1024))));
  if (m.dns > 0) SET.dns(Math.round(m.dns));
  if (m.http) P.proto = m.http === '3' ? 'h3' : m.http === '1.1' ? 'h1' : 'h2';
  P.tls = m.scheme === 'http:' ? 'none' : P.tls === 'none' ? '1.3' : P.tls;
  $('#s-proto').value = P.proto;
  $('#s-tls').value = P.tls;
  go();
  $('#mets').scrollIntoView({ behavior: 'smooth' });
};
$('#sprev').onclick = () => {
  const m = W.m;
  if (!m.url || !/^https?:/.test(m.url)) return;
  const hd = W.h,
    fa = /frame-ancestors/i.test(hd['content-security-policy'] || ''),
    big =
      /(^|[.])(linkedin|facebook|instagram|google|youtube|twitter|x|github|amazon|microsoft|apple|reddit)[.]/i.test(
        m.host + '.',
      );
  if (hd['x-frame-options'] || fa || big) {
    $('#sfrm').innerHTML =
      '<p class="note">This site does not allow itself to be shown inside other pages, so it cannot be previewed here. Its measured numbers were loaded into the simulator below instead.</p>';
    $('#ssim').click();
    return;
  }
  const tn = m.scheme === 'http:' ? 0 : P.tls === 'none' ? 0 : P.tls === '1.2' ? 2 : 1,
    ph = [
      ['Resolving DNS…', P.dns],
      ['TCP connect…', P.rtt],
      ['TLS handshake…', tn * P.rtt],
      ['Waiting for server…', P.rtt + (m.server || 0)],
    ],
    tot = ph.reduce((a, b) => a + b[1], 0);
  $('#sfrm').innerHTML =
    `<div class="fr" style="margin-top:12px"><div class="fb"><u></u><u></u><u></u><span class="url">${esc(m.url)}</span></div><div class="vp"><iframe id="ifr" title="Site preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" style="width:100%;height:100%;border:0"></iframe><div class="ov" id="ov"></div></div></div><p class="note">The real site loads after the projected ${f(tot)} from your latency settings. Your own connection time is added on top. If the frame shows "refused to connect", the site blocks embedding.</p><button class="btn" id="sfb">Use the simulated preview instead</button>`;
  $('#sfb').onclick = () => $('#ssim').click();
  const t0 = performance.now(),
    ifr = $('#ifr'),
    ov = $('#ov');
  let live = false;
  ifr.onload = () => {
    if (live) ov.style.display = 'none';
  };
  (function s() {
    const e = performance.now() - t0;
    if (e >= tot) {
      live = true;
      ifr.src = m.url;
      ov.textContent = 'Loading the real page…';
      return;
    }
    let a = 0,
      lb = '';
    for (const [l, d] of ph) {
      a += d;
      if (e < a) {
        lb = l;
        break;
      }
    }
    ov.textContent = lb + ' ' + f(e);
    requestAnimationFrame(s);
  })();
};
