document.addEventListener('DOMContentLoaded', () => {
    const voterButton = document.getElementById('voterButton');
    const eciButton = document.getElementById('eciButton');

    if (voterButton) {
        voterButton.addEventListener('click', () => {
            window.location.href = 'login.html'; // Redirect to the voter login page
        });
    } else {
        console.error('Voter button element not found.');
    }

    if (eciButton) {
        eciButton.addEventListener('click', () => {
            window.location.href = 'ecilogin.html'; // Redirect to the ECI officer login page
        });
    } else {
        console.error('ECI button element not found.');
    }
});
