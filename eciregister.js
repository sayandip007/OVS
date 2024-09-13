document.getElementById('candidateRegisterForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const aadhaarNumber = document.getElementById('aadhaarNumber').value.trim();
    const voterNumber = document.getElementById('voterNumber').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const partyName = document.getElementById('partyName').value.trim();
    const profilePicture = document.getElementById('profilePicture').files[0];

    if (!aadhaarNumber || !voterNumber || !firstName || !lastName || !partyName || !profilePicture) {
        document.getElementById('registerError').textContent = "All required fields must be filled out.";
        document.getElementById('registerSuccess').textContent = "";
        return;
    }

    // Handle candidate registration logic here (e.g., send data to server)
    
    // Simulate success
    document.getElementById('registerSuccess').textContent = "Candidate registered successfully!";
    document.getElementById('registerError').textContent = "";

    // Reset the form
    document.getElementById('candidateRegisterForm').reset();
});
