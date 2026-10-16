
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

import { Logo } from './Logo';
import { useAuth } from '../../context/AuthContext';

const navLinks = [
  { label: 'Features', href: '/#features' },
  { label: 'Platform', href: '/#preview' },
  { label: 'Security', href: '/#security' },
  { label: 'FAQ', href: '/#faq' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const { user, isManager } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const workspacePath = isManager ? '/manager' : '/employee';

  const closeMenus = () => {
    setMobileOpen(false);
    setProductOpen(false);
  };

  const goToSection = (href: string) => {
    closeMenus();

    if (href.startsWith('/#')) {
      const id = href.slice(2);

      if (location.pathname === '/') {
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start',
          });
        });
      }
    }
  };

  return (
    <motion.header
      initial={reduceMotion ? false : { opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-[#100B1D]/85 backdrop-blur-2xl"
    >
      {/* Subtle violet accent */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent"
      />

      <nav
        className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8"
        aria-label="Main navigation"
      >
        {/* Brand — same Logo component as Footer */}
        <Link
          to="/"
          onClick={closeMenus}
          aria-label="WorkPilot AI home"
          className="group flex shrink-0 items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
        >
          <Logo size="md" onDarkBackground />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-1 lg:flex">
          {/* Product dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProductOpen(!productOpen)}
              aria-expanded={productOpen}
              className="group flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-[#B7ADC9] transition hover:bg-white/[0.045] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
            >
              Product

              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  productOpen ? 'rotate-180 text-violet-300' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {productOpen && (
                <motion.div
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: 8, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, y: 5, scale: 0.98 }
                  }
                  transition={{ duration: 0.18 }}
                  className="absolute left-0 top-full mt-3 w-72 overflow-hidden rounded-2xl border border-violet-200/15 bg-[#19112B]/95 p-2 shadow-[0_20px_70px_rgba(0,0,0,.4)] backdrop-blur-2xl"
                >
                  <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#827795]">
                    Explore WorkPilot
                  </p>

                  {/* Project workspace */}
                  <Link
                    to="/#features"
                    onClick={() => goToSection('/#features')}
                    className="group flex gap-3 rounded-xl p-3 transition hover:bg-violet-300/[0.08]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-400/10 text-violet-300">
                      <LayoutDashboard className="h-4 w-4" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Project workspace
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-[#A99DBB]">
                        Tasks, progress and team coordination
                      </span>
                    </span>
                  </Link>

                  {/* AI intelligence */}
                  <Link
                    to="/#preview"
                    onClick={() => goToSection('/#preview')}
                    className="group flex gap-3 rounded-xl p-3 transition hover:bg-violet-300/[0.08]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-400/10 text-violet-300">
                      <Sparkles className="h-4 w-4" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold text-white">
                        AI intelligence
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-[#A99DBB]">
                        Risk insights and recovery proposals
                      </span>
                    </span>
                  </Link>

                  {/* Responsible AI */}
                  <Link
                    to="/#security"
                    onClick={() => goToSection('/#security')}
                    className="group flex gap-3 rounded-xl p-3 transition hover:bg-violet-300/[0.08]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-400/10 text-violet-300">
                      <ShieldCheck className="h-4 w-4" />
                    </span>

                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Responsible AI
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-[#A99DBB]">
                        Explainability and human oversight
                      </span>
                    </span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main links */}
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => goToSection(item.href)}
              className="group relative rounded-lg px-3 py-2.5 text-sm font-medium text-[#B7ADC9] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
            >
              {item.label}

              <span className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-violet-300 transition-transform duration-200 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 sm:flex">
          {user ? (
            <Link
              to={workspacePath}
              className="group inline-flex items-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-bold text-white shadow-subtle transition hover:bg-forest-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-400"
            >
              Go to workspace
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#B7ADC9] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
              >
                Log in
              </Link>

              <Link
                to="/signup"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-bold text-white shadow-subtle transition duration-300 hover:-translate-y-0.5 hover:bg-forest-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-400"
              >
                <span>Get started</span>

                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={
            mobileOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          aria-expanded={mobileOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-200/15 bg-white/[0.035] text-white transition hover:border-violet-300/35 hover:bg-violet-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 sm:hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mobileOpen ? 'close' : 'open'}
              initial={
                reduceMotion
                  ? false
                  : { opacity: 0, rotate: -35, scale: 0.8 }
              }
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? undefined
                  : { opacity: 0, rotate: 35, scale: 0.8 }
              }
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </nav>

      {/* Mobile navigation panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={
              reduceMotion ? false : { opacity: 0, height: 0 }
            }
            animate={{ opacity: 1, height: 'auto' }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, height: 0 }
            }
            transition={{
              duration: 0.25,
              ease: 'easeInOut',
            }}
            className="overflow-hidden border-t border-white/[0.06] bg-[#100B1D]/95 backdrop-blur-2xl sm:hidden"
          >
            <motion.div
              initial={reduceMotion ? false : { y: -8 }}
              animate={{ y: 0 }}
              exit={reduceMotion ? undefined : { y: -8 }}
              className="mx-auto max-w-7xl px-5 py-5"
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#827795]">
                Navigate
              </p>

              {/* Mobile product link */}
              <Link
                to="/#features"
                onClick={() => goToSection('/#features')}
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-white transition hover:bg-violet-300/[0.07]"
              >
                Product features
                <ArrowRight className="h-4 w-4 text-violet-300" />
              </Link>

              {/* Mobile navigation links */}
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => goToSection(item.href)}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-[#B7ADC9] transition hover:bg-violet-300/[0.07] hover:text-white"
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4 text-[#827795]" />
                </a>
              ))}

              <div className="my-4 h-px bg-white/[0.08]" />

              {/* Mobile actions */}
              <div className={`grid gap-3 ${user ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!user && (
                  <Link
                    to="/login"
                    onClick={closeMenus}
                    className="inline-flex items-center justify-center rounded-xl border border-violet-200/15 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-white transition hover:border-violet-300/30 hover:bg-violet-300/[0.07]"
                  >
                    Log in
                  </Link>
                )}

                <Link
                  to={user ? workspacePath : '/signup'}
                  onClick={closeMenus}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-forest-800"
                >
                  {user ? 'Go to workspace' : 'Get started'}

                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Trust note */}
              <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#827795]">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                Project intelligence with human oversight
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default Navbar;
