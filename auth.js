/* ========================================

   AUTHENTICATION - JAVASCRIPT

   ======================================== */



// ========================================

// LOGIN PAGE FUNCTIONALITY

// ========================================



function initLoginPage() {

    if (document.getElementById('loginForm')) {

        const form = document.getElementById('loginForm');

        form.addEventListener('submit', handleLoginSubmit);



        // Password toggle

        document.querySelectorAll('.form-toggle-password').forEach(btn => {

            btn.addEventListener('click', togglePasswordVisibility);

        });



        // Social login buttons

        document.querySelectorAll('.social-btn').forEach(btn => {

            btn.addEventListener('click', handleSocialLogin);

        });



        // Email validation on blur

        const emailInput = document.getElementById('email');

        emailInput.addEventListener('blur', validateEmail);

        emailInput.addEventListener('input', clearEmailError);



        // Password validation on blur

        const passwordInput = document.getElementById('password');

        passwordInput.addEventListener('blur', validatePassword);

        passwordInput.addEventListener('input', clearPasswordError);



        // Role tabs

        var roleTabs = document.querySelectorAll('.login-role-tab');

        roleTabs.forEach(function (tab) {

            tab.addEventListener('click', function () {

                roleTabs.forEach(function (t) { t.classList.remove('active'); });

                this.classList.add('active');

            });

        });



        console.log('✓ Login page initialized');

    }

}



function getSelectedLoginRole() {

    var active = document.querySelector('.login-role-tab.active');

    return active ? active.dataset.role : 'guest';

}



async function handleLoginSubmit(e) {

    e.preventDefault();



    if (!validateLoginForm()) {

        return;

    }



    const email = document.getElementById('email').value;

    const password = document.getElementById('password').value;

    const rememberMe = document.getElementById('rememberMe').checked;



    const submitBtn = e.target.querySelector('button[type="submit"]');

    const btnText = submitBtn.querySelector('.btn-text');

    const btnLoader = submitBtn.querySelector('.btn-loader');



    submitBtn.disabled = true;

    btnText.style.display = 'none';

    btnLoader.style.display = 'inline';



    try {

        const res = await fetch('/api/login', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify({ email, password, role: getSelectedLoginRole() })

        });



        const text = await res.text();

        var data;

        try { data = JSON.parse(text); } catch (e) {

            throw new Error('Server returned an invalid response. Make sure the server is running (npm start).');

        }



        if (!res.ok) {

            throw new Error(data.error || 'Login failed');

        }



        // Store token and user data

        const storage = rememberMe ? localStorage : sessionStorage;

        storage.setItem('token', data.token);

        storage.setItem('user', JSON.stringify(data.user));

        localStorage.setItem('isLoggedIn', 'true');



        if (rememberMe) {

            localStorage.setItem('userEmail', email);

            localStorage.setItem('rememberMe', 'true');

        }



        btnText.textContent = '✓ Logged in!';

        btnText.style.display = 'inline';

        btnLoader.style.display = 'none';



        // Redirect based on role (use server role, fallback to selected tab)

        var role = data.user.role || getSelectedLoginRole();

        setTimeout(() => {

            if (role === 'admin') {

                window.location.href = 'admin.html';

            } else if (role === 'partner') {

                window.location.href = 'partner-dashboard.html';

            } else {

                window.location.href = 'index.html';

            }

        }, 800);



    } catch (err) {

        submitBtn.disabled = false;

        btnText.style.display = 'inline';

        btnLoader.style.display = 'none';

        showLoginError(err.message);

    }

}



function showLoginError(message) {

    var existing = document.getElementById('loginGlobalError');

    if (!existing) {

        existing = document.createElement('div');

        existing.id = 'loginGlobalError';

        existing.style.cssText = 'background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;text-align:center;margin-bottom:8px;';

        var form = document.getElementById('loginForm');

        form.insertBefore(existing, form.firstChild);

    }

    existing.textContent = message;

    existing.style.display = 'block';

    setTimeout(function () { existing.style.display = 'none'; }, 5000);

}



