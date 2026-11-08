<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';

session_name(config()['session_name'] ?? 'carte_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']),
]);
session_start();
header('X-Content-Type-Options: nosniff');

/** Envoie une réponse JSON et stoppe le script. */
function json_out($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Corps de requête JSON décodé en tableau. */
function body(): array {
    $d = json_decode(file_get_contents('php://input') ?: '[]', true);
    return is_array($d) ? $d : [];
}

/** Exige un enseignant connecté. */
function require_teacher(): array {
    if (empty($_SESSION['teacher'])) {
        json_out(['error' => 'Connexion requise'], 401);
    }
    return $_SESSION['teacher'];
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

/** Refuse toute écriture sans le jeton CSRF envoyé en en-tête. */
function csrf_check(): void {
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($sent === '' || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        json_out(['error' => 'Jeton CSRF invalide, reconnecte-toi'], 403);
    }
}
