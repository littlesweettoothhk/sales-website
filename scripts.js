function updateContent(lang) {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (element.tagName === 'TITLE') {
                document.title = translations[lang][key];
            } else {
                element.textContent = translations[lang][key];
            }
        }
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
    localStorage.setItem('preferredLanguage', lang);
}

function changeLanguage(lang) {
    updateContent(lang);
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize language
    const savedLang = localStorage.getItem('preferredLanguage') || 'zh';
    updateContent(savedLang);

    // Back to top button functionality
    const backToTopButton = document.querySelector('.back-to-top');
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('active');
        } else {
            backToTopButton.classList.remove('active');
        }
    });
    
    backToTopButton.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Favorite button functionality
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    
    favoriteButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('active');
            const icon = this.querySelector('i');
            
            if (this.classList.contains('active')) {
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
        });
    });
    
    // Add to cart functionality
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function() {
            const dessertItem = this.closest('.dessert-item');
            const dessertName = dessertItem.querySelector('h3').textContent;
            const dessertPrice = dessertItem.querySelector('.dessert-price').textContent;
            
            const currentLang = localStorage.getItem('preferredLanguage') || 'zh';
            const msg = currentLang === 'zh' ? `已將 ${dessertName} (${dessertPrice}) 加入購物車！` : `Added ${dessertName} (${dessertPrice}) to your cart!`;
            alert(msg);
        });
    });
    
    // Form submissions
    const contactForm = document.querySelector('.contact-form form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const currentLang = localStorage.getItem('preferredLanguage') || 'zh';
            const msg = currentLang === 'zh' ? '感謝您的訊息！我們會盡快回覆您。' : 'Thank you for your message! We will get back to you soon.';
            alert(msg);
            this.reset();
        });
    }
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });
});
