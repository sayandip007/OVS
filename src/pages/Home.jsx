import React from 'react';

export default function Home({ onNavigate }) {
  return (
    <div className="text-center m-[15px] sm:m-[20px] md:m-[30px]">
      <h2 className="text-[1.4rem] sm:text-[1.6rem] md:text-[1.8rem] font-bold mb-[8px] sm:mb-[10px] md:mb-[15px]">
        Select Your Role
      </h2>
      <button
        id="voterButton"
        onClick={() => onNavigate('login')}
        className="inline-block text-[0.9rem] sm:text-[1rem] md:text-[1.1rem] py-[8px] px-[16px] sm:py-[10px] sm:px-[20px] md:py-[12px] md:px-[24px] m-[4px] sm:m-[6px] md:m-[8px] bg-[#0359b4] hover:bg-[#002d72] text-white border-none rounded-[5px] cursor-pointer transition-colors duration-300 focus:outline-none"
      >
        I am a Voter
      </button>
      <button
        id="eciButton"
        onClick={() => onNavigate('ecilogin')}
        className="inline-block text-[0.9rem] sm:text-[1rem] md:text-[1.1rem] py-[8px] px-[16px] sm:py-[10px] sm:px-[20px] md:py-[12px] md:px-[24px] m-[4px] sm:m-[6px] md:m-[8px] bg-[#0359b4] hover:bg-[#002d72] text-white border-none rounded-[5px] cursor-pointer transition-colors duration-300 focus:outline-none"
      >
        I am an ECI Officer
      </button>
    </div>
  );
}
