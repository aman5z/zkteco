// ============================================================
//  voip.js — Asterisk / SIP WebRTC calling via JsSIP
//  Depends on: JsSIP (CDN), shared.js (CFG, STATE, toast, el)
// ============================================================

'use strict';

/* ── State ─────────────────────────────────────────────────── */
var _voipUA          = null;   // JsSIP UA instance
var _voipSession     = null;   // active RTCSession
var _voipMuted       = false;
var _voipCallTimer   = null;
var _voipCallStart   = null;
var _voipHistory     = [];     // [{dir,peer,status,duration,ts}]
var _voipContacts    = [];     // [{name,dept,ext}]
var _voipRingtone    = null;   // Audio element for ringtone

/* ── Config helpers ─────────────────────────────────────────── */
function _voipCfg(){
  return {
    ws      : localStorage.getItem('voip_ws')          || '',
    ext     : localStorage.getItem('voip_ext')         || '',
    pass    : localStorage.getItem('voip_pass')        || '',
    realm   : localStorage.getItem('voip_realm')       || '',
    display : localStorage.getItem('voip_display_name')|| ''
  };
}

/* ── Settings page: load / save ─────────────────────────────── */
function loadVoipSettings(){
  var c = _voipCfg();
  var f = function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };
  f('sVoipWs',          c.ws);
  f('sVoipExt',         c.ext);
  f('sVoipPass',        c.pass);
  f('sVoipRealm',       c.realm);
  f('sVoipDisplayName', c.display);
}

function saveVoipSettings(){
  var g = function(id){ var e=document.getElementById(id); return e ? e.value.trim() : ''; };
  localStorage.setItem('voip_ws',           g('sVoipWs'));
  localStorage.setItem('voip_ext',          g('sVoipExt'));
  localStorage.setItem('voip_pass',         g('sVoipPass'));
  localStorage.setItem('voip_realm',        g('sVoipRealm'));
  localStorage.setItem('voip_display_name', g('sVoipDisplayName'));
  var r = document.getElementById('voipSaveResult');
  if(r){ r.textContent = '✅ Saved'; setTimeout(function(){ r.textContent=''; }, 2500); }
  toast('VoIP settings saved');
}

/* ── Registration status badge ──────────────────────────────── */
function _voipSetStatus(text, color){
  var e = document.getElementById('voipRegStatus');
  if(!e) return;
  e.textContent = text;
  e.style.color = color || 'var(--text2)';
  e.style.borderColor = color || 'var(--border2)';
}

/* ── Connect (register with Asterisk) ──────────────────────── */
function voipConnect(){
  if(typeof JsSIP === 'undefined'){
    toast('JsSIP library not loaded — check network');
    return;
  }
  var c = _voipCfg();
  if(!c.ws || !c.ext || !c.pass){
    toast('Configure VoIP settings first (Settings → VoIP / Asterisk)');
    if(typeof showPage !== 'undefined') showPage('settings');
    return;
  }

  voipDisconnect(); // clean up any existing UA

  try {
    var socket = new JsSIP.WebSocketInterface(c.ws);
    var cfg = {
      sockets       : [socket],
      uri           : 'sip:' + c.ext + '@' + (c.realm || c.ws.replace(/wss?:\/\/([^:/]+).*/,'$1')),
      password      : c.pass,
      display_name  : c.display || c.ext,
      register      : true,
      register_expires : 300,
      session_timers: false,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30
    };

    _voipUA = new JsSIP.UA(cfg);

    _voipUA.on('connecting',   function(){ _voipSetStatus('◌ Connecting…', 'var(--yellow)'); });
    _voipUA.on('connected',    function(){ _voipSetStatus('◌ Registering…', 'var(--yellow)'); });
    _voipUA.on('disconnected', function(){ _voipSetStatus('● Disconnected', 'var(--red)'); });
    _voipUA.on('registered',   function(){
      _voipSetStatus('● Registered  ext ' + c.ext, 'var(--green)');
      toast('VoIP registered as ext ' + c.ext);
    });
    _voipUA.on('unregistered', function(){ _voipSetStatus('○ Unregistered', 'var(--text2)'); });
    _voipUA.on('registrationFailed', function(e){
      _voipSetStatus('✕ Reg failed', 'var(--red)');
      toast('VoIP registration failed: ' + (e.cause||'unknown'));
    });

    _voipUA.on('newRTCSession', function(data){
      var session = data.session;
      if(session.direction === 'incoming'){
        _voipHandleIncoming(session);
      }
    });

    _voipUA.start();
  } catch(err){
    toast('VoIP connect error: ' + err.message);
    console.error('[VoIP]', err);
  }
}

