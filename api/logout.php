<?php
require __DIR__ . '/../lib/http.php';

$_SESSION = [];
session_destroy();
json_out(['ok' => true]);
