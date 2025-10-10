/**
 * AnimationManager - Smooth animations and transitions with accessibility support
 * Provides consistent animations across the application while respecting user preferences
 */

class AnimationManager {
    constructor() {
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.animationQueue = [];
        this.isAnimating = false;
        
        this.init();
    }

    init() {
        this.addStyles();
        this.setupMotionPreferenceListener();
        this.setupIntersectionObserver();
    }

    addStyles() {
        if (document.getElementById('animation-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'animation-styles';
        styles.textContent = `
            /* Base animation classes */
            .animate-fade-in {
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .animate-fade-in.animate-active {
                opacity: 1;
            }

            .animate-slide-up {
                transform: translateY(20px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
            }

            .animate-slide-up.animate-active {
                transform: translateY(0);
                opacity: 1;
            }

            .animate-slide-down {
                transform: translateY(-20px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
            }

            .animate-slide-down.animate-active {
                transform: translateY(0);
                opacity: 1;
            }

            .animate-slide-left {
                transform: translateX(20px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
            }

            .animate-slide-left.animate-active {
                transform: translateX(0);
                opacity: 1;
            }

            .animate-slide-right {
                transform: translateX(-20px);
                opacity: 0;
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
            }

            .animate-slide-right.animate-active {
                transform: translateX(0);
                opacity: 1;
            }

            .animate-scale-up {
                transform: scale(0.9);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
            }

            .animate-scale-up.animate-active {
                transform: scale(1);
                opacity: 1;
            }

            .animate-bounce-in {
                transform: scale(0.3);
                opacity: 0;
                transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.3s ease;
            }

            .animate-bounce-in.animate-active {
                transform: scale(1);
                opacity: 1;
            }

            /* Stagger animations */
            .animate-stagger > * {
                opacity: 0;
                transform: translateY(20px);
                transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
            }

            .animate-stagger.animate-active > * {
                opacity: 1;
                transform: translateY(0);
            }

            /* Hover animations */
            .animate-hover-lift {
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .animate-hover-lift:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .animate-hover-scale {
                transition: transform 0.2s ease;
            }

            .animate-hover-scale:hover {
                transform: scale(1.05);
            }

            .animate-hover-glow {
                transition: box-shadow 0.2s ease;
            }

            .animate-hover-glow:hover {
                box-shadow: 0 0 20px rgba(25, 118, 210, 0.3);
            }

            /* Loading animations */
            .animate-pulse {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            .animate-spin {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .animate-bounce {
                animation: bounce 1s infinite;
            }

            @keyframes bounce {
                0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
                40%, 43% { transform: translateY(-30px); }
                70% { transform: translateY(-15px); }
                90% { transform: translateY(-4px); }
            }

            /* Progress animations */
            .animate-progress {
                position: relative;
                overflow: hidden;
            }

            .animate-progress::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                animation: progress-shine 2s infinite;
            }

            @keyframes progress-shine {
                0% { left: -100%; }
                100% { left: 100%; }
            }

            /* Reduced motion overrides */
            @media (prefers-reduced-motion: reduce) {
                .animate-fade-in,
                .animate-slide-up,
                .animate-slide-down,
                .animate-slide-left,
                .animate-slide-right,
                .animate-scale-up,
                .animate-bounce-in,
                .animate-stagger > *,
                .animate-hover-lift,
                .animate-hover-scale {
                    transition: opacity 0.2s ease !important;
                    transform: none !important;
                }

                .animate-pulse,
                .animate-spin,
                .animate-bounce,
                .animate-progress::after {
                    animation: none !important;
                }

                .animate-hover-lift:hover,
                .animate-hover-scale:hover {
                    transform: none !important;
                }
            }

            /* Dark theme adjustments */
            [data-theme="dark"] .animate-hover-lift:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            [data-theme="dark"] .animate-hover-glow:hover {
                box-shadow: 0 0 20px rgba(25, 118, 210, 0.5);
            }
        `;

        document.head.appendChild(styles);
    }

    setupMotionPreferenceListener() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        mediaQuery.addListener((e) => {
            this.prefersReducedMotion = e.matches;
            this.updateAnimationPreferences();
        });
    }

    updateAnimationPreferences() {
        if (this.prefersReducedMotion) {
            document.body.classList.add('reduce-motion');
        } else {
            document.body.classList.remove('reduce-motion');
        }
    }

    setupIntersectionObserver() {
        // Observe elements for scroll-triggered animations
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.triggerAnimation(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
    }

    // Animate element on scroll into view
    animateOnScroll(element, animationType = 'fade-in', delay = 0) {
        if (!element) return;

        element.classList.add(`animate-${animationType}`);
        
        if (delay > 0) {
            element.style.transitionDelay = `${delay}ms`;
        }

        this.observer.observe(element);
    }

    // Animate multiple elements with stagger effect
    animateStagger(elements, animationType = 'slide-up', staggerDelay = 100) {
        if (!elements || elements.length === 0) return;

        elements.forEach((element, index) => {
            if (element) {
                element.classList.add(`animate-${animationType}`);
                
                if (!this.prefersReducedMotion) {
                    element.style.transitionDelay = `${index * staggerDelay}ms`;
                }

                this.observer.observe(element);
            }
        });
    }

    // Trigger animation immediately
    triggerAnimation(element, animationType = null) {
        if (!element) return;

        if (animationType) {
            element.classList.add(`animate-${animationType}`);
        }

        // Use requestAnimationFrame for smooth animation
        requestAnimationFrame(() => {
            element.classList.add('animate-active');
        });

        // Handle stagger children
        if (element.classList.contains('animate-stagger')) {
            const children = Array.from(element.children);
            children.forEach((child, index) => {
                if (!this.prefersReducedMotion) {
                    setTimeout(() => {
                        child.style.opacity = '1';
                        child.style.transform = 'translateY(0)';
                    }, index * 100);
                } else {
                    child.style.opacity = '1';
                    child.style.transform = 'none';
                }
            });
        }
    }

    // Animate modal/popup entrance
    animateModal(modal, type = 'scale-up') {
        if (!modal) return;

        modal.classList.add(`animate-${type}`);
        
        // Trigger animation after a frame
        requestAnimationFrame(() => {
            modal.classList.add('animate-active');
        });

        return new Promise(resolve => {
            const duration = this.prefersReducedMotion ? 200 : 300;
            setTimeout(resolve, duration);
        });
    }

    // Animate modal/popup exit
    animateModalExit(modal) {
        if (!modal) return Promise.resolve();

        modal.classList.remove('animate-active');

        return new Promise(resolve => {
            const duration = this.prefersReducedMotion ? 200 : 300;
            setTimeout(() => {
                modal.classList.remove('animate-scale-up', 'animate-fade-in', 'animate-slide-up');
                resolve();
            }, duration);
        });
    }

    // Animate button click feedback
    animateButtonClick(button) {
        if (!button || this.prefersReducedMotion) return;

        button.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
    }

    // Animate number counting
    animateCounter(element, start, end, duration = 1000) {
        if (!element || this.prefersReducedMotion) {
            element.textContent = end;
            return;
        }

        const startTime = performance.now();
        const difference = end - start;

        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.round(start + (difference * easeOutQuart));
            
            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };

        requestAnimationFrame(updateCounter);
    }

    // Add hover animations to elements
    addHoverAnimation(element, type = 'lift') {
        if (!element) return;

        element.classList.add(`animate-hover-${type}`);
    }

    // Remove all animations from element
    removeAnimations(element) {
        if (!element) return;

        const animationClasses = Array.from(element.classList).filter(cls => 
            cls.startsWith('animate-')
        );

        animationClasses.forEach(cls => {
            element.classList.remove(cls);
        });

        element.style.transitionDelay = '';
        element.style.transform = '';
        element.style.opacity = '';
    }

    // Queue animations for sequential execution
    queueAnimation(animationFn, delay = 0) {
        this.animationQueue.push({ fn: animationFn, delay });
        
        if (!this.isAnimating) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.animationQueue.length === 0) {
            this.isAnimating = false;
            return;
        }

        this.isAnimating = true;
        const { fn, delay } = this.animationQueue.shift();

        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        await fn();
        this.processQueue();
    }

    // Cleanup method
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.animationQueue = [];
        this.isAnimating = false;
    }
}

// Initialize animation manager
window.AnimationManager = AnimationManager;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.animationManager) {
        window.animationManager = new AnimationManager();
    }
});
