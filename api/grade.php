<?php
// Correction IA d'une réponse ouverte. Les clés API restent dans config.php, jamais dans le navigateur.
require __DIR__ . '/../lib/http.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Méthode non autorisée'], 405);
}

$ai = config()['ai'] ?? [];
if (!empty($ai['paused']) || ($ai['provider'] ?? 'none') === 'none') {
    json_out(['error' => 'Correction IA désactivée'], 503);
}

$d = body();
$text = mb_substr(trim((string)($d['text'] ?? '')), 0, 4000);
$question = mb_substr((string)($d['question'] ?? ''), 0, 1000);
$rubric = mb_substr((string)($d['rubric'] ?? ''), 0, 1000);
if ($text === '') {
    json_out(['error' => 'Réponse vide'], 422);
}

$prompt = "Tu corriges la réponse d'un élève de 4e en SVT.\n"
    . "Question : {$question}\nCritères : {$rubric}\nRéponse de l'élève : {$text}\n"
    . 'Réponds uniquement par un JSON : {"score": entier de 0 à 20, "commentaire": "une phrase en français, bienveillante"}';

/** Appel HTTP JSON ; lève une exception en cas d'échec. */
function post_json(string $url, array $payload, array $headers = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($res === false || $code >= 300) {
        throw new RuntimeException("Appel IA en échec ({$code})");
    }
    return json_decode($res, true) ?? [];
}

try {
    if ($ai['provider'] === 'mistral') {
        $r = post_json('https://api.mistral.ai/v1/chat/completions', [
            'model' => $ai['mistral_model'],
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'response_format' => ['type' => 'json_object'],
        ], ['Authorization: Bearer ' . $ai['mistral_key']]);
        $raw = $r['choices'][0]['message']['content'] ?? '';
    } elseif ($ai['provider'] === 'gemini') {
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($ai['gemini_model'])
            . ':generateContent?key=' . rawurlencode($ai['gemini_key']);
        $r = post_json($url, [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => ['responseMimeType' => 'application/json'],
        ]);
        $raw = $r['candidates'][0]['content']['parts'][0]['text'] ?? '';
    } else {
        json_out(['error' => 'Fournisseur IA inconnu'], 500);
    }
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 502);
}

$j = json_decode($raw, true);
if (!is_array($j) || !isset($j['score'])) {
    json_out(['error' => 'Réponse IA illisible'], 502);
}
json_out([
    'score' => max(0, min(20, (int)round((float)$j['score']))),
    'commentaire' => mb_substr((string)($j['commentaire'] ?? ''), 0, 300),
    'provisoire' => true,
]);
