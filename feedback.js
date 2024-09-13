//Feedback
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const name = document.getElementById('feedbackName').value.trim();
            const email = document.getElementById('feedbackEmail').value.trim();
            const message = document.getElementById('feedbackMessage').value.trim();
            const feedbackSuccessElement = document.getElementById('feedbackSuccess');

            if (name && email && message) {
                feedbackSuccessElement.textContent = 'Thank you for your feedback!';
                feedbackForm.reset();
            } else {
                feedbackSuccessElement.textContent = 'Please fill out all fields.';
            }
        });
    } else {
        console.error('Feedback form element not found.');
    }