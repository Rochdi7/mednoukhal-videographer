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

// Sends one plain-text message through an SMTP server that needs a login (Gmail with an app password:
// smtp.gmail.com, port 465 for SSL or 587 for STARTTLS). Returns false on any refusal and logs the step.
function smtp_send(array $c, string $from, string $to, string $replyTo, string $encodedSubject, string $body): bool
{
    $host = trim((string) $c['smtp_host']);
    $port = (int) ($c['smtp_port'] ?? 465) ?: 465;
    $user = trim((string) $c['smtp_user']);
    $pass = str_replace(' ', '', (string) ($c['smtp_pass'] ?? '')); // Google shows app passwords in groups of four
    $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host]]);
    $fp = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$fp) {
        error_log("Med Noukhal contact form: SMTP connect failed ($errno $errstr)");
        return false;
    }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): int {
        $code = 0;
        while (($line = fgets($fp, 1024)) !== false) {
            $code = (int) substr($line, 0, 3);
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        return $code;
    };
    $step = function (string $command, array $ok, string $label) use ($fp, $read): bool {
        if ($command !== '') {
            fwrite($fp, $command . "\r\n");
        }
        $code = $read();
        if (!in_array($code, $ok, true)) {
            error_log("Med Noukhal contact form: SMTP $label refused ($code)");
            return false;
        }
        return true;
    };

    $helo = preg_replace('/[^A-Za-z0-9.\-]/', '', (string) ($_SERVER['SERVER_NAME'] ?? '')) ?: 'localhost';
    $date = date('r');
    $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
    $message = implode("\r\n", [
        'Date: ' . $date,
        'From: Med Noukhal website <' . $from . '>',
        'To: <' . $to . '>',
        'Reply-To: ' . $replyTo,
        'Subject: ' . $encodedSubject,
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        rtrim(chunk_split(base64_encode($body), 76, "\r\n")),
    ]);

    $ok = $step('', [220], 'greeting')
        && $step('EHLO ' . $helo, [250], 'EHLO');
    if ($ok && $port !== 465) {
        $ok = $step('STARTTLS', [220], 'STARTTLS')
            && stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)
            && $step('EHLO ' . $helo, [250], 'EHLO after STARTTLS');
    }
    $ok = $ok
        && $step('AUTH LOGIN', [334], 'AUTH')
        && $step(base64_encode($user), [334], 'login')
        && $step(base64_encode($pass), [235], 'password')
        && $step('MAIL FROM:<' . $from . '>', [250], 'MAIL FROM')
        && $step('RCPT TO:<' . $to . '>', [250, 251], 'RCPT TO')
        && $step('DATA', [354], 'DATA')
        && $step($message . "\r\n.", [250], 'message');
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return $ok;
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

// config.php is optional (a deploy that empties public_html removes it); mn-config.php outside the website survives.
$config = is_file(__DIR__ . '/config.php') ? (array) require __DIR__ . '/config.php' : [];
// Optional settings file outside the website (next to public_html on the server, the project folder locally). Its values win.
$outside = dirname(__DIR__, 2) . '/mn-config.php';
if (is_file($outside)) {
    $config = array_merge($config, (array) require $outside);
}
$sink = getenv('MEDNOUKHAL_MAIL_SINK') ?: '';
$smtp = trim((string) ($config['smtp_host'] ?? '')) !== '' && trim((string) ($config['smtp_user'] ?? '')) !== '';
$to = $config['to_email'] ?? '';
// Gmail only sends as the account that signs in, so with SMTP the sender defaults to that account.
$from = ($config['from_email'] ?? '') ?: ($smtp ? $config['smtp_user'] : '');
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
    'From: Med Noukhal website <' . $from . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
]);

if ($sink !== '') {
    $sent = file_put_contents($sink, json_encode(['subject' => $subject, 'body' => $body, 'reply_to' => $email]) . "\n", FILE_APPEND) !== false;
} elseif ($smtp) {
    $sent = smtp_send($config, $from, $to, $email, $encodedSubject, $body);
} else {
    $sent = mail($to, $encodedSubject, $body, $headers, '-f' . $from);
}

if (!$sent) {
    error_log('Med Noukhal contact form: delivery failed');
    respond(500, ['ok' => false, 'code' => 'server']);
}

$hits[] = $now;
@file_put_contents($bucket, implode("\n", $hits), LOCK_EX);
respond(200, ['ok' => true]);
