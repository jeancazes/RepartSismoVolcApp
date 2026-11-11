<?php
// Indique à l'app élève si un enseignant est connecté (pour afficher « Enregistrer la situation »).
require __DIR__ . '/../lib/http.php';

$t = $_SESSION['teacher'] ?? null;
json_out(['teacher' => $t ? ['name' => (string)($t['name'] ?? '')] : null]);
