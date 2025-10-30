// LIBERDUS - Simple JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Liberdus website loading...');

    // Theme Toggle Functionality
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.querySelector('.theme-icon');
    const nav = document.querySelector('.nav');
    
    // Check for saved theme or default to dark
    const currentTheme = localStorage.getItem('theme') || 'dark';
    console.log('Initial theme:', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);
    updateNavBackground(currentTheme);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        console.log('Theme switching from', currentTheme, 'to', newTheme);
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        
        // Update navigation background immediately
        updateNavBackground(newTheme);
    });
    
    function updateNavBackground(theme) {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            if (theme === 'light') {
                nav.style.background = 'rgba(255, 255, 255, 0.95)';
            } else {
                nav.style.background = 'rgba(0, 0, 0, 0.95)';
            }
        } else {
            if (theme === 'light') {
                nav.style.background = 'rgba(255, 255, 255, 0.9)';
            } else {
                nav.style.background = 'rgba(0, 0, 0, 0.9)';
            }
        }
    }
    
    function updateThemeIcon(theme) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // Ensure hero content is visible immediately
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.style.opacity = '1';
        heroContent.style.visibility = 'visible';
        heroContent.style.display = 'block';
        
        // Ensure all hero elements are visible
        const heroElements = heroContent.querySelectorAll('*');
        heroElements.forEach(el => {
            if (el.style) {
                el.style.opacity = '1';
                el.style.visibility = 'visible';
                el.style.display = '';
            }
        });
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navigation scroll effect
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        const currentTheme = document.documentElement.getAttribute('data-theme');
        
        if (currentScrollY > 100) {
            if (currentTheme === 'light') {
                nav.style.background = 'rgba(255, 255, 255, 0.95)';
            } else {
                nav.style.background = 'rgba(0, 0, 0, 0.95)';
            }
            nav.style.backdropFilter = 'blur(20px)';
        } else {
            if (currentTheme === 'light') {
                nav.style.background = 'rgba(255, 255, 255, 0.9)';
            } else {
                nav.style.background = 'rgba(0, 0, 0, 0.9)';
            }
        }
        
        lastScrollY = currentScrollY;
    });

    // Simple stats animation
    const animateStats = () => {
        const stats = document.querySelectorAll('.stat-number');
        stats.forEach(stat => {
            const text = stat.textContent;
            const number = text.match(/\d+/);
            
            if (number) {
                const target = parseInt(number[0]);
                const suffix = text.replace(number[0], '');
                let current = 0;
                const increment = target / 30;
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    stat.textContent = Math.floor(current) + suffix;
                }, 50);
            }
        });
    };

    // Trigger stats animation when visible
    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateStats();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        observer.observe(heroStats);
    }

    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // FAQ Accordion functionality
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other FAQ items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active', !isActive);
        });
    });

    // Mobile Menu Toggle functionality
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            const isActive = mobileMenuToggle.classList.contains('active');
            
            if (isActive) {
                // Close menu
                mobileMenuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            } else {
                // Open menu
                mobileMenuToggle.classList.add('active');
                navMenu.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });

        // Close menu when clicking on navigation links (except dropdown toggle)
        const navLinks = navMenu.querySelectorAll('a:not(.dropdown-toggle)');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });

        // Handle dropdown toggle in mobile menu
        const dropdownToggle = navMenu.querySelector('.dropdown-toggle');
        const navDropdown = navMenu.querySelector('.nav-dropdown');
        
        if (dropdownToggle && navDropdown) {
            dropdownToggle.addEventListener('click', function(e) {
                e.preventDefault();
                navDropdown.classList.toggle('active');
            });
        }

        // Close button is handled by the hamburger toggle itself (no separate close button needed)

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!mobileMenuToggle.contains(event.target) && !navMenu.contains(event.target)) {
                mobileMenuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    if (document.getElementById('header')){
        fetch('header.html')
        .then(response => response.text())
        .then(data => {
          document.getElementById('header').innerHTML = data;
        });
    }

    console.log('✅ Liberdus website loaded successfully!');
});