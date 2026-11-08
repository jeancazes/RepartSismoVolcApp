<?php
// Comptes enseignants : liste, création et suppression par un enseignant connecté.
require __DIR__ . '/../lib/http.php';

$me = require_teacher();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, login, name, created_at FROM teachers ORDER BY login')->fetchAll();
    json_out(['teachers' => $rows, 'csrf' => csrf_token(), 'me' => (int)$me['id']]);
}

csrf_check();

if ($method === 'POST') {
    $d = body();
    $login = trim((string)($d['login'] ?? ''));
    $name = mb_substr(trim((string)($d['name'] ?? '')), 0, 120);
    $pass = (string)($d['password'] ?? '');
    if (!preg_match('/^[a-z0-9._-]{3,60}$/i', $login) || $name === '') {
        json_out(['error' => 'Identifiant (3 à 60 caractères simples) et nom obligatoires'], 422);
    }
    if (mb_strlen($pass) < 12) {
        json_out(['error' => 'Mot de passe : 12 caractères minimum'], 422);
    }
    try {
        $st = $pdo->prepare('INSERT INTO teachers (login, name, password_hash) VALUES (?, ?, ?)');
        $st->execute([$login, $name, password_hash($pass, PASSWORD_DEFAULT)]);
    } catch (PDOException $e) {
        json_out(['error' => 'Cet identifiant existe déjà'], 409);
    }
    json_out(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id === (int)$me['id']) {
        json_out(['error' => 'Tu ne peux pas supprimer ton propre compte'], 422);
    }
    $st = $pdo->prepare('DELETE FROM teachers WHERE id = ?');
    $st->execute([$id]);
    json_out(['ok' => $st->rowCount() > 0]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
