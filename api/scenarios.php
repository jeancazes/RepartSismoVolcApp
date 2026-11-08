<?php
// Gestion des scénarios par l'enseignant connecté (liste, enregistrement, suppression).
require __DIR__ . '/../lib/http.php';

$t = require_teacher();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $st = $pdo->prepare('SELECT id, title, session_code, content, is_active, updated_at FROM scenarios WHERE teacher_id = ? ORDER BY updated_at DESC');
    $st->execute([$t['id']]);
    $rows = array_map(static function (array $r): array {
        $r['content'] = json_decode($r['content'], true);
        $r['is_active'] = (bool)$r['is_active'];
        return $r;
    }, $st->fetchAll());
    json_out(['scenarios' => $rows, 'csrf' => csrf_token()]);
}

csrf_check();

if ($method === 'DELETE') {
    $st = $pdo->prepare('DELETE FROM scenarios WHERE id = ? AND teacher_id = ?');
    $st->execute([(string)($_GET['id'] ?? ''), $t['id']]);
    json_out(['ok' => $st->rowCount() > 0]);
}

if ($method === 'POST') {
    $d = body();
    $id = preg_match('/^[a-z0-9_-]{3,40}$/i', (string)($d['id'] ?? '')) ? (string)$d['id'] : bin2hex(random_bytes(8));
    $content = $d['content'] ?? null;
    if (!is_array($content) || !isset($content['steps']) || !is_array($content['steps'])) {
        json_out(['error' => 'Contenu de scénario invalide'], 422);
    }

    // Un scénario ne peut être modifié que par son propriétaire.
    $st = $pdo->prepare('SELECT teacher_id FROM scenarios WHERE id = ?');
    $st->execute([$id]);
    $owner = $st->fetchColumn();
    if ($owner !== false && (int)$owner !== (int)$t['id']) {
        json_out(['error' => 'Scénario non accessible'], 403);
    }

    $st = $pdo->prepare(
        'INSERT INTO scenarios (id, teacher_id, title, session_code, content, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), session_code = VALUES(session_code),
                                 content = VALUES(content), is_active = VALUES(is_active)'
    );
    $st->execute([
        $id,
        $t['id'],
        mb_substr(trim((string)($d['title'] ?? 'Sans titre')), 0, 200),
        trim((string)($d['session_code'] ?? '')) ?: null,
        json_encode($content, JSON_UNESCAPED_UNICODE),
        !empty($d['is_active']) ? 1 : 0,
    ]);
    json_out(['ok' => true, 'id' => $id]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
