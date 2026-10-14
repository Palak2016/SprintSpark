import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-charcoal-900 text-charcoal-300 border-t border-charcoal-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-1 space-y-4">
            <Logo size="md" onDarkBackground />
            <p className="text-sm text-charcoal-400 leading-relaxed">
              Your AI copilot for project delivery. Connecting everyday task progress with explainable delivery risk intelligence.
            </p>
            <div className="flex items-center gap-2 text-xs text-forest-300 bg-forest-950/80 px-3 py-1.5 rounded-full border border-forest-800 w-fit">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Human-in-the-loop validated</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#preview" className="hover:text-white transition-colors">Workspace Overview</a></li>
              <li><a href="#preview" className="hover:text-white transition-colors">Risk Intelligence</a></li>
              <li><a href="#preview" className="hover:text-white transition-colors">AI Recovery Planner</a></li>
              <li><a href="#preview" className="hover:text-white transition-colors">Leave-Aware Capacity</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>

          {/* Platform & Governance */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Governance</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#security" className="hover:text-white transition-colors">Security & RBAC</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Responsible AI Principles</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Deterministic Rule Base</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">Delivery FAQs</a></li>
            </ul>
          </div>

          {/* Access */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Get Started</h4>
            <p className="text-xs text-charcoal-400 mb-3">
              Sign in to your workspace or create an account to get started.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-forest-700 text-white text-xs font-medium hover:bg-forest-600 transition-colors"
              >
                Sign In to Platform
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-charcoal-700 text-charcoal-200 text-xs font-medium hover:bg-charcoal-800 transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-charcoal-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-500">
          <p>© {new Date().getFullYear()} WorkPilot AI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-charcoal-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-charcoal-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-charcoal-400 cursor-pointer">System Status: Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
