/* Éditeur visuel de scénarios (espace enseignant).
   Usage : ScEditor.open(conteneur, {id,title,session_code,is_active,content}, onSave(rec), onCancel()) */
(function () {
  'use strict';

  var MI = [
    ['Fond', [['coast', 'Continents'], ['grat', 'Quadrillage'], ['plates', 'Plaques (contours)']]],
    ['Live', [['live', 'Section Live']]],
    ['Séismes archivés', [['quakes', 'Couche séismes'], ['qy', "Intervalle d'années"], ['amag', "Magnitude de l'archive"], ['minmag', 'Magnitude minimale affichée'], ['qtypes', 'Types : compression / extension / cisaillement'], ['colormode', 'Couleur des points']]],
    ['Volcans', [['volc', 'Couche volcans'], ['vy', "Intervalle d'éruptions"], ['vcats', 'Contextes de volcans'], ['vdiff', 'Switch « Différencier les volcans »'], ['vmodes', 'Explosif / effusif (collège)']]],
    ['Frontières de plaques', [['bound', 'Afficher les frontières'], ['btypes', 'Types : subduction / collision / accrétion / coulissant']]],
    ['GPS · déplacements', [['gps', 'Stations GPS'], ['gpsv', 'Flèches de déplacement (cm/an)']]],
    ['Marqueurs', [['markers', "Marqueurs de l'enseignant"]]],
    ['Carte', [['proj', 'Plane / Globe'], ['zoom', 'Zoom + / −'], ['timeline', 'Frise temporelle'], ['legend', 'Légende']]]
  ];
  var LAYERS = [['coast', 'Continents'], ['grat', 'Quadrillage'], ['plates', 'Plaques (contours)'], ['bound', 'Frontières'], ['quakes', 'Séismes'], ['volc', 'Volcans'], ['gps', 'Stations GPS'], ['gpsv', 'Flèches GPS (cm/an)'], ['markers', 'Marqueurs']];
  var TYPE_LABEL = { qcm: 'Au choix', cloze: 'À compléter', text: 'Rédigée' };
  var TABS = [['content', 'Contenu'], ['answer', 'Réponse'], ['menu', 'Menu'], ['data', 'Données'], ['view', 'Affichage'], ['btns', 'Boutons'], ['pass', 'Passage']];

  var ctx = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 8); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newStep() {
    return normStep({ id: uid('q'), title: 'Nouvelle question', type: 'qcm' });
  }
  /** Complète les champs manquants d'une question (scénarios importés ou anciens). */
  function normStep(s) {
    s.id = s.id || uid('q');
    s.title = s.title == null ? '' : s.title;
    ['intro', 'proposal', 'question', 'ctext', 'rubric', 'why'].forEach(function (k) { if (s[k] == null) s[k] = ''; });
    s.type = s.type || 'qcm';
    ['opts', 'fb', 'hints'].forEach(function (k) {
      if (!Array.isArray(s[k])) s[k] = ['', '', ''];
      while (s[k].length < 3) s[k].push('');
    });
    if (typeof s.ok !== 'number') s.ok = 0;
    ['bank', 'ans', 'crit'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    if (s.ai == null) s.ai = false;
    if (s.minlen == null) s.minlen = 15;
    if (s.diag == null) s.diag = false;
    if (s.points == null || isNaN(+s.points)) s.points = s.diag ? 0 : 1;
    if (!Array.isArray(s.buttons)) s.buttons = [];
    if (!s.menu || typeof s.menu !== 'object') s.menu = {};
    if (!s.cons || typeof s.cons !== 'object') s.cons = { qy: null, vy: null, amag: null, minmag: null };
    if (s.view === undefined) s.view = null;
    if (!s.pass || typeof s.pass !== 'object') s.pass = { answer: 'correct', score: 0, tries: 0, layers: [] };
    if (!Array.isArray(s.pass.layers)) s.pass.layers = [];
    return s;
  }
  function defaultView() {
    return { mode: 'flat', rot: null, k: 1, layers: { coast: true, plates: true, bound: true, quakes: true, volc: true, markers: true, grat: false }, y: null, amag: null, vy: null, colorMode: 'depth', live: { on: false, span: 3 } };
  }

  function cur() { return ctx.sc.steps[ctx.si] || null; }

  /* ---------- rendu ---------- */
  function render() {
    var sc = ctx.sc, st = cur();
    var h = '<div class="ed-head"><h2 style="font-size:1.1rem;margin:0">Éditeur de scénario</h2><span>' +
      '<button class="ghost" data-act="cancel">← Retour</button><button class="ghost" data-act="preview" title="Tester comme un élève, à partir de la question sélectionnée">Aperçu élève</button><button data-act="save">Enregistrer</button></span></div>';
    h += '<div class="ed-block">' +
      '<label>Titre du scénario<input type="text" data-b="sc.title" value="' + esc(sc.title) + '"></label>' +
      '<label>Texte d\'introduction<textarea class="short" data-b="sc.intro">' + esc(sc.intro || '') + '</textarea></label>' +
      '<label>Niveau d\'affichage<select data-b="sc.level"><option value=""' + (!sc.level ? ' selected' : '') + '>Au choix de l\'élève (barre du haut)</option><option value="col"' + (sc.level === 'col' ? ' selected' : '') + '>Imposer « Collège »</option><option value="adv"' + (sc.level === 'adv' ? ' selected' : '') + '>Imposer « Avancé »</option></select></label>' +
      '<label>Code de séance (vide = scénario proposé directement)<input type="text" maxlength="20" data-b="ctx.code" value="' + esc(ctx.code || '') + '" placeholder="ex. SISMO24"></label>' +
      '<label class="ck"><input type="checkbox" data-b="ctx.active"' + (ctx.active ? ' checked' : '') + '> Visible pour les élèves</label></div>';

    h += '<div class="ed-cols"><div><div class="ed-row"><b>Questions</b><button data-act="st-add">+ Ajouter</button></div><div class="msg-n">Total : ' + fmt(sc.steps.reduce(function (a, q) { return a + (+q.points || 0); }, 0)) + ' point(s)</div><div class="ed-steps">';
    sc.steps.forEach(function (s, i) {
      h += '<div class="it' + (i === ctx.si ? ' on' : '') + '" data-act="st-sel" data-i="' + i + '"><div class="tt">' + esc(s.title || '(sans titre)') +
        '<small>' + (i + 1) + ' · ' + esc(TYPE_LABEL[s.type] || s.type) + (s.ai ? ' · IA' : '') + ' · ' + fmt(+s.points || 0) + ' pt</small></div>' +
        '<div class="mv"><button data-act="st-up" data-i="' + i + '" title="Monter" aria-label="Monter">↑</button>' +
        '<button data-act="st-down" data-i="' + i + '" title="Descendre" aria-label="Descendre">↓</button>' +
        '<button data-act="st-dup" data-i="' + i + '" title="Dupliquer" aria-label="Dupliquer">⧉</button>' +
        '<button data-act="st-del" data-i="' + i + '" title="Supprimer" aria-label="Supprimer">✕</button></div></div>';
    });
    h += '</div></div><div>';
    if (!st) {
      h += '<div class="ed-block msg-n">Ajoute une première question.</div>';
    } else {
      h += '<div class="subtabs">' + TABS.map(function (t) {
        return '<button data-sub="' + t[0] + '"' + (ctx.sub === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>';
      }).join('') + '</div><div class="ed-block" style="margin-top:10px">' +
        ({ content: tContent, answer: tAnswer, btns: tBtns, menu: tMenu, data: tData, view: tView, pass: tPass })[ctx.sub](st) + '</div>';
    }
    h += '</div></div><div class="msg" id="ed-msg"></div>';
    ctx.root.innerHTML = h;
  }

  function tContent(st) {
    var h = '<label>Titre de la question<input type="text" data-b="st.title" value="' + esc(st.title) + '"></label>';
    h += '<label>Texte d\'introduction<textarea data-b="st.intro" placeholder="Contexte donné à l\'élève">' + esc(st.intro) + '</textarea></label>';
    h += '<label>Proposition (ce que l\'élève doit faire)<textarea data-b="st.proposal" placeholder="Ex. Active la couche Séismes et observe.">' + esc(st.proposal) + '</textarea></label>';
    h += '<label>Question<textarea data-b="st.question">' + esc(st.question) + '</textarea></label>';
    h += '<label>Type de réponse<select data-b="st.type" data-re="1">' + [['qcm', 'Au choix parmi 3'], ['cloze', 'Compléter des phrases'], ['text', 'Rédiger des phrases']].map(function (o) {
      return '<option value="' + o[0] + '"' + (st.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></label>';
    h += '<div class="lbl">Indices (jusqu\'à 3, du plus discret au plus direct)</div>' + [0, 1, 2].map(function (i) {
      return '<input type="text" data-b="st.hints.' + i + '" value="' + esc(st.hints[i] || '') + '" placeholder="Indice ' + (i + 1) + '">';
    }).join('');
    h += '<label>Message affiché quand c\'est réussi<input type="text" data-b="st.why" value="' + esc(st.why || '') + '"></label>';
    return h;
  }

  function viewSummary(b) {
    var v = b.view;
    if (!v) return 'Pas encore de situation enregistrée.';
    var on = LAYERS.filter(function (l) { return (v.layers || {})[l[0]]; }).map(function (l) { return l[1].toLowerCase(); });
    return 'Projection ' + (v.mode === 'globe' ? 'globe' : 'plane') + ' · zoom ' + (v.k == null ? 1 : v.k) + (v.y ? ' · séismes ' + v.y[0] + (v.y[1] !== v.y[0] ? '–' + v.y[1] : '') : '') + ' · couches : ' + (on.join(', ') || 'aucune') +
      (b.target ? ' · fiche ouverte : ' + b.target.label : '');
  }
  function tBtns(st) {
    var h = '<div class="msg-n">Chaque bouton s\'affiche sous la question. Au clic, la carte prend la position, le zoom et les réglages enregistrés (et ouvre la fiche d\'un volcan ou d\'un séisme si tu l\'as sélectionné avant d\'enregistrer). Un bouton « ↺ Carte de départ » est ajouté automatiquement. Tu peux aussi créer des boutons depuis l\'app, connecté en enseignant.</div>';
    (st.buttons || []).forEach(function (b, i) {
      h += '<div class="crit"><label>Texte du bouton<input type="text" data-b="st.buttons.' + i + '.label" value="' + esc(b.label || '') + '"></label>' +
        '<label class="ck"><input type="checkbox" data-b="st.buttons.' + i + '.lock"' + (b.lock ? ' checked' : '') + '> Verrouiller les menus après le clic</label>' +
        '<div class="msg-n">' + esc(viewSummary(b)) + '</div>' +
        '<div class="adm-h"><button class="pri" data-act="sit-cap" data-i="' + i + '">' + (b.view ? 'Refaire la capture' : 'Capturer la situation') + '</button>' +
        (ctx.api && b.view ? '<button data-act="sit-tolib" data-i="' + i + '">Mettre en bibliothèque</button>' : '') +
        '<button data-act="sit-del" data-i="' + i + '">Supprimer</button></div></div>';
    });
    h += '<button data-act="sit-add">＋ Ajouter un bouton</button>';
    if (ctx.api) {
      h += '<div class="lbl" style="margin-top:12px">Bibliothèque de situations (réutilisables dans tes scénarios)</div>';
      if (ctx.lib == null) h += '<div class="msg-n">Chargement…</div>';
      else if (!ctx.lib.length) h += '<div class="msg-n">Vide. Utilise « Mettre en bibliothèque » sur un bouton.</div>';
      else {
        h += '<select data-c="lib-sel">' + ctx.lib.map(function (l) { return '<option value="' + esc(l.id) + '"' + (ctx.libSel === l.id ? ' selected' : '') + '>' + esc(l.label) + '</option>'; }).join('') + '</select>' +
          '<div class="adm-h"><button class="pri" data-act="lib-use">Ajouter ce bouton à la question</button><button data-act="lib-del">Retirer de la bibliothèque</button></div>';
      }
    }
    return h;
  }
  function loadLib() {
    if (!ctx.api || ctx.lib != null || ctx.libLoading) return;
    ctx.libLoading = true;
    ctx.api('api/situations.php').then(function (j) { ctx.lib = j.situations || []; ctx.libSel = ctx.lib[0] && ctx.lib[0].id; })
      .catch(function (err) { ctx.lib = []; say('Bibliothèque : ' + err.message); })
      .then(function () { ctx.libLoading = false; render(); });
  }

  function tAnswer(st) {
    var h = '<label>Points pour cette question<input type="number" min="0" step="0.5" data-b="st.points" data-t="n" value="' + (st.points == null ? 1 : st.points) + '"></label>' +
      '<div class="msg-n">' + (st.type === 'text' ? 'La note /20 de la rédaction est ramenée sur ces points.' : 'Les points sont attribués si la réponse est juste.') + '</div>';
    if (st.type === 'qcm') {
      h += [0, 1, 2].map(function (i) {
        return '<div class="opt3"><input type="radio" name="okopt" data-c="ok" data-i="' + i + '"' + (st.ok === i ? ' checked' : '') + ' aria-label="Bonne réponse ' + (i + 1) + '">' +
          '<div style="flex:1"><label>Proposition ' + (i + 1) + (st.ok === i ? ' · bonne réponse' : '') + '<input type="text" data-b="st.opts.' + i + '" value="' + esc(st.opts[i] || '') + '"></label>' +
          (st.ok === i ? '' : '<input type="text" data-b="st.fb.' + i + '" value="' + esc(st.fb[i] || '') + '" placeholder="Message si l\'élève choisit celle-ci (facultatif)">') + '</div></div>';
      }).join('');
      h += '<label class="ck"><input type="checkbox" data-b="st.diag"' + (st.diag ? ' checked' : '') + '> Question de diagnostic (réponse intuitive, pas de blocage)</label>';
    } else if (st.type === 'cloze') {
      var n = String(st.ctext || '').split('___').length - 1;
      h += '<label>Phrase : écris ___ (3 tirets bas) à chaque trou<textarea data-b="st.ctext" data-c="ctext">' + esc(st.ctext || '') + '</textarea></label>';
      h += '<label>Mots proposés (séparés par des virgules ; vide = l\'élève tape le mot)<input type="text" data-b="st.bank" data-t="csv" value="' + esc((st.bank || []).join(', ')) + '"></label>';
      h += '<div class="lbl">Réponses attendues, dans l\'ordre (' + n + ' trou' + (n > 1 ? 'x' : '') + ') — plusieurs possibles avec |</div>';
      for (var i = 0; i < n; i++) {
        h += '<input type="text" data-b="st.ans.' + i + '" value="' + esc((st.ans || [])[i] || '') + '" placeholder="Trou ' + (i + 1) + '">';
      }
      if (n === 0) h += '<div class="msg">Aucun trou : ajoute ___ dans la phrase.</div>';
    } else {
      h += '<label>Longueur minimale (caractères)<input type="number" min="0" data-b="st.minlen" data-t="n" value="' + (st.minlen == null ? 15 : st.minlen) + '"></label>';
      h += '<label class="ck"><input type="checkbox" data-b="st.ai" data-re="1"' + (st.ai ? ' checked' : '') + '> Correction par l\'IA (note /20)</label>';
      if (st.ai) h += '<label>Consignes de notation pour l\'IA (critères, barème)<textarea data-b="st.rubric" placeholder="Ex. 6 pts : l\'élève décrit des bandes de séismes…">' + esc(st.rubric || '') + '</textarea></label>';
      var tot = (st.crit || []).reduce(function (a, c) { return a + (+c.pts || 0); }, 0);
      h += '<div class="lbl">Critères de correction automatique (total ' + tot + ' pts, ramené sur 20)</div>';
      (st.crit || []).forEach(function (c, i) {
        h += '<div class="crit"><label>Critère ' + (i + 1) + '<input type="text" data-b="st.crit.' + i + '.label" value="' + esc(c.label) + '"></label>' +
          '<label>Mots-clés attendus : un groupe par ligne, synonymes avec |<textarea data-b="st.crit.' + i + '.kw" data-t="lines" placeholder="band|ligne|ceinture">' + esc((c.kw || []).join('\n')) + '</textarea></label>' +
          '<div class="row2"><label>Points<input type="number" min="0" step="0.5" data-b="st.crit.' + i + '.pts" data-t="n" value="' + (c.pts == null ? '' : c.pts) + '"></label>' +
          '<label>Groupes requis<input type="number" min="1" data-b="st.crit.' + i + '.need" data-t="n" value="' + (c.need == null ? 1 : c.need) + '"></label></div>' +
          '<label>Conseil si le critère manque<input type="text" data-b="st.crit.' + i + '.hint" value="' + esc(c.hint || '') + '"></label>' +
          '<button class="danger" data-act="crit-del" data-i="' + i + '">Retirer ce critère</button></div>';
      });
      h += '<button class="ghost" data-act="crit-add">+ Ajouter un critère</button>';
    }
    return h;
  }

  function tMenu(st) {
    var h = '<div class="msg-n">Choisis ce que l\'élève voit dans le menu de la carte pour cette question.</div>' +
      '<div class="ed-row"><button class="ghost" data-act="mi-all" data-v="show">Tout afficher</button><button class="ghost" data-act="mi-all" data-v="grey">Tout griser</button><button class="ghost" data-act="mi-all" data-v="hide">Tout masquer</button></div>' +
      '<table class="mtab"><tr><th>Élément</th><th>Afficher</th><th>Griser</th><th>Masquer</th></tr>';
    MI.forEach(function (g, gi) {
      var gv = g[1].map(function (it) { return st.menu[it[0]] || 'show'; });
      var gcur = gv.every(function (v) { return v === gv[0]; }) ? gv[0] : '';
      h += '<tr><td class="g">' + esc(g[0]) + '</td>' + ['show', 'grey', 'hide'].map(function (v) {
        return '<td class="g"><input type="radio" name="mg-' + gi + '" data-act="mg" data-g="' + gi + '" data-v="' + v + '"' + (gcur === v ? ' checked' : '') + ' aria-label="' + esc(g[0]) + ' (tout le groupe) : ' + v + '"></td>';
      }).join('') + '</tr>';
      g[1].forEach(function (it) {
        var c = st.menu[it[0]] || 'show';
        h += '<tr><td>' + esc(it[1]) + '</td>' + ['show', 'grey', 'hide'].map(function (v) {
          return '<td><input type="radio" name="mi-' + it[0] + '" data-act="mi" data-k="' + it[0] + '" data-v="' + v + '"' + (c === v ? ' checked' : '') + ' aria-label="' + esc(it[1]) + ' : ' + v + '"></td>';
        }).join('') + '</tr>';
      });
    });
    return h + '</table>';
  }

  function tData(st) {
    var c = st.cons;
    var h = '<div class="msg-n">Limite ce que l\'élève peut choisir dans les champs de données.</div>';
    h += '<div class="crit"><b>Séismes</b><label class="ck"><input type="checkbox" data-c="qy-on"' + (c.qy ? ' checked' : '') + '> Limiter les années</label>';
    if (c.qy) h += '<div class="row2"><label>De (min 1960)<input type="number" min="1960" max="2026" data-c="qy0" value="' + c.qy[0] + '"></label><label>à (max 2026)<input type="number" min="1960" max="2026" data-c="qy1" value="' + c.qy[1] + '"></label></div>';
    h += '<div class="row2"><label>Magnitude minimale de l\'archive<select data-c="amag"><option value="">Pas de limite</option>' + [5, 6, 7].map(function (m) {
      return '<option value="' + m + '"' + (c.amag === m ? ' selected' : '') + '>M ≥ ' + m + '</option>';
    }).join('') + '</select></label><label>Magnitude minimale affichée<input type="number" min="0" max="8" step="0.5" data-c="minmag" value="' + (c.minmag == null ? '' : c.minmag) + '" placeholder="aucune"></label></div></div>';
    h += '<div class="crit"><b>Volcans</b><label class="ck"><input type="checkbox" data-c="vy-on"' + (c.vy ? ' checked' : '') + '> Limiter les années d\'éruption</label>';
    if (c.vy) h += '<div class="row2"><label>De (min −10000)<input type="number" min="-10000" max="2026" data-c="vy0" value="' + c.vy[0] + '"></label><label>à (max 2026)<input type="number" min="-10000" max="2026" data-c="vy1" value="' + c.vy[1] + '"></label></div>';
    return h + '</div>';
  }

  function tView(st) {
    var v = st.view;
    var h = '<label class="ck"><input type="checkbox" data-c="view-on"' + (v ? ' checked' : '') + '> Définir l\'affichage de départ de cette question</label>';
    if (!v) return h + '<div class="msg-n">Sans réglage, la carte garde l\'affichage précédent.</div>';
    h += '<label>Projection<select data-b="v.mode"><option value="flat"' + (v.mode === 'flat' ? ' selected' : '') + '>Plane</option><option value="globe"' + (v.mode === 'globe' ? ' selected' : '') + '>Globe</option></select></label>';
    h += '<div class="row3"><label>Longitude du centre<input type="number" data-c="lon" value="' + (v.rot ? Math.round(-v.rot[0]) : '') + '" placeholder="auto"></label>' +
      '<label>Latitude du centre (globe)<input type="number" data-c="lat" value="' + (v.rot ? Math.round(-v.rot[1]) : '') + '" placeholder="auto"></label>' +
      '<label>Zoom<input type="number" min="0.8" max="14" step="0.1" data-b="v.k" data-t="n" value="' + (v.k == null ? '' : v.k) + '" placeholder="1"></label></div>';
    h += '<div class="lbl">Couches visibles au départ</div>' + LAYERS.map(function (l) {
      return '<label class="ck"><input type="checkbox" data-c="vl" data-k="' + l[0] + '"' + ((v.layers || {})[l[0]] ? ' checked' : '') + '> ' + l[1] + '</label>';
    }).join('');
    h += '<div class="row3"><label>Séismes : de<input type="number" min="1960" max="2026" data-c="y0" value="' + (v.y ? v.y[0] : '') + '" placeholder="inchangé"></label>' +
      '<label>à<input type="number" min="1960" max="2026" data-c="y1" value="' + (v.y ? v.y[1] : '') + '" placeholder="inchangé"></label>' +
      '<label>Magnitude archive<select data-b="v.amag" data-t="n"><option value="">inchangée</option>' + [5, 6, 7].map(function (m) {
        return '<option value="' + m + '"' + (v.amag === m ? ' selected' : '') + '>M ≥ ' + m + '</option>';
      }).join('') + '</select></label></div>';
    h += '<div class="row3"><label>Volcans : de<input type="number" min="-10000" max="2026" data-c="vy0v" value="' + (v.vy && v.vy[0] != null ? v.vy[0] : '') + '" placeholder="∞"></label>' +
      '<label>à<input type="number" min="-10000" max="2026" data-c="vy1v" value="' + (v.vy && v.vy[1] != null ? v.vy[1] : '') + '" placeholder="∞"></label>' +
      '<label>Couleur des séismes<select data-b="v.colorMode"><option value="depth"' + (v.colorMode === 'depth' ? ' selected' : '') + '>Profondeur</option><option value="ctx"' + (v.colorMode === 'ctx' ? ' selected' : '') + '>Type (compression/extension/cisaillement)</option></select></label></div>';
    h += '<label class="ck"><input type="checkbox" data-b="v.diffv"' + (v.diffv ? ' checked' : '') + '> Volcans différenciés (couleur par type)</label>';
    h += '<label class="ck"><input type="checkbox" data-c="live"' + ((v.live && v.live.on) ? ' checked' : '') + '> Activer le Live au départ</label>';
    return h;
  }

  function tPass(st) {
    var p = st.pass;
    var h = '<div class="msg-n">Condition pour que l\'élève puisse passer à la question suivante.</div>';
    var modes = [['none', 'Aucune réponse requise'], ['sent', 'Répondre, juste ou faux'], ['correct', st.type === 'text' ? 'Rédaction envoyée avec une note minimale' : 'Bonne réponse']];
    h += '<div class="lbl">Réponse</div>' + modes.map(function (m) {
      return '<label class="ck"><input type="radio" name="pmode" data-c="pmode" data-v="' + m[0] + '"' + (p.answer === m[0] ? ' checked' : '') + '> ' + m[1] + '</label>';
    }).join('');
    if (st.type === 'text' && p.answer === 'correct' && !st.ai) h += '<label>Note minimale /20<input type="number" min="0" max="20" step="0.5" data-b="st.pass.score" data-t="n" value="' + (p.score || 0) + '"></label>';
    h += '<label>Débloquer quand même après N essais (0 = jamais)<input type="number" min="0" max="20" data-b="st.pass.tries" data-t="n" value="' + (p.tries || 0) + '"></label>';
    h += '<div class="lbl">Couches à afficher sur la carte pour continuer</div>' + LAYERS.map(function (l) {
      return '<label class="ck"><input type="checkbox" data-c="pl" data-k="' + l[0] + '"' + ((p.layers || []).indexOf(l[0]) >= 0 ? ' checked' : '') + '> ' + l[1] + '</label>';
    }).join('');
    return h;
  }

  /* ---------- liaison données ---------- */
  function resolve(path) {
    var parts = path.split('.'), root = parts.shift(), obj;
    if (root === 'sc') obj = ctx.sc;
    else if (root === 'st') obj = cur();
    else if (root === 'v') obj = cur() && cur().view;
    else if (root === 'ctx') obj = ctx;
    if (!obj) return null;
    return { obj: obj, parts: parts };
  }
  function setPath(path, value) {
    var r = resolve(path);
    if (!r) return;
    var o = r.obj, p = r.parts;
    for (var i = 0; i < p.length - 1; i++) {
      if (o[p[i]] == null) o[p[i]] = /^\d+$/.test(p[i + 1]) ? [] : {};
      o = o[p[i]];
    }
    o[p[p.length - 1]] = value;
  }
  function coerce(t) {
    var kind = t.dataset.t;
    if (t.type === 'checkbox') return t.checked;
    var v = t.value;
    if (kind === 'n') return v === '' ? null : +v;
    if (kind === 'csv') return v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (kind === 'lines') return v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    return v;
  }

  function onInput(e) {
    var t = e.target;
    if (t.dataset && t.dataset.b && t.type !== 'checkbox' && t.tagName !== 'SELECT' && !t.dataset.re && !t.dataset.c) {
      setPath(t.dataset.b, coerce(t));
    }
  }
  function onChange(e) {
    var t = e.target;
    if (!t.dataset) return;
    if (t.dataset.b && !t.dataset.c) {
      setPath(t.dataset.b, coerce(t));
      if (t.dataset.b === 'st.type') normStep(cur());
      if (t.dataset.re || t.dataset.b === 'st.title') {
        if (t.dataset.re) render();
      }
      return;
    }
    if (t.dataset.c === 'lib-sel') { ctx.libSel = t.value; return; }
    if (t.dataset.c) cons(t);
    if (t.dataset.act === 'mg') {
      var grp = MI[+t.dataset.g], stg = cur();
      grp[1].forEach(function (it) { if (t.dataset.v === 'show') delete stg.menu[it[0]]; else stg.menu[it[0]] = t.dataset.v; });
      render(); return;
    }
    if (t.dataset.act === 'mi') { var st = cur(); if (t.dataset.v === 'show') delete st.menu[t.dataset.k]; else st.menu[t.dataset.k] = t.dataset.v; }
  }
  function cons(t) {
    var st = cur(), c = t.dataset.c, v = st.view, p = st.pass, k = st.cons;
    if (c === 'ok') { st.ok = +t.dataset.i; render(); return; }
    if (c === 'ctext') { st.ctext = t.value; render(); return; }
    if (c === 'qy-on') { k.qy = t.checked ? [1960, 2026] : null; render(); return; }
    if (c === 'qy0' || c === 'qy1') {
      var i = c === 'qy0' ? 0 : 1; k.qy = k.qy || [1960, 2026];
      k.qy[i] = Math.max(1960, Math.min(2026, +t.value || k.qy[i]));
      if (k.qy[0] > k.qy[1]) k.qy = [k.qy[1], k.qy[0]]; render(); return;
    }
    if (c === 'vy-on') { k.vy = t.checked ? [-10000, 2026] : null; render(); return; }
    if (c === 'vy0' || c === 'vy1') {
      var j = c === 'vy0' ? 0 : 1; k.vy = k.vy || [-10000, 2026];
      k.vy[j] = Math.max(-10000, Math.min(2026, t.value === '' ? k.vy[j] : +t.value));
      if (k.vy[0] > k.vy[1]) k.vy = [k.vy[1], k.vy[0]]; render(); return;
    }
    if (c === 'amag') { k.amag = t.value ? +t.value : null; return; }
    if (c === 'minmag') { k.minmag = t.value === '' ? null : Math.max(0, Math.min(8, +t.value)); return; }
    if (c === 'view-on') { st.view = t.checked ? (st.view || defaultView()) : null; render(); return; }
    if (c === 'pmode') { p.answer = t.dataset.v; render(); return; }
    if (c === 'pl') {
      var ix = p.layers.indexOf(t.dataset.k);
      if (t.checked && ix < 0) p.layers.push(t.dataset.k);
      if (!t.checked && ix >= 0) p.layers.splice(ix, 1);
      return;
    }
    if (!v) return;
    if (c === 'lon') { v.rot = v.rot || [0, -15]; if (t.value !== '') v.rot[0] = -(+t.value); return; }
    if (c === 'lat') { v.rot = v.rot || [0, -15]; if (t.value !== '') v.rot[1] = -(+t.value); return; }
    if (c === 'vl') { v.layers = v.layers || {}; v.layers[t.dataset.k] = t.checked; return; }
    if (c === 'y0' || c === 'y1') {
      var a = ctx.root.querySelector('[data-c=y0]').value, b = ctx.root.querySelector('[data-c=y1]').value;
      v.y = (a === '' && b === '') ? null : [a === '' ? 2011 : +a, b === '' ? (a === '' ? 2011 : +a) : +b]; return;
    }
    if (c === 'vy0v' || c === 'vy1v') {
      var x = ctx.root.querySelector('[data-c=vy0v]').value, y = ctx.root.querySelector('[data-c=vy1v]').value;
      v.vy = [x === '' ? null : +x, y === '' ? null : +y]; return;
    }
    if (c === 'live') { v.live = { on: t.checked, span: (v.live && v.live.span) || 3 }; return; }
  }

  function say(text, ok) {
    var m = ctx.root.querySelector('#ed-msg');
    if (m) { m.textContent = text; m.style.color = ok ? 'var(--accent)' : 'var(--bad)'; }
  }

  function onClick(e) {
    var sub = e.target.closest('[data-sub]');
    if (sub) { ctx.sub = sub.dataset.sub; if (ctx.sub === 'btns') loadLib(); render(); return; }
    var b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'INPUT') return;
    var a = b.dataset.act, i = +b.dataset.i, sc = ctx.sc, st = cur();
    if (a === 'st-sel') { if (e.target.closest('.mv button')) { /* géré plus bas */ } else { ctx.si = i; render(); return; } }
    e.stopPropagation();
    switch (a) {
      case 'cancel': ctx.onCancel(); break;
      case 'save': save(); break;
      case 'preview': openPreview(null); break;
      case 'st-add': sc.steps.push(newStep()); ctx.si = sc.steps.length - 1; ctx.sub = 'content'; render(); break;
      case 'st-up': if (i > 0) { var t = sc.steps[i]; sc.steps[i] = sc.steps[i - 1]; sc.steps[i - 1] = t; ctx.si = i - 1; render(); } break;
      case 'st-down': if (i < sc.steps.length - 1) { var t2 = sc.steps[i]; sc.steps[i] = sc.steps[i + 1]; sc.steps[i + 1] = t2; ctx.si = i + 1; render(); } break;
      case 'st-dup': var c = clone(sc.steps[i]); c.id = uid('q'); c.title = c.title + ' (copie)'; sc.steps.splice(i + 1, 0, c); ctx.si = i + 1; render(); break;
      case 'st-del':
        if (confirm('Supprimer cette question ?')) { sc.steps.splice(i, 1); ctx.si = Math.max(0, Math.min(ctx.si, sc.steps.length - 1)); render(); }
        break;
      case 'sit-add': st.buttons.push({ id: uid('b'), label: 'Nouveau bouton', view: null, target: null, lock: false }); render(); break;
      case 'sit-tolib': {
        var sb = st.buttons[i];
        ctx.api('api/situations.php', { method: 'POST', body: JSON.stringify({ label: sb.label || 'Situation', data: { view: sb.view, target: sb.target || null, lock: !!sb.lock } }) })
          .then(function () { ctx.lib = null; loadLib(); say('« ' + (sb.label || '') + ' » ajouté à la bibliothèque.', true); })
          .catch(function (err) { say('Bibliothèque : ' + err.message); });
        break;
      }
      case 'lib-use': {
        var li = (ctx.lib || []).filter(function (l) { return l.id === ctx.libSel; })[0];
        if (li) { st.buttons.push({ id: uid('b'), label: li.label, view: clone(li.data.view), target: li.data.target || null, lock: !!li.data.lock }); render(); }
        break;
      }
      case 'lib-del':
        if (ctx.libSel && confirm('Retirer cette situation de la bibliothèque ?')) {
          ctx.api('api/situations.php?id=' + encodeURIComponent(ctx.libSel), { method: 'DELETE' })
            .then(function () { ctx.lib = null; loadLib(); })
            .catch(function (err) { say('Bibliothèque : ' + err.message); });
        }
        break;
      case 'sit-del': st.buttons.splice(i, 1); render(); break;
      case 'sit-cap': openPreview({ id: st.buttons[i].id, label: st.buttons[i].label, view: st.buttons[i].view, target: st.buttons[i].target || null }); break;
      case 'crit-add': st.crit.push({ label: 'Nouveau critère', pts: 5, need: 1, kw: [], hint: '' }); render(); break;
      case 'crit-del': st.crit.splice(i, 1); render(); break;
      case 'mi-all':
        st.menu = {};
        if (b.dataset.v !== 'show') MI.forEach(function (g) { g[1].forEach(function (it) { st.menu[it[0]] = b.dataset.v; }); });
        render(); break;
    }
  }

  /* Aperçu élève : ouvre l'app dans une fenêtre et lui envoie le scénario en cours (non enregistré). */
  var pw = null;
  function previewData() {
    var sc = clone(ctx.sc);
    sc.id = (ctx.rec && ctx.rec.id) || 'sc-preview';
    delete sc.code;
    return { type: 'tecto-preview', scenario: sc, idx: ctx.si, capture: pendingCap };
  }
  var pendingCap = null;
  function openPreview(cap) {
    pendingCap = cap && cap.id ? cap : null;
    if (pw && !pw.closed) { pw.postMessage(previewData(), location.origin); pw.focus(); return; }
    pw = window.open('index.html#preview', 'tecto-preview');
    if (!pw) say('Fenêtre bloquée : autorise les fenêtres pop-up pour ce site.');
  }
  window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.type === 'tecto-capture' && ctx && pw && e.source === pw) {
      var bt = (cur().buttons || []).filter(function (x) { return x.id === e.data.id; })[0];
      if (bt) { bt.view = e.data.view; bt.target = e.data.target || null; if (pendingCap && pendingCap.id === bt.id) pendingCap.view = bt.view; render(); say('Situation enregistrée dans le bouton « ' + (bt.label || '') + ' ».'); }
      return;
    }
    if (e.origin !== location.origin || !e.data || e.data.type !== 'tecto-ready') return;
    if (ctx && pw && e.source === pw) pw.postMessage(previewData(), location.origin);
  });

  function save() {
    var sc = ctx.sc;
    if (!String(sc.title || '').trim()) { say('Le scénario a besoin d\'un titre.'); return; }
    if (!sc.steps.length) { say('Ajoute au moins une question.'); return; }
    for (var i = 0; i < sc.steps.length; i++) {
      var s = sc.steps[i];
      if (s.type === 'qcm' && !String(s.opts[s.ok] || '').trim()) { say('Question ' + (i + 1) + ' : la bonne réponse est vide.'); return; }
      for (var bi = 0; bi < s.buttons.length; bi++) { if (!s.buttons[bi].view) { say('Question ' + (i + 1) + ' : le bouton « ' + (s.buttons[bi].label || '') + ' » n\'a pas de situation enregistrée.'); return; } }
      if (s.type === 'cloze' && String(s.ctext || '').indexOf('___') < 0) { say('Question ' + (i + 1) + ' : la phrase n\'a aucun trou (___).'); return; }
    }
    var content = clone(sc);
    delete content.code;
    ctx.onSave({ id: ctx.rec.id || '', title: sc.title, session_code: (ctx.code || '').trim(), is_active: !!ctx.active, content: content });
  }

  var CSS = '.ed-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}' +
    '.ed-block{border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px}' +
    '.ed-block label{display:block;margin:0 0 8px;font-size:.9rem}.ed-block label.ck{display:flex;gap:6px;align-items:center}' +
    '.ed-block label.ck input{width:auto;margin:0}.ed-block textarea.short{min-height:70px}.ed-block textarea{min-height:80px}' +
    '.ed-cols{display:grid;grid-template-columns:230px 1fr;gap:12px}@media(max-width:700px){.ed-cols{grid-template-columns:1fr}}' +
    '.ed-row{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap}' +
    '.ed-steps .it{border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:6px;cursor:pointer}.ed-steps .it.on{border-color:var(--accent);background:rgba(60,196,217,.12)}' +
    '.ed-steps .tt small{display:block;opacity:.7}.ed-steps .mv{margin-top:4px}.ed-steps .mv button{padding:2px 8px;margin:0 2px 0 0;font-size:.8rem}' +
    '.subtabs{display:flex;gap:4px;flex-wrap:wrap}.subtabs button{background:transparent;color:var(--ink);border:1px solid var(--line);padding:5px 10px}.subtabs button.on{background:var(--accent);color:#fff;border-color:var(--accent)}' +
    '.opt3{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px}.opt3>input{width:auto;margin-top:26px}' +
    '.crit{border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0}.lbl{font-size:.9rem;margin:8px 0 4px}' +
    '.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}' +
    '.mtab{width:100%;border-collapse:collapse}.mtab td,.mtab th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:center}.mtab td:first-child,.mtab th:first-child{text-align:left}.mtab td.g{font-weight:600;text-align:left;background:rgba(127,127,127,.12)}.mtab td.g:not(:first-child){text-align:center}' +
    '.mtab input{width:auto;margin:0}.msg-n{font-size:.9rem;opacity:.8;margin-bottom:8px}';

  window.ScEditor = {
    open: function (root, rec, onSave, onCancel, apiFn) {
      if (!document.getElementById('ed-css')) {
        var s = document.createElement('style'); s.id = 'ed-css'; s.textContent = CSS; document.head.appendChild(s);
      }
      var sc = clone(rec.content || { title: rec.title, intro: '', steps: [] });
      sc.title = rec.title || sc.title || 'Nouveau scénario';
      if (!Array.isArray(sc.steps)) sc.steps = [];
      sc.steps.forEach(normStep);
      if (!sc.steps.length) sc.steps.push(newStep());
      if (ctx && ctx.root) { ctx.root.removeEventListener('click', onClick); ctx.root.removeEventListener('input', onInput); ctx.root.removeEventListener('change', onChange); }
      ctx = { root: root, rec: rec, sc: sc, si: 0, sub: 'content', code: rec.session_code || '', active: !!rec.is_active, onSave: onSave, onCancel: onCancel, api: apiFn || null, lib: null };
      root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
      root.hidden = false;
      render();
    },
    close: function () { if (ctx && ctx.root) { ctx.root.hidden = true; ctx.root.innerHTML = ''; } },
    say: say
  };
})();
