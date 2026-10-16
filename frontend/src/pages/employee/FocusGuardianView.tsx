import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Task } from '../../types';

import {
  Eye,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  ChevronDown,
  ClipboardCheck,
  CalendarDays,
  Sparkles,
} from 'lucide-react';

const REASON_TAGS = [
  'Refactoring Legacy Architecture',
  'Assisted Teammate with Production Incident',
  'Unexpected Edge Case Investigation',
  'Third-Party API & Library Incompatibilities',
  'Spec Clarification & Design Alignment',
];

export const FocusGuardianView: React.FC = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [selectedTag, setSelectedTag] = useState(REASON_TAGS[0]);

  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadTasks = useCallback(async () => {
    if (user?.id == null) {
      setTasks([]);
      setIsLoadingTasks(false);
      return;
    }

    setIsLoadingTasks(true);
    setPageError('');

    try {
      const data = await api.getTasks({
        assignee_id: Number(user.id),
      });

      setTasks(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Unable to load your assigned tasks.',
      );
    } finally {
      setIsLoadingTasks(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedTaskId) {
      setPageError('Please select the task that needs clarification.');
      return;
    }

    const trimmedNote = contextNote.trim();

    if (!trimmedNote) {
      setPageError('Please describe the technical context.');
      return;
    }

    setIsSubmitting(true);
    setPageError('');
    setSuccessMessage('');
    setIsSubmitted(false);

    try {
      // Requires the API method shown below and a matching backend endpoint.
      await api.submitFocusContext({
        task_id: Number(selectedTaskId),
        reason: selectedTag,
        context: trimmedNote,
      });

      setIsSubmitted(true);
      setSuccessMessage(
        'Your context has been saved and submitted for manager review.',
      );
      setContextNote('');
    } catch (error: unknown) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Unable to submit your work context. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTask = tasks.find(
    (task) => String(task.id) === selectedTaskId,
  );

  const cardClass =
    'rounded-2xl border border-white/[0.08] bg-[#19112B]';

  const labelClass =
    'mb-2 block text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]';

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#130D21] px-3.5 py-3 text-sm text-[#FAF8FF] outline-none transition placeholder:text-[#807493] focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="max-w-5xl space-y-6 text-[#FAF8FF]">
      {/* Page heading */}
      <header>
        <div className="mb-2 flex items-center gap-2 text-xs text-[#B7ADC9]">
          <span>Employee Workspace</span>
          <span>/</span>
          <span className="text-violet-300">Focus Guardian</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10">
                <Eye
                  size={25}
                  strokeWidth={2}
                  className="text-violet-300"
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Focus Guardian
                </h1>
                <p className="mt-1 text-sm text-[#B7ADC9]">
                  Work Context Clarification
                </p>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#B7ADC9]">
              Explain why a task is delayed by selecting a reason and
              providing technical context. Your explanation helps managers
              understand blockers and helps the AI assess delivery risk more
              accurately.
            </p>
          </div>

          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2 text-xs font-semibold text-emerald-300">
            <ShieldCheck size={16} />
            Privacy First
          </div>
        </div>
      </header>

      {/* Privacy information */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
            <ShieldCheck
              size={22}
              className="text-emerald-300"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#FAF8FF]">
              Transparent Work Context. No Intrusive Monitoring.
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#B7ADC9]">
              Focus Guardian allows employees to explain why their tasks
              are delayed by selecting a reason and providing technical
              context. This context helps the AI distinguish genuine
              engineering challenges from performance delays and assess
              delivery risks more accurately.
            </p>

            <p className="mt-3 text-sm leading-6 text-[#B7ADC9]">
              It also helps managers understand blockers and provide
              appropriate support, without monitoring employees’ screens
              or keystrokes. Only the context you submit is used for this
              clarification workflow.
            </p>

            <div className="mt-4 flex items-start gap-2 border-t border-white/[0.07] pt-4">
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-emerald-300"
              />
              <p className="text-xs leading-5 text-emerald-200/80">
                Your explanation provides additional evidence for review.
                It does not automatically change your task status, deadline,
                or performance rating.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Success message */}
      {isSubmitted && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4"
        >
          <CheckCircle2
            size={21}
            className="mt-0.5 shrink-0 text-emerald-300"
          />

          <div>
            <p className="text-sm font-semibold text-emerald-200">
              Context Submitted
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-200/80">
              {successMessage}
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {pageError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/[0.07] p-4"
        >
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0 text-rose-300"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-200">
              Unable to complete the request
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-rose-200/80">
              {pageError}
            </p>
          </div>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setPageError('')}
            className="text-rose-200/70 hover:text-rose-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Form */}
      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
              <MessageSquare
                size={20}
                className="text-violet-300"
              />
            </div>

            <div>
              <h2 className="text-base font-semibold">
                Explain a Delivery Delay
              </h2>
              <p className="mt-1 text-xs text-[#A99DBD]">
                Link your explanation to the relevant task.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-6 p-5 sm:p-6"
        >
          {/* Task selection */}
          <div>
            <label
              htmlFor="focus-task"
              className={labelClass}
            >
              Task Requiring Clarification
            </label>

            <div className="relative">
              <select
                id="focus-task"
                value={selectedTaskId}
                onChange={(event) => {
                  setSelectedTaskId(event.target.value);
                  setIsSubmitted(false);
                  setSuccessMessage('');
                }}
                disabled={isLoadingTasks || tasks.length === 0 || isSubmitting}
                required
                className={`${inputClass} appearance-none pr-10`}
              >
                <option value="" className="bg-[#19112B]">
                  {isLoadingTasks
                    ? 'Loading your assigned tasks...'
                    : tasks.length === 0
                      ? 'No assigned tasks available'
                      : 'Select the task you want to explain'}
                </option>

                {tasks.map((task) => (
                  <option
                    key={task.id}
                    value={String(task.id)}
                    className="bg-[#19112B]"
                  >
                    {task.title}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A99DBD]"
              />
            </div>

            {selectedTask && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3">
                <ClipboardCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-violet-300"
                />

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-violet-200">
                    Selected Task
                  </p>
                  <p className="mt-1 break-words text-sm text-[#D8CDEF]">
                    {selectedTask.title}
                  </p>
                  {selectedTask.status && (
                    <p className="mt-1 text-xs text-[#A99DBD]">
                      Status: {selectedTask.status}
                    </p>
                  )}
                </div>
              </div>
            )}

            {isLoadingTasks && (
              <p className="mt-2 flex items-center gap-2 text-xs text-[#A99DBD]">
                <LoaderCircle size={14} className="animate-spin" />
                Retrieving your tasks...
              </p>
            )}

            {!isLoadingTasks && tasks.length === 0 && !pageError && (
              <button
                type="button"
                onClick={() => void loadTasks()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-violet-200"
              >
                <RefreshCw size={13} />
                Refresh tasks
              </button>
            )}
          </div>

          {/* Reason selection */}
          <fieldset>
            <legend className={labelClass}>
              Primary Reason for the Delay
            </legend>

            <p className="mb-3 text-xs leading-5 text-[#807493]">
              Select the reason that best describes the engineering challenge.
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REASON_TAGS.map((tag) => {
                const isSelected = selectedTag === tag;

                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isSubmitting}
                    onClick={() => {
                      setSelectedTag(tag);
                      setIsSubmitted(false);
                      setSuccessMessage('');
                    }}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-3 text-left text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? 'border-violet-400/40 bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20'
                        : 'border-white/[0.08] bg-[#130D21] text-[#B7ADC9] hover:border-violet-400/25 hover:bg-violet-500/[0.05] hover:text-[#FAF8FF]'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-violet-300 bg-violet-500'
                          : 'border-[#655779]'
                      }`}
                    >
                      {isSelected && (
                        <CheckCircle2
                          size={12}
                          className="text-white"
                        />
                      )}
                    </span>

                    <span className="leading-5">{tag}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Context description */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label
                htmlFor="focus-context"
                className="text-xs font-semibold uppercase tracking-wider text-[#B7ADC9]"
              >
                Technical Context
              </label>

              <span className="text-[10px] text-[#807493]">
                {contextNote.length}/3000
              </span>
            </div>

            <textarea
              id="focus-context"
              rows={6}
              maxLength={3000}
              minLength={10}
              required
              value={contextNote}
              onChange={(event) => {
                setContextNote(event.target.value);
                setIsSubmitted(false);
                setSuccessMessage('');
              }}
              disabled={isSubmitting}
              placeholder="Explain what happened, what you investigated, any technical blocker you discovered, and what support would help you move forward."
              className={`${inputClass} min-h-36 resize-y leading-6`}
            />

            <p className="mt-2 text-xs leading-5 text-[#807493]">
              Include relevant technical details, dependencies, or decisions.
              Avoid passwords, API keys, credentials, or other secrets.
            </p>
          </div>

          {/* AI and manager workflow information */}
          <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.05] p-4">
            <div className="flex items-start gap-3">
              <Sparkles
                size={18}
                className="mt-0.5 shrink-0 text-violet-300"
              />

              <div>
                <h3 className="text-xs font-semibold text-violet-200">
                  How your context is used
                </h3>

                <p className="mt-1.5 text-xs leading-5 text-[#B7ADC9]">
                  Once saved, the context can be linked to the task, shared
                  with its manager for review, and supplied to the recovery
                  planning process as supporting evidence. It helps explain
                  risk; it does not automatically change the task or schedule.
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs leading-5 text-[#807493]">
              Submit only context relevant to the task and delivery challenge.
            </p>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoadingTasks ||
                tasks.length === 0 ||
                !selectedTaskId ||
                contextNote.trim().length < 10
              }
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#19112B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <MessageSquare size={16} />
              )}

              {isSubmitting
                ? 'Submitting Context...'
                : 'Submit Work Context'}
            </button>
          </div>
        </form>
      </section>

      {/* Refresh tasks */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void loadTasks()}
          disabled={isLoadingTasks || isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#A99DBD] transition hover:bg-white/[0.03] hover:text-violet-200 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={isLoadingTasks ? 'animate-spin' : ''}
          />
          Refresh assigned tasks
        </button>
      </div>
    </div>
  );
};

export default FocusGuardianView;