function voipDisconnect(){
  if(_voipUA){
    try { _voipUA.stop(); } catch(e){}
    _voipUA = null;
  }
  _voipSession = null;
  _voipSetStatus('● Disconnected', 'var(--text2)');
  _voipStopRingtone();
  _voipHideHud();
  _voipSetActiveBody(null);
}

/* ── Outgoing call ──────────────────────────────────────────── */
function voipDirectCall(){
  var inp = document.getElementById('voipDirectDial');
  var target = inp ? inp.value.trim() : '';
  if(!target){ toast('Enter an extension or number'); return; }
  voipCallTarget(target);
  if(inp) inp.value = '';
}

function voipCallTarget(target, name){
  if(!_voipUA || !_voipUA.isRegistered()){
    toast('VoIP not connected — connect first');
    return;
  }
  if(_voipSession){ toast('Already in a call'); return; }

  var c = _voipCfg();
  var uri = target.includes('@') ? target : 'sip:' + target + '@' + (c.realm || '');

  var options = {
    mediaConstraints: { audio: true, video: false },
    pcConfig: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }
  };

  try {
    var session = _voipUA.call(uri, options);
    _voipSession = session;
    _voipBindSessionEvents(session, 'outbound', name || target);
    _voipShowCalling(name || target);
  } catch(err){
    toast('Call failed: ' + err.message);
    console.error('[VoIP]', err);
  }
}

/* ── Incoming call handling ─────────────────────────────────── */
function _voipHandleIncoming(session){
  if(_voipSession){
    // Already in call — auto-reject
    session.terminate({ status_code: 486, reason_phrase: 'Busy Here' });
    return;
  }
  _voipSession = session;
  _voipBindSessionEvents(session, 'inbound', session.remote_identity.display_name || session.remote_identity.uri.user);

  var name = session.remote_identity.display_name || session.remote_identity.uri.user;
  var label = session.remote_identity.uri.toString();

  var av  = document.getElementById('voipRingAvatar');
  var nm  = document.getElementById('voipRingName');
  var lb  = document.getElementById('voipRingLabel');
  if(av) av.textContent = (name||'?').charAt(0).toUpperCase();
  if(nm) nm.textContent = name || 'Unknown';
  if(lb) lb.textContent = label;

  var ov = document.getElementById('voipIncomingOverlay');
  if(ov) ov.classList.add('open');
  _voipPlayRingtone();
}

function voipAnswerCall(){
  var ov = document.getElementById('voipIncomingOverlay');
  if(ov) ov.classList.remove('open');
  _voipStopRingtone();
  if(!_voipSession) return;
  _voipSession.answer({ mediaConstraints: { audio: true, video: false } });
}

function voipRejectCall(){
  var ov = document.getElementById('voipIncomingOverlay');
  if(ov) ov.classList.remove('open');
  _voipStopRingtone();
  if(!_voipSession) return;
  _voipSession.terminate({ status_code: 486, reason_phrase: 'Declined' });
}

/* ── Active call controls ───────────────────────────────────── */
function voipHangup(){
  if(_voipSession){
    try { _voipSession.terminate(); } catch(e){}
  }
}

