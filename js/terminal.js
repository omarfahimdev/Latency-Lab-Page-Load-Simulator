/* Latency Lab | terminal.js: SSH terminal simulation: typing lag and command time */
/* ---- SSH terminal ---- */
const CMD = [
  ['ls -la', 4, 1, 'drwxr-xr-x  app  logs  backups  deploy.sh'],
  ['ps aux', 25, 8, 'root 1 0.0 0.1 /sbin/init\nwww-data 842 1.2 2.4 node server.js'],
  ['docker ps', 60, 2, 'CONTAINER ID  IMAGE        STATUS\n3f2a9c1d      api:latest   Up 3 days'],
  ['git pull', 900, 3, 'Already up to date.'],
  ['cat /var/log/syslog', 40, 400, 'Oct 31 21:04:11 vps systemd[1]: Started Session 42 of user deploy.'],
  ['apt update', 3500, 12, 'Hit:1 http://deb.debian.org stable InRelease\nReading package lists... Done'],
];
const PR = 'deploy@vps:~$ ',
  T = { mode: 'ssh', last: 0 },
  tout = $('#tout'),
  tin = $('#tin'),
  tkey = $('#tkey'),
  esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]),
  jit = () => (Math.random() * 2 - 1) * P.jitter;
const lag = () => Math.max(1, P.rtt + jit()) + (Math.random() < P.loss / 100 ? P.rtt * 1.5 + 200 : 0);
function addL(h, c) {
  tout.append(el('div', c || '', h));
  while (tout.children.length > 60) tout.firstChild.remove();
  $('#term').scrollTop = 1e9;
}
function echo(fn) {
  const d = T.mode === 'mosh' ? 0 : lag(),
    now = performance.now(),
    at = Math.max(now + d, T.last + 1);
  T.last = at;
  setTimeout(() => {
    fn();
    $('#tlag').textContent = 'Last key echoed after ' + Math.round(d) + ' ms.';
  }, at - now);
  return d;
}
function submit(cmd) {
  if (!cmd) {
    echo(() => {
      addL('<span class="pr">' + PR + '</span>');
      tin.textContent = '';
    });
    return;
  }
  const c = CMD.find((x) => x[0] === cmd) || [cmd, 15, 0.2, 'bash: ' + esc(cmd) + ': command not found'],
    out = c[2] * 1024,
    dl = (out * 8) / (P.bw * 1e3) + (P.loss / 100) * Math.ceil(out / 1460) * P.rtt * 0.6,
    total = Math.max(1, P.rtt + jit()) + c[1] + dl;
  echo(() => {
    addL('<span class="pr">' + PR + '</span>' + esc(cmd));
    tin.textContent = '';
  });
  setTimeout(() => {
    addL(c[3].replace(/\n/g, '\n') + (c[2] >= 50 ? '\n… ' + kb(out) + ' of output' : ''));
    addL(
      '⏱ ' +
        f(total) +
        ' until the output finished (network ' +
        f(total - c[1]) +
        ', server ' +
        f(c[1]) +
        ')',
      'tt',
    );
  }, total);
}
tkey.oninput = () => {
  const v = tkey.value;
  echo(() => (tin.textContent = v));
};
tkey.onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = tkey.value.trim();
    tkey.value = '';
    submit(v);
  }
};
$('#term').onclick = () => tkey.focus();
$('#tmode').onchange = (e) => {
  T.mode = e.target.value;
  termInfo();
};
CMD.forEach((c) => {
  const b = el('button', 'btn', c[0]);
  b.style.fontSize = '12px';
  b.onclick = () => {
    tkey.focus();
    submit(c[0]);
  };
  $('#tchips').append(b);
});
function termInfo() {
  const l = T.mode === 'mosh' ? 8 : P.rtt + P.jitter / 2 + (P.loss / 100) * (P.rtt * 1.5 + 200),
    k =
      l < 100
        ? ['good', 'smooth']
        : l < 200
          ? ['warn', 'noticeable']
          : l < 350
            ? ['bad', 'laggy']
            : ['bad', 'painful'],
    login = P.dns + 7 * P.rtt + 150;
  $('#tinfo').innerHTML =
    `Typing lag ≈ <span class="tg ${k[0]}">${f(l)} (${k[1]})</span> · SSH login ≈ <b>${f(login)}</b> before the prompt`;
}
addL('Connected. Type a command or press a button below.', 'dm');
