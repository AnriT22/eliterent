// Contact form handler
(function() {
    var form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var fullName = document.getElementById('fullName').value.trim();
        var email = document.getElementById('email').value.trim();
        var phone = document.getElementById('phone').value.trim();
        var subject = document.getElementById('subject').value;
        var message = document.getElementById('message').value.trim();
        var agree = document.getElementById('agree').checked;

        if (!fullName || !email || !subject || !message) {
            alert('Please fill in all required fields');
            return;
        }

        if (!agree) {
            alert('Please agree to the privacy policy and terms of service');
            return;
        }

        var submitBtn = form.querySelector('button[type="submit"]');
        var originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        fetch('/api/contact/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: fullName,
                email: email,
                phone: phone,
                subject: subject,
                message: message
            })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                alert('✓ Message sent successfully! We will get back to you soon.');
                form.reset();
            } else {
                alert('Error: ' + (data.error || 'Failed to send message'));
            }
        })
        .catch(function(err) {
            console.error('Contact form error:', err);
            alert('Failed to send message. Please try again or contact us directly via WhatsApp.');
        })
        .finally(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        });
    });
})();
