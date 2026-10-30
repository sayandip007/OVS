import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-5">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 text-[#002868] text-2xl font-extrabold">
        404
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900">
        Electoral Portal Page Not Found
      </h1>
      <p className="text-sm text-slate-600 max-w-md mx-auto">
        The route you requested does not exist or has been relocated to the new Phase 1
        &amp; Phase 2 India-wide Election Architecture.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          to="/"
          className="px-5 py-2.5 bg-[#002868] hover:bg-blue-900 text-white text-sm font-bold rounded-lg"
        >
          Return to Home
        </Link>
        <Link
          to="/voter/login"
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-lg"
        >
          Voter Portal
        </Link>
        <Link
          to="/eci/login"
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-lg"
        >
          ECI Officer Console
        </Link>
      </div>
    </div>
  );
}
