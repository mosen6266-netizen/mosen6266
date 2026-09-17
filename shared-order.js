(() => {
  'use strict';

  const OWNER = 'mosen6266-netizen';
  const REPO = 'mosen6266';
  const BRANCH = 'main';
  const CONFIG_PATH = 'global-order.json';
  const RAW_CONFIG_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${CONFIG_PATH}`;
  const API_CONFIG_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONFIG_PATH}`;
  const DEFAULT_DOCX_PLACEHOLDER = '在这里输入对应的英文内容';

  const US_FLAG = `<span class="tool-country-flag" aria-hidden="true"><svg viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="18" rx="2" fill="#fff"/><g fill="#B22234"><rect y="0" width="28" height="1.4"/><rect y="2.8" width="28" height="1.4"/><rect y="5.6" width="28" height="1.4"/><rect y="8.4" width="28" height="1.4"/><rect y="11.2" width="28" height="1.4"/><rect y="14" width="28" height="1.4"/><rect y="16.6" width="28" height="1.4"/></g><rect width="11.8" height="9.8" rx="1" fill="#3C3B6E"/><g fill="#fff"><circle cx="2" cy="2" r=".65"/><circle cx="4.4" cy="2" r=".65"/><circle cx="6.8" cy="2" r=".65"/><circle cx="9.2" cy="2" r=".65"/><circle cx="3.2" cy="4" r=".65"/><circle cx="5.6" cy="4" r=".65"/><circle cx="8" cy="4" r=".65"/><circle cx="2" cy="6" r=".65"/><circle cx="4.4" cy="6" r=".65"/><circle cx="6.8" cy="6" r=".65"/><circle cx="9.2" cy="6" r=".65"/><circle cx="3.2" cy="8" r=".65"/><circle cx="5.6" cy="8" r=".65"/><circle cx="8" cy="8" r=".65"/></g></svg></span>`;
  const DE_FLAG = `<span class="tool-country-flag" aria-hidden="true"><svg viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="18" rx="2" fill="#000"/><rect y="6" width="28" height="6" fill="#DD0000"/><rect y="12" width="28" height="6" rx="0 0 2 2" fill="#FFCE00"/></svg></span>`;

  function injectToolCenterFlags(){
    if(!document.getElementById('toolCountryFlagStyle')){
      const style = document.createElement('style');
      style.id = 'toolCountryFlagStyle';
      style.textContent = `
        .section-head h2{display:flex;align-items:center;gap:9px}
        .section-head h2>.tool-country-flag{width:26px;height:17px;display:inline-flex;flex:0 0 26px;border-radius:3px;overflow:hidden;box-shadow:0 0 0 1px rgba(15,23,42,.12),0 1px 3px rgba(15,23,42,.12)}
        .tool-country-flag svg{display:block;width:100%;height:100%}
        .lang.country-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;line-height:1}
        .lang.country-chip .tool-country-flag{width:19px;height:12px;display:inline-flex;flex:0 0 19px;border-radius:2px;overflow:hidden;box-shadow:0 0 0 1px rgba(15,23,42,.10)}
        .lang.country-chip .country-chip-text{font-size:10px;line-height:1}
      `;
      document.head.appendChild(style);
    }

    const usTitle = document.querySelector('[data-section="us"] .section-head h2');
    const deTitle = document.querySelector('[data-section="de"] .section-head h2');
    if(usTitle) usTitle.innerHTML = `${US_FLAG}<span>美国</span>`;
    if(deTitle) deTitle.innerHTML = `${DE_FLAG}<span>德国</span>`;

    document.querySelectorAll('[data-section="us"] .card .lang').forEach(chip => {
      chip.classList.add('country-chip');
      chip.innerHTML = `${US_FLAG}<span class="country-chip-text">美国</span>`;
    });
    document.querySelectorAll('[data-section="de"] .card .lang').forEach(chip => {
      chip.classList.add('country-chip');
      chip.innerHTML = `${DE_FLAG}<span class="country-chip-text">德国</span>`;
    });
  }

  function blankConfig(){
    return {
      version:1,
      toolCenter:null,
      docxTemplates:null,
      docxPlaceholder:DEFAULT_DOCX_PLACEHOLDER,
      updatedAt:null
    };
  }

  async function fetchGlobalConfig(){
    for(const url of [RAW_CONFIG_URL + '?v=' + Date.now(), './' + CONFIG_PATH + '?v=' + Date.now()]){
      try{
        const res = await fetch(url, {cache:'no-store'});
        if(!res.ok) continue;
        const data = await res.json();
        return Object.assign(blankConfig(), data && typeof data === 'object' ? data : {});
      }catch(_){ }
    }
    return blankConfig();
  }

  function reorderByIds(container, selector, keyFn, ids){
    if(!container || !Array.isArray(ids) || !ids.length) return false;
    const nodes = [...container.querySelectorAll(selector)];
    if(!nodes.length) return false;
    const map = new Map(nodes.map(node => [keyFn(node), node]));
    const current = nodes.map(keyFn);
    const desired = ids.filter(id => map.has(id));
    current.forEach(id => { if(!desired.includes(id)) desired.push(id); });
    if(current.join('\u0001') === desired.join('\u0001')) return false;
    desired.forEach(id => { const node = map.get(id); if(node) container.appendChild(node); });
    return true;
  }

  function utf8ToBase64(text){
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToUtf8(text){
    const binary = atob(String(text || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function askWriteToken(){
    return (window.prompt(
      '保存全局设置需要 GitHub 写入授权。\n\n请粘贴仅对 mosen6266 仓库具有 Contents: Read and write 权限的 Fine-grained personal access token。\n\n令牌只用于本次保存请求，不会写入网页、仓库或浏览器存储。请不要把令牌发送给任何人。'
    ) || '').trim();
  }

  async function readRepoConfigForWrite(token){
    const res = await fetch(API_CONFIG_URL + '?ref=' + encodeURIComponent(BRANCH), {
      cache:'no-store',
      headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer ' + token,'X-GitHub-Api-Version':'2022-11-28'}
    });
    if(res.status === 404) return {sha:null, data:blankConfig()};
    const payload = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401 || res.status === 403) throw new Error('GitHub 授权无效，或令牌没有该仓库的 Contents 写入权限。');
      throw new Error(payload.message || `读取全局设置失败 (${res.status})`);
    }
    let data = blankConfig();
    try{ data = Object.assign(blankConfig(), JSON.parse(base64ToUtf8(payload.content || ''))); }catch(_){ }
    return {sha:payload.sha || null, data};
  }

  async function saveGlobalSection(section, value){
    const token = askWriteToken();
    if(!token) throw new Error('已取消全局保存。');
    const current = await readRepoConfigForWrite(token);
    const next = Object.assign(blankConfig(), current.data || {});
    next[section] = value;
    next.updatedAt = new Date().toISOString();
    const commitMessages = {
      toolCenter:'Save global tool center order',
      docxTemplates:'Save global DOCX template order',
      docxPlaceholder:'Save global DOCX replacement placeholder'
    };
    const body = {
      message: commitMessages[section] || 'Save global settings',
      content: utf8ToBase64(JSON.stringify(next, null, 2) + '\n'),
      branch: BRANCH
    };
    if(current.sha) body.sha = current.sha;
    const res = await fetch(API_CONFIG_URL, {
      method:'PUT',
      headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer ' + token,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401 || res.status === 403) throw new Error('GitHub 授权无效，或令牌没有该仓库的 Contents 写入权限。');
      if(res.status === 409) throw new Error('设置文件刚刚被更新，请刷新页面后再保存一次。');
      throw new Error(payload.message || `全局保存失败 (${res.status})`);
    }
    return next;
  }

  function setToolNote(text, type){
    const note = document.getElementById('sortNote');
    if(!note) return;
    note.classList.remove('unsaved','saved');
    if(type) note.classList.add(type);
    const target = note.querySelector('span:last-child');
    if(target) target.textContent = text;
  }

  async function initToolCenter(){
    const saveBtn = document.getElementById('saveOrder');
    const grids = [...document.querySelectorAll('[data-grid]')];
    if(!saveBtn || !grids.length) return;
    injectToolCenterFlags();
    const config = await fetchGlobalConfig();
    const shared = config.toolCenter;
    if(shared && typeof shared === 'object'){
      grids.forEach(grid => reorderByIds(grid, '.card', card => card.dataset.id || '', shared[grid.dataset.grid]));
      setToolNote('当前使用全局排序。所有人打开这个固定链接都会看到相同顺序。', 'saved');
    }
    saveBtn.addEventListener('click', async () => {
      const data = {};
      grids.forEach(grid => { data[grid.dataset.grid] = [...grid.querySelectorAll('.card')].map(card => card.dataset.id); });
      saveBtn.disabled = true;
      saveBtn.textContent = '正在保存全局排序…';
      try{
        await saveGlobalSection('toolCenter', data);
        setToolNote('全局排序已保存。以后直接发送原来的墨森工具中心链接即可，所有人都会看到这个顺序。', 'saved');
        saveBtn.textContent = '全局排序已保存';
      }catch(err){
        const msg = err && err.message ? err.message : String(err);
        setToolNote(msg === '已取消全局保存。' ? '已取消全局保存，仓库里的公共顺序没有改变。' : '全局保存失败：' + msg, 'unsaved');
        saveBtn.textContent = '全局保存失败';
      }finally{
        setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = '保存当前排序'; }, 1800);
      }
    });
  }

  function addDocxPlaceholderStyles(){
    if(document.getElementById('docxPlaceholderStyle')) return;
    const style = document.createElement('style');
    style.id = 'docxPlaceholderStyle';
    style.textContent = `
      #docxPlaceholderModal .docx-placeholder-input{width:100%;min-height:92px;resize:vertical;border:1px solid var(--line,#e4e8f0);border-radius:11px;padding:11px 12px;outline:none;line-height:1.55;margin:5px 0 10px;color:var(--text,#172033);background:#fff}
      #docxPlaceholderModal .docx-placeholder-input:focus{border-color:#8ca5ee;box-shadow:0 0 0 3px #eef2ff}
      #docxPlaceholderModal .docx-placeholder-count{font-size:11px;color:var(--muted,#697386);text-align:right;margin:-4px 2px 16px}
      #docxPlaceholderModal .docx-placeholder-tip{font-size:12px;color:var(--muted,#697386);line-height:1.6;margin:0 0 8px}
      #docxPlaceholderModal .docx-placeholder-error{display:none;font-size:12px;color:#c73737;background:#fff0f0;border-radius:9px;padding:8px 10px;margin:0 0 12px}
      #docxPlaceholderModal .docx-placeholder-error.show{display:block}
    `;
    document.head.appendChild(style);
  }

  function createDocxPlaceholderManager(initialValue){
    const topActions = document.querySelector('.top-actions');
    const rows = document.getElementById('rows');
    if(!topActions || !rows) return null;

    addDocxPlaceholderStyles();

    let currentValue = typeof initialValue === 'string' ? initialValue : DEFAULT_DOCX_PLACEHOLDER;
    const applyPlaceholder = () => {
      rows.querySelectorAll('.replace-wrap textarea').forEach(textarea => {
        textarea.placeholder = currentValue;
      });
    };

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-soft';
    button.id = 'docxPlaceholderSettingsBtn';
    button.textContent = '修改输入提示';
    const clearBtn = document.getElementById('clearDraftBtn');
    if(clearBtn) topActions.insertBefore(button, clearBtn);
    else topActions.appendChild(button);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'docxPlaceholderModal';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="docxPlaceholderTitle">
        <h3 id="docxPlaceholderTitle">修改输入框提示</h3>
        <p class="docx-placeholder-tip">这里修改的是右侧英文输入框里显示的提示文字。保存后会写入全局配置，所有人打开这个 DOCX 编辑器时都会使用同一条提示。</p>
        <textarea class="docx-placeholder-input" id="docxPlaceholderInput" maxlength="160" spellcheck="false"></textarea>
        <div class="docx-placeholder-count" id="docxPlaceholderCount">0 / 160</div>
        <div class="docx-placeholder-error" id="docxPlaceholderError"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="docxPlaceholderCancelBtn">取消</button>
          <button type="button" class="btn btn-primary" id="docxPlaceholderSaveBtn">保存并同步给所有人</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#docxPlaceholderInput');
    const count = backdrop.querySelector('#docxPlaceholderCount');
    const error = backdrop.querySelector('#docxPlaceholderError');
    const cancel = backdrop.querySelector('#docxPlaceholderCancelBtn');
    const save = backdrop.querySelector('#docxPlaceholderSaveBtn');

    const setError = message => {
      error.textContent = message || '';
      error.classList.toggle('show', !!message);
    };
    const updateCount = () => { count.textContent = `${input.value.length} / 160`; };
    const open = () => {
      input.value = currentValue;
      updateCount();
      setError('');
      backdrop.classList.add('show');
      setTimeout(() => { input.focus(); input.select(); }, 0);
    };
    const close = () => {
      if(save.disabled) return;
      backdrop.classList.remove('show');
      setError('');
    };

    button.addEventListener('click', open);
    cancel.addEventListener('click', close);
    input.addEventListener('input', updateCount);
    backdrop.addEventListener('click', e => { if(e.target === backdrop) close(); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && backdrop.classList.contains('show')) close(); });

    save.addEventListener('click', async () => {
      const value = input.value.trim();
      if(!value){ setError('提示文字不能为空。'); input.focus(); return; }
      if(value.length > 160){ setError('提示文字最多 160 个字符。'); input.focus(); return; }
      setError('');
      save.disabled = true;
      cancel.disabled = true;
      save.textContent = '正在全局保存…';
      try{
        await saveGlobalSection('docxPlaceholder', value);
        currentValue = value;
        applyPlaceholder();
        backdrop.classList.remove('show');
        button.textContent = '输入提示已全局保存';
        setTimeout(() => { button.textContent = '修改输入提示'; }, 1800);
      }catch(err){
        const msg = err && err.message ? err.message : String(err);
        setError(msg === '已取消全局保存。' ? '已取消保存，公共提示没有改变。' : '保存失败：' + msg);
      }finally{
        save.disabled = false;
        cancel.disabled = false;
        save.textContent = '保存并同步给所有人';
      }
    });

    const observer = new MutationObserver(applyPlaceholder);
    observer.observe(rows, {childList:true, subtree:true});
    applyPlaceholder();

    return {
      get value(){ return currentValue; },
      setValue(value){
        if(typeof value !== 'string' || !value.trim() || value === currentValue) return;
        currentValue = value;
        applyPlaceholder();
        if(!backdrop.classList.contains('show')) input.value = currentValue;
      },
      destroy(){ observer.disconnect(); }
    };
  }

  function initDocxEditor(){
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      const saveBtn = document.getElementById('saveBuiltinOrderBtn');
      const usList = document.getElementById('builtinUsList');
      const deList = document.getElementById('builtinDeList');
      if(!saveBtn || !usList || !deList){ if(attempts > 240) clearInterval(timer); return; }
      clearInterval(timer);

      let applying = false;
      let shared = null;
      const applyGlobal = () => {
        if(applying || !shared) return;
        applying = true;
        try{
          reorderByIds(usList, '.builtin-item', node => node.dataset.path || '', shared.us);
          reorderByIds(deList, '.builtin-item', node => node.dataset.path || '', shared.de);
          const status = document.getElementById('builtinSortStatus');
          if(status){ status.textContent = '全局排序'; status.classList.remove('dirty'); }
        }finally{ applying = false; }
      };

      const config = await fetchGlobalConfig();
      shared = config.docxTemplates && typeof config.docxTemplates === 'object' ? config.docxTemplates : null;
      applyGlobal();

      const placeholderManager = createDocxPlaceholderManager(
        typeof config.docxPlaceholder === 'string' && config.docxPlaceholder.trim()
          ? config.docxPlaceholder
          : DEFAULT_DOCX_PLACEHOLDER
      );

      const observer = new MutationObserver(() => { if(!applying) applyGlobal(); });
      observer.observe(usList, {childList:true});
      observer.observe(deList, {childList:true});

      saveBtn.addEventListener('click', async () => {
        const data = {
          us:[...usList.querySelectorAll('.builtin-item')].map(node => node.dataset.path),
          de:[...deList.querySelectorAll('.builtin-item')].map(node => node.dataset.path)
        };
        saveBtn.disabled = true;
        saveBtn.textContent = '正在保存全局排序…';
        const status = document.getElementById('builtinSortStatus');
        try{
          await saveGlobalSection('docxTemplates', data);
          shared = data;
          if(status){ status.textContent = '已全局保存'; status.classList.remove('dirty'); }
          saveBtn.textContent = '全局排序已保存';
        }catch(err){
          const msg = err && err.message ? err.message : String(err);
          if(status){ status.textContent = msg === '已取消全局保存。' ? '未全局保存' : '全局保存失败'; status.classList.add('dirty'); }
          saveBtn.textContent = msg === '已取消全局保存。' ? '已取消' : '全局保存失败';
        }finally{
          setTimeout(() => { saveBtn.disabled = false; saveBtn.textContent = '保存当前排序'; }, 1800);
        }
      });

      if(placeholderManager){
        const poll = setInterval(async () => {
          try{
            const latest = await fetchGlobalConfig();
            if(typeof latest.docxPlaceholder === 'string' && latest.docxPlaceholder.trim()){
              placeholderManager.setValue(latest.docxPlaceholder);
            }
          }catch(_){ }
        }, 30000);
        window.addEventListener('beforeunload', () => clearInterval(poll), {once:true});
      }
    }, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { initToolCenter(); initDocxEditor(); });
  }else{
    initToolCenter();
    initDocxEditor();
  }
})();