function validateLoginForm() {

    const email = document.getElementById('email');

    const password = document.getElementById('password');



    let isValid = true;



    // Email validation

    if (!email.value.trim()) {

        showEmailError('Email is required');

        isValid = false;

    } else if (!isValidEmail(email.value)) {

        showEmailError('Invalid email format');

        isValid = false;

    }



    // Password validation

    if (!password.value) {

        showPasswordError('Password is required');

        isValid = false;

    }



    return isValid;

}



function validateEmail() {

    const email = document.getElementById('email');

    if (!email) return;

    if (email.value && !isValidEmail(email.value)) {

        showEmailError('Invalid email format');

    } else {

        clearEmailError();

    }

}



function validatePassword() {

    const password = document.getElementById('password');

    if (!password) return;

    if (password.value && password.value.length < 6) {

        showPasswordError('Password must be at least 6 characters');

    } else {

        clearPasswordError();

    }

}



function showEmailError(message) {

    const errorEl = document.getElementById('emailError');

    if (!errorEl) return;

    errorEl.textContent = message;

    errorEl.classList.add('show');

}



function clearEmailError() {

    const errorEl = document.getElementById('emailError');

    if (!errorEl) return;

    errorEl.textContent = '';

    errorEl.classList.remove('show');

}



function showPasswordError(message) {

    const errorEl = document.getElementById('passwordError');

    if (!errorEl) return;

    errorEl.textContent = message;

    errorEl.classList.add('show');

}



function clearPasswordError() {

    const errorEl = document.getElementById('passwordError');

    if (!errorEl) return;

    errorEl.textContent = '';

    errorEl.classList.remove('show');

}



function togglePasswordVisibility(e) {

    e.preventDefault();

    var btn = e.target.closest('.form-toggle-password');

    if (!btn) return;

    var targetId = btn.getAttribute('data-target');

    var input = document.getElementById(targetId);

    if (!input) return;

    input.type = input.type === 'password' ? 'text' : 'password';

}



function isValidEmail(email) {

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(email);

}



function handleSocialLogin(e) {

    e.preventDefault();

    const provider = e.target.closest('.social-btn').classList.contains('social-google') 

        ? 'Google' 

        : 'Facebook';

    console.log(`🔗 Social login initiated: ${provider}`);

    alert(`${provider} login would be implemented here`);

}



// Restore email if remember me was checked

function restorePreviousEmail() {

    if (localStorage.getItem('rememberMe') === 'true') {

        const email = localStorage.getItem('userEmail');

        if (email && document.getElementById('email')) {

            document.getElementById('email').value = email;

            document.getElementById('rememberMe').checked = true;

            console.log('✓ Previous email restored');

        }

    }

}



// ========================================

// REGISTRATION PAGE FUNCTIONALITY

// ========================================



function initRegisterPage() {

    if (document.getElementById('registerForm')) {

        const form = document.getElementById('registerForm');

        const nextBtn = document.getElementById('nextStep');

        const prevBtn = document.getElementById('prevStep');



        nextBtn.addEventListener('click', handleRegistrationNextStep);

        prevBtn.addEventListener('click', handleRegistrationPrevStep);



        // Password toggle

        document.querySelectorAll('.form-toggle-password').forEach(btn => {

            btn.addEventListener('click', togglePasswordVisibility);

        });



        // Password strength indicator

        const passwordInput = document.getElementById('registerPassword');

        if (passwordInput) {

            passwordInput.addEventListener('input', checkPasswordStrength);

        }



        // Confirm password validation

        const confirmPasswordInput = document.getElementById('confirmPassword');

        if (confirmPasswordInput) {

            confirmPasswordInput.addEventListener('input', validatePasswordMatch);

        }



        // Phone formatting

        const phoneInput = document.getElementById('phone');

        if (phoneInput) {

            initPhoneFormat(phoneInput);

        }



        // Live availability checks for email and phone only (names are not unique)

        initLiveAvailabilityCheck('registerEmail', 'email', 'emailError');

        initLiveAvailabilityCheck('phone', 'phone', 'phoneError');



        console.log('✓ Registration page initialized');

    }

}



