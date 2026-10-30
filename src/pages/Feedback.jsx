import React, { useState } from 'react';

export default function Feedback() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && email.trim() && message.trim()) {
      setFeedbackSuccess('Thank you for your feedback!');
      setName('');
      setEmail('');
      setMessage('');
    } else {
      setFeedbackSuccess('Please fill out all fields.');
    }
  };

  return (
    <div className="flex grow my-[40px] md:my-[60px] mx-auto px-[10px] md:px-[20px] max-w-[900px] items-center justify-center w-full">
      <div className="bg-white p-[20px] md:p-[40px] rounded-[10px] shadow-[5px_3px_5px_grey] text-center md:min-w-[450px] w-full">
        <h2 className="text-[1.6rem] sm:text-[1.8rem] md:text-[2.2rem] font-bold mb-[15px] md:mb-[20px] text-[#004d99]">
          Feedback
        </h2>
        <form id="feedbackForm" onSubmit={handleSubmit}>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="feedbackName"
              className="block mb-[5px] font-semibold text-[#333]"
            >
              Name
            </label>
            <input
              type="text"
              id="feedbackName"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[0.95rem] md:text-[1rem] transition-colors focus:border-[#004d99] focus:outline-none"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="feedbackEmail"
              className="block mb-[5px] font-semibold text-[#333]"
            >
              Email
            </label>
            <input
              type="email"
              id="feedbackEmail"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[0.95rem] md:text-[1rem] transition-colors focus:border-[#004d99] focus:outline-none"
            />
          </div>
          <div className="mb-[20px] text-left">
            <label
              htmlFor="feedbackMessage"
              className="block mb-[5px] font-semibold text-[#333]"
            >
              Your Feedback
            </label>
            <textarea
              id="feedbackMessage"
              name="message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full p-[10px] md:p-[12px] border border-[#ddd] bg-white rounded-[8px] box-border text-[0.95rem] md:text-[1rem] transition-colors focus:border-[#004d99] focus:outline-none resize-y min-h-[150px]"
            ></textarea>
          </div>
          <button
            type="submit"
            className="w-full p-[10px] md:p-[12px] bg-[#004d99] hover:bg-[#003d80] text-white border-none rounded-[8px] cursor-pointer text-[0.95rem] sm:text-[1rem] md:text-[1.1rem] transition-colors duration-300"
          >
            Submit Feedback
          </button>
          <p
            id="feedbackSuccess"
            className="text-[#4CAF50] text-[1.2rem] mt-[20px]"
          >
            {feedbackSuccess}
          </p>
        </form>
      </div>
    </div>
  );
}
