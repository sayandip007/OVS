import React from 'react';
import { Link } from 'react-router-dom';
import { eciLogo } from '../../assets';

export default function Footer() {
  return (
    <footer className="bg-[#002d72] text-white border-t border-white/10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/15">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={eciLogo}
                alt="ECI Logo"
                referrerPolicy="no-referrer"
                className="h-9 w-auto bg-white rounded p-0.5 object-contain"
              />
              <div>
                <p className="text-base font-bold text-white">
                  National Online Voting &amp; Election Portal
                </p>
                <p className="text-xs text-slate-300">
                  Lok Sabha General Elections &amp; State Legislative Assembly Elections
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Frontend architectural demonstration supporting all 28 Indian States and 8 Union Territories, independent Parliamentary and Assembly constituencies, and simultaneous election participation workflows. All sample records are marked DEMO_SAMPLE.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f4c542] mb-3">
              Citizen Services
            </h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>
                <Link to="/elections" className="hover:text-[#f4c542] transition-colors">
                  Election Directory
                </Link>
              </li>
              <li>
                <Link to="/candidates" className="hover:text-[#f4c542] transition-colors">
                  Candidate Directory
                </Link>
              </li>
              <li>
                <Link to="/results" className="hover:text-[#f4c542] transition-colors">
                  Constituency Results
                </Link>
              </li>
              <li>
                <Link to="/feedback" className="hover:text-[#f4c542] transition-colors">
                  Citizen Feedback
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f4c542] mb-3">
              Portals &amp; Governance
            </h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>
                <Link to="/voter/login" className="hover:text-[#f4c542] transition-colors">
                  Voter Login / OTP
                </Link>
              </li>
              <li>
                <Link to="/voter/register" className="hover:text-[#f4c542] transition-colors">
                  Electoral Roll Registration
                </Link>
              </li>
              <li>
                <Link to="/eci/login" className="hover:text-[#f4c542] transition-colors">
                  ECI Admin Console
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#f4c542] transition-colors">
                  Architecture &amp; Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
          <p>
            Copyright &copy; {new Date().getFullYear()} Voting Portal (Frontend Demonstration System). All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hover:text-[#f4c542]">
              Privacy Policy
            </Link>
            <span>&middot;</span>
            <Link to="/about" className="hover:text-[#f4c542]">
              Terms of Service
            </Link>
            <span>&middot;</span>
            <Link to="/feedback" className="hover:text-[#f4c542]">
              Help Center
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