let currentStep = 1;

const totalSteps = 3;



function handleRegistrationNextStep(e) {

    e.preventDefault();



    if (!validateCurrentStep()) {

        return;

    }



    if (currentStep < totalSteps) {

        currentStep++;

        updateRegistrationUI();

    } else {

        // Final submission

        submitRegistration();

    }

}



function handleRegistrationPrevStep(e) {

    e.preventDefault();

    if (currentStep > 1) {

        currentStep--;

        updateRegistrationUI();

    }

}



function validateCurrentStep() {

    if (currentStep === 1) {

        return validateRegistrationStep1();

    } else if (currentStep === 2) {

        return validateRegistrationStep2();

    } else if (currentStep === 3) {

        return validateRegistrationStep3();

    }

    return true;

}



function validateRegistrationStep1() {

    let isValid = true;

    const fullName = document.getElementById('fullName');

    const email = document.getElementById('registerEmail');

    const phone = document.getElementById('phone');



    // Full Name

    if (!fullName.value.trim()) {

        showError('fullNameError', 'Full name is required');

        isValid = false;

    } else if (fullName.value.trim().length < 3) {

        showError('fullNameError', 'Name must be at least 3 characters');

        isValid = false;

    } else {

        clearError('fullNameError');

    }



    // Email

    if (!email.value.trim()) {

        showError('emailError', 'Email is required');

        isValid = false;

    } else if (!isValidEmail(email.value)) {

        showError('emailError', 'Invalid email format');

        isValid = false;

    } else {

        clearError('emailError');

    }



    // Phone — validate per-country digit count

    if (!phone.value.trim()) {

        showError('phoneError', 'Phone number is required');

        isValid = false;

    } else {

        var phoneDigits = phone.value.replace(/\D/g, '');

        var codeEl = document.getElementById('phoneCode');

        var rule = getPhoneRule(codeEl ? codeEl.value : '+995');

        if (phoneDigits.length !== rule.digits) {

            showError('phoneError', 'Phone number must be exactly ' + rule.digits + ' digits for ' + (codeEl ? codeEl.value : '+995'));

            isValid = false;

        } else {

            clearError('phoneError');

        }

    }



    return isValid;

}



function validateRegistrationStep2() {

    let isValid = true;

    const password = document.getElementById('registerPassword');

    const confirmPassword = document.getElementById('confirmPassword');

    const dob = document.getElementById('dob');

    const country = document.getElementById('country');



    // Password

    if (!password.value) {

        showError('passwordError', 'Password is required');

        isValid = false;

    } else if (password.value.length < 8) {

        showError('passwordError', 'Password must be at least 8 characters');

        isValid = false;

    } else {

        clearError('passwordError');

    }



    // Confirm Password

    if (!confirmPassword.value) {

        showError('confirmPasswordError', 'Please confirm your password');

        isValid = false;

    } else if (password.value !== confirmPassword.value) {

        showError('confirmPasswordError', 'Passwords do not match');

        isValid = false;

    } else {

        clearError('confirmPasswordError');

    }



    // Date of Birth

    if (!dob.value) {

        showError('dobError', 'Date of birth is required');

        isValid = false;

    } else if (getAge(new Date(dob.value)) < 18) {

        showError('dobError', 'You must be at least 18 years old');

        isValid = false;

    } else {

        clearError('dobError');

    }



    // Country

    if (!country.value) {

        showError('countryError', 'Please select a country');

        isValid = false;

    } else {

        clearError('countryError');

    }



    return isValid;

}



