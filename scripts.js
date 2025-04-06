// Back to Top Button
const backToTopBtn = document.querySelector('.back-to-top');

window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        backToTopBtn.classList.add('active');
    } else {
        backToTopBtn.classList.remove('active');
    }
});

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Favorite Button Toggle
const favoriteBtns = document.querySelectorAll('.favorite-btn');

favoriteBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
    });
});
