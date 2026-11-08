<?php
// Lien reçu par mail : confirme le compte enseignant.
require __DIR__ . '/lib/db.php';

$t = (string)($_GET['t'] ?? '');
$ok = false;
if (preg_match('/^[a-f0-9]{64}$/', $t)) {
    $st = db()->prepare('UPDATE teachers SET verified_at = NOW(), verify_token = NULL, verify_expires = NULL WHERE verify_token = ? AND verify_expires > NOW()');
    $st->execute([hash('sha256', $t)]);
    $ok = $st->rowCount() > 0;
}
?><!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirmation du compte</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5}</style>
</head>
<body>
<?php if ($ok): ?>
  <h1>Compte confirmé</h1>
  <p>Tu peux maintenant <a href="admin.php">te connecter à l'espace enseignant</a>.</p>
<?php else: ?>
  <h1>Lien invalide ou expiré</h1>
  <p>Refais une demande d'inscription depuis <a href="admin.php">l'espace enseignant</a>.</p>
<?php endif; ?>
</body>
</html>
