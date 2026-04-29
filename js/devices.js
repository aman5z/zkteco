// ===========================================================================
//  ZK DEVICES — full featured
// ===========================================================================
let STATE_devices = [];   // [{ip, name, online, punches_today, serialno, platform, user_count}]
let STATE_selDevice = null;
let STATE_ddUsers = [];

async function loadDevices(){
  spin(true);
  try{
    if(STATE.isDemo){
      STATE_devices = DEMO_DEVICES.map(d=>({...d}));
      renderDevices(STATE_devices);
      spin(false); return;
    }
        // /api/devices/status returns full data: online, platform, serial, user_count
    // /api/today already loaded has punches_today per device
    let statusData = [];
    try{ statusData = await zkAPI('/api/devices/status'); }catch(e){ console.warn('status err:',e); }
    if(!Array.isArray(statusData)||!statusData.length){
      // fallback to IPs list
      try{
        const ipsData=await zkAPI('/api/devices/ips');
        statusData=(Array.isArray(ipsData)?ipsData:[]).map(x=>({ip:typeof x==='string'?x:x.ip,name:typeof x==='object'?x.name||'':'',online:false,punches_today:0,serialno:'—',platform:'—',user_count:0}));
      }catch(e2){}
    }
    // Merge punches_today from today cache
    const todayDevMap={};
    ((STATE.todayData&&STATE.todayData.devices)||[]).forEach(d=>{ todayDevMap[d.ip]=d; });
    STATE_devices = (Array.isArray(statusData)?statusData:[]).map(d=>({
      ip:d.ip||'', name:d.name||'', online:d.online||false,
      punches_today:d.punches_today||(todayDevMap[d.ip]&&todayDevMap[d.ip].punches_today)||0,
      serialno:d.serialno||'—', platform:d.platform||'—', user_count:d.user_count||0,
      error:d.error||''
    }));
        renderDevices(STATE_devices);
  }catch(e){
    el('deviceGrid').innerHTML='<div class="empty-state"><div class="icon">&#128225;</div><p>'+esc(e.message)+'</p></div>';
    console.error('loadDevices:', e);
  }
  spin(false);
}

