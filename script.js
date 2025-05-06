// script.js

// ─────────────────────────────────────────────────────────────────────────────
// 1) GLOBAL CONFIG & MOBILE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
const API_KEY           = "pk_0b8abc6f834b444f949f727e88a728e0";
const STATION_ID        = "cutters-choice-radio";
const BASE_URL          = "https://api.radiocult.fm/api";
const FALLBACK_ART      = "https://i.imgur.com/qWOfxOS.png";
const MIXCLOUD_PASSWORD = "cutters44";
const isMobile          = /Mobi|Android/i.test(navigator.userAgent);

// ─────────────────────────────────────────────────────────────────────────────
// 2) HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE`
    + `&text=${encodeURIComponent(title)}`
    + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`
    + `&details=Tune in live at https://cutterschoiceradio.com`
    + `&location=https://cutterschoiceradio.com`;
}

async function rcFetch(path) {
  const res = await fetch(BASE_URL + path, {
    headers: { "x-api-key": API_KEY }
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

function shuffleIframesDaily() {
  const container = document.getElementById("mixcloud-list");
  if (!container) return;
  const iframes = Array.from(container.querySelectorAll("iframe"));
  const today = new Date().toISOString().split("T")[0];
  if (localStorage.getItem("lastShuffleDate") === today) return;
  for (let i = iframes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [iframes[i], iframes[j]] = [iframes[j], iframes[i]];
  }
  container.innerHTML = "";
  iframes.forEach(ifr => container.appendChild(ifr));
  localStorage.setItem("lastShuffleDate", today);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) DATA FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

// 3a) Live‐now (fills #now-dj and #now-art)
async function fetchLiveNow() {
  try {
    const { result } = await rcFetch(`/station/${STATION_ID}/schedule/live`);
    const { metadata: md = {}, content: ct = {} } = result;
    document.getElementById("now-dj").textContent =
      md.artist
        ? `${md.artist} – ${md.title}`
        : (ct.title || "No live show");
    document.getElementById("now-art").src = md.artwork_url || FALLBACK_ART;
  } catch (e) {
    console.error("Live‐now fetch error:", e);
    document.getElementById("now-dj").textContent = "Error fetching live info";
    document.getElementById("now-art").src = FALLBACK_ART;
  }
}

// 3b) Weekly schedule (untouched)
async function fetchWeeklySchedule() {
  const container = document.getElementById("schedule-container");
  if (!container) return;
  container.innerHTML = "<p>Loading this week's schedule…</p>";
  try {
    const now  = new Date();
    const then = new Date(now.getTime() + 7*24*60*60*1000);
    const { schedules } = await rcFetch(
      `/station/${STATION_ID}/schedule?startDate=${now.toISOString()}&endDate=${then.toISOString()}`
    );
    if (!schedules.length) {
      container.innerHTML = "<p>No shows scheduled this week.</p>";
      return;
    }
    const byDay = schedules.reduce((acc, ev) => {
      const day = new Date(ev.startDateUtc).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "short"
      });
      (acc[day] = acc[day] || []).push(ev);
      return acc;
    }, {});
    container.innerHTML = "";
    const fmtTime = iso => new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit"
    });
    Object.entries(byDay).forEach(([day, events]) => {
      const h3 = document.createElement("h3");
      h3.textContent = day;
      container.appendChild(h3);
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.padding   = "0";
      events.forEach(ev => {
        const li   = document.createElement("li");
        li.style.marginBottom = "1rem";
        const wrap = document.createElement("div");
        wrap.style.display    = "flex";
        wrap.style.alignItems = "center";
        wrap.style.gap        = "8px";

        const t = document.createElement("strong");
        t.textContent = `${fmtTime(ev.startDateUtc)}–${fmtTime(ev.endDateUtc)}`;
        wrap.appendChild(t);

        const art = ev.metadata?.artwork?.default || ev.metadata?.artwork?.original;
        if (art) {
          const img = document.createElement("img");
          img.src           = art;
          img.alt           = `${ev.title} artwork`;
          img.style.cssText = "width:30px;height:30px;object-fit:cover;border-radius:3px;";
          wrap.appendChild(img);
        }

        const titleSpan = document.createElement("span");
        titleSpan.textContent = ev.title;
        wrap.appendChild(titleSpan);

        if (!/archive/i.test(ev.title)) {
          const calBtn = document.createElement("a");
          calBtn.href      = createGoogleCalLink(ev.title, ev.startDateUtc, ev.endDateUtc);
          calBtn.target    = "_blank";
          calBtn.innerHTML = "📅";
          calBtn.style.cssText = "font-size:1.4rem;text-decoration:none;margin-left:6px;";
          wrap.appendChild(calBtn);
        }

        li.appendChild(wrap);
        ul.appendChild(li);
      });
      container.appendChild(ul);
    });
  } catch (e) {
    console.error("Schedule error:", e);
    container.innerHTML = "<p>Error loading schedule.</p>";
  }
}