function voipToggleMute(){
  if(!_voipSession) return;
  _voipMuted = !_voipMuted;
  if(_voipMuted) _voipSession.mute(); else _voipSession.unmute();
  var btn = document.getElementById('voipMuteBtn');
  if(btn){ btn.textContent = _voipMuted ? '🔇' : '🎙'; btn.classList.toggle('muted', _voipMuted); }
}

/* ── Session event binding ──────────────────────────────────── */
function _voipBindSessionEvents(session, dir, peerName){
  session.on('progress', function(){
    if(dir === 'outbound') _voipShowCalling(peerName);
  });

  session.on('accepted', function(){
    _voipStopRingtone();
    _voipCallStart = Date.now();
    _voipStartCallTimer(peerName);
    _voipShowActive(peerName);
    _voipShowHud(peerName);
    var ov = document.getElementById('voipIncomingOverlay');
    if(ov) ov.classList.remove('open');
  });

  session.on('ended', function(e){
    _voipOnCallEnd(peerName, dir, e.cause || 'Normal');
  });

  session.on('failed', function(e){
    var cause = e.cause || 'Unknown';
    _voipOnCallEnd(peerName, dir, cause);
    if(cause !== 'Rejected' && cause !== 'Busy') toast('Call failed: ' + cause);
  });
}

function _voipOnCallEnd(peerName, dir, cause){
  var duration = _voipCallStart ? Math.floor((Date.now() - _voipCallStart) / 1000) : 0;
  var status = (cause === 'Normal clearing' || cause === 'BYE') ? 'completed'
             : (cause === 'Rejected' || cause === 'Busy')       ? 'rejected'
             : 'missed';

  _voipHistory.unshift({
    dir      : dir,
    peer     : peerName,
    status   : status,
    duration : duration,
    ts       : new Date().toISOString()
  });
  _voipSaveHistory();

  _voipSession  = null;
  _voipMuted    = false;
  _voipCallStart = null;
  clearInterval(_voipCallTimer);

  _voipStopRingtone();
  _voipHideHud();
  _voipSetActiveBody(null);
  _voipRenderHistory();

  var ov = document.getElementById('voipIncomingOverlay');
  if(ov) ov.classList.remove('open');

  // Reset mute button
  var btn = document.getElementById('voipMuteBtn');
  if(btn){ btn.textContent='🎙'; btn.classList.remove('muted'); }
}

/* ── HUD (persistent call bar) ──────────────────────────────── */
function _voipShowHud(peer){
  var hud = document.getElementById('voipHud');
  if(!hud) return;
  var p = document.getElementById('voipHudPeer');
  var s = document.getElementById('voipHudStatus');
  if(p) p.textContent = peer;
  if(s) s.textContent = '● Connected';
  hud.classList.add('active');
}

function _voipHideHud(){
  var hud = document.getElementById('voipHud');
  if(hud) hud.classList.remove('active');
  clearInterval(_voipCallTimer);
  var t = document.getElementById('voipHudTimer');
  if(t) t.textContent = '00:00';
}

