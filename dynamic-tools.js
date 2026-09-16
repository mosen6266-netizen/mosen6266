(() => {
  'use strict';

  const OWNER = 'mosen6266-netizen';
  const REPO = 'mosen6266';
  const BRANCH = 'main';
  const INDEX_URL = './tools/index.json';
  const GLOBAL_ORDER_URL = './global-order.json';

  const US_FLAG = `<span class="tool-country-flag" aria-hidden="true"><svg viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="18" rx="2" fill="#fff"/><g fill="#B22234"><rect y="0" width="28" height="1.4"/><rect y="2.8" width="28" height="1.4"/><rect y="5.6" width="28" height="1.4"/><rect y="8.4" width="28" height="1.4"/><rect y="11.2" width="28" height="1.4"/><rect y="14" width="28" height="1.4"/><rect y="16.6" width="28" height="1.4"/></g><rect width="11.8" height="9.8" rx="1" fill="#3C3B6E"/><g fill="#fff"><circle cx="2" cy="2" r=".65"/><circle cx="4.4" cy="2" r=".65"/><circle cx="6.8" cy="2" r=".65"/><circle cx="9.2" cy="2" r=".65"/><circle cx="3.2" cy="4" r=".65"/><circle cx="5.6" cy="4" r=".65"/><circle cx="8" cy="4" r=".65"/><circle cx="2" cy="6" r=".65"/><circle cx="4.4" cy="6" r=".65"/><circle cx="6.8" cy="6" r=".65"/><circle cx="9.2" cy="6" r=".65"/><circle cx="3.2" cy="8" r=".65"/><circle cx="5.6" cy="8" r=".65"/><circle cx="8" cy="8" r=".65"/></g></svg></span>`;
  const DE_FLAG = `<span class="tool-country-flag" aria-hidden="true"><svg viewBox="0 0 28 18" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="18" rx="2" fill="#000"/><rect y="6" width="28" height="6" fill="#DD0000"/><rect y="12" width="28" height="6" rx="0 0 2 2" fill="#FFCE00"/></svg></span>`;

  function ensureStyle(){
    if(document.getElementById('dynamicToolsStyle')) return;
    const style = document.createElement('style');
    style.id = 'dynamicToolsStyle';
    style.textContent = `
      .icon.dynamic-image-icon{overflow:hidden;background:#fff;border:1px solid #e5e7eb;padding:0}
      .icon.dynamic-image-icon img{width:100%;height:100%;object-fit:cover;display:block}
      .grid.dynamic-drop-target{outline:2px dashed rgba(17,24,39,.22);outline-offset:6px;border-radius:14px}
    `;
    document.head.appendChild(style);
  }

  function safeText(value, fallback=''){
    return String(value == null ? fallback : value).trim();
  }

  function categoryFor(item){
    const c = safeText(item.category).toLowerCase();
    if(c === 'de' || c === '德国') return 'de';
    if(c === 'other' || c === '其它' || c === '其他' || c === '其它工具' || c === '其他工具') return 'other';
    return 'us';
  }

  function initials(title){
    const text = safeText(title, 'HT').replace(/\s+/g,' ').trim();
    const ascii = text.match(/[A-Za-z0-9]+/g);
    if(ascii && ascii.length) return ascii.slice(0,2).map(x => x[0].toUpperCase()).join('');
    return [...text].slice(0,2).join('') || 'HT';
  }

  function iconUrl(item){
    const icon = safeText(item.icon);
    if(!icon) return '';
    try{
      const toolUrl = new URL(item.path, location.href);
      return new URL(icon, toolUrl).href;
    }catch(_){ return ''; }
  }

  function createCard(item){
    const card = document.createElement('a');
    const title = safeText(item.title, item.name || 'HTML 工具');
    const description = safeText(item.description, '自定义 HTML 工具');
    const category = categoryFor(item);
    const img = iconUrl(item);
    card.className = 'card dynamic-tool-card';
    card.draggable = true;
    card.dataset.id = safeText(item.id);
    card.dataset.name = `${title} ${category === 'de' ? '德国' : category === 'other' ? '其它工具' : '美国'}`;
    card.dataset.dynamicTool = '1';
    card.dataset.defaultCategory = category;
    card.href = item.path;
    card.target = '_blank';
    card.rel = 'noopener';
    card.innerHTML = `
      <div class="card-top">
        <div class="icon${img ? ' dynamic-image-icon' : ''}">${img ? `<img src="${img.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" alt="">` : initials(title)}</div>
        <div class="lang">工具</div>
      </div>
      <div class="title"></div>
      <div class="desc"></div>
      <div class="open">打开工具 →</div>
      <div class="drag-handle">⋮⋮</div>`;
    card.querySelector('.title').textContent = title;
    card.querySelector('.desc').textContent = description;
    return card;
  }

  function setCardCategoryUI(card, category){
    const chip = card.querySelector('.lang');
    if(!chip) return;
    chip.classList.remove('country-chip');
    if(category === 'us'){
      chip.classList.add('country-chip');
      chip.innerHTML = `${US_FLAG}<span class="country-chip-text">美国</span>`;
    }else if(category === 'de'){
      chip.classList.add('country-chip');
      chip.innerHTML = `${DE_FLAG}<span class="country-chip-text">德国</span>`;
    }else{
      chip.innerHTML = '工具';
    }
  }

  function refreshCategoryUI(){
    document.querySelectorAll('[data-grid]').forEach(grid => {
      const cat = grid.dataset.grid;
      grid.querySelectorAll(':scope > .card').forEach(card => setCardCategoryUI(card, cat));
    });
  }

  function refreshCounts(){
    let total = 0;
    document.querySelectorAll('[data-section]').forEach(section => {
      const grid = section.querySelector('[data-grid]');
      const count = grid ? grid.querySelectorAll(':scope > .card').length : 0;
      total += count;
      const badge = section.querySelector('.section-head > span');
      if(badge) badge.textContent = String(count);
    });
    const totalBadge = document.querySelector('.count');
    if(totalBadge) totalBadge.textContent = `${total} 个工具`;
  }

  async function fetchJson(url){
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error(`${url} (${res.status})`);
    return res.json();
  }

  async function applyGlobalCrossCategoryOrder(){
    let config;
    try{ config = await fetchJson(GLOBAL_ORDER_URL); }catch(_){ return; }
    const shared = config && config.toolCenter;
    if(!shared || typeof shared !== 'object') return;

    const grids = new Map([...document.querySelectorAll('[data-grid]')].map(g => [g.dataset.grid, g]));
    const cards = [...document.querySelectorAll('.card[data-id]')];
    const cardMap = new Map(cards.map(c => [c.dataset.id, c]));
    const placed = new Set();

    ['us','de','other'].forEach(cat => {
      const grid = grids.get(cat);
      if(!grid) return;
      const ids = Array.isArray(shared[cat]) ? shared[cat] : [];
      ids.forEach(id => {
        const card = cardMap.get(id);
        if(card && !placed.has(id)){
          grid.appendChild(card);
          placed.add(id);
        }
      });
    });

    // New tools that are not yet present in the saved global order stay in their automatic/default category.
    cards.forEach(card => {
      const id = card.dataset.id;
      if(placed.has(id)) return;
      let cat = card.dataset.defaultCategory || (card.parentElement && card.parentElement.dataset.grid) || 'other';
      if(!grids.has(cat)) cat = 'other';
      grids.get(cat).appendChild(card);
    });

    refreshCategoryUI();
    refreshCounts();
  }

  function getDragAfterElement(grid, x, y, dragged){
    const cards = [...grid.querySelectorAll(':scope > .card:not(.dragging):not(.hidden)')];
    let closest = {offset:Number.NEGATIVE_INFINITY, element:null};
    for(const card of cards){
      if(card === dragged) continue;
      const box = card.getBoundingClientRect();
      const centerY = box.top + box.height / 2;
      const centerX = box.left + box.width / 2;
      const rowDistance = y - centerY;
      const colDistance = x - centerX;
      const rowTolerance = box.height * .45;
      const offset = Math.abs(rowDistance) <= rowTolerance ? colDistance : rowDistance * 10;
      if(offset < 0 && offset > closest.offset) closest = {offset, element:card};
    }
    return closest.element;
  }

  function markUnsaved(){
    const note = document.getElementById('sortNote');
    if(!note) return;
    note.classList.remove('saved');
    note.classList.add('unsaved');
    const text = note.querySelector('span:last-child');
    if(text) text.textContent = '分类或顺序已调整但尚未保存。点击“保存当前排序”后，所有人都会看到这个分类和顺序。';
  }

  function enableCrossCategoryDrag(){
    let dragged = null;
    let beforeSignature = '';
    let suppressClickUntil = 0;

    const signature = () => [...document.querySelectorAll('[data-grid]')].map(grid =>
      `${grid.dataset.grid}:${[...grid.querySelectorAll(':scope > .card')].map(c => c.dataset.id).join(',')}`
    ).join('|');

    document.addEventListener('dragstart', e => {
      const card = e.target && e.target.closest ? e.target.closest('.card[data-id]') : null;
      if(!card || card.classList.contains('hidden')) return;
      dragged = card;
      beforeSignature = signature();
      card.classList.add('dragging');
      if(e.dataTransfer){
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id || 'card');
      }
      e.stopImmediatePropagation();
    }, true);

    document.addEventListener('dragover', e => {
      if(!dragged) return;
      const grid = e.target && e.target.closest ? e.target.closest('[data-grid]') : null;
      if(!grid) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('[data-grid]').forEach(g => g.classList.toggle('dynamic-drop-target', g === grid));
      const after = getDragAfterElement(grid, e.clientX, e.clientY, dragged);
      if(after == null) grid.appendChild(dragged);
      else if(after !== dragged) grid.insertBefore(dragged, after);
    }, true);

    document.addEventListener('drop', e => {
      if(!dragged) return;
      const grid = e.target && e.target.closest ? e.target.closest('[data-grid]') : null;
      if(!grid) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    document.addEventListener('dragend', e => {
      if(!dragged) return;
      dragged.classList.remove('dragging');
      document.querySelectorAll('[data-grid]').forEach(g => g.classList.remove('dynamic-drop-target'));
      const changed = beforeSignature !== signature();
      if(changed){
        refreshCategoryUI();
        refreshCounts();
        markUnsaved();
      }
      suppressClickUntil = Date.now() + 180;
      dragged = null;
      e.stopImmediatePropagation();
    }, true);

    document.addEventListener('click', e => {
      if(Date.now() > suppressClickUntil) return;
      const card = e.target && e.target.closest ? e.target.closest('.card[data-id]') : null;
      if(!card) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  async function init(){
    ensureStyle();
    enableCrossCategoryDrag();
    let data = {tools:[]};
    try{ data = await fetchJson(INDEX_URL); }catch(err){ console.warn('无法读取动态工具目录：', err); }
    const tools = Array.isArray(data && data.tools) ? data.tools : [];
    const existing = new Set([...document.querySelectorAll('.card[data-id]')].map(c => c.dataset.id));
    tools.forEach(item => {
      if(!item || !item.id || !item.path || existing.has(item.id)) return;
      const cat = categoryFor(item);
      const grid = document.querySelector(`[data-grid="${cat}"]`) || document.querySelector('[data-grid="other"]');
      if(!grid) return;
      const card = createCard(item);
      grid.appendChild(card);
      existing.add(item.id);
    });
    await applyGlobalCrossCategoryOrder();
    refreshCategoryUI();
    refreshCounts();
    const search = document.getElementById('search');
    if(search) search.dispatchEvent(new Event('input', {bubbles:true}));
  }

  window.MosenDynamicToolsReady = (document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', () => resolve(init()), {once:true}))
    : init()
  );
})();
