<?php
declare(strict_types=1);

/** Configuration serveur (config.php n'est jamais versionné). */
function config(): array {
    static $c = null;
    if ($c === null) {
        $file = __DIR__ . '/../config.php';
        if (!is_file($file)) {
            http_response_code(500);
            exit('config.php manquant sur le serveur.');
        }
        $c = require $file;
    }
    return $c;
}

/** Connexion PDO unique par requête. */
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $c = config()['db'];
        $pdo = new PDO(
            "mysql:host={$c['host']};dbname={$c['name']};charset={$c['charset']}",
            $c['user'],
            $c['pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }
    return $pdo;
}

/** Normalise un code de séance (casse et espaces ignorées). */
function norm(string $s): string {
    return mb_strtolower(trim($s), 'UTF-8');
}
