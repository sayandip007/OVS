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

// Login Functionality
document.addEventListener('DOMContentLoaded', () => {
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

    // Show Register Button
    const showRegister = document.getElementById('showRegister');
    if (showRegister) {
        showRegister.addEventListener('click', function(event) {
            event.preventDefault();
            showRegisterForm();
        });
    } else {
        console.error('Show register button element not found.');
    }
});

// Show Register Form Function
function showRegisterForm() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'block';
}
