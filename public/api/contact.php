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
$options = [
    'project_type' => ['advertising' => 'Advertising', 'brand' => 'Brand content', 'digital' => 'Digital media', 'music' => 'Music video', 'documentary' => 'Documentary', 'other' => 'Other'],
    'shoot_type' => ['portrait' => 'Luxury / portrait', 'product' => 'Product / e-commerce', 'event' => 'Event', 'other' => 'Other'],
    'level' => ['beginner' => 'Beginner', 'intermediate' => 'Intermediate', 'expert' => 'Expert'],
    'slot' => ['09:00-10:00' => '09:00-10:00', '11:00-12:00' => '11:00-12:00', '14:00-15:00' => '14:00-15:00', '16:00-17:00' => '16:00-17:00'],
];
$kinds = [
    'project' => ['label' => 'Project', 'required' => ['city', 'project_type', 'description'], 'optional' => []],
    'photoshoot' => ['label' => 'Photoshoot', 'required' => ['city', 'shoot_type', 'date', 'slot'], 'optional' => ['message']],
    'coaching' => ['label' => '1-1 Coaching', 'required' => ['level'], 'optional' => ['message']],
    'consultation' => ['label' => 'Consultation', 'required' => ['date', 'slot'], 'optional' => ['message']],
];
$labels = ['city' => 'City', 'project_type' => 'Project type', 'shoot_type' => 'Type of shoot', 'level' => 'Level', 'date' => 'Preferred date', 'slot' => 'Time slot', 'description' => 'Description', 'message' => 'Message'];

$kind = field('kind', 20);
if (!isset($kinds[$kind])) {
    respond(422, ['ok' => false, 'code' => 'server']);
}

$errors = [];
$name = single_line(field('name', 100));
$email = single_line(field('email', 160));
$phone = single_line(field('phone', 25));

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

$details = [];
foreach (array_merge($kinds[$kind]['required'], $kinds[$kind]['optional']) as $key) {
    $long = in_array($key, ['description', 'message'], true);
    $value = field($key, $long ? 4000 : 120);
    $required = in_array($key, $kinds[$kind]['required'], true);
    if ($value === '') {
        if ($required) {
            $errors[$key] = 'required';
        }
        continue;
    }
    if (isset($options[$key])) {
        if (!isset($options[$key][$value])) {
            $errors[$key] = 'required';
            continue;
        }
        $value = $options[$key][$value];
    }
    if ($key === 'date') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        // One day of leniency covers visitors in time zones ahead of the server.
        if (!$date || $date->format('Y-m-d') !== $value || $date < new DateTimeImmutable('yesterday')) {
            $errors[$key] = 'date';
            continue;
        }
    }
    $details[$labels[$key]] = $long ? $value : single_line($value);
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
    'Type: ' . $kinds[$kind]['label'],
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . $phone,
    'Language: ' . single_line(field('locale', 5)),
];
foreach ($details as $label => $value) {
    $lines[] = $label . ': ' . $value;
}
$body = implode("\n", $lines) . "\n";
$subject = 'Website enquiry: ' . $kinds[$kind]['label'] . ' from ' . $name;
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