function renderDevices(devices){
  const grid = el('deviceGrid');
  el('deviceSummary').textContent = devices.filter(d=>d.online).length+'/'+devices.length+' online';
  if(!devices.length){
    grid.innerHTML='<div class="empty-state"><div class="icon">&#128225;</div><p>No devices configured. Click + Add Device to get started.</p></div>';
    return;
  }
  grid.innerHTML = devices.map(d=>`
    <div class="device-card ${d.online?'online':'offline'} ${STATE_selDevice===d.ip?'selected':''}"
         onclick="selectDevice('${esc(d.ip)}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <span class="tag ${d.online?'tag-online':'tag-offline'}">${d.online?'ONLINE':'OFFLINE'}</span>
        <span style="font-size:10px;font-family:var(--mono);color:var(--text2)">${esc(d.ip)}</span>
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:10px;min-height:20px">${esc(d.name||d.ip)}</div>
      <div class="dc-row"><span class="label">Punches Today</span><span class="val text-accent" style="font-size:16px;font-weight:700">${d.punches_today||0}</span></div>
      <div class="dc-row"><span class="label">Users</span><span class="val">${d.user_count||'—'}</span></div>
      <div class="dc-row"><span class="label">Platform</span><span class="val">${esc(d.platform||'—')}</span></div>
      <div class="dc-row"><span class="label">Serial</span><span class="val" style="font-family:var(--mono);font-size:10px">${esc((d.serialno||'—').substring(0,12))}</span></div>
      ${d.error&&!d.online?`<div style="font-size:10px;color:var(--red);margin-top:6px;font-family:var(--mono)">&#9888; ${esc(d.error.substring(0,55))}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:5px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();ddSyncClockFor('${esc(d.ip)}')">&#128336; Clock</button>
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();selectDevice('${esc(d.ip)}');ddBrowseUsers()">&#128100;&#128100; Users</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();ddRebootFor('${esc(d.ip)}')">&#8635; Reboot</button>
      </div>
    </div>
  `).join('');
}

function selectDevice(ip){
  STATE_selDevice = ip;
  renderDevices(STATE_devices);
  const d = STATE_devices.find(x=>x.ip===ip)||{ip};
  el('ddTitle').textContent = (d.name||d.ip) + ' — ' + ip;
  el('deviceDetailPanel').style.display = '';
  // Fill info grid
  const infoItems = [
    ['IP Address', ip],
    ['Status', d.online?'Online':'Offline'],
    ['Platform', d.platform||'—'],
    ['Serial No', d.serialno||'—'],
    ['Punches Today', d.punches_today||0],
    ['Users Enrolled', d.user_count||'—'],
  ];
  el('ddInfoGrid').innerHTML = infoItems.map(([k,v])=>`
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:10px 12px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:var(--text2);margin-bottom:4px">${esc(k)}</div>
      <div style="font-size:13px;font-weight:700;font-family:var(--mono);color:${k==='Status'?(d.online?'var(--green)':'var(--red)'):'var(--text)'}">${esc(String(v))}</div>
    </div>
  `).join('');
  el('ddTabInfo').innerHTML = d.error&&!d.online?`<div style="color:var(--red);font-size:12px;padding:8px;background:var(--red-dim);border-radius:6px">&#9888; ${esc(d.error)}</div>`:'<p style="font-size:12px;color:var(--text2)">Select a tab above to interact with this device.</p>';
  // Reset att date to today
  const today = new Date().toISOString().split('T')[0];
  if(el('ddAttDate')) el('ddAttDate').value = today;
  ddTab('info', el('ddTabBtnInfo'));
  el('deviceDetailPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function ddTab(tab, btn){
  ['ddTabInfo','ddTabUsers','ddTabAttendance'].forEach(id=>{
    const e = el(id); if(e) e.style.display = 'none';
  });
  document.querySelectorAll('#page-devices .tab-btn').forEach(b=>b.classList.remove('active'));
  const pane = el('ddTab'+tab.charAt(0).toUpperCase()+tab.slice(1));
  if(pane) pane.style.display = '';
  if(btn) btn.classList.add('active');
}

async function ddPing(){
  if(!STATE_selDevice){toast('Select a device first');return}
  if(STATE.isDemo){toast('Demo: Ping OK from '+STATE_selDevice);return}
  toast('Pinging '+STATE_selDevice+'...');
  try{
    const d = await zkAPI('/api/device/'+STATE_selDevice+'/sync-clock',{method:'POST'});
    toast(d.ok?'Ping OK — '+STATE_selDevice+' reachable':'No response from '+STATE_selDevice);
  }catch(e){ toast('No response: '+e.message); }
}

async function ddSyncClock(){
  if(!STATE_selDevice){toast('Select a device first');return}
  await ddSyncClockFor(STATE_selDevice);
}
async function ddSyncClockFor(ip){
  if(STATE.isDemo){toast('Demo: Clock synced on '+ip);return}
  try{const d=await zkAPI('/api/device/'+ip+'/sync-clock',{method:'POST'});toast(d.ok?'Clock synced: '+d.synced_to:'Error: '+d.error)}
  catch(e){toast('Error: '+e.message)}
}

async function ddReboot(){
  if(!STATE_selDevice){toast('Select a device first');return}
  await ddRebootFor(STATE_selDevice);
}
async function ddRebootFor(ip){
  if(!confirm('Reboot device '+ip+'? It will be offline ~30 seconds.'))return;
  if(STATE.isDemo){toast('Demo: Reboot sent to '+ip);return}
  try{const d=await zkAPI('/api/device/'+ip+'/reboot',{method:'POST'});toast(d.message||'Reboot command sent')}
  catch(e){toast('Error: '+e.message)}
}

async function ddBrowseUsers(){
  if(!STATE_selDevice){toast('Select a device first');return}
  ddTab('users', el('ddTabBtnUsers'));
  if(STATE.isDemo){
    STATE_ddUsers = [{uid:'1001',name:'Ahmed Al Rashid',privilege:0},{uid:'1673',name:'Aman P Faizal',privilege:14}];
    renderDdUsers(STATE_ddUsers); return;
  }
  el('ddUsersBody').innerHTML = '<div class="empty-state"><p>Loading users...</p></div>';
  el('ddUserCount').textContent = '';
  try{
    const d = await zkAPI('/api/device/'+STATE_selDevice+'/users');
    STATE_ddUsers = d.users||[];
    el('ddUserCount').textContent = STATE_ddUsers.length+' users';
    renderDdUsers(STATE_ddUsers);
  }catch(e){el('ddUsersBody').innerHTML='<div class="empty-state"><p>Error: '+esc(e.message)+'</p></div>'}
}

function renderDdUsers(users){
  if(!users.length){el('ddUsersBody').innerHTML='<div class="empty-state"><p>No users on device</p></div>';return}
  el('ddUsersBody').innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border)">UID</th>
      <th style="padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border)">Name</th>
      <th style="padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border)">Privilege</th>
    </tr></thead>
    <tbody>${users.map(u=>`<tr>
      <td style="padding:6px 10px;font-family:var(--mono);font-size:11px;border-bottom:1px solid var(--border)">${esc(u.uid)}</td>
      <td style="padding:6px 10px;font-size:12px;border-bottom:1px solid var(--border)">${esc(u.name||'—')}</td>
      <td style="padding:6px 10px;font-size:11px;border-bottom:1px solid var(--border)">${u.privilege===14?'<span style="color:var(--accent)">Admin</span>':'User'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function filterDdUsers(){
  const q = (el('ddUserSearch').value||'').toLowerCase();
  const filtered = STATE_ddUsers.filter(u=>(u.name||'').toLowerCase().includes(q)||(u.uid+'').includes(q));
  renderDdUsers(filtered);
}

async function ddViewAttendance(){
  ddTab('attendance', el('ddTabBtnAttend'));
}
async function ddLoadAttendance(){
  if(!STATE_selDevice){toast('Select a device first');return}
  const d8 = el('ddAttDate').value;
  if(!d8){toast('Select a date');return}
  if(STATE.isDemo){
    el('ddAttBody').innerHTML='<div class="empty-state"><p>Demo attendance data not available</p></div>';return;
  }
  el('ddAttBody').innerHTML='<div class="empty-state"><p>Loading...</p></div>';
  el('ddAttCount').textContent='';
  try{
    const d = await zkAPI('/api/device/'+STATE_selDevice+'/attendance?date='+d8);
    const recs = d.records||[];
    el('ddAttCount').textContent = recs.length+' records';
    if(!recs.length){el('ddAttBody').innerHTML='<div class="empty-state"><p>No records for this date</p></div>';return}
    el('ddAttBody').innerHTML = `<table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border)">UID</th>
        <th style="padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border)">Time</th>
        <th style="padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:var(--text2);border-bottom:1px solid var(--border)">Type</th>
      </tr></thead>
      <tbody>${recs.map(r=>`<tr>
        <td style="padding:6px 10px;font-family:var(--mono);font-size:11px;border-bottom:1px solid var(--border)">${esc(r.uid)}</td>
        <td style="padding:6px 10px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent);border-bottom:1px solid var(--border)">${esc(r.time)}</td>
        <td style="padding:6px 10px;font-size:11px;border-bottom:1px solid var(--border)">${esc(r.type||'—')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }catch(e){el('ddAttBody').innerHTML='<div class="empty-state"><p>Error: '+esc(e.message)+'</p></div>'}
}

function ddDownloadUsers(){
  if(!STATE_selDevice){toast('Select a device first');return}
  if(STATE.isDemo){toast('Not available in demo');return}
  window.open(CFG.zkUrl+'/api/device/'+STATE_selDevice+'/download/users','_blank');
}
function ddDownloadRaw(){
  if(!STATE_selDevice){toast('Select a device first');return}
  if(STATE.isDemo){toast('Not available in demo');return}
  window.open(CFG.zkUrl+'/api/device/'+STATE_selDevice+'/download/attendance-raw','_blank');
}

// Add / Rename / Remove device
function openAddDeviceModal(){
  el('newDeviceIp').value='';
  el('newDeviceName').value='';
  el('addDeviceErr').textContent='';
  openModal('addDeviceModal');
}
async function submitAddDevice(){
  const rawIps = el('newDeviceIp').value.trim();
  const name   = el('newDeviceName').value.trim();
  const err    = el('addDeviceErr');
  if(!rawIps){err.textContent='Enter at least one IP address.';return}
  const ips = rawIps.split(',').map(s=>s.trim()).filter(Boolean);
  const ipRe = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  const bad  = ips.filter(ip=>!ipRe.test(ip));
  if(bad.length){err.textContent='Invalid IP: '+bad.join(', ');return}
  if(STATE.isDemo){
    ips.forEach(ip=>STATE_devices.push({ip,name,online:false,punches_today:0,serialno:'—',platform:'—',user_count:0}));
    closeModal('addDeviceModal'); renderDevices(STATE_devices); toast('Added (demo)'); return;
  }
  spin(true);
  try{
    // Get current IPs, add new ones
    const existing = await zkAPI('/api/devices/ips');
    const existingIps = (Array.isArray(existing)?existing:[]).map(x=>typeof x==='string'?x:x.ip);
    const allIps = [...new Set([...existingIps, ...ips])];
    await zkAPI('/api/devices/ips',{method:'POST',body:JSON.stringify({ips:allIps})});
    // Set names if provided
    if(name && ips.length===1){
      const names = {};
      names[ips[0]] = name;
      await zkAPI('/api/devices/names',{method:'POST',body:JSON.stringify(names)});
    }
    closeModal('addDeviceModal');
    toast('Device added. Refreshing...');
    await loadDevices();
  }catch(e){err.textContent=e.message;}
  spin(false);
}

function openRenameDevice(){
  if(!STATE_selDevice){toast('Select a device first');return}
  const d = STATE_devices.find(x=>x.ip===STATE_selDevice)||{};
  el('renameDeviceIp').value = STATE_selDevice;
  el('renameDeviceName').value = d.name||'';
  openModal('renameDeviceModal');
}
async function submitRenameDevice(){
  const ip   = el('renameDeviceIp').value;
  const name = el('renameDeviceName').value.trim();
  if(STATE.isDemo){
    const d=STATE_devices.find(x=>x.ip===ip);if(d)d.name=name;
    closeModal('renameDeviceModal');renderDevices(STATE_devices);
    if(STATE_selDevice===ip)selectDevice(ip);
    toast('Renamed (demo)');return;
  }
  spin(true);
  try{
    const names={};names[ip]=name;
    await zkAPI('/api/devices/names',{method:'POST',body:JSON.stringify(names)});
    closeModal('renameDeviceModal');toast('Device renamed');
    await loadDevices();
    if(STATE_selDevice)selectDevice(STATE_selDevice);
  }catch(e){toast('Error: '+e.message)}
  spin(false);
}

function openRemoveDevice(){
  if(!STATE_selDevice){toast('Select a device first');return}
  el('removeDeviceIpLabel').textContent = STATE_selDevice;
  openModal('removeDeviceModal');
}
async function submitRemoveDevice(){
  const ip = STATE_selDevice;
  if(STATE.isDemo){
    STATE_devices = STATE_devices.filter(d=>d.ip!==ip);
    STATE_selDevice=null;
    el('deviceDetailPanel').style.display='none';
    closeModal('removeDeviceModal');renderDevices(STATE_devices);
    toast('Removed (demo)');return;
  }
  spin(true);
  try{
    const existing = await zkAPI('/api/devices/ips');
    const existingIps = (Array.isArray(existing)?existing:[]).map(x=>typeof x==='string'?x:x.ip);
    const newIps = existingIps.filter(i=>i!==ip);
    await zkAPI('/api/devices/ips',{method:'POST',body:JSON.stringify({ips:newIps})});
    STATE_selDevice=null;
    el('deviceDetailPanel').style.display='none';
    closeModal('removeDeviceModal');
    toast('Device removed');
    await loadDevices();
  }catch(e){toast('Error: '+e.message)}
  spin(false);
}

async function syncAllClocks(){
  if(STATE.isDemo){toast('Demo: All clocks synced');return}
  spin(true);
  try{const d=await zkAPI('/api/devices/sync-all-clocks',{method:'POST'});toast('Synced '+d.synced+'/'+d.total+' devices')}
  catch(e){toast('Error: '+e.message)}
  spin(false);
}
async function syncAllUsers(){
  if(STATE.isDemo){toast('Demo: Users synced');return}
  spin(true);
  try{const d=await zkAPI('/api/devices/sync-users',{method:'POST'});toast('User sync: '+d.total_pushed+' users pushed across '+d.online_devices+' devices')}
  catch(e){toast('Error: '+e.message)}
  spin(false);
}
