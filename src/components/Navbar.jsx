import React, { useState } from 'react';
import { eciLogo, g20Logo, years75Logo } from '../assets';

export default function Navbar({ onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLinkClick = (e, page) => {
    e.preventDefault();
    setMenuOpen(false);
    onNavigate(page);
  };

  return (
    <nav className="bg-[#002d72] text-white py-[10px] min-[901px]:py-[15px] sticky top-0 w-full z-10 shadow-[5px_3px_5px_grey]">
      <div className="flex justify-between items-center max-w-[1200px] mx-auto px-[15px] min-[551px]:px-[20px]">
        <a
          href="#home"
          onClick={(e) => handleLinkClick(e, 'home')}
          className="text-[1.4rem] min-[551px]:text-[1.6rem] font-semibold no-underline text-white flex items-center cursor-pointer"
        >
          Voting Portal
        </a>
        <div className="flex items-center">
          <img
            src={eciLogo}
            alt="ECI Logo"
            className="h-[30px] min-[551px]:h-[40px] w-auto mx-[5px] min-[551px]:mx-[10px] object-contain"
          />
          <img
            src={g20Logo}
            alt="G20 Summit Logo"
            className="h-[30px] min-[551px]:h-[40px] w-auto mx-[5px] min-[551px]:mx-[10px] object-contain"
          />
          <img
            src={years75Logo}
            alt="75 Years Independence Logo"
            className="h-[30px] min-[551px]:h-[40px] w-auto mx-[5px] min-[551px]:mx-[10px] object-contain"
          />
        </div>
        <ul
          className={`${
            menuOpen ? 'flex' : 'hidden'
          } min-[901px]:flex flex-col min-[901px]:flex-row absolute min-[901px]:static top-[60px] left-0 w-full min-[901px]:w-auto bg-[#002d72] min-[901px]:bg-transparent shadow-[0_8px_16px_rgba(0,0,0,0.3)] min-[901px]:shadow-none list-none m-0 p-0`}
        >
          <li className="my-[15px] min-[901px]:my-0 ml-0 min-[901px]:ml-[25px] text-center">
            <a
              href="#home"
              onClick={(e) => handleLinkClick(e, 'home')}
              className="no-underline text-white text-[0.9rem] min-[551px]:text-[1rem] font-medium transition-colors duration-300 hover:text-[#f4c542] relative py-[10px] min-[901px]:py-0 inline-block w-full min-[901px]:w-auto cursor-pointer"
            >
              Home
            </a>
          </li>
          <li className="my-[15px] min-[901px]:my-0 ml-0 min-[901px]:ml-[25px] text-center">
            <a
              href="#about"
              onClick={(e) => handleLinkClick(e, 'about')}
              className="no-underline text-white text-[0.9rem] min-[551px]:text-[1rem] font-medium transition-colors duration-300 hover:text-[#f4c542] relative py-[10px] min-[901px]:py-0 inline-block w-full min-[901px]:w-auto cursor-pointer"
            >
              About
            </a>
          </li>
          <li className="my-[15px] min-[901px]:my-0 ml-0 min-[901px]:ml-[25px] text-center">
            <a
              href="#results"
              onClick={(e) => handleLinkClick(e, 'results')}
              className="no-underline text-white text-[0.9rem] min-[551px]:text-[1rem] font-medium transition-colors duration-300 hover:text-[#f4c542] relative py-[10px] min-[901px]:py-0 inline-block w-full min-[901px]:w-auto cursor-pointer"
            >
              Results
            </a>
          </li>
          <li className="my-[15px] min-[901px]:my-0 ml-0 min-[901px]:ml-[25px] text-center">
            <a
              href="#feedback"
              onClick={(e) => handleLinkClick(e, 'feedback')}
              className="no-underline text-white text-[0.9rem] min-[551px]:text-[1rem] font-medium transition-colors duration-300 hover:text-[#f4c542] relative py-[10px] min-[901px]:py-0 inline-block w-full min-[901px]:w-auto cursor-pointer"
            >
              Feedback
            </a>
          </li>
        </ul>
        <div
          id="mobile-menu"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="block min-[901px]:hidden cursor-pointer mr-[15px] min-[551px]:mr-0"
        >
          <span className="block w-[25px] h-[3px] my-[5px] mx-auto bg-white transition-all duration-300"></span>
          <span className="block w-[25px] h-[3px] my-[5px] mx-auto bg-white transition-all duration-300"></span>
          <span className="block w-[25px] h-[3px] my-[5px] mx-auto bg-white transition-all duration-300"></span>
        </div>
      </div>
    </nav>
  );
}
