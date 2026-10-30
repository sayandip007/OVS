import React, { useState, useRef } from 'react';
import { defaultAvatar } from '../assets';

export default function Dashboard({ onNavigate }) {
  const [profileSrc, setProfileSrc] = useState(defaultAvatar);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setProfileSrc(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex grow justify-center items-center py-[20px] px-[10px] sm:py-[30px] sm:px-[15px] md:py-[40px] md:px-[20px] md:min-w-[450px]">
      <div className="bg-white p-[20px] md:p-[30px] rounded-[12px] shadow-[5px_3px_5px_grey] max-w-full sm:max-w-[90%] md:max-w-[500px] w-full text-center border border-[#e0e0e0]">
        <h2 className="text-[1.5rem] sm:text-[1.8rem] md:text-[2.2rem] mb-[20px] text-[#004d99] pb-[12px] font-semibold">
          Voter Dashboard
        </h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex flex-col items-center justify-center mx-auto mb-[25px] overflow-hidden h-[70px] w-[70px] sm:h-[80px] sm:w-[80px] md:h-[100px] md:w-[100px] border-2 border-black rounded-full cursor-pointer"
        >
          <img
            src={profileSrc}
            alt="Profile Image"
            id="profileImage"
            className="w-auto h-full object-cover scale-90"
          />
          <div className="text-[40px] sm:text-[50px] md:text-[70px] font-medium absolute top-0 left-0 h-full w-full flex justify-center items-center bg-black/75 text-[#bfbfbf] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            +
          </div>
          <input
            ref={fileInputRef}
            type="file"
            id="uploadProfileImage"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
        <div>
          <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.2rem] text-[#444] my-[12px] text-left leading-[1.6]">
            <strong>Name:</strong> John Doe
          </p>
          <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.2rem] text-[#444] my-[12px] text-left leading-[1.6]">
            <strong>Voter ID:</strong> 1234
          </p>
          <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.2rem] text-[#444] my-[12px] text-left leading-[1.6]">
            <strong>Email:</strong> john.doe@example.com
          </p>
          <p className="text-[0.95rem] sm:text-[1rem] md:text-[1.2rem] text-[#444] my-[12px] text-left leading-[1.6]">
            <strong>Voting Status:</strong>
          </p>
          <button
            id="voteButton"
            onClick={() => onNavigate('vote')}
            className="py-[10px] px-[16px] sm:py-[12px] sm:px-[18px] md:py-[14px] md:px-[22px] bg-[#0b529a] hover:bg-[#05407a] hover:shadow-[0_6px_15px_rgba(0,0,0,0.2)] text-white border-none rounded-[6px] cursor-pointer text-[0.9rem] sm:text-[1rem] md:text-[1.1rem] transition-all duration-300 w-auto"
          >
            Vote
          </button>
          <p id="voteMessage"></p>
        </div>
      </div>
    </div>
  );
}
