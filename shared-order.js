(() => {
  'use strict';

  const TOOL_PARAM = 'toolOrder';
  const TEMPLATE_PARAM = 'templateOrder';

  function readOrderParam(name){
    try{
      const raw = new URL(window.location.href).searchParams.get(name);
      if(!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    }catch(err){
      console.warn('无法读取共享排序：', err);
      return null;
    }
  }

  function writeOrderParam(name, data){
    const url = new URL(window.location.href);
    url.searchParams.set(name, JSON.stringify(data));
    history.replaceState(null, '', url.toString());
    return url.toString();
  }

  async function copyText(text){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(_){ }
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }catch(_){
      return false;
    }
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
    desired.forEach(id => {
      const node = map.get(id);
      if(node) container.appendChild(node);
    });
    return true;
  }

  function initToolCenter(){
    const saveBtn = document.getElementById('saveOrder');
    const grids = [...document.querySelectorAll('[data-grid]')];
    if(!saveBtn || !grids.length) return;

    const shared = readOrderParam(TOOL_PARAM);
    if(shared){
      grids.forEach(grid => {
        reorderByIds(
          grid,
          '.card',
          card => card.dataset.id || '',
          shared[grid.dataset.grid]
        );
      });
      const note = document.getElementById('sortNote');
      if(note){
        note.classList.remove('unsaved');
        note.classList.add('saved');
        const text = note.querySelector('span:last-child');
        if(text) text.textContent = '当前正在使用共享排序。';
      }
    }

    saveBtn.addEventListener('click', async () => {
      const data = {};
      grids.forEach(grid => {
        data[grid.dataset.grid] = [...grid.querySelectorAll('.card')].map(card => card.dataset.id);
      });
      const link = writeOrderParam(TOOL_PARAM, data);
      const copied = await copyText(link);
      const note = document.getElementById('sortNote');
      if(note){
        note.classList.remove('unsaved');
        note.classList.add('saved');
        const text = note.querySelector('span:last-child');
        if(text) text.textContent = copied ? '当前排序已保存，共享链接已复制。别人打开这个链接会看到相同顺序。' : '当前排序已保存。请复制地址栏里的链接分享，别人打开后会看到相同顺序。';
      }
      saveBtn.textContent = copied ? '共享链接已复制' : '已生成共享链接';
      setTimeout(() => { saveBtn.textContent = '保存当前排序'; }, 1800);
    });
  }

  function initDocxEditor(){
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const saveBtn = document.getElementById('saveBuiltinOrderBtn');
      const usList = document.getElementById('builtinUsList');
      const deList = document.getElementById('builtinDeList');
      if(!saveBtn || !usList || !deList){
        if(attempts > 200) clearInterval(timer);
        return;
      }
      clearInterval(timer);

      let applying = false;
      const applyShared = () => {
        if(applying) return;
        const shared = readOrderParam(TEMPLATE_PARAM);
        if(!shared) return;
        applying = true;
        try{
          reorderByIds(usList, '.builtin-item', node => node.dataset.path || '', shared.us);
          reorderByIds(deList, '.builtin-item', node => node.dataset.path || '', shared.de);
          const status = document.getElementById('builtinSortStatus');
          if(status){
            status.textContent = '共享排序';
            status.classList.remove('dirty');
          }
        }finally{
          applying = false;
        }
      };

      const observer = new MutationObserver(() => {
        if(!applying) applyShared();
      });
      observer.observe(usList, {childList:true});
      observer.observe(deList, {childList:true});
      applyShared();

      saveBtn.addEventListener('click', async () => {
        const data = {
          us: [...usList.querySelectorAll('.builtin-item')].map(node => node.dataset.path),
          de: [...deList.querySelectorAll('.builtin-item')].map(node => node.dataset.path)
        };
        const link = writeOrderParam(TEMPLATE_PARAM, data);
        const copied = await copyText(link);
        const status = document.getElementById('builtinSortStatus');
        if(status){
          status.textContent = copied ? '共享链接已复制' : '共享排序已保存';
          status.classList.remove('dirty');
        }
        saveBtn.textContent = copied ? '共享链接已复制' : '已生成共享链接';
        setTimeout(() => { saveBtn.textContent = '保存当前排序'; }, 1800);
      });
    }, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      initToolCenter();
      initDocxEditor();
    });
  }else{
    initToolCenter();
    initDocxEditor();
  }
})();
