<?php
// Espace enseignant : connexion et gestion des scénarios stockés sur le serveur.
require __DIR__ . '/lib/http.php';
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Espace enseignant</title><link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="icon.svg"><link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="manifest" href="manifest.webmanifest"><link rel="stylesheet" href="admin-checks.css?v=<?= @filemtime(__DIR__ . '/admin-checks.css') ?>"><meta name="theme-color" content="#0e1b36">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&family=IM+Fell+English&family=IBM+Plex+Mono:wght@400&display=swap"><link rel="stylesheet" href="admin-theme.css?v=<?= @filemtime(__DIR__ . '/admin-theme.css') ?>">
<script>try{var _s=JSON.parse(localStorage.getItem("tecto.proto.v1")||"{}");var _t=_s.set&&_s.set.th;if(_t==="light"||_t==="dark")document.documentElement.setAttribute("data-theme",_t)}catch(e){}</script>
</head>
<body class="adm-page">
<header class="adm-bar"><img src="icon.svg" alt=""><h1>Espace enseignant<small>Carte tectonique</small></h1><button id="adm-th" type="button" aria-label="Changer de thème"></button><a href="index.html">← Retour à l'app</a></header>
<main>

  <section id="login" class="card" <?= empty($_SESSION['teacher']) ? '' : 'hidden' ?>>
    <label>Identifiant<input id="l-login" autocomplete="username"></label>
    <label>Mot de passe<input id="l-pass" type="password" autocomplete="current-password"></label>
    <button id="btn-login">Se connecter</button>
    <div class="msg" id="l-msg"></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <h3 style="font-size:1rem;margin-top:0">Première connexion ? Crée ton compte</h3>
    <label>Adresse académique (prenom.nom@ac-academie.fr)<input id="r-login" type="email" placeholder="prenom.nom@ac-academie.fr"></label>
    <label>Nom affiché<input id="r-name"></label>
    <label>Mot de passe (12 caractères minimum)<input id="r-pass" type="password" autocomplete="new-password"></label>
    <button id="btn-register">Créer mon compte</button>
    <div class="msg" id="r-msg"></div>
  </section>

  <section id="panel" <?= empty($_SESSION['teacher']) ? 'hidden' : '' ?>>
    <div class="card">
      <div class="row">
        <span>Connecté : <b id="who"><?= htmlspecialchars($_SESSION['teacher']['name'] ?? '', ENT_QUOTES, 'UTF-8') ?></b></span>
        <span><button class="ghost" id="btn-logout">Se déconnecter</button> <a href="index.html">Voir l'app élève</a></span>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size:1.1rem;margin-top:0">Comptes enseignants</h2>
      <div id="teachers"></div>
    </div>

    <div class="card">
      <h2 style="font-size:1.1rem;margin-top:0">Scénarios</h2>
      <div id="list"></div>
      <button id="btn-new">Nouveau scénario</button>
      <details style="margin-top:12px">
        <summary>Importer une sauvegarde du prototype</summary>
        <p style="font-size:.9rem">Colle le JSON exporté depuis l'ancien admin (Compte > Exporter tout).</p>
        <textarea id="imp-json" placeholder="{ &quot;type&quot;: &quot;backup&quot;, ... }"></textarea>
        <button id="btn-import">Importer</button>
        <div class="msg" id="imp-msg"></div>
      </details>
    </div>

    <div class="card" id="vis" hidden></div>

    <div class="card" id="editor" hidden>
      <label>Titre<input id="e-title"></label>
      <label>Code de séance (vide = pas de code)<input id="e-code"></label>
      <label><input type="checkbox" id="e-active"> Visible pour les élèves</label>
      <label>Contenu (JSON du scénario)<textarea id="e-json"></textarea></label>
      <button id="btn-save">Enregistrer</button>
      <button class="ghost" id="btn-cancel">Annuler</button>
      <div class="msg" id="e-msg"></div>
    </div>
  </section>
</main>

