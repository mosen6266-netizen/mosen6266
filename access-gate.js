(() => {
  'use strict';

  const OWNER = 'mosen6266-netizen';
  const REPO = 'mosen6266';
  const BRANCH = 'main';
  const CONFIG_PATH = 'access-config.json';
  const RAW_CONFIG_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${CONFIG_PATH}`;
  const API_CONFIG_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONFIG_PATH}`;

  document.documentElement.classList.add('access-locked');

  const style = document.createElement('style');
  style.id = 'accessGateStyle';
  style.textContent = `
    html.access-locked body > :not(#accessGateOverlay){visibility:hidden!important}
    #accessGateOverlay{position:fixed;inset:0;z-index:2147483647;background:linear-gradient(135deg,#f8fafc 0%,#eef2f7 55%,#f7f7f8 100%);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,"Segoe UI","Microsoft YaHei",Arial,sans-serif;color:#111827;visibility:visible!important}
    .ag-admin-btn{position:absolute;top:24px;right:28px;border:1px solid #d8dde6;background:rgba(255,255,255,.88);backdrop-filter:blur(10px);color:#4b5563;border-radius:11px;padding:9px 13px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(15,23,42,.05)}
    .ag-admin-btn:hover{border-color:#b8c0cd;color:#111827}
    .ag-card{width:min(430px,100%);background:#fff;border:1px solid #e3e7ee;border-radius:24px;padding:34px;box-shadow:0 24px 70px rgba(15,23,42,.12)}
    .ag-logo{width:52px;height:52px;border-radius:15px;background:#111827;color:#fff;display:grid;place-items:center;font-size:21px;font-weight:850;letter-spacing:-1px;margin-bottom:22px}
    .ag-card h1{font-size:25px;line-height:1.25;margin:0 0 8px;letter-spacing:-.02em}
    .ag-card p{margin:0 0 24px;color:#7a8493;font-size:13px;line-height:1.65}
    .ag-label{display:block;font-size:12px;font-weight:750;color:#4b5563;margin:0 0 8px}
    .ag-input{width:100%;height:48px;border:1px solid #d8dde6;border-radius:12px;padding:0 14px;font:inherit;font-size:14px;outline:none;background:#fff;color:#111827;transition:.15s}
    .ag-input:focus{border-color:#7b8798;box-shadow:0 0 0 3px rgba(17,24,39,.07)}
    .ag-login-btn,.ag-primary{width:100%;height:48px;border:0;border-radius:12px;background:#111827;color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-top:12px}
    .ag-login-btn:hover,.ag-primary:hover{background:#263244}
    .ag-login-btn:disabled,.ag-primary:disabled{opacity:.55;cursor:not-allowed}
    .ag-error{min-height:20px;margin-top:10px;color:#b42318;font-size:12px;line-height:1.5}
    .ag-foot{margin-top:18px;text-align:center;color:#a0a7b2;font-size:11px}
    .ag-modal{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.52);display:none;align-items:center;justify-content:center;padding:22px;visibility:visible!important}
    .ag-modal.open{display:flex}
    .ag-modal-card{width:min(500px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:28px;box-shadow:0 30px 90px rgba(0,0,0,.25)}
    .ag-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
    .ag-modal-head h2{margin:0;font-size:20px}
    .ag-modal-head p{margin:6px 0 0;color:#7a8493;font-size:12px;line-height:1.55}
    .ag-close{border:0;background:#f2f4f7;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:18px;color:#667085;flex:none}
    .ag-field{margin-top:15px}
    .ag-token-note{margin-top:8px;color:#8a94a3;font-size:11px;line-height:1.5}
    .ag-actions{display:flex;gap:10px;margin-top:20px}
    .ag-secondary{height:44px;padding:0 17px;border:1px solid #d8dde6;background:#fff;border-radius:11px;font-weight:750;cursor:pointer;color:#475467}
    .ag-primary{height:44px;margin:0;flex:1}
    .ag-status{min-height:20px;margin-top:12px;font-size:12px;line-height:1.5;color:#667085}
    .ag-status.error{color:#b42318}.ag-status.success{color:#16835c}
    @media(max-width:560px){#accessGateOverlay{padding:15px}.ag-card{padding:27px 20px}.ag-admin-btn{top:14px;right:14px}.ag-modal-card{padding:23px 18px}}
  `;
  document.head.appendChild(style);

  let currentConfig = null;

  async function sha256(text){
    const bytes = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function base64ToUtf8(text){
    const binary = atob(String(text || '').replace(/\s/g,''));
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function utf8ToBase64(text){
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function fetchConfig(){
    const urls = [RAW_CONFIG_URL + '?v=' + Date.now(), './' + CONFIG_PATH + '?v=' + Date.now()];
    for(const url of urls){
      try{
        const res = await fetch(url,{cache:'no-store'});
        if(!res.ok) continue;
        const data = await res.json();
        if(data && data.passwordHash) return data;
      }catch(_){ }
    }
    throw new Error('暂时无法读取访问密码配置，请稍后刷新重试。');
  }

  function buildGate(){
    const overlay = document.createElement('div');
    overlay.id = 'accessGateOverlay';
    overlay.innerHTML = `
      <button type="button" class="ag-admin-btn" id="agAdminBtn">管理员</button>
      <div class="ag-card">
        <div class="ag-logo">墨森</div>
        <h1>墨森工具中心</h1>
        <p>请输入访问密码后继续进入工具中心。</p>
        <form id="agLoginForm" autocomplete="off">
          <label class="ag-label" for="agPassword">访问密码</label>
          <input class="ag-input" id="agPassword" type="password" autocomplete="current-password" placeholder="请输入密码" />
          <button class="ag-login-btn" id="agLoginBtn" type="submit">进入工具中心</button>
          <div class="ag-error" id="agLoginError"></div>
        </form>
        <div class="ag-foot">Private tool access</div>
      </div>
      <div class="ag-modal" id="agAdminModal">
        <div class="ag-modal-card">
          <div class="ag-modal-head">
            <div><h2>管理员权限</h2><p>验证旧密码和 GitHub 写入授权后，可修改所有人使用的新访问密码。</p></div>
            <button type="button" class="ag-close" id="agAdminClose">×</button>
          </div>
          <form id="agAdminForm" autocomplete="off">
            <div class="ag-field"><label class="ag-label" for="agOldPassword">旧密码</label><input class="ag-input" id="agOldPassword" type="password" autocomplete="current-password" /></div>
            <div class="ag-field"><label class="ag-label" for="agNewPassword">新密码</label><input class="ag-input" id="agNewPassword" type="password" autocomplete="new-password" /></div>
            <div class="ag-field"><label class="ag-label" for="agNewPassword2">再次输入新密码</label><input class="ag-input" id="agNewPassword2" type="password" autocomplete="new-password" /></div>
            <div class="ag-field"><label class="ag-label" for="agToken">GitHub Fine-grained Token</label><input class="ag-input" id="agToken" type="password" autocomplete="off" placeholder="github_pat_…" /><div class="ag-token-note">Token 仅用于本次修改请求，不会保存到网页、仓库或浏览器存储。</div></div>
            <div class="ag-actions"><button type="button" class="ag-secondary" id="agCancel">取消</button><button type="submit" class="ag-primary" id="agSavePassword">修改密码</button></div>
            <div class="ag-status" id="agAdminStatus"></div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function readRepoConfig(token){
    const res = await fetch(API_CONFIG_URL + '?ref=' + encodeURIComponent(BRANCH),{
      cache:'no-store',
      headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer ' + token,'X-GitHub-Api-Version':'2022-11-28'}
    });
    const payload = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401 || res.status === 403) throw new Error('Token 无效，或没有该仓库 Contents: Read and write 权限。');
      throw new Error(payload.message || `读取密码配置失败 (${res.status})`);
    }
    let data;
    try{ data = JSON.parse(base64ToUtf8(payload.content || '')); }
    catch(_){ throw new Error('仓库中的密码配置格式不正确。'); }
    return {sha:payload.sha,data};
  }

  async function updatePassword(oldPassword,newPassword,token){
    const oldHash = await sha256(oldPassword);
    const remote = await readRepoConfig(token);
    if(!remote.data || oldHash !== remote.data.passwordHash) throw new Error('旧密码不正确。');

    const newHash = await sha256(newPassword);
    const next = {
      version:1,
      passwordHash:newHash,
      updatedAt:new Date().toISOString()
    };
    const res = await fetch(API_CONFIG_URL,{
      method:'PUT',
      headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer ' + token,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
      body:JSON.stringify({
        message:'Update tool center access password',
        content:utf8ToBase64(JSON.stringify(next,null,2) + '\n'),
        sha:remote.sha,
        branch:BRANCH
      })
    });
    const payload = await res.json().catch(() => ({}));
    if(!res.ok){
      if(res.status === 401 || res.status === 403) throw new Error('Token 无效，或没有该仓库 Contents: Read and write 权限。');
      if(res.status === 409) throw new Error('密码配置刚刚被更新，请刷新页面后重试。');
      throw new Error(payload.message || `修改密码失败 (${res.status})`);
    }
    currentConfig = next;
    return true;
  }

  async function init(){
    const overlay = buildGate();
    const loginForm = overlay.querySelector('#agLoginForm');
    const loginBtn = overlay.querySelector('#agLoginBtn');
    const passwordInput = overlay.querySelector('#agPassword');
    const loginError = overlay.querySelector('#agLoginError');
    const adminBtn = overlay.querySelector('#agAdminBtn');
    const modal = overlay.querySelector('#agAdminModal');
    const adminForm = overlay.querySelector('#agAdminForm');
    const adminStatus = overlay.querySelector('#agAdminStatus');
    const savePasswordBtn = overlay.querySelector('#agSavePassword');

    try{
      currentConfig = await fetchConfig();
      passwordInput.focus();
    }catch(err){
      loginError.textContent = err.message || String(err);
      loginBtn.disabled = true;
    }

    loginForm.addEventListener('submit',async e => {
      e.preventDefault();
      if(!currentConfig) return;
      loginError.textContent = '';
      loginBtn.disabled = true;
      loginBtn.textContent = '正在验证…';
      try{
        const enteredHash = await sha256(passwordInput.value);
        if(enteredHash !== currentConfig.passwordHash){
          loginError.textContent = '密码不正确，请重新输入。';
          passwordInput.select();
          return;
        }
        overlay.remove();
        document.documentElement.classList.remove('access-locked');
      }finally{
        if(document.body.contains(loginBtn)){
          loginBtn.disabled = false;
          loginBtn.textContent = '进入工具中心';
        }
      }
    });

    const closeModal = () => {
      modal.classList.remove('open');
      adminForm.reset();
      adminStatus.textContent = '';
      adminStatus.className = 'ag-status';
    };
    adminBtn.addEventListener('click',() => {
      modal.classList.add('open');
      setTimeout(() => overlay.querySelector('#agOldPassword').focus(),50);
    });
    overlay.querySelector('#agAdminClose').addEventListener('click',closeModal);
    overlay.querySelector('#agCancel').addEventListener('click',closeModal);
    modal.addEventListener('click',e => { if(e.target === modal) closeModal(); });

    adminForm.addEventListener('submit',async e => {
      e.preventDefault();
      const oldPassword = overlay.querySelector('#agOldPassword').value;
      const newPassword = overlay.querySelector('#agNewPassword').value;
      const newPassword2 = overlay.querySelector('#agNewPassword2').value;
      const token = overlay.querySelector('#agToken').value.trim();
      adminStatus.className = 'ag-status';
      adminStatus.textContent = '';

      if(!oldPassword || !newPassword || !newPassword2 || !token){
        adminStatus.classList.add('error'); adminStatus.textContent = '请完整填写旧密码、新密码和 Token。'; return;
      }
      if(newPassword !== newPassword2){
        adminStatus.classList.add('error'); adminStatus.textContent = '两次输入的新密码不一致。'; return;
      }
      if(newPassword.length < 4){
        adminStatus.classList.add('error'); adminStatus.textContent = '新密码至少输入 4 个字符。'; return;
      }
      savePasswordBtn.disabled = true;
      savePasswordBtn.textContent = '正在修改…';
      try{
        await updatePassword(oldPassword,newPassword,token);
        adminStatus.classList.add('success');
        adminStatus.textContent = '密码修改成功。以后所有人打开这个固定首页都会使用新密码。';
        overlay.querySelector('#agToken').value = '';
        overlay.querySelector('#agOldPassword').value = '';
        overlay.querySelector('#agNewPassword').value = '';
        overlay.querySelector('#agNewPassword2').value = '';
        passwordInput.value = '';
      }catch(err){
        adminStatus.classList.add('error');
        adminStatus.textContent = err && err.message ? err.message : String(err);
      }finally{
        savePasswordBtn.disabled = false;
        savePasswordBtn.textContent = '修改密码';
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
