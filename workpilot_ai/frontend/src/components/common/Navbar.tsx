import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight, LayoutDashboard } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isManager } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 w-full transition-all duration-200 ${
      isScrolled 
        ? 'bg-white/90 backdrop-blur-md border-b border-charcoal-100 shadow-subtle' 
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <button
                onClick={() => navigate(isManager ? '/manager' : '/employee')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-700 text-white text-sm font-medium hover:bg-forest-800 transition-all shadow-sm"
              >
                <LayoutDashboard className="w-4 h-4" />
                Go to Workspace
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-charcoal-700 hover:text-charcoal-900 px-3 py-2 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest-700 text-white text-sm font-medium hover:bg-forest-800 transition-all shadow-sm group"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-charcoal-600 hover:text-charcoal-900 hover:bg-charcoal-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-charcoal-800" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-charcoal-100 bg-white px-4 pt-2 pb-6 space-y-3 shadow-lg animate-in slide-in-from-top-2">
          <div className="pt-4 border-t border-charcoal-100 flex flex-col gap-2.5">
            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(isManager ? '/manager' : '/employee');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-forest-700 text-white text-sm font-medium hover:bg-forest-800"
              >
                <LayoutDashboard className="w-4 h-4" />
                Open Workspace
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-lg border border-charcoal-200 text-charcoal-800 text-sm font-medium hover:bg-charcoal-50"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-lg bg-forest-700 text-white text-sm font-medium hover:bg-forest-800"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
