/* ========================================
   PREMIUM ANIMATIONS — Scroll Reveal + Micro-interactions
   ======================================== */

(function () {
    'use strict';

    // Scroll Reveal — add .scroll-reveal to sections automatically
    var revealSelectors = [
        '.carousel-section', '.features-section', '.how-it-works',
        '.testimonials-section', '.partners-section', '.partner-cta-section',
        '.cta-section', '.about-section', '.values-section', '.company-stats',
        '.team-section', '.why-us-section', '.contact-section', '.map-section',
        '.faq-section', '.reviews-stats', '.reviews-section', '.write-review-section',
        '.page-hero .container'
    ];

    var staggerSelectors = [
        '.fleet-grid', '.bento-grid', '.steps-grid', '.testimonials-grid',
        '.partners-slider', '.values-grid', '.stats-grid', '.team-grid',
        '.faq-grid', '.reviews-list', '.vehicles-grid', '.features-list'
    ];

    // Apply scroll-reveal class
    revealSelectors.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
            if (!el.classList.contains('scroll-reveal')) {
                el.classList.add('scroll-reveal');
            }
        });
    });

    // Apply stagger-children class
    staggerSelectors.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
            if (!el.classList.contains('stagger-children')) {
                el.classList.add('stagger-children');
            }
        });
    });

    // IntersectionObserver for scroll reveal
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        });

        document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .stagger-children').forEach(function (el) {
            observer.observe(el);
        });
    } else {
        // Fallback: just show everything
        document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .stagger-children').forEach(function (el) {
            el.classList.add('revealed');
        });
    }

    // Navbar blur on scroll
    var header = document.querySelector('.header.sticky-header');
    if (header) {
        var lastScroll = 0;
        window.addEventListener('scroll', function () {
            var scrollY = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollY > 50) {
                header.style.background = 'rgba(15, 23, 42, 0.98)';
                header.style.boxShadow = '0 4px 30px rgba(0,0,0,0.15)';
            } else {
                header.style.background = 'rgba(15, 23, 42, 0.95)';
                header.style.boxShadow = '';
            }
            lastScroll = scrollY;
        }, { passive: true });
    }

    // Smooth button hover micro-interactions
    document.querySelectorAll('.btn, .search-btn, .fleet-card-btn, .btn-book, .partner-btn, .rv-submit-btn, .btn-apply, .btn-apply-filters').forEach(function (btn) {
        btn.addEventListener('mouseenter', function () {
            this.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        });
        btn.addEventListener('mouseleave', function () {
            this.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    });

})();
