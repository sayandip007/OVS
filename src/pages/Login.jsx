import React, { useState, useEffect, useRef } from 'react';

export default function Login({ onNavigate, registeredVoters }) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [showOtp, setShowOtp] = useState(false);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [correctOtp, setCorrectOtp] = useState('123456');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!showOtp) return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [showOtp, timeLeft]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedPhone = phone.trim();

    const userIdPattern = /^\d{4}$/;
    const phonePattern = /^\d{10}$/;

    if (!userIdPattern.test(trimmedUser)) {
      setLoginError('Invalid User ID format. Please enter a 4-digit number.');
      setLoginSuccess('');
      return;
    }

    if (!phonePattern.test(trimmedPhone)) {
      setLoginError('Invalid phone number format. Please enter a 10-digit number.');
      setLoginSuccess('');
      return;
    }

    const matchedRegistered = registeredVoters?.find(
      (v) =>
        (v.voterNumber === trimmedUser || v.aadhaarNumber === trimmedUser) &&
        v.phoneNumber === trimmedPhone
    );

    if (
      (trimmedUser === '1234' && trimmedPhone === '9876543210') ||
      matchedRegistered
    ) {
      setLoginError('');
      setLoginSuccess('OTP sent to your phone. Please enter it below.');
      setTimeout(() => {
        setShowOtp(true);
        setTimeLeft(30);
      }, 1000);
    } else {
      setLoginError(
        'User ID or phone number not found. Please check your details.'
      );
      setLoginSuccess('');
    }
  };

  const handleOtpChange = (index, value) => {
    const val = value.slice(-1);
    const updated = [...otpDigits];
    updated[index] = val;
    setOtpDigits(updated);

    if (val.length === 1 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && otpDigits[index].length === 0 && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    const enteredOtp = otpDigits.join('');

    if (enteredOtp === correctOtp) {
      setOtpError('');
      setOtpSuccess('OTP verified successfully! Redirecting to dashboard...');
      sessionStorage.setItem('hasVoted', 'true');
      setTimeout(() => {
        onNavigate('dashboard');
      }, 2000);
    } else {
      setOtpError('Incorrect OTP. Please try again.');
    }
  };

  const handleResendOtp = (e) => {
    e.preventDefault();
    setCorrectOtp('654321');
    setOtpError('A new OTP has been sent to your phone.');
    setOtpDigits(['', '', '', '', '', '']);
    setTimeLeft(30);
  };

  return (
    <div className="grow w-full max-w-[900px] lg:min-w-[900px] my-[40px] md:my-[60px] mx-auto px-[10px] md:px-[20px] flex items-center justify-center">
      {!showOtp ? (
        <div
          id="loginContainer"
          className="bg-white p-[20px] sm:p-[30px] md:p-[40px] rounded-[10px] shadow-[5px_3px_5px_grey] max-w-full md:max-w-[400px] w-full text-center"
        >
          <h2 className="text-[1.6rem] sm:text-[1.8rem] md:text-[2rem] font-bold mb-[15px] md:mb-[20px] text-[#004d99]">
            Voter&apos;s Login
          </h2>
          <form id="loginForm" onSubmit={handleLoginSubmit}>
            <div className="mb-[20px] text-left">
              <label
                htmlFor="loginUsername"
                className="block mb-[5px] font-bold text-[#333]"
              >
                User ID (Aadhaar/Voter Number)
              </label>
              <input
                type="text"
                id="loginUsername"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full p-[8px] sm:p-[10px] md:p-[12px] border border-[#c9c9c9] bg-[#fcfcfc7e] rounded-[8px] box-border text-[0.9rem] sm:text-[0.95rem] md:text-[1rem]"
              />
            </div>
            <div className="mb-[20px] text-left">
              <label
                htmlFor="loginPhone"
                className="block mb-[5px] font-bold text-[#333]"
              >
                Phone Number
              </label>
              <input
                type="tel"
                id="loginPhone"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full p-[8px] sm:p-[10px] md:p-[12px] border border-[#c9c9c9] bg-[#fcfcfc7e] rounded-[8px] box-border text-[0.9rem] sm:text-[0.95rem] md:text-[1rem]"
              />
            </div>
            <button
              type="submit"
              className="w-full p-[8px] sm:p-[10px] md:p-[12px] bg-[#004d99] hover:bg-[#003d80] text-white border-none rounded-[8px] cursor-pointer text-[0.9rem] sm:text-[0.95rem] md:text-[1rem] transition-colors"
            >
              Send OTP
            </button>
            <p
              id="loginError"
              className="text-[#eb0a0a] text-[0.9rem] my-[10px]"
            >
              {loginError}
            </p>
            <p
              id="loginSuccess"
              className="text-[#2d8d31] text-[0.9rem] my-[10px]"
            >
              {loginSuccess}
            </p>
            <p>
              Don&apos;t have an account?{' '}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('register');
                }}
                className="text-[#004d99] no-underline font-bold hover:underline cursor-pointer"
              >
                Register here
              </a>
            </p>
          </form>
        </div>
      ) : (
        <div
          id="otpContainer"
          className="bg-white p-[20px] sm:p-[30px] md:p-[40px] rounded-[10px] shadow-[5px_3px_5px_grey] max-w-full md:max-w-[400px] w-full text-center"
        >
          <h2 className="text-[1.6rem] sm:text-[1.8rem] md:text-[2rem] font-bold mb-[15px] md:mb-[20px] text-[#004d99]">
            Enter OTP
          </h2>
          <form id="otpForm" onSubmit={handleOtpSubmit}>
            <div className="flex justify-between my-[20px]">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  id={`otp${idx + 1}`}
                  name={`otp${idx + 1}`}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  required
                  className="w-[30px] h-[30px] sm:w-[35px] sm:h-[35px] md:w-[40px] md:h-[40px] border border-[#ddddddc8] rounded-[5px] text-center text-[1.1rem] sm:text-[1.2rem] md:text-[1.5rem] text-[#333] mr-[5px] last:mr-0 focus:border-[#004d99] focus:outline-none"
                />
              ))}
            </div>
            <button
              type="submit"
              className="w-full p-[8px] sm:p-[10px] md:p-[12px] bg-[#004d99] hover:bg-[#003d80] text-white border-none rounded-[8px] cursor-pointer text-[0.9rem] sm:text-[0.95rem] md:text-[1rem] transition-colors"
            >
              Submit OTP
            </button>
            <p
              id="otpError"
              className="text-[#eb0a0a] text-[0.9rem] my-[10px]"
            >
              {otpError}
            </p>
            <p
              id="otpSuccess"
              className="text-[#2d8d31] text-[0.9rem] my-[10px]"
            >
              {otpSuccess}
            </p>
            {timeLeft > 0 ? (
              <p id="otpTimer" className="text-[0.9rem] text-[#333] mt-[10px]">
                Time left: <span id="timer">{timeLeft}</span> seconds
              </p>
            ) : (
              <a
                href="#resend"
                id="resendOtpLink"
                onClick={handleResendOtp}
                className="text-[#004d99] no-underline font-bold block mt-[10px] hover:underline cursor-pointer"
              >
                Resend OTP
              </a>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
