/**
 * Instagram handle connection — saved locally and on the user profile for story stickers.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'strongmanai_instagram_username';
  var IG_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

  function normalizeHandle(raw) {
    if (raw == null) return '';
    return String(raw).trim().replace(/^@+/, '').toLowerCase();
  }

  function isValidHandle(handle) {
    return !!handle && IG_HANDLE_RE.test(handle);
  }

  function readLocal() {
    try {
      return normalizeHandle(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return '';
    }
  }

  function writeLocal(handle) {
    try {
      if (handle) localStorage.setItem(STORAGE_KEY, handle);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function readFromUser(user) {
    if (!user) return '';
    var ctx =
      user.athleteContext && typeof user.athleteContext === 'object'
        ? user.athleteContext
        : {};
    return normalizeHandle(ctx.instagramUsername);
  }

  function getConnectedHandle() {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var fromUser = readFromUser(user);
    if (fromUser) return fromUser;
    return readLocal();
  }

  function profileUrl(handle) {
    handle = normalizeHandle(handle);
    if (!handle) return '';
    return 'https://www.instagram.com/' + encodeURIComponent(handle) + '/';
  }

  function persistToProfile(handle) {
    return new Promise(function (resolve) {
      var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      if (!user || user.id == null || !window.apiPut) {
        resolve({ ok: true, localOnly: true });
        return;
      }
      var ctx =
        user.athleteContext && typeof user.athleteContext === 'object'
          ? Object.assign({}, user.athleteContext)
          : {};
      ctx.instagramUsername = handle || null;
      window
        .apiPut('/users/' + user.id, { athleteContext: ctx })
        .then(function (res) {
          return res.json().then(function (body) {
            if (res.ok && body && typeof window.setCurrentUser === 'function') {
              window.setCurrentUser(body);
            }
            resolve({ ok: res.ok, body: body });
          });
        })
        .catch(function () {
          resolve({ ok: false });
        });
    });
  }

  function connect(rawHandle) {
    var handle = normalizeHandle(rawHandle);
    if (!isValidHandle(handle)) {
      return Promise.resolve({ ok: false, error: 'Enter a valid Instagram username (letters, numbers, . _).' });
    }
    writeLocal(handle);
    return persistToProfile(handle).then(function (result) {
      if (!result.ok && !result.localOnly) {
        return { ok: false, error: 'Could not save to your profile. Try again.' };
      }
      try {
        window.dispatchEvent(
          new CustomEvent('strongman:instagram-updated', { detail: { handle: handle } })
        );
      } catch (e) {}
      return { ok: true, handle: handle };
    });
  }

  function disconnect() {
    writeLocal('');
    return persistToProfile(null).then(function () {
      try {
        window.dispatchEvent(new CustomEvent('strongman:instagram-updated', { detail: { handle: '' } }));
      } catch (e) {}
      return { ok: true };
    });
  }

  function mount(container, opts) {
    opts = opts || {};
    if (!container) return;
    container.innerHTML = '';
    container.className = (opts.className || 'ig-connect') + ' ig-connect-mount';

    var handle = getConnectedHandle();
    var connected = isValidHandle(handle);

    if (connected) {
      var row = document.createElement('div');
      row.className = 'ig-connect-connected';

      var mark = document.createElement('span');
      mark.className = 'ig-connect-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = 'IG';

      var copy = document.createElement('div');
      copy.className = 'ig-connect-copy';

      var title = document.createElement('p');
      title.className = 'ig-connect-title';
      title.textContent = 'Connected as @' + handle;

      var text = document.createElement('p');
      text.className = 'ig-connect-text';
      text.textContent =
          'Story stickers will include your handle. On your phone, tap Share to Instagram to save the sticker and open the app.';

      var link = document.createElement('a');
      link.className = 'ig-connect-profile-link';
      link.href = profileUrl(handle);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open Instagram profile →';

      copy.appendChild(title);
      copy.appendChild(text);
      copy.appendChild(link);

      var disconnectBtn = document.createElement('button');
      disconnectBtn.type = 'button';
      disconnectBtn.className = 'ig-connect-disconnect';
      disconnectBtn.textContent = 'Disconnect';
      disconnectBtn.addEventListener('click', function () {
        disconnect().then(function () {
          mount(container, opts);
        });
      });

      row.appendChild(mark);
      row.appendChild(copy);
      row.appendChild(disconnectBtn);
      container.appendChild(row);
      return;
    }

    var form = document.createElement('div');
    form.className = 'ig-connect-form';

    var label = document.createElement('label');
    label.className = 'ig-connect-label';
    label.setAttribute('for', container.id ? container.id + '-input' : 'ig-connect-input');
    label.textContent = 'Connect Instagram';

    var hint = document.createElement('p');
    hint.className = 'ig-connect-hint';
    hint.textContent =
      'Link your @username so story stickers are ready for Instagram. We only store your handle — no password or posting access.';

    var fieldRow = document.createElement('div');
    fieldRow.className = 'ig-connect-field-row';

    var at = document.createElement('span');
    at.className = 'ig-connect-at';
    at.textContent = '@';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ig-connect-input';
    input.id = container.id ? container.id + '-input' : 'ig-connect-input';
    input.placeholder = 'yourusername';
    input.autocomplete = 'off';
    input.inputMode = 'text';
    input.maxLength = 30;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ig-connect-btn';
    btn.textContent = 'Connect';

    var err = document.createElement('p');
    err.className = 'ig-connect-error';
    err.hidden = true;
    err.setAttribute('role', 'alert');

    function submit() {
      err.hidden = true;
      btn.disabled = true;
      connect(input.value)
        .then(function (result) {
          btn.disabled = false;
          if (!result.ok) {
            err.textContent = result.error || 'Could not connect.';
            err.hidden = false;
            return;
          }
          mount(container, opts);
        })
        .catch(function () {
          btn.disabled = false;
          err.textContent = 'Something went wrong. Try again.';
          err.hidden = false;
        });
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });

    fieldRow.appendChild(at);
    fieldRow.appendChild(input);
    fieldRow.appendChild(btn);
    form.appendChild(label);
    form.appendChild(hint);
    form.appendChild(fieldRow);
    form.appendChild(err);
    container.appendChild(form);
  }

  window.addEventListener('strongman:user-updated', function () {
    var user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    var fromUser = readFromUser(user);
    if (fromUser) writeLocal(fromUser);
  });

  window.InstagramConnect = {
    normalizeHandle: normalizeHandle,
    isValidHandle: isValidHandle,
    getConnectedHandle: getConnectedHandle,
    profileUrl: profileUrl,
    connect: connect,
    disconnect: disconnect,
    mount: mount,
  };
})();
