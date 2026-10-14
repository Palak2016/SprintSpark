import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { getAutomationAdvisor } from '../services/aiService';

const AutomationAdvisor = () => {
  const [automations, setAutomations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAutomations = async () => {
      setIsLoading(true);
      try {
        const res = await getAutomationAdvisor();
        setAutomations(res.data);
      } catch (err) {
        console.error('Failed to load automation suggestions');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAutomations();
  }, []);

  const toggleStatus = (id) => {
    setAutomations(
      automations.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === 'Approved' ? 'Suggested' : 'Approved';
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  return (
    <MainLayout>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Automation Advisor</h2>
        <p className="text-sm text-gray-500 mt-1">AI-driven workflow optimizations and estimated time savings.</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-gray-200"></div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-gray-200 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Activity / Tool</th>
                <th className="px-6 py-4 font-semibold">Suggested Script</th>
                <th className="px-6 py-4 font-semibold">Estimated Time Savings</th>
                <th className="px-6 py-4 font-semibold">Complexity</th>
                <th className="px-6 py-4 font-semibold">Risk</th>
                <th className="px-6 py-4 font-semibold text-right">Approval Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {automations.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.tool}</td>
                  <td className="px-6 py-4 text-gray-600">{item.target}</td>
                  <td className="px-6 py-4 text-indigo-600 font-medium">{item.timeSavings}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                      item.complexity === 'High' ? 'bg-red-100 text-red-700' :
                      item.complexity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.complexity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{item.risk}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleStatus(item.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        item.status === 'Approved' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {item.status === 'Approved' ? 'Active (Approved)' : 'Enable Automation'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MainLayout>
  );
};

export default AutomationAdvisor;