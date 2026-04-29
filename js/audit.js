// ===========================================================================
//  AUDIT LOG
// ===========================================================================
async function loadAudit(){
  spin(true);
  try{
    let zkAudit=[],gasAudit=[];
    if(!STATE.isDemo){
      try{const d=await zkAPI('/api/audit?limit=300');zkAudit=(d||[]).map(a=>({...a,_src:'zk'}))}catch{}
      if(CFG.gasUrl&&STATE.token&&can('audit')){
        try{const d=await gasAPI({action:'getAuditLog'});if(Array.isArray(d))gasAudit=d.slice(1).map(r=>({ts:r[0]?new Date(r[0]).toISOString():'',username:r[1],action:r[2],detail:r[3],_src:'ad'}))}catch{}
      }
    }else{zkAudit=[{ts:new Date().toISOString(),username:'demo',action:'LOGIN',detail:'Demo login',_src:'zk'},{ts:new Date(Date.now()-60000).toISOString(),username:'demo',action:'VIEW_TODAY',detail:'Viewed today',_src:'zk'}]}
    STATE.allAudit=[...zkAudit,...gasAudit].sort((a,b)=>new Date(b.ts||b.time)-new Date(a.ts||a.time));
    filterAudit();
  }catch(e){toast('❌ Audit: '+e.message)}
  spin(false);
}
function filterAudit(){
  const q=(el('auditSearch').value||'').toLowerCase();
  const src=el('auditSource').value;
  let rows=STATE.allAudit;
  if(q)rows=rows.filter(a=>(a.username||a.actor||'').toLowerCase().includes(q)||(a.action||'').toLowerCase().includes(q)||(a.detail||'').toLowerCase().includes(q));
  if(src)rows=rows.filter(a=>a._src===src);
  el('auditBody').innerHTML=rows.slice(0,200).map(a=>`<tr>
    <td class="td-mono" style="font-size:10px;white-space:nowrap" title="${esc(a.user_agent||'Unknown Device')}">${fmtDateTime(a.ts||a.time)}</td>
    <td>${esc(a.username||a.actor||'—')}</td>
    <td><span class="atag atag-${(a.action||'').replace(/[^A-Z_]/g,'')}">${esc(a.action||'—')}</span></td>
    <td class="text-muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      ${esc(a.detail||'')}
      ${a.detail_json && a.detail_json !== '{}' && a.detail_json !== 'null' ? `<span style="cursor:pointer;margin-left:8px;font-size:12px;filter:grayscale(1)" title='${esc(a.detail_json)}' onclick="alert(JSON.stringify(JSON.parse(this.title),null,2))">📦</span>` : ''}
    </td>
    <td class="td-mono text-muted" style="font-size:10px">${esc(a.ip_addr||'—')}</td>
  </tr>`).join('')||'<tr><td colspan="5" class="empty-state" style="padding:20px;text-align:center">No audit records</td></tr>';
}

