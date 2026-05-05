/**
 * Admin auth guard.
 * Add to every admin page in <head>:
 *   <script src="/admin/admin-auth-guard.js"></script>
 *
 * On load:
 *   1. Hides <body> until auth check completes (no UI flash).
 *   2. Calls /api/admin/auth/me. 401 → redirect to /admin/login?next=<current>.
 *   3. Authed → reveals body and exposes window.adminLogout() for logout buttons.
 */

(function () {
    // Hide body via inline style ASAP. We re-show it after the auth check.
    var styleEl = document.createElement('style');
    styleEl.textContent = 'body { visibility: hidden; }';
    document.documentElement.appendChild(styleEl);

    function showBody() {
        styleEl.parentNode && styleEl.parentNode.removeChild(styleEl);
    }

    function redirectToLogin() {
        var next = window.location.pathname + window.location.search;
        window.location.replace('/admin/login?next=' + encodeURIComponent(next));
    }

    window.adminLogout = async function () {
        try {
            await fetch('/api/admin/auth/logout', { method: 'POST' });
        } catch (e) { /* ignore */ }
        window.location.replace('/admin/login');
    };

    fetch('/api/admin/auth/me', { credentials: 'same-origin' })
        .then(function (res) {
            if (res.ok) {
                showBody();
            } else {
                redirectToLogin();
            }
        })
        .catch(function () {
            // Network error — fail closed.
            redirectToLogin();
        });
})();
