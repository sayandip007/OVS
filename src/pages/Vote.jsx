import React, { useState, useEffect } from 'react';
import {
  candidate1,
  candidate2,
  candidate3,
  candidate4,
  candidate5,
  candidate6,
  logo1,
  logo2,
  logo3,
  logo4,
  logo5,
  logo6,
  notaImg,
  notaLogo,
} from '../assets';

const INITIAL_CANDIDATES = [
  {
    id: '1',
    name: 'Narendra Modi',
    party: 'BJP',
    image: candidate1,
    logo: logo1,
    altImage: 'Candidate 1',
    altLogo: 'Party Logo 1',
  },
  {
    id: '2',
    name: 'Rahul Gandhi',
    party: 'INC',
    image: candidate2,
    logo: logo2,
    altImage: 'Candidate 2',
    altLogo: 'Party Logo 2',
  },
  {
    id: '3',
    name: 'Chandrababu Naidu',
    party: 'TDP',
    image: candidate3,
    logo: logo3,
    altImage: 'Candidate 3',
    altLogo: 'Party Logo 3',
  },
  {
    id: '4',
    name: 'Sitaram Yechury',
    party: 'CPIM',
    image: candidate4,
    logo: logo4,
    altImage: 'Candidate 4',
    altLogo: 'Party Logo 4',
  },
  {
    id: '5',
    name: 'Mamata Banerjee',
    party: 'AITC',
    image: candidate5,
    logo: logo5,
    altImage: 'Candidate 5',
    altLogo: 'Party Logo 5',
  },
  {
    id: '6',
    name: 'Nitish Kumar',
    party: 'JDU',
    image: candidate6,
    logo: logo6,
    altImage: 'Candidate 6',
    altLogo: 'Party Logo 6',
  },
  {
    id: '7',
    name: 'None of the Above',
    party: 'NOTA',
    image: notaImg,
    logo: notaLogo,
    altImage: 'Candidate 7',
    altLogo: 'NOTA Logo',
  },
];

export default function Vote({ onNavigate, onCastVote }) {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedParty, setSelectedParty] = useState(null);
  const [hasVoted, setHasVoted] = useState(() => {
    return Boolean(sessionStorage.getItem('voteMessage'));
  });
  const [voteMessage, setVoteMessage] = useState(() => {
    return sessionStorage.getItem('voteMessage') || '';
  });
  const [statusNotice, setStatusNotice] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const sevenMinutes = 60 * 7;
    const savedEndTime = sessionStorage.getItem('endTime');
    const now = Date.now();
    if (savedEndTime && now < Number(savedEndTime)) {
      return Math.max(Math.floor((Number(savedEndTime) - now) / 1000), 0);
    }
    const endTime = now + sevenMinutes * 1000;
    sessionStorage.setItem('endTime', String(endTime));
    return sevenMinutes;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const savedEndTime = Number(sessionStorage.getItem('endTime'));
      const now = Date.now();
      const timeLeft = Math.max(Math.floor((savedEndTime - now) / 1000), 0);
      setRemainingSeconds(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(interval);
        onNavigate('dashboard');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onNavigate]);

  const selectCandidate = (partyName, candidateId) => {
    if (hasVoted) {
      setStatusNotice('You have already voted.');
      return;
    }
    setSelectedCandidate(candidateId);
    setSelectedParty(partyName);
    setStatusNotice(`You have selected ${partyName}`);
  };

  const submitVote = () => {
    if (hasVoted) {
      setStatusNotice('You have already voted.');
      return;
    }

    if (selectedCandidate === null) {
      setStatusNotice('Please select a candidate before submitting.');
      return;
    }

    setHasVoted(true);
    const successMessage = 'You have successfully voted!';
    sessionStorage.setItem('voteMessage', successMessage);
    setVoteMessage(successMessage);
    setStatusNotice('');
    if (onCastVote && selectedParty) {
      onCastVote(selectedParty);
    }
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `Time Remaining: ${minutes < 10 ? '0' : ''}${minutes}:${
    seconds < 10 ? '0' : ''
  }${seconds}`;

  return (
    <div className="max-w-[1100px] w-full my-[20px] md:my-[40px] mx-auto px-[20px] text-center text-[1.6rem] sm:text-[1.8rem] md:text-[2rem] mb-[20px] text-[#004d99] font-bold">
      <h2 className="text-[1.5em] font-bold mb-[20px] text-[#004d99]">
        Cast Your Vote
      </h2>

      <div className="text-[1.2rem] sm:text-[1.3rem] md:text-[1.5rem] text-[#004d99] py-[6px] px-[12px] sm:py-[8px] sm:px-[16px] md:py-[10px] md:px-[20px] mb-[20px] font-bold text-center inline-block">
        <p className="m-0">{formattedTime}</p>
      </div>

      <div className="flex items-center flex-wrap justify-center gap-[10px] md:gap-[20px] mb-[25px]">
        {INITIAL_CANDIDATES.map((cand) => (
          <div
            id={`candidate${cand.id}`}
            key={cand.id}
            className="bg-white border border-[#ddd] rounded-[8px] p-[15px] md:p-[20px] w-full md:max-w-[48%] flex flex-col md:flex-row items-center justify-between shadow-[5px_3px_5px_grey] transition-transform duration-300 hover:-translate-y-[5px] box-border text-center md:text-left"
          >
            <span className="text-[1rem] md:text-[1.1rem] font-bold text-[#333] md:mr-[10px]">
              {cand.id}.
            </span>
            <img
              src={cand.image}
              alt={cand.altImage}
              className="w-[40px] h-[40px] md:w-[50px] md:h-[50px] rounded-full object-cover md:mr-[15px] shrink-0"
            />
            <span className="text-[1rem] md:text-[1.1rem] font-bold text-[#333] md:mr-[10px] md:ml-[27px] w-auto md:w-[212px] overflow-hidden text-ellipsis">
              {cand.name}
            </span>
            <img
              src={cand.logo}
              alt={cand.altLogo}
              className="h-[45px] md:h-[55px] w-auto rounded-full my-[10px] md:my-0 md:mr-[15px] shrink-0"
            />
            <button
              disabled={hasVoted}
              onClick={() => selectCandidate(cand.party, cand.id)}
              className="py-[8px] px-[16px] md:py-[10px] md:px-[20px] bg-[#004d99] hover:bg-[#003d80] text-white border-none rounded-[5px] cursor-pointer text-[0.9rem] md:text-[1rem] font-normal transition-colors duration-300 w-auto mt-[10px] md:mt-0 md:ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
            >
              VOTE
            </button>
            <span
              id={`indicator${cand.id}`}
              className={`w-[15px] h-[15px] rounded-full ml-0 mt-[8px] md:mt-0 md:ml-[15px] transition-colors duration-300 shrink-0 ${
                selectedCandidate === cand.id ? 'bg-red-600' : 'bg-transparent'
              }`}
            ></span>
          </div>
        ))}
      </div>

      <button
        onClick={submitVote}
        className="py-[10px] px-[20px] bg-[#004d99] hover:bg-[#003d80] text-white border-none rounded-[5px] cursor-pointer text-[1rem] font-normal transition-colors duration-300 w-auto"
      >
        Submit Vote
      </button>
      {statusNotice && !voteMessage && (
        <p className="text-[1.2rem] text-[#4CAF50] mt-[20px]">{statusNotice}</p>
      )}
      <p id="voteMessage" className="text-[1.2rem] text-[#4CAF50] mt-[20px]">
        {voteMessage}
      </p>
    </div>
  );
}
