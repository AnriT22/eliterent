/* ========================================
   RENT CARS GEORGIA - JAVASCRIPT
   ======================================== */

// ========================================
// STATE MANAGEMENT
// ========================================

const appState = {
    selectedTrip: 'mountain',
    currentCurrency: 'USD',
    currentLanguage: 'en',
    currentAuthMode: 'login',
    partnerOnboardingStep: 1,
    vehicleFilters: {
        mountain: ['4x4', 'offroad', 'suv'],
        city: ['sedan', 'comfort', 'economy'],
        coast: ['convertible', 'suv', 'adventure']
    }
};

// ========================================
// DROPDOWN FUNCTIONALITY
// ========================================

function initDropdowns() {
    // Currency dropdown
    const currencyBtn = document.getElementById('currencyBtn');
    const currencyDropdown = document.getElementById('currencyDropdown');
    
    if (currencyBtn && currencyDropdown) {
        currencyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(currencyBtn, currencyDropdown);
            closeDropdown(document.getElementById('languageBtn'), document.getElementById('languageDropdown'));
        });

        currencyDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currency = item.dataset.currency;
                appState.currentCurrency = currency;
                currencyBtn.querySelector('.selector-text').textContent = currency;
                closeDropdown(currencyBtn, currencyDropdown);
            });
        });
    }

    // Language dropdown
    const languageBtn = document.getElementById('languageBtn');
    const languageDropdown = document.getElementById('languageDropdown');
    
    if (languageBtn && languageDropdown) {
        languageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(languageBtn, languageDropdown);
            closeDropdown(currencyBtn, currencyDropdown);
        });

        languageDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const language = item.dataset.language;
                appState.currentLanguage = language;
                
                // Update language button
                const flagMap = { 'en': '🇬🇧 English', 'ru': '🇷🇺 Русский', 'ka': '🇬🇪 ქართული' };
                const languageText = flagMap[language];
                languageBtn.innerHTML = `
                    <span class="selector-icon">${language === 'en' ? '🇬🇧' : language === 'ru' ? '🇷🇺' : '🇬🇪'}</span>
                    <span class="selector-text">${language === 'en' ? 'English' : language === 'ru' ? 'Русский' : 'ქართული'}</span>
                    <svg class="dropdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                `;
                
                // Update checkmark
                languageDropdown.querySelectorAll('.checkmark').forEach(check => check.remove());
                item.innerHTML += '<span class="checkmark">✓</span>';
                
                closeDropdown(languageBtn, languageDropdown);
            });
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        closeDropdown(currencyBtn, currencyDropdown);
        closeDropdown(languageBtn, languageDropdown);
    });
}

function toggleDropdown(btn, dropdown) {
    if (dropdown.style.display === 'none' || !dropdown.style.display) {
        dropdown.style.display = 'block';
        btn.classList.add('active');
    } else {
        closeDropdown(btn, dropdown);
    }
}

function closeDropdown(btn, dropdown) {
    if (btn && dropdown) {
        dropdown.style.display = 'none';
        btn.classList.remove('active');
    }
}

// ========================================
// CALENDAR PICKER FUNCTIONALITY
// ========================================

