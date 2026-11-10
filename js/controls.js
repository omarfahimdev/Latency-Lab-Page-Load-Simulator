/* Latency Lab | controls.js: Builds the sliders, selects and preset chips from config */
const ctl = $('#ctl');
function sel(k, l, o) {
  const d = el('div', 'c');
  d.innerHTML = `<label>${l}</label><select>${o.map(([v, t]) => `<option value="${v}"${P[k] == v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  d.querySelector('select').id = 's-' + k;
  d.querySelector('select').onchange = (e) => {
    P[k] = e.target.value;
    go();
  };
  ctl.append(d);
}
C.forEach(([k, l, mn, mx, st, u]) => {
  if (GR[k]) ctl.append(el('h3', '', GR[k]));
  const d = el('div', 'c');
  d.innerHTML = `<label for="r-${k}">${l}</label><span class="nv"><input type="number" aria-label="${l}" min="${mn}" max="${mx}" step="${st}"><b>${u}</b></span><input type="range" id="r-${k}" min="${mn}" max="${mx}" step="${st}">`;
  ctl.append(d);
  const r = d.querySelector('[type=range]'),
    n = d.querySelector('[type=number]');
  SET[k] = (v) => {
    v = Math.min(mx, Math.max(mn, +v || mn));
    P[k] = v;
    r.value = n.value = v;
    go();
  };
  r.oninput = () => SET[k](r.value);
  n.onchange = () => SET[k](n.value);
  r.value = n.value = P[k];
  if (k === 'rtt') {
    const ch = el('div', 'chips');
    REG.forEach(([n2, v]) => {
      const b = el('button', 'btn', `${n2} ${v}ms`);
      b.onclick = () => SET.rtt(v);
      ch.append(b);
    });
    ctl.append(ch);
  }
  if (k === 'dns') {
    sel('proto', 'HTTP version', [
      ['h1', 'HTTP/1.1 (6 connections)'],
      ['h2', 'HTTP/2'],
      ['h3', 'HTTP/3 (QUIC)'],
    ]);
    sel('tls', 'TLS', [
      ['1.3', 'TLS 1.3'],
      ['1.2', 'TLS 1.2'],
      ['none', 'No TLS (HTTP)'],
    ]);
  }
  if (k === 'apiKB') {
    sel('mode', 'API call pattern', [
      ['seq', 'Sequential (one after another)'],
      ['par', 'Parallel (all at once)'],
    ]);
    const c = el('label', 'chk', '<input type="checkbox"> Repeat visit (static files cached)');
    c.querySelector('input').onchange = (e) => {
      P.cached = e.target.checked;
      go();
    };
    ctl.append(c);
  }
});
