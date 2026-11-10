/* Latency Lab | config.js: Defaults (P), server location presets (REG) and slider definitions (C) */
const P = {
  rtt: 160,
  jitter: 15,
  loss: 0.5,
  bw: 50,
  up: 20,
  dns: 30,
  server: 120,
  db: 80,
  html: 60,
  assets: 600,
  imgs: 8,
  imgKB: 1500,
  apis: 4,
  apiKB: 20,
  cpu: 4,
  proto: 'h2',
  tls: '1.3',
  mode: 'seq',
  cached: false,
};
const REG = [
  ['Local', 5],
  ['Same country', 25],
  ['Singapore / Mumbai', 90],
  ['Germany / EU', 170],
  ['US East', 240],
  ['US West', 290],
  ['Australia', 320],
];
const C = [
  ['rtt', 'Latency (round trip)', 1, 1000, 1, 'ms'],
  ['jitter', 'Jitter', 0, 200, 1, 'ms'],
  ['loss', 'Packet loss', 0, 15, 0.1, '%'],
  ['bw', 'Download bandwidth', 1, 1000, 1, 'Mbps'],
  ['up', 'Upload bandwidth', 1, 1000, 1, 'Mbps'],
  ['dns', 'DNS lookup', 0, 400, 5, 'ms'],
  ['server', 'Server think time', 0, 2000, 10, 'ms'],
  ['db', 'Database time per API call', 0, 1500, 10, 'ms'],
  ['html', 'HTML size', 5, 500, 5, 'KB'],
  ['assets', 'CSS + JS size', 0, 5000, 50, 'KB'],
  ['imgs', 'Images', 0, 40, 1, ''],
  ['imgKB', 'Images total', 0, 20000, 100, 'KB'],
  ['apis', 'API calls', 0, 12, 1, ''],
  ['apiKB', 'Response size per call', 1, 1000, 1, 'KB'],
  ['cpu', 'Device CPU slowdown', 1, 8, 1, '×'],
];
const GR = { rtt: 'Network', server: 'Server', html: 'Page and API payload', cpu: 'Device' };
const SET = {};
let ready = false;
