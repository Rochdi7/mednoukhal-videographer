<?php
// Dashboard API for /admin. One endpoint, ?action=… :
//   GET  session                     who is signed in (+ CSRF token)
//   POST login {email, password}     sign in
//   POST logout                      sign out
//   POST password {current, next}    change the password
//   GET  content                     the site content (JSON)
//   POST save {revision, content}    save it (refused with 409 if someone saved in between)
//   POST upload (multipart chunks)   upload a photo or video, in pieces
//   GET  status                      unpublished changes + last build
//   POST publish                     start the GitHub build that puts the saved content online
//   GET  export (X-Deploy-Token)     the content, for the build
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

$CONFIG = require __DIR__ . '/../config.php';
// Optional settings file outside the website (next to public_html on the server, the project folder locally),
// written by `npm run admin:password -- --local`. Its values win over config.php.
$outside = dirname(__DIR__, 3) . '/mn-config.php';
if (is_file($outside)) $CONFIG = array_merge($CONFIG, (array) require $outside);
const MAX_JSON = 4 * 1024 * 1024;          // content document
const CHUNK_MAX = 8 * 1024 * 1024;          // one upload piece
const IMAGE_MAX = 40 * 1024 * 1024;
const VIDEO_MAX = 2 * 1024 * 1024 * 1024;
const BACKUPS_KEPT = 40;
const ORPHAN_DAYS = 7;                      // unused uploads are deleted after this long
const IDLE_SECONDS = 8 * 3600;

// ---------------------------------------------------------------- helpers
function respond(int $status, array $body = []): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(int $status, string $code, array $extra = []): never
{
    respond($status, ['ok' => false, 'code' => $code] + $extra);
}
function cfg(string $key): string
{
    global $CONFIG;
    $value = $CONFIG[$key] ?? '';
    return is_string($value) ? trim($value) : '';
}
function method(string $expected): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $expected) {
        header('Allow: ' . $expected);
        fail(405, 'method');
    }
}
function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, MAX_JSON + 1);
    if ($raw === false || strlen($raw) > MAX_JSON) fail(413, 'too_large');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}
