<?php
// Comptes enseignants : liste, création et suppression par un enseignant connecté.
require __DIR__ . '/../lib/http.php';

$me = require_teacher();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query('SELECT id, login, name, created_at, verified_at FROM teachers ORDER BY login')->fetchAll();
    json_out(['teachers' => $rows, 'csrf' => csrf_token(), 'me' => (int)$me['id']]);
}

csrf_check();

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
