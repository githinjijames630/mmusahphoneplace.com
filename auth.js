(() => {
  const defaultPassword = 'musa123';
  const sessionDuration = 5 * 60 * 1000;
  const sessionKey = 'musaMobilesOwnerSession';
  let sessionTimer;
  const isOwnerPage = () => /owner\.html$/i.test(window.location.pathname) || window.location.hash === '#owner';
  const isHostedApp = () => window.location.protocol !== 'file:';
  const getPassword = () => localStorage.getItem('musaMobilesOwnerPassword') || defaultPassword;
  const form = () => document.querySelector('#modalForm');
  const hasOwnerSession = () => !isHostedApp() && localStorage.getItem(sessionKey) === 'true';
  const loginWithBackend = async (password) => {
    if (!isHostedApp()) return false;
    try {
      const result = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      return result.ok;
    } catch {
      return false;
    }
  };
  const restoreBackendSession = async () => {
    if (!isHostedApp() || !isOwnerPage()) return;
    try {
      const result = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!result.ok) return;
      if (window.state) window.state.ownerUnlocked = true;
      const ownerView = document.querySelector('#ownerView');
      ownerView?.classList.add('active');
      if (ownerView) ownerView.style.display = '';
      document.querySelector('#modalBackdrop')?.classList.add('hidden');
      window.showOwner?.();
    } catch {
      // Keep the protected view locked when the backend is unavailable.
    }
  };
  const ensureOwnerGate = () => {
    if (!isOwnerPage()) return;
    const ownerView = document.querySelector('#ownerView');
    const modalBackdrop = document.querySelector('#modalBackdrop');
    if (!ownerView || !modalBackdrop) return;
    const unlocked = hasOwnerSession();
    if (window.state) window.state.ownerUnlocked = unlocked;
    ownerView.classList.toggle('active', unlocked);
    ownerView.style.display = unlocked ? '' : 'none';
    modalBackdrop.classList.toggle('hidden', unlocked);
    if (!unlocked) {
      document.querySelector('#modalEyebrow').textContent = 'SECURE ACCESS';
      document.querySelector('#modalTitle').textContent = 'Owner sign in';
      document.querySelector('#modalCopy').textContent = 'Only the owner can access inventory, sales, expenses, and settings. Production login requires a secure backend.';
      form().innerHTML = '<label>Owner password<input name="ownerPassword" type="password" required autofocus placeholder="Enter owner password"></label><button class="button button-dark form-submit">Unlock owner desk</button>';
    }
  };
  const resetSessionTimer = () => {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
      window.lockOwner();
      window.showToast('Owner session locked after inactivity');
    }, sessionDuration);
  };
  window.lockOwner = () => {
    clearTimeout(sessionTimer);
    localStorage.setItem(sessionKey, 'false');
    if (window.state) window.state.ownerUnlocked = false;
    document.querySelector('#modalBackdrop')?.classList.remove('hidden');
    const ownerView = document.querySelector('#ownerView');
    if (ownerView) {
      ownerView.classList.remove('active');
      ownerView.style.display = 'none';
    }
    const publicView = document.querySelector('#publicView');
    if (publicView) publicView.classList.add('active');
    document.body.classList.remove('owner-mode');
    if (isOwnerPage()) {
      document.querySelector('#modalEyebrow').textContent = 'SECURE ACCESS';
      document.querySelector('#modalTitle').textContent = 'Owner sign in';
      document.querySelector('#modalCopy').textContent = 'Only the owner can access inventory, sales, expenses, and settings. Production login requires a secure backend.';
      form().innerHTML = '<label>Owner password<input name="ownerPassword" type="password" required autofocus placeholder="Enter owner password"></label><button class="button button-dark form-submit">Unlock owner desk</button>';
      window.location.href = 'index.html';
    }
  };
  const openAccess = () => {
    document.querySelector('#modalBackdrop').classList.remove('hidden');
    document.querySelector('#modalEyebrow').textContent = 'SECURE ACCESS';
    document.querySelector('#modalTitle').textContent = 'Owner sign in';
    document.querySelector('#modalCopy').textContent = 'Only the owner can access inventory, sales, expenses, and settings. Production login requires a secure backend.';
    form().innerHTML = '<label>Owner password<input name="ownerPassword" type="password" required autofocus placeholder="Enter owner password"></label><button class="button button-dark form-submit">Unlock owner desk</button>';
  };
  window.unlockOwner = openAccess;
  const openPasswordChange = () => {
    document.querySelector('#modalBackdrop').classList.remove('hidden');
    document.querySelector('#modalEyebrow').textContent = 'OWNER SECURITY';
    document.querySelector('#modalTitle').textContent = 'Change owner password';
    document.querySelector('#modalCopy').textContent = 'Prototype only: production password changes must be handled by a secure backend.';
    form().innerHTML = '<div class="form-grid"><label>Current password<input name="currentPassword" type="password" required></label><label>New password<input name="newPassword" type="password" minlength="8" required placeholder="At least 8 characters"></label><label>Confirm new password<input name="confirmPassword" type="password" minlength="8" required></label></div><button class="button button-dark form-submit">Save new password</button>';
  };
  document.addEventListener('click', (event) => {
    const ownerButton = event.target.closest('.owner-toggle');
    if (ownerButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!isOwnerPage()) {
        window.location.href = 'owner.html';
        return;
      }
      if (window.state?.ownerUnlocked) return window.showOwner();
      openAccess();
      return;
    }
    const changeButton = event.target.closest('#changeOwnerPasswordButton');
    if (changeButton && window.state?.ownerUnlocked) openPasswordChange();
  }, true);
  document.addEventListener('submit', async (event) => {
    if (event.target.id !== 'modalForm') return;
    const data = Object.fromEntries(new FormData(event.target));
    if (data.ownerPassword !== undefined) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isHostedApp()) {
        if (await loginWithBackend(data.ownerPassword)) {
          localStorage.setItem(sessionKey, 'true');
          if (window.state) window.state.ownerUnlocked = true;
          resetSessionTimer();
          document.querySelector('#modalBackdrop').classList.add('hidden');
          const ownerView = document.querySelector('#ownerView');
          if (ownerView) {
            ownerView.style.display = '';
            ownerView.classList.add('active');
          }
          window.showOwner?.();
          window.dispatchEvent(new Event('secure-owner-login'));
        } else window.showToast('Invalid owner credentials or unavailable server');
        return;
      }
      if (data.ownerPassword === getPassword()) {
        localStorage.setItem(sessionKey, 'true');
        if (window.state) window.state.ownerUnlocked = true;
        resetSessionTimer();
        document.querySelector('#modalBackdrop').classList.add('hidden');
        const ownerView = document.querySelector('#ownerView');
        if (ownerView) {
          ownerView.style.display = '';
          ownerView.classList.add('active');
        }
        window.showOwner?.();
        window.dispatchEvent(new Event('secure-owner-login'));
      } else window.showToast('Incorrect owner password');
      return;
    }
    if (data.currentPassword !== undefined) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (data.currentPassword !== getPassword()) return window.showToast('Current password is incorrect');
      if (data.newPassword.length < 8) return window.showToast('New password must be at least 8 characters');
      if (data.newPassword !== data.confirmPassword) return window.showToast('New passwords do not match');
      localStorage.setItem('musaMobilesOwnerPassword', data.newPassword);
      document.querySelector('#modalBackdrop').classList.add('hidden');
      window.showToast('Owner password changed successfully');
    }
  }, true);
  document.addEventListener('click', () => {
    if (window.state?.ownerUnlocked) resetSessionTimer();
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    ensureOwnerGate();
    restoreBackendSession();
    const nav = document.querySelector('.owner-nav');
    if (nav && !document.querySelector('#changeOwnerPasswordButton')) nav.insertAdjacentHTML('beforeend', '<button class="nav-item" id="changeOwnerPasswordButton"><span>⚿</span> Change password</button>');
  });
})();