function validateRegistrationStep3() {

    let isValid = true;

    const licenseType = document.querySelector('input[name="licenseType"]:checked');

    const termsAgree = document.getElementById('termsAgreement');

    const privacyAgree = document.getElementById('privacyAgreement');



    // License Type

    if (!licenseType) {

        showError('licenseTypeError', 'Please select a license type');

        isValid = false;

    } else {

        clearError('licenseTypeError');

    }



    // Terms

    if (!termsAgree.checked) {

        showError('termsError', 'You must agree to the Terms & Conditions');

        isValid = false;

    } else {

        clearError('termsError');

    }



    // Privacy

    if (!privacyAgree.checked) {

        showError('privacyError', 'You must agree to the Privacy Policy');

        isValid = false;

    } else {

        clearError('privacyError');

    }



    return isValid;

}



function updateRegistrationUI() {

    // Hide all steps

    document.querySelectorAll('.registration-step').forEach(step => {

        step.classList.remove('active');

    });



    // Show current step

    document.querySelector(`.registration-step[data-step="${currentStep}"]`).classList.add('active');



    // Update progress indicators

    document.querySelectorAll('.progress-step').forEach((step, index) => {

        const stepNum = index + 1;

        step.classList.remove('active', 'completed');



        if (stepNum === currentStep) {

            step.classList.add('active');

        } else if (stepNum < currentStep) {

            step.classList.add('completed');

        }

    });



    // Update buttons

    const prevBtn = document.getElementById('prevStep');

    const nextBtn = document.getElementById('nextStep');



    prevBtn.style.display = currentStep === 1 ? 'none' : 'block';

    nextBtn.textContent = currentStep === totalSteps ? 'Create Account' : 'Next →';



    // Scroll to top

    window.scrollTo({ top: 0, behavior: 'smooth' });

}



// ========================================

// LIVE AVAILABILITY CHECK

// ========================================



function initLiveAvailabilityCheck(inputId, fieldName, errorId) {

    const input = document.getElementById(inputId);

    if (!input) return;



    let debounceTimer = null;

    let statusEl = null;



    // Create status indicator element next to the input

    function ensureStatusEl() {

        if (statusEl) return statusEl;

        statusEl = document.createElement('span');

        statusEl.className = 'availability-status';

        statusEl.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:16px;transition:opacity 0.2s;';

        const wrapper = input.closest('.form-input-wrapper');

        if (wrapper) {

            wrapper.style.position = 'relative';

            wrapper.appendChild(statusEl);

        }

        return statusEl;

    }



    input.addEventListener('input', function () {

        const value = input.value.trim();

        const el = ensureStatusEl();



        // Clear previous state

        clearError(errorId);

        el.innerHTML = '';



        // Only check email and phone — full_name is not unique

        if (fieldName === 'full_name') return;



        // Minimum length check

        if (fieldName === 'email' && (!value || value.length < 5)) return;

        if (fieldName === 'phone' && (!value || value.replace(/\D/g, '').length < 5)) return;



        // Show spinner

        el.innerHTML = '<span class="avail-spinner"></span>';



        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(function () {

            // For email: first verify domain exists (MX check), then check availability

            if (fieldName === 'email') {

                fetch('/api/verify-email?email=' + encodeURIComponent(value))

                    .then(function (res) { return res.json(); })

                    .then(function (vData) {

                        if (input.value.trim() !== value) return;

                        if (!vData.valid) {

                            el.innerHTML = '<span style="color:#ef4444;font-weight:700;">&#10007;</span>';

                            showError(errorId, vData.reason || 'This email address does not exist');

                            return;

                        }

                        // Email domain is valid — now check if taken

                        return fetch('/api/check-availability?field=email&value=' + encodeURIComponent(value))

                            .then(function (res) { return res.json(); })

                            .then(function (data) {

                                if (input.value.trim() !== value) return;

                                if (data.available) {

                                    el.innerHTML = '<span style="color:#22c55e;font-weight:700;">&#10003;</span>';

                                    clearError(errorId);

                                } else {

                                    el.innerHTML = '<span style="color:#ef4444;font-weight:700;">&#10007;</span>';

                                    showError(errorId, 'Email is already taken');

                                }

                            });

                    })

                    .catch(function () { el.innerHTML = ''; });

            } else {

                var checkValue = value;

                // For phone: combine country code from dropdown with local number

                if (fieldName === 'phone') {

                    var codeEl = document.getElementById('phoneCode') || document.getElementById('pPhoneCode');

                    if (codeEl) checkValue = codeEl.value + ' ' + value;

                }

                fetch('/api/check-availability?field=' + encodeURIComponent(fieldName) + '&value=' + encodeURIComponent(checkValue))

                    .then(function (res) { return res.json(); })

                    .then(function (data) {

                        if (input.value.trim() !== value) return;

                        if (data.available) {

                            el.innerHTML = '<span style="color:#22c55e;font-weight:700;">&#10003;</span>';

                            clearError(errorId);

                        } else {

                            el.innerHTML = '<span style="color:#ef4444;font-weight:700;">&#10007;</span>';

                            var label = fieldName === 'full_name' ? 'Username' : 'Phone number';

                            showError(errorId, label + ' is already taken');

                        }

                    })

                    .catch(function () { el.innerHTML = ''; });

            }

        }, 500);

    });

}