function write_atomic(string $file, string $data): void
{
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $data, LOCK_EX) === false || !rename($tmp, $file)) {
        @unlink($tmp);
        fail(500, 'write_failed');
    }
}
function read_json(string $file): ?array
{
    if (!is_file($file)) return null;
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

// ---------------------------------------------------------------- storage
function data_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    // Default: "mn-data" next to public_html, outside the website.
    $dir = cfg('data_dir') !== '' ? rtrim(cfg('data_dir'), '/\\') : dirname(__DIR__, 3) . '/mn-data';
    foreach (['', '/backups', '/tmp'] as $sub) {
        if (!is_dir($dir . $sub) && !mkdir($dir . $sub, 0750, true) && !is_dir($dir . $sub)) fail(500, 'data_dir');
    }
    // In case data_dir was set inside the website: never serve it.
    if (!is_file($dir . '/.htaccess')) file_put_contents($dir . '/.htaccess', "Require all denied\n");
    return $dir;
}
// Uploads live in the website, so visitors load them from Hostinger directly. PHP never runs there.
function library_dir(): string
{
    // On the server: public_html/media/library (the deploy never touches it). `npm run admin:local` points it at
    // public/media/library instead, so a rebuild (which empties dist/) cannot erase local uploads.
    $dir = cfg('library_dir') !== '' ? rtrim(cfg('library_dir'), '/\\') : (getenv('MN_LIBRARY_DIR') ?: dirname(__DIR__, 2) . '/media/library');
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) fail(500, 'library_dir');
    if (!is_file($dir . '/.htaccess')) {
        file_put_contents($dir . '/.htaccess', "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .phar\nRemoveType .php .phtml .phar\n<FilesMatch \"\\.(php|phtml|phar|html?|svg|js)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    return $dir;
}
function load_content(): array
{
    $content = read_json(data_dir() . '/content.json');
    if ($content !== null) return $content;
    // First run: start from what the site shows today (written by `npm run cms:seed`).
    $seed = read_json(__DIR__ . '/seed.json') ?? [];
    $seed['revision'] = 1;
    $seed['updatedAt'] = gmdate('c');
    write_atomic(data_dir() . '/content.json', json_encode($seed, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $seed;
}
function state(): array
{
    return read_json(data_dir() . '/state.json') ?? [];
}
function save_state(array $state): void
{
    write_atomic(data_dir() . '/state.json', json_encode($state, JSON_UNESCAPED_SLASHES));
}

// Every media path the content points to must be one of ours: the build downloads them.
function check_paths(mixed $node): void
{
    if (is_array($node)) {
        foreach ($node as $key => $value) {
            if ($key === 'path' && is_string($value) && !preg_match('#^/media/(library|seed|videos)/[A-Za-z0-9/_.-]+$#', $value)) fail(422, 'bad_path', ['path' => $value]);
            check_paths($value);
        }
    }
}
function referenced_paths(mixed $node, array &$out): void
{
    if (is_array($node)) foreach ($node as $value) referenced_paths($value, $out);
    elseif (is_string($node) && str_starts_with($node, '/media/library/')) $out[$node] = true;
}
// Uploads nothing uses any more (deleted films, replaced photos) are removed once they have been unused for a week,
// so restoring a recent backup still finds its files.
function clean_library(array $content): void
{
    $used = [];
    referenced_paths($content, $used);
    $root = library_dir();
    $cutoff = time() - ORPHAN_DAYS * 86400;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if (!$file->isFile() || $file->getFilename() === '.htaccess') continue;
        $path = '/media/library/' . str_replace('\\', '/', substr($file->getPathname(), strlen($root) + 1));
        if (!isset($used[$path]) && $file->getMTime() < $cutoff) @unlink($file->getPathname());
    }
}

// ---------------------------------------------------------------- session & security
function start_session(): void
{
    session_name('mn_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
    if (!empty($_SESSION['user']) && time() - (int) ($_SESSION['seen'] ?? 0) > IDLE_SECONDS) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if (!empty($_SESSION['user'])) $_SESSION['seen'] = time();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST);
    if ($origin === '' || parse_url($origin, PHP_URL_HOST) !== $host) fail(403, 'origin');
}
function require_csrf(): void
{
    same_origin();
    if (!hash_equals((string) ($_SESSION['csrf'] ?? ''), (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) fail(403, 'csrf');
}
function require_user(): void
{
    if (empty($_SESSION['user'])) fail(401, 'signed_out');
}
// The login: config.php gives the first one; a password changed in the dashboard is kept in data_dir/auth.json.
function credentials(): array
{
    $saved = read_json(data_dir() . '/auth.json');
    return [
        'email' => strtolower($saved['email'] ?? cfg('admin_email')),
        'hash' => $saved['hash'] ?? cfg('admin_password_hash'),
    ];
}
// At most 5 failed sign-ins per address every 15 minutes.
function throttle(bool $failed = false): void
{
    $file = data_dir() . '/tmp/login-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '') . '.json';
    $now = time();
    $hits = array_values(array_filter(read_json($file) ?? [], fn ($t) => is_int($t) && $t > $now - 900));
    if ($failed) {
        $hits[] = $now;
        write_atomic($file, json_encode($hits));
    }
    if (count($hits) >= 5) fail(429, 'rate_limited', ['retryIn' => 900 - ($now - min($hits))]);
}

// ---------------------------------------------------------------- GitHub (publish)
function github(string $method, string $path, ?array $payload = null): array
{
    $token = cfg('github_token');
    $repo = cfg('github_repo');
    if ($token === '' || $repo === '' || !function_exists('curl_init')) return ['status' => 0, 'body' => null];
    $ch = curl_init('https://api.github.com/repos/' . $repo . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Accept: application/vnd.github+json', 'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: mednoukhal-dashboard', 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $payload === null ? null : json_encode($payload),
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => is_string($response) ? json_decode($response, true) : null];
}

// ---------------------------------------------------------------- actions
$action = $_GET['action'] ?? '';

// The build reads the content with the deploy token; no session involved.
if ($action === 'export') {
    method('GET');
    $token = cfg('deploy_token');
    // A custom header: Apache on shared hosting often drops "Authorization" before PHP sees it.
    $sent = $_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '';
    if (strlen($token) < 32 || !hash_equals($token, (string) $sent)) fail(403, 'token');
    respond(200, ['ok' => true, 'content' => load_content()]);
}

start_session();

switch ($action) {
    case 'session':
        method('GET');
        $creds = credentials();
        respond(200, ['ok' => true, 'user' => $_SESSION['user'] ?? null, 'csrf' => $_SESSION['csrf'], 'configured' => $creds['email'] !== '' && $creds['hash'] !== '']);

    case 'login':
        method('POST');
        same_origin();
        throttle();
        $in = body();
        $creds = credentials();
        if ($creds['email'] === '' || $creds['hash'] === '') fail(503, 'not_configured');
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        $password = (string) ($in['password'] ?? '');
        // Always run password_verify, so a wrong email takes as long as a wrong password.
        $valid = password_verify($password, $creds['hash']) && hash_equals($creds['email'], $email);
        if (!$valid) {
            throttle(true);
            fail(401, 'wrong_login');
        }
        session_regenerate_id(true);
        $_SESSION['user'] = $creds['email'];
        $_SESSION['seen'] = time();
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        if (password_needs_rehash($creds['hash'], PASSWORD_DEFAULT)) {
            write_atomic(data_dir() . '/auth.json', json_encode(['email' => $creds['email'], 'hash' => password_hash($password, PASSWORD_DEFAULT)]));
        }
        respond(200, ['ok' => true, 'user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf']]);

    case 'logout':
        method('POST');
        require_csrf();
        $_SESSION = [];
        session_destroy();
        respond(200, ['ok' => true]);

    case 'password':
        method('POST');
        require_csrf();
        require_user();
        $in = body();
        $creds = credentials();
        if (!password_verify((string) ($in['current'] ?? ''), $creds['hash'])) fail(401, 'wrong_password');
        $next = (string) ($in['next'] ?? '');
        if (strlen($next) < 8) fail(422, 'weak_password');
        $email = strtolower(trim((string) ($in['email'] ?? $creds['email'])));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'bad_email');
        write_atomic(data_dir() . '/auth.json', json_encode(['email' => $email, 'hash' => password_hash($next, PASSWORD_DEFAULT)]));
        $_SESSION['user'] = $email;
        respond(200, ['ok' => true, 'user' => $email]);

    case 'content':
        method('GET');
        require_user();
        respond(200, ['ok' => true, 'content' => load_content()]);

    case 'save':
        method('POST');
        require_csrf();
        require_user();
        $in = body();
        $content = $in['content'] ?? null;
        if (!is_array($content)) fail(422, 'bad_content');
        check_paths($content);
        $file = data_dir() . '/content.json';
        $lock = fopen(data_dir() . '/content.lock', 'c');
        flock($lock, LOCK_EX);
        $current = load_content();
        if ((int) ($in['revision'] ?? -1) !== (int) ($current['revision'] ?? 0)) {
            flock($lock, LOCK_UN);
            fail(409, 'conflict', ['content' => $current]);
        }
        // Keep the version being replaced, so a mistake can be undone.
        copy($file, data_dir() . '/backups/content-' . gmdate('Ymd-His') . '-r' . (int) ($current['revision'] ?? 0) . '.json');
        $backups = glob(data_dir() . '/backups/content-*.json') ?: [];
        sort($backups);
        foreach (array_slice($backups, 0, max(0, count($backups) - BACKUPS_KEPT)) as $old) @unlink($old);
        $content['revision'] = (int) ($current['revision'] ?? 0) + 1;
        $content['updatedAt'] = gmdate('c');
        $content['updatedBy'] = $_SESSION['user'];
        write_atomic($file, json_encode($content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        flock($lock, LOCK_UN);
        clean_library($content);
        respond(200, ['ok' => true, 'revision' => $content['revision'], 'updatedAt' => $content['updatedAt']]);

    case 'upload':
        method('POST');
        require_csrf();
        require_user();
        $id = (string) ($_POST['id'] ?? '');
        $index = (int) ($_POST['index'] ?? -1);
        $total = (int) ($_POST['total'] ?? 0);
        $kind = (string) ($_POST['kind'] ?? '');
        $chunk = $_FILES['chunk'] ?? null;
        if (!preg_match('/^[a-z0-9]{16,40}$/', $id) || !in_array($kind, ['image', 'video'], true) || $total < 1 || $total > 400 || $index < 0 || $index >= $total) fail(422, 'bad_upload');
        if (!$chunk || ($chunk['error'] ?? 1) !== UPLOAD_ERR_OK || $chunk['size'] > CHUNK_MAX) fail(422, 'bad_chunk');
        $part = data_dir() . '/tmp/' . $id . '.part';
        $meta = read_json($part . '.json') ?? ['next' => 0, 'kind' => $kind, 'total' => $total];
        if ($index === 0) {
            // Pieces left behind by uploads abandoned more than a day ago.
            foreach (glob(data_dir() . '/tmp/*.part*') ?: [] as $stale) if (filemtime($stale) < time() - 86400) @unlink($stale);
            $meta = ['next' => 0, 'kind' => $kind, 'total' => $total];
            @unlink($part);
        }
        if ($meta['next'] !== $index || $meta['kind'] !== $kind || $meta['total'] !== $total) fail(409, 'out_of_order', ['expected' => $meta['next']]);
        $in = fopen($chunk['tmp_name'], 'rb');
        $out = fopen($part, 'ab');
        stream_copy_to_stream($in, $out);
        fclose($in);
        fclose($out);
        clearstatcache(true, $part);
        if (filesize($part) > ($kind === 'image' ? IMAGE_MAX : VIDEO_MAX)) {
            @unlink($part);
            @unlink($part . '.json');
            fail(413, 'too_large');
        }
        $meta['next'] = $index + 1;
        if ($meta['next'] < $total) {
            write_atomic($part . '.json', json_encode($meta));
            respond(200, ['ok' => true, 'next' => $meta['next']]);
        }
        // Last piece: check what the file really is (not what its name says), then file it under a random name.
        @unlink($part . '.json');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($part) ?: '';
        $types = $kind === 'image' ? ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'] : ['video/mp4' => 'mp4', 'application/mp4' => 'mp4'];
        if (!isset($types[$mime])) {
            @unlink($part);
            fail(415, 'bad_type', ['type' => $mime]);
        }
        $info = ['width' => 0, 'height' => 0];
        if ($kind === 'image') {
            $size = @getimagesize($part);
            if (!$size) {
                @unlink($part);
                fail(415, 'bad_type');
            }
            $info = ['width' => $size[0], 'height' => $size[1]];
        }
        $sub = gmdate('Y/m');
        $dir = library_dir() . '/' . $sub;
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) fail(500, 'library_dir');
        $name = bin2hex(random_bytes(10)) . '.' . $types[$mime];
        if (!rename($part, $dir . '/' . $name)) fail(500, 'write_failed');
        @chmod($dir . '/' . $name, 0644);
        respond(200, ['ok' => true, 'done' => true, 'path' => '/media/library/' . $sub . '/' . $name] + $info);

    case 'status':
        method('GET');
        require_user();
        $content = load_content();
        $state = state();
        $run = null;
        $runs = github('GET', '/actions/workflows/deploy.yml/runs?per_page=1');
        if ($runs['status'] === 200 && !empty($runs['body']['workflow_runs'][0])) {
            $r = $runs['body']['workflow_runs'][0];
            $run = ['status' => $r['status'], 'conclusion' => $r['conclusion'], 'startedAt' => $r['run_started_at'] ?? $r['created_at'], 'url' => $r['html_url']];
        }
        respond(200, [
            'ok' => true,
            'revision' => $content['revision'] ?? 0,
            'publishedRevision' => $state['publishedRevision'] ?? 0,
            'publishedAt' => $state['publishedAt'] ?? null,
            'canPublish' => cfg('github_token') !== '' && cfg('github_repo') !== '',
            'run' => $run,
        ]);

    case 'publish':
        method('POST');
        require_csrf();
        require_user();
        $content = load_content();
        $res = github('POST', '/dispatches', ['event_type' => 'cms-publish', 'client_payload' => ['revision' => $content['revision'] ?? 0]]);
        if ($res['status'] === 0) fail(503, 'publish_not_configured');
        if ($res['status'] !== 204) fail(502, 'github', ['status' => $res['status']]);
        save_state(['publishedRevision' => $content['revision'] ?? 0, 'publishedAt' => gmdate('c'), 'publishedBy' => $_SESSION['user']] + state());
        respond(200, ['ok' => true]);

    default:
        fail(404, 'unknown_action');
}
