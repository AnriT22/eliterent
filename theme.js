/* ============================================================
   THEME CONTROLLER — light/dark switching for the whole site.

   • Must be included in <head> BEFORE stylesheets render content:
       <script src="theme.js"></script>
     It sets data-theme on <html> synchronously (no FOUC).
   • Priority: saved choice (localStorage) → OS preference → dark.
   • Injects an accessible Sun/Moon toggle into the navbar
     (or a floating button on pages without one).
   • API: Theme.get(), Theme.set('light'|'dark'), Theme.toggle()
   ============================================================ */
(function () {
    var KEY = 'EliteAuto_theme';
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

    function saved() {
        try {
            var v = localStorage.getItem(KEY);
            return (v === 'light' || v === 'dark') ? v : null;
        } catch (e) { return null; }
    }

    function preferred() {
        var s = saved();
        if (s) return s;
        if (mq && mq.matches) return 'light';
        return 'dark';
    }

    function syncMetaThemeColor(theme) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            (document.head || root).appendChild(meta);
        }
        meta.content = theme === 'light' ? '#F6F5F1' : '#0B0C10';
    }

    function apply(theme, animate) {
        if (animate) {
            root.classList.add('theme-switching');
            clearTimeout(apply._t);
            apply._t = setTimeout(function () { root.classList.remove('theme-switching'); }, 320);
        }
        root.setAttribute('data-theme', theme);
        syncMetaThemeColor(theme);
        var btns = document.querySelectorAll('.theme-toggle');
        for (var i = 0; i < btns.length; i++) {
            btns[i].setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
            btns[i].setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
            btns[i].title = theme === 'light' ? 'Dark mode' : 'Light mode';
        }
    }

    // Set the theme immediately — before first paint.
    apply(preferred(), false);

    window.Theme = {
        get: function () { return root.getAttribute('data-theme') || 'dark'; },
        set: function (t) {
            if (t !== 'light' && t !== 'dark') return;
            try { localStorage.setItem(KEY, t); } catch (e) {}
            apply(t, true);
        },
        toggle: function () {
            window.Theme.set(window.Theme.get() === 'light' ? 'dark' : 'light');
        }
    };

    // Follow OS preference live — only while the user hasn't chosen manually.
    if (mq && mq.addEventListener) {
        mq.addEventListener('change', function (e) {
            if (!saved()) apply(e.matches ? 'light' : 'dark', true);
        });
    }

    // Keep multiple open tabs in sync.
    window.addEventListener('storage', function (e) {
        if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
            apply(e.newValue, true);
        }
    });

    /* ---------- toggle button ---------- */
    var SUN = '<svg class="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
    var MOON = '<svg class="tt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

    function makeButton(extraClass) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'theme-toggle' + (extraClass ? ' ' + extraClass : '');
        b.innerHTML = SUN + MOON;
        b.addEventListener('click', function () { window.Theme.toggle(); });
        var t = window.Theme.get();
        b.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
        b.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
        b.title = t === 'light' ? 'Dark mode' : 'Light mode';
        return b;
    }

    function injectToggle() {
        if (document.querySelector('.theme-toggle')) return;

        // 1) Public pages: put it in the navbar right section, before the
        //    currency/language selectors.
        var headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.insertBefore(makeButton(), headerRight.firstChild);
            return;
        }
        // 2) Dashboard / admin: sidebar header.
        var side = document.querySelector('.db-sidebar-header, .admin-sidebar-header');
        if (side) {
            side.appendChild(makeButton());
            return;
        }
        // 3) Fallback: floating button (auth pages, standalone pages).
        document.body.appendChild(makeButton('theme-toggle--floating'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectToggle);
    } else {
        injectToggle();
    }
})();