function initCalendar() {
    const dateRangeInput = document.getElementById('dateRangeInput');
    const calendarModal = document.getElementById('calendarModal');
    const calendarOverlay = document.querySelector('.calendar-overlay');
    const cancelBtn = document.getElementById('cancelBtn');
    const applyBtn = document.getElementById('applyBtn');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const pickupHour = document.getElementById('pickupHour');
    const pickupMinute = document.getElementById('pickupMinute');
    const dropoffHour = document.getElementById('dropoffHour');
    const dropoffMinute = document.getElementById('dropoffMinute');

    // Use helper to create dates at midnight for consistent comparison
    function createDate(year, month, day) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    // State management — start with no dates so all vehicles are shown
    var _today = new Date();
    _today.setHours(0, 0, 0, 0);
    window.selectedStartDate = null;
    window.selectedEndDate = null;
    let currentDisplayMonth = createDate(_today.getFullYear(), _today.getMonth(), 1);
    let tempStartDate = null;
    let tempEndDate = null;

    // Helper functions
    function isSameDate(date1, date2) {
        if (!date1 || !date2) return false;
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    function isDateInRange(date, start, end) {
        if (!start || !end) return false;
        // Ensure proper ordering
        const [earlier, later] = start <= end ? [start, end] : [end, start];
        return date > earlier && date < later;
    }

    function isDateBeforeOrEqual(date1, date2) {
        return date1.getTime() <= date2.getTime();
    }

    function formatDateDisplay() {
        if (!window.selectedStartDate || !window.selectedEndDate) return '';
        const startStr = window.selectedStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = window.selectedEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${startStr}, ${pickupHour.value}:${pickupMinute.value} – ${endStr}, ${dropoffHour.value}:${dropoffMinute.value}`;
    }

    function renderMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = date.toLocaleString('default', { month: 'long' });
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        let html = `<h3>${monthName} ${year}</h3><div class="calendar-grid">`;
        
        // Day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
        }
        
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = createDate(year, month, day);
            let classes = 'calendar-day';
            
            // Ensure proper date ordering for range
            const [rangeStart, rangeEnd] = tempStartDate && tempEndDate && tempStartDate <= tempEndDate 
                ? [tempStartDate, tempEndDate] 
                : tempStartDate && tempEndDate && tempStartDate > tempEndDate 
                ? [tempEndDate, tempStartDate]
                : [tempStartDate, tempEndDate];
            
            if (isSameDate(currentDate, rangeStart)) {
                classes += ' selected start';
            } else if (isSameDate(currentDate, rangeEnd)) {
                classes += ' selected end';
            } else if (isDateInRange(currentDate, rangeStart, rangeEnd)) {
                classes += ' in-range';
            }
            
            // Disable past dates
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (currentDate < today) {
                classes += ' disabled';
            }
            
            // Format date as YYYY-MM-DD locally without timezone issues
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
        }
        
        // Next month days
        const remainingDays = 42 - (firstDay + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            html += `<div class="calendar-day other-month">${day}</div>`;
        }
        
        html += '</div>';
        return html;
    }

    function renderCalendars() {
        const calendar1 = document.getElementById('calendar1');
        const calendar2 = document.getElementById('calendar2');
        
        if (!calendar1 || !calendar2) return;
        
        calendar1.innerHTML = renderMonth(currentDisplayMonth);
        
        const nextMonth = new Date(currentDisplayMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        calendar2.innerHTML = renderMonth(nextMonth);
    }

    function handleDayClick(e) {
        // More robust event delegation - check the element itself
        let dayElement = e.target;
        
        // Make sure we have a calendar-day element
        if (!dayElement.classList.contains('calendar-day')) {
            dayElement = dayElement.closest('.calendar-day');
        }
        
        // Skip if not a valid day or is disabled/other-month
        if (!dayElement || 
            !dayElement.dataset.date || 
            dayElement.classList.contains('other-month') || 
            dayElement.classList.contains('disabled')) {
            return;
        }
        
        // Parse the date string carefully
        const dateStr = dayElement.dataset.date;
        if (!dateStr || dateStr.length !== 10) {
            console.warn('Invalid date string:', dateStr);
            return;
        }
        
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Convert to 0-indexed
        const day = parseInt(parts[2], 10);
        
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.warn('Failed to parse date:', dateStr, {year, month, day});
            return;
        }
        
        const clickedDate = createDate(year, month, day);

        console.log('Date clicked:', clickedDate.toLocaleDateString(), 'from:', dateStr);

        // Logic for date range selection
        if (!tempStartDate) {
            // First click - set start date
            tempStartDate = clickedDate;
            tempEndDate = null;
        } else if (!tempEndDate) {
            // Second click - set end date
            if (clickedDate < tempStartDate) {
                // If clicking before start date, swap them
                tempEndDate = tempStartDate;
                tempStartDate = clickedDate;
            } else if (isSameDate(clickedDate, tempStartDate)) {
                // Clicking same date, reset
                tempStartDate = null;
                tempEndDate = null;
            } else {
                tempEndDate = clickedDate;
            }
        } else {
            // Third click - reset and start new selection
            tempStartDate = clickedDate;
            tempEndDate = null;
        }

        renderCalendars();
        updateDateInput();
    }

    // Setup event delegation on calendar body
    const calendarBody = document.querySelector('.calendar-body');
    if (calendarBody) {
        calendarBody.addEventListener('click', handleDayClick);
    }

    function updateDateInput() {
        dateRangeInput.value = formatDateDisplay();
    }

    function updateMonthYearSelectors() {
        monthSelect.value = currentDisplayMonth.getMonth();
        yearSelect.value = currentDisplayMonth.getFullYear();
    }

    // Event listeners
    if (dateRangeInput) {
        dateRangeInput.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarModal.classList.add('active');
            // Reset temp selections to current values
            tempStartDate = window.selectedStartDate ? new Date(window.selectedStartDate) : null;
            tempEndDate = window.selectedEndDate ? new Date(window.selectedEndDate) : null;
            currentDisplayMonth = window.selectedStartDate
                ? new Date(window.selectedStartDate.getFullYear(), window.selectedStartDate.getMonth(), 1)
                : createDate(_today.getFullYear(), _today.getMonth(), 1);
            updateMonthYearSelectors();
            renderCalendars();
        });
    }

    if (calendarOverlay) {
        calendarOverlay.addEventListener('click', (e) => {
            if (e.target === calendarOverlay) {
                calendarModal.classList.remove('active');
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            calendarModal.classList.remove('active');
            // Reset temp selections
            tempStartDate = window.selectedStartDate ? new Date(window.selectedStartDate) : null;
            tempEndDate = window.selectedEndDate ? new Date(window.selectedEndDate) : null;
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (tempStartDate && tempEndDate) {
                window.selectedStartDate = new Date(tempStartDate);
                window.selectedEndDate = new Date(tempEndDate);
                dateRangeInput.value = formatDateDisplay();
                calendarModal.classList.remove('active');
                refreshCarousel();
            } else {
                // Inline feedback — highlight missing selection
                const calBody = document.querySelector('.calendar-body');
                if (calBody) {
                    calBody.style.outline = '2px solid #ef4444';
                    setTimeout(function() { calBody.style.outline = ''; }, 1500);
                }
            }
        });
    }

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            currentDisplayMonth = createDate(
                parseInt(yearSelect.value),
                parseInt(monthSelect.value),
                1
            );
            renderCalendars();
        });
    }

    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            currentDisplayMonth = createDate(
                parseInt(yearSelect.value),
                parseInt(monthSelect.value),
                1
            );
            renderCalendars();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentDisplayMonth = new Date(currentDisplayMonth.getFullYear(), currentDisplayMonth.getMonth() - 1, 1);
            updateMonthYearSelectors();
            renderCalendars();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentDisplayMonth = new Date(currentDisplayMonth.getFullYear(), currentDisplayMonth.getMonth() + 1, 1);
            updateMonthYearSelectors();
            renderCalendars();
        });
    }

    // Time change listeners
    [pickupHour, pickupMinute, dropoffHour, dropoffMinute].forEach(element => {
        if (element) {
            element.addEventListener('change', updateDateInput);
        }
    });

    // Initialize display
    updateMonthYearSelectors();
    renderCalendars();
    updateDateInput();

    // "Search for a car" button on home page → navigate to vehicles.html
    const heroSearchBtn = document.querySelector('.booking-form-container .search-btn');
    if (heroSearchBtn) {
        heroSearchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'vehicles.html';
        });
    }
}

// ========================================
// CAR CAROUSEL FUNCTIONALITY - BEAST MODE EDITION 🔥
// ========================================

// Global function to refresh carousel (called when dates change)
window.refreshCarousel = function() {
    loadCarouselWithAvailability();
};

// Store all fetched vehicles for filtering
window._allCarouselVehicles = [];

function loadCarouselWithAvailability() {
    const carouselTrack = document.getElementById('carouselTrack');
    
    if (!carouselTrack) {
        console.error('Fleet grid not found');
        return;
    }
    
    carouselTrack.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;grid-column:1/-1;">Loading vehicles...</div>';
    
    let apiUrl = '/api/vehicles?sort=newest';
    const hasDates = window.selectedStartDate && window.selectedEndDate;
    
    if (hasDates) {
        const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        apiUrl += '&pickup_date=' + fmt(new Date(window.selectedStartDate)) + '&dropoff_date=' + fmt(new Date(window.selectedEndDate));
    }
    
    fetch(apiUrl)
        .then(function (res) { return res.json(); })
        .then(function (data) {
            const vehicles = data.vehicles || [];
            window._allCarouselVehicles = vehicles;
            
            if (vehicles.length === 0 && hasDates) {
                carouselTrack.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;grid-column:1/-1;"><p style="font-size:18px;margin-bottom:8px;">No vehicles available for the selected dates.</p><button onclick="clearDatesAndReload()" style="padding:8px 20px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Clear Dates</button></div>';
                return;
            }
            
            if (vehicles.length === 0) {
                carouselTrack.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;grid-column:1/-1;"><p style="font-size:18px;">No vehicles available yet.</p></div>';
                return;
            }
            
            renderCarousel(vehicles);
        })
        .catch(function (err) {
            console.error('Fleet load error:', err);
            carouselTrack.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;grid-column:1/-1;">Could not load vehicles. Please refresh the page.</div>';
        });
}

function renderCarousel(vehicles) {
    const carouselTrack = document.getElementById('carouselTrack');
    if (!carouselTrack) return;
    
    let html = '';
    
    vehicles.forEach(function (v) {
        const imgSrc = v.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'%3E%3Crect fill='%23e2e8f0' width='400' height='240'/%3E%3Ctext x='200' y='125' text-anchor='middle' fill='%2394a3b8' font-size='16' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
        const isNew = v.created_at && (Date.now() - new Date(v.created_at).getTime()) < 24 * 60 * 60 * 1000;
        
        html += `
            <div class="fleet-card" data-category="${(v.category||'').toLowerCase()}" data-engine="${(v.engine||'').toLowerCase()}" data-gearbox="${(v.gearbox||'').toLowerCase()}" data-drivetype="${(v.drive_type||'').toLowerCase()}" data-interior="${(v.interior_type||'').toLowerCase()}" data-steering="${(v.steering_side||'').toLowerCase()}" data-payment="${(v.payment_method||'').toLowerCase()}" onclick="if(!event.target.closest('button'))window.location.href='vehicle.html?id=${v.id}'">
                <div class="fleet-card-img">
                    <img src="${imgSrc}" alt="${v.name}">
                    ${isNew ? '<span class="fleet-card-badge">NEW</span>' : ''}
                </div>
                <div class="fleet-card-body">
                    <h3 class="fleet-card-title">${v.name || 'Vehicle'}</h3>
                    <div class="fleet-card-tags">
                        <span class="fleet-tag">${v.category || 'N/A'}</span>
                        <span class="fleet-tag">${v.engine || 'N/A'}</span>
                        <span class="fleet-tag">${v.gearbox || 'N/A'}</span>
                    </div>
                    <div class="fleet-card-price-row">
                        <div class="fleet-card-price">
                            <span class="fleet-price-amount">$${v.price_per_day || 0}</span>
                            <span class="fleet-price-unit">/day</span>
                        </div>
                        <span class="fleet-card-year">${v.year || 'N/A'}</span>
                    </div>
                    <button class="fleet-card-btn" onclick="selectVehicle(${v.id})">Select Vehicle</button>
                </div>
            </div>
        `;
    });
    
    carouselTrack.innerHTML = html;
}

function clearDatesAndReload() {
    window.selectedStartDate = null;
    window.selectedEndDate = null;
    const dateRangeInput = document.getElementById('dateRangeInput');
    if (dateRangeInput) dateRangeInput.value = '';
    loadCarouselWithAvailability();
}

function selectVehicle(vehicleId) {
    window.location.href = 'vehicle.html?id=' + vehicleId;
}

function initCarousel() {
    loadCarouselWithAvailability();
}

// ========================================
// TRIP SELECTION & FILTERING
// ========================================

function initTripSelection() {
    // Header trip badges
    document.querySelectorAll('.header .trip-badge').forEach(badge => {
        badge.addEventListener('click', handleTripChange);
    });

    // Hero trip buttons
    document.querySelectorAll('.trip-button').forEach(button => {
        button.addEventListener('click', handleTripChange);
    });
}

function handleTripChange(e) {
    const trip = e.currentTarget.dataset.trip;
    appState.selectedTrip = trip;

    // Update hero trip buttons
    document.querySelectorAll('.trip-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.trip-button[data-trip="${trip}"]`).classList.add('active');

    // Update header badges
    document.querySelectorAll('.trip-badge').forEach(badge => {
        badge.classList.remove('active');
    });
    document.querySelector(`.trip-badge[data-trip="${trip}"]`)?.classList.add('active');

    console.log(`✓ Trip selected: ${trip}`);
    console.log(`Matching vehicles: ${appState.vehicleFilters[trip].join(', ')}`);
}

// ========================================
// CURRENCY SELECTOR
// ========================================

function initCurrencySelector() {
    const currencySelect = document.getElementById('currencySelect');
    currencySelect.addEventListener('change', handleCurrencyChange);
}

function handleCurrencyChange(e) {
    appState.currentCurrency = e.target.value;
    updatePricingUI();
    console.log(`✓ Currency changed to: ${appState.currentCurrency}`);
}

function updatePricingUI() {
    // This would typically fetch and update pricing
    const currencySymbols = {
        'AED': 'د.إ',
        'EUR': '€',
        'GBP': '£'
    };
    console.log(`Prices updated for ${currencySymbols[appState.currentCurrency]}`);
}

// ========================================
// AUTHENTICATION
// ========================================

function initAuthButtons() {
    document.querySelectorAll('[data-auth]').forEach(btn => {
        btn.addEventListener('click', handleAuthClick);
    });

    // Modal controls
    document.getElementById('toggleRegister').addEventListener('click', toggleAuthMode);
}

function handleAuthClick(e) {
    const authType = e.currentTarget.dataset.auth;
    
    if (authType === 'partner') {
        openModal('partnerOnboardingModal');
    } else {
        appState.currentAuthMode = authType;
        updateAuthModal();
        openModal('authModal');
    }
}

function updateAuthModal() {
    const modal = document.getElementById('authModal');
    const title = modal.querySelector('h2');
    const form = modal.querySelector('form');
    const toggle = modal.querySelector('.auth-toggle');

    if (appState.currentAuthMode === 'login') {
        title.textContent = 'Login';
        form.innerHTML = `
            <input type="email" placeholder="Email Address" class="form-field" required>
            <input type="password" placeholder="Password" class="form-field" required>
            <button type="submit" class="btn btn-primary btn-full">Login</button>
        `;
        toggle.innerHTML = 'Don\'t have an account? <a href="#" id="toggleRegister">Register here</a>';
    } else {
        title.textContent = 'Create Account';
        form.innerHTML = `
            <input type="text" placeholder="Full Name" class="form-field" required>
            <input type="email" placeholder="Email Address" class="form-field" required>
            <input type="password" placeholder="Password" class="form-field" required>
            <input type="password" placeholder="Confirm Password" class="form-field" required>
            <button type="submit" class="btn btn-primary btn-full">Register</button>
        `;
        toggle.innerHTML = 'Already have an account? <a href="#" id="toggleRegister">Login here</a>';
    }

    document.getElementById('toggleRegister').addEventListener('click', toggleAuthMode);
    form.addEventListener('submit', handleAuthSubmit);
}

function toggleAuthMode(e) {
    e.preventDefault();
    appState.currentAuthMode = appState.currentAuthMode === 'login' ? 'register' : 'login';
    updateAuthModal();
}

function handleAuthSubmit(e) {
    e.preventDefault();
    const mode = appState.currentAuthMode;
    console.log(`✓ ${mode === 'login' ? 'Login' : 'Registration'} submitted`);
    
    // Show success message
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = mode === 'login' ? '✓ Logged in!' : '✓ Account created!';
    btn.disabled = true;
    
    setTimeout(() => {
        closeModal('authModal');
        btn.textContent = originalText;
        btn.disabled = false;
    }, 1500);
}

// ========================================
// PARTNER ONBOARDING STEPPER
// ========================================

function initPartnerOnboarding() {
    const nextBtn = document.getElementById('nextStep');
    const prevBtn = document.getElementById('prevStep');

    nextBtn.addEventListener('click', nextPartnerStep);
    prevBtn.addEventListener('click', prevPartnerStep);
}

function nextPartnerStep() {
    if (appState.partnerOnboardingStep < 4) {
        appState.partnerOnboardingStep++;
        updatePartnerOnboardingUI();
    } else {
        // Complete onboarding
        completePartnerOnboarding();
    }
}

function prevPartnerStep() {
    if (appState.partnerOnboardingStep > 1) {
        appState.partnerOnboardingStep--;
        updatePartnerOnboardingUI();
    }
}

function updatePartnerOnboardingUI() {
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(step => {
        step.classList.remove('active');
    });

    // Show current step
    document.querySelector(`.onboarding-step[data-step="${appState.partnerOnboardingStep}"]`).classList.add('active');

    // Update step indicators
    document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
        const stepNum = index + 1;
        indicator.classList.remove('active', 'completed');
        
        if (stepNum === appState.partnerOnboardingStep) {
            indicator.classList.add('active');
        } else if (stepNum < appState.partnerOnboardingStep) {
            indicator.classList.add('completed');
            indicator.textContent = '✓';
        } else {
            indicator.textContent = stepNum;
        }
    });

    // Update button states
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');

    prevBtn.disabled = appState.partnerOnboardingStep === 1;
    nextBtn.textContent = appState.partnerOnboardingStep === 4 ? 'Submit Application' : 'Next →';
}

