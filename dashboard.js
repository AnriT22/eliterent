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
                + (typeof I18n !== 'undefined' ? I18n.t('partner_dashboard.verified') : 'Verified') + '</span>';
        } else {
            statusEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(249,115,22,0.15);color:#f97316;border-radius:20px;font-size:12px;font-weight:600;margin-top:6px;">'
                + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
                + (typeof I18n !== 'undefined' ? I18n.t('partner_dashboard.not_approved') : 'Not Approved Yet') + '</span>';
        }
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

    // Next / Prev buttons
    document.querySelectorAll('.wz-btn-next').forEach(function (btn) {
        btn.addEventListener('click', function () { goToWizardStep(this.getAttribute('data-next')); });
    });
    document.querySelectorAll('.wz-btn-prev').forEach(function (btn) {
        btn.addEventListener('click', function () { goToWizardStep(this.getAttribute('data-prev')); });
    });

    // Click wizard step indicators
    document.querySelectorAll('.wz-step').forEach(function (s) {
        s.addEventListener('click', function () { goToWizardStep(this.getAttribute('data-step')); });
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
    }

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
            html += '<img class="db-vehicle-img" src="' + imgSrc + '" alt="' + (v.name || '') + '">';
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
            html += '<div class="db-vehicle-actions">';
            if (statusClass !== 'delete_requested') {
                html += '<button class="db-btn-edit" onclick="editVehicle(' + v.id + ')" data-i18n="partner_dashboard.edit_btn">Edit</button>';
                html += '<button class="db-btn-dates" onclick="openAvailabilityCalendar(' + v.id + ')" data-i18n="partner_dashboard.dates_btn">DATES</button>';
                html += '<button class="db-btn-delete" onclick="deleteVehicle(' + v.id + ')" data-i18n="partner_dashboard.delete_btn">Request Delete</button>';
            } else {
                html += '<span style="color:#ef4444;font-size:12px;font-style:italic;" data-i18n="partner_dashboard.awaiting_deletion">Awaiting admin approval for deletion</span>';
            }
            html += '</div>';
            html += '</div></div>';
        });

        grid.innerHTML = html;
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
            image_url: getVal('vImageUrl') || null,
            gallery: uploadedUrls.filter(function (u) { return !u.startsWith('__uploading_'); }),
            description: getVal('vDescription').trim() || null,
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
                airport_fee: getFloat('locAirportPrice'),
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
            { field: payload.location_city, name: 'City / Location' },
            { field: payload.region, name: 'Region' },
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

            setTimeout(function () {
                resetVehicleForm();
                switchTab('vehicles');
                loadVehicles();
            }, 1000);
        })
        .catch(function (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = editId ? 'Update Vehicle' : 'Add Vehicle';
            showFormMessage('Network error', 'error');
        });
    });

    function resetVehicleForm() {
        vehicleForm.reset();
        document.getElementById('vEditId').value = '';
        document.getElementById('addVehicleTitle').textContent = 'Add New Vehicle';
        document.getElementById('submitVehicleBtn').textContent = 'Add Vehicle';
        // Reset wizard to step 1
        goToWizardStep(1);
        // Restore default toggles
        var visEl = document.getElementById('vVisibleInSearch');
        if (visEl) visEl.checked = true;
        var blockEl = document.getElementById('vReturnFormatted');
        if (blockEl) blockEl.checked = true;
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
        renderUploadPreviews();
        syncImageFields();
        // Clear passport fields
        document.getElementById('vPassportFront').value = '';
        document.getElementById('vPassportBack').value = '';
        if (window.clearPassportFront) window.clearPassportFront();
        if (window.clearPassportBack) window.clearPassportBack();
        hideFormMessage();
    }

    function showFormMessage(msg, type) {
        var el = document.getElementById('vehicleFormMessage');
        el.textContent = msg;
        el.className = 'db-form-message ' + type;
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

            function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
            function setCheck(id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; }

            document.getElementById('vEditId').value = v.id;
            setVal('vName', v.name || '');
            setVal('vBrand', v.brand || '');
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
            setVal('vLocationCity', v.location_city || '');
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
            setVal('vPrice', v.price_per_day || '');
            setVal('vDeposit', v.deposit_amount || 0);
            setVal('vImageUrl', v.image_url || '');
            setVal('vDescription', v.description || '');
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

            // Insurance
            var ins = (typeof v.insurance === 'string') ? JSON.parse(v.insurance || '{}') : (v.insurance || {});
            setVal('vInsTPL', ins.tpl || '');
            setVal('vInsCDW', ins.cdw || '');
            setVal('vInsFullCoverage', ins.full_coverage || '');

            // Pickup fees
            var pf = (typeof v.pickup_fees === 'string') ? JSON.parse(v.pickup_fees || '{}') : (v.pickup_fees || {});
            setVal('locOfficeAddress', pf.office_address || '');
            setVal('locAirportPrice', pf.airport_fee || '');
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

            document.getElementById('addVehicleTitle').textContent = 'Edit Vehicle';
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
                    ppvBtn.onclick = function () { window.location.href = '/verify-phone.html'; };
                }
            }
        });
    }

    // ========================================
    // INIT
    // ========================================
    loadVehicles();
    loadProfile();

    // ========================================
    // AVAILABILITY CALENDAR
    // ========================================
    var currentVehicleId = null;
    var currentMonth = new Date();
    var availabilityData = {};
    var changedDates = new Set();

    window.openAvailabilityCalendar = function (vehicleId) {
        currentVehicleId = vehicleId;
        currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        availabilityData = {};
        changedDates.clear();
        
        var modal = document.getElementById('availabilityModal');
        modal.style.display = 'flex';
        
        loadAvailability(); // renders after data loads
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
                html += '<div class="availability-day ' + statusClass + '" data-date="' + dateStr + '" onclick="toggleDate(\'' + dateStr + '\')">' + day + '</div>';
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
                    + '<div class="db-booking-price">Total: <strong>$' + (b.total_price || 0) + '</strong>'
                    + (b.extras_total && parseFloat(b.extras_total) > 0 ? ' <span style="color:#A0A3B0;font-size:12px;">(extras: $' + parseFloat(b.extras_total).toFixed(2) + ')</span>' : '')
                    + ' &middot; <span style="color:#94a3b8;font-size:12px;">Booked ' + created + '</span></div>'
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

    console.log('✓ Partner dashboard initialized');
})();
