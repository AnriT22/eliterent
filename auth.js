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
    if (email.value && !isValidEmail(email.value)) {
        showEmailError('Invalid email format');
    } else {
        clearEmailError();
    }
}

function validatePassword() {
    const password = document.getElementById('password');
    if (password.value && password.value.length < 6) {
        showPasswordError('Password must be at least 6 characters');
    } else {
        clearPasswordError();
    }
}

function showEmailError(message) {
    const errorEl = document.getElementById('emailError');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function clearEmailError() {
    const errorEl = document.getElementById('emailError');
    errorEl.textContent = '';
    errorEl.classList.remove('show');
}

function showPasswordError(message) {
    const errorEl = document.getElementById('passwordError');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function clearPasswordError() {
    const errorEl = document.getElementById('passwordError');
    errorEl.textContent = '';
    errorEl.classList.remove('show');
}

function togglePasswordVisibility(e) {
    e.preventDefault();
    const targetId = e.target.dataset.target;
    const input = document.getElementById(targetId);
    const btn = e.target;

    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '👁️‍🗨️';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
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

        // Live availability checks for name, email, phone
        initLiveAvailabilityCheck('fullName', 'full_name', 'fullNameError');
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

    // Phone
    if (!phone.value.trim()) {
        showError('phoneError', 'Phone number is required');
        isValid = false;
    } else if (phone.value.replace(/\D/g, '').length < 9) {
        showError('phoneError', 'Invalid phone number');
        isValid = false;
    } else {
        clearError('phoneError');
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

        // Minimum length check
        if (fieldName === 'email' && (!value || value.length < 5)) return;
        if (fieldName === 'full_name' && (!value || value.length < 3)) return;
        if (fieldName === 'phone' && (!value || value.replace(/\D/g, '').length < 9)) return;

        // Show spinner
        el.innerHTML = '<span class="avail-spinner"></span>';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            fetch('/api/check-availability?field=' + encodeURIComponent(fieldName) + '&value=' + encodeURIComponent(value))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (input.value.trim() !== value) return; // stale
                    if (data.available) {
                        el.innerHTML = '<span style="color:#22c55e;font-weight:700;">&#10003;</span>';
                        clearError(errorId);
                    } else {
                        el.innerHTML = '<span style="color:#ef4444;font-weight:700;">&#10007;</span>';
                        var label = fieldName === 'full_name' ? 'Username' : fieldName === 'email' ? 'Email' : 'Phone number';
                        showError(errorId, label + ' is already taken');
                    }
                })
                .catch(function () {
                    el.innerHTML = '';
                });
        }, 500);
    });
}

async function submitRegistration() {
    const form = document.getElementById('registerForm');
    const nextBtn = document.getElementById('nextStep');
    const formActions = document.getElementById('formActions');

    const formData = {
        full_name: document.getElementById('fullName').value,
        email: document.getElementById('registerEmail').value,
        phone: document.getElementById('phone').value,
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

        // Hide form and show success/approval message
        form.style.display = 'none';
        formActions.style.display = 'none';

        if (data.pending_approval) {
            // Show waiting for approval message
            const successEl = document.querySelector('.success-message');
            if (successEl) {
                successEl.innerHTML = '<div class="success-icon">⏳</div><h3>Account Created!</h3><p>Your account needs to be approved by an admin before you can log in. This usually takes a few minutes.</p><a href="index.html" style="margin-top:16px;display:inline-block;padding:10px 24px;background:#3B82F6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Back to Home</a>';
                successEl.style.display = 'flex';
            }
        } else {
            // Legacy: if token returned, auto-login
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('isLoggedIn', 'true');
            }
            document.querySelector('.success-message').style.display = 'flex';
            setTimeout(() => { window.location.href = 'index.html'; }, 2500);
        }

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

    initLoginPage();
    initRegisterPage();
    initFloatingSupport();

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