function completePartnerOnboarding() {
    console.log('✓ Partner onboarding completed');
    
    // Hide form, show verification status
    document.querySelector('.onboarding-steps').style.display = 'none';
    document.querySelector('.verification-status').style.display = 'block';
    
    // Reset after delay
    setTimeout(() => {
        resetPartnerOnboarding();
        closeModal('partnerOnboardingModal');
    }, 3000);
}

function resetPartnerOnboarding() {
    appState.partnerOnboardingStep = 1;
    document.querySelector('.onboarding-steps').style.display = 'block';
    document.querySelector('.verification-status').style.display = 'none';
    updatePartnerOnboardingUI();
}

// ========================================
// WHATSAPP INTEGRATION
// ========================================

function initWhatsAppButton() {
    const whatsappBtn = document.querySelector('.floating-whatsapp');
    if (!whatsappBtn) return;
    whatsappBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openWhatsApp();
    });
}

function openWhatsApp() {
    const message = encodeURIComponent('Hello, I would like to rent a car. Can you help me?');
    const whatsappUrl = 'https://wa.me/995591522299?text=' + message;
    window.open(whatsappUrl, '_blank');
}

// ========================================
// MAP WIDGET
// ========================================

function initMapWidget() {
    const mapWidget = document.querySelector('.floating-map-widget');
    if (!mapWidget) return;
    mapWidget.addEventListener('click', () => {
        const tooltip = mapWidget.querySelector('.map-tooltip') || mapWidget;
        tooltip.style.outline = '2px solid #3B82F6';
        setTimeout(() => { tooltip.style.outline = ''; }, 1500);
    });
}

