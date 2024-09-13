// Initialize state variables
let selectedCandidate = null;
let hasVoted = false;

// Check for existing vote message
if (sessionStorage.getItem('voteMessage')) {
    document.getElementById('voteMessage').textContent = sessionStorage.getItem('voteMessage');
    hasVoted = true;
    disableVotingButtons();
}

const loginButton = document.getElementById('loginButton');
if (loginButton) {
    loginButton.addEventListener('click', () => {
        sessionStorage.removeItem('voteMessage');
        hasVoted = false;
        selectedCandidate = null;
        document.querySelectorAll('.vote-button').forEach(button => button.disabled = false);
        document.getElementById('voteMessage').textContent = '';
    });
} else {
    console.error('Login button element not found.');
}

// Select Candidate Function
function selectCandidate(candidateName, candidateId) {
    if (hasVoted) {
        alert('You have already voted.');
        return;
    }

    if (selectedCandidate !== null && selectedCandidate !== candidateId) {
        document.getElementById(`indicator${selectedCandidate}`).style.backgroundColor = 'transparent';
    }

    selectedCandidate = candidateId;
    document.getElementById(`indicator${candidateId}`).style.backgroundColor = 'red';

    alert(`You have selected ${candidateName}`);
}

// Submit Vote Function
function submitVote() {
    if (hasVoted) {
        alert('You have already voted.');
        return;
    }

    if (selectedCandidate === null) {
        alert('Please select a candidate before submitting.');
        return;
    }

    const confirmVote = confirm('Are you sure you want to submit your vote?');

    if (confirmVote) {
        hasVoted = true;
        const successMessage = 'You have successfully voted!';
        sessionStorage.setItem('voteMessage', successMessage); 
        document.getElementById('voteMessage').textContent = successMessage;
        disableVotingButtons();
    }
}

// Disable Voting Buttons Function
function disableVotingButtons() {
    document.querySelectorAll('.vote-button').forEach(button => button.disabled = true);
}

// Timer Function
function startTimer(duration, display) {
    let timer = duration;
    const endTime = Date.now() + duration * 1000; 
    sessionStorage.setItem('endTime', endTime); 

    const interval = setInterval(() => {
        const now = Date.now();
        timer = Math.max(Math.floor((endTime - now) / 1000), 0);

        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;

        display.textContent = `Time Remaining: ${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

        if (timer <= 0) {
            clearInterval(interval);
            window.location.href = "dashboard.html"; 
        }
    }, 1000);
}

// Start the timer on page load
window.onload = function () {
    const sevenMinutes = 60 * 7; // 7 minutes in seconds
    const display = document.querySelector('.timer p'); 

    const endTime = sessionStorage.getItem('endTime');
    const now = Date.now();

    if (endTime && now < endTime) {
        // Timer is still running, use remaining time
        const remainingTime = Math.max(Math.floor((endTime - now) / 1000), 0);
        startTimer(remainingTime, display);
    } else {
        // No active timer, start a new one
        startTimer(sevenMinutes, display);
    }
};
