<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function field(string $name, int $max = 200): string
{
    $value = $_POST[$name] ?? '';
    if (!is_string($value)) {
        return '';
    }
    $value = trim(str_replace("\0", '', $value));
    return function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
}

function single_line(string $value): string
{
    return trim(preg_replace('/[\r\n\t]+/', ' ', $value) ?? '');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'code' => 'server']);
}

// Same-origin requests only.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
    respond(403, ['ok' => false, 'code' => 'server']);
}

// Spam traps. Bots that fill the hidden field get a normal-looking success and nothing is sent.
if (field('company') !== '') {
    respond(200, ['ok' => true]);
}
$started = (int) field('started', 20);
$elapsedMs = (int) (microtime(true) * 1000) - $started;
if ($started <= 0 || $elapsedMs < 2500 || $elapsedMs > 86400000) {
    respond(200, ['ok' => true]);
}

// Validate everything on the server, whatever the browser checked.
// The service is the label of one of the site's services (they are edited in the dashboard), or "Other".
$errors = [];
$service = single_line(field('service', 120));
if ($service === '') {
    $errors['service'] = 'required';
}

$name = single_line(field('name', 100));
$email = single_line(field('email', 160));
$phone = single_line(field('phone', 25));
$message = field('message', 4000);

if (strlen($name) < 2) {
    $errors['name'] = 'required';
}
if ($email === '') {
    $errors['email'] = 'required';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'email';
}
if ($phone === '') {
    $errors['phone'] = 'required';
} elseif (!preg_match('/^[+0-9 ().\-]{6,25}$/', $phone)) {
    $errors['phone'] = 'phone';
}
if (mb_strlen($message) < 2) {
    $errors['message'] = 'required';
}

if ($errors) {
    respond(422, ['ok' => false, 'code' => 'validation', 'fields' => $errors]);
}

$config = require __DIR__ . '/config.php';
$sink = getenv('MEDNOUKHAL_MAIL_SINK') ?: '';
$to = $config['to_email'] ?? '';
$from = $config['from_email'] ?? '';
if ($sink === '' && (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL))) {
    respond(503, ['ok' => false, 'code' => 'not_configured']);
}

// Rate limit: five accepted messages per address every ten minutes.
$bucket = sys_get_temp_dir() . '/mednoukhal_' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
$now = time();
$hits = [];
if (is_file($bucket)) {
    $hits = array_values(array_filter(array_map('intval', file($bucket, FILE_IGNORE_NEW_LINES) ?: []), fn (int $t) => $t > $now - 600));
}
if (count($hits) >= 5) {
    respond(429, ['ok' => false, 'code' => 'rate_limited']);
}

$lines = [
    'Service: ' . $service,
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . $phone,
    'Language: ' . single_line(field('locale', 5)),
];
$lines[] = 'Message: ' . $message;
$body = implode("\n", $lines) . "\n";
$subject = 'Website enquiry: ' . $service . ' from ' . $name;
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$headers = implode("\r\n", [
    'From: Mednoukhal website <' . $from . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
]);

if ($sink !== '') {
    $sent = file_put_contents($sink, json_encode(['subject' => $subject, 'body' => $body, 'reply_to' => $email]) . "\n", FILE_APPEND) !== false;
} else {
    $sent = mail($to, $encodedSubject, $body, $headers, '-f' . $from);
}

if (!$sent) {
    error_log('Mednoukhal contact form: delivery failed');
    respond(500, ['ok' => false, 'code' => 'server']);
}

$hits[] = $now;
@file_put_contents($bucket, implode("\n", $hits), LOCK_EX);
respond(200, ['ok' => true]);
