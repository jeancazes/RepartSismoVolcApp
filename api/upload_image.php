<?php
// Envoi d'une image de scénario par un enseignant connecté (JPG/PNG/WebP, 3 Mo max).
// Reçoit {"data":"data:image/jpeg;base64,..."} ; renvoie {"url":"uploads/img/xxxx.jpg"}.
require __DIR__ . '/../lib/http.php';

$t = require_teacher();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}
csrf_check();

$d = body();
$data = (string)($d['data'] ?? '');
if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$#', $data, $m)) {
    json_out(['error' => 'Format non accepté (JPG, PNG ou WebP)'], 422);
}
$bin = base64_decode($m[2], true);
if ($bin === false || strlen($bin) < 100 || strlen($bin) > 3 * 1024 * 1024) {
    json_out(['error' => 'Image invalide ou trop lourde (3 Mo max)'], 422);
}
$info = @getimagesizefromstring($bin);
$ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? null;
if (!$info || !$ext || $info[0] > 6000 || $info[1] > 6000) {
    json_out(['error' => 'Image invalide'], 422);
}

$dir = __DIR__ . '/../uploads/img';
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    json_out(['error' => 'Dossier d\'envoi indisponible'], 500);
}
// Aucun script ne doit pouvoir s'exécuter dans ce dossier.
$ht = __DIR__ . '/../uploads/.htaccess';
if (!is_file($ht)) {
    @file_put_contents($ht, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|php[0-9])$\">\nRequire all denied\n</FilesMatch>\n");
}
$name = bin2hex(random_bytes(10)) . '.' . $ext;
if (file_put_contents($dir . '/' . $name, $bin) === false) {
    json_out(['error' => 'Écriture impossible'], 500);
}
json_out(['url' => 'uploads/img/' . $name]);
