(function(){
'use strict';
const STORAGE='docxChineseEditorExportPresetsV1';
const PENDING='mosenDocxNamesPendingV1',SEEN='mosenDocxNamesSeenV1';
const API='https://api.github.com/repos/mosen6266-netizen/mosen6266/contents/global-order.json';
const RAW='https://raw.githubusercontent.com/mosen6266-netizen/mosen6266/main/global-order.json';
let busy=false,applying=false,stamp=0,fingerprint='';
const $=id=>document.getElementById(id);
function safeName(value){
  const name=String(value||'').trim().replace(/\.docx$/i,'').trim();
  if(!name||name.length>150||/[\\/:*?"<>|\u0000-\u001f]/.test(name)||/[. ]$/.test(name))return '';
  return name+'.docx';
}
function validBindings(raw){
  const result={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
  for(const [id,val] of Object.entries(raw).slice(0,300)){
    if(!id.startsWith('builtin:')||id.length>250)continue;
    const name=safeName(val);
    if(name)result[id]=name;
  }
  return result;
}
function localBindings(){
  const result={};
  if(typeof state==='undefined')return result;
  for(const p of state.exportPresets||[]){
    if(p&&typeof p.sourceTemplateId==='string'&&p.sourceTemplateId.startsWith('builtin:')){
      const name=safeName(p.filename);
      if(name)result[p.sourceTemplateId]=name;
    }
  }
  return result;
}
function pending(){try{return localStorage.getItem(PENDING)==='1'}catch{return false}}
function markPending(yes){
  try{localStorage.setItem(PENDING,yes?'1':'0')}catch(_){}
  const count=$('docxSyncCount');
  if(count)count.textContent='本机已绑定 '+Object.keys(localBindings()).length+' 个内置模板'+(yes?' · 尚未发布':'');
}
function note(message,error){
  const element=$('docxSyncStatus');
  if(element){element.textContent=message;element.style.color=error?'#ffc0b9':'#a9bad6'}
}
function createPanel(){
  const anchor=$('dropZone');
  if(!anchor||$('docxSyncPanel'))return;
  const panel=document.createElement('section');
  panel.id='docxSyncPanel';
  panel.style.cssText='padding:12px;border:1px solid #52617b;border-radius:12px;background:#202e46;display:flex;flex-direction:column;gap:7px';
  panel.innerHTML='<strong style="font-size:13px">输出文件名跨电脑同步</strong>'+
    '<small id="docxSyncCount" style="color:#b3c2dd"></small>'+
    '<button class="btn btn-light" id="docxSyncPublish" style="font-size:12px">发布本机名称到所有电脑</button>'+
    '<button class="btn btn-ghost" id="docxSyncReload" style="color:#fff;border-color:#52617b;font-size:12px">从全局更新名称</button>'+
    '<button class="btn btn-ghost" id="docxSyncDownload" style="color:#fff;border-color:#52617b;font-size:12px">导出本机名称设置文件</button>'+
    '<small id="docxSyncStatus" aria-live="polite" style="color:#a9bad6;line-height:1.6"></small>'+
    '<small style="color:#95a6c1;line-height:1.5">仅共享内置模板的输出文件名，不上传 DOCX 和编辑草稿。注意：仓库公开，发布的文件名也会公开可见。</small>';
  anchor.insertAdjacentElement('afterend',panel);
  $('docxSyncPublish').onclick=publish;
  $('docxSyncReload').onclick=()=>loadGlobal(true);
  $('docxSyncDownload').onclick=download;
  markPending(pending());
}
async function readGlobal(){
  let error;
  for(const url of [RAW+'?v='+Date.now(),'./global-order.json?v='+Date.now()]){
    try{
      const response=await fetch(url,{cache:'no-store'});
      if(response.ok)return await response.json();
      error=new Error('HTTP '+response.status);
    }catch(err){error=err}
  }
  throw error||new Error('无法读取 GitHub 全局设置');
}
function applyGlobal(bindings,date){
  const local=state.exportPresets.filter(p=>!p.sourceTemplateId||!p.sourceTemplateId.startsWith('builtin:'));
  const shared=Object.entries(bindings).map(([id,filename],i)=>({
    id:'shared-docx-'+i,sourceTemplateId:id,filename,hint:'',aliases:''
  }));
  applying=true;
  try{
    const next=[...local,...shared];
    localStorage.setItem(STORAGE,JSON.stringify(next));
    state.exportPresets=next;
    window.dispatchEvent(new Event('docx-export-presets-updated'));
    fingerprint=JSON.stringify(localBindings());
    localStorage.setItem(PENDING,'0');
    localStorage.setItem(SEEN,String(date||new Date().toISOString()));
  }finally{applying=false}
  markPending(false);
}
async function loadGlobal(force){
  if(busy||(!force&&Date.now()-stamp<45000))return;
  busy=true;
  try{
    if(force)note('正在读取全局输出名称…');
    const config=await readGlobal();
    stamp=Date.now();
    if(!config.docxExportNames||!config.docxExportNames.bindings){
      note('尚无全局输出名称，请在原电脑发布本机设置。');return;
    }
    const remote=validBindings(config.docxExportNames.bindings);
    if(JSON.stringify(remote)===JSON.stringify(localBindings())){
      markPending(false);note('已与全局同步，共 '+Object.keys(remote).length+' 个模板。');return;
    }
    if(pending()&&!force){
      note('检测到本机未发布的名称，已保留本机设置。请发布或手动从全局更新。');return;
    }
    if(pending()&&force&&!confirm('从全局更新会覆盖本机设置的内置模板输出文件名，确定吗？'))return;
    applyGlobal(remote,config.docxExportNames.updatedAt);
    note('已载入共享名称，共 '+Object.keys(remote).length+' 个模板。');
  }catch(err){note('同步读取失败：'+(err?.message||err),true)}
  finally{busy=false;markPending(pending())}
}
function base64Utf8(content){
  const bytes=new TextEncoder().encode(content);
  let binary='';
  for(const n of bytes)binary+=String.fromCharCode(n);
  return btoa(binary);
}
async function publish(){
  if(busy)return;
  const bindings=localBindings();
  if(!Object.keys(bindings).length){note('本机没有已设置输出名称的内置模板，无法发布。',true);return}
  const token=(prompt('发布的输出文件名会保存到公开 GitHub 仓库，任何人可能查看。请先确认文件名不包含客户隐私。\n\n发布全局设置需要 GitHub 写入授权。\n请粘贴仅限 mosen6266 仓库且具有 Contents: Read and write 权限的 Fine-grained Token。\n仅用于本次提交，不会保存。也可以取消后导出本机名称设置文件交给我发布。')||'').trim();
  if(!token){note('已取消发布，本机设置保持不变。');return}
  busy=true;
  $('docxSyncPublish').disabled=true;
  note('正在发布 '+Object.keys(bindings).length+' 个名称…');
  try{
    const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
    const read=await fetch(API+'?ref=main',{cache:'no-store',headers});
    const res=await read.json().catch(()=>({}));
    if(!read.ok)throw new Error(read.status===403||read.status===401?'写入授权无效。':res.message||'无法读取仓库');
    const binary=atob(String(res.content||'').replace(/\s/g,''));
    const raw=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
    const config=JSON.parse(new TextDecoder().decode(raw));
    config.docxExportNames={version:1,updatedAt:new Date().toISOString(),bindings};
    const save=await fetch(API,{
      method:'PUT',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({
        message:'Publish DOCX export names for all computers',
        sha:res.sha,branch:'main',
        content:base64Utf8(JSON.stringify(config,null,2)+'\n')
      })
    });
    const result=await save.json().catch(()=>({}));
    if(!save.ok)throw new Error(result.message||'GitHub 提交失败 ('+save.status+')');
    if(JSON.stringify(localBindings())===JSON.stringify(bindings)){
      fingerprint=JSON.stringify(bindings);markPending(false);
    }else markPending(true);
    localStorage.setItem(SEEN,config.docxExportNames.updatedAt);
    stamp=0;
    note('已发布 '+Object.keys(bindings).length+' 个名称。其他电脑重新打开工具后自动读取。');
  }catch(err){note('发布失败：'+(err?.message||err),true)}
  finally{busy=false;$('docxSyncPublish').disabled=false}
}
function download(){
  const bindings=localBindings();
  if(!Object.keys(bindings).length){note('没有可以导出的内置模板设置。',true);return}
  const doc={version:1,updatedAt:new Date().toISOString(),bindings};
  const blob=new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='墨森-DOCX输出文件名设置.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  note('已导出本机名称设置。把 JSON 文件发给我，我可以直接同步到 GitHub。');
}
function init(){
  if(typeof state==='undefined'||!Array.isArray(state.exportPresets))return;
  createPanel();
  fingerprint=JSON.stringify(localBindings());
  if(!localStorage.getItem(SEEN)&&Object.keys(localBindings()).length)markPending(true);
  window.addEventListener('docx-export-presets-updated',()=>{
    if(applying)return;
    const next=JSON.stringify(localBindings());
    if(next!==fingerprint){fingerprint=next;markPending(true);note('本机名称已修改，尚未发布给其他电脑。')}
  });
  window.addEventListener('focus',()=>{if(!document.hidden)loadGlobal(false)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadGlobal(false)});
  loadGlobal(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();