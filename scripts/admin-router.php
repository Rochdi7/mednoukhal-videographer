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
// A folder whose name has a dot (the dashboard, /mnvisual00.rec/): php -S takes ".rec" for a file extension and answers
// 404, so its index.html is served here. Apache on the server serves it as a normal folder.
$docroot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
if (str_ends_with($path, '/') && !str_contains($path, '..') && is_file($docroot . $path . 'index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($docroot . $path . 'index.html');
    return true;
}
return false;