// ========================================
// BOOKING WIDGET
// ========================================

function initBookingForm() {
    const findVehiclesBtn = document.querySelector('.booking-actions .btn-primary');
    const planTripBtn = document.querySelector('.booking-actions .btn-secondary');

    findVehiclesBtn.addEventListener('click', handleFindVehicles);
    planTripBtn.addEventListener('click', handlePlanTrip);
}

function handleFindVehicles() {
    window.location.href = 'vehicles.html';
}

function handlePlanTrip() {
    window.location.href = 'vehicles.html';
}

// ========================================
// PARTNER CTA
// ========================================

function initPartnerCTA() {
    const partnerCTABtn = document.querySelector('[data-modal="partner-onboarding"]');
    partnerCTABtn.addEventListener('click', () => {
        resetPartnerOnboarding();
        openModal('partnerOnboardingModal');
    });
}

// ========================================
// MODAL MANAGEMENT
// ========================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log(`✓ Modal opened: ${modalId}`);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    document.body.style.overflow = '';
    console.log(`✓ Modal closed: ${modalId}`);
}

function initModalControls() {
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Modal backdrop click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Verification status close button
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal('partnerOnboardingModal');
        });
    });
}

// ========================================
// SMOOTH SCROLLING
// ========================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// ========================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ========================================

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements
    document.querySelectorAll('.bento-tile, .step-card, .testimonial-card').forEach(el => {
        observer.observe(el);
    });
}

