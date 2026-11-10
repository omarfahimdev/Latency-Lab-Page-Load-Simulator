/* Latency Lab | file-transfer.js: Download and upload model, chart and animation */
/* ---- file transfer ---- */
const F = { size: 100, unit: 1048576, dir: 'down', method: 'https', n: 4 },
  FT = { t: 0, play: false, r: null, last: 0 };
function ftCalc(method, n) {
  const bytes = F.size * F.unit,
    rtt = Math.max(1, P.rtt),
    link = F.dir === 'up' ? P.up : P.bw,
    tn = P.tls === 'none' ? 0 : P.tls === '1.2' ? 2 : 1,
    [win, sr, ns, lf] = {
      https: [4, 1 + tn, 1, 1],
      h3: [4, 1, 1, 0.25],
      sftp: [2, 7, 1, 1],
      par: [4, 1 + tn, n, 1],
    }[method];
  const wc = (win * 8.389) / (rtt / 1000),
    ls = P.loss > 0 ? (1.22 * 1460 * 8) / ((rtt / 1000) * Math.sqrt((P.loss / 100) * lf)) / 1e6 : 1e9,
    r1 = Math.min(wc, ls),
    rate = Math.min(link, ns * r1) * 0.94,
    setup = P.dns + sr * rtt + rtt + 10,
    r0 = (ns * 14600 * 8) / (rtt / 1000) / 1e6;
  const dt = Math.max(5, (setup + ((bytes * 8) / (rate * 1e6)) * 1e3 + rtt * 12) / 400);
  let t = setup,
    done = 0,
    i = 0;
  const pts = [
      [0, 0],
      [setup, 0],
    ],
    cum = [
      [0, 0],
      [setup, 0],
    ];
  while (done < bytes && i++ < 6000) {
    const r = Math.min(rate, r0 * Math.pow(2, (t - setup) / rtt)),
      st = Math.min(dt, (((bytes - done) * 8) / (r * 1e6)) * 1e3 + 0.001);
    done += (((r * 1e6) / 8) * st) / 1000;
    t += st;
    pts.push([t, r]);
    cum.push([t, done]);
  }
  const avg = (bytes * 8) / (t / 1000) / 1e6;
  return {
    total: t,
    setup,
    rate,
    link,
    pts,
    cum,
    avg,
    bytes,
    eff: avg / link,
    cap: ns * r1,
    bn: ns * r1 < link ? (wc <= ls ? 'TCP window ÷ latency' : 'Packet loss') : 'Your bandwidth',
  };
}
function renderFT() {
  const r = ftCalc(F.method, F.n);
  FT.r = r;
  $('#fmets').innerHTML = [
    ['Total time', f(r.total), ''],
    ['Average speed', r.avg.toFixed(1) + ' Mbps', (r.avg / 8).toFixed(1) + ' MB/s'],
    [
      'Link used',
      Math.round(r.eff * 100) + '%',
      F.dir === 'up' ? 'upload link ' + P.up + ' Mbps' : 'download link ' + P.bw + ' Mbps',
      r.eff > 0.7 ? 'good' : r.eff > 0.35 ? 'warn' : 'bad',
    ],
    ['Wait before data', f(r.setup), 'DNS, handshakes, first byte'],
    ['Bottleneck', r.bn, ''],
  ]
    .map(
      ([l, v, s, c]) =>
        `<div class="m ${c || ''}"><span>${l}</span><b style="${l === 'Bottleneck' ? 'font-size:15px' : ''}">${v}</b><i>${s}</i></div>`,
    )
    .join('');
  const yM = Math.max(r.rate, 1) * 1.15,
    X = (t) => (t / r.total) * 600,
    Y = (v) => 148 - (v / yM) * 140,
    pl = r.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
  $('#fch').innerHTML =
    `<polygon class="ar" points="0,148 ${pl} 600,148"/><polyline class="ln" points="${pl}"/><line class="cu" id="fcu" x1="0" x2="0" y1="0" y2="150"/>`;
  $('#fmax').textContent = 'peak ' + r.rate.toFixed(0) + ' Mbps · total ' + f(r.total);
  $('#fnote').textContent =
    r.bn === 'Your bandwidth'
      ? 'Your link is the limit here, so extra streams or a closer server will not speed this up.'
      : `Latency or loss caps what one connection can carry at about ${r.cap.toFixed(0)} Mbps, while the link allows ${r.link} Mbps. Parallel streams, HTTP/3 or a closer server raise that cap.`;
  const FM = [
      ['HTTPS, 1 stream', 'https', 1],
      ['HTTP/3 (QUIC)', 'h3', 1],
      ['SFTP or SCP', 'sftp', 1],
      ['4 parallel streams', 'par', 4],
      ['8 parallel streams', 'par', 8],
      ['16 parallel streams', 'par', 16],
    ],
    rs = FM.map(([n, m, k]) => [n, m, k, ftCalc(m, k).total]),
    mx = Math.max(...rs.map((x) => x[3]));
  $('#fcmp').innerHTML = rs
    .map(
      ([n, m, k, tt]) =>
        `<div class="cr${m === F.method && (m !== 'par' || k === F.n) ? ' on' : ''}" data-m="${m}" data-k="${k}"><span>${n}</span><div><i style="width:${(tt / mx) * 100}%"></i></div><b>${f(tt)}</b></div>`,
    )
    .join('');
  $('#fcmp')
    .querySelectorAll('.cr')
    .forEach(
      (e) =>
        (e.onclick = () => {
          F.method = e.dataset.m;
          if (F.method === 'par') F.n = +e.dataset.k;
          $('#fmeth').value = F.method;
          $('#fn').value = F.n;
          renderFT();
        }),
    );
  FT.t = 0;
  FT.play = true;
  ftDraw();
}
function ftDraw() {
  const r = FT.r;
  if (!r) return;
  let i = r.cum.findIndex((c) => c[0] >= FT.t);
  if (i < 0) i = r.cum.length - 1;
  const d = r.cum[i][1],
    sp = r.pts[i][1],
    sc = Math.max(1, r.total / 8000);
  $('#fpb').style.width = Math.min(100, (d / r.bytes) * 100) + '%';
  const cu = $('#fcu');
  if (cu) {
    cu.setAttribute('x1', (FT.t / r.total) * 600);
    cu.setAttribute('x2', (FT.t / r.total) * 600);
  }
  $('#ftm').textContent =
    `${Math.round(Math.min(100, (d / r.bytes) * 100))}% · ${f(FT.t)} of ${f(r.total)} · ${sp.toFixed(0)} Mbps` +
    (sc > 1 ? ` · shown ${Math.round(sc)}× faster` : '');
}
function ftTick(ts) {
  const dl = ts - (FT.last || ts);
  FT.last = ts;
  if (FT.play && FT.r) {
    FT.t += dl * Math.max(1, FT.r.total / 8000);
    if (FT.t >= FT.r.total) {
      FT.t = FT.r.total;
      FT.play = false;
    }
    ftDraw();
  }
  requestAnimationFrame(ftTick);
}
[
  ['fsz', 'input', () => (F.size = Math.max(1, +$('#fsz').value || 1))],
  ['fun', 'change', () => (F.unit = +$('#fun').value)],
  ['fdir', 'change', () => (F.dir = $('#fdir').value)],
  ['fmeth', 'change', () => (F.method = $('#fmeth').value)],
  ['fn', 'input', () => (F.n = Math.min(32, Math.max(1, +$('#fn').value || 1)))],
].forEach(([id, ev, fn]) =>
  $('#' + id).addEventListener(ev, () => {
    fn();
    renderFT();
  }),
);
$('#fgo').onclick = () => {
  FT.t = 0;
  FT.play = true;
};