async function submitRegistration() {

    const form = document.getElementById('registerForm');

    const nextBtn = document.getElementById('nextStep');

    const formActions = document.getElementById('formActions');



    var phoneCode = document.getElementById('phoneCode');

    var phoneVal = document.getElementById('phone').value.trim();

    var fullPhone = phoneCode ? (phoneCode.value + ' ' + phoneVal) : phoneVal;



    const formData = {

        full_name: document.getElementById('fullName').value,

        email: document.getElementById('registerEmail').value,

        phone: fullPhone,

        password: document.getElementById('registerPassword').value

    };



    nextBtn.disabled = true;

    nextBtn.textContent = 'Creating account...';



    try {

        const res = await fetch('/api/register/guest', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify(formData)

        });



        const text = await res.text();

        var data;

        try { data = JSON.parse(text); } catch (e) {

            throw new Error('Server returned an invalid response. Make sure the server is running (npm start).');

        }



        if (!res.ok) {

            throw new Error(data.error || 'Registration failed');

        }



        // Check if OTP verification is required

        if (data.requiresVerification && data.userId) {

            nextBtn.disabled = false;

            nextBtn.textContent = 'Create Account';



            // Store token immediately so skip works

            if (data.token) {

                localStorage.setItem('token', data.token);

                localStorage.setItem('user', JSON.stringify(data.user));

                localStorage.setItem('isLoggedIn', 'true');

            }



            // Redirect to verify-phone page (SMS sent only when user clicks "Send Code")

            window.location.href = 'verify-phone.html';

            return;

        }



        // Legacy flow (no OTP required - shouldn't happen with new backend)

        if (data.token) {

            localStorage.setItem('token', data.token);

            localStorage.setItem('user', JSON.stringify(data.user));

            localStorage.setItem('isLoggedIn', 'true');

        }



        form.style.display = 'none';

        formActions.style.display = 'none';



        const successEl = document.querySelector('.success-message');

        if (successEl) {

            successEl.innerHTML = '<div class="success-icon" style="background:#88BDF2;color:#0c1117;">&#10003;</div>'

                + '<h3 style="color:#fff;">Welcome to EliteAuto!</h3>'

                + '<p style="color:#94a3b8;margin-bottom:12px;">Your account has been created successfully.</p>'

                + '<p style="color:#A0A3B0;font-size:12px;">Redirecting to homepage...</p>';

            successEl.style.display = 'flex';

            successEl.style.flexDirection = 'column';

            successEl.style.alignItems = 'center';

        }



        setTimeout(function () { window.location.href = 'index.html'; }, 4000);



    } catch (err) {

        nextBtn.disabled = false;

        nextBtn.textContent = 'Create Account';

        showRegisterError(err.message);

    }

}



