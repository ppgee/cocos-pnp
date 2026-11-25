import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ALL_CHANNEL_IDS,
  CHANNEL_SPECS,
  loadArtifact,
  resolveChannel,
  validatePlayable,
  type ChannelId,
  type LoadedArtifact,
  type ValidationReport
} from '@cocos-pnp/playable-validator';
import { generateValidationHtmlReport } from './html-report.js';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm'
};

function buildSandboxBridgeScript(channel: ChannelId): string {
  const spec = CHANNEL_SPECS[channel];
  const mraidVersion = spec.mraidVersion || '2.0';
  const enableMraid = channel === 'applovin' || channel === 'unity' || channel === 'liftoff';
  const enableFb = channel === 'meta' || channel === 'moloco';

  return `<script data-id="playable-preview-host">(function(){
  var CHANNEL=${JSON.stringify(channel)};
  var interacted=false;
  var viewable=true;
  var muted=false;
  var listeners={};

  function emit(kind,title,detail){
    try{
      window.parent.postMessage({__playablePreview:true,kind:kind,channel:CHANNEL,title:title,detail:detail||'',ts:Date.now()},'*');
    }catch(_){}
  }

  ['pointerdown','touchstart','mousedown','keydown','click'].forEach(function(evt){
    window.addEventListener(evt,function(){
      if(!interacted){interacted=true;emit('lifecycle','User Interaction','First user gesture detected ('+evt+')');}
    },true);
  });

  // Error & console.error capture
  window.addEventListener('error',function(e){emit('error','Uncaught Error',e.message||String(e));});
  window.addEventListener('unhandledrejection',function(e){emit('error','Unhandled Promise Rejection',String(e.reason||''));});
  if(console&&console.error){
    var origErr=console.error.bind(console);
    console.error=function(){
      emit('error','console.error',Array.from(arguments).map(String).join(' '));
      return origErr.apply(console,arguments);
    };
  }

  // Audio pre-interaction guard
  if(typeof HTMLMediaElement!=='undefined'&&HTMLMediaElement.prototype.play){
    var origPlay=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(!this.muted&&this.volume!==0&&!interacted){
        emit('audio','Autoplay Audio Blocked Warning','<'+this.tagName.toLowerCase()+'>.play() called before first user interaction');
      }
      return origPlay.apply(this,arguments);
    };
  }
  var AC=window.AudioContext||window.webkitAudioContext;
  if(AC&&AC.prototype&&AC.prototype.resume){
    var origResume=AC.prototype.resume;
    AC.prototype.resume=function(){
      if(!interacted){emit('audio','AudioContext Warning','AudioContext.resume() called before first user interaction');}
      return origResume.apply(this,arguments);
    };
  }

  // External fetch monitor
  if(window.fetch){
    var origFetch=window.fetch;
    window.fetch=function(input){
      var u=typeof input==='string'?input:(input&&input.url)||'';
      if(/^https?:\\/\\//i.test(u)&&u.indexOf(location.origin)!==0){
        emit('network','External Fetch Detected',u);
      }
      return origFetch.apply(this,arguments);
    };
  }

  // Channel host bridges
  if(${JSON.stringify(enableMraid)}){
    window.mraid={
      getVersion:function(){return ${JSON.stringify(mraidVersion)};},
      getState:function(){return 'default';},
      isViewable:function(){return viewable;},
      getPlacementType:function(){return 'interstitial';},
      getScreenSize:function(){return {width:window.innerWidth,height:window.innerHeight};},
      getMaxSize:function(){return {width:window.innerWidth,height:window.innerHeight};},
      addEventListener:function(ev,fn){
        listeners[ev]=listeners[ev]||[];
        listeners[ev].push(fn);
        emit('lifecycle','mraid.addEventListener',ev);
        if(ev==='ready') setTimeout(function(){fn();},0);
        if(ev==='viewableChange') setTimeout(function(){fn(viewable);},0);
      },
      removeEventListener:function(ev,fn){
        if(!listeners[ev]) return;
        listeners[ev]=listeners[ev].filter(function(f){return f!==fn;});
      },
      open:function(url){emit('cta','mraid.open',url||'(default store url)');},
      close:function(){emit('lifecycle','mraid.close','');}
    };
  }
  if(${JSON.stringify(channel === 'google')}){
    window.ExitApi={exit:function(){emit('cta','ExitApi.exit','Store redirect triggered');}};
  }
  if(${JSON.stringify(enableFb)}){
    window.FbPlayableAd={onCTAClick:function(){emit('cta','FbPlayableAd.onCTAClick',arguments.length?'Warning: unexpected args passed':'Store redirect triggered');}};
  }
  if(${JSON.stringify(channel === 'tiktok')}){
    window.openAppStore=function(){emit('cta','window.openAppStore','Store redirect triggered');};
    window.playableSDK={openAppStore:function(){emit('cta','playableSDK.openAppStore','Store redirect triggered');}};
  }
  if(${JSON.stringify(channel === 'mintegral')}){
    window.gameReady=function(){emit('lifecycle','window.gameReady','Playable signaled ready');};
    window.gameEnd=function(){emit('lifecycle','window.gameEnd','Gameplay ended');};
    window.install=function(){emit('cta','window.install','Store redirect triggered');};
  }

  // Control messages from outer preview workbench
  window.addEventListener('message',function(ev){
    var d=ev.data;
    if(!d||!d.__playableHostCmd) return;
    if(d.cmd==='setMuted'){
      muted=Boolean(d.value);
      emit('lifecycle','Host Mute Toggle',muted?'Muted (volume=0)':'Unmuted (volume=100)');
      (listeners.audioVolumeChange||[]).forEach(function(fn){try{fn(muted?0:100);}catch(_){}});
      window.dispatchEvent(new Event(muted?'ad-event-pause':'ad-event-resume'));
    }else if(d.cmd==='setViewable'){
      viewable=Boolean(d.value);
      emit('lifecycle','Host Viewable Toggle',viewable?'viewable=true':'viewable=false (background)');
      (listeners.viewableChange||[]).forEach(function(fn){try{fn(viewable);}catch(_){}});
      if(viewable&&typeof window.gameStart==='function') try{window.gameStart();}catch(_){}
      if(!viewable&&typeof window.gameClose==='function') try{window.gameClose();}catch(_){}
    }
  });

  emit('lifecycle','Host Bridge Ready',CHANNEL+' ('+${JSON.stringify(spec.displayName)}+')');
})();</script>`;
}

