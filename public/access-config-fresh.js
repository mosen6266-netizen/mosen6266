(() => {
  'use strict';

  const OWNER = 'mosen6266-netizen';
  const REPO = 'mosen6266';
  const BRANCH = 'main';
  const CONFIG_PATH = 'access-config.json';
  const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONFIG_PATH}?ref=${encodeURIComponent(BRANCH)}`;
  const originalFetch = window.fetch.bind(window);

  function decodeBase64Utf8(text){
    const binary = atob(String(text || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function isConfigRead(url, init){
    const method = String((init && init.method) || 'GET').toUpperCase();
    if(method !== 'GET') return false;
    try{
      const u = new URL(url, location.href);
      if(u.hostname === 'api.github.com') return false;
      return u.pathname.endsWith('/access-config.json');
    }catch(_){
      return false;
    }
  }

  window.fetch = async function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if(isConfigRead(url, init)){
      try{
        const sep = API_URL.includes('?') ? '&' : '?';
        const res = await originalFetch(API_URL + sep + '_=' + Date.now(), {
          cache: 'no-store',
          headers: {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });
        if(res.ok){
          const payload = await res.json();
          const text = decodeBase64Utf8(payload.content || '');
          return new Response(text, {
            status: 200,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              'Pragma': 'no-cache'
            }
          });
        }
      }catch(_){ }
    }
    return originalFetch(input, init);
  };
})();
