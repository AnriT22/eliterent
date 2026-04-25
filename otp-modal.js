/* ========================================
   OTP VERIFICATION MODAL
   Reusable component for 2FA verification
   ======================================== */

(function() {
    'use strict';

    var OTPModal = {
        overlay: null,
        inputs: [],
        timer: null,
        countdown: 300,
        resendCooldown: 0,
        onSuccess: null,
        onCancel: null,
        config: {}
    };

    // Create modal HTML
    function createModal() {
        if (document.getElementById('otpOverlay')) return;

        var html = `
            <div class="otp-overlay" id="otpOverlay">
                <div class="otp-modal">
                    <button class="otp-close" id="otpClose" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>

                    <div class="otp-icon" id="otpIcon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                    </div>

                    <h2 class="otp-title" id="otpTitle">Verify Your Phone</h2>
                    <p class="otp-subtitle" id="otpSubtitle">
                        Enter the 6-digit code sent to <strong id="otpPhone">****1234</strong>
                    </p>

                    <div class="otp-error" id="otpError">
                        <svg class="otp-error-icon" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4m0 4h.01"/>
                        </svg>
                        <span class="otp-error-text" id="otpErrorText">Invalid code</span>
                    </div>

                    <div class="otp-inputs" id="otpInputs">
                        <input type="text" inputmode="numeric" class="otp-input" data-index="0" autocomplete="one-time-code">
                        <input type="text" inputmode="numeric" class="otp-input" data-index="1">
                        <input type="text" inputmode="numeric" class="otp-input" data-index="2">
                        <input type="text" inputmode="numeric" class="otp-input" data-index="3">
                        <input type="text" inputmode="numeric" class="otp-input" data-index="4">
                        <input type="text" inputmode="numeric" class="otp-input" data-index="5">
                    </div>

                    <div class="otp-timer">
                        <span class="otp-timer-text">Code expires in </span>
                        <span class="otp-timer-countdown" id="otpCountdown">05:00</span>
                    </div>

                    <div class="otp-resend">
                        <button class="otp-resend-btn" id="otpResendBtn">Resend Code</button>
                        <span class="otp-resend-cooldown" id="otpResendCooldown"></span>
                    </div>

                    <button class="otp-verify-btn" id="otpVerifyBtn" disabled>Verify Code</button>

                    <button class="otp-skip-btn" id="otpSkipBtn" style="display:none;background:transparent;border:1px solid rgba(255,255,255,0.12);color:#94a3b8;padding:10px 20px;border-radius:10px;cursor:pointer;font-size:14px;width:100%;margin-top:8px;transition:all 0.2s;">Skip for now</button>

                    <div class="otp-attempts" id="otpAttempts"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        OTPModal.overlay = document.getElementById('otpOverlay');
        OTPModal.inputs = Array.from(document.querySelectorAll('.otp-input'));

        setupEventListeners();
    }

    // Setup event listeners
    function setupEventListeners() {
        // Close button
        document.getElementById('otpClose').addEventListener('click', function() {
            hide();
            if (OTPModal.onCancel) OTPModal.onCancel();
        });

        // Click outside to close
        OTPModal.overlay.addEventListener('click', function(e) {
            if (e.target === OTPModal.overlay) {
                hide();
                if (OTPModal.onCancel) OTPModal.onCancel();
            }
        });

        // Input handling
        OTPModal.inputs.forEach(function(input, index) {
            input.addEventListener('input', function(e) {
                var value = e.target.value.replace(/\D/g, '');

                // Multi-digit paste detected (mobile often fires input instead of paste)
                if (value.length > 1) {
                    var digits = value.slice(0, 6);
                    digits.split('').forEach(function(digit, i) {
                        if (OTPModal.inputs[i]) {
                            OTPModal.inputs[i].value = digit;
                        }
                    });
                    OTPModal.inputs[Math.min(digits.length, 5)].focus();
                    updateInputStates();
                    checkComplete();
                    return;
                }

                e.target.value = value.slice(0, 1);

                if (value && index < 5) {
                    OTPModal.inputs[index + 1].focus();
                }

                updateInputStates();
                checkComplete();
            });

            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    OTPModal.inputs[index - 1].focus();
                }
                if (e.key === 'Enter') {
                    document.getElementById('otpVerifyBtn').click();
                }
            });

            input.addEventListener('paste', function(e) {
                e.preventDefault();
                var cbd = e.clipboardData || window.clipboardData;
                var paste = cbd ? cbd.getData('text') : '';
                var digits = paste.replace(/\D/g, '').slice(0, 6);

                if (digits.length > 0) {
                    digits.split('').forEach(function(digit, i) {
                        if (OTPModal.inputs[i]) {
                            OTPModal.inputs[i].value = digit;
                        }
                    });
                    OTPModal.inputs[Math.min(digits.length, 5)].focus();
                    updateInputStates();
                    checkComplete();
                } else {
                    // Fallback: some mobile browsers don't expose clipboardData
                    var self = this;
                    setTimeout(function() {
                        var val = self.value.replace(/\D/g, '');
                        if (val.length > 1) {
                            val.slice(0, 6).split('').forEach(function(digit, i) {
                                if (OTPModal.inputs[i]) OTPModal.inputs[i].value = digit;
                            });
                            OTPModal.inputs[Math.min(val.length, 5)].focus();
                            updateInputStates();
                            checkComplete();
                        }
                    }, 0);
                }
            });

            input.addEventListener('focus', function(e) {
                e.target.select();
            });
        });

        // Verify button
        document.getElementById('otpVerifyBtn').addEventListener('click', verify);

        // Resend button
        document.getElementById('otpResendBtn').addEventListener('click', resend);

        // Skip button
        document.getElementById('otpSkipBtn').addEventListener('click', function() {
            hide();
            if (OTPModal.onCancel) OTPModal.onCancel();
        });

        // Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && OTPModal.overlay.classList.contains('active')) {
                hide();
                if (OTPModal.onCancel) OTPModal.onCancel();
            }
        });
    }

    // Update input visual states
    function updateInputStates() {
        OTPModal.inputs.forEach(function(input) {
            input.classList.remove('filled', 'error');
            if (input.value) {
                input.classList.add('filled');
            }
        });
    }

    // Check if all inputs are filled
    function checkComplete() {
        var code = getCode();
        var btn = document.getElementById('otpVerifyBtn');
        btn.disabled = code.length !== 6;
    }

    // Get entered code
    function getCode() {
        return OTPModal.inputs.map(function(input) {
            return input.value;
        }).join('');
    }

    // Clear inputs
    function clearInputs() {
        OTPModal.inputs.forEach(function(input) {
            input.value = '';
            input.classList.remove('filled', 'error');
        });
        document.getElementById('otpVerifyBtn').disabled = true;
    }

    // Show error
    function showError(message, remainingAttempts) {
        var errorEl = document.getElementById('otpError');
        var errorText = document.getElementById('otpErrorText');
        var attemptsEl = document.getElementById('otpAttempts');

        if (!errorText || !errorEl) return;
        errorText.textContent = message;
        errorEl.classList.add('visible');

        OTPModal.inputs.forEach(function(input) {
            input.classList.add('error');
        });

        if (typeof remainingAttempts === 'number' && attemptsEl) {
            attemptsEl.textContent = remainingAttempts + ' attempt' + (remainingAttempts !== 1 ? 's' : '') + ' remaining';
            attemptsEl.className = 'otp-attempts';
            if (remainingAttempts <= 2) attemptsEl.classList.add('warning');
            if (remainingAttempts <= 1) attemptsEl.classList.add('danger');
        }

        setTimeout(function() {
            OTPModal.inputs.forEach(function(input) {
                input.classList.remove('error');
            });
        }, 500);
    }

    // Hide error
    function hideError() {
        document.getElementById('otpError').classList.remove('visible');
    }

    // Start countdown timer
    function startTimer(seconds) {
        OTPModal.countdown = seconds || 300;
        updateTimerDisplay();

        if (OTPModal.timer) clearInterval(OTPModal.timer);

        OTPModal.timer = setInterval(function() {
            OTPModal.countdown--;
            updateTimerDisplay();

            if (OTPModal.countdown <= 0) {
                clearInterval(OTPModal.timer);
                showError('Code expired. Please request a new one.');
                document.getElementById('otpVerifyBtn').disabled = true;
            }
        }, 1000);
    }

    // Update timer display
    function updateTimerDisplay() {
        var el = document.getElementById('otpCountdown');
        if (!el) return;
        var mins = Math.floor(OTPModal.countdown / 60);
        var secs = OTPModal.countdown % 60;
        el.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

        el.className = 'otp-timer-countdown';
        if (OTPModal.countdown <= 60) el.classList.add('warning');
        if (OTPModal.countdown <= 30) el.classList.add('danger');
    }

    // Start resend cooldown
    function startResendCooldown(seconds) {
        OTPModal.resendCooldown = seconds || 60;
        var btn = document.getElementById('otpResendBtn');
        var cooldownEl = document.getElementById('otpResendCooldown');

        btn.disabled = true;
        btn.style.display = 'none';
        if (cooldownEl) cooldownEl.textContent = 'Resend available in ' + OTPModal.resendCooldown + 's';

        var interval = setInterval(function() {
            OTPModal.resendCooldown--;
            if (cooldownEl) cooldownEl.textContent = 'Resend available in ' + OTPModal.resendCooldown + 's';

            if (OTPModal.resendCooldown <= 0) {
                clearInterval(interval);
                btn.disabled = false;
                btn.style.display = 'inline-block';
                if (cooldownEl) cooldownEl.textContent = '';
            }
        }, 1000);
    }

    // Verify code
    async function verify() {
        var code = getCode();
        if (code.length !== 6) return;

        var btn = document.getElementById('otpVerifyBtn');
        btn.classList.add('loading');
        btn.disabled = true;
        hideError();

        try {
            var response = await fetch(OTPModal.config.verifyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': OTPModal.config.token ? 'Bearer ' + OTPModal.config.token : ''
                },
                body: JSON.stringify({
                    code: code,
                    userId: OTPModal.config.userId,
                    booking_id: OTPModal.config.bookingId
                })
            });

            var data = await response.json();

            if (response.ok && data.success) {
                showSuccess(data);
            } else {
                showError(data.error || 'Invalid code', data.remainingAttempts);
                clearInputs();
                OTPModal.inputs[0].focus();

                if (data.cancelled || data.needsResend) {
                    clearInterval(OTPModal.timer);
                    document.getElementById('otpVerifyBtn').disabled = true;
                }
            }
        } catch (err) {
            showError('Verification failed. Please try again.');
            clearInputs();
        } finally {
            btn.classList.remove('loading');
            checkComplete();
        }
    }

    // Resend code
    async function resend() {
        var btn = document.getElementById('otpResendBtn');
        btn.disabled = true;
        hideError();

        try {
            var response = await fetch(OTPModal.config.resendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': OTPModal.config.token ? 'Bearer ' + OTPModal.config.token : ''
                },
                body: JSON.stringify({
                    userId: OTPModal.config.userId,
                    booking_id: OTPModal.config.bookingId
                })
            });

            var data = await response.json();

            if (response.ok && data.success) {
                clearInputs();
                startTimer(data.expiresIn || 300);
                startResendCooldown(60);
                OTPModal.inputs[0].focus();

                if (data.phoneLast4) {
                    var phoneEl = document.getElementById('otpPhone');
                    if (phoneEl) phoneEl.textContent = '****' + data.phoneLast4;
                }
            } else {
                showError(data.error || 'Failed to resend code');
                if (data.waitSeconds) {
                    startResendCooldown(data.waitSeconds);
                }
            }
        } catch (err) {
            showError('Failed to resend code. Please try again.');
        } finally {
            btn.disabled = false;
        }
    }

    // Show success state
    function showSuccess(data) {
        clearInterval(OTPModal.timer);

        var icon = document.getElementById('otpIcon');
        icon.classList.add('success');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 13l4 4L19 7"/></svg>';

        var titleEl = document.getElementById('otpTitle');
        var subtitleEl = document.getElementById('otpSubtitle');
        if (titleEl) titleEl.textContent = 'Verified!';
        if (subtitleEl) subtitleEl.textContent = data.message || 'Verification successful';
        document.getElementById('otpInputs').style.display = 'none';
        document.querySelector('.otp-timer').style.display = 'none';
        document.querySelector('.otp-resend').style.display = 'none';
        document.getElementById('otpVerifyBtn').style.display = 'none';
        document.getElementById('otpAttempts').style.display = 'none';
        document.getElementById('otpError').classList.remove('visible');

        setTimeout(function() {
            hide();
            if (OTPModal.onSuccess) OTPModal.onSuccess(data);
        }, 1500);
    }

    // Show modal
    function show(config) {
        createModal();

        OTPModal.config = config || {};
        OTPModal.onSuccess = config.onSuccess || null;
        OTPModal.onCancel = config.onCancel || null;

        // Reset state
        var icon = document.getElementById('otpIcon');
        icon.className = 'otp-icon';
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>';

        var titleEl = document.getElementById('otpTitle');
        var subtitleEl = document.getElementById('otpSubtitle');
        if (titleEl) titleEl.textContent = config.title || 'Verify Your Phone';
        if (subtitleEl) subtitleEl.innerHTML = config.subtitle || 'Enter the 6-digit code sent to <strong id="otpPhone">****' + (config.phoneLast4 || '****') + '</strong>';
        var phoneEl = document.getElementById('otpPhone');
        if (phoneEl) phoneEl.textContent = '****' + (config.phoneLast4 || '****');
        document.getElementById('otpInputs').style.display = 'flex';
        document.querySelector('.otp-timer').style.display = 'block';
        document.querySelector('.otp-resend').style.display = 'block';
        document.getElementById('otpVerifyBtn').style.display = 'block';
        var skipBtn = document.getElementById('otpSkipBtn');
        if (skipBtn) skipBtn.style.display = config.canSkip ? 'block' : 'none';
        var attemptsEl = document.getElementById('otpAttempts');
        if (attemptsEl) { attemptsEl.style.display = 'block'; attemptsEl.textContent = ''; }

        clearInputs();
        hideError();
        startTimer(config.expiresIn || 300);
        startResendCooldown(config.resendCooldown || 0);

        OTPModal.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(function() {
            OTPModal.inputs[0].focus();
        }, 300);
    }

    // Hide modal
    function hide() {
        if (OTPModal.timer) clearInterval(OTPModal.timer);
        if (OTPModal.overlay) {
            OTPModal.overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Expose globally
    window.OTPModal = {
        show: show,
        hide: hide
    };

})();
