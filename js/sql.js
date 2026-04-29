// ===========================================================================
//  SQL QUERY LOGIC
// ===========================================================================
async function runSql(){
  const query = el('sqlInput').value.trim();
  const errEl = el('sqlError');
  const thEl = el('sqlThead');
  const tbEl = el('sqlTbody');
  const rcEl = el('sqlRowCount');
  errEl.style.display = 'none';
  rcEl.textContent = '';
  
  if(!query){
    errEl.textContent = 'Query cannot be empty';
    errEl.style.display = 'block';
    return;
  }
  
  spin(true);
  try {
    const d = await zkAPI('/api/sql', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ query })
    });
    
    if(d.error) throw new Error(d.error);
    
    if(d.message) {
      thEl.innerHTML = '<tr><th>Result</th></tr>';
      tbEl.innerHTML = `<tr><td style="color:var(--green)">${esc(d.message)}</td></tr>`;
    } else if (d.columns && d.rows) {
      rcEl.textContent = d.rows.length + ' rows returned';
      if(d.columns.length === 0) {
        thEl.innerHTML = '<tr><th>No Columns</th></tr>';
        tbEl.innerHTML = '<tr><td class="text-muted">Query executed successfully, no data returned.</td></tr>';
      } else {
        thEl.innerHTML = '<tr>' + d.columns.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
        tbEl.innerHTML = d.rows.map(r => '<tr>' + r.map(v => `<td style="font-family:var(--mono);font-size:11px">${v===null?'<i class="text-muted">null</i>':esc(String(v))}</td>`).join('') + '</tr>').join('');
      }
    }
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
  spin(false);
}