function injectBridgeIntoHtml(html: string, channel: ChannelId): string {
  const snippet = buildSandboxBridgeScript(channel);
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${snippet}\n`);
  }
  return `${snippet}\n${html}`;
}

function buildWorkbenchHtml(
  artifact: LoadedArtifact,
  staticReport: ValidationReport,
  initialChannel: ChannelId
): string {
  const entryPath = (artifact.entryHtmlPath || 'index.html').replace(/^\/+/, '');
  const payload = JSON.stringify({
    inputPath: artifact.inputPath,
    format: artifact.format,
    entryPath,
    initialChannel,
    sizeBytes: staticReport.sizeBreakdown.totalBytes,
    fileCount: staticReport.sizeBreakdown.fileCount,
    sizeBreakdown: staticReport.sizeBreakdown,
    channels: ALL_CHANNEL_IDS.map((id) => {
      const ch = staticReport.channels.find((c) => c.channel === id);
      const spec = CHANNEL_SPECS[id];
      const limitBytes =
        artifact.format === 'single-html'
          ? (spec.maxSingleHtmlBytes ?? spec.maxZipBytes ?? 5 * 1024 * 1024)
          : (spec.maxZipBytes ?? spec.maxSingleHtmlBytes ?? 5 * 1024 * 1024);
      return {
        id,
        displayName: spec.displayName,
        limitBytes,
        passed: ch?.passed ?? false,
        errorCount: ch?.errorCount ?? 0,
        warningCount: ch?.warningCount ?? 0,
        diagnostics: ch?.diagnostics ?? []
      };
    })
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Playable Preview Workbench</title>
  <style>
    :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; --ok:#3fb950; --err:#f85149; --warn:#d29922; }
    * { box-sizing:border-box; }
    html,body { margin:0; padding:0; height:100%; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:13px; }
    .app { display:grid; grid-template-rows:52px 1fr; height:100vh; }
    .topbar { display:flex; align-items:center; gap:10px; padding:0 16px; background:var(--panel); border-bottom:1px solid var(--border); flex-wrap:wrap; }
    .brand { font-weight:700; color:var(--text); margin-right:6px; }
    select, button { background:#21262d; color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-size:12px; cursor:pointer; }
    button:hover, select:hover { border-color:var(--accent); }
    button.active { background:#1f6feb; border-color:#1f6feb; color:#fff; }
    .spacer { flex:1; }
    .main { display:grid; grid-template-columns:1fr 380px; min-height:0; }
    .stage-wrap { display:flex; align-items:center; justify-content:center; padding:20px; overflow:auto; background:radial-gradient(circle at center,#161f2e 0%,#0d1117 70%); }
    .device { background:#000; border:10px solid #262c36; border-radius:28px; box-shadow:0 20px 60px rgba(0,0,0,0.6); overflow:hidden; transition:width .2s,height .2s; }
    .device iframe { display:block; width:100%; height:100%; border:0; background:#000; }
    .sidebar { display:flex; flex-direction:column; border-left:1px solid var(--border); background:var(--panel); min-height:0; }
    .section { padding:12px 14px; border-bottom:1px solid var(--border); }
    .section-title { font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.6px; color:var(--muted); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; }
    .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
    .badge.ok { background:rgba(63,185,80,0.18); color:var(--ok); }
    .badge.err { background:rgba(248,81,73,0.18); color:var(--err); }
    .cta-box { padding:10px; border-radius:8px; border:1px dashed var(--border); color:var(--muted); font-size:12px; }
    .cta-box.hit { border-style:solid; border-color:var(--ok); background:rgba(63,185,80,0.12); color:var(--text); }
    .events { flex:1; overflow-y:auto; padding:10px 14px; display:flex; flex-direction:column; gap:6px; }
    .evt { padding:7px 9px; border-radius:6px; background:#0d1117; border-left:3px solid var(--accent); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11.5px; word-break:break-word; }
    .evt.cta { border-left-color:var(--ok); }
    .evt.error, .evt.audio, .evt.network { border-left-color:var(--err); }
    .evt .meta { color:var(--muted); font-size:10.5px; margin-bottom:2px; }
    .diag-list { display:flex; flex-direction:column; gap:6px; font-size:11.5px; }
    .diag-card { padding:7px 9px; border-radius:6px; background:#0d1117; border-left:3px solid var(--border); }
    .diag-card.err { border-left-color:var(--err); }
    .diag-card.warn { border-left-color:var(--warn); }
    .diag-card.info { border-left-color:var(--accent); }
    .diag-fix { color:#79c0ff; margin-top:3px; font-size:11px; }
    .tabs { display:flex; border-bottom:1px solid var(--border); background:#0d1117; }
    .tab-btn { flex:1; border:0; border-radius:0; background:transparent; color:var(--muted); padding:9px 8px; font-weight:600; border-bottom:2px solid transparent; }
    .tab-btn.active { color:var(--text); border-bottom-color:var(--accent); background:var(--panel); }
    .tab-pane { display:none; flex:1; overflow-y:auto; padding:12px 14px; flex-direction:column; gap:10px; min-height:0; }
    .tab-pane.active { display:flex; }
    .stack-bar { display:flex; height:10px; border-radius:999px; overflow:hidden; background:#21262d; }
    .size-row { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid rgba(48,54,61,0.5); font-size:11.5px; }
    .size-row .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:230px; }
    .quota-bar { height:6px; background:#21262d; border-radius:999px; overflow:hidden; margin-top:4px; }
    .quota-fill { height:100%; background:var(--ok); }
    .quota-fill.warn { background:var(--warn); }
    .quota-fill.err { background:var(--err); }
  </style>
</head>
<body>
  <div class="app">
    <div class="topbar">
      <span class="brand">Playable Preview</span>
      <select id="channelSelect"></select>
      <button id="btnPortrait" class="active">Portrait 390x844</button>
      <button id="btnLandscape">Landscape 844x390</button>
      <button id="btnTablet">Tablet 768x1024</button>
      <button id="btnMute">Mute: OFF</button>
      <button id="btnViewable">Viewable: ON</button>
      <button id="btnReload">Reload</button>
      <a href="/api/report.html" download="playable-audit-report.html" style="text-decoration:none;"><button type="button" id="btnExportReport">Export HTML Report</button></a>
      <span class="spacer"></span>
      <span id="metaInfo" style="color:var(--muted);font-size:12px;"></span>
    </div>
    <div class="main">
      <div class="stage-wrap">
        <div id="deviceFrame" class="device" style="width:390px;height:844px;">
          <iframe id="sandbox"></iframe>
        </div>
      </div>
      <div class="sidebar">
        <div class="section">
          <div class="section-title">
            <span>Live CTA Probe</span>
            <span id="staticBadge" class="badge ok">PASS</span>
          </div>
          <div id="ctaBox" class="cta-box">Click your CTA button inside the playable to verify store redirect API...</div>
        </div>
        <div class="tabs">
          <button class="tab-btn active" data-tab="events">Events</button>
          <button class="tab-btn" data-tab="compliance">Compliance</button>
          <button class="tab-btn" data-tab="size">Size</button>
        </div>
        <div id="pane-events" class="tab-pane active">
          <div class="section-title" style="margin-bottom:2px;">
            <span>Runtime Event Log</span>
            <button id="btnClear" style="padding:2px 8px;font-size:11px;">Clear</button>
          </div>
          <div id="eventLog" class="events" style="padding:0;"></div>
        </div>
        <div id="pane-compliance" class="tab-pane">
          <div class="section-title" style="margin-bottom:2px;">
            <span>Channel Diagnostics</span>
            <span id="diagSummary" style="color:var(--muted);font-weight:400;"></span>
          </div>
          <div id="diagList" class="diag-list"></div>
        </div>
        <div id="pane-size" class="tab-pane">
          <div class="section-title" style="margin-bottom:2px;">
            <span>Package Quota &amp; Breakdown</span>
            <span id="quotaText" style="color:var(--muted);font-weight:400;"></span>
          </div>
          <div class="quota-bar"><div id="quotaFill" class="quota-fill" style="width:0%"></div></div>
          <div id="b64Notice" style="color:var(--muted);font-size:11.5px;"></div>
          <div id="sizeStack" class="stack-bar"></div>
          <div id="sizeTopList"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const DATA = ${payload};
    const channelSelect = document.getElementById('channelSelect');
    const sandbox = document.getElementById('sandbox');
    const deviceFrame = document.getElementById('deviceFrame');
    const staticBadge = document.getElementById('staticBadge');
    const diagList = document.getElementById('diagList');
    const diagSummary = document.getElementById('diagSummary');
    const quotaText = document.getElementById('quotaText');
    const quotaFill = document.getElementById('quotaFill');
    const b64Notice = document.getElementById('b64Notice');
    const sizeStack = document.getElementById('sizeStack');
    const sizeTopList = document.getElementById('sizeTopList');
    const ctaBox = document.getElementById('ctaBox');
    const eventLog = document.getElementById('eventLog');
    const metaInfo = document.getElementById('metaInfo');
    const btnMute = document.getElementById('btnMute');
    const btnViewable = document.getElementById('btnViewable');

    let currentChannel = DATA.initialChannel;
    let isMuted = false;
    let isViewable = true;

    function fmtBytes(b) {
      if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB';
      if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
      return b + ' B';
    }

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + target));
      });
    });

    metaInfo.textContent = DATA.format + ' | ' + fmtBytes(DATA.sizeBytes) + ' | ' + DATA.fileCount + ' file(s)';

    for (const ch of DATA.channels) {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.displayName + (ch.passed ? ' [PASS]' : ' [' + ch.errorCount + ' err]');
      if (ch.id === currentChannel) opt.selected = true;
      channelSelect.appendChild(opt);
    }

    function addEvent(kind, title, detail) {
      const el = document.createElement('div');
      el.className = 'evt ' + kind;
      const time = new Date().toLocaleTimeString();
      el.innerHTML = '<div class="meta">[' + time + '] ' + kind.toUpperCase() + ' - ' + title + '</div><div>' + String(detail || '').replace(/</g, '&lt;') + '</div>';
      eventLog.prepend(el);
    }

    function renderSizePanel(ch) {
      const sb = DATA.sizeBreakdown;
      const pct = Math.min(100, (sb.totalBytes / Math.max(1, ch.limitBytes)) * 100);
      quotaText.textContent = fmtBytes(sb.totalBytes) + ' / ' + fmtBytes(ch.limitBytes);
      quotaFill.style.width = pct.toFixed(1) + '%';
      quotaFill.className = 'quota-fill' + (sb.totalBytes > ch.limitBytes ? ' err' : pct >= 85 ? ' warn' : '');
      b64Notice.textContent = sb.inlineBase64Bytes > 0
        ? 'Inline Base64: ' + fmtBytes(sb.inlineBase64Bytes) + ' (~' + fmtBytes(sb.estimatedBase64OverheadBytes) + ' overhead)'
        : 'Inline Base64: 0 B';

      const total = Math.max(1, sb.uncompressedBytes);
      const colors = ['#58a6ff', '#a371f7', '#3fb950', '#d29922', '#f85149', '#f0883e', '#8b949e'];
      const cats = Object.entries(sb.byCategory || {}).sort((a, b) => b[1] - a[1]);
      sizeStack.innerHTML = cats.map(([cat, bytes], i) =>
        '<div style="width:' + ((bytes / total) * 100).toFixed(2) + '%;background:' + colors[i % colors.length] + '" title="' + cat + ': ' + fmtBytes(bytes) + '"></div>'
      ).join('');

      sizeTopList.innerHTML = '';
      for (const item of (sb.topContributors || []).slice(0, 10)) {
        const row = document.createElement('div');
        row.className = 'size-row';
        const left = document.createElement('span');
        left.className = 'mono';
        left.title = item.label;
        left.textContent = item.label;
        const right = document.createElement('span');
        right.textContent = fmtBytes(item.bytes);
        row.appendChild(left);
        row.appendChild(right);
        sizeTopList.appendChild(row);
      }
    }

    function renderStaticInfo() {
      const ch = DATA.channels.find((c) => c.id === currentChannel);
      if (!ch) return;
      staticBadge.className = 'badge ' + (ch.passed ? 'ok' : 'err');
      staticBadge.textContent = ch.passed ? 'PASS' : ch.errorCount + ' ERROR(S)';
      diagSummary.textContent = ch.errorCount + ' err / ' + ch.warningCount + ' warn';
      diagList.innerHTML = '';
      if (ch.diagnostics.length === 0) {
        diagList.innerHTML = '<div style="color:var(--ok);">All static compliance checks passed for ' + ch.displayName + '.</div>';
      } else {
        for (const d of ch.diagnostics) {
          const card = document.createElement('div');
          card.className = 'diag-card ' + (d.severity === 'error' ? 'err' : d.severity === 'warning' ? 'warn' : 'info');
          const head = document.createElement('div');
          head.style.fontWeight = '700';
          head.textContent = '[' + d.severity.toUpperCase() + '] ' + d.code;
          const msg = document.createElement('div');
          msg.textContent = d.message;
          card.appendChild(head);
          card.appendChild(msg);
          if (d.suggestion) {
            const fix = document.createElement('div');
            fix.className = 'diag-fix';
            fix.textContent = 'Fix: ' + d.suggestion;
            card.appendChild(fix);
          }
          diagList.appendChild(card);
        }
      }
      renderSizePanel(ch);
    }

    function loadChannel(ch) {
      currentChannel = ch;
      isMuted = false;
      isViewable = true;
      btnMute.textContent = 'Mute: OFF';
      btnViewable.textContent = 'Viewable: ON';
      ctaBox.className = 'cta-box';
      ctaBox.textContent = 'Click your CTA button inside the playable to verify store redirect API...';
      renderStaticInfo();
      sandbox.src = '/sandbox/' + encodeURI(DATA.entryPath) + '?__preview_channel=' + encodeURIComponent(ch) + '&t=' + Date.now();
    }

    function setSize(w, h, activeId) {
      deviceFrame.style.width = w + 'px';
      deviceFrame.style.height = h + 'px';
      ['btnPortrait', 'btnLandscape', 'btnTablet'].forEach((id) => {
        document.getElementById(id).classList.toggle('active', id === activeId);
      });
    }

    channelSelect.addEventListener('change', () => loadChannel(channelSelect.value));
    document.getElementById('btnPortrait').addEventListener('click', () => setSize(390, 844, 'btnPortrait'));
    document.getElementById('btnLandscape').addEventListener('click', () => setSize(844, 390, 'btnLandscape'));
    document.getElementById('btnTablet').addEventListener('click', () => setSize(768, 1024, 'btnTablet'));
    document.getElementById('btnReload').addEventListener('click', () => loadChannel(currentChannel));
    document.getElementById('btnClear').addEventListener('click', () => { eventLog.innerHTML = ''; });

    btnMute.addEventListener('click', () => {
      isMuted = !isMuted;
      btnMute.textContent = 'Mute: ' + (isMuted ? 'ON' : 'OFF');
      sandbox.contentWindow && sandbox.contentWindow.postMessage({ __playableHostCmd: true, cmd: 'setMuted', value: isMuted }, '*');
    });

    btnViewable.addEventListener('click', () => {
      isViewable = !isViewable;
      btnViewable.textContent = 'Viewable: ' + (isViewable ? 'ON' : 'OFF');
      sandbox.contentWindow && sandbox.contentWindow.postMessage({ __playableHostCmd: true, cmd: 'setViewable', value: isViewable }, '*');
    });

    window.addEventListener('message', (ev) => {
      const d = ev.data;
      if (!d) return;
      if (d === 'download') {
        ctaBox.className = 'cta-box hit';
        ctaBox.innerHTML = '<strong>CTA Triggered:</strong> parent.postMessage("download", "*")';
        addEvent('cta', 'Liftoff/Vungle postMessage', 'download');
        return;
      }
      if (d === 'complete') {
        addEvent('lifecycle', 'Liftoff/Vungle postMessage', 'complete');
        return;
      }
      if (!d.__playablePreview) return;
      if (d.kind === 'cta') {
        ctaBox.className = 'cta-box hit';
        ctaBox.innerHTML = '<strong>CTA Triggered:</strong> ' + d.title + (d.detail ? ' — ' + d.detail : '');
      }
      addEvent(d.kind, d.title, d.detail);
    });

    loadChannel(currentChannel);
  </script>
</body>
</html>`;
}

