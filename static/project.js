let slideIndex = 0;

function showSlide(n) {
    let slides = document.getElementsByClassName("slide");
    let dots = document.getElementsByClassName("nav-btn");

    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }

    for (let i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
        dots[i].style.backgroundColor = ""; // Reset to default color
    }

    slides[n].style.display = "block";
    dots[n].className += " active";
    dots[n].style.backgroundColor = "#fff"; // Change to darker color
    slideIndex = n;
}

function toggleTheme() {
    const html = document.documentElement;
    if (html.getAttribute('data-bs-theme') === 'dark') {
        html.setAttribute('data-bs-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-bs-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}
function currentSlide(n) {
    showSlide(n - 1);
}

showSlide(0); // Show the first slide initially

function searchVideo() {
    let input = document.getElementById("search-input").value.toLowerCase();
    // Implement video search functionality here
    console.log("Searching for:", input);
}

// Add event listener for the search button
document.addEventListener('DOMContentLoaded', (event) => {
    const searchButton = document.querySelector('.search-box button');
    if (searchButton) {
        searchButton.addEventListener('click', searchVideo);
    }
});

document.addEventListener('DOMContentLoaded', (event) => {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});