<script>
(function(){
  var K="tecto.proto.v1",r=document.documentElement,b=document.getElementById("adm-th");
  function dark(){var t=r.getAttribute("data-theme");return t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches}
  function paint(){b.textContent=dark()?"☀ Clair":"☾ Sombre"}
  b.onclick=function(){var w=dark()?"light":"dark";r.setAttribute("data-theme",w);try{var o=JSON.parse(localStorage.getItem(K)||"{}");o.set=o.set||{};o.set.th=w;localStorage.setItem(K,JSON.stringify(o))}catch(e){}paint()};
  paint();
})();
</script>
<script src="admin-editor.js?v=<?= @filemtime(__DIR__ . '/admin-editor.js') ?>"></script>
<script>
(function () {
  'use strict';
  var csrf = '<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>';
  var scens = [], cur = null;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (opts.method && opts.method !== 'GET') opts.headers['X-CSRF-Token'] = csrf;
    return fetch(path, opts).then(function (r) {
      return r.text().then(function (txt) {
        var j;
        try { j = JSON.parse(txt); } catch (e) { throw new Error('Réponse serveur inattendue (HTTP ' + r.status + ')'); }
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }

  function load() {
    api('api/scenarios.php').then(function (j) {
      csrf = j.csrf; scens = j.scenarios; render();
    }).catch(function () { $('login').hidden = false; $('panel').hidden = true; });
  }

  function render() {
    $('list').innerHTML = scens.length ? scens.map(function (s) {
      return '<div class="row"><span><b>' + esc(s.title) + '</b>' + (s.is_active ? ' · <i>visible</i>' : '') +
        (s.session_code ? ' · code requis' : '') + '</span><span>' +
        '<button class="ghost" data-act="vis" data-id="' + esc(s.id) + '">Modifier</button>' +
        '<button class="ghost" data-act="edit" data-id="' + esc(s.id) + '">JSON</button>' +
        '<button class="danger" data-act="del" data-id="' + esc(s.id) + '">Supprimer</button></span></div>';
    }).join('') : '<p>Aucun scénario.</p>';
  }

  $('btn-login').onclick = function () {
    api('api/login.php', { method: 'POST', body: JSON.stringify({ login: $('l-login').value, password: $('l-pass').value }) })
      .then(function (j) { csrf = j.csrf; $('who').textContent = j.teacher.name; $('login').hidden = true; $('panel').hidden = false; load(); loadTeachers(); })
      .catch(function (e) { $('l-msg').textContent = e.message; });
  };
  $('btn-logout').onclick = function () { api('api/logout.php', { method: 'POST', body: '{}' }).then(function () { location.reload(); }); };

  function openEditor(s) {
    cur = s || { id: '', title: 'Nouveau scénario', session_code: '', is_active: false, content: { id: '', title: '', intro: '', steps: [] } };
    $('e-title').value = cur.title; $('e-code').value = cur.session_code || ''; $('e-active').checked = !!cur.is_active;
    $('e-json').value = JSON.stringify(cur.content, null, 2); $('e-msg').textContent = ''; $('editor').hidden = false;
  }
  $('btn-new').onclick = function () { openVisual(null); };
  function openVisual(s) {
    var rec = s ? { id: s.id, title: s.title, session_code: s.session_code, is_active: s.is_active, content: s.content }
      : { id: '', title: 'Nouveau scénario', session_code: '', is_active: false, content: { title: 'Nouveau scénario', intro: '', steps: [] } };
    $('editor').hidden = true;
    ScEditor.open($('vis'), rec, function (out) {
      api('api/scenarios.php', { method: 'POST', body: JSON.stringify(out) })
        .then(function () { ScEditor.close(); load(); ScEditor.toast && ScEditor.toast('Scénario enregistré ✓'); })
        .catch(function (e) { ScEditor.say('Erreur : ' + e.message); });
    }, function () { ScEditor.close(); }, api);
    $('vis').scrollIntoView({ behavior: 'smooth' });
  }
  $('btn-cancel').onclick = function () { $('editor').hidden = true; };

  $('list').onclick = function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var s = scens.filter(function (x) { return x.id === b.dataset.id; })[0];
    if (b.dataset.act === 'vis') openVisual(s);
    if (b.dataset.act === 'edit') openEditor(s);
    if (b.dataset.act === 'del' && confirm('Supprimer « ' + s.title + ' » ?')) {
      api('api/scenarios.php?id=' + encodeURIComponent(s.id), { method: 'DELETE' }).then(load).catch(function (err) { alert(err.message); });
    }
  };

  $('btn-save').onclick = function () {
    var content;
    try { content = JSON.parse($('e-json').value); } catch (e) { $('e-msg').textContent = 'JSON invalide : ' + e.message; return; }
    var body = { id: cur && cur.id || '', title: $('e-title').value, session_code: $('e-code').value, is_active: $('e-active').checked, content: content };
    api('api/scenarios.php', { method: 'POST', body: JSON.stringify(body) })
      .then(function () { $('editor').hidden = true; load(); })
      .catch(function (e) { $('e-msg').textContent = e.message; });
  };

  $('btn-register').onclick = function () {
    var m = $('r-msg'); m.className = 'msg'; m.style.color = '';
    api('api/register.php', { method: 'POST', body: JSON.stringify({ login: $('r-login').value, name: $('r-name').value, password: $('r-pass').value }) })
      .then(function (j) { m.style.color = 'var(--accent)'; m.textContent = j.message; $('r-pass').value = ''; })
      .catch(function (e) { m.textContent = e.message; });
  };

  $('btn-import').onclick = function () {
    var o, m = $('imp-msg'); m.style.color = '';
    try { o = JSON.parse($('imp-json').value); } catch (e) { m.textContent = 'JSON invalide.'; return; }
    o = o.data || o;
    // Formats acceptés : sauvegarde complète (scens), export d'un scénario (scenario) ou scénario seul (steps).
    var list = Array.isArray(o.scens) ? o.scens : (o.scenario && Array.isArray(o.scenario.steps) ? [o.scenario] : (Array.isArray(o.steps) ? [o] : null));
    if (!list || !list.length) { m.textContent = 'Aucun scénario reconnu dans ce JSON.'; return; }
    var single = !Array.isArray(o.scens);
    var n = 0, p = Promise.resolve();
    list.forEach(function (sc) {
      p = p.then(function () {
        var content = Object.assign({}, sc), code = content.code || '';
        delete content.code;
        return api('api/scenarios.php', { method: 'POST', body: JSON.stringify({
          id: sc.id, title: sc.title || 'Sans titre', session_code: code, is_active: single ? true : sc.id === o.active, content: content
        }) }).then(function () { n++; });
      });
    });
    m.textContent = 'Import en cours…';
    p.then(function () { m.style.color = 'var(--accent)'; m.textContent = n + ' scénario(s) importé(s).'; $('imp-json').value = ''; load(); })
      .catch(function (e) { m.style.color = 'var(--bad)'; m.textContent = 'Erreur : ' + e.message; load(); });
  };

  var teachers = [], myId = null;
  function loadTeachers() {
    api('api/teachers.php').then(function (j) {
      csrf = j.csrf; myId = j.me; teachers = j.teachers;
      $('teachers').innerHTML = teachers.map(function (t) {
        return '<div class="row"><span><b>' + esc(t.name) + '</b> (' + esc(t.login) + ')</span>' +
          (t.id !== myId ? '<button class="danger" data-tid="' + t.id + '">Supprimer</button>' : '<i>vous</i>') + '</div>';
      }).join('');
    }).catch(function () {});
  }
  $('teachers').onclick = function (e) {
    var b = e.target.closest('button[data-tid]'); if (!b) return;
    var t = teachers.filter(function (x) { return String(x.id) === b.dataset.tid; })[0];
    if (t && confirm('Supprimer le compte de ' + t.name + ' ? Ses scénarios seront aussi supprimés.')) {
      api('api/teachers.php?id=' + t.id, { method: 'DELETE' }).then(loadTeachers).catch(function (err) { alert(err.message); });
    }
  };

  if (!$('panel').hidden) { load(); loadTeachers(); }
})();
</script>
</body>
</html>