export interface PreviewServerOptions {
  inputPath: string;
  channel?: string;
  port?: number;
  host?: string;
}

export interface PreviewServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export async function startPreviewServer(
  options: PreviewServerOptions
): Promise<PreviewServerHandle> {
  const artifact = await loadArtifact(options.inputPath);
  const initialChannel: ChannelId = options.channel
    ? resolveChannel(options.channel).id
    : 'applovin';

  const staticReport = await validatePlayable({
    inputPath: options.inputPath,
    channels: ['all'],
    staticOnly: true
  });

  const fileMap = new Map<string, { content: Buffer; mime: string }>();
  for (const entry of artifact.entries) {
    fileMap.set(entry.path.replace(/^\/+/, ''), {
      content: entry.content,
      mime: MIME_MAP[entry.ext] || 'application/octet-stream'
    });
  }

  const entryRel = (artifact.entryHtmlPath || 'index.html').replace(/^\/+/, '');
  const workbenchHtml = buildWorkbenchHtml(artifact, staticReport, initialChannel);

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(workbenchHtml);
      return;
    }

    if (pathname === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          inputPath: artifact.inputPath,
          format: artifact.format,
          entryHtmlPath: entryRel,
          initialChannel,
          staticReport
        })
      );
      return;
    }

    if (pathname === '/api/report.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="playable-audit-report.html"'
      });
      res.end(generateValidationHtmlReport(staticReport));
      return;
    }

    if (pathname.startsWith('/sandbox/')) {
      const rel = pathname.slice('/sandbox/'.length).replace(/^\/+/, '') || entryRel;
      const lowerRel = rel.toLowerCase();

      if ((lowerRel.endsWith('mraid.js') || lowerRel.endsWith('playable-sdk.js')) && !fileMap.has(rel)) {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(`/* ${rel} mocked by playable preview server */`);
        return;
      }

      const hit = fileMap.get(rel);
      if (!hit) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Not found in artifact: ${rel}`);
        return;
      }

      if (rel === entryRel) {
        const chParam = parsedUrl.searchParams.get('__preview_channel');
        let ch: ChannelId = initialChannel;
        if (chParam) {
          try {
            ch = resolveChannel(chParam).id;
          } catch {
            ch = initialChannel;
          }
        }
        const injected = injectBridgeIntoHtml(hit.content.toString('utf-8'), ch);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(injected);
        return;
      }

      res.writeHead(200, { 'Content-Type': hit.mime });
      res.end(hit.content);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  const host = options.host || '127.0.0.1';
  const port = options.port ?? 4173;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const url = `http://${host}:${addr.port}/`;

  return {
    url,
    port: addr.port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      })
  };
}
