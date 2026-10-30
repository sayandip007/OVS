import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import EciLogin from './pages/EciLogin';
import EciRegister from './pages/EciRegister';
import Dashboard from './pages/Dashboard';
import Vote from './pages/Vote';
import Results from './pages/Results';
import Feedback from './pages/Feedback';

const INITIAL_RESULTS = [
  { candidate: 'Narendra Modi', party: 'BJP', votes: 240 },
  { candidate: 'Rahul Gandhi', party: 'INC', votes: 99 },
  { candidate: 'N Chandrababu Naidu', party: 'TDP', votes: 16 },
  { candidate: 'Sitaram Yechury', party: 'CPIM', votes: 4 },
  { candidate: 'Mamata Banerjee', party: 'AITC', votes: 29 },
  { candidate: 'Nitish Kumar', party: 'JDU', votes: 12 },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [registeredVoters, setRegisteredVoters] = useState([]);
  const [results, setResults] = useState(INITIAL_RESULTS);

  const handleRegisterVoter = (voter) => {
    setRegisteredVoters((prev) => [...prev, voter]);
  };

  const handleRegisterCandidate = (candidate) => {
    setResults((prev) => [
      ...prev,
      { candidate: candidate.name, party: candidate.party, votes: 0 },
    ]);
  };

  const handleCastVote = (partyName) => {
    setResults((prev) =>
      prev.map((item) =>
        item.party === partyName ? { ...item, votes: item.votes + 1 } : item
      )
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={setCurrentPage} />;
      case 'about':
        return <About onNavigate={setCurrentPage} />;
      case 'login':
        return (
          <Login
            onNavigate={setCurrentPage}
            registeredVoters={registeredVoters}
          />
        );
      case 'register':
        return (
          <Register
            onNavigate={setCurrentPage}
            onRegisterVoter={handleRegisterVoter}
          />
        );
      case 'ecilogin':
        return <EciLogin onNavigate={setCurrentPage} />;
      case 'eciregister':
        return (
          <EciRegister onRegisterCandidate={handleRegisterCandidate} />
        );
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'vote':
        return (
          <Vote
            onNavigate={setCurrentPage}
            onCastVote={handleCastVote}
          />
        );
      case 'results':
        return <Results results={results} />;
      case 'feedback':
        return <Feedback />;
      default:
        return <Home onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[linear-gradient(to_bottom,#f9bb7c,#FFFFFF,#92f589)] bg-fixed bg-cover bg-center font-['Helvetica_Neue',Arial,sans-serif] leading-[1.6]">
      <Navbar onNavigate={setCurrentPage} />
      {renderPage()}
      <Footer />
    </div>
  );
}
