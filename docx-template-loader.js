(function(){
'use strict';
const INDEX_URL='./templates/index.json';
const ORDER_KEY='mosenDocxBuiltInTemplateOrderV1';
const BUILTIN_PREFIX='builtin:';
let catalog={us:[],de:[]};
let dirty=false;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const US_FLAG=`<span class="country-flag" aria-hidden="true"><svg viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="18" rx="2" fill="#fff"/><g fill="#B22234"><rect y="0" width="28" height="1.4"/><rect y="2.8" width="28" height="1.4"/><rect y="5.6" width="28" height="1.4"/><rect y="8.4" width="28" height="1.4"/><rect y="11.2" width="28" height="1.4"/><rect y="14" width="28" height="1.4"/><rect y="16.6" width="28" height="1.4"/></g><rect width="11.8" height="9.8" rx="1" fill="#3C3B6E"/><g fill="#fff"><circle cx="2" cy="2" r=".65"/><circle cx="4.4" cy="2" r=".65"/><circle cx="6.8" cy="2" r=".65"/><circle cx="9.2" cy="2" r=".65"/><circle cx="3.2" cy="4" r=".65"/><circle cx="5.6" cy="4" r=".65"/><circle cx="8" cy="4" r=".65"/><circle cx="2" cy="6" r=".65"/><circle cx="4.4" cy="6" r=".65"/><circle cx="6.8" cy="6" r=".65"/><circle cx="9.2" cy="6" r=".65"/><circle cx="3.2" cy="8" r=".65"/><circle cx="5.6" cy="8" r=".65"/><circle cx="8" cy="8" r=".65"/></g></svg></span>`;
const DE_FLAG=`<span class="country-flag" aria-hidden="true"><svg viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="18" rx="2" fill="#000"/><rect y="6" width="28" height="6" fill="#DD0000"/><rect y="12" width="28" height="6" rx="0 0 2 2" fill="#FFCE00"/></svg></span>`;

function waitForEditor(){
  return new Promise((resolve,reject)=>{
    let n=0;
    const timer=setInterval(()=>{
      n++;
      if(typeof window.JSZip!=='undefined'&&typeof dbGet==='function'&&typeof dbPut==='function'&&typeof loadTemplate==='function'&&typeof refreshTemplates==='function'&&typeof state!=='undefined'&&state.db){clearInterval(timer);resolve();}
      else if(n>120){clearInterval(timer);reject(new Error('DOCX 编辑器初始化超时'));}
    },100);
  });
}

function injectStyle(){
  if(document.getElementById('builtinTemplateStyle'))return;
  const style=document.createElement('style');
  style.id='builtinTemplateStyle';
  style.textContent=`
  .builtin-wrap{display:flex;flex-direction:column;gap:10px}
  .builtin-section{display:flex;flex-direction:column;gap:7px}
  .builtin-head{display:flex;align-items:center;justify-content:space-between;padding:0 5px}
  .builtin-head h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#929eb6;margin:0;display:flex;align-items:center;gap:8px}
  .country-flag{width:23px;height:15px;display:inline-flex;flex:0 0 23px;border-radius:2px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.22),0 1px 3px rgba(0,0,0,.25);vertical-align:middle}
  .country-flag svg{display:block;width:100%;height:100%}
  .builtin-list{display:flex;flex-direction:column;gap:7px;min-height:8px}
  .builtin-item{border:1px solid transparent;background:rgba(255,255,255,.055);border-radius:13px;padding:10px;display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;align-items:center;transition:.18s;cursor:pointer}
  .builtin-item:hover{background:rgba(255,255,255,.09)}
  .builtin-item.active{border-color:#6f8cff;background:rgba(75,105,210,.22)}
  .builtin-item.dragging{opacity:.45}
  .builtin-grip{color:#71809b;font-size:15px;cursor:grab;user-select:none;text-align:center}
  .builtin-item:active .builtin-grip{cursor:grabbing}
  .builtin-name{font-size:13px;font-weight:650;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.45;overflow-wrap:anywhere;color:#fff}
  .builtin-meta{font-size:10px;color:#96a2b8;margin-top:4px}
  .builtin-empty{font-size:11px;color:#75839e;padding:8px 7px}
  .builtin-save-row{display:flex;gap:7px;align-items:center}
  .builtin-save-row .btn{flex:1;padding:9px 10px;font-size:12px}
  .builtin-sort-status{font-size:10px;color:#8f9bb1;white-space:nowrap}
  .builtin-sort-status.dirty{color:#ffd37a}`;
  document.head.appendChild(style);
}

function ensureUI(){
  const sidebar=document.querySelector('.sidebar'),upload=document.getElementById('dropZone');
  if(!sidebar||!upload)return null;
  let wrap=document.getElementById('builtinTemplateWrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.id='builtinTemplateWrap';
  wrap.className='builtin-wrap';
  wrap.innerHTML=`
    <section class="builtin-section">
      <div class="builtin-head"><h2>${US_FLAG}<span>美国模板</span></h2><span class="badge" id="builtinUsCount">0</span></div>
      <div class="builtin-list" id="builtinUsList"></div>
    </section>
    <section class="builtin-section">
      <div class="builtin-head"><h2>${DE_FLAG}<span>德国模板</span></h2><span class="badge" id="builtinDeCount">0</span></div>
      <div class="builtin-list" id="builtinDeList"></div>
    </section>
    <div class="builtin-save-row"><button type="button" class="btn btn-light" id="saveBuiltinOrderBtn">保存当前排序</button><span class="builtin-sort-status" id="builtinSortStatus">已保存</span></div>`;
  upload.insertAdjacentElement('afterend',wrap);
  document.getElementById('saveBuiltinOrderBtn').addEventListener('click',saveOrder);
  return wrap;
}

function loadSavedOrder(){try{return JSON.parse(localStorage.getItem(ORDER_KEY)||'{}')||{};}catch{return {};}}
function applyOrder(items,ids){if(!Array.isArray(ids)||!ids.length)return items;const pos=new Map(ids.map((id,i)=>[id,i]));return [...items].sort((a,b)=>{const pa=pos.has(a.path)?pos.get(a.path):1e9,pb=pos.has(b.path)?pos.get(b.path):1e9;return pa-pb||a.name.localeCompare(b.name,'zh-CN');});}
function markDirty(on=true){dirty=on;const s=document.getElementById('builtinSortStatus');if(s){s.textContent=on?'排序未保存':'已保存';s.classList.toggle('dirty',on);}}
function saveOrder(){const data={us:[...document.querySelectorAll('#builtinUsList .builtin-item')].map(x=>x.dataset.path),de:[...document.querySelectorAll('#builtinDeList .builtin-item')].map(x=>x.dataset.path)};localStorage.setItem(ORDER_KEY,JSON.stringify(data));catalog.us=applyOrder(catalog.us,data.us);catalog.de=applyOrder(catalog.de,data.de);markDirty(false);if(typeof toast==='function')toast('当前模板排序已保存','success');}
function humanSize(bytes){if(!Number.isFinite(bytes))return '';const units=['B','KB','MB','GB'];let i=0,n=bytes;while(n>=1024&&i<units.length-1){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${units[i]}`;}

function makeItem(t){
  const el=document.createElement('div');
  el.className='builtin-item';el.draggable=true;el.dataset.path=t.path;
  el.innerHTML=`<div class="builtin-grip" title="拖拽排序">⋮⋮</div><div><div class="builtin-name" title="${esc(t.name)}">${esc(t.name.replace(/\.docx$/i,''))}</div><div class="builtin-meta">内置模板${t.size?` · ${humanSize(t.size)}`:''}</div></div>`;
  el.addEventListener('click',()=>openBuiltIn(t));
  el.addEventListener('dragstart',e=>{el.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',t.path);});
  el.addEventListener('dragend',()=>el.classList.remove('dragging'));
  return el;
}

function enableListDnD(list){
  list.addEventListener('dragover',e=>{e.preventDefault();const moving=list.querySelector('.dragging');if(!moving)return;const after=[...list.querySelectorAll('.builtin-item:not(.dragging)')].find(node=>e.clientY<=node.getBoundingClientRect().top+node.offsetHeight/2);if(after)list.insertBefore(moving,after);else list.appendChild(moving);});
  list.addEventListener('drop',e=>{e.preventDefault();markDirty(true);});
}

function renderCatalog(){
  const saved=loadSavedOrder();catalog.us=applyOrder(catalog.us,saved.us);catalog.de=applyOrder(catalog.de,saved.de);
  for(const [key,listId,countId] of [['us','builtinUsList','builtinUsCount'],['de','builtinDeList','builtinDeCount']]){
    const list=document.getElementById(listId),count=document.getElementById(countId);if(!list)continue;
    list.innerHTML='';count.textContent=catalog[key].length;
    if(!catalog[key].length){list.innerHTML='<div class="builtin-empty">暂无模板</div>';continue;}
    catalog[key].forEach(t=>list.appendChild(makeItem(t)));enableListDnD(list);
  }
  markDirty(false);
}

async function openBuiltIn(t){
  if(typeof state!=='undefined'&&state.busy)return;
  const id=BUILTIN_PREFIX+t.path;
  try{
    let cached=await dbGet(id);
    if(!cached||cached._builtinHash!==t.sha256){
      if(typeof setBusy==='function')setBusy(true,'正在载入内置模板…');
      const res=await fetch(encodeURI('./'+t.path),{cache:'no-store'});if(!res.ok)throw new Error(`模板下载失败 (${res.status})`);
      const buffer=await res.arrayBuffer();try{await JSZip.loadAsync(buffer);}catch{throw new Error('模板文件不是有效的 DOCX');}
      const now=Date.now(),oldDraft=cached?.draft||{replacements:[]};
      cached={id,name:t.name,size:buffer.byteLength,createdAt:cached?.createdAt||now,updatedAt:now,buffer,draft:oldDraft,builtin:true,_builtinHash:t.sha256,_builtinPath:t.path,_builtinRegion:t.region};
      await dbPut(cached);await refreshTemplates();if(typeof setBusy==='function')setBusy(false);
    }
    await loadTemplate(id);
    document.querySelectorAll('.builtin-item').forEach(x=>x.classList.toggle('active',x.dataset.path===t.path));
  }catch(err){console.error(err);if(typeof toast==='function')toast('打开内置模板失败：'+(err.message||err),'error');}
  finally{if(typeof setBusy==='function')setBusy(false);}
}

function patchMyTemplates(){
  if(typeof renderTemplates!=='function'||renderTemplates.__builtinPatched)return;
  const original=renderTemplates;
  window.renderTemplates=function(){const all=state.templates||[],hidden=all.filter(t=>t.builtin);state.templates=all.filter(t=>!t.builtin);try{return original();}finally{state.templates=all;const c=document.getElementById('templateCount');if(c)c.textContent=all.length-hidden.length;}};
  window.renderTemplates.__builtinPatched=true;renderTemplates();
}

async function fetchCatalog(){const res=await fetch(INDEX_URL+'?v='+Date.now(),{cache:'no-store'});if(!res.ok){if(res.status===404)return [];throw new Error(`模板索引读取失败 (${res.status})`);}const data=await res.json();return Array.isArray(data)?data:(data.templates||[]);}
async function init(){try{injectStyle();ensureUI();await waitForEditor();patchMyTemplates();const list=await fetchCatalog();catalog.us=list.filter(x=>x.region==='us');catalog.de=list.filter(x=>x.region==='de');renderCatalog();}catch(err){console.error(err);const s=document.getElementById('builtinSortStatus');if(s)s.textContent='模板索引读取失败';}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