function showRegisterError(message) {

    var existing = document.getElementById('registerGlobalError');

    if (!existing) {

        existing = document.createElement('div');

        existing.id = 'registerGlobalError';

        existing.style.cssText = 'background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;text-align:center;margin-bottom:8px;';

        var wrapper = document.querySelector('.auth-form-wrapper');

        var formHeader = wrapper.querySelector('.auth-form-header');

        formHeader.parentNode.insertBefore(existing, formHeader.nextSibling);

    }

    existing.textContent = message;

    existing.style.display = 'block';

    setTimeout(function () { existing.style.display = 'none'; }, 5000);

}



function checkPasswordStrength(e) {

    const password = e.target.value;

    const strengthEl = document.getElementById('passwordStrength');



    let strength = 'weak';

    let score = 0;



    if (password.length >= 8) score++;

    if (password.length >= 12) score++;

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;

    if (/\d/.test(password)) score++;

    if (/[^a-zA-Z\d]/.test(password)) score++;



    if (score >= 4) {

        strength = 'strong';

    } else if (score >= 2) {

        strength = 'medium';

    }



    strengthEl.className = `password-strength ${strength}`;

    console.log(`Password strength: ${strength}`);

}



function validatePasswordMatch() {

    const password = document.getElementById('registerPassword').value;

    const confirmPassword = document.getElementById('confirmPassword').value;



    if (confirmPassword && password !== confirmPassword) {

        showError('confirmPasswordError', 'Passwords do not match');

    } else {

        clearError('confirmPasswordError');

    }

}



function showError(errorId, message) {

    const errorEl = document.getElementById(errorId);

    if (errorEl) {

        errorEl.textContent = message;

        errorEl.classList.add('show');

    }

}



function clearError(errorId) {

    const errorEl = document.getElementById(errorId);

    if (errorEl) {

        errorEl.textContent = '';

        errorEl.classList.remove('show');

    }

}



function getAge(birthDate) {

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();



    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {

        age--;

    }



    return age;

}



// ========================================

// PHONE FORMAT HELPER

// ========================================



// Country code → { digits: exact local digit count, placeholder: display hint }

var PHONE_COUNTRY_RULES = {

    '+995':  { digits: 9,  placeholder: '5XX XXX XXX' },        // Georgia

    '+1':    { digits: 10, placeholder: 'XXX XXX XXXX' },       // USA / Canada

    '+44':   { digits: 10, placeholder: 'XXXX XXXXXX' },        // UK

    '+49':   { digits: 11, placeholder: 'XXX XXXXXXXX' },       // Germany

    '+33':   { digits: 9,  placeholder: 'X XX XX XX XX' },      // France

    '+34':   { digits: 9,  placeholder: 'XXX XXX XXX' },        // Spain

    '+39':   { digits: 10, placeholder: 'XXX XXX XXXX' },       // Italy

    '+90':   { digits: 10, placeholder: 'XXX XXX XXXX' },       // Turkey

    '+7':    { digits: 10, placeholder: 'XXX XXX XX XX' },      // Russia

    '+380':  { digits: 9,  placeholder: 'XX XXX XX XX' },       // Ukraine

    '+48':   { digits: 9,  placeholder: 'XXX XXX XXX' },        // Poland

    '+31':   { digits: 9,  placeholder: 'X XXXX XXXX' },        // Netherlands

    '+46':   { digits: 9,  placeholder: 'XX XXX XX XX' },       // Sweden

    '+41':   { digits: 9,  placeholder: 'XX XXX XX XX' },       // Switzerland

    '+43':   { digits: 10, placeholder: 'XXX XXXXXXX' },        // Austria

    '+32':   { digits: 9,  placeholder: 'XXX XX XX XX' },       // Belgium

    '+351':  { digits: 9,  placeholder: 'XXX XXX XXX' },        // Portugal

    '+30':   { digits: 10, placeholder: 'XXX XXX XXXX' },       // Greece

    '+972':  { digits: 9,  placeholder: 'XX XXX XXXX' },        // Israel

    '+971':  { digits: 9,  placeholder: 'XX XXX XXXX' },        // UAE

    '+966':  { digits: 9,  placeholder: 'XX XXX XXXX' },        // Saudi Arabia

    '+91':   { digits: 10, placeholder: 'XXXXX XXXXX' },        // India

    '+86':   { digits: 11, placeholder: 'XXX XXXX XXXX' },      // China

    '+81':   { digits: 10, placeholder: 'XX XXXX XXXX' },       // Japan

    '+82':   { digits: 10, placeholder: 'XX XXXX XXXX' },       // South Korea

    '+61':   { digits: 9,  placeholder: 'XXX XXX XXX' },        // Australia

    '+55':   { digits: 11, placeholder: 'XX XXXXX XXXX' },      // Brazil

    '+374':  { digits: 8,  placeholder: 'XX XXX XXX' },         // Armenia

    '+994':  { digits: 9,  placeholder: 'XX XXX XX XX' }        // Azerbaijan

};



