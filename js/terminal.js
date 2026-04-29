// ===========================================================================
//  TERMINAL — ttyd iframe (Linode Shell)
// ===========================================================================
let _termPopup=null;
function _termUrl(){
  return (ls('termWsUrl')||'').trim() || (el('sTermWsUrl')&&el('sTermWsUrl').value||'').trim();
}
function loadTerminalFrame(){
  const url=_termUrl();
  if(!url){showTermSetup();return;}
  lset('termWsUrl',url);
  if(el('termUrlInput'))el('termUrlInput').value=url;
  el('termConnLabel').textContent=url;
  let finalUrl = url;
  if (location.protocol === 'https:' && url.startsWith('http:')) {
    finalUrl = url.replace('http:', 'https:').replace(':7682', ':7683'); // Use secure WS port if defined
  }
  el('termIframe').src=finalUrl;
  el('termSetupScreen').style.display='none';
  el('termIframeWrap').style.display='flex';
}
function showTermSetup(){
  const url=_termUrl();
  if(el('termUrlInput'))el('termUrlInput').value=url||'';
  el('termSetupScreen').style.display='flex';
  el('termIframeWrap').style.display='none';
}
function connectTerminalNow(){
  const input=el('termUrlInput');
  const url=(input?input.value.trim():'')||_termUrl();
  if(!url){if(el('termConnStatus'))el('termConnStatus').textContent='⚠ Please enter a server URL first.';return;}
  lset('termWsUrl',url);
  if(el('termConnStatus'))el('termConnStatus').textContent='';
  el('termConnLabel').textContent=url;
  let finalUrl = url;
  if (location.protocol === 'https:' && url.startsWith('http:')) {
    finalUrl = url.replace('http:', 'https:').replace(':7682', ':7683');
  }
  el('termIframe').src=finalUrl;
  el('termSetupScreen').style.display='none';
  el('termIframeWrap').style.display='flex';
}
function termOpenPopup(){
  const url=_termUrl()||(el('termUrlInput')&&el('termUrlInput').value.trim())||'';
  if(!url){toast('⚠ No terminal URL set');return;}
  if(_termPopup&&!_termPopup.closed){_termPopup.focus();return;}
  _termPopup=window.open(url,'ttyd_terminal','width=1100,height=700,resizable=yes,scrollbars=no');
  if(!_termPopup)toast('⚠ Popup blocked — allow popups for this page');
}
function termIframeLoaded(){}
function termIframeError(){}
function disconnectTerminal(){
  el('termIframe').src='about:blank';
  showTermSetup();
}
function termChangeUrl(){
  el('termIframe').src='about:blank';
  showTermSetup();
}
function termSaveUrl(){
  const url=(el('termUrlInput')?el('termUrlInput').value.trim():'');
  if(url){lset('termWsUrl',url);toast('URL saved');}
}
function termCopySetup(){
  navigator.clipboard.writeText('ttyd --port 7682 --writable /bin/bash').then(()=>toast('Copied ttyd command'));
}
function termCopyNginx(){
  const cfg=`server {
    listen 7683;
    location / {
        proxy_pass http://127.0.0.1:7682;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
        add_header X-Frame-Options "ALLOWALL" always;
        add_header Content-Security-Policy "" always;
    }
}`;
  navigator.clipboard.writeText(cfg).then(()=>toast('Copied nginx config'));
}
function termCopyService(){
  const svc=`[Unit]
Description=ttyd terminal
After=network.target

[Service]
ExecStart=/usr/bin/ttyd --port 7682 --writable bash
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target`;
  navigator.clipboard.writeText(svc).then(()=>toast('Copied systemd unit'));
}
