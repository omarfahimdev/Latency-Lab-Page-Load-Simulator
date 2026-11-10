/* Latency Lab | page-load-ui.js: Metrics, waterfall, live preview, location comparison, suggestions and playback */
let S,
  pin = null,
  t = 0,
  playing = false,
  last = 0,
  tmr;
function go() {
  if (!ready) return;
  clearTimeout(tmr);
  tmr = setTimeout(run, 120);
}
function run() {
  S = sim(P, P.rtt);
  metrics();
  wf();
  pv();
  cmp();
  tips();
  termInfo();
  renderFT();
  t = 0;
  $('#sc').max = Math.round(S.m.full + 300);
  playing = true;
  last = performance.now();
  $('#play').textContent = 'Pause';
  draw();
}
function metrics() {
  const m = S.m,
    M = [
      ['Time to first byte', 'ttfb', 800, 1800],
      ['First paint', 'fcp', 1800, 3000],
      ['Largest paint', 'lcp', 2500, 4000],
      ['API data ready', 'dataReady', 2500, 4000],
      ['Fully loaded', 'full', 4000, 8000],
    ];
  $('#mets').innerHTML =
    M.map(([l, k, g, w]) => {
      const v = m[k],
        d = pin ? v - pin[k] : null;
      return `<div class="m ${v <= g ? 'good' : v <= w ? 'warn' : 'bad'}"><span>${l}</span><b>${f(v)}</b><i>${d == null ? '' : (d >= 0 ? '+' : '−') + f(Math.abs(d)) + ' vs pinned'}</i></div>`;
    }).join('') +
    `<div class="m"><span>Transferred</span><b>${kb(m.bytes)}</b><i>${m.reqs} requests · ${f(m.hs)} handshake</i></div>`;
}
function wf() {
  const T = (S.tot = S.m.full * 1.04 + 1),
    box = $('#wf');
  box.innerHTML = '';
  const stp = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].find((s) => T / s <= 9) || 20000;
  let tk = '';
  for (let x = 0; x <= T; x += stp) tk += `<i style="left:${(x / T) * 100}%">${f(x)}</i>`;
  box.append(el('div', 'row ax', '<span class="lb"></span><div class="tr">' + tk + '</div>'));
  S.out.forEach((o) => {
    const sg = o.segs
      .map(
        ([k, a, b]) =>
          `<i class="s ${k}" style="left:${(a / T) * 100}%;width:${((b - a) / T) * 100}%" title="${k}: ${f(b - a)}"></i>`,
      )
      .join('');
    box.append(
      el(
        'div',
        'row',
        `<span class="lb" title="${o.name}"><em>${o.type}</em>${o.name}<small>${o.cached ? 'cached' : kb(o.bytes)}</small></span><div class="tr">${sg}</div>`,
      ),
    );
  });
  const m = S.m,
    mk = el('div', 'mk');
  [
    ['TTFB', m.ttfb],
    ['FCP', m.fcp],
    ['LCP', m.lcp],
    ['Load', m.full],
  ].forEach(
    ([l, v], i) =>
      (mk.innerHTML += `<i style="left:${(v / T) * 100}%"><b style="top:${i * 12}px">${l}</b></i>`),
  );
  const phd = el('div');
  phd.id = 'ph';
  box.append(mk, phd);
}
function pv() {
  const pg = $('#pg');
  pg.innerHTML = '';
  S.els = [];
  const add = (par, c, h, b) => {
    const e = el('div', 'el ' + c, `<div class="ct">${h}</div>`);
    par.append(e);
    S.els.push({ e, b });
  };
  add(pg, 'nav', '<b>◆ Corner Kitchen</b><span>Menu</span><span>Orders</span><span>Account</span>', S.fcp);
  add(pg, 'hero', '<h4>Fresh food, delivered fast</h4><p>Order in under a minute</p>', S.heroEnd);
  const g = el('div', 'cards');
  pg.append(g);
  for (let i = 1; i <= Math.min(Math.max(S.imgs.length - 1, 0), 6); i++)
    add(g, 'card', `<span>🍽️</span>Dish ${i}`, S.imgs[i].end);
  if (S.apis.length) {
    pg.append(
      el(
        'div',
        'lt',
        `Live orders · ${S.apis.length} API call${S.apis.length > 1 ? 's' : ''} (${P.mode === 'seq' ? 'sequential' : 'parallel'})`,
      ),
    );
    const L = el('div', 'list');
    pg.append(L);
    S.apis
      .slice(0, 8)
      .forEach((a, i) =>
        add(
          L,
          'row2',
          `<b>Order #${1040 + i}</b><span>$${(12 + i * 7.5).toFixed(2)}</span><em>Delivered</em>`,
          a.render,
        ),
      );
  }
}
function cmp() {
  const rows = [['Your setting', P.rtt], ...REG].map(([n, r]) => [n, r, sim(P, r).m]),
    mx = Math.max(...rows.map((x) => x[2].full));
  $('#cmp').innerHTML = rows
    .map(
      ([n, r, m]) =>
        `<div class="rw" data-r="${r}"><span>${n}<small>${r} ms</small></span><div class="bars"><i class="b1" style="width:${(m.lcp / mx) * 100}%"></i><i class="b2" style="width:${(m.full / mx) * 100}%"></i></div><b>${f(m.lcp)} / ${f(m.full)}</b></div>`,
    )
    .join('');
  $('#cmp')
    .querySelectorAll('.rw')
    .forEach((r, i) => {
      if (i) r.onclick = () => SET.rtt(+r.dataset.r);
    });
}
function tips() {
  const V = [
    ['Use HTTP/3', (p, r) => [{ ...p, proto: 'h3' }, r]],
    ['Fetch API calls in parallel', (p, r) => [{ ...p, mode: 'par' }, r]],
    ['Cache static files (repeat visitors)', (p, r) => [{ ...p, cached: true }, r]],
    ['Cut server and database time in half', (p, r) => [{ ...p, server: p.server / 2, db: p.db / 2 }, r]],
    ['Choose a location 100 ms closer to visitors', (p, r) => [p, Math.max(1, r - 100)]],
    ['Remove packet loss', (p, r) => [{ ...p, loss: 0 }, r]],
    ['Use TLS 1.3', (p, r) => [{ ...p, tls: p.tls === '1.2' ? '1.3' : p.tls }, r]],
  ];
  const base = S.m.full,
    L = V.map(([l, fn]) => {
      const [p2, r2] = fn({ ...P }, P.rtt);
      return [l, base - sim(p2, r2).m.full];
    })
      .filter((x) => x[1] > 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  $('#tips').innerHTML = L.length
    ? L.map(([l, d]) => `<li><b>−${f(d)}</b> ${l}</li>`).join('')
    : '<li>Nothing stands out. This setup is already close to its best.</li>';
}
const NM = {
  dns: 'Resolving DNS…',
  tcp: 'Opening TCP connection…',
  quic: 'QUIC handshake…',
  tls: 'TLS handshake…',
  wait: 'Waiting for the server…',
  dl: 'Downloading the HTML…',
};
function draw() {
  if (!S) return;
  const T = S.tot,
    ph = $('#ph');
  if (ph) ph.style.left = `calc(var(--lw) + (100% - var(--lw)) * ${Math.min(t / T, 1)})`;
  $('#pg').classList.toggle('on', t >= S.fcp);
  S.els.forEach((x) => x.e.classList.toggle('ld', t >= x.b));
  const s = S.out[0].segs.find((s) => t >= s[1] && t < s[2]);
  $('#stat').textContent = s
    ? NM[s[0]]
    : t < S.fcp
      ? 'Fetching CSS and JavaScript…'
      : t < S.m.full
        ? 'Loading images and API data…'
        : 'Fully loaded';
  $('#prog').style.width = Math.min(100, (S.out.filter((o) => o.end <= t).length / S.out.length) * 100) + '%';
  $('#tm').textContent = f(t);
  $('#sc').value = t;
}
function tick(ts) {
  if (playing && S) {
    t += (ts - last) * $('#spd').value;
    if (t >= S.m.full + 300) {
      t = S.m.full + 300;
      playing = false;
      $('#play').textContent = 'Replay';
    }
    draw();
  }
  last = ts;
  requestAnimationFrame(tick);
}
$('#play').onclick = () => {
  if (!S) return;
  if (playing) {
    playing = false;
    $('#play').textContent = 'Resume';
  } else {
    if (t >= S.m.full + 300) t = 0;
    playing = true;
    $('#play').textContent = 'Pause';
  }
};
$('#sc').oninput = (e) => {
  playing = false;
  $('#play').textContent = 'Resume';
  t = +e.target.value;
  draw();
};
$('#pin').onclick = () => {
  pin = { ...S.m };
  metrics();
};
let dk = matchMedia('(prefers-color-scheme: dark)').matches;
$('#theme').onclick = () => {
  dk = !dk;
  document.documentElement.dataset.theme = dk ? 'dark' : 'light';
};
