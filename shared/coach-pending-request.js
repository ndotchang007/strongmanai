(function () {
  var PENDING_PREFIX = 'strongman-coach-pending-u';
  var THREAD_PREFIX = 'strongman-coach-thread-u';
  var REPLY_READY_PREFIX = 'strongman-coach-reply-ready-u';
  var LEGACY_THREAD_KEY = 'strongman-coach-thread';
  var MAX_PENDING_AGE_MS = 15 * 60 * 1000;
  var FETCH_TIMEOUT_MS = 120000;
  var inFlight = false;

  function userId() {
    var u = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    return u && u.id != null ? String(u.id) : 'anon';
  }

  function pendingKey() {
    return PENDING_PREFIX + userId();
  }

  function threadKey() {
    return THREAD_PREFIX + userId();
  }

  function replyReadyKey() {
    return REPLY_READY_PREFIX + userId();
  }

  function loadThread() {
    try {
      var raw = localStorage.getItem(threadKey());
      if (!raw) {
        raw = localStorage.getItem(LEGACY_THREAD_KEY);
      }
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveThread(messages) {
    try {
      localStorage.setItem(threadKey(), JSON.stringify((messages || []).slice(-40)));
    } catch (e) {}
  }

  function getPending() {
    try {
      var raw = localStorage.getItem(pendingKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setPending(payload) {
    try {
      localStorage.setItem(
        pendingKey(),
        JSON.stringify(
          Object.assign({}, payload, {
            startedAt: payload.startedAt || Date.now(),
            userId: userId(),
          })
        )
      );
    } catch (e) {}
  }

  function clearPending() {
    try {
      localStorage.removeItem(pendingKey());
    } catch (e) {}
  }

  function setReplyReady(value) {
    try {
      if (value) {
        localStorage.setItem(replyReadyKey(), String(Date.now()));
      } else {
        localStorage.removeItem(replyReadyKey());
      }
    } catch (e) {}
  }

  function isReplyReady() {
    try {
      return !!localStorage.getItem(replyReadyKey());
    } catch (e) {
      return false;
    }
  }

  function clearReplyReady() {
    setReplyReady(false);
  }

  function needsReply(messages, pending) {
    if (!pending || !pending.message) return false;
    if (!messages.length) return false;
    var last = messages[messages.length - 1];
    if (last.role !== 'user') return false;
    if (pending.userContent != null) return last.content === pending.userContent;
    return last.content === pending.message;
  }

  function buildAssistantMsg(body) {
    var assistantMsg = {
      role: 'assistant',
      content: body.text || '',
      text: body.text || '',
      responseType: body.type,
      advice: body.advice,
      workout: body.workout,
    };
    if (body.type === 'advice' && body.advice && !assistantMsg.content) {
      assistantMsg.content = body.advice.summary || body.text || '';
    }
    if (body.type === 'workout' && body.workout) {
      if (!body.workout.fyi && body.text) {
        assistantMsg.workout = Object.assign({}, body.workout, { fyi: body.text });
      }
    }
    return assistantMsg;
  }

  function isRetriableError(err) {
    if (!err) return true;
    if (err.name === 'AbortError') return true;
    var msg = String(err.message || err).toLowerCase();
    return (
      msg.indexOf('failed to fetch') !== -1 ||
      msg.indexOf('network') !== -1 ||
      msg.indexOf('timeout') !== -1 ||
      msg.indexOf('load failed') !== -1
    );
  }

  function postCoachChat(body, signal) {
    var base = window.API_BASE || '';
    var headers = { 'Content-Type': 'application/json' };
    try {
      var u = window.getCurrentUser && window.getCurrentUser();
      if (u && u.token) headers.Authorization = 'Bearer ' + u.token;
    } catch (e) {}
    return fetch(base + '/coach/chat', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(body),
      signal: signal,
    });
  }

  function runPendingRequest(handlers) {
    handlers = handlers || {};
    var pending = getPending();
    if (!pending || inFlight) return Promise.resolve(null);

    if (Date.now() - (pending.startedAt || 0) > MAX_PENDING_AGE_MS) {
      clearPending();
      if (handlers.onError) {
        handlers.onError('Rocky took too long — try sending your message again.', false);
      }
      return Promise.resolve(null);
    }

    var messages = loadThread();
    if (!needsReply(messages, pending)) {
      clearPending();
      return Promise.resolve(null);
    }

    inFlight = true;
    if (handlers.onStart) handlers.onStart();

    var timedOut = false;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = window.setTimeout(function () {
      timedOut = true;
      if (controller) controller.abort();
    }, FETCH_TIMEOUT_MS);

    return postCoachChat(
      {
        message: pending.message,
        contextBlock: pending.contextBlock || '',
        thread: pending.thread || [],
        images: pending.images || [],
        forceIntent: pending.forceIntent || undefined,
      },
      controller ? controller.signal : undefined
    )
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (x) {
        if (!x.res.ok) {
          throw new Error((x.body && x.body.error) || 'Request failed.');
        }
        var assistantMsg = buildAssistantMsg(x.body);
        messages.push(assistantMsg);
        saveThread(messages);
        clearPending();
        setReplyReady(true);
        if (handlers.onSuccess) {
          handlers.onSuccess(assistantMsg, x.body.quota, messages);
        }
        return assistantMsg;
      })
      .catch(function (err) {
        if (timedOut) {
          if (handlers.onError) {
            handlers.onError(
              'Rocky is still thinking — we will keep trying. You can leave this page and come back.',
              true
            );
          }
          return null;
        }
        if (err && err.name === 'AbortError') {
          if (handlers.onAbort) handlers.onAbort();
          return null;
        }
        if (isRetriableError(err)) {
          if (handlers.onError) {
            handlers.onError(
              'Connection interrupted — Rocky will finish when you reopen Coach or the dashboard.',
              true
            );
          }
          return null;
        }
        clearPending();
        if (handlers.onError) {
          handlers.onError(err && err.message ? err.message : 'Request failed.', false);
        }
        return null;
      })
      .finally(function () {
        window.clearTimeout(timeoutId);
        inFlight = false;
        if (handlers.onEnd) handlers.onEnd();
      });
  }

  function startRequest(payload, handlers) {
    setPending({
      message: payload.message,
      userContent: payload.userContent != null ? payload.userContent : payload.message,
      thread: payload.thread || [],
      contextBlock: payload.contextBlock || '',
      images: Array.isArray(payload.images) ? payload.images.slice(0, 3) : [],
      forceIntent: payload.forceIntent || null,
      startedAt: Date.now(),
    });
    return runPendingRequest(handlers);
  }

  function resume(handlers) {
    return runPendingRequest(handlers || {});
  }

  function hasPendingReply() {
    var pending = getPending();
    if (!pending) return false;
    return needsReply(loadThread(), pending);
  }

  window.CoachPending = {
    loadThread: loadThread,
    saveThread: saveThread,
    getPending: getPending,
    clearPending: clearPending,
    hasPendingReply: hasPendingReply,
    isReplyReady: isReplyReady,
    clearReplyReady: clearReplyReady,
    startRequest: startRequest,
    resume: resume,
    buildAssistantMsg: buildAssistantMsg,
  };

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && hasPendingReply()) {
      resume({});
    }
  });
})();
