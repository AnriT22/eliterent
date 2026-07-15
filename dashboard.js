/* ========================================
   PARTNER DASHBOARD — JAVASCRIPT
   ======================================== */

(function () {
    // Auth check
    var token = localStorage.getItem('token') || sessionStorage.getItem('token');
    var user = null;
    try { user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user')); } catch (e) {}

    if (!token || !user || user.role !== 'partner') {
        window.location.href = 'login.html';
        return;
    }

    // Translate-or-fallback: returns the translation if present, else the given
    // English fallback (I18n.t returns the key itself when a key is missing).
    function tOr(key, fallback) {
        return (typeof I18n !== 'undefined' && I18n.t && I18n.t(key) !== key) ? I18n.t(key) : fallback;
    }

    // Set user info in header
    var nameEl = document.getElementById('dbUserName');
    if (nameEl) nameEl.textContent = user.full_name || user.email;

    var companyEl = document.getElementById('dbCompanyName');
    if (companyEl) companyEl.textContent = user.company_name || 'My Company';

    // ========================================
    // VERIFICATION STATUS
    // ========================================
    var isVerified = user.is_verified === 1 || user.is_verified === true;

    function renderVerificationBadge(verified) {
        var statusEl = document.getElementById('dbVerificationStatus');
        if (!statusEl) return;
        if (verified) {
            statusEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(34,197,94,0.15);color:#22c55e;border-radius:20px;font-size:12px;font-weight:600;margin-top:6px;">'
                + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>'
                + '<span data-i18n="partner_dashboard.verified">Verified</span></span>';
        } else {
            statusEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(249,115,22,0.15);color:#f97316;border-radius:20px;font-size:12px;font-weight:600;margin-top:6px;">'
                + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
                + '<span data-i18n="partner_dashboard.not_approved">Not Approved Yet</span></span>';
        }
        // Translate now with whatever language is loaded; the global languageChanged
        // listener re-translates these data-i18n spans if the file loads/changes later.
        if (typeof I18n !== 'undefined' && I18n.translatePage) I18n.translatePage(statusEl);
    }

    // Show restriction banner for unverified partners
    function showRestrictionBanner() {
        if (isVerified) return;
        var banner = document.createElement('div');
        banner.id = 'verificationBanner';
        banner.style.cssText = 'background:linear-gradient(135deg,rgba(249,115,22,0.1),rgba(249,115,22,0.05));border:1px solid rgba(249,115,22,0.3);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px;';
        banner.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
            + '<div><p style="margin:0;color:#f97316;font-weight:600;font-size:14px;">' + (typeof I18n !== 'undefined' ? I18n.t('partner_dashboard.pending_title') : 'Your account is pending verification') + '</p>'
            + '<p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">' + (typeof I18n !== 'undefined' ? I18n.t('partner_dashboard.pending_desc') : 'An admin will review and verify your account. Until verified, you cannot add vehicles or receive bookings. This page updates automatically.') + '</p></div>';
        var dbMain = document.querySelector('.db-main');
        if (dbMain) dbMain.insertBefore(banner, dbMain.firstChild);
    }

    // Fetch fresh verification status from server before showing badge/banner
    // This prevents the flash of "pending" for already-approved partners
    fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.user && data.user.partner_profile) {
            var freshVerified = !!data.user.partner_profile.is_verified;
            if (freshVerified !== isVerified) {
                isVerified = freshVerified;
                user.is_verified = freshVerified ? 1 : 0;
                localStorage.setItem('user', JSON.stringify(user));
            }
        }
        renderVerificationBadge(isVerified);
        showRestrictionBanner();
    })
    .catch(function() {
        renderVerificationBadge(isVerified);
        showRestrictionBanner();
    });

    // Show phone verification reminder for partners who skipped it
    function showPhoneVerifyBanner() {
        // Check from /api/me if phone is not verified
        fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.user) return;
            var u = data.user;
            // If phone is already verified, no banner needed
            if (u.phone_verified === 1 || u.phone_verified === true) return;
            // Don't show if phone verify banner already exists
            if (document.getElementById('phoneVerifyBanner')) return;

            var banner = document.createElement('div');
            banner.id = 'phoneVerifyBanner';
            banner.style.cssText = 'background:linear-gradient(135deg,rgba(201,168,76,0.1),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;gap:12px;';
            banner.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" style="flex-shrink:0;"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>'
                + '<div style="flex:1;"><p style="margin:0;color:#C9A84C;font-weight:600;font-size:14px;">Phone verification required</p>'
                + '<p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Verify your phone number so customers and our team can reach you about bookings.</p></div>'
                + '<button id="phoneVerifyBtn" style="flex-shrink:0;padding:8px 20px;background:#C9A84C;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;">Verify Now</button>';

            var dbMain = document.querySelector('.db-main');
            if (dbMain) {
                var existingBanner = document.getElementById('verificationBanner');
                if (existingBanner) {
                    existingBanner.insertAdjacentElement('afterend', banner);
                } else {
                    dbMain.insertBefore(banner, dbMain.firstChild);
                }
            }

            document.getElementById('phoneVerifyBtn').addEventListener('click', function() {
                showPhoneVerifyModal(u.phone || '');
            });
        })
        .catch(function() {});
    }
    showPhoneVerifyBanner();

    // Phone verification modal
    function showPhoneVerifyModal(existingPhone) {
        var overlay = document.createElement('div');
        overlay.id = 'phoneVerifyOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:20px;padding:32px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
        modal.innerHTML = ''
            + '<div style="text-align:center;margin-bottom:20px;">'
            + '<div style="width:56px;height:56px;background:rgba(201,168,76,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">'
            + '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>'
            + '</div>'
            + '<h3 style="margin:0 0 4px;font-size:18px;color:#1e293b;">Verify Your Phone</h3>'
            + '<p style="margin:0;color:#A0A3B0;font-size:13px;">Enter your phone number to receive a verification code</p>'
            + '</div>'
            // Step 1: Phone input
            + '<div id="pvStep1">'
            + '<label style="display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:4px;">Phone Number</label>'
            + '<input type="tel" id="pvPhoneInput" value="' + (existingPhone || '') + '" placeholder="+995 5XX XXX XXX" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:4px;">'
            + '<p style="margin:0 0 12px;color:#94a3b8;font-size:11px;">International format with country code</p>'
            + '<div id="pvPhoneErr" style="color:#ef4444;font-size:12px;font-weight:600;margin-bottom:8px;display:none;"></div>'
            + '<button id="pvSendBtn" style="width:100%;padding:10px;background:#C9A84C;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">Send Code</button>'
            + '</div>'
            // Step 2: OTP input
            + '<div id="pvStep2" style="display:none;">'
            + '<p id="pvSentMsg" style="color:#A0A3B0;font-size:13px;text-align:center;margin-bottom:12px;"></p>'
            + '<div id="pvOtpRow" style="display:flex;gap:6px;justify-content:center;margin-bottom:12px;">'
            + '<input type="text" class="pv-otp" maxlength="1" inputmode="numeric" style="width:42px;height:48px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;font-weight:700;">'
            + '<input type="text" class="pv-otp" maxlength="1" inputmode="numeric" style="width:42px;height:48px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;font-weight:700;">'
            + '<input type="text" class="pv-otp" maxlength="1" inputmode="numeric" style="width:42px;height:48px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;font-weight:700;">'
            + '<input type="text" class="pv-otp" maxlength="1" inputmode="numeric" style="width:42px;height:48px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;font-weight:700;">'
            + '<input type="text" class="pv-otp" maxlength="1" inputmode="numeric" style="width:42px;height:48px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;font-weight:700;">'
            + '<input type="text" class="pv-otp" maxlength="1" inputmode="numeric" style="width:42px;height:48px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;font-weight:700;">'
            + '</div>'
            + '<div id="pvOtpErr" style="color:#ef4444;font-size:12px;font-weight:600;text-align:center;margin-bottom:8px;display:none;"></div>'
            + '<div id="pvOtpSuccess" style="color:#16a34a;font-size:12px;font-weight:600;text-align:center;margin-bottom:8px;display:none;"></div>'
            + '<button id="pvVerifyBtn" style="width:100%;padding:10px;background:#C9A84C;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;margin-bottom:8px;">Verify</button>'
            + '<div style="text-align:center;"><span id="pvResendLink" style="color:#C9A84C;font-size:12px;cursor:pointer;text-decoration:underline;">Resend code</span>'
            + ' &middot; <span id="pvChangePhone" style="color:#A0A3B0;font-size:12px;cursor:pointer;text-decoration:underline;">Change number</span></div>'
            + '</div>'
            // Cancel
            + '<button id="pvCloseBtn" style="width:100%;padding:8px;background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;margin-top:12px;">Cancel</button>';

        overlay.appendChild(modal);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);

        // Close button
        document.getElementById('pvCloseBtn').addEventListener('click', function() { overlay.remove(); });

        // Send code
        document.getElementById('pvSendBtn').addEventListener('click', function() { pvSendCode(); });
        document.getElementById('pvPhoneInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') pvSendCode(); });

        function pvSendCode() {
            var phone = document.getElementById('pvPhoneInput').value.trim();
            var errEl = document.getElementById('pvPhoneErr');
            errEl.style.display = 'none';
            if (!phone || phone.length < 8) {
                errEl.textContent = 'Please enter a valid phone number';
                errEl.style.display = 'block';
                return;
            }
            var btn = document.getElementById('pvSendBtn');
            btn.disabled = true;
            btn.textContent = 'Sending...';
            fetch('/api/otp/phone-verify/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ phone: phone })
            })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(result) {
                btn.disabled = false;
                btn.textContent = 'Send Code';
                if (!result.ok) {
                    errEl.textContent = result.data.error || 'Failed to send code';
                    errEl.style.display = 'block';
                    return;
                }
                document.getElementById('pvStep1').style.display = 'none';
                document.getElementById('pvStep2').style.display = 'block';
                document.getElementById('pvSentMsg').textContent = result.data.message || 'Code sent';
                var otpInputs = overlay.querySelectorAll('.pv-otp');
                if (otpInputs.length) otpInputs[0].focus();
            })
            .catch(function() {
                btn.disabled = false;
                btn.textContent = 'Send Code';
                errEl.textContent = 'Network error';
                errEl.style.display = 'block';
            });
        }

        // OTP input auto-advance
        setTimeout(function() {
            var otpInputs = overlay.querySelectorAll('.pv-otp');
            otpInputs.forEach(function(inp, i) {
                inp.addEventListener('input', function() {
                    this.value = this.value.replace(/[^0-9]/g, '');
                    if (this.value && i < otpInputs.length - 1) otpInputs[i + 1].focus();
                    if (i === otpInputs.length - 1 && this.value) {
                        var allFilled = true;
                        otpInputs.forEach(function(o) { if (!o.value) allFilled = false; });
                        if (allFilled) pvVerifyCode();
                    }
                });
                inp.addEventListener('keydown', function(e) {
                    if (e.key === 'Backspace' && !this.value && i > 0) {
                        otpInputs[i - 1].focus();
                        otpInputs[i - 1].value = '';
                    }
                });
                inp.addEventListener('paste', function(e) {
                    e.preventDefault();
                    var pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
                    if (pasted.length >= 6) {
                        for (var j = 0; j < 6; j++) otpInputs[j].value = pasted[j] || '';
                        otpInputs[5].focus();
                        pvVerifyCode();
                    }
                });
            });
        }, 100);

        // Verify code
        document.getElementById('pvVerifyBtn').addEventListener('click', pvVerifyCode);

        function pvVerifyCode() {
            var otpInputs = overlay.querySelectorAll('.pv-otp');
            var code = '';
            otpInputs.forEach(function(inp) { code += inp.value; });
            var errEl = document.getElementById('pvOtpErr');
            var successEl = document.getElementById('pvOtpSuccess');
            errEl.style.display = 'none';
            successEl.style.display = 'none';
            if (code.length !== 6) {
                errEl.textContent = 'Please enter all 6 digits';
                errEl.style.display = 'block';
                return;
            }
            var btn = document.getElementById('pvVerifyBtn');
            btn.disabled = true;
            btn.textContent = 'Verifying...';
            fetch('/api/otp/phone-verify/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ code: code })
            })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(result) {
                btn.disabled = false;
                btn.textContent = 'Verify';
                if (!result.ok) {
                    errEl.textContent = result.data.error || 'Invalid code';
                    errEl.style.display = 'block';
                    return;
                }
                successEl.textContent = 'Phone verified successfully!';
                successEl.style.display = 'block';
                btn.style.display = 'none';
                // Remove the phone verify banner
                var pvBanner = document.getElementById('phoneVerifyBanner');
                if (pvBanner) pvBanner.remove();
                // Close modal after 1.5s
                setTimeout(function() { overlay.remove(); }, 1500);
            })
            .catch(function() {
                btn.disabled = false;
                btn.textContent = 'Verify';
                errEl.textContent = 'Network error';
                errEl.style.display = 'block';
            });
        }

        // Resend
        document.getElementById('pvResendLink').addEventListener('click', function() {
            pvSendCode();
        });

        // Change phone number
        document.getElementById('pvChangePhone').addEventListener('click', function() {
            document.getElementById('pvStep2').style.display = 'none';
            document.getElementById('pvStep1').style.display = 'block';
        });
    }

    // Poll for verification status change (every 5s) if not yet verified
    var pollInterval = null;
    function startVerificationPoll() {
        if (isVerified || pollInterval) return;
        pollInterval = setInterval(function () {
            fetch('/api/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data.user && data.user.partner_profile && data.user.partner_profile.is_verified) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    isVerified = true;
                    // Update stored user
                    user.is_verified = 1;
                    localStorage.setItem('user', JSON.stringify(user));
                    // Update UI
                    renderVerificationBadge(true);
                    // Remove restriction banner
                    var banner = document.getElementById('verificationBanner');
                    if (banner) banner.remove();
                    // Show congratulations popup
                    showVerifiedPopup();
                }
            })
            .catch(function () {});
        }, 5000);
    }
    startVerificationPoll();

    function showVerifiedPopup() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
        var popup = document.createElement('div');
        popup.style.cssText = 'background:#fff;border-radius:20px;padding:40px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:fadeInUp 0.3s ease;';
        popup.innerHTML = '<div style="width:64px;height:64px;background:rgba(34,197,94,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">'
            + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg></div>'
            + '<h3 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Account Verified!</h3>'
            + '<p style="margin:0 0 20px;color:#A0A3B0;font-size:14px;">Congratulations! Your partner account has been verified. You can now add vehicles and receive bookings.</p>'
            + '<button onclick="this.closest(\'div[style]\').parentElement.remove();" style="padding:10px 32px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;">Got it!</button>';
        overlay.appendChild(popup);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    // Logout (handled by navbar-auth.js, but keep fallback if element exists)
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }

    // ========================================
    // TAB NAVIGATION
    // ========================================
    var navItems = document.querySelectorAll('.db-nav-item');
    var tabs = document.querySelectorAll('.db-tab');

    function switchTab(tabName) {
        // Block add-vehicle tab if not verified
        if (tabName === 'add-vehicle' && !isVerified) {
            showNotVerifiedAlert();
            return;
        }
        navItems.forEach(function (n) { n.classList.remove('active'); });
        tabs.forEach(function (t) { t.classList.remove('active'); });

        var activeNav = document.querySelector('.db-nav-item[data-tab="' + tabName + '"]');
        var activeTab = document.getElementById('tab-' + tabName);
        if (activeNav) activeNav.classList.add('active');
        if (activeTab) activeTab.classList.add('active');
    }

    function showNotVerifiedAlert() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
        var popup = document.createElement('div');
        popup.style.cssText = 'background:#fff;border-radius:20px;padding:40px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);';
        popup.innerHTML = '<div style="width:64px;height:64px;background:rgba(249,115,22,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">'
            + '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>'
            + '<h3 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Account Not Verified</h3>'
            + '<p style="margin:0 0 20px;color:#A0A3B0;font-size:14px;">You cannot add vehicles until your account is verified by an admin. This page updates automatically once approved.</p>'
            + '<button onclick="this.closest(\'div[style]\').parentElement.remove();" style="padding:10px 32px;background:#f97316;color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;">OK, I understand</button>';
        overlay.appendChild(popup);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    navItems.forEach(function (item) {
        item.addEventListener('click', function (e) {
            if (!this.dataset.tab) return;
            e.preventDefault();
            switchTab(this.dataset.tab);
        });
    });

    // Quick links to add vehicle tab
    var addFromList = document.getElementById('addVehicleFromList');
    var addFirst = document.getElementById('addFirstVehicle');
    if (addFromList) addFromList.addEventListener('click', function () {
        if (!isVerified) { showNotVerifiedAlert(); return; }
        resetVehicleForm(); switchTab('add-vehicle');
    });
    if (addFirst) addFirst.addEventListener('click', function () {
        if (!isVerified) { showNotVerifiedAlert(); return; }
        resetVehicleForm(); switchTab('add-vehicle');
    });

    // Cancel button on form (if present)
    var cancelBtn = document.getElementById('cancelVehicleForm');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            resetVehicleForm();
            switchTab('vehicles');
        });
    }

    // Toggle handlers for form sections
    var mileageToggle = document.getElementById('vMileageLimitEnabled');
    if (mileageToggle) {
        mileageToggle.addEventListener('change', function () {
            var km = document.getElementById('vMileageKm');
            if (km) { km.disabled = !this.checked; if (!this.checked) km.value = ''; }
        });
    }

    var pickupToggle = document.getElementById('vPickupFeesEnabled');
    if (pickupToggle) {
        pickupToggle.addEventListener('change', function () {
            var c = document.getElementById('pickupFeesContainer');
            if (c) c.classList.toggle('vf-hidden', !this.checked);
        });
    }

    // Mountain destination toggles
    var svanetiToggle = document.getElementById('vSvanetiAccepted');
    if (svanetiToggle) {
        svanetiToggle.addEventListener('change', function () {
            var p = document.getElementById('vSvanetiPrice');
            if (p) { p.disabled = !this.checked; if (!this.checked) p.value = ''; }
        });
    }
    var shatiliToggle = document.getElementById('vShatiliAccepted');
    if (shatiliToggle) {
        shatiliToggle.addEventListener('change', function () {
            var p = document.getElementById('vShatiliPrice');
            if (p) { p.disabled = !this.checked; if (!this.checked) p.value = ''; }
        });
    }

    var customPricingToggle = document.getElementById('vCustomPricingEnabled');
    if (customPricingToggle) {
        customPricingToggle.addEventListener('change', function () {
            var c = document.getElementById('customPricingContainer');
            if (c) c.classList.toggle('vf-hidden', !this.checked);
        });
    }

    // Custom Date-Based Pricing — Add Date Range
    var addCustomPricingBtn = document.getElementById('addCustomPricing');
    if (addCustomPricingBtn) {
        addCustomPricingBtn.addEventListener('click', function () {
            var list = document.getElementById('customPricingList');
            if (!list) return;
            var idx = list.querySelectorAll('.custom-pricing-row').length;
            var row = document.createElement('div');
            row.className = 'custom-pricing-row';
            row.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap;';
            row.innerHTML = '<input type="date" class="db-input cp-start" style="flex:1;min-width:120px;" placeholder="Start date">'
                + '<input type="date" class="db-input cp-end" style="flex:1;min-width:120px;" placeholder="End date">'
                + '<input type="number" class="db-input cp-price" style="flex:1;min-width:100px;" placeholder="$/day" min="0" step="0.01">'
                + '<button type="button" class="btn btn-secondary btn-small cp-remove" style="padding:4px 10px;color:#ef4444;">✕</button>';
            row.querySelector('.cp-remove').addEventListener('click', function () { row.remove(); });
            list.appendChild(row);
        });
    }

    // ========================================
    // BRAND SEARCH DROPDOWN
    // ========================================
    var BRAND_LIST = [
        'Acura','Aston Martin','Audi','Bentley','BMW','BYD','Cadillac','Chery','Chevrolet',
        'Chrysler','Citroen','Dacia','Daewoo','Dodge','Ferrari','Fiat','Ford','Geely','Genesis',
        'Haval','Honda','Hyundai','Infiniti','Jaguar','Jeep','Kia','Lamborghini','Land Rover',
        'Lexus','Lincoln','Lucid','Maserati','Mazda','McLaren','Mercedes-Benz','MG','Mitsubishi',
        'NIO','Nissan','Opel','Peugeot','Polestar','Porsche','Renault','Rivian','Rolls-Royce',
        'SEAT','Skoda','Subaru','Suzuki','Tesla','Toyota','Volkswagen','Volvo','Other'
    ];

    (function initBrandSearch() {
        var wrapper = document.getElementById('brandSearchWrapper');
        var input = document.getElementById('brandSearchInput');
        var dropdown = document.getElementById('brandDropdown');
        var list = document.getElementById('brandDropdownList');
        var hidden = document.getElementById('vBrand');
        if (!wrapper || !input || !dropdown || !list || !hidden) return;

        var selectedBrand = '';

        function renderList(filter) {
            var q = (filter || '').toLowerCase();
            var filtered = BRAND_LIST.filter(function(b) {
                return !q || b.toLowerCase().indexOf(q) !== -1;
            });
            if (filtered.length === 0) {
                list.innerHTML = '<div class="brand-dropdown-empty">No brands found</div>';
                return;
            }
            var html = '';
            filtered.forEach(function(brand) {
                var isSelected = brand === selectedBrand;
                var letter = brand.charAt(0).toUpperCase();
                html += '<div class="brand-dropdown-item' + (isSelected ? ' selected' : '') + '" data-brand="' + brand + '">'
                    + '<span class="brand-letter">' + letter + '</span>'
                    + '<span>' + highlightMatch(brand, q) + '</span>'
                    + '</div>';
            });
            list.innerHTML = html;
        }

        function highlightMatch(text, query) {
            if (!query) return text;
            var idx = text.toLowerCase().indexOf(query);
            if (idx === -1) return text;
            return text.slice(0, idx) + '<strong style="color:#C9A84C;">' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
        }

        function openDropdown() {
            wrapper.classList.add('open');
            renderList(input.value);
        }

        function closeDropdown() {
            wrapper.classList.remove('open');
        }

        function selectBrand(brand) {
            selectedBrand = brand;
            hidden.value = brand;
            input.value = brand;
            wrapper.querySelector('.brand-search-input').classList.add('has-value');
            wrapper.classList.remove('vf-invalid');
            closeDropdown();
        }

        input.addEventListener('focus', function() {
            openDropdown();
            if (selectedBrand && input.value === selectedBrand) {
                input.select();
            }
        });

        input.addEventListener('input', function() {
            openDropdown();
            renderList(input.value);
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeDropdown();
                input.blur();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                var first = list.querySelector('.brand-dropdown-item');
                if (first) selectBrand(first.getAttribute('data-brand'));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                var items = list.querySelectorAll('.brand-dropdown-item');
                if (items.length > 0) items[0].focus();
            }
        });

        list.addEventListener('click', function(e) {
            var item = e.target.closest('.brand-dropdown-item');
            if (item) selectBrand(item.getAttribute('data-brand'));
        });

        // Close on click outside
        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) closeDropdown();
        });

        // Expose setter for edit mode
        window._setBrandValue = function(val) {
            if (val) {
                selectedBrand = val;
                hidden.value = val;
                input.value = val;
                wrapper.querySelector('.brand-search-input').classList.add('has-value');
            }
        };

        // Initial render
        renderList('');
    })();

    // ========================================
    // WIZARD STEP NAVIGATION
    // ========================================
    var currentWizardStep = 1;

    function goToWizardStep(step) {
        step = parseInt(step);
        if (step < 1 || step > 5) return;
        currentWizardStep = step;

        // Update panels
        document.querySelectorAll('.wz-panel').forEach(function (p) {
            p.classList.remove('active');
        });
        var target = document.querySelector('.wz-panel[data-panel="' + step + '"]');
        if (target) target.classList.add('active');

        // Update progress steps
        document.querySelectorAll('.wz-step').forEach(function (s) {
            var sn = parseInt(s.getAttribute('data-step'));
            s.classList.remove('active', 'completed');
            if (sn === step) s.classList.add('active');
            else if (sn < step) s.classList.add('completed');
        });

        // Update connector lines
        var lines = document.querySelectorAll('.wz-line');
        lines.forEach(function (line, i) {
            if (i < step - 1) line.classList.add('done');
            else line.classList.remove('done');
        });

        // Scroll to top of form
        var formTop = document.getElementById('tab-add-vehicle');
        if (formTop) formTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Per-step required fields validation
    // Step order (Location moved to step 1): 1 Location, 2 Car Details,
    // 3 Features, 4 Pricing, 5 Photos.
    var stepRequiredFields = {
        1: [
            { id: 'vCountry', label: 'Country' },
            { id: 'vLocationCity', label: 'Pickup City' }
        ],
        2: [
            { id: 'vName', label: 'Vehicle Name' },
            { id: 'vBrand', label: 'Brand' },
            { id: 'vModel', label: 'Model' },
            { id: 'vYear', label: 'Year' },
            { id: 'vCategory', label: 'Category' },
            { id: 'vColor', label: 'Color' },
            { id: 'vEngine', label: 'Engine Type' },
            { id: 'vGearbox', label: 'Gearbox' },
            { id: 'vDriveType', label: 'Drive Type' },
            { id: 'vLuggage', label: 'Luggage Capacity' }
        ],
        3: [], // checkboxes — all optional
        4: [
            { id: 'vPrice', label: 'Daily Price' }
        ],
        5: [] // validated at submit (photos + passport + reg number)
    };

    function validateWizardStep(step) {
        var fields = stepRequiredFields[step] || [];
        var firstInvalid = null;

        // Clear previous highlights
        document.querySelectorAll('.db-input.vf-invalid').forEach(function (el) {
            el.classList.remove('vf-invalid');
        });
        document.querySelectorAll('.color-swatches.vf-invalid').forEach(function (el) {
            el.classList.remove('vf-invalid');
        });
        document.querySelectorAll('.brand-search-wrapper.vf-invalid').forEach(function (el) {
            el.classList.remove('vf-invalid');
        });

        for (var i = 0; i < fields.length; i++) {
            var f = fields[i];
            var el = document.getElementById(f.id);
            if (!el) continue;
            var val = el.value ? el.value.trim() : '';
            if (!val) {
                if (f.id === 'vColor') {
                    // Color swatch — highlight the swatch container
                    var swatches = document.getElementById('colorSwatches');
                    if (swatches) swatches.classList.add('vf-invalid');
                    if (!firstInvalid) firstInvalid = swatches;
                } else if (f.id === 'vBrand') {
                    // Brand search wrapper — highlight the wrapper
                    var brandWrapper = document.getElementById('brandSearchWrapper');
                    if (brandWrapper) brandWrapper.classList.add('vf-invalid');
                    if (!firstInvalid) firstInvalid = document.getElementById('brandSearchInput');
                } else {
                    el.classList.add('vf-invalid');
                    if (!firstInvalid) firstInvalid = el;
                }
            }
        }

        if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (firstInvalid.focus) firstInvalid.focus();
            showFormMessage('Please fill in all required fields', 'error');
            return false;
        }
        return true;
    }

    // Remove error highlight when user fills the field
    document.querySelectorAll('.db-input').forEach(function (inp) {
        inp.addEventListener('input', function () {
            this.classList.remove('vf-invalid');
        });
        inp.addEventListener('change', function () {
            this.classList.remove('vf-invalid');
        });
    });

    // Next / Prev buttons
    document.querySelectorAll('.wz-btn-next').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (validateWizardStep(currentWizardStep)) {
                goToWizardStep(this.getAttribute('data-next'));
            }
        });
    });
    document.querySelectorAll('.wz-btn-prev').forEach(function (btn) {
        btn.addEventListener('click', function () { goToWizardStep(this.getAttribute('data-prev')); });
    });

    // Click wizard step indicators
    document.querySelectorAll('.wz-step').forEach(function (s) {
        s.addEventListener('click', function () {
            var target = parseInt(this.getAttribute('data-step'));
            // Allow going backward freely, validate going forward
            if (target > currentWizardStep) {
                for (var st = currentWizardStep; st < target; st++) {
                    var fields = stepRequiredFields[st] || [];
                    if (fields.length === 0) continue; // skip optional steps
                    // Navigate to the step first so user sees the fields
                    goToWizardStep(st);
                    if (!validateWizardStep(st)) return;
                }
            }
            goToWizardStep(target);
        });
    });

    // ========================================
    // COLOR SWATCHES
    // ========================================
    var colorInput = document.getElementById('vColor');
    var colorLabel = document.getElementById('colorSelectedLabel');

    document.querySelectorAll('.color-swatch').forEach(function (swatch) {
        swatch.addEventListener('click', function () {
            document.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('selected'); });
            swatch.classList.add('selected');
            var c = swatch.getAttribute('data-color');
            if (colorInput) colorInput.value = c;
            if (colorLabel) colorLabel.textContent = c;
            var swatchContainer = document.getElementById('colorSwatches');
            if (swatchContainer) swatchContainer.classList.remove('vf-invalid');
        });
    });

    // ========================================
    // ENGINE LITERS → CC SYNC
    // ========================================
    var engineLitersInput = document.getElementById('vEngineLiters');
    var engineCCInput = document.getElementById('vEngineCC');

    if (engineLitersInput && engineCCInput) {
        engineLitersInput.addEventListener('input', function () {
            var liters = parseFloat(this.value);
            engineCCInput.value = liters ? Math.round(liters * 1000) : '';
        });
    }

    // ========================================
    // IMAGE UPLOAD
    // ========================================
    var uploadArea = document.getElementById('uploadArea');
    var uploadInput = document.getElementById('vImageFiles');
    var uploadPreview = document.getElementById('uploadPreview');
    var uploadPlaceholder = document.getElementById('uploadPlaceholder');
    var uploadedUrls = []; // stores uploaded image URLs

    if (uploadArea) {
        uploadArea.addEventListener('click', function (e) {
            if (e.target.closest('.db-thumb-remove') || e.target.closest('.db-thumb-main')) return;
            uploadInput.click();
        });

        uploadArea.addEventListener('dragover', function (e) {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', function () {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', function (e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleImageFiles(e.dataTransfer.files);
            }
        });

        uploadInput.addEventListener('change', function () {
            if (this.files.length > 0) {
                handleImageFiles(this.files);
            }
            // Reset value so re-selecting the same file triggers change again
            this.value = '';
        });
    }

    var uploadBatchCounter = 0;
    var isUploading = false;

    function handleImageFiles(files) {
        var remaining = 10 - uploadedUrls.length;
        if (remaining <= 0) {
            showFormMessage('Maximum 10 images allowed', 'error');
            return;
        }
        if (isUploading) {
            showFormMessage('Please wait for current upload to finish', 'error');
            return;
        }

        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        var validFiles = [];
        Array.from(files).forEach(function (file) {
            if (validFiles.length >= remaining) return;
            if (!allowedTypes.includes(file.type)) {
                showFormMessage(file.name + ' — invalid format. Allowed: JPG, PNG, WEBP', 'error');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                showFormMessage(file.name + ' is too large (max 20MB)', 'error');
                return;
            }
            validFiles.push(file);
        });

        if (validFiles.length === 0) return;

        isUploading = true;
        var batchId = '__uploading_' + (++uploadBatchCounter) + '__';

        // Add placeholders for all files being uploaded
        var placeholderStart = uploadedUrls.length;
        var placeholderIds = [];
        validFiles.forEach(function (_, i) {
            var pid = batchId + i;
            placeholderIds.push(pid);
            uploadedUrls.push(pid);
        });
        renderUploadPreviews();

        // Show local previews immediately
        validFiles.forEach(function (file, i) {
            var reader = new FileReader();
            reader.onload = function (ev) {
                var idx = placeholderStart + i;
                var existing = uploadPreview.querySelector('[data-idx="' + idx + '"] img');
                if (existing) existing.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Progress bar elements
        var progressWrap = document.getElementById('uploadProgressWrap');
        var progressFill = document.getElementById('uploadProgressFill');
        var progressText = document.getElementById('uploadProgressText');

        if (progressWrap) {
            progressWrap.style.display = 'flex';
            progressFill.style.width = '0%';
            progressText.textContent = 'Uploading 1/' + validFiles.length + '...';
        }

        // Upload one image at a time (more reliable than batch)
        var uploaded = 0;
        var failed = 0;

        function uploadSingleFile(fileIndex) {
            if (fileIndex >= validFiles.length) {
                // All done
                isUploading = false;
                if (progressWrap) progressWrap.style.display = 'none';
                // Clean up any remaining placeholders (failed uploads)
                uploadedUrls = uploadedUrls.filter(function (u) {
                    return typeof u !== 'string' || u.indexOf(batchId) !== 0;
                });
                renderUploadPreviews();
                syncImageFields();
                if (uploaded > 0 && failed === 0) {
                    showFormMessage(uploaded + ' image(s) uploaded successfully', 'success');
                } else if (uploaded > 0 && failed > 0) {
                    showFormMessage(uploaded + ' uploaded, ' + failed + ' failed', 'error');
                } else {
                    showFormMessage('All uploads failed — please try again', 'error');
                }
                return;
            }

            var file = validFiles[fileIndex];
            var pid = placeholderIds[fileIndex];

            if (progressText) {
                progressText.textContent = 'Uploading ' + (fileIndex + 1) + '/' + validFiles.length + '...';
            }
            if (progressFill) {
                progressFill.style.width = Math.round((fileIndex / validFiles.length) * 100) + '%';
            }

            var formData = new FormData();
            formData.append('image', file);

            uploadWithRetry(formData, pid, fileIndex, 0, function () {
                uploadSingleFile(fileIndex + 1);
            });
        }

        function uploadWithRetry(formData, pid, fileIndex, attempt, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload/vehicle-image');
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            xhr.timeout = 60000; // 60s per image

            xhr.upload.addEventListener('progress', function (e) {
                if (e.lengthComputable && progressFill) {
                    var filePortion = 1 / validFiles.length;
                    var basePct = (fileIndex / validFiles.length) * 100;
                    var filePct = (e.loaded / e.total) * filePortion * 100;
                    progressFill.style.width = Math.round(basePct + filePct) + '%';
                    if (e.loaded >= e.total && progressText) {
                        progressText.textContent = 'Processing ' + (fileIndex + 1) + '/' + validFiles.length + '...';
                    }
                }
            });

            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data.url) {
                            // Replace placeholder with real URL
                            var idx = uploadedUrls.indexOf(pid);
                            if (idx !== -1) uploadedUrls[idx] = data.url;
                            uploaded++;
                            renderUploadPreviews();
                            syncImageFields();
                            callback();
                            return;
                        }
                    } catch (e) {}
                }
                // Failed — retry once
                if (attempt < 1) {
                    console.warn('[Upload] Retrying image ' + (fileIndex + 1) + '...');
                    if (progressText) progressText.textContent = 'Retrying ' + (fileIndex + 1) + '/' + validFiles.length + '...';
                    setTimeout(function () {
                        uploadWithRetry(formData, pid, fileIndex, attempt + 1, callback);
                    }, 1000);
                } else {
                    failed++;
                    // Remove failed placeholder
                    var idx = uploadedUrls.indexOf(pid);
                    if (idx !== -1) uploadedUrls.splice(idx, 1);
                    renderUploadPreviews();
                    callback();
                }
            };

            xhr.onerror = function () {
                if (attempt < 1) {
                    setTimeout(function () {
                        uploadWithRetry(formData, pid, fileIndex, attempt + 1, callback);
                    }, 1500);
                } else {
                    failed++;
                    var idx = uploadedUrls.indexOf(pid);
                    if (idx !== -1) uploadedUrls.splice(idx, 1);
                    renderUploadPreviews();
                    callback();
                }
            };

            xhr.ontimeout = function () {
                if (attempt < 1) {
                    setTimeout(function () {
                        uploadWithRetry(formData, pid, fileIndex, attempt + 1, callback);
                    }, 1000);
                } else {
                    failed++;
                    var idx = uploadedUrls.indexOf(pid);
                    if (idx !== -1) uploadedUrls.splice(idx, 1);
                    renderUploadPreviews();
                    callback();
                }
            };

            xhr.send(formData);
        }

        // Start sequential upload
        uploadSingleFile(0);
    }

    function addThumbPreview(src, idx) {
        // Already rendered via renderUploadPreviews, but we update the src
        var existing = uploadPreview.querySelector('[data-idx="' + idx + '"] img');
        if (existing) existing.src = src;
    }

    function renderUploadPreviews() {
        uploadPreview.innerHTML = '';
        if (uploadedUrls.length > 0 && uploadPlaceholder) uploadPlaceholder.style.display = 'none';
        else if (uploadPlaceholder) uploadPlaceholder.style.display = 'flex';

        uploadedUrls.forEach(function (url, i) {
            var thumb = document.createElement('div');
            thumb.className = 'db-upload-thumb' + (i === 0 ? ' main-photo' : '');
            thumb.setAttribute('data-idx', i);

            var isUploading = (url === 'uploading' || url === '__uploading__' || (typeof url === 'string' && url.indexOf('__uploading_') === 0));
            var img = document.createElement('img');
            img.src = isUploading ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"%3E%3Crect fill="%23e2e8f0" width="90" height="90"/%3E%3Ctext x="45" y="50" text-anchor="middle" fill="%2394a3b8" font-size="10"%3EUploading...%3C/text%3E%3C/svg%3E' : url;
            img.alt = 'Photo ' + (i + 1);

            // Set as Main button (star icon) — only for non-main photos
            if (i !== 0 && !isUploading) {
                var mainBtn = document.createElement('button');
                mainBtn.className = 'db-thumb-main';
                mainBtn.title = 'Set as main photo';
                mainBtn.innerHTML = '&#9733;';
                mainBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    // Move this image to index 0
                    var moved = uploadedUrls.splice(i, 1)[0];
                    uploadedUrls.unshift(moved);
                    renderUploadPreviews();
                    syncImageFields();
                    showFormMessage('Main photo updated', 'success');
                });
                thumb.appendChild(mainBtn);
            }
            // Main badge for first photo
            if (i === 0 && !isUploading) {
                var badge = document.createElement('span');
                badge.className = 'db-thumb-main-badge';
                badge.textContent = 'MAIN';
                thumb.appendChild(badge);
            }

            var removeBtn = document.createElement('button');
            removeBtn.className = 'db-thumb-remove';
            removeBtn.textContent = '\u00d7';
            removeBtn.setAttribute('data-idx', i);
            removeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                uploadedUrls.splice(i, 1);
                renderUploadPreviews();
                syncImageFields();
            });

            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            uploadPreview.appendChild(thumb);
        });
    }

    function syncImageFields() {
        // Filter out uploading placeholders before syncing
        var readyUrls = uploadedUrls.filter(function (u) {
            return u && u !== 'uploading' && u !== '__uploading__' && u.indexOf('__uploading_') !== 0;
        });
        var mainUrl = readyUrls.length > 0 ? readyUrls[0] : '';
        document.getElementById('vImageUrl').value = mainUrl;
        document.getElementById('vGalleryUrls').value = JSON.stringify(readyUrls);
        updateCardPositionControl(mainUrl);
    }

    // Show/refresh the "position the main photo on the card" control.
    function updateCardPositionControl(mainUrl) {
        var wrap = document.getElementById('vCardPositionWrap');
        var img = document.getElementById('vCardPreviewImg');
        var slider = document.getElementById('vImageOffsetY');
        if (!wrap || !img || !slider) return;
        if (!mainUrl) { wrap.style.display = 'none'; return; }
        wrap.style.display = 'block';
        img.src = mainUrl;
        img.style.objectPosition = '50% ' + (parseFloat(slider.value) || 50) + '%';
    }
    // Live preview as the slider moves (attached once).
    (function () {
        var slider = document.getElementById('vImageOffsetY');
        var img = document.getElementById('vCardPreviewImg');
        if (slider && img) slider.addEventListener('input', function () {
            img.style.objectPosition = '50% ' + (parseFloat(slider.value) || 50) + '%';
        });
    })();

    // ========================================
    // TECHNICAL PASSPORT UPLOAD
    // ========================================
    function initPassportUpload(side) {
        var area = document.getElementById('passport' + side + 'Area');
        var input = document.getElementById('passport' + side + 'File');
        var preview = document.getElementById('passport' + side + 'Preview');
        var placeholder = document.getElementById('passport' + side + 'Placeholder');
        var hidden = document.getElementById(side === 'Front' ? 'vPassportFront' : 'vPassportBack');

        if (!area) return;

        area.addEventListener('click', function (e) {
            if (e.target.closest('.db-passport-remove')) return;
            input.click();
        });

        input.addEventListener('change', function () {
            if (this.files.length > 0) uploadPassport(this.files[0], side);
            // Reset value so re-selecting the same file triggers change again
            this.value = '';
        });

        area.addEventListener('dragover', function (e) { e.preventDefault(); area.style.borderColor = '#C9A84C'; });
        area.addEventListener('dragleave', function () { area.style.borderColor = ''; });
        area.addEventListener('drop', function (e) {
            e.preventDefault();
            area.style.borderColor = '';
            if (e.dataTransfer.files.length > 0) uploadPassport(e.dataTransfer.files[0], side);
        });

        function uploadPassport(file, s) {
            var allowedPassportTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedPassportTypes.includes(file.type)) {
                showFormMessage('Invalid format. Allowed: JPG, PNG, WEBP', 'error');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                showFormMessage('File too large (max 20MB)', 'error');
                return;
            }

            var reader = new FileReader();
            reader.onload = function (ev) {
                showPassportPreview(ev.target.result, s);

                var formData = new FormData();
                formData.append('image', file);

                fetch('/api/upload/vehicle-image', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.url) {
                        hidden.value = data.url;
                        showPassportPreview(data.url, s);
                    } else {
                        showFormMessage('Passport upload failed', 'error');
                        clearPassportPreview(s);
                    }
                })
                .catch(function () {
                    showFormMessage('Passport upload failed — check server', 'error');
                    clearPassportPreview(s);
                });
            };
            reader.readAsDataURL(file);
        }

        function showPassportPreview(src, s) {
            var prev = document.getElementById('passport' + s + 'Preview');
            var ph = document.getElementById('passport' + s + 'Placeholder');
            var ar = document.getElementById('passport' + s + 'Area');
            ph.style.display = 'none';
            prev.style.display = 'block';
            ar.classList.add('has-image');
            prev.innerHTML = '<img src="' + src + '" alt="Passport ' + s + '">'
                + '<button type="button" class="db-passport-remove" onclick="clearPassport' + s + '()">×</button>';
        }

        function clearPassportPreview(s) {
            var prev = document.getElementById('passport' + s + 'Preview');
            var ph = document.getElementById('passport' + s + 'Placeholder');
            var ar = document.getElementById('passport' + s + 'Area');
            var hid = document.getElementById(s === 'Front' ? 'vPassportFront' : 'vPassportBack');
            ph.style.display = 'flex';
            prev.style.display = 'none';
            prev.innerHTML = '';
            ar.classList.remove('has-image');
            hid.value = '';
        }

        window['clearPassport' + side] = function () { clearPassportPreview(side); };
    }

    initPassportUpload('Front');
    initPassportUpload('Back');

    // ========================================
    // LOAD VEHICLES
    // ========================================
    function loadVehicles() {
        fetch('/api/vehicles/my', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            renderVehicles(data.vehicles || []);
        })
        .catch(function (err) {
            console.error('Failed to load vehicles:', err);
        });
    }

    function renderVehicles(vehicles) {
        var grid = document.getElementById('vehiclesGrid');
        var empty = document.getElementById('emptyVehicles');

        if (vehicles.length === 0) {
            grid.innerHTML = '';
            grid.appendChild(empty);
            empty.style.display = 'flex';
            return;
        }

        if (empty) empty.style.display = 'none';

        var html = '';
        vehicles.forEach(function (v) {
            var imgSrc = v.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect fill='%23e2e8f0' width='400' height='240'/%3E%3Ctext x='200' y='125' text-anchor='middle' fill='%2394a3b8' font-size='16' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
            var statusClass = v.status || 'active';

            // Verification badge
            var verBadge = '';
            if (statusClass === 'active') {
                verBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(34,197,94,0.15);color:#22c55e;border-radius:12px;font-size:11px;font-weight:600;">'
                    + '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>Verified</span>';
            } else if (statusClass === 'pending') {
                verBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(249,115,22,0.15);color:#f97316;border-radius:12px;font-size:11px;font-weight:600;">Unverified</span>';
            } else if (statusClass === 'delete_requested') {
                verBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(239,68,68,0.15);color:#ef4444;border-radius:12px;font-size:11px;font-weight:600;">Delete Requested</span>';
            } else {
                verBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(100,116,139,0.15);color:#A0A3B0;border-radius:12px;font-size:11px;font-weight:600;">' + statusClass.toUpperCase() + '</span>';
            }

            html += '<div class="db-vehicle-card" data-id="' + v.id + '">';
            html += '<img class="db-vehicle-img" src="' + imgSrc + '" alt="' + (v.name || '') + '" style="object-position:50% ' + (v.image_offset_y == null ? 50 : v.image_offset_y) + '%;">';
            html += '<div class="db-vehicle-body">';
            html += '<div class="db-vehicle-name">' + (v.name || 'Unnamed') + '</div>';
            html += '<div class="db-vehicle-meta">';
            html += '<span class="db-vehicle-tag">' + (v.category || '—') + '</span>';
            html += '<span class="db-vehicle-tag">' + (v.engine || '—') + '</span>';
            html += '<span class="db-vehicle-tag">' + (v.gearbox || '—') + '</span>';
            html += '<span class="db-vehicle-tag">' + (v.year || '—') + '</span>';
            html += '</div>';
            html += '<div class="db-vehicle-price">$' + (v.price_per_day || 0) + ' <span data-i18n="fleet.per_day">/day</span></div>';
            html += verBadge;
            var vipActive = v.vip_until && new Date(v.vip_until) > new Date();
            if (vipActive) {
                html += '<div style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;margin-left:6px;background:rgba(201,168,76,0.18);color:#C9A84C;border-radius:12px;font-size:11px;font-weight:700;">⭐ VIP</div>';
            }
            html += '<div class="db-vehicle-actions">';
            if (statusClass !== 'delete_requested') {
                html += '<button class="db-btn-edit" onclick="editVehicle(' + v.id + ')" data-i18n="partner_dashboard.edit_btn">Edit</button>';
                html += '<button class="db-btn-dates" onclick="openAvailabilityCalendar(' + v.id + ')" data-i18n="partner_dashboard.dates_btn">DATES</button>';
                if (statusClass === 'active') {
                    var vipLabel = vipActive ? tOr('partner_dashboard.vip_extend', '⭐ Extend VIP') : tOr('partner_dashboard.vip_btn', '⭐ VIP');
                    html += '<button class="db-btn-vip" data-id="' + v.id + '">' + vipLabel + '</button>';
                }
                html += '<button class="db-btn-delete" onclick="deleteVehicle(' + v.id + ')" data-i18n="partner_dashboard.delete_btn">Request Delete</button>';
            } else {
                html += '<span style="color:#ef4444;font-size:12px;font-style:italic;" data-i18n="partner_dashboard.awaiting_deletion">Awaiting admin approval for deletion</span>';
            }
            html += '</div>';
            html += '</div></div>';
        });

        grid.innerHTML = html;
        // Bind VIP buttons (name/image read from the card so we avoid quoting issues)
        Array.prototype.forEach.call(grid.querySelectorAll('.db-btn-vip'), function (btn) {
            btn.addEventListener('click', function () {
                var card = btn.closest('.db-vehicle-card');
                var id = parseInt(btn.getAttribute('data-id'), 10);
                var nm = card ? (card.querySelector('.db-vehicle-name') || {}).textContent : '';
                var im = card ? (card.querySelector('.db-vehicle-img') || {}).src : '';
                if (window.openVipCarModal) window.openVipCarModal(id, nm, im);
            });
        });
        if (typeof I18n !== 'undefined' && I18n.translatePage) I18n.translatePage(grid);
    }

    // ========================================
    // ADD / EDIT VEHICLE
    // ========================================
    var vehicleForm = document.getElementById('vehicleForm');

    // Legacy stubs (field collection now handled in submit handler)
    function collectExtraServices() { return []; }
    function setExtraServices() {}
    function resetExtraServices() {}
    function collectServiceOptions() { return {}; }
    function setServiceOptions() {}
    function resetServiceOptions() {}

    vehicleForm.addEventListener('submit', function (e) {
        e.preventDefault();

        var editId = document.getElementById('vEditId').value;

        function getVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
        function getFloat(id) { return parseFloat(getVal(id)) || 0; }
        function getInt(id) { return parseInt(getVal(id)) || 0; }
        function getChecked(id) { var el = document.getElementById(id); return el ? !!el.checked : false; }

        var payload = {
            name: getVal('vName').trim(),
            brand: getVal('vBrand'),
            model: getVal('vModel').trim(),
            color: getVal('vColor').trim(),
            min_age: getInt('vMinAge') || 21,
            location_city: getVal('vLocationCity'),
            country: getVal('vCountry') || 'georgia',
            rent_with_driver_only: getChecked('vRentWithDriverOnly'),
            offroad_allowed: getChecked('vOffroadAllowed'),
            suv_6_8: getChecked('vSuv68'),
            locations: (typeof window.collectVehicleLocations === 'function') ? window.collectVehicleLocations() : undefined,
            category: getVal('vCategory'),
            year: getInt('vYear'),
            engine: getVal('vEngine'),
            gearbox: getVal('vGearbox'),
            drive_type: getVal('vDriveType'),
            interior_type: getVal('vInterior'),
            steering_side: getVal('vSteering'),
            seats: getInt('vSeats') || 5,
            doors: getInt('vDoors') || 4,
            fuel_policy: getVal('vFuelPolicy'),
            luggage: getVal('vLuggage'),
            region: getVal('vRegion'),
            price_per_day: getFloat('vPrice'),
            deposit_amount: getFloat('vDeposit'),
            min_rental_days: Math.max(1, parseInt(getVal('vMinRentalDays'), 10) || 1),
            image_url: getVal('vImageUrl') || null,
            image_offset_y: (function () { var s = document.getElementById('vImageOffsetY'); return s ? (parseFloat(s.value) || 50) : 50; })(),
            gallery: uploadedUrls.filter(function (u) { return !u.startsWith('__uploading_'); }),
            description: (getVal('vDescription').trim() || getVal('vDescriptionKa').trim() || getVal('vDescriptionRu').trim() || getVal('vDescriptionHe').trim()) || null,
            description_en: getVal('vDescription').trim() || null,
            description_ka: getVal('vDescriptionKa').trim() || null,
            description_ru: getVal('vDescriptionRu').trim() || null,
            description_he: getVal('vDescriptionHe').trim() || null,
            tech_passport_front: getVal('vPassportFront') || null,
            tech_passport_back: getVal('vPassportBack') || null,
            registration_number: getVal('vRegNumber').trim(),
            engine_cc: getInt('vEngineCC'),
            engine_liters: parseFloat(getVal('vEngineLiters')) || null,
            horsepower: getInt('vHorsepower'),
            fuel_consumption: getVal('vFuelConsumption').trim(),
            mileage_limit_enabled: getChecked('vMileageLimitEnabled'),
            mileage_km: getInt('vMileageKm'),
            visible_in_search: getChecked('vVisibleInSearch'),
            block_after_payment: getChecked('vReturnFormatted'),
            multimedia: {
                android_auto: getChecked('mmAndroidAuto'),
                apple_carplay: getChecked('mmAppleCarPlay'),
                bluetooth: getChecked('mmBluetooth'),
                touch_screen: getChecked('mmTouchScreen')
            },
            features: {
                ac: getChecked('featAC'),
                cruise_control: getChecked('featCruise'),
                rear_camera: getChecked('featRearCam'),
                parking_assist: getChecked('featParkAssist'),
                abs: getChecked('featABS'),
                esp: getChecked('featESP'),
                heated_seats: getChecked('featHeatedSeats'),
                sunroof: getChecked('featSunroof')
            },
            price_tiers: {
                price_1_3: getFloat('vPrice1_3'),
                price_4_7: getFloat('vPrice4_7'),
                price_8_14: getFloat('vPrice8_14'),
                price_15_30: getFloat('vPrice15_30')
            },
            extras: {
                child_seat: getChecked('vChildSeatAvail') ? getFloat('vChildSeat') : 0,
                child_seat_available: getChecked('vChildSeatAvail'),
                snow_chains: getChecked('vChainsAvail') ? getFloat('vChains') : 0,
                snow_chains_available: getChecked('vChainsAvail'),
                roof_rack: getChecked('vRoofRackAvail') ? getFloat('vRoofRack') : 0,
                roof_rack_available: getChecked('vRoofRackAvail'),
                third_driver: getFloat('vThirdDriver'),
                driver_service: getChecked('vDriverServiceAvail') ? getFloat('vDriverServicePrice') : 0,
                driver_service_available: getChecked('vDriverServiceAvail'),
                picnic_house: getChecked('vPicnicHouseAvail') ? getFloat('vPicnicHousePrice') : 0,
                picnic_house_available: getChecked('vPicnicHouseAvail'),
                svaneti_roads: getChecked('vSvanetiAccepted'),
                svaneti_price: getChecked('vSvanetiAccepted') ? getFloat('vSvanetiPrice') : 0,
                shatili_roads: getChecked('vShatiliAccepted'),
                shatili_price: getChecked('vShatiliAccepted') ? getFloat('vShatiliPrice') : 0
            },
            insurance: {
                tpl: getFloat('vInsTPL'),
                cdw: getFloat('vInsCDW'),
                full_coverage: getFloat('vInsFullCoverage')
            },
            pickup_fees_enabled: getChecked('vPickupFeesEnabled'),
            pickup_fees: {
                office_address: getVal('locOfficeAddress').trim(),
                // Per-airport fees — kept as raw strings so a blank means "not offered"
                // (vs. 0 = offered for free). Any airport left blank is hidden at checkout.
                airport_fees: {
                    tbilisi: getVal('locAirportTbilisi').trim(),
                    kutaisi: getVal('locAirportKutaisi').trim(),
                    batumi: getVal('locAirportBatumi').trim()
                },
                delivery_fee: getFloat('locDeliveryPrice')
            },
            custom_pricing_enabled: getChecked('vCustomPricingEnabled'),
            custom_pricing_ranges: (function() {
                var ranges = [];
                document.querySelectorAll('#customPricingList .custom-pricing-row').forEach(function(row) {
                    var start = row.querySelector('.cp-start') ? row.querySelector('.cp-start').value : '';
                    var end = row.querySelector('.cp-end') ? row.querySelector('.cp-end').value : '';
                    var price = row.querySelector('.cp-price') ? parseFloat(row.querySelector('.cp-price').value) || 0 : 0;
                    if (start && end && price > 0) {
                        ranges.push({ start: start, end: end, price: price });
                    }
                });
                return ranges;
            })()
        };

        // Comprehensive validation — ALL fields must be filled (only description is optional)
        var requiredFields = [
            { field: payload.name, name: 'Vehicle Name' },
            { field: payload.brand, name: 'Brand' },
            { field: payload.model, name: 'Model' },
            { field: payload.color, name: 'Color' },
            { field: payload.category, name: 'Category' },
            { field: payload.year, name: 'Year' },
            { field: payload.engine, name: 'Engine Type' },
            { field: payload.gearbox, name: 'Gearbox' },
            { field: payload.drive_type, name: 'Drive Type' },
            { field: payload.interior_type, name: 'Interior Type' },
            { field: payload.steering_side, name: 'Steering Side' },
            { field: payload.seats, name: 'Seats' },
            { field: payload.doors, name: 'Doors' },
            { field: payload.fuel_policy, name: 'Fuel Policy' },
            { field: payload.luggage, name: 'Luggage Capacity' },
            { field: payload.country, name: 'Country' },
            { field: payload.location_city, name: 'City / Location' },
            { field: payload.price_per_day, name: 'Price per Day' },
            { field: payload.deposit_amount !== null && payload.deposit_amount !== undefined ? String(payload.deposit_amount) : '', name: 'Deposit Amount (enter 0 if none)' },
            { field: payload.registration_number, name: 'Registration Number' },
            { field: payload.min_age, name: 'Minimum Driver Age' }
        ];

        // Price tiers — at least price_per_day is required
        if (!payload.price_per_day || payload.price_per_day <= 0) {
            requiredFields.push({ field: '', name: 'Price per Day (must be > 0)' });
        }

        var missingFields = requiredFields.filter(function (f) { 
            return !f.field || f.field === '' || f.field === null || f.field === undefined;
        });

        if (missingFields.length > 0) {
            alert('All fields must be filled!\n\nMissing:\n' + 
                  missingFields.map(function (f) { return '• ' + f.name; }).join('\n'));
            showFormMessage('All fields must be filled (only Description is optional)', 'error');
            return;
        }

        if (!editId && !payload.tech_passport_front) {
            alert('All fields must be filled!\n\nMissing:\n• Technical Passport photo');
            showFormMessage('Technical passport image is required', 'error');
            return;
        }

        if (!payload.gallery || payload.gallery.length === 0) {
            alert('All fields must be filled!\n\nMissing:\n• At least one vehicle photo');
            showFormMessage('Please upload at least one vehicle image', 'error');
            return;
        }

        var submitBtn = document.getElementById('submitVehicleBtn');
        if (submitBtn.disabled) {
            return; // Prevent double-click
        }
        submitBtn.disabled = true;
        submitBtn.textContent = editId ? 'Updating...' : 'Adding...';

        var url = editId ? '/api/vehicles/' + editId : '/api/vehicles';
        var method = editId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
            submitBtn.disabled = false;
            submitBtn.textContent = editId ? 'Update Vehicle' : 'Add Vehicle';

            if (!result.ok) {
                showFormMessage(result.data.error || 'Failed', 'error');
                return;
            }

            showFormMessage(editId ? 'Vehicle updated!' : 'Vehicle added!', 'success');

            var vehicleForVip = (result.data && result.data.vehicle && result.data.vehicle.id) ? result.data.vehicle : null;
            if (!vehicleForVip && editId) {
                vehicleForVip = { id: editId, name: document.getElementById('vName').value };
            }

            // Return to the vehicles list, then offer VIP via the up-to-date modal
            // (shows the one-time $10 first-VIP bonus only when the partner is still
            // eligible; a plain $10 otherwise). Editing an already-VIP car skips it.
            var vipId = vehicleForVip ? vehicleForVip.id : null;
            var vipName = vehicleForVip ? (vehicleForVip.name || document.getElementById('vName').value) : '';
            var vipImg = vehicleForVip ? (vehicleForVip.image_url || document.getElementById('vImageUrl').value || '') : '';
            var alreadyVip = vehicleForVip && vehicleForVip.vip_until && new Date(vehicleForVip.vip_until) > new Date();
            setTimeout(function () {
                resetVehicleForm();
                switchTab('vehicles');
                loadVehicles();
                if (vipId && !alreadyVip && window.openVipCarModal) {
                    setTimeout(function () { window.openVipCarModal(vipId, vipName, vipImg); }, 500);
                }
            }, 900);
        })
        .catch(function (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = editId ? 'Update Vehicle' : 'Add Vehicle';
            showFormMessage('Network error', 'error');
        });
    });

    function resetVehicleForm() {
        vehicleForm.reset();
        if (typeof resetDescTabs === 'function') resetDescTabs();
        if (typeof window.resetVehicleLocations === 'function') window.resetVehicleLocations();
        document.getElementById('vEditId').value = '';
        document.getElementById('addVehicleTitle').textContent = tOr('partner_dashboard.add_new_vehicle', 'Add New Vehicle');
        document.getElementById('submitVehicleBtn').textContent = 'Add Vehicle';
        // Reset wizard to step 1
        goToWizardStep(1);
        // Reset location fields (country/city/region display)
        if (typeof window.setLocationFields === 'function') window.setLocationFields('georgia', '', '');
        // Restore default toggles
        var visEl = document.getElementById('vVisibleInSearch');
        if (visEl) visEl.checked = true;
        var rwdEl = document.getElementById('vRentWithDriverOnly');
        if (rwdEl) { rwdEl.checked = false; rwdEl.dispatchEvent(new Event('change')); }
        var blockEl = document.getElementById('vReturnFormatted');
        if (blockEl) blockEl.checked = true;
        // Clear brand search
        if (window._setBrandValue) window._setBrandValue('');
        var brandInput = document.getElementById('brandSearchInput');
        if (brandInput) brandInput.value = '';
        var brandWrapper = document.getElementById('brandSearchWrapper');
        if (brandWrapper) {
            brandWrapper.classList.remove('vf-invalid', 'open');
            var bsi = brandWrapper.querySelector('.brand-search-input');
            if (bsi) bsi.classList.remove('has-value');
        }
        // Clear color swatch selection
        document.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('selected'); });
        if (colorInput) colorInput.value = '';
        if (colorLabel) colorLabel.textContent = 'No color selected';
        // Clear engine liters
        var elInput = document.getElementById('vEngineLiters');
        if (elInput) elInput.value = '';
        // Clear custom pricing rows
        var cpList = document.getElementById('customPricingList');
        if (cpList) cpList.innerHTML = '';
        var cpContainer = document.getElementById('customPricingContainer');
        if (cpContainer) cpContainer.classList.add('vf-hidden');
        // Clear pickup fees container
        var pfContainer = document.getElementById('pickupFeesContainer');
        if (pfContainer) pfContainer.classList.add('vf-hidden');
        uploadedUrls = [];
        var _offSlider = document.getElementById('vImageOffsetY');
        if (_offSlider) _offSlider.value = 50;
        renderUploadPreviews();
        syncImageFields();
        // Clear passport fields
        document.getElementById('vPassportFront').value = '';
        document.getElementById('vPassportBack').value = '';
        if (window.clearPassportFront) window.clearPassportFront();
        if (window.clearPassportBack) window.clearPassportBack();
        hideFormMessage();
    }

    var formMsgTimer = null;
    function showFormMessage(msg, type) {
        var el = document.getElementById('vehicleFormMessage');
        el.textContent = msg;
        el.className = 'db-form-message ' + type;
        el.style.display = '';
        // For validation errors, also show a fixed toast at the top
        if (type === 'error') {
            var toast = document.getElementById('wizardToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'wizardToast';
                toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#dc2626;color:#fff;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s;pointer-events:none;';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.style.opacity = '1';
            if (formMsgTimer) clearTimeout(formMsgTimer);
            formMsgTimer = setTimeout(function () {
                toast.style.opacity = '0';
            }, 3500);
        }
    }

    function hideFormMessage() {
        var el = document.getElementById('vehicleFormMessage');
        el.textContent = '';
        el.className = 'db-form-message';
        el.style.display = 'none';
    }

    // ========================================
    // EDIT VEHICLE (global function)
    // ========================================
    window.editVehicle = function (id) {
        fetch('/api/vehicles/' + id, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var v = data.vehicle;
            if (!v) return;

            if (typeof goToWizardStep === 'function') goToWizardStep(1); // start editing on step 1 (Location)
            function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
            function setCheck(id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; }

            document.getElementById('vEditId').value = v.id;
            setVal('vName', v.name || '');
            setVal('vBrand', v.brand || '');
            if (window._setBrandValue) window._setBrandValue(v.brand || '');
            setVal('vModel', v.model || '');
            setVal('vColor', v.color || '');
            // Restore color swatch selection
            document.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('selected'); });
            if (v.color) {
                var matchSwatch = document.querySelector('.color-swatch[data-color="' + v.color + '"]');
                if (matchSwatch) matchSwatch.classList.add('selected');
                if (colorLabel) colorLabel.textContent = v.color;
            }
            setVal('vMinAge', v.min_age || 21);
            setVal('vCountry', v.country || 'georgia');
            var offCb = document.getElementById('vOffroadAllowed'); if (offCb) offCb.checked = !!v.offroad_allowed;
            var suvCb = document.getElementById('vSuv68'); if (suvCb) suvCb.checked = !!v.suv_6_8;
            if (typeof window.syncOffroadVisibility === 'function') window.syncOffroadVisibility();
            if (typeof window.populateLocDatalist === 'function') window.populateLocDatalist();
            if (typeof window.loadVehicleLocations === 'function') window.loadVehicleLocations(v.id);
            setVal('vLocationCity', v.location_city || '');
            setVal('vRegion', v.region || '');
            if (typeof window.setLocationFields === 'function') {
                window.setLocationFields(v.country || 'georgia', v.location_city || '', v.region || '');
            }
            setVal('vCategory', v.category || '');
            setVal('vYear', v.year || '');
            setVal('vEngine', v.engine || '');
            setVal('vGearbox', v.gearbox || '');
            setVal('vDriveType', v.drive_type || '');
            setVal('vInterior', v.interior_type || 'fabric');
            setVal('vSteering', v.steering_side || 'left');
            setVal('vSeats', v.seats || 5);
            setVal('vDoors', v.doors || 4);
            setVal('vFuelPolicy', v.fuel_policy || 'full_to_full');
            setVal('vLuggage', v.luggage || '');
            setVal('vRegion', v.region || '');
            setCheck('vRentWithDriverOnly', v.rent_with_driver_only === 1 || v.rent_with_driver_only === true);
            setVal('vPrice', v.price_per_day || '');
            setVal('vDeposit', v.deposit_amount || 0);
            setVal('vMinRentalDays', v.min_rental_days || 1);
            setVal('vImageUrl', v.image_url || '');
            // Per-language descriptions. Seed the current-language tab from the legacy
            // description if no per-language text exists yet (so nothing is lost).
            setVal('vDescription', v.description_en || '');
            setVal('vDescriptionKa', v.description_ka || '');
            setVal('vDescriptionRu', v.description_ru || '');
            setVal('vDescriptionHe', v.description_he || '');
            if (!v.description_en && !v.description_ka && !v.description_ru && !v.description_he && v.description) {
                var _cl = ((typeof I18n !== 'undefined' && I18n.lang) ? I18n.lang() : (document.documentElement.lang || 'en')).slice(0, 2);
                var _map = { en: 'vDescription', ka: 'vDescriptionKa', ru: 'vDescriptionRu', he: 'vDescriptionHe' };
                setVal(_map[_cl] || 'vDescription', v.description);
            }
            // Restore saved main-photo card position (default 50 = centered).
            (function () {
                var slider = document.getElementById('vImageOffsetY');
                if (slider) slider.value = (v.image_offset_y === undefined || v.image_offset_y === null) ? 50 : v.image_offset_y;
                if (v.image_url) updateCardPositionControl(v.image_url);
            })();
            setVal('vRegNumber', v.registration_number || '');
            setVal('vEngineCC', v.engine_cc || '');
            // Populate engine liters from cc
            var ccVal = parseInt(v.engine_cc) || 0;
            var litersVal = v.engine_liters || (ccVal ? (ccVal / 1000).toFixed(1) : '');
            setVal('vEngineLiters', litersVal);
            setVal('vHorsepower', v.horsepower || '');
            setVal('vFuelConsumption', v.fuel_consumption || '');
            setVal('vMileageKm', v.mileage_km || '');
            setCheck('vMileageLimitEnabled', v.mileage_limit_enabled);
            setCheck('vVisibleInSearch', v.visible_in_search !== false);
            setCheck('vReturnFormatted', v.block_after_payment !== false);
            setCheck('vCustomPricingEnabled', v.custom_pricing_enabled);
            setCheck('vPickupFeesEnabled', v.pickup_fees_enabled);

            // Mileage input enable/disable
            var mlEl = document.getElementById('vMileageKm');
            if (mlEl) mlEl.disabled = !v.mileage_limit_enabled;

            // Multimedia
            var mm = (typeof v.multimedia === 'string') ? JSON.parse(v.multimedia || '{}') : (v.multimedia || {});
            setCheck('mmAndroidAuto', mm.android_auto);
            setCheck('mmAppleCarPlay', mm.apple_carplay);
            setCheck('mmBluetooth', mm.bluetooth);
            setCheck('mmTouchScreen', mm.touch_screen);

            // Features
            var feat = (typeof v.features === 'string') ? JSON.parse(v.features || '{}') : (v.features || {});
            setCheck('featAC', feat.ac);
            setCheck('featCruise', feat.cruise_control);
            setCheck('featRearCam', feat.rear_camera);
            setCheck('featParkAssist', feat.parking_assist);
            setCheck('featABS', feat.abs);
            setCheck('featESP', feat.esp);
            setCheck('featHeatedSeats', feat.heated_seats);
            setCheck('featSunroof', feat.sunroof);

            // Price tiers
            var pt = (typeof v.price_tiers === 'string') ? JSON.parse(v.price_tiers || '{}') : (v.price_tiers || {});
            setVal('vPrice1_3', pt.price_1_3 || '');
            setVal('vPrice4_7', pt.price_4_7 || '');
            setVal('vPrice8_14', pt.price_8_14 || '');
            setVal('vPrice15_30', pt.price_15_30 || '');

            // Extras
            var ext = (typeof v.extras === 'string') ? JSON.parse(v.extras || '{}') : (v.extras || {});
            setCheck('vChildSeatAvail', ext.child_seat_available || (ext.child_seat > 0));
            setVal('vChildSeat', ext.child_seat || '');
            setCheck('vChainsAvail', ext.snow_chains_available || (ext.snow_chains > 0) || (ext.chains > 0));
            setVal('vChains', ext.snow_chains || ext.chains || '');
            setCheck('vRoofRackAvail', ext.roof_rack_available || (ext.roof_rack > 0));
            setVal('vRoofRack', ext.roof_rack || '');
            setVal('vThirdDriver', ext.third_driver || '');
            setCheck('vDriverServiceAvail', ext.driver_service_available || (ext.driver_service > 0));
            setVal('vDriverServicePrice', ext.driver_service || '');
            setCheck('vPicnicHouseAvail', ext.picnic_house_available || (ext.picnic_house > 0));
            setVal('vPicnicHousePrice', ext.picnic_house || '');
            setCheck('vSvanetiAccepted', ext.svaneti_roads || ext.third_party_insurance);
            setVal('vSvanetiPrice', ext.svaneti_price || '');
            setCheck('vShatiliAccepted', ext.shatili_roads);
            setVal('vShatiliPrice', ext.shatili_price || '');
            // Enable price inputs if checkboxes are checked
            var extraToggles = [
                ['vChildSeatAvail', 'vChildSeat'], ['vChainsAvail', 'vChains'],
                ['vRoofRackAvail', 'vRoofRack'], ['vDriverServiceAvail', 'vDriverServicePrice'],
                ['vPicnicHouseAvail', 'vPicnicHousePrice'], ['vSvanetiAccepted', 'vSvanetiPrice'],
                ['vShatiliAccepted', 'vShatiliPrice']
            ];
            extraToggles.forEach(function (pair) {
                var cb = document.getElementById(pair[0]);
                var inp = document.getElementById(pair[1]);
                if (cb && inp) inp.disabled = !cb.checked;
            });
            // Re-apply "rent with driver only" forcing for the loaded car
            var rwdEdit = document.getElementById('vRentWithDriverOnly');
            if (rwdEdit) rwdEdit.dispatchEvent(new Event('change'));

            // Insurance
            var ins = (typeof v.insurance === 'string') ? JSON.parse(v.insurance || '{}') : (v.insurance || {});
            setVal('vInsTPL', ins.tpl || '');
            setVal('vInsCDW', ins.cdw || '');
            setVal('vInsFullCoverage', ins.full_coverage || '');

            // Pickup fees
            var pf = (typeof v.pickup_fees === 'string') ? JSON.parse(v.pickup_fees || '{}') : (v.pickup_fees || {});
            setVal('locOfficeAddress', pf.office_address || '');
            var af = pf.airport_fees || {};
            // Backward compat: old vehicles stored a single airport_fee — map it to Tbilisi.
            var tbil = (af.tbilisi !== undefined && af.tbilisi !== '') ? af.tbilisi : (pf.airport_fee != null ? pf.airport_fee : '');
            setVal('locAirportTbilisi', tbil === 0 ? '0' : (tbil || ''));
            setVal('locAirportKutaisi', (af.kutaisi === 0 ? '0' : (af.kutaisi || '')));
            setVal('locAirportBatumi', (af.batumi === 0 ? '0' : (af.batumi || '')));
            setVal('locDeliveryPrice', pf.delivery_fee || '');

            // Show/hide pickup fees container
            var pfContainer = document.getElementById('pickupFeesContainer');
            if (pfContainer) pfContainer.classList.toggle('vf-hidden', !v.pickup_fees_enabled);

            // Custom pricing ranges
            var cpContainer = document.getElementById('customPricingContainer');
            if (cpContainer) cpContainer.classList.toggle('vf-hidden', !v.custom_pricing_enabled);
            var cpList = document.getElementById('customPricingList');
            if (cpList) {
                cpList.innerHTML = '';
                var cpRanges = v.custom_pricing_ranges;
                if (typeof cpRanges === 'string') { try { cpRanges = JSON.parse(cpRanges); } catch(e) { cpRanges = []; } }
                if (Array.isArray(cpRanges)) {
                    cpRanges.forEach(function(range) {
                        var row = document.createElement('div');
                        row.className = 'custom-pricing-row';
                        row.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap;';
                        row.innerHTML = '<input type="date" class="db-input cp-start" style="flex:1;min-width:120px;" value="' + (range.start || '') + '">'
                            + '<input type="date" class="db-input cp-end" style="flex:1;min-width:120px;" value="' + (range.end || '') + '">'
                            + '<input type="number" class="db-input cp-price" style="flex:1;min-width:100px;" value="' + (range.price || '') + '" placeholder="$/day" min="0" step="0.01">'
                            + '<button type="button" class="btn btn-secondary btn-small cp-remove" style="padding:4px 10px;color:#ef4444;">✕</button>';
                        row.querySelector('.cp-remove').addEventListener('click', function () { row.remove(); });
                        cpList.appendChild(row);
                    });
                }
            }

            document.getElementById('addVehicleTitle').textContent = tOr('partner_dashboard.edit_vehicle', 'Edit Vehicle');
            document.getElementById('submitVehicleBtn').textContent = 'Update Vehicle';

            // Populate gallery photos from existing vehicle data
            uploadedUrls = [];
            var gallery = v.gallery;
            if (typeof gallery === 'string') {
                try { gallery = JSON.parse(gallery); } catch(e) { gallery = []; }
            }
            if (Array.isArray(gallery) && gallery.length > 0) {
                uploadedUrls = gallery.slice();
            } else if (v.image_url) {
                uploadedUrls = [v.image_url];
            }
            document.getElementById('vGalleryUrls').value = JSON.stringify(uploadedUrls);
            renderUploadPreviews();
            syncImageFields();

            // Populate passport fields if they exist
            if (v.tech_passport_front) {
                document.getElementById('vPassportFront').value = v.tech_passport_front;
                var fprev = document.getElementById('passportFrontPreview');
                var fph = document.getElementById('passportFrontPlaceholder');
                var far = document.getElementById('passportFrontArea');
                if (fprev && fph && far) {
                    fph.style.display = 'none';
                    fprev.style.display = 'block';
                    far.classList.add('has-image');
                    fprev.innerHTML = '<img src="' + v.tech_passport_front + '" alt="Passport Front"><button type="button" class="db-passport-remove" onclick="clearPassportFront()">×</button>';
                }
            }
            if (v.tech_passport_back) {
                document.getElementById('vPassportBack').value = v.tech_passport_back;
                var bprev = document.getElementById('passportBackPreview');
                var bph = document.getElementById('passportBackPlaceholder');
                var bar = document.getElementById('passportBackArea');
                if (bprev && bph && bar) {
                    bph.style.display = 'none';
                    bprev.style.display = 'block';
                    bar.classList.add('has-image');
                    bprev.innerHTML = '<img src="' + v.tech_passport_back + '" alt="Passport Back"><button type="button" class="db-passport-remove" onclick="clearPassportBack()">×</button>';
                }
            }

            switchTab('add-vehicle');
        });
    };

    // ========================================
    // DELETE VEHICLE (global function)
    // ========================================
    window.deleteVehicle = function (id) {
        if (!confirm('Request deletion of this vehicle? Admin will review and approve your request.')) return;

        fetch('/api/vehicles/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
            if (!result.ok) {
                alert(result.data.error || 'Failed to request deletion');
                return;
            }
            alert(result.data.message || 'Deletion requested');
            loadVehicles();
        })
        .catch(function (err) {
            alert('Failed to request vehicle deletion');
        });
    };

    // ========================================
    // LOAD PROFILE
    // ========================================
    function loadProfile() {
        fetch('/api/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            var u = data.user;
            if (!u) return;

            document.getElementById('profileName').textContent = u.full_name || '—';
            document.getElementById('profileEmail').textContent = u.email || '—';
            document.getElementById('profilePhone').textContent = u.phone || '—';
            document.getElementById('profileDate').textContent = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';

            if (u.partner_profile) {
                document.getElementById('profileCompany').textContent = u.partner_profile.company_name || '—';
                document.getElementById('profileLocation').textContent = u.partner_profile.location || '—';

                if (companyEl && u.partner_profile.company_name) {
                    companyEl.textContent = u.partner_profile.company_name;
                }
            }

            // Phone verification card
            var ppvCard = document.getElementById('partnerPhoneVerifyCard');
            var ppvIcon = document.getElementById('ppvIcon');
            var ppvTitle = document.getElementById('ppvTitle');
            var ppvDesc = document.getElementById('ppvDesc');
            var ppvBtn = document.getElementById('ppvActionBtn');
            if (ppvCard) {
                ppvCard.style.display = 'block';
                if (u.phone_verified === 1 || u.phone_verified === true) {
                    ppvCard.style.background = 'rgba(34,197,94,0.05)';
                    ppvCard.style.border = '1px solid rgba(34,197,94,0.2)';
                    ppvIcon.style.background = 'rgba(34,197,94,0.1)';
                    ppvIcon.style.color = '#22c55e';
                    ppvTitle.style.color = '#22c55e';
                    ppvTitle.textContent = 'Phone Verified';
                    ppvDesc.textContent = 'Your phone number ' + (u.phone || '') + ' is verified.';
                    ppvBtn.style.display = 'none';
                } else {
                    ppvCard.style.background = 'rgba(249,115,22,0.05)';
                    ppvCard.style.border = '1px solid rgba(249,115,22,0.2)';
                    ppvIcon.style.background = 'rgba(249,115,22,0.1)';
                    ppvIcon.style.color = '#f97316';
                    ppvTitle.style.color = '#f97316';
                    ppvTitle.textContent = 'Phone Not Verified';
                    ppvDesc.textContent = 'Verify your phone so customers and our team can reach you about bookings.';
                    ppvBtn.style.display = 'inline-block';
                    ppvBtn.onclick = function () { window.location.href = '/verify-phone.html?v=2'; };
                }
            }
        });
    }

    // ========================================
    // REFERRAL PROGRAM
    // ========================================
    function fmtMoney(amount) {
        return '$' + parseFloat(amount || 0).toFixed(2);
    }

    function loadReferralStats() {
        var tab = document.getElementById('tab-referrals');
        if (!tab) return;

        fetch('/api/partner/referral-stats', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.error) return;

            document.getElementById('refMyCode').textContent = data.my_code || '-';
            document.getElementById('refPartnerCount').textContent = data.total_referred_partners || 0;
            document.getElementById('refCarCount').textContent = data.total_referral_cars || 0;
            document.getElementById('refCurrentTier').textContent = (data.tier && data.tier.percent ? Math.round(data.tier.percent * 100) : 0) + '%';
            document.getElementById('refBalance').textContent = fmtMoney(data.balance);
            document.getElementById('refEarningsTotal').textContent = fmtMoney(data.earnings && data.earnings.total);
            document.getElementById('refEarningsPending').textContent = fmtMoney(data.earnings && data.earnings.pending);
            document.getElementById('refEarningsMonth').textContent = fmtMoney(data.earnings && data.earnings.this_month);

            var referredByEl = document.getElementById('refReferredBy');
            if (referredByEl) {
                if (data.referred_by) {
                    referredByEl.textContent = (data.referred_by.company_name || data.referred_by.full_name || data.referred_by.email) + ' (' + (data.referred_by.referral_code || '') + ')';
                } else {
                    referredByEl.textContent = 'EliteAuto Founder';
                }
            }

            var tbody = document.querySelector('#refPartnersTable tbody');
            var empty = document.getElementById('refEmptyPartners');
            var partners = data.referred_partners || [];
            if (tbody) {
                tbody.innerHTML = '';
                if (partners.length === 0) {
                    if (empty) empty.style.display = 'block';
                } else {
                    if (empty) empty.style.display = 'none';
                    partners.forEach(function(p) {
                        var row = document.createElement('tr');
                        row.innerHTML = '<td>' + (p.company_name || p.full_name || p.email) + '</td>'
                            + '<td>' + (p.referral_code || '-') + '</td>'
                            + '<td>' + (p.active_cars || 0) + '</td>'
                            + '<td>' + (p.created_at ? new Date(p.created_at).toLocaleDateString() : '-') + '</td>';
                        tbody.appendChild(row);
                    });
                }
            }

            var payoutBtn = document.getElementById('refRequestPayoutBtn');
            if (payoutBtn) {
                payoutBtn.disabled = (data.balance || 0) < (data.min_payout_amount || 50);
                payoutBtn.title = payoutBtn.disabled ? 'Minimum payout is $' + (data.min_payout_amount || 50) : '';
            }

            // Show "Apply Referral Code" box if partner doesn't have a referrer yet
            var applyBox = document.getElementById('refApplyBox');
            if (applyBox) {
                applyBox.style.display = data.referred_by ? 'none' : 'block';
            }
        })
        .catch(function(err) {
            console.error('Load referral stats error:', err);
        });
    }

    // Apply referral code for already-registered partners
    var refApplyBtn = document.getElementById('refApplyBtn');
    var refApplyInput = document.getElementById('refApplyInput');
    var refApplyError = document.getElementById('refApplyError');
    var refApplySuccess = document.getElementById('refApplySuccess');
    var refApplyBoxEl = document.getElementById('refApplyBox');

    if (refApplyBtn && refApplyInput) {
        refApplyBtn.addEventListener('click', function() {
            var code = refApplyInput.value.trim().toUpperCase();
            if (!code) return;
            refApplyError.style.display = 'none';
            refApplySuccess.style.display = 'none';
            refApplyBtn.disabled = true;
            refApplyBtn.textContent = 'Applying...';

            fetch('/api/partner/apply-referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ referral_code: code })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                refApplyBtn.disabled = false;
                refApplyBtn.textContent = ((typeof I18n !== 'undefined' && I18n.t && I18n.t('partner_dashboard.apply_referral') !== 'partner_dashboard.apply_referral') ? I18n.t('partner_dashboard.apply_referral') : 'Apply Code');
                if (data.error) {
                    refApplyError.textContent = data.error;
                    refApplyError.style.display = 'block';
                } else {
                    refApplySuccess.textContent = data.message || 'Referral code applied!';
                    refApplySuccess.style.display = 'block';
                    if (refApplyBoxEl) refApplyBoxEl.style.display = 'none';
                    loadReferralStats(); // refresh to show new referrer
                }
            })
            .catch(function(err) {
                refApplyBtn.disabled = false;
                refApplyBtn.textContent = ((typeof I18n !== 'undefined' && I18n.t && I18n.t('partner_dashboard.apply_referral') !== 'partner_dashboard.apply_referral') ? I18n.t('partner_dashboard.apply_referral') : 'Apply Code');
                refApplyError.textContent = 'Network error. Please try again.';
                refApplyError.style.display = 'block';
            });
        });

        refApplyInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') refApplyBtn.click();
        });
    }

    var copyCodeBtn = document.getElementById('refCopyCodeBtn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', function() {
            var code = document.getElementById('refMyCode').textContent;
            if (!code || code === '-') return;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(code).then(function() {
                    copyCodeBtn.textContent = ((typeof I18n!=='undefined'&&I18n.t&&I18n.t('partner_dashboard.copied')!=='partner_dashboard.copied')?I18n.t('partner_dashboard.copied'):'Copied');
                    setTimeout(function() { copyCodeBtn.textContent = ((typeof I18n!=='undefined'&&I18n.t&&I18n.t('partner_dashboard.copy')!=='partner_dashboard.copy')?I18n.t('partner_dashboard.copy'):'Copy'); }, 1500);
                });
            } else {
                var ta = document.createElement('textarea');
                ta.value = code;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyCodeBtn.textContent = ((typeof I18n!=='undefined'&&I18n.t&&I18n.t('partner_dashboard.copied')!=='partner_dashboard.copied')?I18n.t('partner_dashboard.copied'):'Copied');
                setTimeout(function() { copyCodeBtn.textContent = ((typeof I18n!=='undefined'&&I18n.t&&I18n.t('partner_dashboard.copy')!=='partner_dashboard.copy')?I18n.t('partner_dashboard.copy'):'Copy'); }, 1500);
            }
        });
    }

    var referralsNavItem = document.querySelector('.db-nav-item[data-tab="referrals"]');
    if (referralsNavItem) {
        referralsNavItem.addEventListener('click', loadReferralStats);
    }

    var refRequestPayoutBtn = document.getElementById('refRequestPayoutBtn');
    var refPayoutMethodBtn = document.getElementById('refPayoutMethodBtn');
    var refPayoutModal = document.getElementById('refPayoutModal');
    var refPayoutAmount = document.getElementById('refPayoutAmount');
    var refPayoutMethod = document.getElementById('refPayoutMethod');
    var refPayoutDetails = document.getElementById('refPayoutDetails');
    var refSubmitPayoutBtn = document.getElementById('refSubmitPayoutBtn');
    var refPayoutError = document.getElementById('refPayoutError');
    var refPayoutSuccess = document.getElementById('refPayoutSuccess');

    function openRefPayoutModal() {
        if (refPayoutModal) refPayoutModal.style.display = 'flex';
        if (refPayoutError) refPayoutError.style.display = 'none';
        if (refPayoutSuccess) refPayoutSuccess.style.display = 'none';
        if (refPayoutAmount) refPayoutAmount.value = '';
        if (refPayoutDetails) refPayoutDetails.value = '';
    }
    window.openRefPayoutModal = openRefPayoutModal;

    function closeRefPayoutModal() {
        if (refPayoutModal) refPayoutModal.style.display = 'none';
    }
    window.closeRefPayoutModal = closeRefPayoutModal;

    if (refRequestPayoutBtn) refRequestPayoutBtn.addEventListener('click', openRefPayoutModal);
    if (refPayoutMethodBtn) refPayoutMethodBtn.addEventListener('click', openRefPayoutModal);

    if (refPayoutModal) {
        refPayoutModal.addEventListener('click', function(e) {
            if (e.target === refPayoutModal) closeRefPayoutModal();
        });
    }

    if (refSubmitPayoutBtn) {
        refSubmitPayoutBtn.addEventListener('click', async function() {
            var amount = parseFloat(refPayoutAmount ? refPayoutAmount.value : 0);
            var method = refPayoutMethod ? refPayoutMethod.value : 'bank';
            var details = refPayoutDetails ? refPayoutDetails.value.trim() : '';
            if (refPayoutError) refPayoutError.style.display = 'none';
            if (refPayoutSuccess) refPayoutSuccess.style.display = 'none';

            if (isNaN(amount) || amount <= 0) {
                if (refPayoutError) { refPayoutError.textContent = 'Please enter a valid amount'; refPayoutError.style.display = 'block'; }
                return;
            }

            try {
                var res = await fetch('/api/partner/payout-request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token,
                    },
                    body: JSON.stringify({ amount: amount, method: method, details: details }),
                });
                var data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to submit request');
                if (refPayoutSuccess) refPayoutSuccess.style.display = 'block';
                loadReferralStats();
                setTimeout(closeRefPayoutModal, 2000);
            } catch (err) {
                if (refPayoutError) { refPayoutError.textContent = err.message; refPayoutError.style.display = 'block'; }
            }
        });
    }

    // ========================================
    // INIT
    // ========================================
    loadVehicles();
    loadProfile();
    loadReferralStats();

    // ========================================
    // AVAILABILITY CALENDAR
    // ========================================
    var currentVehicleId = null;
    var currentMonth = new Date();
    var availabilityData = {};
    var changedDates = new Set();
    var partnerBlockIntervals = []; // hour-level blocks (buffer applied) as [{startMs, endMs}]

    function vdPopulateHourSelects() {
        ['blockStartHour', 'blockEndHour'].forEach(function (id) {
            var sel = document.getElementById(id);
            if (!sel || sel.options.length) return; // populate once
            for (var h = 0; h < 24; h++) {
                var v = String(h).padStart(2, '0') + ':00';
                var o = document.createElement('option');
                o.value = v; o.textContent = v;
                sel.appendChild(o);
            }
        });
        var sh = document.getElementById('blockStartHour'); if (sh) sh.value = '10:00';
        var eh = document.getElementById('blockEndHour'); if (eh) eh.value = '10:00';
    }
    // Does date (YYYY-MM-DD) intersect any hour block (incl. buffer)?
    function dashDateHasBlock(dateStr) {
        if (!partnerBlockIntervals.length) return false;
        var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return false;
        var dayStart = Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0);
        var dayEnd = dayStart + 24 * 3600000;
        return partnerBlockIntervals.some(function (b) {
            return b.startMs < dayEnd && b.endMs > dayStart;
        });
    }

    window.openAvailabilityCalendar = function (vehicleId) {
        currentVehicleId = vehicleId;
        currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        availabilityData = {};
        changedDates.clear();
        
        var modal = document.getElementById('availabilityModal');
        modal.style.display = 'flex';

        loadAvailability(); // renders after data loads
        vdPopulateHourSelects();
        if (typeof loadTimeBlocks === 'function') loadTimeBlocks();
        vcClearBlockDateFields();
        var tbErr = document.getElementById('timeBlockError'); if (tbErr) tbErr.style.display = 'none';
    };

    window.closeAvailabilityCalendar = function () {
        var modal = document.getElementById('availabilityModal');
        modal.style.display = 'none';
        currentVehicleId = null;
        availabilityData = {};
        changedDates.clear();
    };

    window.changeMonth = function (direction) {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
        availabilityData = {};
        loadAvailability();
    };

    function loadAvailability() {
        if (!currentVehicleId) return;
        
        var monthStr = currentMonth.getFullYear() + '-' + String(currentMonth.getMonth() + 1).padStart(2, '0');
        
        fetch('/api/availability/' + currentVehicleId + '?month=' + monthStr, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            availabilityData = {};
            (data.availability || []).forEach(function (item) {
                availabilityData[item.date] = item.status;
            });
            renderCalendar();
        })
        .catch(function (err) {
            console.error('Load availability error:', err);
        });
    }

    function renderCalendar() {
        var calendar = document.getElementById('availabilityCalendar');
        var monthHeader = document.getElementById('availabilityMonth');
        
        var year = currentMonth.getFullYear();
        var month = currentMonth.getMonth();
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        
        monthHeader.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var daysInPrevMonth = new Date(year, month, 0).getDate();
        
        var html = '';
        
        // Day headers
        var dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(function (day) {
            html += '<div class="availability-day-header">' + day + '</div>';
        });
        
        // Previous month days
        for (var i = firstDay - 1; i >= 0; i--) {
            var day = daysInPrevMonth - i;
            html += '<div class="availability-day other-month">' + day + '</div>';
        }
        
        // Current month days
        for (var day = 1; day <= daysInMonth; day++) {
            var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            var cellDate = new Date(year, month, day);
            cellDate.setHours(0, 0, 0, 0);
            var isPast = cellDate < today;
            var status = availabilityData[dateStr] || 'available';
            var statusClass = isPast ? 'past' : (status === 'blocked' ? 'blocked' : (status === 'booked' ? 'booked' : 'available'));
            
            if (isPast) {
                html += '<div class="availability-day past" data-date="' + dateStr + '">' + day + '</div>';
            } else {
                var hb = (status !== 'blocked' && status !== 'booked' && dashDateHasBlock(dateStr)) ? ' hours-blocked' : '';
                html += '<div class="availability-day ' + statusClass + hb + '" data-date="' + dateStr + '" onclick="toggleDate(\'' + dateStr + '\')">' + day + '</div>';
            }
        }
        
        // Next month days
        var totalCells = firstDay + daysInMonth;
        var nextMonthDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (var day = 1; day <= nextMonthDays; day++) {
            html += '<div class="availability-day other-month">' + day + '</div>';
        }
        
        calendar.innerHTML = html;
    }

    window.toggleDate = function (dateStr) {
        var dayElement = document.querySelector('[data-date="' + dateStr + '"]');
        if (!dayElement || dayElement.classList.contains('other-month')) return;
        
        var currentStatus = availabilityData[dateStr] || 'available';
        if (currentStatus === 'booked') return;
        var newStatus = currentStatus === 'available' ? 'blocked' : 'available';
        
        availabilityData[dateStr] = newStatus;
        changedDates.add(dateStr);
        
        dayElement.classList.remove('available', 'blocked', 'booked');
        dayElement.classList.add(newStatus);
    };

    window.saveAvailability = function () {
        if (!currentVehicleId || changedDates.size === 0) {
            closeAvailabilityCalendar();
            return;
        }
        
        var dates = Array.from(changedDates);
        var updates = {};
        
        dates.forEach(function (date) {
            var status = availabilityData[date] || 'available';
            if (!updates[status]) updates[status] = [];
            updates[status].push(date);
        });
        
        var promises = [];
        Object.keys(updates).forEach(function (status) {
            promises.push(
                fetch('/api/availability/' + currentVehicleId, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        dates: updates[status],
                        status: status
                    })
                })
            );
        });
        
        Promise.all(promises)
        .then(function () {
            var btn = document.getElementById('availabilitySaveBtn');
            if (btn) { btn.textContent = 'Saved!'; btn.style.background = '#22c55e'; setTimeout(function(){ btn.textContent = 'Save'; btn.style.background = ''; }, 2000); }
            closeAvailabilityCalendar();
        })
        .catch(function (err) {
            console.error('Save availability error:', err);
            var btn = document.getElementById('availabilitySaveBtn');
            if (btn) { btn.textContent = 'Error!'; btn.style.background = '#ef4444'; setTimeout(function(){ btn.textContent = 'Save'; btn.style.background = ''; }, 2000); }
        });
    };

    // ========================================
    // HOUR-LEVEL TIME BLOCKS (within the availability modal)
    // ========================================
    function tbMs(ts) {
        var m = String(ts || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
    }
    function tbFmt(ts) {
        // 'YYYY-MM-DDTHH:MM' -> 'Jun 25, 10:00'
        var m = String(ts || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (!m) return ts || '';
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[parseInt(m[2], 10) - 1] + ' ' + parseInt(m[3], 10) + ', ' + m[4] + ':' + m[5];
    }
    function tbAddMinutes(ts, mins) {
        var m = String(ts || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (!m) return ts;
        var ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + mins * 60000;
        var d = new Date(ms);
        function p(n) { return String(n).padStart(2, '0'); }
        return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
    }

    window.loadTimeBlocks = function () {
        if (!currentVehicleId) return;
        var list = document.getElementById('timeBlocksList');
        fetch('/api/availability/' + currentVehicleId + '/time-blocks')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            var blocks = data.blocks || [];
            // Store effective intervals so the calendar can flag affected dates
            partnerBlockIntervals = blocks.map(function (b) {
                return { startMs: tbMs(b.effective_start), endMs: tbMs(b.effective_end) };
            }).filter(function (b) { return b.startMs != null && b.endMs != null; });
            renderCalendar();
            if (!list) return;
            if (!blocks.length) {
                list.innerHTML = '<p style="font-size:12px;color:#94a3b8;margin:0;">No hour blocks yet.</p>';
                return;
            }
            list.innerHTML = blocks.map(function (b) {
                var buf = (b.buffer_minutes == null ? 120 : b.buffer_minutes);
                var bufLabel = buf >= 60 ? (buf / 60) + 'h' : buf + 'm';
                return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;background:#f8fafc;">'
                    + '<div style="font-size:13px;color:#334155;">'
                    + '<b>' + tbFmt(b.start) + '</b> &rarr; <b>' + tbFmt(b.end) + '</b>'
                    + '<span style="color:#94a3b8;"> (+' + bufLabel + ' buffer &rarr; ' + tbFmt(b.effective_end) + ')</span>'
                    + '</div>'
                    + '<button type="button" onclick="deleteTimeBlock(' + b.id + ')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:13px;font-weight:600;">Remove</button>'
                    + '</div>';
            }).join('');
        })
        .catch(function (err) { console.error('Load time-blocks error:', err); });
    };

    // Compose the Day/Month/Year fields into the hidden YYYY-MM-DD input the
    // block logic reads. Empty (invalid/incomplete) => empty hidden value.
    function vcComposeBlockDate(which) {
        var d = document.getElementById('block' + which + 'Day');
        var m = document.getElementById('block' + which + 'Month');
        var y = document.getElementById('block' + which + 'Year');
        var hid = document.getElementById('block' + which + 'Date');
        if (!d || !m || !y || !hid) return;
        var dv = parseInt(d.value, 10), mv = parseInt(m.value, 10), yv = parseInt(y.value, 10);
        if (dv >= 1 && dv <= 31 && mv >= 1 && mv <= 12 && yv >= 2000) {
            hid.value = yv + '-' + String(mv).padStart(2, '0') + '-' + String(dv).padStart(2, '0');
        } else {
            hid.value = '';
        }
    }
    function vcClearBlockDateFields() {
        ['StartDay', 'StartMonth', 'StartYear', 'EndDay', 'EndMonth', 'EndYear'].forEach(function (s) {
            var e = document.getElementById('block' + s); if (e) e.value = '';
        });
        var sd = document.getElementById('blockStartDate'); if (sd) sd.value = '';
        var ed = document.getElementById('blockEndDate'); if (ed) ed.value = '';
    }
    // Keep the hidden inputs in sync as the partner types (attached once).
    (function () {
        ['Start', 'End'].forEach(function (which) {
            ['Day', 'Month', 'Year'].forEach(function (part) {
                var el = document.getElementById('block' + which + part);
                if (el) el.addEventListener('input', function () { vcComposeBlockDate(which); });
            });
        });
    })();

    window.addTimeBlock = function () {
        if (!currentVehicleId) return;
        vcComposeBlockDate('Start'); vcComposeBlockDate('End');
        var sDate = (document.getElementById('blockStartDate') || {}).value;
        var sHour = (document.getElementById('blockStartHour') || {}).value;
        var eDate = (document.getElementById('blockEndDate') || {}).value;
        var eHour = (document.getElementById('blockEndHour') || {}).value;
        var errEl = document.getElementById('timeBlockError');
        function showErr(msg) { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } }
        if (errEl) errEl.style.display = 'none';
        if (!sDate || !eDate) { showErr('Pick both a start and end date.'); return; }
        var start = sDate + 'T' + (sHour || '00:00');
        var end = eDate + 'T' + (eHour || '00:00');
        if (end <= start) { showErr('End must be after start.'); return; }

        // Guard against rapid re-clicks creating duplicate blocks while a request is
        // in flight. (The server is also idempotent for identical blocks.)
        var btn = document.querySelector('.availability-hours button[onclick*="addTimeBlock"]');
        if (btn) { if (btn.getAttribute('data-busy') === '1') return; btn.setAttribute('data-busy', '1'); btn.disabled = true; }
        function release() { if (btn) { btn.removeAttribute('data-busy'); btn.disabled = false; } }

        fetch('/api/availability/' + currentVehicleId + '/time-blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ start: start, end: end })
        })
        // Tolerate a non-JSON body (e.g. a proxy/timeout HTML page) so it doesn't get
        // mis-reported as a network error — fall back to an empty object.
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
            // 2xx (incl. 200 "already exists") = success; clear inputs and refresh.
            if (!res.ok) { showErr((res.j && res.j.error) || ('Could not save block (error ' + res.status + ').')); return; }
            vcClearBlockDateFields();
            loadTimeBlocks();
        })
        .catch(function (err) { console.error('Add time-block error:', err); showErr('Network error. Try again.'); })
        .then(release, release); // finally: re-enable the button
    };

    window.deleteTimeBlock = function (id) {
        if (!currentVehicleId || !id) return;
        fetch('/api/availability/' + currentVehicleId + '/time-blocks/' + id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function () { loadTimeBlocks(); })
        .catch(function (err) { console.error('Delete time-block error:', err); });
    };

    // ========================================
    // PARTNER BOOKINGS
    // ========================================
    var STATUS_COLORS = { pending: '#f59e0b', accepted: '#22c55e', rejected: '#ef4444', cancelled: '#ef4444', completed: '#C9A84C' };
    var STATUS_LABELS = { pending: 'Pending Review', accepted: 'Accepted', rejected: 'Rejected', cancelled: 'Cancelled', completed: 'Completed' };

    function loadPartnerBookings() {
        var tab = document.getElementById('tab-bookings');
        if (!tab) return;
        tab.innerHTML = '<div class="db-tab-header"><h2>Bookings</h2></div>'
            + '<div style="padding:40px;text-align:center;color:#94a3b8;">Loading...</div>';

        fetch('/api/bookings/partner', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var bookings = data.bookings || [];

            if (bookings.length === 0) {
                tab.innerHTML = '<div class="db-tab-header"><h2>Bookings</h2></div>'
                    + '<div class="db-empty-state">'
                    + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
                    + '<h3>No bookings yet</h3>'
                    + '<p>Bookings will appear here once customers start renting your vehicles</p>'
                    + '</div>';
                return;
            }

            // Count pending
            var pendingCount = bookings.filter(function(b) { return b.status === 'pending'; }).length;

            var html = '<div class="db-tab-header"><h2>Bookings'
                + (pendingCount > 0 ? ' <span style="background:#f59e0b;color:#fff;font-size:12px;padding:2px 8px;border-radius:10px;margin-left:8px;">' + pendingCount + ' pending</span>' : '')
                + '</h2></div><div class="db-bookings-list">';

            bookings.forEach(function(b) {
                var imgSrc = b.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect fill='%23e2e8f0' width='400' height='240'/%3E%3Ctext x='200' y='125' text-anchor='middle' fill='%2394a3b8' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
                var sc = STATUS_COLORS[b.status] || '#94a3b8';
                var sl = STATUS_LABELS[b.status] || b.status;
                var pickup  = new Date(b.pickup_date).toLocaleDateString('en-US',  { month:'short', day:'numeric', year:'numeric' });
                var dropoff = new Date(b.dropoff_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
                var days = Math.max(1, Math.round((new Date(b.dropoff_date) - new Date(b.pickup_date)) / 86400000));
                var created = new Date(b.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

                html += '<div class="db-booking-card">'
                    + '<img class="db-booking-img" src="' + imgSrc + '" alt="' + (b.vehicle_name||'') + '">'
                    + '<div class="db-booking-info">'
                    + '<div class="db-booking-header">'
                    + '<span class="db-booking-vehicle">' + (b.vehicle_name || 'Vehicle') + '</span>'
                    + '<span class="db-booking-status" style="background:' + sc + '20;color:' + sc + ';border:1px solid ' + sc + '40;">' + sl + '</span>'
                    + '</div>'
                    + '<div class="db-booking-guest"><strong>' + (b.guest_name || 'Guest') + '</strong>'
                    + (b.guest_phone ? ' &middot; ' + b.guest_phone : '')
                    + ' &middot; <a href="mailto:' + (b.guest_email||'') + '" style="color:#C9A84C;">' + (b.guest_email||'') + '</a></div>'
                    + '<div class="db-booking-dates">' + pickup + ' &rarr; ' + dropoff + ' &middot; ' + days + ' day' + (days!==1?'s':'') + '</div>'
                    + (b.pickup_location ? '<div class="db-booking-loc">&#128205; ' + b.pickup_location + (b.dropoff_location && b.dropoff_location !== b.pickup_location ? ' &rarr; ' + b.dropoff_location : '') + '</div>' : '')
                    + (function() {
                        var extrasArr = [];
                        try { extrasArr = typeof b.extras_json === 'string' ? JSON.parse(b.extras_json || '[]') : (b.extras_json || []); } catch(e) {}
                        if (!Array.isArray(extrasArr)) extrasArr = [];
                        if (extrasArr.length > 0) {
                            return '<div style="margin:6px 0;display:flex;gap:6px;flex-wrap:wrap;">'
                                + extrasArr.map(function(ex) {
                                    var price = parseFloat(ex.price) || 0;
                                    return '<span style="padding:3px 8px;background:rgba(201,168,76,0.12);color:#C9A84C;border-radius:6px;font-size:11px;font-weight:600;">'
                                        + (ex.name || ex.code || 'Extra') + (price > 0 ? ' $' + price : '') + '</span>';
                                }).join('') + '</div>';
                        }
                        return '';
                    })()
                    + (b.guest_notes ? '<div class="db-booking-notes">Note: ' + b.guest_notes + '</div>' : '')
                    + (function() {
                        // total_price = cash you collect at pickup; service_fee = the website's
                        // share the guest already paid online. The guest's total is the sum.
                        var atPickup = parseFloat(b.total_price) || 0;
                        var svcFee = parseFloat(b.service_fee) || 0;
                        var guestTotal = atPickup + svcFee;
                        return '<div class="db-booking-price">'
                            + 'Total price: <strong>$' + guestTotal.toFixed(2) + '</strong>'
                            + ' &middot; <span style="color:#22c55e;">To collect at pickup: <strong>$' + atPickup.toFixed(2) + '</strong></span>'
                            + (b.extras_total && parseFloat(b.extras_total) > 0 ? ' <span style="color:#A0A3B0;font-size:12px;">(incl. extras: $' + parseFloat(b.extras_total).toFixed(2) + ')</span>' : '')
                            + ' &middot; <span style="color:#94a3b8;font-size:12px;">Booked ' + created + '</span></div>';
                    })()
                    + '</div>';

                if (b.status === 'pending') {
                    html += '<div class="db-booking-actions">'
                        + '<div class="db-booking-awaiting">Awaiting admin approval</div>'
                        + '</div>';
                }
                html += '</div>';
            });
            html += '</div>';
            tab.innerHTML = html;
        })
        .catch(function() {
            tab.innerHTML = '<div class="db-tab-header"><h2>Bookings</h2></div>'
                + '<div style="padding:40px;text-align:center;color:#ef4444;">Failed to load bookings.</div>';
        });
    }

    // Wire bookings tab
    var bookingsNavItem = document.querySelector('.db-nav-item[data-tab="bookings"]');
    if (bookingsNavItem) {
        bookingsNavItem.addEventListener('click', loadPartnerBookings);
    }

    // Wire extras availability checkboxes to enable/disable price inputs
    [['vChildSeatAvail', 'vChildSeat'], ['vChainsAvail', 'vChains'], ['vRoofRackAvail', 'vRoofRack'],
     ['vDriverServiceAvail', 'vDriverServicePrice'], ['vPicnicHouseAvail', 'vPicnicHousePrice'],
     ['vSvanetiAccepted', 'vSvanetiPrice'], ['vShatiliAccepted', 'vShatiliPrice']
    ].forEach(function (pair) {
        var cb = document.getElementById(pair[0]);
        var inp = document.getElementById(pair[1]);
        if (cb && inp) {
            cb.addEventListener('change', function () {
                inp.disabled = !cb.checked;
                if (!cb.checked) inp.value = '';
            });
        }
    });

    // "Rent with driver only": when on, Driver Service is mandatory (bundled into the
    // rental), so force its checkbox on + disabled and keep the price input open —
    // that price is the driver price added to the daily car rate at booking.
    (function () {
        var rwd = document.getElementById('vRentWithDriverOnly');
        if (!rwd) return;
        function applyRwd() {
            var ds = document.getElementById('vDriverServiceAvail');
            var dsP = document.getElementById('vDriverServicePrice');
            if (!ds || !dsP) return;
            if (rwd.checked) {
                ds.checked = true;
                ds.disabled = true;
                dsP.disabled = false;
            } else {
                ds.disabled = false;
                dsP.disabled = !ds.checked;
            }
        }
        rwd.addEventListener('change', applyRwd);
        applyRwd();
    })();

    // ========================================
    // LOCATION: country -> searchable city -> auto region
    // ========================================
    (function initLocationSearch() {
        var countrySel = document.getElementById('vCountry');
        var cityInput = document.getElementById('vLocationCity');
        var regionHidden = document.getElementById('vRegion');
        var regionDisplay = document.getElementById('vRegionDisplay');
        var results = document.getElementById('vCityResults');
        if (!countrySel || !cityInput || !results) return;

        var DATA = window.LOCATION_DATA || {};
        var activeIndex = -1;
        var current = [];

        var stateSel = document.getElementById('vState');
        var stateGroup = document.getElementById('vStateGroup');

        function cityList() {
            var c = countrySel.value || 'georgia';
            var cities = (DATA[c] && DATA[c].cities) ? DATA[c].cities : [];
            // USA uses a Country -> State -> City hierarchy: only show cities of the
            // selected state.
            if (c === 'usa' && stateSel && stateSel.value) {
                cities = cities.filter(function (ct) { return ct.region === stateSel.value; });
            }
            return cities;
        }

        // Show a State dropdown for the USA and populate it with all states.
        function syncStateVisibility() {
            if (!stateSel || !stateGroup) return;
            var isUsa = (countrySel.value === 'usa');
            stateGroup.style.display = isUsa ? '' : 'none';
            if (isUsa && stateSel.options.length === 0) {
                var states = (DATA.usa && DATA.usa.states) ? DATA.usa.states : [];
                stateSel.innerHTML = '<option value="">Select state…</option>' +
                    states.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
            }
        }
        window.vfSyncStateVisibility = syncStateVisibility;
        syncStateVisibility();
        if (stateSel) stateSel.addEventListener('change', function () {
            if (cityInput) cityInput.value = '';
            setRegion(stateSel.value || '');
            hideResults();
        });

        function setRegion(region) {
            if (regionHidden) regionHidden.value = region || '';
            if (regionDisplay) regionDisplay.textContent = region || '—';
        }

        function hideResults() {
            results.classList.remove('open');
            results.innerHTML = '';
            activeIndex = -1;
        }

        function pick(item) {
            cityInput.value = item.name;
            setRegion(item.region);
            cityInput.classList.remove('vf-invalid');
            hideResults();
        }

        function render(matches) {
            current = matches;
            if (!matches.length) { hideResults(); return; }
            results.innerHTML = matches.map(function (m, i) {
                return '<div class="vf-city-item' + (i === activeIndex ? ' active' : '') + '" data-i="' + i + '">'
                    + '<span class="vf-city-name">' + m.name + '</span>'
                    + '<span class="vf-city-region">' + m.region + '</span>'
                    + '</div>';
            }).join('');
            results.classList.add('open');
        }

        function search(q) {
            var list = cityList();
            q = (q || '').toLowerCase().trim();
            var matches;
            if (!q) {
                matches = list.slice(0, 30);
            } else {
                matches = list.filter(function (c) {
                    return c.name.toLowerCase().indexOf(q) !== -1
                        || c.region.toLowerCase().indexOf(q) !== -1;
                }).slice(0, 30);
            }
            activeIndex = -1;
            render(matches);
        }

        cityInput.addEventListener('focus', function () { search(cityInput.value); });
        cityInput.addEventListener('input', function () {
            // typing a custom value clears any previously derived region until re-matched
            var typed = cityInput.value.toLowerCase().trim();
            var exact = cityList().filter(function (c) { return c.name.toLowerCase() === typed; })[0];
            setRegion(exact ? exact.region : '');
            search(cityInput.value);
        });
        cityInput.addEventListener('keydown', function (e) {
            if (!results.classList.contains('open')) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, current.length - 1); render(current); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); render(current); }
            else if (e.key === 'Enter') {
                if (activeIndex >= 0 && current[activeIndex]) { e.preventDefault(); pick(current[activeIndex]); }
            } else if (e.key === 'Escape') { hideResults(); }
        });

        results.addEventListener('mousedown', function (e) {
            var item = e.target.closest('.vf-city-item');
            if (!item) return;
            e.preventDefault();
            var idx = parseInt(item.getAttribute('data-i'), 10);
            if (current[idx]) pick(current[idx]);
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.vf-city-group')) hideResults();
        });

        // Off-road driving + the Georgian-airport fee fields are Georgia-only.
        function syncOffroadVisibility() {
            var isGe = (countrySel.value || 'georgia') === 'georgia';
            var grp = document.getElementById('vOffroadGroup');
            if (grp) {
                grp.style.display = isGe ? '' : 'none';
                if (!isGe) { var cb = document.getElementById('vOffroadAllowed'); if (cb) cb.checked = false; }
            }
            var ga = document.getElementById('georgiaAirportFees');
            if (ga) {
                ga.style.display = isGe ? '' : 'none';
                if (!isGe) {
                    ['locAirportTbilisi', 'locAirportKutaisi', 'locAirportBatumi'].forEach(function (id) {
                        var el = document.getElementById(id); if (el) el.value = '';
                    });
                }
            }
        }
        window.syncOffroadVisibility = syncOffroadVisibility;
        syncOffroadVisibility();

        countrySel.addEventListener('change', function () {
            cityInput.value = '';
            setRegion('');
            if (stateSel) stateSel.value = '';
            hideResults();
            syncOffroadVisibility();
            syncStateVisibility();
            if (typeof window.populateLocDatalist === 'function') window.populateLocDatalist();
        });

        // Helper used by edit-populate to restore saved values
        window.setLocationFields = function (country, city, region) {
            countrySel.value = (country && DATA[country]) ? country : 'georgia';
            syncStateVisibility();
            // For the USA, preselect the saved state (stored in region) so its cities load.
            if (countrySel.value === 'usa' && stateSel && region) stateSel.value = region;
            cityInput.value = city || '';
            // Prefer the dataset region for the saved city; fall back to stored region
            var match = cityList().filter(function (c) { return c.name.toLowerCase() === (city || '').toLowerCase(); })[0];
            setRegion(match ? match.region : (region || ''));
        };
    })();

    // ========================================
    // DRIVER MANAGEMENT
    // ========================================
    (function initDrivers() {
        var driverForm = document.getElementById('driverForm');
        var driversGrid = document.getElementById('driversGrid');
        var emptyDrivers = document.getElementById('emptyDrivers');
        if (!driverForm || !driversGrid) return;

        // --- helpers ---
        function dVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
        function dCheck(id) { var el = document.getElementById(id); return el ? !!el.checked : false; }
        function dInt(id) { return parseInt(dVal(id)) || 0; }
        function dFloat(id) { return parseFloat(dVal(id)) || 0; }
        function setDVal(id, v) { var el = document.getElementById(id); if (el) el.value = v !== undefined && v !== null ? v : ''; }
        function setDCheck(id, v) { var el = document.getElementById(id); if (el) el.checked = !!v; }

        function resetDriverForm() {
            driverForm.reset();
            document.getElementById('dEditId').value = '';
            document.getElementById('addDriverTitle').textContent = 'Add a Driver';
            document.getElementById('submitDriverBtn').textContent = 'Add Driver';
            setDVal('dPhotoUrl', '');
            setDVal('dLicenseFront', '');
            setDVal('dLicenseBack', '');
            setDVal('dIdDocument', '');
            document.getElementById('dPhotoPreview').innerHTML = '';
            document.getElementById('dLicenseFrontPreview').innerHTML = '';
            document.getElementById('dLicenseBackPreview').innerHTML = '';
            document.getElementById('dIdDocPreview').innerHTML = '';
            setDVal('dLocationCity', '');
            setDVal('dCountry', 'georgia');
            setDCheck('dHasOwnVehicle', false);
            document.getElementById('dVehicleInfo').disabled = true;
        }

        function uploadDriverFile(fileInput, hiddenInputId, previewId) {
            return new Promise(function (resolve) {
                var file = fileInput.files ? fileInput.files[0] : null;
                if (!file) { resolve(null); return; }
                var fd = new FormData();
                fd.append('image', file);
                fetch('/api/upload/driver-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.url) {
                            document.getElementById(hiddenInputId).value = data.url;
                            var preview = document.getElementById(previewId);
                            if (preview) preview.innerHTML = '<img src="' + data.url + '" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:8px;">';
                        }
                        resolve(data.url || null);
                    })
                    .catch(function () { resolve(null); });
            });
        }

        // Wire file inputs
        document.getElementById('dPhotoFile').addEventListener('change', function () {
            uploadDriverFile(this, 'dPhotoUrl', 'dPhotoPreview');
        });
        document.getElementById('dLicenseFrontFile').addEventListener('change', function () {
            uploadDriverFile(this, 'dLicenseFront', 'dLicenseFrontPreview');
        });
        document.getElementById('dLicenseBackFile').addEventListener('change', function () {
            uploadDriverFile(this, 'dLicenseBack', 'dLicenseBackPreview');
        });
        document.getElementById('dIdDocFile').addEventListener('change', function () {
            uploadDriverFile(this, 'dIdDocument', 'dIdDocPreview');
        });

        // Has own vehicle toggle
        var hasVehicleCb = document.getElementById('dHasOwnVehicle');
        var vehicleInfoInp = document.getElementById('dVehicleInfo');
        if (hasVehicleCb && vehicleInfoInp) {
            hasVehicleCb.addEventListener('change', function () {
                vehicleInfoInp.disabled = !hasVehicleCb.checked;
                if (!hasVehicleCb.checked) vehicleInfoInp.value = '';
            });
        }

        // --- City autocomplete for driver form ---
        (function initDriverCity() {
            var countrySel = document.getElementById('dCountry');
            var cityInput = document.getElementById('dLocationCity');
            var results = document.getElementById('dCityResults');
            if (!countrySel || !cityInput || !results) return;

            var DATA = window.LOCATION_DATA || {};
            var activeIndex = -1;
            var current = [];

            function cityList() {
                var c = countrySel.value || 'georgia';
                return (DATA[c] && DATA[c].cities) ? DATA[c].cities : [];
            }

            function hideResults() { results.classList.remove('open'); results.innerHTML = ''; activeIndex = -1; }

            function render(matches) {
                current = matches;
                if (!matches.length) { hideResults(); return; }
                results.innerHTML = matches.map(function (m, i) {
                    return '<div class="vf-city-item' + (i === activeIndex ? ' active' : '') + '" data-i="' + i + '">'
                        + '<span class="vf-city-name">' + m.name + '</span>'
                        + '<span class="vf-city-region">' + m.region + '</span>'
                        + '</div>';
                }).join('');
                results.classList.add('open');
            }

            function search(q) {
                var list = cityList();
                q = (q || '').toLowerCase().trim();
                var matches = q ? list.filter(function (c) {
                    return c.name.toLowerCase().indexOf(q) !== -1 || c.region.toLowerCase().indexOf(q) !== -1;
                }).slice(0, 30) : list.slice(0, 30);
                activeIndex = -1;
                render(matches);
            }

            cityInput.addEventListener('focus', function () { search(cityInput.value); });
            cityInput.addEventListener('input', function () { search(cityInput.value); });
            cityInput.addEventListener('keydown', function (e) {
                if (!results.classList.contains('open')) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, current.length - 1); render(current); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); render(current); }
                else if (e.key === 'Enter') { if (activeIndex >= 0 && current[activeIndex]) { e.preventDefault(); cityInput.value = current[activeIndex].name; hideResults(); } }
                else if (e.key === 'Escape') { hideResults(); }
            });
            results.addEventListener('mousedown', function (e) {
                var item = e.target.closest('.vf-city-item');
                if (!item) return;
                e.preventDefault();
                var idx = parseInt(item.getAttribute('data-i'), 10);
                if (current[idx]) { cityInput.value = current[idx].name; hideResults(); }
            });
            document.addEventListener('click', function (e) { if (!e.target.closest('#tab-add-driver')) hideResults(); });
            countrySel.addEventListener('change', function () { cityInput.value = ''; hideResults(); });
        })();

        // --- Form submit ---
        driverForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!isVerified) { showNotVerifiedAlert(); return; }

            var editId = document.getElementById('dEditId').value;
            var payload = {
                full_name: dVal('dName').trim(),
                photo_url: dVal('dPhotoUrl') || null,
                experience_years: dInt('dExperience'),
                languages: dVal('dLanguages').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
                has_own_vehicle: dCheck('dHasOwnVehicle'),
                vehicle_info: dCheck('dHasOwnVehicle') ? dVal('dVehicleInfo').trim() : null,
                price_amount: dFloat('dPrice'),
                price_unit: dVal('dPriceUnit') || 'day',
                phone: dVal('dPhone').trim() || null,
                whatsapp: dVal('dWhatsapp').trim() || null,
                bio: dVal('dBio').trim() || null,
                location_city: dVal('dLocationCity').trim() || null,
                country: dVal('dCountry') || 'georgia',
                license_front: dVal('dLicenseFront') || null,
                license_back: dVal('dLicenseBack') || null,
                id_document: dVal('dIdDocument') || null
            };

            if (!payload.full_name) { showFormMessage('Driver name is required'); return; }
            if (!payload.location_city) { showFormMessage('City is required'); return; }

            var url = editId ? '/api/drivers/' + editId : '/api/drivers';
            var method = editId ? 'PUT' : 'POST';

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify(payload)
            })
            .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
            .then(function (res) {
                if (!res.ok) {
                    showFormMessage(res.data.error || 'Failed to save driver');
                    return;
                }
                showFormMessage(res.data.message, 'success');
                setTimeout(function () {
                    resetDriverForm();
                    switchTab('drivers');
                    loadDrivers();
                }, 1000);
            })
            .catch(function () { showFormMessage('Network error. Please try again.'); });
        });

        // --- Load drivers ---
        function loadDrivers() {
            if (!driversGrid) return;
            driversGrid.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;">Loading...</div>';
            fetch('/api/drivers/mine', { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var list = data.drivers || [];
                    if (list.length === 0) {
                        driversGrid.innerHTML = '';
                        if (emptyDrivers) emptyDrivers.style.display = '';
                        driversGrid.appendChild(emptyDrivers);
                        return;
                    }
                    if (emptyDrivers) emptyDrivers.style.display = 'none';
                    var html = '';
                    list.forEach(function (d) {
                        var statusBadge = d.status === 'approved' ? '<span style="background:#22c55e;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;">Approved</span>' :
                            d.status === 'pending' ? '<span style="background:#f59e0b;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;">Pending</span>' :
                            '<span style="background:#ef4444;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;">Rejected</span>';
                        var photo = d.photo_url || 'images/default-driver.png';
                        var langs = (typeof d.languages === 'string') ? JSON.parse(d.languages || '[]') : (d.languages || []);
                        var langTags = langs.slice(0, 4).map(function (l) { return '<span style="font-size:11px;background:rgba(201,168,76,0.15);color:#C9A84C;padding:2px 6px;border-radius:6px;">' + l + '</span>'; }).join(' ');
                        html += '<div class="db-driver-card" data-id="' + d.id + '">'
                            + '<div class="db-driver-photo" style="background-image:url(' + photo + ')"></div>'
                            + '<div class="db-driver-info">'
                            + '<h4>' + escapeHtml(d.full_name) + '</h4>'
                            + '<div style="margin:4px 0;">' + statusBadge + (d.is_verified ? ' <span style="font-size:11px;color:#22c55e;">&#10003; Verified</span>' : '') + '</div>'
                            + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;">' + langTags + '</div>'
                            + '<p style="font-size:13px;color:#A0A3B0;margin:4px 0;">' + (d.experience_years || 0) + ' years experience</p>'
                            + '<p style="font-size:14px;color:#C9A84C;font-weight:600;">' + (d.price_amount || 0) + '$ / ' + (d.price_unit || 'day') + '</p>'
                            + '</div>'
                            + '<div class="db-driver-actions">'
                            + '<button class="btn btn-small btn-text edit-driver" data-id="' + d.id + '">Edit</button>'
                            + '<button class="btn btn-small btn-danger delete-driver" data-id="' + d.id + '">Delete</button>'
                            + '</div>'
                            + '</div>';
                    });
                    driversGrid.innerHTML = html;
                    wireDriverCardActions();
                })
                .catch(function () {
                    driversGrid.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;">Failed to load drivers.</div>';
                });
        }

        function wireDriverCardActions() {
            driversGrid.querySelectorAll('.edit-driver').forEach(function (btn) {
                btn.addEventListener('click', function () { editDriver(parseInt(btn.dataset.id)); });
            });
            driversGrid.querySelectorAll('.delete-driver').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (!confirm('Delete this driver?')) return;
                    fetch('/api/drivers/' + btn.dataset.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
                        .then(function () { loadDrivers(); });
                });
            });
        }

        function editDriver(id) {
            fetch('/api/drivers/mine', { headers: { 'Authorization': 'Bearer ' + token } })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var d = (data.drivers || []).filter(function (x) { return x.id === id; })[0];
                    if (!d) return;
                    resetDriverForm();
                    document.getElementById('dEditId').value = d.id;
                    document.getElementById('addDriverTitle').textContent = 'Edit Driver';
                    document.getElementById('submitDriverBtn').textContent = 'Save Changes';
                    setDVal('dName', d.full_name);
                    setDVal('dPhotoUrl', d.photo_url || '');
                    if (d.photo_url) document.getElementById('dPhotoPreview').innerHTML = '<img src="' + d.photo_url + '" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:8px;">';
                    setDVal('dExperience', d.experience_years);
                    var langs = (typeof d.languages === 'string') ? JSON.parse(d.languages || '[]') : (d.languages || []);
                    setDVal('dLanguages', langs.join(', '));
                    setDCheck('dHasOwnVehicle', d.has_own_vehicle === 1 || d.has_own_vehicle === true);
                    document.getElementById('dVehicleInfo').disabled = !d.has_own_vehicle;
                    setDVal('dVehicleInfo', d.vehicle_info || '');
                    setDVal('dPrice', d.price_amount);
                    setDVal('dPriceUnit', d.price_unit || 'day');
                    setDVal('dPhone', d.phone || '');
                    setDVal('dWhatsapp', d.whatsapp || '');
                    setDVal('dBio', d.bio || '');
                    setDVal('dCountry', d.country || 'georgia');
                    setDVal('dLocationCity', d.location_city || '');
                    setDVal('dLicenseFront', d.license_front || '');
                    setDVal('dLicenseBack', d.license_back || '');
                    setDVal('dIdDocument', d.id_document || '');
                    if (d.license_front) document.getElementById('dLicenseFrontPreview').innerHTML = '<img src="' + d.license_front + '" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:8px;">';
                    if (d.license_back) document.getElementById('dLicenseBackPreview').innerHTML = '<img src="' + d.license_back + '" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:8px;">';
                    if (d.id_document) document.getElementById('dIdDocPreview').innerHTML = '<img src="' + d.id_document + '" style="max-width:120px;max-height:120px;border-radius:8px;margin-top:8px;">';
                    switchTab('add-driver');
                });
        }

        // --- Tab button wiring ---
        var addFromList = document.getElementById('addDriverFromList');
        var addFirst = document.getElementById('addFirstDriver');
        var backBtn = document.getElementById('backToDrivers');
        var cancelBtn = document.getElementById('cancelDriverForm');
        var driversNavItem = document.querySelector('.db-nav-item[data-tab="drivers"]');

        if (addFromList) addFromList.addEventListener('click', function () {
            if (!isVerified) { showNotVerifiedAlert(); return; }
            resetDriverForm(); switchTab('add-driver');
        });
        if (addFirst) addFirst.addEventListener('click', function () {
            if (!isVerified) { showNotVerifiedAlert(); return; }
            resetDriverForm(); switchTab('add-driver');
        });
        if (backBtn) backBtn.addEventListener('click', function () { switchTab('drivers'); });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { resetDriverForm(); switchTab('drivers'); });
        if (driversNavItem) driversNavItem.addEventListener('click', loadDrivers);

        // Escape HTML helper
        function escapeHtml(str) {
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    // ========================================
    // VIP UPGRADE MODAL (after adding a vehicle)
    // ========================================
    var _vipVehicleId = null;

    window.openVipUpgradeModal = function (vehicle) {
        _vipVehicleId = vehicle && vehicle.id ? vehicle.id : null;
        if (!_vipVehicleId) return;

        var modal = document.getElementById('vipUpgradeModal');
        var img = document.getElementById('vipPreviewImg');
        var name = document.getElementById('vipPreviewName');
        var paypalContainer = document.getElementById('vipPayPalContainer');
        var errorEl = document.getElementById('vipPaymentError');
        var successEl = document.getElementById('vipPaymentSuccess');

        paypalContainer.innerHTML = '';
        errorEl.style.display = 'none';
        errorEl.textContent = '';
        successEl.style.display = 'none';

        if (img) {
            img.src = vehicle.image_url || (vehicle.gallery && vehicle.gallery[0]) || 'images/placeholder-car.png';
            img.alt = vehicle.name || 'Vehicle';
        }
        if (name) name.textContent = vehicle.name || 'Your Vehicle';

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        renderVipPayPalButton();
    };

    window.closeVipUpgradeModal = function () {
        var modal = document.getElementById('vipUpgradeModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        _vipVehicleId = null;
        resetVehicleForm();
        switchTab('vehicles');
        loadVehicles();
    };

    function renderVipPayPalButton() {
        var container = document.getElementById('vipPayPalContainer');
        var errorEl = document.getElementById('vipPaymentError');
        if (!container || !_vipVehicleId) return;

        function showErr(msg) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }

        fetch('/api/payments/config')
            .then(function (r) { return r.json(); })
            .then(function (cfg) {
                if (!cfg.configured || !cfg.clientId) {
                    showErr('Payment is not configured yet. Please contact support.');
                    return;
                }

                var base = cfg.mode === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
                var script = document.createElement('script');
                script.src = base + '/sdk/js?client-id=' + encodeURIComponent(cfg.clientId) + '&currency=USD&intent=capture';
                script.onload = function () {
                    container.innerHTML = '';
                    window.paypal.Buttons({
                        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
                        createOrder: async function () {
                            var r = await fetch('/api/payments/vehicle/' + _vipVehicleId + '/vip/create-order', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                                }
                            });
                            var d = await r.json();
                            if (!r.ok) throw new Error(d.error || 'Failed to create order');
                            return d.orderId;
                        },
                        onApprove: async function (approveData) {
                            container.innerHTML = '<div class="payment-loading">Processing payment…</div>';
                            var r = await fetch('/api/payments/vehicle/' + _vipVehicleId + '/vip/capture-order', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                                },
                                body: JSON.stringify({ order_id: approveData.orderID })
                            });
                            var d = await r.json();
                            if (!r.ok) {
                                showErr(d.error || 'Payment capture failed. Contact support.');
                                container.innerHTML = '';
                                return;
                            }
                            container.innerHTML = '';
                            document.getElementById('vipPaymentSuccess').style.display = 'block';
                            setTimeout(function () {
                                closeVipUpgradeModal();
                            }, 2500);
                        },
                        onError: function (err) {
                            console.error('PayPal VIP error:', err);
                            showErr('Payment failed. Please try again or contact support.');
                        }
                    }).render('#vipPayPalContainer');
                };
                script.onerror = function () {
                    showErr('Failed to load PayPal. Please try again.');
                };
                document.head.appendChild(script);
            })
            .catch(function (err) {
                showErr(err.message || 'Failed to load payment options.');
            });
    }

    })();

    // ========================================
    // PICKUP LOCATIONS (unlimited; add / edit / reorder / delete)
    // ========================================
    (function () {
        var list = document.getElementById('vLocationsList');
        var addBtn = document.getElementById('vAddLocationBtn');
        if (!list || !addBtn) return;
        var btnStyle = 'width:30px;height:34px;border:1px solid #3A3F4B;background:transparent;color:#EAEAEA;border-radius:8px;cursor:pointer;flex-shrink:0;';

        window.addVehicleLocationRow = function (d) {
            d = d || {};
            var row = document.createElement('div');
            row.className = 'vloc-row';
            row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;';
            row.innerHTML =
                '<input class="vloc-city db-input" list="vLocCitiesDatalist" placeholder="City / Airport" style="flex:2;min-width:130px;">' +
                '<input class="vloc-name db-input" placeholder="Label (optional)" style="flex:1.5;min-width:110px;">' +
                '<input class="vloc-address db-input" placeholder="Address (optional)" style="flex:2;min-width:130px;">' +
                '<input class="vloc-fee db-input" type="number" min="0" step="1" placeholder="Fee $" style="width:82px;">' +
                '<button type="button" class="vloc-up" title="Move up" style="' + btnStyle + '">↑</button>' +
                '<button type="button" class="vloc-down" title="Move down" style="' + btnStyle + '">↓</button>' +
                '<button type="button" class="vloc-del" title="Remove" style="' + btnStyle + 'color:#ef4444;">✕</button>';
            row.querySelector('.vloc-city').value = d.city || '';
            row.querySelector('.vloc-name').value = d.name || '';
            row.querySelector('.vloc-address').value = d.address || '';
            row.querySelector('.vloc-fee').value = (d.pickup_fee != null && d.pickup_fee !== '') ? d.pickup_fee : '';
            list.appendChild(row);
        };

        window.collectVehicleLocations = function () {
            var country = (document.getElementById('vCountry') || {}).value || 'georgia';
            var out = [];
            Array.prototype.forEach.call(list.querySelectorAll('.vloc-row'), function (r) {
                var city = (((r.querySelector('.vloc-city') || {}).value) || '').trim();
                if (!city) return;
                out.push({
                    country: country,
                    city: city,
                    name: (((r.querySelector('.vloc-name') || {}).value) || '').trim(),
                    address: (((r.querySelector('.vloc-address') || {}).value) || '').trim(),
                    pickup_fee: parseFloat((r.querySelector('.vloc-fee') || {}).value) || 0
                });
            });
            return out;
        };

        window.resetVehicleLocations = function () { list.innerHTML = ''; };

        window.loadVehicleLocations = function (vehicleId) {
            list.innerHTML = '';
            if (!vehicleId) return;
            fetch('/api/vehicles/' + vehicleId + '/locations')
                .then(function (r) { return r.json(); })
                .then(function (d) { (d.locations || []).forEach(function (l) { window.addVehicleLocationRow(l); }); })
                .catch(function () {});
        };

        window.populateLocDatalist = function () {
            var dl = document.getElementById('vLocCitiesDatalist');
            if (!dl) return;
            var country = (document.getElementById('vCountry') || {}).value || 'georgia';
            var cities = (window.LOCATION_DATA && window.LOCATION_DATA[country]) ? window.LOCATION_DATA[country].cities : [];
            dl.innerHTML = cities.map(function (c) { return '<option value="' + c.name.replace(/"/g, '') + '">'; }).join('');
        };
        window.populateLocDatalist();

        addBtn.addEventListener('click', function () { window.addVehicleLocationRow({}); });
        list.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn) return;
            var row = btn.closest('.vloc-row');
            if (!row) return;
            if (btn.classList.contains('vloc-del')) { row.remove(); }
            else if (btn.classList.contains('vloc-up')) { var prev = row.previousElementSibling; if (prev) list.insertBefore(row, prev); }
            else if (btn.classList.contains('vloc-down')) { var next = row.nextElementSibling; if (next) list.insertBefore(next, row); }
        });
    })();

    // ========================================
    // PER-LANGUAGE DESCRIPTION TABS (add/edit vehicle)
    // ========================================
    (function () {
        var tabs = document.querySelectorAll('#vDescTabs .vdesc-tab');
        var areas = document.querySelectorAll('.vdesc-area');
        if (!tabs.length) return;
        tabs.forEach(function (t) {
            t.addEventListener('click', function () {
                var lang = t.getAttribute('data-lang');
                tabs.forEach(function (x) { x.classList.remove('active'); x.style.background = 'transparent'; x.style.color = '#EAEAEA'; });
                t.classList.add('active'); t.style.background = '#C9A84C'; t.style.color = '#1a1400';
                areas.forEach(function (a) { a.style.display = (a.getAttribute('data-lang') === lang) ? 'block' : 'none'; });
            });
        });
    })();
    // Reset the description tabs to the English tab (called from resetVehicleForm).
    function resetDescTabs() {
        var tabs = document.querySelectorAll('#vDescTabs .vdesc-tab');
        var areas = document.querySelectorAll('.vdesc-area');
        tabs.forEach(function (x) {
            var on = x.getAttribute('data-lang') === 'en';
            x.classList.toggle('active', on);
            x.style.background = on ? '#C9A84C' : 'transparent';
            x.style.color = on ? '#1a1400' : '#EAEAEA';
        });
        areas.forEach(function (a) { a.style.display = (a.getAttribute('data-lang') === 'en') ? 'block' : 'none'; });
    }

    // ========================================
    // EDITABLE COMPANY NAME (partner profile)
    // ========================================
    (function () {
        var editBtn = document.getElementById('editCompanyBtn');
        var box = document.getElementById('editCompanyBox');
        var input = document.getElementById('editCompanyInput');
        var saveBtn = document.getElementById('saveCompanyBtn');
        var cancelBtn = document.getElementById('cancelCompanyBtn');
        var errEl = document.getElementById('editCompanyError');
        var span = document.getElementById('profileCompany');
        if (!editBtn || !box || !input || !saveBtn) return;

        function openEdit() {
            var cur = (span && span.textContent && span.textContent !== '—') ? span.textContent.trim() : '';
            input.value = cur;
            errEl.textContent = '';
            box.style.display = 'inline-block';
            editBtn.style.display = 'none';
            input.focus();
        }
        function closeEdit() {
            box.style.display = 'none';
            editBtn.style.display = '';
            errEl.textContent = '';
        }
        editBtn.addEventListener('click', openEdit);
        cancelBtn.addEventListener('click', closeEdit);
        saveBtn.addEventListener('click', function () {
            var name = input.value.trim();
            if (name.length < 2) { errEl.textContent = tOr('partner_dashboard.company_min_err', 'Name must be at least 2 characters.'); return; }
            if (name.length > 150) { errEl.textContent = tOr('partner_dashboard.company_max_err', 'Name is too long (max 150).'); return; }
            saveBtn.disabled = true;
            fetch('/api/partner/company-name', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ company_name: name })
            }).then(async function (r) { var d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
              .then(function (d) {
                  if (span) span.textContent = d.company_name;
                  var hdr = document.getElementById('dbCompanyName');
                  if (hdr) hdr.textContent = d.company_name;
                  try { var us = JSON.parse(localStorage.getItem('user') || '{}'); us.company_name = d.company_name; localStorage.setItem('user', JSON.stringify(us)); } catch (e) {}
                  closeEdit();
              })
              .catch(function (e) { errEl.textContent = e.message || 'Failed to save.'; })
              .finally(function () { saveBtn.disabled = false; });
        });
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } if (e.key === 'Escape') closeEdit(); });
    })();

    // ========================================
    // VIP CAR MODAL — balances + pay by credit / referral / card / top-up
    // ========================================
    var _vipCarId = null, _vipWallet = null, _ppSdkPromise = null;

    function vipAuthHeaders() {
        return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') };
    }

    function loadPayPalSdk() {
        if (_ppSdkPromise) return _ppSdkPromise;
        _ppSdkPromise = fetch('/api/payments/config').then(function (r) { return r.json(); }).then(function (cfg) {
            if (!cfg.configured || !cfg.clientId) throw new Error('Payment is not configured yet. Contact support.');
            if (window.paypal) return window.paypal;
            return new Promise(function (resolve, reject) {
                var base = cfg.mode === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
                var s = document.createElement('script');
                s.src = base + '/sdk/js?client-id=' + encodeURIComponent(cfg.clientId) + '&currency=USD&intent=capture';
                s.onload = function () { resolve(window.paypal); };
                s.onerror = function () { reject(new Error('Failed to load PayPal.')); };
                document.head.appendChild(s);
            });
        });
        return _ppSdkPromise;
    }

    function vipMsg(text, ok) {
        var el = document.getElementById('vipCarMsg');
        if (!el) return;
        el.textContent = text;
        el.style.display = 'block';
        el.style.color = ok ? '#22c55e' : '#ef4444';
    }

    window.openVipCarModal = function (id, name, img) {
        _vipCarId = id;
        var modal = document.getElementById('vipCarModal');
        if (!modal) return;
        var nameEl = document.getElementById('vipCarName');
        var imgEl = document.getElementById('vipCarImg');
        if (nameEl) nameEl.textContent = name || 'Your car';
        if (imgEl) imgEl.src = img || 'images/placeholder-car.png';
        var msg = document.getElementById('vipCarMsg'); if (msg) msg.style.display = 'none';
        var pp = document.getElementById('vipCarPayPal'); if (pp) pp.innerHTML = '';
        document.getElementById('vipCarBalances').innerHTML = 'Loading…';
        document.getElementById('vipCarActions').innerHTML = '';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        refreshVipWallet();
    };

    window.closeVipCarModal = function () {
        var modal = document.getElementById('vipCarModal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
        _vipCarId = null;
    };

    function refreshVipWallet() {
        fetch('/api/partner/vip-wallet', { headers: vipAuthHeaders() })
            .then(function (r) { return r.json(); })
            .then(function (w) {
                _vipWallet = w;
                var banner = document.getElementById('vipBonusBanner');
                if (banner) banner.style.display = w.first_bonus_available ? 'flex' : 'none';
                var vb = (parseFloat(w.vip_balance) || 0).toFixed(2);
                var rb = (parseFloat(w.referral_balance) || 0).toFixed(2);
                document.getElementById('vipCarBalances').innerHTML =
                    '<div class="vip-bal-card"><span>' + tOr('partner_dashboard.vip_credit', 'VIP credit') + '</span><strong>$' + vb + '</strong></div>' +
                    '<div class="vip-bal-card"><span>' + tOr('partner_dashboard.vip_referral_earnings', 'Referral earnings') + '</span><strong>$' + rb + '</strong></div>';
                renderVipActions(w);
            })
            .catch(function () { document.getElementById('vipCarBalances').textContent = 'Failed to load wallet.'; });
    }

    function payVipVia(endpoint) {
        document.getElementById('vipCarActions').innerHTML = '<div class="payment-loading">Activating…</div>';
        fetch(endpoint, { method: 'POST', headers: vipAuthHeaders() })
            .then(async function (r) { var d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
            .then(function (d) {
                vipMsg('✓ ' + (d.message || 'VIP activated for 30 days!'), true);
                setTimeout(function () { closeVipCarModal(); if (window.loadVehicles) window.loadVehicles(); }, 1800);
            })
            .catch(function (e) { vipMsg(e.message || 'Payment failed.', false); if (_vipWallet) renderVipActions(_vipWallet); });
    }

    function renderVipActions(w) {
        var fee = w.vip_fee || 10;
        var a = document.getElementById('vipCarActions');
        var html = '';
        if ((parseFloat(w.vip_balance) || 0) >= fee) {
            html += '<button class="btn btn-primary vip-act" data-act="balance">' + tOr('partner_dashboard.vip_use_credit', 'Use VIP credit') + ' — $' + fee + '</button>';
        }
        if ((parseFloat(w.referral_balance) || 0) >= fee) {
            html += '<button class="btn btn-secondary vip-act" data-act="referral">' + tOr('partner_dashboard.vip_use_referral', 'Use referral earnings') + ' — $' + fee + '</button>';
        }
        html += '<button class="btn vip-act" data-act="card" style="background:#22c55e;border-color:#22c55e;color:#fff;font-weight:700;">' + tOr('partner_dashboard.vip_pay_card', 'Pay by card') + ' — $' + fee + '</button>';
        html += '<button class="btn btn-text vip-act" data-act="topup">' + tOr('partner_dashboard.vip_topup', 'Top up VIP wallet') + '</button>';
        // (First-VIP bonus now shown as a prominent banner at the top of the modal.)
        a.innerHTML = html;
        Array.prototype.forEach.call(a.querySelectorAll('.vip-act'), function (btn) {
            btn.addEventListener('click', function () {
                var act = btn.getAttribute('data-act');
                if (act === 'balance') payVipVia('/api/partner/vehicle/' + _vipCarId + '/vip/pay-with-balance');
                else if (act === 'referral') payVipVia('/api/partner/vehicle/' + _vipCarId + '/vip/pay-with-referral');
                else if (act === 'card') renderVipCardButton();
                else if (act === 'topup') renderVipTopup();
            });
        });
    }

    function renderVipCardButton() {
        var c = document.getElementById('vipCarPayPal');
        c.innerHTML = 'Loading PayPal…';
        loadPayPalSdk().then(function (pp) {
            c.innerHTML = '';
            pp.Buttons({
                style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
                createOrder: async function () {
                    var r = await fetch('/api/payments/vehicle/' + _vipCarId + '/vip/create-order', { method: 'POST', headers: vipAuthHeaders() });
                    var d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed to create order'); return d.orderId;
                },
                onApprove: async function (ad) {
                    c.innerHTML = '<div class="payment-loading">Processing…</div>';
                    var r = await fetch('/api/payments/vehicle/' + _vipCarId + '/vip/capture-order', { method: 'POST', headers: vipAuthHeaders(), body: JSON.stringify({ order_id: ad.orderID }) });
                    var d = await r.json();
                    if (!r.ok) { vipMsg(d.error || 'Capture failed.', false); c.innerHTML = ''; return; }
                    vipMsg('✓ VIP activated for 30 days!', true);
                    setTimeout(function () { closeVipCarModal(); if (window.loadVehicles) window.loadVehicles(); }, 1800);
                },
                onError: function () { vipMsg('Payment failed. Please try again.', false); }
            }).render('#vipCarPayPal');
        }).catch(function (e) { c.innerHTML = ''; vipMsg(e.message || 'PayPal unavailable.', false); });
    }

    function renderVipTopup() {
        var a = document.getElementById('vipCarActions');
        a.innerHTML = '<div style="font-size:13px;margin-bottom:8px;color:#A0A3B0;">' + tOr('partner_dashboard.vip_topup_choose', 'Choose amount to add to your VIP wallet:') + '</div>' +
            [10, 20, 30, 50].map(function (x) { return '<button class="btn btn-secondary vip-top" data-amt="' + x + '" style="margin:0 6px 6px 0;">$' + x + '</button>'; }).join('') +
            '<div><button class="btn btn-text" id="vipTopBack">' + tOr('partner_dashboard.vip_back', '← Back') + '</button></div>';
        document.getElementById('vipTopBack').addEventListener('click', function () { if (_vipWallet) renderVipActions(_vipWallet); });
        Array.prototype.forEach.call(a.querySelectorAll('.vip-top'), function (btn) {
            btn.addEventListener('click', function () { renderVipTopupButton(parseInt(btn.getAttribute('data-amt'), 10)); });
        });
    }

    function renderVipTopupButton(amt) {
        var c = document.getElementById('vipCarPayPal');
        c.innerHTML = 'Loading PayPal…';
        loadPayPalSdk().then(function (pp) {
            c.innerHTML = '';
            pp.Buttons({
                style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
                createOrder: async function () {
                    var r = await fetch('/api/payments/vip-wallet/topup/create-order', { method: 'POST', headers: vipAuthHeaders(), body: JSON.stringify({ amount: amt }) });
                    var d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed to create order'); return d.orderId;
                },
                onApprove: async function (ad) {
                    c.innerHTML = '<div class="payment-loading">Processing…</div>';
                    var r = await fetch('/api/payments/vip-wallet/topup/capture-order', { method: 'POST', headers: vipAuthHeaders(), body: JSON.stringify({ order_id: ad.orderID, amount: amt }) });
                    var d = await r.json();
                    if (!r.ok) { vipMsg(d.error || 'Top-up failed.', false); c.innerHTML = ''; return; }
                    vipMsg('✓ Wallet topped up! New balance $' + (parseFloat(d.vip_balance) || 0).toFixed(2), true);
                    c.innerHTML = '';
                    refreshVipWallet();
                },
                onError: function () { vipMsg('Top-up failed. Please try again.', false); }
            }).render('#vipCarPayPal');
        }).catch(function (e) { c.innerHTML = ''; vipMsg(e.message || 'PayPal unavailable.', false); });
    }

    console.log('✓ Partner dashboard initialized');
})();
