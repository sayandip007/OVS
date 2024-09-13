let correctOTP = "123456"; // Mock OTP for demonstration
let timerInterval;
const otpDuration = 30; // Duration for OTP validity in seconds
let timeLeft = otpDuration; // Initialize the time left

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const otpForm = document.getElementById('otpForm');
    const profileImage = document.getElementById('profileImage');
    const uploadProfileImage = document.getElementById('uploadProfileImage');
    const votingStatus = document.getElementById('votingStatus');
    const resendOtpLink = document.getElementById('resendOtpLink');

    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const username = document.getElementById('loginUsername').value.trim();
            const phone = document.getElementById('loginPhone').value.trim();
            const loginErrorElement = document.getElementById('loginError');
            const loginSuccessElement = document.getElementById('loginSuccess');
    
            // Basic validation checks for User ID and Phone Number
            const userIdPattern = /^\d{4}$/; // Example pattern for a 4-digit User ID (Aadhaar/Voter number)
            const phonePattern = /^\d{10}$/; // Example pattern for a 10-digit phone number
    
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
    
            // Simulate login authentication with valid User ID and Phone Number
            if (username === '1234' && phone === '9876543210') { // Example valid credentials
                loginErrorElement.textContent = '';
                loginSuccessElement.textContent = 'OTP sent to your phone. Please enter it below.';
                
                // Simulate OTP sending and show OTP input
                setTimeout(() => {
                    document.getElementById('loginContainer').style.display = 'none';
                    document.getElementById('otpContainer').style.display = 'block';
                    startOtpTimer();
                }, 1000); // Wait for 1 second before showing OTP input
            } else {
                loginErrorElement.textContent = 'User ID or phone number not found. Please check your details.';
                loginSuccessElement.textContent = '';
            }
        });
    }

    if (otpForm) {
        otpForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const enteredOtp = Array.from(document.querySelectorAll('.otp-input')).map(input => input.value).join('');
    
            if (enteredOtp === correctOTP) {
                clearInterval(timerInterval);
                document.getElementById('otpError').textContent = '';
                document.getElementById('otpSuccess').textContent = 'OTP verified successfully! Redirecting to dashboard...';
                // Simulate updating voting status
                sessionStorage.setItem('hasVoted', 'true'); // Save voting status
                // Redirect to dashboard or next page
                setTimeout(() => {
                    window.location.href = 'dashboard.html'; // Replace with actual dashboard URL
                }, 2000);
            } else {
                document.getElementById('otpError').textContent = 'Incorrect OTP. Please try again.';
            }
        });
    
        document.querySelectorAll('.otp-input').forEach((input, index, inputs) => {
            input.addEventListener('input', () => {
                if (input.value.length === 1 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            });
    
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && input.value.length === 0 && index > 0) {
                    inputs[index - 1].focus();
                }
            });
        });
    
        resendOtpLink.addEventListener('click', function(event) {
            event.preventDefault();
            // Simulate generating a new OTP and sending it
            correctOTP = "654321"; // New OTP for demonstration; in a real application, this would be dynamically generated
            document.getElementById('otpError').textContent = 'A new OTP has been sent to your phone.';
            document.querySelectorAll('.otp-input').forEach(input => input.value = ''); // Clear the OTP fields
            clearInterval(timerInterval); // Clear existing timer
            startOtpTimer(); // Restart the timer
        });
    }

    // Dashboard logic
    if (profileImage && uploadProfileImage) {
        // Simulate retrieving voting status from a server or local storage
        if (sessionStorage.getItem('hasVoted') === 'true') {
            votingStatus.textContent = 'Voted';
        } else {
            votingStatus.textContent = 'Not Voted';
        }
    
        // Handle profile image upload
        uploadProfileImage.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profileImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

function startOtpTimer() {
    // Ensure previous timer is cleared
    clearInterval(timerInterval);
    timeLeft = otpDuration; // Reset the time left
    const timerElement = document.getElementById('timer');
    const otpTimerElement = document.getElementById('otpTimer');
    const resendOtpLink = document.getElementById('resendOtpLink');

    if (timerElement && otpTimerElement && resendOtpLink) {
        timerElement.textContent = timeLeft;
        otpTimerElement.style.display = 'block';
        resendOtpLink.style.display = 'none'; // Hide the resend link initially

        timerInterval = setInterval(() => {
            timeLeft -= 1;
            timerElement.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                otpTimerElement.style.display = 'none';
                resendOtpLink.style.display = 'block'; // Show the resend link
            }
        }, 1000); // Run the timer every 1000 milliseconds (1 second)
    }
}