function _voipStartCallTimer(peer){
  clearInterval(_voipCallTimer);
  _voipCallTimer = setInterval(function(){
    if(!_voipCallStart) return;
    var s = Math.floor((Date.now() - _voipCallStart) / 1000);
    var m = Math.floor(s / 60);
    var sec = s % 60;
    var str = (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    var t = document.getElementById('voipHudTimer');
    if(t) t.textContent = str;
    // Update in-page panel too
    var pt = document.getElementById('voipActiveTimer');
    if(pt) pt.textContent = str;
  }, 1000);
}

/* ── Active call panel ──────────────────────────────────────── */
function _voipShowCalling(peer){
  _voipSetActiveBody(
    '<div class="voip-calling-anim">' +
      '<div class="vc-avatar">' + (peer||'?').charAt(0).toUpperCase() + '</div>' +
      '<div class="vc-name">' + _esc(peer||'Unknown') + '</div>' +
      '<div class="vc-sub">Calling…</div>' +
      '<div class="voip-dots"><div class="voip-dot"></div><div class="voip-dot"></div><div class="voip-dot"></div></div>' +
      '<button class="btn btn-danger btn-sm" onclick="voipHangup()" style="margin-top:24px">📵 Cancel</button>' +
    '</div>'
  );
}

function _voipShowActive(peer){
  _voipSetActiveBody(
    '<div style="padding:16px;text-align:center">' +
      '<div class="voip-calling-anim">' +
        '<div class="vc-avatar" style="background:linear-gradient(135deg,var(--green),#005522)">' + (peer||'?').charAt(0).toUpperCase() + '</div>' +
        '<div class="vc-name">' + _esc(peer||'Unknown') + '</div>' +
        '<div class="vc-sub" id="voipActiveTimer" style="font-family:var(--mono)">00:00</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;justify-content:center;margin-top:16px">' +
        '<button class="btn btn-secondary btn-sm" onclick="voipToggleMute()" id="voipInPageMuteBtn">🎙 Mute</button>' +
        '<button class="btn btn-danger btn-sm" onclick="voipHangup()">📵 Hang Up</button>' +
      '</div>' +
    '</div>'
  );
}

function _voipSetActiveBody(html){
  var b = document.getElementById('voipActiveBody');
  if(!b) return;
  if(!html){
    b.innerHTML = '<div class="empty-state" style="padding:24px;text-align:center;color:var(--text2)">No active call</div>';
  } else {
    b.innerHTML = html;
  }
}

/* ── Ringtone ───────────────────────────────────────────────── */
function _voipPlayRingtone(){
  _voipStopRingtone();
  try {
    // Simple beep via AudioContext — no file needed
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var interval = setInterval(function(){
      if(!_voipRingtone) { clearInterval(interval); return; }
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 480;
      gain.gain.value = 0.15;
      osc.start(); osc.stop(ctx.currentTime + 0.4);
      setTimeout(function(){
        var osc2 = ctx.createOscillator();
        var g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.frequency.value = 440;
        g2.gain.value = 0.15;
        osc2.start(); osc2.stop(ctx.currentTime + 0.4);
      }, 500);
    }, 3000);
    _voipRingtone = { stop: function(){ clearInterval(interval); try{ ctx.close(); }catch(e){} } };
  } catch(e){ _voipRingtone = null; }
}

function _voipStopRingtone(){
  if(_voipRingtone){ _voipRingtone.stop(); _voipRingtone = null; }
}

/* ── Contact directory ──────────────────────────────────────── */
function voipLoadContacts(){
  // Pull from employees if available (STATE.employees set by employees.js)
  _voipContacts = [];
  if(window.STATE && Array.isArray(STATE.employees)){
    STATE.employees.forEach(function(emp){
      if(emp.badge){
        _voipContacts.push({
          name : emp.name || emp.badge,
          dept : emp.dept || emp.department || '',
          ext  : emp.ext  || emp.extension  || emp.badge
        });
      }
    });
  }
  // Also try stored manual contacts
  try {
    var stored = JSON.parse(localStorage.getItem('voip_contacts') || '[]');
    stored.forEach(function(c){ _voipContacts.push(c); });
  } catch(e){}

  _voipRenderContacts(_voipContacts);
}

function voipFilterContacts(){
  var q = (document.getElementById('voipSearchInput') || {}).value || '';
  q = q.toLowerCase();
  var filtered = _voipContacts.filter(function(c){
    return (c.name||'').toLowerCase().includes(q) ||
           (c.dept||'').toLowerCase().includes(q) ||
           (c.ext||'').toString().includes(q);
  });
  _voipRenderContacts(filtered);
}

function _voipRenderContacts(list){
  var container = document.getElementById('voipContactList');
  if(!container) return;
  if(!list || !list.length){
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:11px">No contacts.<br>Add employees or configure extensions.</div>';
    return;
  }
  container.innerHTML = list.map(function(c){
    var initials = (c.name||'?').split(' ').map(function(w){ return w[0]; }).slice(0,2).join('').toUpperCase();
    return '<div class="voip-user-card" onclick="voipCallTarget(\'' + _esc(c.ext) + '\',\'' + _esc(c.name) + '\')">' +
      '<div class="voip-user-av">' + _esc(initials) + '</div>' +
      '<div class="voip-user-info">' +
        '<div class="voip-user-name">' + _esc(c.name||c.ext) + '</div>' +
        '<div class="voip-user-dept">ext ' + _esc(String(c.ext)) + (c.dept ? ' · ' + _esc(c.dept) : '') + '</div>' +
      '</div>' +
      '<button class="voip-call-btn" onclick="event.stopPropagation();voipCallTarget(\'' + _esc(c.ext) + '\',\'' + _esc(c.name) + '\')" title="Call">📞</button>' +
    '</div>';
  }).join('');
}

/* ── Call history ───────────────────────────────────────────── */
function _voipLoadHistory(){
  try { _voipHistory = JSON.parse(localStorage.getItem('voip_history') || '[]'); } catch(e){ _voipHistory=[]; }
}

function _voipSaveHistory(){
  // Keep last 100
  if(_voipHistory.length > 100) _voipHistory = _voipHistory.slice(0, 100);
  localStorage.setItem('voip_history', JSON.stringify(_voipHistory));
}

function voipClearHistory(){
  _voipHistory = [];
  localStorage.removeItem('voip_history');
  _voipRenderHistory();
}

function _voipRenderHistory(){
  var container = document.getElementById('voipHistoryList');
  if(!container) return;
  if(!_voipHistory.length){
    container.innerHTML = '<div class="empty-state" style="padding:24px;text-align:center;color:var(--text2)">No call history</div>';
    return;
  }
  container.innerHTML = _voipHistory.map(function(h){
    var icon = h.dir === 'inbound'
      ? (h.status === 'completed' ? '📲' : '📵')
      : (h.status === 'completed' ? '📞' : '📵');
    var durStr = h.duration ? _voipFmtDur(h.duration) : '—';
    var when   = _voipFmtTime(h.ts);
    var cls    = 'voip-hist-status-' + h.status;
    return '<div class="voip-history-row">' +
      '<div class="voip-dir-icon">' + icon + '</div>' +
      '<div class="voip-hist-info">' +
        '<div class="voip-hist-peer">' + _esc(h.peer||'Unknown') + '</div>' +
        '<div class="voip-hist-time">' + when + '</div>' +
      '</div>' +
      '<span class="voip-hist-dur">' + durStr + '</span>' +
      '<span class="' + cls + '" style="font-size:10px;margin-left:6px">' + _esc(h.status) + '</span>' +
    '</div>';
  }).join('');
}

/* ── Helpers ────────────────────────────────────────────────── */
function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function _voipFmtDur(sec){
  var m = Math.floor(sec/60), s = sec%60;
  return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

function _voipFmtTime(iso){
  try {
    var d = new Date(iso);
    var now = new Date();
    var diff = (now - d) / 1000;
    if(diff < 60)   return 'just now';
    if(diff < 3600) return Math.floor(diff/60) + 'm ago';
    if(diff < 86400)return Math.floor(diff/3600) + 'h ago';
    return d.toLocaleDateString();
  } catch(e){ return ''; }
}

/* ── Init ───────────────────────────────────────────────────── */
(function _voipInit(){
  _voipLoadHistory();
  // Auto-connect if settings are present
  document.addEventListener('DOMContentLoaded', function(){
    _voipRenderHistory();
    var c = _voipCfg();
    if(c.ws && c.ext && c.pass){
      // Attempt silent auto-connect after a short delay
      setTimeout(voipConnect, 3000);
    }
  });
})();
