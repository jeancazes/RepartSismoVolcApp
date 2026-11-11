<?php
// Côté élève : liste des scénarios actifs (sans contenu), puis déblocage par code de séance.
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rows = db()->query('SELECT id, title, session_code, content FROM scenarios WHERE is_active = 1 ORDER BY title')->fetchAll();
    $out = array_map(static function (array $r): array {
        $c = json_decode($r['content'], true);
        return [
            'id' => $r['id'],
            'title' => $r['title'],
            'requires_code' => $r['session_code'] !== null,
            'steps' => count($c['steps'] ?? []),
        ];
    }, $rows);
    json_out(['scenarios' => $out]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $d = body();
    $st = db()->prepare('SELECT id, title, session_code, content FROM scenarios WHERE id = ? AND is_active = 1');
    $st->execute([(string)($d['id'] ?? '')]);
    $r = $st->fetch();
    if (!$r) {
        json_out(['error' => 'Scénario introuvable'], 404);
    }
    if ($r['session_code'] !== null && norm((string)($d['code'] ?? '')) !== norm($r['session_code'])) {
        usleep(300000);
        json_out(['error' => 'Code incorrect'], 403);
    }
    json_out(['scenario' => (object)(['id' => $r['id'], 'title' => $r['title']] + (array)json_decode($r['content']))]);
}

json_out(['error' => 'Méthode non autorisée'], 405);
