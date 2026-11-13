<?php
// Router for `php -S` in `npm run admin:local`: serves dist/, except /media/library/ (the dashboard uploads),
// which is read from MN_LIBRARY_DIR so new uploads show at once, without a rebuild.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
$library = getenv('MN_LIBRARY_DIR');
if ($library && str_starts_with($path, '/media/library/') && !str_contains($path, '..')) {
    $file = $library . substr($path, strlen('/media/library'));
    if (is_file($file)) {
        $types = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'mp4' => 'video/mp4'];
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!isset($types[$ext])) { http_response_code(403); return true; }
        header('Content-Type: ' . $types[$ext]);
        header('Content-Length: ' . filesize($file));
        readfile($file);
        return true;
    }
    http_response_code(404);
    return true;
}
return false;
