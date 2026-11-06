# Latency Lab

A simple website to test how a website loads from different servers. Change latency, jitter, packet loss, bandwidth and server time, then see how the page, the API data, the SSH terminal and file transfers behave. It helps you choose a VPS location before you buy.

It is one HTML file. No build step, no dependencies, no backend, no network requests.

<!-- Add a screenshot: ![Latency Lab](docs/screenshot.png) -->

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Quick start](#quick-start)
- [Controls](#controls)
- [How the model works](#how-the-model-works)
- [Project structure](#project-structure)
- [Customize it](#customize-it)
- [Limitations](#limitations)
- [Check against real numbers](#check-against-real-numbers)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why this exists

Before you buy a server, you want to know how it will feel for your users. A ping number alone does not tell you that. A page with 4 API calls, a TLS handshake and 8 images turns 160 ms of latency into a few seconds of waiting. Latency Lab shows that visually, so you can compare locations and settings with your own app in mind.

## Features

**Page load simulation**
- Live browser preview: blank page, skeleton loaders, then real content as images and API data arrive.
- Request waterfall with DNS, connect, TLS, waiting and download segments, plus markers for TTFB, FCP, LCP and full load.
- Metric tiles for TTFB, first paint, largest paint, API data ready and fully loaded, colored good, warning or poor.
- Timeline player with replay, pause, scrubber and speed control (0.25x to 5x).
- Pin a baseline and see the difference after you change a setting.

**Server location comparison**
- Runs your current settings against typical latencies for local, same country, Singapore/Mumbai, Germany/EU, US East, US West and Australia.
- Click a row to apply that latency.

**What would help most**
- Tries changes such as HTTP/3, parallel API calls, caching, less server time, a closer location, no packet loss and TLS 1.3. Shows how many ms each one saves.

**SSH terminal**
- Type in a simulated terminal. Each key appears only after the round trip, so you feel the lag.
- SSH and Mosh modes (Mosh shows keys instantly).
- Command buttons report how long the output took, split into network time and server time.
- Estimates the SSH login time before the prompt appears.

**File download and upload**
- File size, direction, method (HTTPS, HTTP/3, SFTP/SCP, parallel streams) and stream count.
- Shows total time, average speed, how much of your link is used, the wait before data starts, and the bottleneck.
- Speed-over-time graph with an animated progress bar, and a comparison of all methods for the same file.

## Quick start

Open the file in a browser. That is all.

```bash
git clone https://github.com/<your-username>/latency-lab.git
cd latency-lab
open latency-lab.html        # macOS
xdg-open latency-lab.html    # Linux
start latency-lab.html       # Windows
```

Or serve it locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/latency-lab.html
```

**Deploy with GitHub Pages:** rename `latency-lab.html` to `index.html`, push, then turn on Pages for the branch in the repository settings.

## Controls

| Group | Control | Range | Default |
|---|---|---|---|
| Network | Latency (round trip) | 1-1000 ms | 160 |
| Network | Jitter | 0-200 ms | 15 |
| Network | Packet loss | 0-15 % | 0.5 |
| Network | Download bandwidth | 1-1000 Mbps | 50 |
| Network | Upload bandwidth | 1-1000 Mbps | 20 |
| Network | DNS lookup | 0-400 ms | 30 |
| Protocol | HTTP version | 1.1, 2, 3 | 2 |
| Protocol | TLS | 1.3, 1.2, none | 1.3 |
| Server | Server think time | 0-2000 ms | 120 |
| Server | Database time per API call | 0-1500 ms | 80 |
| Page | HTML size | 5-500 KB | 60 |
| Page | CSS + JS size | 0-5000 KB | 600 |
| Page | Images / total size | 0-40 / 0-20000 KB | 8 / 1500 |
| API | API calls | 0-12 | 4 |
| API | Response size per call | 1-1000 KB | 20 |
| API | Call pattern | sequential, parallel | sequential |
| Device | CPU slowdown | 1-8x | 4 |
| Cache | Repeat visit (static files cached) | on/off | off |

## How the model works

The simulator is a simple, readable model. It is not a packet-level network simulator. All the math is in `sim()` (page), `ftCalc()` (file transfer) and the terminal helpers.

### Connection setup

| Step | Cost |
|---|---|
| DNS | The DNS value you set |
| TCP connect | 1 RTT |
| TLS 1.3 | 1 RTT |
| TLS 1.2 | 2 RTT |
| HTTP/3 (QUIC) | 1 RTT total, transport and crypto together |
| HTTP/1.1 | Up to 6 connections, each pays its own handshake |
| HTTP/2 and HTTP/3 | One connection, requests are multiplexed |

### Each request

```
time = RTT (+/- jitter) + server time + transfer time
transfer = bytes * 8 / bandwidth
         + slow start: (ceil(log2(bytes / 14600 + 1)) - 1) * RTT
         + loss penalty: loss% * packets * RTT * 1.2
```

Slow start is reduced on reused connections (x0.4) and for HTTP/3 (x0.8). The loss penalty is halved for HTTP/3 and capped at `20 * RTT + 200 ms`. Jitter uses a seeded random generator (seed 7), so the same settings always give the same result.

### Page load order

1. Connect, then request the HTML.
2. After the HTML arrives, CSS (25% of the asset size), JS (75%) and the images start. The first image is the hero (30% of image bytes).
3. **FCP** = max(HTML end, CSS end) + 25 ms x CPU slowdown.
4. JS runs for `assetsKB * 0.3 ms * CPU slowdown`. API calls start after that, one by one or all at once.
5. Each API response renders 12 ms x CPU slowdown after it arrives.
6. **LCP** = max(FCP, hero image end, first API render). **Fully loaded** = the last request or render.

With caching on, static files cost 2 ms each. The HTML and API calls still go to the network.

### Metric thresholds (good / poor)

| Metric | Good up to | Poor above |
|---|---|---|
| TTFB | 800 ms | 1800 ms |
| First paint | 1800 ms | 3000 ms |
| Largest paint | 2500 ms | 4000 ms |
| API data ready | 2500 ms | 4000 ms |
| Fully loaded | 4000 ms | 8000 ms |

### SSH terminal

- Key echo delay = RTT +/- jitter. With packet loss, a key can stall by `1.5 * RTT + 200 ms` with a chance equal to the loss rate. Mosh shows keys with no delay.
- Typing lag rating: under 100 ms smooth, under 200 ms noticeable, under 350 ms laggy, above that painful.
- SSH login time is about `DNS + 7 * RTT + 150 ms`.
- Command time = RTT + command run time + output transfer.

### File transfer

One TCP stream cannot go faster than its window divided by the round trip time. Two limits apply to each stream:

```
window limit = window / RTT                       (4 MB for HTTPS and HTTP/3, 2 MB for SFTP/SCP)
loss limit   = 1.22 * MSS / (RTT * sqrt(loss))    (Mathis formula, MSS = 1460 bytes)

speed = min(link, streams * min(window limit, loss limit)) * 0.94
```

HTTP/3 uses a loss factor of 0.25 in the loss limit. The speed ramps up by doubling every RTT before it levels off. Setup costs 1 RTT plus TLS for HTTPS and parallel streams, 1 RTT for HTTP/3, and 7 RTT for SFTP/SCP. Uploads use the upload bandwidth.

## Project structure

Everything is in one file so it is easy to copy, host and share.

```
latency-lab/
├── latency-lab.html   # CSS + HTML + JavaScript
├── README.md
└── LICENSE
```

Inside `latency-lab.html`:

| Part | What it does |
|---|---|
| `P` | Current settings (the defaults live here) |
| `REG` | Server location presets (name, RTT in ms) |
| `C` | Slider definitions, the UI is built from this list |
| `sim(p, rtt)` | Pure function that runs the page load and returns requests and metrics |
| `metrics()`, `wf()`, `pv()`, `cmp()`, `tips()` | Render the tiles, waterfall, preview, comparison and suggestions |
| `draw()`, `tick()` | Playback of the timeline |
| `CMD`, `submit()`, `echo()`, `termInfo()` | SSH terminal |
| `ftCalc()`, `renderFT()`, `ftTick()` | File transfer model and animation |

`sim()` and `ftCalc()` only read their inputs and return data, so they are easy to move into a module and unit test.

## Customize it

**Change the defaults.** Edit the `P` object:

```js
const P = { rtt: 160, jitter: 15, loss: .5, bw: 50, up: 20, /* ... */ };
```

**Add a server location preset.** Add a row to `REG`:

```js
const REG = [['Local', 5], /* ... */ ['Japan', 200]];
```

**Add a terminal command.** Add `[command, run time ms, output KB, sample output]` to `CMD`:

```js
['du -sh /var', 120, 1, '2.4G    /var']
```

**Add a new control.** Add a row to `C` as `[key, label, min, max, step, unit]`, add a default to `P`, then use `p.<key>` inside `sim()`. The slider, number box and re-run logic are created for you.

## Limitations

This tool is for comparing options, not for exact predictions.

- No real network is used. Nothing is measured.
- No browser preload scanner, resource priorities, HTTP/2 prioritization, service workers or CDN.
- Bandwidth is shared in a simple way (one pipe for static files, one for API calls).
- No TLS session resume, DNS cache, BBR, or congestion control details.
- No server queueing, so many users at once are not simulated.
- File transfer ignores disk speed and encryption CPU limits, and has no resume.
- Region latencies are rough typical values. Your users' real latency depends on their ISP and route.

## Check against real numbers

Test a trial server and copy the results into the sliders.

```bash
ping -c 10 YOUR_SERVER_IP
mtr -rw -c 20 YOUR_SERVER_IP

curl -o /dev/null -s -w "dns:%{time_namelookup} connect:%{time_connect} tls:%{time_appconnect} ttfb:%{time_starttransfer} total:%{time_total}\n" https://YOUR_SITE

# bandwidth (run iperf3 -s on the server)
iperf3 -c YOUR_SERVER_IP
```

## Roadmap

- Share a setup through the URL
- Export results as JSON or CSV
- Import a HAR file to use your real request list
- CDN and edge cache simulation
- Unit tests for `sim()` and `ftCalc()`
- Better loss and congestion model

## Contributing

1. Fork the repo and create a branch.
2. Keep it a single file with no dependencies unless there is a strong reason.
3. If you change the model, explain the formula in the pull request and update the [How the model works](#how-the-model-works) section.
4. Open a pull request.

## License

MIT. See `LICENSE`.
