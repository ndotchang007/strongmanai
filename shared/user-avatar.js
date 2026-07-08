(function () {
  'use strict';

  function initialsFromUser(user) {
    if (!user) return '?';
    var first = user.firstName && String(user.firstName).trim();
    var last = user.lastName && String(user.lastName).trim();
    if (first && last) return (first.charAt(0) + last.charAt(0)).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    var display = user.displayName && String(user.displayName).trim();
    if (display) {
      var parts = display.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return display.slice(0, 2).toUpperCase();
    }
    var un = user.username && String(user.username).trim();
    if (un) return un.slice(0, 2).toUpperCase();
    return '?';
  }

  function applyToEl(el, user) {
    if (!el) return;
    var url = user && user.avatarUrl && String(user.avatarUrl).trim();
    el.classList.add('user-avatar-initials');
    el.textContent = initialsFromUser(user);
    el.removeAttribute('style');
    if (url) {
      el.classList.add('user-avatar-initials--photo');
      el.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
      el.dataset.avatarUrl = url;
    } else {
      el.classList.remove('user-avatar-initials--photo');
      delete el.dataset.avatarUrl;
    }
  }

  function syncAll() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    document.querySelectorAll('.sidebar-profile-avatar').forEach(function (el) {
      applyToEl(el, user);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAll);
  } else {
    syncAll();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'strongman_user_v1' || e.key === 'strongman_current_user') syncAll();
  });

  window.UserAvatar = {
    initialsFromUser: initialsFromUser,
    applyToEl: applyToEl,
    syncAll: syncAll
  };
})();