// Add fade-in-up animation to stylesheet
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// ========================================
// HEADER SCROLL EFFECTS
// ========================================

function initHeaderScrollEffects() {
    let lastScrollTop = 0;
    const header = document.querySelector('.header');

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;

        if (scrollTop > 100) {
            header.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.boxShadow = 'none';
        }

        lastScrollTop = scrollTop;
    });
}

// ========================================
// RESPONSIVE MENU (Mobile)
// ========================================

function initResponsiveMenu() {
    // Add mobile menu functionality if needed
    // This can be expanded for mobile navigation
    if (window.innerWidth <= 768) {
        const header = document.querySelector('.header-right');
        header.setAttribute('role', 'navigation');
        header.setAttribute('aria-label', 'Authentication and settings');
    }
}

// ========================================
// ACCESSIBILITY
// ========================================

function initAccessibility() {
    // Add ARIA labels
    document.querySelectorAll('button').forEach(btn => {
        if (!btn.getAttribute('aria-label')) {
            const text = btn.textContent.trim();
            if (text) {
                btn.setAttribute('aria-label', text);
            }
        }
    });

    // Keyboard navigation for modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });
}


// ========================================
// ADVANCED FILTERS FUNCTIONALITY
// ========================================

function initAdvancedFilters() {
    const advancedFiltersToggle = document.querySelector('.advanced-filters-toggle');
    const advancedFiltersModal = document.getElementById('advancedFiltersModal');
    const filtersOverlay = document.querySelector('.filters-overlay');
    const filtersCloseBtn = document.getElementById('filtersCloseBtn');
    const btnResetFilters = document.querySelector('.btn-reset');
    const btnApplyFilters = document.querySelector('.btn-apply-filters');

    if (!advancedFiltersToggle) return;

    // Open modal
    advancedFiltersToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (advancedFiltersModal) {
            advancedFiltersModal.classList.add('active');
        }
    });

    // Close modal - overlay click
    if (filtersOverlay) {
        filtersOverlay.addEventListener('click', () => {
            advancedFiltersModal.classList.remove('active');
        });
    }

    // Close modal - close button
    if (filtersCloseBtn) {
        filtersCloseBtn.addEventListener('click', () => {
            advancedFiltersModal.classList.remove('active');
        });
    }

    // Reset filters
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            document.querySelectorAll('.filter-options input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
            // Show all carousel cars again
            applyHomeFilters();
        });
    }

    // Apply filters — filter carousel cars on home page
    if (btnApplyFilters) {
        btnApplyFilters.addEventListener('click', () => {
            advancedFiltersModal.classList.remove('active');
            applyHomeFilters();
        });
    }

    // Filter button toggle
    document.querySelectorAll('.filter-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterItem = button.parentElement;
            const filterOptions = filterItem.querySelector('.filter-options');
            
            // Close other open filters
            document.querySelectorAll('.filter-button').forEach(otherButton => {
                if (otherButton !== button) {
                    otherButton.classList.remove('active');
                    otherButton.parentElement.querySelector('.filter-options').style.display = 'none';
                }
            });

            // Toggle current filter
            button.classList.toggle('active');
            filterOptions.style.display = filterOptions.style.display === 'none' ? 'flex' : 'none';
        });
    });

    // Close filters when clicking outside modal
    document.addEventListener('click', (e) => {
        if (advancedFiltersModal && advancedFiltersModal.classList.contains('active')) {
            if (!e.target.closest('.filters-content') && !e.target.closest('.advanced-filters-toggle')) {
                advancedFiltersModal.classList.remove('active');
            }
        }
    });
}

