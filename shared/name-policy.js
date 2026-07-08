(function () {
  var REPORT_PATH = '/surveys';

  var BLOCKED_CATEGORIES = [
    {
      id: 'sexual',
      reason: 'sexually abusive keywords used',
      terms: [
        'porn',
        'porno',
        'pornography',
        'xxx',
        'x-rated',
        'nude',
        'nudes',
        'nudity',
        'hentai',
        'onlyfans',
        'blowjob',
        'handjob',
        'masturbat',
        'orgasm',
        'ejacul',
        'penis',
        'vagina',
        'vulva',
        'testicle',
        'boob',
        'boobs',
        'titties',
        'nipple',
        'anal',
        'fetish',
        'bdsm',
        'orgy',
        'gangbang',
        'deepthroat',
        'creampie',
        'dildo',
        'vibrator',
        'horny',
        'slut',
        'whore',
        'prostitut',
        'escort',
        'rape',
        'rapist',
        'molest',
        'pedoph',
        'pedo',
        'childporn',
        'underage',
        'lolita',
        'cumshot',
        'cumming',
        'bukkake',
        'milf',
        'dilf',
        'nsfw',
        'sext',
        'sexting',
        'stripper',
        'playboy',
        'playgirl',
        'camgirl',
        'camboy',
        'hooker',
        'brothel',
      ],
    },
    {
      id: 'racist',
      reason: 'racist keywords used',
      terms: [
        'nigger',
        'nigga',
        'nigg3r',
        'chink',
        'gook',
        'kike',
        'spic',
        'wetback',
        'towelhead',
        'raghead',
        'beaner',
        'coon',
        'porchmonkey',
        'jigaboo',
        'zipperhead',
        'slope',
        'gypsy',
        'heilhitler',
        'whitepower',
        'siegheil',
        'hitler',
        'nazi',
        'neonazi',
        'kkk',
        '1488',
        '14words',
        'holohoax',
        'gaschamber',
        'lynchnegro',
      ],
    },
    {
      id: 'harassment',
      reason: 'harassing or hateful keywords used',
      terms: [
        'faggot',
        'fagot',
        'f4ggot',
        'dyke',
        'tranny',
        'retard',
        'retarded',
        'r3tard',
        'kill yourself',
        'killyourself',
        'kys',
        'die in a',
        'rape you',
        'kill you',
        'cunt',
        'twat',
        'bastard',
      ],
    },
  ];

  var WHOLE_WORD_ONLY = {
    ass: 1,
    sex: 1,
    cum: 1,
    tit: 1,
    titty: 1,
    cock: 1,
    dick: 1,
    piss: 1,
    hell: 1,
    damn: 1,
    kys: 1,
    kkk: 1,
    nazi: 1,
    pedo: 1,
    spic: 1,
    coon: 1,
    dyke: 1,
    fag: 1,
    tit: 1,
  };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeForMatch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[@]/g, 'a')
      .replace(/[$]/g, 's')
      .replace(/[!1|]/g, 'i')
      .replace(/[0]/g, 'o')
      .replace(/[3]/g, 'e')
      .replace(/[4]/g, 'a')
      .replace(/[5]/g, 's')
      .replace(/[7]/g, 't')
      .replace(/[^a-z0-9\s]+/g, ' ');
  }

  function tokensFrom(value) {
    var normalized = normalizeForMatch(value);
    var collapsed = normalized.replace(/[^a-z0-9]/g, '');
    var parts = normalized.split(/\s+/).filter(Boolean);
    if (collapsed) parts.push(collapsed);
    return parts;
  }

  function termMatches(value, term) {
    var termNorm = normalizeForMatch(term).replace(/[^a-z0-9]/g, '');
    if (!termNorm) return false;

    var normalized = normalizeForMatch(value);
    var collapsed = normalized.replace(/[^a-z0-9]/g, '');
    var tokens = tokensFrom(value);

    if (termNorm.indexOf(' ') !== -1) {
      var phrase = termNorm.replace(/\s+/g, ' ');
      var phraseCollapsed = phrase.replace(/\s+/g, '');
      return normalized.indexOf(phrase) !== -1 || collapsed.indexOf(phraseCollapsed) !== -1;
    }

    if (WHOLE_WORD_ONLY[termNorm] || termNorm.length <= 3) {
      return tokens.some(function (t) {
        return t === termNorm;
      });
    }

    return (
      tokens.some(function (t) {
        return t === termNorm || t.indexOf(termNorm) !== -1;
      }) || collapsed.indexOf(termNorm) !== -1
    );
  }

  function findNamePolicyViolation(value) {
    var text = String(value || '').trim();
    if (!text) return null;

    for (var c = 0; c < BLOCKED_CATEGORIES.length; c++) {
      var category = BLOCKED_CATEGORIES[c];
      for (var t = 0; t < category.terms.length; t++) {
        if (termMatches(text, category.terms[t])) {
          return { reason: category.reason, category: category.id };
        }
      }
    }
    return null;
  }

  function checkAccountNameFields(fields) {
    fields = fields || {};
    var entries = [
      ['username', fields.username],
      ['first name', fields.firstName],
      ['last name', fields.lastName],
      ['bio', fields.bio],
      ['sport', fields.sport],
      ['position', fields.position],
      ['notes', fields.notes],
    ];

    for (var i = 0; i < entries.length; i++) {
      var hit = findNamePolicyViolation(entries[i][1]);
      if (hit) return { reason: hit.reason, field: entries[i][0] };
    }
    return null;
  }

  function formatNamePolicyErrorPlain(reason) {
    return (
      "We're so sorry, but this name may violate our account naming policy. " +
      'If you think we made a mistake, please report this as an issue here: ' +
      REPORT_PATH +
      '. REASON: ' +
      reason
    );
  }

  function formatNamePolicyErrorHtml(reason) {
    return (
      "We're so sorry, but this name may violate our account naming policy. " +
      'If you think we made a mistake, please report this as an issue ' +
      '<a href="' +
      REPORT_PATH +
      '" class="name-policy-report-link">here</a>. ' +
      '<strong>REASON: ' +
      escapeHtml(reason) +
      '</strong>'
    );
  }

  function showPolicyError(el, violation) {
    if (!el || !violation) return;
    el.hidden = false;
    el.innerHTML = formatNamePolicyErrorHtml(violation.reason);
  }

  function responseToViolation(body) {
    if (!body || body.code !== 'NAME_POLICY_VIOLATION') return null;
    return { reason: body.reason || 'policy violation', field: body.field || null };
  }

  window.NamePolicy = {
    findNamePolicyViolation: findNamePolicyViolation,
    checkAccountNameFields: checkAccountNameFields,
    formatNamePolicyErrorPlain: formatNamePolicyErrorPlain,
    formatNamePolicyErrorHtml: formatNamePolicyErrorHtml,
    showPolicyError: showPolicyError,
    responseToViolation: responseToViolation,
  };
})();
