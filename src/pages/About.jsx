import React from 'react';

export default function About({ onNavigate }) {
  return (
    <div className="grow max-w-[900px] px-[10px] md:px-[20px] mt-[60px] mx-auto box-border flex items-center justify-center">
      <div className="bg-white p-[15px] sm:p-[20px] md:p-[40px] rounded-[10px] shadow-[5px_3px_5px_grey] text-center mx-[20px] sm:mx-[50px] md:mx-[100px] w-full md:min-w-[450px]">
        <h2 className="text-[1.4rem] sm:text-[1.7rem] md:text-[2rem] font-bold mb-[20px] text-[#004d99]">
          About Us
        </h2>
        <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.1rem] mb-[20px] leading-[1.6] text-[#333]">
          Welcome to the Voting Portal, a platform dedicated to making voting
          accessible and secure for everyone. Our mission is to provide a
          user-friendly, reliable voting experience that ensures every eligible
          voter can participate with confidence.
        </p>
        <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.1rem] mb-[20px] leading-[1.6] text-[#333]">
          Our team comprises dedicated professionals who are committed to the
          highest standards of security and user experience. We continually
          strive to improve our system and services to meet the evolving needs
          of our users.
        </p>
        <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.1rem] mb-[20px] leading-[1.6] text-[#333]">
          For any suggestions, please feel free to send your{' '}
          <a
            href="#feedback"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('feedback');
            }}
            className="text-[#004d99] no-underline font-bold hover:underline cursor-pointer"
          >
            Feedback
          </a>
          .
        </p>
      </div>
    </div>
  );
}
