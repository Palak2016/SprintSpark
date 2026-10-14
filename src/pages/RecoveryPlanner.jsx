import React, { useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import { analyzeProject, generateRecoveryPlan, approveRecoveryPlan } from '../services/aiService';

const RecoveryPlanner = () => {
  const [analysis, setAnalysis] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await analyzeProject(101);
      setAnalysis(res.data);
    } catch (err) {
      alert('Failed to analyze project.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const res = await generateRecoveryPlan(101);
      setProposal(res.data);
    } catch (err) {
      alert('Failed to generate recovery plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprovalAction = async (status) => {
    try {
      await approveRecoveryPlan(proposal.id, status);
      setActionMessage({ type: 'success', text: `Plan successfully marked as: ${status}` });
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Action failed. Please try again.' });
    }
  };

  return (
    <MainLayout>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Recovery Planner</h2>
          <p className="text-sm text-gray-500 mt-1">Autonomous risk analysis and data-driven schedule recovery.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Analyzing Project...' : 'Analyze Project'}
          </button>
        </div>
      </header>

      {actionMessage && (
        <div className={`mb-6 p-4 rounded-xl text-sm ${actionMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {actionMessage.text}
        </div>
      )}

      {analysis && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <h3 className="text-lg font-semibold text-gray-800">{analysis.projectName} Status</h3>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              {analysis.riskScore}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{analysis.reasoning}</p>
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? 'Generating Proposal...' : 'Generate AI Recovery Plan'}
          </button>
        </div>
      )}

      {proposal && (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-indigo-100 ring-1 ring-indigo-500/20">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">AI-generated</span>
              <span className="text-xs text-gray-400">Review before applying</span>
            </div>
            <button
              onClick={() => setShowWhy(!showWhy)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {showWhy ? 'Hide Explanation' : 'Why this recommendation?'}
            </button>
          </div>

          {showWhy && (
            <div className="mb-4 rounded-lg bg-indigo-50/50 p-4 text-sm text-indigo-900 border border-indigo-100">
              <p className="font-semibold mb-1">AI Reasoning Summary:</p>
              <p>{proposal.reasoning_summary}</p>
            </div>
          )}

          <h4 className="font-semibold text-gray-800 mb-3 text-sm">Recommended Actions:</h4>
          <ul className="space-y-3 mb-6">
            {proposal.recommended_actions.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 border border-gray-100">
                <span className="text-sm font-medium text-gray-800">{item.action}</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                  item.priority === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {item.priority}
                </span>
              </li>
            ))}
          </ul>

          {/* Approval Gate */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">Note: Applied changes never happen without explicit manager confirmation.</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprovalAction('Approved')}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => handleApprovalAction('Request Changes')}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
              >
                Request Changes
              </button>
              <button
                onClick={() => handleApprovalAction('Rejected')}
                className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default RecoveryPlanner;