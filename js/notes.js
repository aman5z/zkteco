// Note color → CSS variable
const NOTE_COLORS = {purple:'var(--purple)',accent:'var(--accent)',green:'var(--green)',red:'var(--red)',yellow:'var(--yellow)'};

async function loadNotes(){
  try{
    const d=await zkAPI('/api/notes');
    if(d.error) throw new Error(d.error);
    el('notesContainer').innerHTML = d.map(n=>{
      const borderColor = NOTE_COLORS[n.color||'purple'] || 'var(--purple)';
      return `
      <div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid ${borderColor};padding:14px;border-radius:6px;position:relative">
        ${n.title?`<div style="font-weight:bold;margin-bottom:6px;font-size:13px">${esc(n.title)}</div>`:''}
        <div style="font-size:13px;white-space:pre-wrap;margin-bottom:10px;color:var(--text)">${esc(n.text)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--text3)">
           <span>${esc(n.timestamp)}</span>
           <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:10px" onclick="deleteNote(${n.id})">Delete</button>
        </div>
      </div>`;
    }).join('') || '<div class="text-muted text-center" style="padding:20px">No notes saved</div>';
  }catch(e){toast('Error loading notes: '+e.message)}
}
async function saveNote(){
  const t=el('noteText').value.trim();
  if(!t)return;
  const title = el('noteTitle').value.trim();
  const colorEl = document.querySelector('input[name="noteColor"]:checked');
  const color = colorEl ? colorEl.value : 'purple';
  try{
    const r=await zkAPI('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t,title,color})});
    if(r.error)throw new Error(r.error);
    toast('✅ Note saved');
    el('noteText').value='';
    el('noteTitle').value='';
    loadNotes();
  }catch(e){toast('❌ '+e.message)}
}
async function deleteNote(id){
  if(!confirm('Delete this note?'))return;
  try{
    const r=await zkAPI('/api/notes/'+id,{method:'DELETE'});
    if(r.error)throw new Error(r.error);
    loadNotes();
  }catch(e){toast('❌ '+e.message)}
}