// ========================================
// HOME PAGE CAROUSEL FILTERING
// ========================================

function getHomeFilterChecked(filterName) {
    const items = document.querySelectorAll(`.filter-button[data-filter="${filterName}"]`);
    if (!items.length) return [];
    const parent = items[0].parentElement;
    const checked = parent.querySelectorAll('.filter-options input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => cb.parentElement.textContent.trim().toLowerCase());
}

function applyHomeFilters() {
    const cards = document.querySelectorAll('.fleet-card');
    if (!cards.length) return;

    const cats = getHomeFilterChecked('category');
    const engines = getHomeFilterChecked('engine');
    const gearboxes = getHomeFilterChecked('gearbox');
    const drives = getHomeFilterChecked('drivetype');
    const interiors = getHomeFilterChecked('interior');
    const steerings = getHomeFilterChecked('steering');
    const payments = getHomeFilterChecked('payment');

    let visibleCount = 0;

    cards.forEach(card => {
        const cardCat = (card.dataset.category || '').toLowerCase();
        const cardEng = (card.dataset.engine || '').toLowerCase();
        const cardGear = (card.dataset.gearbox || '').toLowerCase();
        const cardDrive = (card.dataset.drivetype || '').toLowerCase();
        const cardInt = (card.dataset.interior || '').toLowerCase();
        const cardSteer = (card.dataset.steering || '').toLowerCase();
        const cardPay = (card.dataset.payment || '').toLowerCase();

        let show = true;
        if (cats.length && cats.indexOf(cardCat) === -1) show = false;
        if (engines.length && engines.indexOf(cardEng) === -1) show = false;
        if (gearboxes.length && gearboxes.indexOf(cardGear) === -1) show = false;
        if (drives.length && drives.indexOf(cardDrive) === -1) show = false;
        if (interiors.length && interiors.indexOf(cardInt) === -1) show = false;
        if (steerings.length && steerings.indexOf(cardSteer) === -1) show = false;
        if (payments.length && payments.indexOf(cardPay) === -1) show = false;

        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
    });

    // Show a message if no vehicles match
    const track = document.getElementById('carouselTrack');
    let noMatch = track ? track.querySelector('.no-filter-match') : null;
    if (visibleCount === 0) {
        if (!noMatch && track) {
            const msg = document.createElement('div');
            msg.className = 'no-filter-match';
            msg.style.cssText = 'padding:40px;text-align:center;color:#64748b;grid-column:1/-1;';
            msg.innerHTML = '<p style="font-size:18px;margin-bottom:8px;">No vehicles match your filters.</p><button onclick="document.querySelectorAll(\'.filter-options input[type=checkbox]\').forEach(c=>c.checked=false);applyHomeFilters();" style="padding:8px 20px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Clear Filters</button>';
            track.appendChild(msg);
        }
    } else if (noMatch) {
        noMatch.remove();
    }
}

// Make it globally accessible
window.applyHomeFilters = applyHomeFilters;

// ========================================
// LOCATION DROPDOWN FUNCTIONALITY
// ========================================

function initLocationDropdowns() {
    const pickupInput = document.getElementById('pickupInput');
    const pickupDropdown = document.getElementById('pickupDropdown');
    const dropoffInput = document.getElementById('dropoffInput');
    const dropoffDropdown = document.getElementById('dropoffDropdown');

    if (pickupInput && pickupDropdown) {
        pickupInput.addEventListener('click', (e) => {
            e.stopPropagation();
            pickupDropdown.style.display = pickupDropdown.style.display === 'none' ? 'block' : 'none';
            if (dropoffDropdown) dropoffDropdown.style.display = 'none';
        });

        pickupDropdown.querySelectorAll('.location-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                pickupInput.value = item.dataset.location;
                pickupDropdown.style.display = 'none';
            });
        });
    }

    if (dropoffInput && dropoffDropdown) {
        dropoffInput.addEventListener('click', (e) => {
            e.stopPropagation();
            dropoffDropdown.style.display = dropoffDropdown.style.display === 'none' ? 'block' : 'none';
            if (pickupDropdown) pickupDropdown.style.display = 'none';
        });

        dropoffDropdown.querySelectorAll('.location-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                dropoffInput.value = item.dataset.location;
                dropoffDropdown.style.display = 'none';
            });
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.form-group')) {
            if (pickupDropdown) pickupDropdown.style.display = 'none';
            if (dropoffDropdown) dropoffDropdown.style.display = 'none';
        }
    });
}

