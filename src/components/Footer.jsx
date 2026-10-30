import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-[#002d72] text-white py-[20px] text-center mt-[60px] relative w-full bottom-0">
      <div className="max-w-[1200px] mx-auto px-[10px] sm:px-[15px] md:px-[20px] flex flex-col items-center">
        <div className="mb-[15px] flex flex-wrap justify-center">
          <a
            href="#privacy"
            onClick={(e) => e.preventDefault()}
            className="text-white no-underline my-[5px] mx-[5px] sm:mx-[8px] md:mx-[10px] text-[0.8rem] sm:text-[0.85rem] md:text-[0.9rem] transition-colors duration-300 hover:text-[#f4c542]"
          >
            Privacy Policy
          </a>
          <a
            href="#terms"
            onClick={(e) => e.preventDefault()}
            className="text-white no-underline my-[5px] mx-[5px] sm:mx-[8px] md:mx-[10px] text-[0.8rem] sm:text-[0.85rem] md:text-[0.9rem] transition-colors duration-300 hover:text-[#f4c542]"
          >
            Terms of Service
          </a>
          <a
            href="#help"
            onClick={(e) => e.preventDefault()}
            className="text-white no-underline my-[5px] mx-[5px] sm:mx-[8px] md:mx-[10px] text-[0.8rem] sm:text-[0.85rem] md:text-[0.9rem] transition-colors duration-300 hover:text-[#f4c542]"
          >
            Help Center
          </a>
        </div>
        <p className="text-[0.8rem] sm:text-[0.85rem] md:text-[0.9rem] mt-[10px] text-white">
          Copyright &copy; 2024 Voting Portal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
