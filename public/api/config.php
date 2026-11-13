<?php
// Server settings. Fill these in on the server (hPanel → File Manager → public_html/api/config.php).
// The deploy never overwrites this file, and .htaccess blocks it from the web.
return [
    // ---------- Contact form ----------
    // Where enquiries are delivered. The form reports "not configured" while this is empty.
    'to_email' => '',
    // Sender address on your own domain, for example no-reply@yourdomain.com.
    'from_email' => '',

    // ---------- Dashboard (/admin) ----------
    // The login. Make the hash with:  npm run admin:password
    // (it can then be changed from the dashboard itself, under Account).
    'admin_email' => '',
    'admin_password_hash' => '',

    // Where the dashboard keeps its content and backups. Empty = a folder "mn-data" next to public_html,
    // outside the website, so it can never be downloaded.
    'data_dir' => '',

    // A long random secret shared with GitHub (secret CMS_TOKEN): lets the build read the content.
    // Make one with:  npm run admin:token
    'deploy_token' => '',

    // "Publish" starts the GitHub build. A fine-grained token for this repository with
    // Contents: Read and write, and Actions: Read (to show the build status).
    'github_repo' => 'Rochdi7/mednoukhal-videographer',
    'github_token' => '',
];
