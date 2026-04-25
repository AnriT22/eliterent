/* ========================================
   NAVBAR AUTH — Shows user profile or login
   button based on authentication state.
   Include this script on every page.
   ======================================== */

(function () {
    function t(key, fallback) {
        if (typeof I18n !== 'undefined' && I18n.t) {
            var val = I18n.t(key);
            if (val && val !== key) return val;
        }
        return fallback;
    }

    document.addEventListener('DOMContentLoaded', initNavbarAuth);
    if (document.readyState !== 'loading') initNavbarAuth();

    // Re-render navbar when language changes or i18n becomes ready
    document.addEventListener('languageChanged', function () {
        initialized = false;
        mobileInitialized = false;
        cleanupNavbar();
        initNavbarAuth();
        initMobileNav();
    });
    if (typeof I18n !== 'undefined' && I18n.onReady) {
        I18n.onReady(function () {
            if (initialized) {
                initialized = false;
                mobileInitialized = false;
                cleanupNavbar();
                initNavbarAuth();
                initMobileNav();
            }
        });
    }

    function cleanupNavbar() {
        var oldProfile = document.getElementById('navProfile');
        if (oldProfile) oldProfile.remove();
        var oldLogin = document.querySelector('.nav-login-btn');
        if (oldLogin) oldLogin.remove();
        var oldOverlay = document.getElementById('mobileNavOverlay');
        if (oldOverlay) oldOverlay.remove();
        var oldPanel = document.getElementById('mobileNavPanel');
        if (oldPanel) oldPanel.remove();
        var oldHamburger = document.getElementById('hamburgerBtn');
        if (oldHamburger) oldHamburger.remove();
        document.body.style.overflow = '';
    }

    var initialized = false;
    var mobileInitialized = false;

    function translateDesktopNav() {
        var navLinks = document.querySelectorAll('.nav-menu .nav-link');
        var keyMap = {
            'index.html': 'nav.home',
            'vehicles.html': 'nav.vehicles',
            'reviews.html': 'nav.reviews',
            'about.html': 'nav.about',
            'contact.html': 'nav.contact'
        };
        navLinks.forEach(function (link) {
            var href = (link.getAttribute('href') || '').replace(/^\//, '');
            if (keyMap[href]) {
                link.textContent = t(keyMap[href], link.textContent);
            }
        });
        var partnerBtn = document.querySelector('.header-right .partner-btn');
        if (partnerBtn && partnerBtn.id !== 'mobileLogoutBtn') {
            partnerBtn.textContent = t('nav.become_partner', partnerBtn.textContent);
        }
    }

    function initNavbarAuth() {
        if (initialized) return;
        initialized = true;

        translateDesktopNav();

        var headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        var token = localStorage.getItem('token') || sessionStorage.getItem('token');
        var user = null;
        try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}

        // Find the partner button
        var partnerBtn = headerRight.querySelector('.partner-btn');

        if (token && user) {
            // User is logged in — hide partner btn, show profile
            if (partnerBtn) partnerBtn.style.display = 'none';

            var initials = getInitials(user.full_name || user.email);
            var profileHTML = ''
                + '<div class="nav-profile" id="navProfile">'
                + '  <button class="nav-profile-btn" id="navProfileBtn">'
                + '    <span class="nav-avatar">' + initials + '</span>'
                + '    <span class="nav-username">' + (user.full_name || user.email) + '</span>'
                + '    <svg class="nav-profile-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
                + '  </button>'
                + '  <div class="nav-profile-dropdown" id="navProfileDropdown">'
                + '    <div class="nav-profile-header">'
                + '      <span class="nav-profile-avatar-lg">' + initials + '</span>'
                + '      <div>'
                + '        <div class="nav-profile-name">' + (user.full_name || 'User') + '</div>'
                + '        <div class="nav-profile-email">' + (user.email || '') + '</div>'
                + '        <span class="nav-profile-role">' + (user.role === 'partner' ? t('nav.partner','Partner') : t('nav.guest','Guest')) + '</span>'
                + (user.role === 'partner'
                    ? (user.is_verified
                        ? '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(34,197,94,0.15);color:#22c55e;border-radius:12px;font-size:11px;font-weight:600;margin-top:4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' + t('nav.verified','Verified') + '</span>'
                        : '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(249,115,22,0.15);color:#f97316;border-radius:12px;font-size:11px;font-weight:600;margin-top:4px;">' + t('nav.not_approved','Not Approved Yet') + '</span>')
                    : '')
                + '      </div>'
                + '    </div>'
                + '    <div class="nav-profile-divider"></div>'
                + (user.role === 'partner'
                    ? '<a href="partner-dashboard.html" class="nav-profile-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' + t('nav.dashboard','Dashboard') + '</a>'
                    : '<a href="guest-profile.html" class="nav-profile-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' + t('nav.my_profile','My Profile') + '</a>')
                + '    <a href="guest-profile.html#bookings" class="nav-profile-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + t('nav.my_bookings','My Bookings') + '</a>'
                + '    <a href="guest-profile.html#favorites" class="nav-profile-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' + t('nav.favorites','Favorites') + '</a>'
                + '    <div class="nav-profile-divider"></div>'
                + '    <button class="nav-profile-item nav-profile-logout" id="navLogoutBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' + t('nav.logout','Log Out') + '</button>'
                + '  </div>'
                + '</div>';

            // Insert before partner button or at end
            var wrapper = document.createElement('div');
            wrapper.innerHTML = profileHTML;
            var profileEl = wrapper.firstChild;

            if (partnerBtn) {
                headerRight.insertBefore(profileEl, partnerBtn);
            } else {
                headerRight.appendChild(profileEl);
            }

            // Toggle dropdown
            var profileBtn = document.getElementById('navProfileBtn');
            var dropdown = document.getElementById('navProfileDropdown');

            profileBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });

            document.addEventListener('click', function (e) {
                if (!profileEl.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            // Logout
            document.getElementById('navLogoutBtn').addEventListener('click', function () {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('isLoggedIn');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                window.location.href = 'login.html';
            });

        } else {
            // Not logged in — show login button next to partner btn
            var loginHTML = '<a href="login.html" class="nav-login-btn">' + t('nav.login','Sign In') + '</a>';
            var wrapper2 = document.createElement('div');
            wrapper2.innerHTML = loginHTML;
            if (partnerBtn) {
                headerRight.insertBefore(wrapper2.firstChild, partnerBtn);
            } else {
                headerRight.appendChild(wrapper2.firstChild);
            }
        }
    }

    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    // ── Mobile hamburger menu ──────────────────────────────────────────────
    function initMobileNav() {
        var headerRight = document.querySelector('.header-right');
        if (!headerRight) return;
        // Don't double-inject
        if (document.getElementById('hamburgerBtn')) return;

        // Inject hamburger button into header-right
        var hamburger = document.createElement('button');
        hamburger.id = 'hamburgerBtn';
        hamburger.className = 'hamburger-btn';
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.innerHTML = '<span></span><span></span><span></span>';
        headerRight.appendChild(hamburger);

        // Detect current page for active link
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';

        // Build nav links
        var navPages = [
            { href: 'index.html',    label: t('nav.home','Home') },
            { href: 'vehicles.html', label: t('nav.vehicles','Vehicles') },
            { href: 'reviews.html',  label: t('nav.reviews','Reviews') },
            { href: 'about.html',    label: t('nav.about','About') },
            { href: 'contact.html',  label: t('nav.contact','Contact') }
        ];

        var token = localStorage.getItem('token') || sessionStorage.getItem('token');
        var user = null;
        try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch(e) {}

        var linksHTML = navPages.map(function(p) {
            var active = (currentPage === p.href || (currentPage === '' && p.href === 'index.html')) ? ' active' : '';
            return '<a href="' + p.href + '" class="' + active + '">' + p.label + '</a>';
        }).join('');

        // Add auth links
        if (token && user) {
            var dashLink = user.role === 'partner'
                ? '<a href="partner-dashboard.html">' + t('nav.dashboard','Dashboard') + '</a>'
                : '<a href="guest-profile.html">' + t('nav.my_profile','My Profile') + '</a>';
            linksHTML += dashLink
                + '<a href="guest-profile.html#bookings">' + t('nav.my_bookings','My Bookings') + '</a>'
                + '<a href="guest-profile.html#favorites">' + t('nav.favorites','Favorites') + '</a>';
        } else {
            linksHTML += '<a href="login.html">' + t('nav.login','Sign In') + '</a>'
                + '<a href="register.html">' + t('nav.register','Register') + '</a>';
        }

        // Build mobile nav panel + overlay
        var overlay = document.createElement('div');
        overlay.id = 'mobileNavOverlay';
        overlay.className = 'mobile-nav-overlay';
        overlay.addEventListener('click', closeMobileNav);

        var panel = document.createElement('div');
        panel.id = 'mobileNavPanel';
        panel.className = 'mobile-nav-panel';
        panel.innerHTML = ''
            + '<div class="mobile-nav-header">'
            + '  <a href="/" class="logo">'
            + '    <img src="images/logo.webp" alt="RoyalCar.rent" onerror="this.style.display=\'none\'">'
            + '    <span>RoyalCar.rent</span>'
            + '  </a>'
            + '  <button class="mobile-nav-close" id="mobileNavClose" aria-label="Close menu">&#x2715;</button>'
            + '</div>'
            + '<div class="mobile-nav-links">' + linksHTML + '</div>'
            + '<div class="mobile-nav-footer">'
            + (token && user
                ? '<button class="partner-btn" id="mobileLogoutBtn" style="background:#ef4444;">' + t('nav.logout','Log Out') + '</button>'
                : '<a href="register-partner.html" class="partner-btn">' + t('nav.become_partner','Become a Partner') + '</a>')
            + '</div>';

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        hamburger.addEventListener('click', openMobileNav);
        var closeBtn = document.getElementById('mobileNavClose');
        closeBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); closeMobileNav(); });
        closeBtn.addEventListener('touchend', function(e) { e.preventDefault(); e.stopPropagation(); closeMobileNav(); });

        if (token && user) {
            var logoutBtn = document.getElementById('mobileLogoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function() {
                    localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('isLoggedIn');
                    sessionStorage.removeItem('token'); sessionStorage.removeItem('user');
                    window.location.href = 'login.html';
                });
            }
        }

        // Close on nav link click
        panel.querySelectorAll('.mobile-nav-links a').forEach(function(a) {
            a.addEventListener('click', closeMobileNav);
        });
    }

    function openMobileNav() {
        var overlay = document.getElementById('mobileNavOverlay');
        var panel = document.getElementById('mobileNavPanel');
        var btn = document.getElementById('hamburgerBtn');
        if (overlay) overlay.classList.add('open');
        if (panel) panel.classList.add('open');
        if (btn) btn.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileNav() {
        var overlay = document.getElementById('mobileNavOverlay');
        var panel = document.getElementById('mobileNavPanel');
        var btn = document.getElementById('hamburgerBtn');
        if (overlay) overlay.classList.remove('open');
        if (panel) panel.classList.remove('open');
        if (btn) btn.classList.remove('open');
        document.body.style.overflow = '';
    }

    document.addEventListener('DOMContentLoaded', initMobileNav);
    if (document.readyState !== 'loading') initMobileNav();
})();
