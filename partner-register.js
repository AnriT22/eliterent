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

    // Live availability checks (function defined in auth.js)
    if (typeof initLiveAvailabilityCheck === 'function') {
        initLiveAvailabilityCheck('pFullName', 'full_name', 'pFullNameError');
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
        initPhoneFormat(phoneInput);
    }

    function updatePartnerUI() {
        // Hide all steps
        document.querySelectorAll('#partnerRegisterForm .registration-step').forEach(function (s) {
            s.classList.remove('active');
        });
        // Show current
        var target = document.querySelector('#partnerRegisterForm .registration-step[data-step="' + currentStep + '"]');
        if (target) target.classList.add('active');

        // Progress indicators
        document.querySelectorAll('.registration-progress .progress-step').forEach(function (step, i) {
            var num = i + 1;
            step.classList.remove('active', 'completed');
            if (num === currentStep) step.classList.add('active');
            else if (num < currentStep) step.classList.add('completed');
        });

        // Buttons
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

        // Phone validation: must have 9-12 digits
        var phoneDigits = phone.replace(/\D/g, '');
        if (!phone || phoneDigits.length < 9 || phoneDigits.length > 12) {
            showErr('pPhoneError', 'Phone must be 9-12 digits (e.g. +995 5XX XXX XXX)');
            valid = false;
        } else {
            clearErr('pPhoneError');
        }

        if (!pass || pass.length < 6) { showErr('pPasswordError', 'Password must be at least 6 characters'); valid = false; } else clearErr('pPasswordError');
        if (pass !== confirm) { showErr('pConfirmPasswordError', 'Passwords do not match'); valid = false; } else clearErr('pConfirmPasswordError');

        return valid;
    }

    function validateStep2() {
        var valid = true;
        var company = document.getElementById('pCompanyName').value.trim();
        var terms = document.getElementById('pTerms');

        if (!company || company.length < 2) { showErr('pCompanyNameError', 'Company name is required'); valid = false; } else clearErr('pCompanyNameError');

        if (!terms.checked) {
            showErr('pTermsError', 'You must agree to the Partner Terms');
            valid = false;
        } else {
            clearErr('pTermsError');
        }

        return valid;
    }

    function getCheckedValues(name) {
        var vals = [];
        document.querySelectorAll('#partnerRegisterForm input[name="' + name + '"]:checked').forEach(function (cb) {
            vals.push(cb.value);
        });
        return vals;
    }

    async function submitPartnerRegistration() {
        var formActions = document.getElementById('pFormActions');

        var payload = {
            full_name: document.getElementById('pFullName').value.trim(),
            email: document.getElementById('pEmail').value.trim(),
            phone: document.getElementById('pPhone').value.trim(),
            password: document.getElementById('pPassword').value,
            company_name: document.getElementById('pCompanyName').value.trim(),
            location: document.getElementById('pLocation').value.trim(),
            description: document.getElementById('pDescription').value.trim(),
            telegram: document.getElementById('pTelegram').value.trim(),
        };

        nextBtn.disabled = true;
        nextBtn.textContent = 'Creating account...';

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

            // Auto-login: store token and user
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('isLoggedIn', 'true');
            }

            // Hide form
            form.style.display = 'none';
            formActions.style.display = 'none';

            var successEl = document.getElementById('partnerSuccessMessage');
            if (successEl) {
                successEl.innerHTML = '<div class="success-icon" style="background:#88BDF2;color:#0c1117;">&#10003;</div>'
                    + '<h3 style="color:#fff;">Welcome, Partner!</h3>'
                    + '<p style="color:#94a3b8;margin-bottom:12px;">Your partner account has been created.</p>'
                    + '<div style="background:rgba(136,189,242,0.1);border:1px solid rgba(136,189,242,0.2);border-radius:12px;padding:16px;margin:12px 0;text-align:left;">'
                    + '<p style="color:#BDDDFC;font-size:14px;font-weight:600;margin:0 0 6px;">Please note:</p>'
                    + '<p style="color:#94a3b8;font-size:13px;margin:0;">An admin will review and verify your account. Until verified, you can access your dashboard but cannot add vehicles or receive bookings. Your dashboard updates automatically once approved.</p>'
                    + '</div>'
                    + '<p style="color:#64748b;font-size:12px;">Redirecting to your dashboard...</p>';
                successEl.style.display = 'flex';
                successEl.style.flexDirection = 'column';
                successEl.style.alignItems = 'center';
            }

            setTimeout(function () { window.location.href = 'partner-dashboard.html'; }, 4000);

        } catch (err) {
            nextBtn.disabled = false;
            nextBtn.textContent = 'Create Partner Account';
            showGlobalError(err.message);
        }
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
        setTimeout(function () { el.style.display = 'none'; }, 5000);
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
