import React from 'react';

export default function Results({ results }) {
  const resultReleaseTime = new Date('2024-08-16T10:00:00');
  const currentTime = new Date();
  const isDeclared = currentTime >= resultReleaseTime;

  return (
    <div className="grow w-full lg:min-w-[1200px] max-w-[1500px] my-[30px] sm:my-[40px] md:my-[60px] mx-auto px-[10px] sm:px-[15px] md:px-[20px]">
      <h2 className="text-[1.6rem] sm:text-[1.8rem] font-bold mb-[20px]">
        Election Results
      </h2>
      {isDeclared ? (
        <div
          id="resultContainer"
          className="bg-white p-[8px] sm:p-[10px] md:p-[20px] rounded-[10px] shadow-[5px_3px_5px_grey] overflow-x-auto"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-[8px] sm:p-[10px] md:p-[14px] text-left border-b border-[#ddd] text-[13px] sm:text-[14px] md:text-[16px] bg-[#f4f4f4] font-semibold text-[#002d72] uppercase tracking-[1px]">
                  Candidate
                </th>
                <th className="p-[8px] sm:p-[10px] md:p-[14px] text-left border-b border-[#ddd] text-[13px] sm:text-[14px] md:text-[16px] bg-[#f4f4f4] font-semibold text-[#002d72] uppercase tracking-[1px]">
                  Party
                </th>
                <th className="p-[8px] sm:p-[10px] md:p-[14px] text-left border-b border-[#ddd] text-[13px] sm:text-[14px] md:text-[16px] bg-[#f4f4f4] font-semibold text-[#002d72] uppercase tracking-[1px]">
                  Votes
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr
                  key={idx}
                  className="even:bg-[#f9f9f9] hover:bg-[#f1f1f1] transition-colors duration-300"
                >
                  <td className="p-[8px] sm:p-[10px] md:p-[14px] text-left border-b border-[#ddd] text-[13px] sm:text-[14px] md:text-[16px]">
                    {row.candidate}
                  </td>
                  <td className="p-[8px] sm:p-[10px] md:p-[14px] text-left border-b border-[#ddd] text-[13px] sm:text-[14px] md:text-[16px]">
                    {row.party}
                  </td>
                  <td className="p-[8px] sm:p-[10px] md:p-[14px] text-left border-b border-[#ddd] text-[13px] sm:text-[14px] md:text-[16px]">
                    {row.votes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div id="messageContainer">Result not yet declared</div>
      )}
    </div>
  );
}
