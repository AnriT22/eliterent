/* ========================================
   PARTNER REGISTRATION — JAVASCRIPT
   ======================================== */

(function () {
    var form = document.getElementById('partnerRegisterForm');
    if (!form) return;

    var currentStep = 1;
    var totalSteps = 2;
    var nextBtn = document.getElementById('pNextStep');
    var prevBtn = document.getElementById('pPrevStep');

    // ---- GOOGLE OAUTH: skip straight to choice step ----
    var urlParams = new URLSearchParams(window.location.search);
    var isGoogleChoice = urlParams.get('step') === 'choice';
    if (isGoogleChoice) {
        // User already registered via Google OAuth — just show the choice step
        var storedUser = null;
        try { storedUser = JSON.parse(localStorage.getItem('user')); } catch (e) {}
        enterChoiceStep({ user: storedUser || {} });
    }

    nextBtn.addEventListener('click', function () {
        if (!validatePartnerStep(currentStep)) return;
        if (currentStep < totalSteps) {
            currentStep++;
            updatePartnerUI();
        } else {
            submitPartnerRegistration();
        }
    });

    prevBtn.addEventListener('click', function () {
        if (currentStep > 1) {
            currentStep--;
            updatePartnerUI();
        }
    });

    // Live availability checks
    if (typeof initLiveAvailabilityCheck === 'function') {
        initLiveAvailabilityCheck('pEmail', 'email', 'pEmailError');
        initLiveAvailabilityCheck('pPhone', 'phone', 'pPhoneError');
    }

    // Password toggle
    document.querySelectorAll('.form-toggle-password').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var b = e.target.closest('.form-toggle-password');
            if (!b) return;
            var targetId = b.getAttribute('data-target');
            var input = document.getElementById(targetId);
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    // Phone formatting
    var phoneInput = document.getElementById('pPhone');
    if (phoneInput && typeof initPhoneFormat === 'function') {
        initPhoneFormat(phoneInput, 'pPhoneCode');
    }

    // Force uppercase on choice-step invite code input
    var choiceInviteInput = document.getElementById('pChoiceInviteCode');
    if (choiceInviteInput) {
        choiceInviteInput.addEventListener('input', function () {
            var pos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(pos, pos);
        });
    }

    // Bind choice-step buttons via event listeners (reliable across all browsers)
    var choicePayBtn = document.getElementById('choicePayBtn');
    if (choicePayBtn) {
        choicePayBtn.addEventListener('click', function (e) {
            e.preventDefault();
            choosePayPath();
        });
    }
    var choiceApplyBtnEl = document.getElementById('choiceApplyBtn');
    if (choiceApplyBtnEl) {
        choiceApplyBtnEl.addEventListener('click', function (e) {
            e.preventDefault();
            chooseInvitePath();
        });
    }

    function updatePartnerUI() {
        document.querySelectorAll('#partnerRegisterForm .registration-step').forEach(function (s) {
            s.classList.remove('active');
        });
        var target = document.querySelector('#partnerRegisterForm .registration-step[data-step="' + currentStep + '"]');
        if (target) target.classList.add('active');

        document.querySelectorAll('.registration-progress .progress-step').forEach(function (step, i) {
            var num = i + 1;
            step.classList.remove('active', 'completed');
            if (num === currentStep) step.classList.add('active');
            else if (num < currentStep) step.classList.add('completed');
        });

        prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
        nextBtn.textContent = currentStep === totalSteps ? 'Create Partner Account' : 'Next →';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function validatePartnerStep(step) {
        if (step === 1) return validateStep1();
        if (step === 2) return validateStep2();
        return true;
    }

    function validateStep1() {
        var valid = true;
        var name = document.getElementById('pFullName').value.trim();
        var email = document.getElementById('pEmail').value.trim();
        var phone = document.getElementById('pPhone').value.trim();
        var pass = document.getElementById('pPassword').value;
        var confirm = document.getElementById('pConfirmPassword').value;

        if (!name || name.length < 2) { showErr('pFullNameError', 'Full name is required'); valid = false; } else clearErr('pFullNameError');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('pEmailError', 'Valid email is required'); valid = false; } else clearErr('pEmailError');

        var phoneDigits = phone.replace(/\D/g, '');
        var pCodeEl = document.getElementById('pPhoneCode');
        var pRule = (typeof getPhoneRule === 'function') ? getPhoneRule(pCodeEl ? pCodeEl.value : '+995') : { digits: 9 };
        if (!phone || phoneDigits.length !== pRule.digits) {
            showErr('pPhoneError', 'Phone number must be exactly ' + pRule.digits + ' digits for ' + (pCodeEl ? pCodeEl.value : '+995'));
            valid = false;
        } else {
            clearErr('pPhoneError');
        }

        if (!pass || pass.length < 8) { showErr('pPasswordError', 'Password must be at least 8 characters'); valid = false; }
        else if (!/[A-Z]/.test(pass)) { showErr('pPasswordError', 'Password must contain at least one uppercase letter'); valid = false; }
        else if (!/[0-9]/.test(pass)) { showErr('pPasswordError', 'Password must contain at least one number'); valid = false; }
        else if (!/[^A-Za-z0-9]/.test(pass)) { showErr('pPasswordError', 'Password must contain at least one special character'); valid = false; }
        else clearErr('pPasswordError');
        if (pass !== confirm) { showErr('pConfirmPasswordError', 'Passwords do not match'); valid = false; } else clearErr('pConfirmPasswordError');

        return valid;
    }

    function validateStep2() {
        var valid = true;
        var company = document.getElementById('pCompanyName').value.trim();
        var terms = document.getElementById('pTerms');

        if (!company || company.length < 2) { showErr('pCompanyNameError', 'Company name is required'); valid = false; } else clearErr('pCompanyNameError');
        if (!terms.checked) { showErr('pTermsError', 'You must agree to the Partner Terms'); valid = false; } else clearErr('pTermsError');

        return valid;
    }

    async function submitPartnerRegistration() {
        var pCodeEl = document.getElementById('pPhoneCode');
        var pLocalPhone = document.getElementById('pPhone').value.trim();
        var pFullPhone = pCodeEl ? (pCodeEl.value + ' ' + pLocalPhone) : pLocalPhone;

        var payload = {
            full_name: document.getElementById('pFullName').value.trim(),
            email: document.getElementById('pEmail').value.trim(),
            phone: pFullPhone,
            password: document.getElementById('pPassword').value,
            company_name: document.getElementById('pCompanyName').value.trim(),
            location: document.getElementById('pLocation').value.trim(),
            description: document.getElementById('pDescription').value.trim(),
            telegram: document.getElementById('pTelegram').value.trim(),
        };

        nextBtn.disabled = true;
        nextBtn.textContent = 'Creating account…';

        try {
            var res = await fetch('/api/register/partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            var data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store auth token immediately
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('isLoggedIn', 'true');
            }

            // New flow: show choice step (Pay $4.99 vs Invite Code)
            if (data.needsPathSelection) {
                enterChoiceStep(data);
                return;
            }

            // Legacy invite code path (if invite_code was sent directly)
            if (data.pending_approval) {
                showPendingApproval();
                setTimeout(function () { window.location.href = 'verify-phone.html?v=2'; }, 4000);
                return;
            }

            // Fallback: redirect to verify-phone
            window.location.href = 'verify-phone.html?v=2';

        } catch (err) {
            nextBtn.disabled = false;
            nextBtn.textContent = 'Create Partner Account';
            showGlobalError(err.message);
        }
    }

    /* ---- CHOICE STEP: Pay $4.99 vs Invite Code ---- */
    function enterChoiceStep(data) {
        // Hide form and related UI
        form.style.display = 'none';
        document.getElementById('pFormActions').style.display = 'none';
        var authDivider = document.getElementById('pAuthDivider');
        var googleBtn = document.getElementById('googlePartnerBtn');
        var authFooter = document.querySelector('.auth-footer');
        if (authDivider) authDivider.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
        if (authFooter) authFooter.style.display = 'none';

        // Mark step 3 as active in progress bar
        document.querySelectorAll('.registration-progress .progress-step').forEach(function (step, i) {
            step.classList.remove('active', 'completed');
            if (i < 2) step.classList.add('completed');
            else step.classList.add('active');
        });

        // Show email and run availability check
        var email = (data.user && data.user.email) || '';
        document.getElementById('choiceEmailValue').textContent = email;
        document.getElementById('choiceEmailBadge').textContent = 'New account created';
        document.getElementById('choiceEmailBadge').style.background = 'rgba(34,197,94,0.15)';
        document.getElementById('choiceEmailBadge').style.color = '#22c55e';

        // Also do a live check in case user refreshed
        if (email) {
            fetch('/api/check-availability?field=email&value=' + encodeURIComponent(email))
                .then(function (r) { return r.json(); })
                .then(function (result) {
                    var badge = document.getElementById('choiceEmailBadge');
                    if (!result.available) {
                        badge.textContent = 'Already registered';
                        badge.style.background = 'rgba(239,68,68,0.15)';
                        badge.style.color = '#ef4444';
                    }
                })
                .catch(function () { /* ignore */ });
        }

        // Show choice step
        document.getElementById('pChoiceStep').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function choosePayPath() {
        document.getElementById('pChoiceStep').style.display = 'none';
        enterPaymentStep();
    }
    window.choosePayPath = choosePayPath;

    async function chooseInvitePath() {
        var code = document.getElementById('pChoiceInviteCode').value.trim().toUpperCase();
        var errorEl = document.getElementById('choiceInviteError');
        var btn = document.getElementById('choiceApplyBtn');

        if (!code) {
            errorEl.textContent = 'Please enter an invite code';
            errorEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Checking…';
        errorEl.style.display = 'none';

        try {
            var res = await fetch('/api/register/partner/apply-invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
                },
                body: JSON.stringify({ invite_code: code }),
            });
            var data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid invite code');
            }

            // Success — hide choice, show pending approval, then go to phone verify
            document.getElementById('pChoiceStep').style.display = 'none';
            showPendingApproval();
            setTimeout(function () { window.location.href = 'verify-phone.html?v=2'; }, 4000);

        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Apply Code';
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        }
    }
    window.chooseInvitePath = chooseInvitePath;
    window.enterChoiceStep = enterChoiceStep;

    /* ---- INVITE PATH: pending approval message ---- */
    function showPendingApproval() {
        form.style.display = 'none';
        document.getElementById('pFormActions').style.display = 'none';
        var choiceStep = document.getElementById('pChoiceStep');
        if (choiceStep) choiceStep.style.display = 'none';
        var authDivider = document.getElementById('pAuthDivider');
        var googleBtn = document.getElementById('googlePartnerBtn');
        var authFooter = document.querySelector('.auth-footer');
        if (authDivider) authDivider.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
        if (authFooter) authFooter.style.display = 'none';

        var box = document.createElement('div');
        box.className = 'pending-approval-box';
        box.innerHTML = '<span class="pab-icon">⏳</span>'
            + '<h3>Account Created — Pending Approval</h3>'
            + '<p>Your invite code was accepted. Our team will review and verify your account shortly. '
            + 'You can access your dashboard now — you\'ll be notified when approved.</p>'
            + '<p style="margin-top:10px;font-size:12px;color:#6b7280;">Redirecting to phone verification…</p>';

        var wrapper = document.querySelector('.auth-form-wrapper');
        wrapper.insertBefore(box, wrapper.firstChild);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ---- PAID PATH: PayPal payment step ---- */
    function enterPaymentStep() {
        // Hide form and Google sign-up section
        form.style.display = 'none';
        document.getElementById('pFormActions').style.display = 'none';
        var authDivider = document.getElementById('pAuthDivider');
        var googleBtn = document.getElementById('googlePartnerBtn');
        var authFooter = document.querySelector('.auth-footer');
        if (authDivider) authDivider.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
        if (authFooter) authFooter.style.display = 'none';

        var paymentStep = document.getElementById('pPaymentStep');
        paymentStep.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        loadPayPalAndRender();
    }

    async function loadPayPalAndRender() {
        var container = document.getElementById('paypalButtonContainer');
        try {
            // Get PayPal client ID from server
            var cfgRes = await fetch('/api/payments/config');
            var cfg = await cfgRes.json();

            if (!cfg.configured || !cfg.clientId) {
                showPaymentError('Payment is not configured yet. Please contact support.');
                return;
            }

            // Load PayPal JS SDK dynamically
            await new Promise(function (resolve, reject) {
                if (window.paypal) { resolve(); return; }
                var script = document.createElement('script');
                var base = cfg.mode === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
                script.src = base + '/sdk/js?client-id=' + encodeURIComponent(cfg.clientId) + '&currency=USD&intent=capture';
                script.onload = resolve;
                script.onerror = function () { reject(new Error('Failed to load PayPal SDK')); };
                document.head.appendChild(script);
            });

            // Render the PayPal button
            container.innerHTML = '';
            window.paypal.Buttons({
                style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
                createOrder: async function () {
                    var r = await fetch('/api/payments/partner/create-order', {
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
                    var r = await fetch('/api/payments/partner/capture-order', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                        },
                        body: JSON.stringify({ order_id: approveData.orderID })
                    });
                    var d = await r.json();
                    if (!r.ok) {
                        showPaymentError(d.error || 'Payment capture failed. Contact support.');
                        return;
                    }

                    // Update stored user to is_verified=1
                    try {
                        var u = JSON.parse(localStorage.getItem('user') || '{}');
                        u.is_verified = 1;
                        localStorage.setItem('user', JSON.stringify(u));
                    } catch (e) {}

                    // Show success
                    container.innerHTML = '';
                    document.getElementById('pPaymentSuccess').style.display = 'block';
                    document.querySelector('.payment-cancel-link') && (document.querySelector('.payment-cancel-link').style.display = 'none');

                    setTimeout(function () { window.location.href = 'verify-phone.html?v=2'; }, 3000);
                },
                onError: function (err) {
                    console.error('PayPal error:', err);
                    showPaymentError('Payment failed. Please try again or contact support.');
                }
            }).render('#paypalButtonContainer');

        } catch (err) {
            showPaymentError(err.message || 'Failed to load payment options.');
        }
    }

    function showPaymentError(msg) {
        var el = document.getElementById('pPaymentError');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
        var container = document.getElementById('paypalButtonContainer');
        if (container) container.innerHTML = '';
    }

    function showGlobalError(message) {
        var el = document.getElementById('partnerGlobalError');
        if (!el) {
            el = document.createElement('div');
            el.id = 'partnerGlobalError';
            el.style.cssText = 'background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;text-align:center;margin-bottom:8px;';
            var wrapper = document.querySelector('.auth-form-wrapper');
            var header = wrapper.querySelector('.auth-form-header');
            header.parentNode.insertBefore(el, header.nextSibling);
        }
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(function () { el.style.display = 'none'; }, 6000);
    }

    function showErr(id, msg) {
        var el = document.getElementById(id);
        if (el) { el.textContent = msg; el.classList.add('show'); }
    }

    function clearErr(id) {
        var el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.remove('show'); }
    }

    console.log('✓ Partner registration page initialized');
})();
