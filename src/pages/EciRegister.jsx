import React, { useState, useRef } from 'react';

export default function EciRegister({ onRegisterCandidate }) {
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [voterNumber, setVoterNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [partyName, setPartyName] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedAadhaar = aadhaarNumber.trim();
    const trimmedVoter = voterNumber.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedParty = partyName.trim();

    if (
      !trimmedAadhaar ||
      !trimmedVoter ||
      !trimmedFirst ||
      !trimmedLast ||
      !trimmedParty ||
      !profilePicture
    ) {
      setRegisterError('All required fields must be filled out.');
      setRegisterSuccess('');
      return;
    }

    if (onRegisterCandidate) {
      const reader = new FileReader();
      reader.onload = () => {
        onRegisterCandidate({
          name: `${trimmedFirst} ${trimmedLast}`,
          party: trimmedParty,
          image: reader.result,
        });
      };
      reader.readAsDataURL(profilePicture);
    }

    setRegisterSuccess('Candidate registered successfully!');
    setRegisterError('');

    setAadhaarNumber('');
    setVoterNumber('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneNumber('');
    setPartyName('');
    setProfilePicture(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="grow max-w-[900px] my-[20px] sm:my-[40px] md:my-[60px] mx-auto px-[10px] sm:px-[15px] md:px-[20px] flex items-center justify-center w-full">
      <div className="bg-white p-[20px] sm:p-[30px] md:p-[40px] rounded-[10px] shadow-[5px_3px_5px_grey] max-w-full md:max-w-[400px] md:min-w-[450px] w-full text-center">
        <h2 className="text-[1.6rem] sm:text-[1.8rem] md:text-[2rem] font-bold mb-[20px] text-[#004d99]">
          Candidate Registration
        </h2>
        <form id="candidateRegisterForm" onSubmit={handleSubmit}>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="aadhaarNumber"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Aadhaar Number
            </label>
            <input
              type="text"
              id="aadhaarNumber"
              name="aadhaarNumber"
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="voterNumber"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Voter Number
            </label>
            <input
              type="text"
              id="voterNumber"
              name="voterNumber"
              value={voterNumber}
              onChange={(e) => setVoterNumber(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="firstName"
              className="block mb-[5px] font-bold text-[#333]"
            >
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="lastName"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="email"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="phoneNumber"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="partyName"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Party Name
            </label>
            <input
              type="text"
              id="partyName"
              name="partyName"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="profilePicture"
              className="block mb-[5px] font-bold text-[#333]"
            >
              Profile Picture
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="profilePicture"
              name="profilePicture"
              accept="image/*"
              onChange={(e) => setProfilePicture(e.target.files?.[0] || null)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[1rem]"
            />
          </div>
          <button
            type="submit"
            className="w-full p-[10px] md:p-[12px] bg-[#004d99] hover:bg-[#003d80] text-white border-none rounded-[8px] cursor-pointer text-[0.85rem] sm:text-[0.9rem] md:text-[1rem] transition-colors"
          >
            Register Candidate
          </button>
          <p
            id="registerError"
            className="text-[#eb0a0a] text-[0.9rem] my-[10px]"
          >
            {registerError}
          </p>
          <p
            id="registerSuccess"
            className="text-[#2d8d31] text-[0.9rem] my-[10px]"
          >
            {registerSuccess}
          </p>
        </form>
      </div>
    </div>
  );
}
