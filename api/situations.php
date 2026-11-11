<?php
// Bibliothèque personnelle de situations (boutons de carte réutilisables).
require __DIR__ . '/../lib/http.php';

$t = require_teacher();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $st = $pdo->prepare('SELECT id, label, data FROM situations WHERE teacher_id = ? ORDER BY label');
        $st->execute([$t['id']]);
        $rows = array_map(static function (array $r): array {
            return ['id' => $r['id'], 'label' => $r['label'], 'data' => json_decode($r['data'], true)];
        }, $st->fetchAll());
        json_out(['situations' => $rows]);
    }

    csrf_check();

    if ($method === 'DELETE') {
        $st = $pdo->prepare('DELETE FROM situations WHERE id = ? AND teacher_id = ?');
        $st->execute([(string)($_GET['id'] ?? ''), $t['id']]);
        json_out(['ok' => $st->rowCount() > 0]);
    }

    if ($method === 'POST') {
        $d = body();
        $label = mb_substr(trim((string)($d['label'] ?? '')), 0, 120);
        $data = $d['data'] ?? null;
        if ($label === '' || !is_array($data) || !isset($data['view']) || !is_array($data['view'])) {
            json_out(['error' => 'Situation invalide'], 422);
        }
        $id = bin2hex(random_bytes(8));
        $pdo->prepare('INSERT INTO situations (id, teacher_id, label, data) VALUES (?, ?, ?, ?)')
            ->execute([$id, $t['id'], $label, json_encode($data, JSON_UNESCAPED_UNICODE)]);
        json_out(['ok' => true, 'id' => $id]);
    }
} catch (PDOException $e) {
    if (str_contains($e->getMessage(), "doesn't exist") || str_contains($e->getMessage(), 'situations')) {
        json_out(['error' => "La base n'est pas à jour : exécute db/migration_situations.sql dans phpMyAdmin."], 500);
    }
    throw $e;
}

json_out(['error' => 'Méthode non autorisée'], 405);