// 3c) Archive “Now Playing” (fills #now-archive)
async function fetchNowPlayingArchive() {
  try {
    const { result } = await rcFetch(`/station/${STATION_ID}/schedule/live`);
    const { metadata: md = {}, content: ct = {} } = result;
    const el = document.getElementById("now-archive");
    if (md.title) {
      el.textContent = `Now Playing: ${md.artist ? md.artist + " – " : ""}${md.title}`;
    }
    else if (md.filename) {
      el.textContent = `Now Playing: ${md.filename}`;
    }
    else if (ct.title) {
      el.textContent = `Now Playing: ${ct.title}`;
    }
    else if (ct.name) {
      el.textContent = `Now Playing: ${ct.name}`;
    }
    else {
      el.textContent = "Now Playing: Unknown Show";
    }
  } catch (err) {
    console.error("Archive‐now fetch error:", err);
    document.getElementById("now-archive").textContent =
      "Unable to load archive show";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) ADMIN & UI ACTIONS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function addMixcloud()    { /* … */ }
function deleteMixcloud() { /* … */ }
function openChatPopup()  { /* … */ }
function closeChatModal() { /* … */ }

// ─────────────────────────────────────────────────────────────────────────────
// 5) INITIALIZE ON DOM READY + WAVEFORM INJECTION
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // a) Dynamic data
  fetchLiveNow();
  fetchWeeklySchedule();
  fetchNowPlayingArchive();

  // b) Auto-refresh
  setInterval(fetchLiveNow,           30000);
  setInterval(fetchNowPlayingArchive, 30000);

  // c) Mixcloud handling
  if (isMobile) {
    document.querySelector(".mixcloud")?.remove();
  } else {
    document.querySelectorAll("iframe.mixcloud-iframe")
      .forEach(ifr => ifr.src = ifr.dataset.src);
    shuffleIframesDaily();
    const mc = document.createElement("script");
    mc.src   = "https://widget.mixcloud.com/widget.js";
    mc.async = true;
    document.body.appendChild(mc);
  }

  // d) Pop-out player
  document.getElementById("popOutBtn")?.addEventListener("click", () => {
    const src = document.getElementById("inlinePlayer").src;
    const w   = window.open("", "CCRPlayer", "width=400,height=200,resizable=yes");
    w.document.write(`
      <!DOCTYPE html><html lang="en"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Cutters Choice Player</title><style>
      body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh;}
      iframe{width:100%;height:180px;border:none;border-radius:4px;}
      </style></head><body><iframe src="${src}" allow="autoplay"></iframe></body></html>`);
    w.document.close();
  });

  // e) Waveform canvas & analyzer injection
  (function(){
    const header = document.querySelector("header");
    if (!header) return;

    // create or select canvas
    let canvas = document.getElementById("waveform");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "waveform";
      header.insertBefore(canvas, header.firstChild);
    }

    // ensure header is positioning context
    header.style.position = header.style.position || "relative";

    // lift logo/title above
    header.querySelectorAll(".logo-container, .title").forEach(el => {
      el.style.position = "relative";
      el.style.zIndex   = "1";
    });

    // insert hidden audio
    let audio = document.getElementById("analyzer");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id          = "analyzer";
      audio.src         = "https://cutters-choice-radio.radiocult.fm/stream";
      audio.crossOrigin = "anonymous";
      audio.autoplay    = true;
      audio.muted       = true;
      audio.style.display = "none";
      header.appendChild(audio);
    }

    const ctx    = canvas.getContext("2d");
    const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const srcNode  = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    srcNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray    = new Uint8Array(bufferLength);

    function resizeCanvas(){
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function draw(){
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.lineWidth   = 2;
      ctx.strokeStyle = 'var(--brand-teal)';
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i=0; i<bufferLength; i++){
        const v = dataArray[i]/128.0;
        const y = (v*canvas.height)/2;
        if (i===0) ctx.moveTo(x,y);
        else       ctx.lineTo(x,y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height/2);
      ctx.stroke();
    }
    draw();

    // resume AudioContext on first click
    document.body.addEventListener("click", () => {
      if (audioCtx.state === "suspended") audioCtx.resume();
    });
  })();
});
