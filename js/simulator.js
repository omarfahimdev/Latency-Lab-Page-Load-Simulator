/* Latency Lab | simulator.js: sim(): the page load model (connections, requests, metrics) */
// seeded random so a run is repeatable
const rng = (s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
function sim(p, rtt) {
  const rn = rng(7),
    R = () => Math.max(1, rtt + (rn() * 2 - 1) * p.jitter),
    h1 = p.proto === 'h1',
    h3 = p.proto === 'h3',
    tn = p.tls === 'none' ? 0 : p.tls === '1.2' ? 2 : 1,
    out = [],
    pipe = [0, 0],
    conns = [];
  const xfer = (b, fresh) => {
    if (!b) return 0;
    const tx = (b * 8) / (p.bw * 1e3),
      rd = Math.ceil(Math.log2(b / 14600 + 1)),
      ss = Math.max(0, rd - 1) * rtt * (fresh ? 1 : 0.4) * (h3 ? 0.8 : 1),
      pk = Math.ceil(b / 1460),
      ls = Math.min((p.loss / 100) * pk * R() * (h3 ? 0.5 : 1.2), rtt * 20 + 200);
    return tx + ss + ls;
  };
  const mk = (st, first) => {
    const s = [];
    let x = st;
    if (first && p.dns) {
      s.push(['dns', x, x + p.dns]);
      x += p.dns;
    }
    const a = R();
    s.push([h3 ? 'quic' : 'tcp', x, x + a]);
    x += a;
    if (!h3 && tn) {
      const b = tn * R();
      s.push(['tls', x, x + b]);
      x += b;
    }
    return { free: x, ready: x, segs: s };
  };
  conns.push(mk(0, true));
  let firstReq = true;
  const req = (name, type, bytes, rdy, srv, cache, pi = 0) => {
    if (cache) {
      const o = { name, type, bytes: 0, cached: true, segs: [['wait', rdy, rdy + 2]], end: rdy + 2 };
      out.push(o);
      return o;
    }
    let c,
      segs = [];
    if (firstReq) {
      c = conns[0];
      segs = c.segs.slice();
      firstReq = false;
    } else if (h1) {
      c = conns.filter((k) => k.free <= rdy).sort((a, b) => a.free - b.free)[0];
      if (!c) {
        if (conns.length < 6) {
          c = mk(rdy, false);
          conns.push(c);
          segs = c.segs.slice();
        } else c = conns.slice().sort((a, b) => a.free - b.free)[0];
      }
    } else c = conns[0];
    const st = Math.max(rdy, c.ready, h1 ? c.free : 0),
      hdr = st + R() + srv,
      rs = Math.max(hdr, pipe[pi]),
      fresh = !c.used;
    c.used = true;
    const end = rs + xfer(bytes, fresh);
    pipe[pi] = end;
    c.free = end;
    const o = { name, type, bytes, hdr, segs: [...segs, ['wait', st, rs], ['dl', rs, end]], end };
    out.push(o);
    return o;
  };
  const doc = req('index.html', 'doc', p.html * 1024, 0, p.server, false);
  const ca = p.cached,
    css = req('app.css', 'css', p.assets * 256, doc.end, 5, ca),
    js = req('app.js', 'js', p.assets * 768, doc.end, 5, ca);
  const fcp = Math.max(doc.end, css.end) + 25 * p.cpu,
    jsDone = js.end + p.assets * 0.3 * p.cpu,
    imgs = [],
    n = p.imgs;
  for (let i = 0; i < n; i++) {
    const sz = p.imgKB * 1024 * (n === 1 ? 1 : i ? 0.7 / (n - 1) : 0.3);
    imgs.push(req(i ? `img-${i}.jpg` : 'hero.jpg', 'img', sz, doc.end + 10, 5, ca));
  }
  let prev = jsDone;
  const apis = [];
  for (let i = 0; i < p.apis; i++) {
    const a = req(
      `GET /api/items?page=${i + 1}`,
      'api',
      p.apiKB * 1024,
      p.mode === 'seq' ? prev : jsDone,
      p.server + p.db,
      false,
      1,
    );
    a.render = a.end + 12 * p.cpu;
    prev = a.render;
    apis.push(a);
  }
  const heroEnd = imgs.length ? imgs[0].end : fcp,
    dataReady = apis.length ? apis[apis.length - 1].render : fcp,
    lcp = Math.max(fcp, heroEnd, apis.length ? apis[0].render : 0),
    full = Math.max(dataReady, ...out.map((o) => o.end), fcp);
  const hs = doc.segs.filter((s) => s[0] !== 'wait' && s[0] !== 'dl').reduce((a, s) => a + s[2] - s[1], 0);
  return {
    out,
    imgs,
    apis,
    fcp,
    heroEnd,
    m: {
      ttfb: doc.hdr,
      fcp,
      lcp,
      dataReady,
      full,
      bytes: out.reduce((a, o) => a + o.bytes, 0),
      reqs: out.length,
      hs,
    },
  };
}