function getPhoneRule(codeValue) {

    return PHONE_COUNTRY_RULES[codeValue] || { digits: 10, placeholder: 'Phone number' };

}



function initPhoneFormat(input, codeSelectId) {

    var codeSelect = document.getElementById(codeSelectId || 'phoneCode');



    function applyFormat() {

        var rule = getPhoneRule(codeSelect ? codeSelect.value : '+995');

        var raw = input.value.replace(/\D/g, '');

        if (raw.length > rule.digits) raw = raw.slice(0, rule.digits);



        // Build format pattern from placeholder (groups separated by spaces)

        var groups = rule.placeholder.split(' ');

        var formatted = '';

        var pos = 0;

        for (var i = 0; i < groups.length && pos < raw.length; i++) {

            var len = groups[i].length;

            if (i > 0) formatted += ' ';

            formatted += raw.slice(pos, pos + len);

            pos += len;

        }

        input.value = formatted;

    }



    function updatePlaceholder() {

        var rule = getPhoneRule(codeSelect ? codeSelect.value : '+995');

        input.placeholder = rule.placeholder;

        input.setAttribute('maxlength', rule.digits + Math.floor(rule.digits / 3));

    }



    input.addEventListener('input', applyFormat);



    if (codeSelect) {

        codeSelect.addEventListener('change', function () {

            updatePlaceholder();

            input.value = '';

            input.focus();

        });

    }



    updatePlaceholder();

}



// ========================================

// GOOGLE OAUTH

// ========================================



var GOOGLE_CLIENT_ID = null;



function initGoogleAuth() {

    fetch('/api/config/google-client-id')

        .then(function(res) { return res.json(); })

        .then(function(data) {

            if (!data.clientId) {

                hideGoogleButtons();

                return;

            }

            GOOGLE_CLIENT_ID = data.clientId;

            bindGoogleButtons();

        })

        .catch(function() {

            hideGoogleButtons();

        });

}



function hideGoogleButtons() {

    var btns = document.querySelectorAll('#googleLoginBtn, #googleRegisterBtn, #googlePartnerBtn');

    btns.forEach(function(btn) { btn.style.display = 'none'; });

    var dividers = document.querySelectorAll('.auth-divider');

    dividers.forEach(function(d) {

        var next = d.nextElementSibling;

        if (next && (next.id === 'googleLoginBtn' || next.id === 'googleRegisterBtn' || next.id === 'googlePartnerBtn')) {

            d.style.display = 'none';

        }

    });

}