// ========================================
// LOGO CLICK - SCROLL TO TOP
// ========================================

function initLogoClick() {
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', (e) => {
            // Only scroll to top if already on the home page, otherwise navigate
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // else: let the normal <a href="/"> navigation happen
        });
        logo.style.cursor = 'pointer';
    }
}

// ========================================
// INITIALIZATION
// ========================================

function safeInit(fn) {
    try { fn(); } catch(e) { /* element not present on this page */ }
}

function init() {
    safeInit(initLogoClick);
    safeInit(initLocationDropdowns);
    safeInit(initAdvancedFilters);
    safeInit(initDropdowns);
    safeInit(initCalendar);
    safeInit(initCarousel);
    safeInit(initTripSelection);
    safeInit(initWhatsAppButton);
    safeInit(initMapWidget);
    safeInit(initSmoothScroll);
    safeInit(initScrollAnimations);
    safeInit(initHeaderScrollEffects);
    safeInit(initResponsiveMenu);
    safeInit(initAccessibility);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Format currency
function formatCurrency(amount, currency) {
    const currencySymbols = {
        'AED': 'د.إ',
        'EUR': '€',
        'GBP': '£'
    };
    return `${currencySymbols[currency]} ${amount.toFixed(2)}`;
}

// Calculate delivery cost based on location
function calculateDeliveryFee(pickupLocation) {
    const freeDeliveryZones = ['tbilisi', 'gldani', 'vake', 'saburtalo'];
    const isInFreeZone = freeDeliveryZones.some(zone => 
        pickupLocation.toLowerCase().includes(zone)
    );
    
    if (isInFreeZone) {
        console.log('✓ Free delivery eligible');
        return 0;
    } else {
        console.log('✓ Distance-based delivery fee applies');
        return 50; // Base fee, would be calculated based on distance
    }
}

// Validate partner documents
function validatePartnerDocuments() {
    // This would validate uploaded documents
    console.log('✓ Documents validation complete');
    return true;
}

// Get vehicle recommendations based on trip
function getVehicleRecommendations(trip) {
    const recommendations = {
        mountain: {
            vehicles: ['Toyota 4Runner', 'Land Rover Discovery', 'Jeep Wrangler'],
            features: ['4WD', 'High clearance', 'All-terrain capable'],
            avgPrice: 250
        },
        city: {
            vehicles: ['Toyota Corolla', 'Hyundai Elantra', 'Volkswagen Golf'],
            features: ['Comfortable', 'Fuel efficient', 'Parking-friendly'],
            avgPrice: 80
        },
        coast: {
            vehicles: ['Toyota RAV4', 'Nissan Qashqai', 'BMW X3'],
            features: ['Convertible option', 'Adventure-ready', 'Spacious'],
            avgPrice: 150
        }
    };
    return recommendations[trip] || recommendations['city'];
}

console.log('Rent Cars Georgia - Ready to explore!');
