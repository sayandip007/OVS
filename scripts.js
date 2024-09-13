// Mobile Menu
const mobileMenu = document.getElementById('mobile-menu');
const navMenu = document.querySelector('.nav-menu');

if (mobileMenu && navMenu) {
    mobileMenu.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });
} else {
    console.error('Mobile menu or nav menu element not found.');
}

// Initialize state variables
let selectedCandidate = null;
let hasVoted = false;

// Event Listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const phone = document.getElementById('loginPhone').value.trim();
            const loginErrorElement = document.getElementById('loginError');
            const loginSuccessElement = document.getElementById('loginSuccess');

            const userIdPattern = /^\d{4}$/;
            const phonePattern = /^\d{10}$/;

            if (!userIdPattern.test(username)) {
                loginErrorElement.textContent = 'Invalid User ID format. Please enter a 4-digit number.';
                loginSuccessElement.textContent = '';
                return;
            }

            if (!phonePattern.test(phone)) {
                loginErrorElement.textContent = 'Invalid phone number format. Please enter a 10-digit number.';
                loginSuccessElement.textContent = '';
                return;
            }

            if (username === '1234' && phone === '9876543210') {
                loginErrorElement.textContent = '';
                loginSuccessElement.textContent = 'OTP sent to your phone. Please enter it below.';
                setTimeout(() => {
                    document.getElementById('loginContainer').style.display = 'none';
                    document.getElementById('otpContainer').style.display = 'block';
                    startOtpTimer();
                }, 1000);
            } else {
                loginErrorElement.textContent = 'User ID or phone number not found. Please check your details.';
                loginSuccessElement.textContent = '';
            }
        });
    } else {
        console.error('Login form element not found.');
    }

    // Registration
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const aadhaarNumber = document.getElementById('aadhaarNumber').value.trim();
            const voterNumber = document.getElementById('voterNumber').value.trim();
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phoneNumber = document.getElementById('phoneNumber').value.trim();
            const registerErrorElement = document.getElementById('registerError');
            const registerSuccessElement = document.getElementById('registerSuccess');

            if (aadhaarNumber === '' || voterNumber === '' || firstName === '' || lastName === '' || phoneNumber === '') {
                registerErrorElement.textContent = 'All fields except email are required.';
                registerSuccessElement.textContent = '';
            } else {
                registerErrorElement.textContent = '';
                registerSuccessElement.textContent = 'Registration successful! Redirecting to login...';
                
                setTimeout(() => {
                    window.location.href = 'index.html'; // Redirect to login page after 1.5 seconds
                }, 1500);
            }
        });
    } else {
        console.error('Register form element not found.');
    }

    // Show Register and Show Login Buttons
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    if (showRegister) {
        showRegister.addEventListener('click', function(event) {
            event.preventDefault();
            showRegisterForm();
        });
    } else {
        console.error('Show register button element not found.');
    }

    if (showLogin) {
        showLogin.addEventListener('click', function(event) {
            event.preventDefault();
            showLoginForm();
        });
    } else {
        console.error('Show login button element not found.');
    }

    // Add event listener for vote button in dashboard
    const voteButton = document.getElementById('voteButton');
    if (voteButton) {
        voteButton.addEventListener('click', function() {
            window.location.href = 'vote.html'; // Redirect to the vote page
        });
    } else {
        console.error('Vote button element not found.');
    }
});

// Show Register Form Function
function showRegisterForm() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'block';
}

// Show Login Form Function
function showLoginForm() {
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'block';
}