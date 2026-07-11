(function () {
  var SEEN_KEY = 'strongman-learn-seen';

  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch (e) {}

  window.strongmanLearn = {
    hasSeen: function () {
      try {
        return localStorage.getItem(SEEN_KEY) === '1';
      } catch (e2) {
        return false;
      }
    },
  };
})();
