document.addEventListener('DOMContentLoaded', function() {
    // Set the release time for the results
    const resultReleaseTime = new Date('2024-08-16T10:00:00'); // Example: August 20, 2024, 10:00 AM

    // Get the current time
    const currentTime = new Date();

    // Get elements to display result or message
    const resultContainer = document.getElementById('resultContainer');
    const messageContainer = document.getElementById('messageContainer');

    // Check if the current time is past the result release time
    if (currentTime >= resultReleaseTime) {
        // Show the result page content
        resultContainer.style.display = 'block';
        messageContainer.style.display = 'none';
    } else {
        // Show the "Result not yet declared" message
        resultContainer.style.display = 'none';
        messageContainer.textContent = 'Result not yet declared';
        messageContainer.style.display = 'block';

        // Optionally, set an interval to check every minute
        const checkTimeInterval = setInterval(() => {
            const updatedTime = new Date();
            if (updatedTime >= resultReleaseTime) {
                resultContainer.style.display = 'block';
                messageContainer.style.display = 'none';
                clearInterval(checkTimeInterval); // Stop checking once the result is declared
            }
        }, 60000); // Check every 60 seconds (1 minute)
    }
});