function bindGoogleButtons() {

    // Simple approach: clicking the Google button redirects to our server-side OAuth URL

    var loginBtn = document.getElementById('googleLoginBtn');

    if (loginBtn) {

        loginBtn.addEventListener('click', function() {

            var role = (typeof getSelectedLoginRole === 'function') ? getSelectedLoginRole() : 'guest';

            startGoogleOAuth(role, loginBtn);

        });

    }



    var registerBtn = document.getElementById('googleRegisterBtn');

    if (registerBtn) {

        registerBtn.addEventListener('click', function() {

            startGoogleOAuth('guest', registerBtn);

        });

    }



    var partnerBtn = document.getElementById('googlePartnerBtn');

    if (partnerBtn) {

        partnerBtn.addEventListener('click', function() {

            startGoogleOAuth('partner', partnerBtn);

        });

    }

}



function startGoogleOAuth(role, btn) {

    // Store role for when the callback returns

    sessionStorage.setItem('google_oauth_role', role);



    // Show loading

    if (btn) {

        btn.disabled = true;

        var span = btn.querySelector('span');

        if (span) span.textContent = 'Connecting...';

    }



    // Fetch signed CSRF state from server before redirecting

    fetch('/api/auth/google/state?role=' + encodeURIComponent(role))

        .then(function(r) { return r.json(); })

        .then(function(data) {

            var redirectUri = window.location.origin + '/api/auth/google/callback';

            var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +

                'client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID) +

                '&redirect_uri=' + encodeURIComponent(redirectUri) +

                '&response_type=code' +

                '&scope=' + encodeURIComponent('openid email profile') +

                '&state=' + encodeURIComponent(data.state) +

                '&prompt=select_account';

            window.location.href = authUrl;

        })

        .catch(function() {

            // Fallback: redirect without signed state (server will reject but user can retry)

            if (btn) { btn.disabled = false; var s = btn.querySelector('span'); if (s) s.textContent = 'Login with Google'; }

            alert('Failed to initialize Google login. Please try again.');

        });

}



// ========================================

// FLOATING SUPPORT BUTTON

// ========================================



function initFloatingSupport() {

    const supportBtn = document.querySelector('.support-btn');

    if (supportBtn) {

        supportBtn.addEventListener('click', openSupportChat);

    }

}



function openSupportChat() {

    console.log('💬 Support chat opened');

    alert('Support team would be available here to assist you!');

}



// ========================================

// INITIALIZATION

// ========================================



function initAuthPages() {

    console.log('🔐 Initializing authentication pages...');



    // Show Google OAuth error if redirected back with ?error=

    var urlParams = new URLSearchParams(window.location.search);

    var googleError = urlParams.get('error');

    if (googleError) {

        setTimeout(function() {

            if (typeof showLoginError === 'function') {

                showLoginError(googleError);

            } else {

                alert(googleError);

            }

        }, 500);

        // Clean URL

        if (window.history && window.history.replaceState) {

            window.history.replaceState({}, '', window.location.pathname);

        }

    }



    initLoginPage();

    initRegisterPage();

    initFloatingSupport();

    initGoogleAuth();



    // Check if user is already logged in

    checkAuthStatus();



    console.log('✓ Authentication pages initialized');

}



function checkAuthStatus() {

    const isLoggedIn = sessionStorage.getItem('isLoggedIn');

    if (isLoggedIn && !window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {

        console.log('✓ User already logged in');

    }

}



// ========================================

// NAVIGATION HELPERS

// ========================================



function redirectToLogin() {

    window.location.href = 'login.html';

}



function redirectToRegister() {

    window.location.href = 'register.html';

}



function logout() {

    sessionStorage.removeItem('isLoggedIn');

    localStorage.removeItem('rememberMe');

    console.log('✓ User logged out');

    window.location.href = 'index.html';

}



// ========================================

// RUN INITIALIZATION

// ========================================



if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', initAuthPages);

} else {

    initAuthPages();

}



// Restore email on login page if available

window.addEventListener('load', restorePreviousEmail);

