// Registration Functionality
document.addEventListener('DOMContentLoaded', () => {
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
                    window.location.href = 'login.html'; // Redirect to login page after 1.5 seconds
                }, 1500);
            }
        });
    } else {
        console.error('Register form element not found.');
    }

    // Show Login Button
    const showLogin = document.getElementById('showLogin');
    if (showLogin) {
        showLogin.addEventListener('click', function(event) {
            event.preventDefault();
            showLoginForm();
        });
    } else {
        console.error('Show login button element not found.');
    }
});

// Show Login Form Function
function showLoginForm() {
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'block';
}
