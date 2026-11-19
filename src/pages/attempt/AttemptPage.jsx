import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getAttemptState,
  saveAnswer,
  submitSection,
  pauseAttempt,
  resumeAttempt,
  syncTimer,
  registerAttemptSession,
} from "../../services/test.service";
import api from "../../api/axios";

import { drawMathInHtml } from "../../lib/math";
import {
  createSaveQueue,
  currentUserId,
  isNetworkError,
  isOtherSessionError,
} from "../../lib/saveQueue";

// =========================
// HELPERS
// =========================

// Pick the text for the chosen language, falling back to the other one so a
// question is never blank if a translation is missing.
const pickText = (textObj, lang) => {
  if (!textObj) return "";
  return lang === "hi"
    ? textObj.hindi || textObj.english || ""
    : textObj.english || textObj.hindi || "";
};

const formatClock = (totalSeconds) => {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

// Background colour from base status (answered / skipped / not_visited).
// "marked for review" is an independent overlay (corner dot), because a
// question can be both answered AND marked.
const paletteBg = (resp, isCurrent) => {
  const base =
    "relative h-12 rounded-xl text-sm font-medium border transition flex items-center justify-center";

  const ring = isCurrent ? " ring-2 ring-offset-2 ring-black" : "";

  if (!resp) {
    return `${base}${ring} bg-white text-gray-700 border-gray-300 hover:border-black`;
  }

  if (resp.selectedOption) {
    return `${base}${ring} bg-green-500 text-white border-green-500`;
  }

  // visited but not answered
  return `${base}${ring} bg-orange-400 text-white border-orange-400`;
};

// One id per open test screen (see "one open screen per attempt").
const newSessionId = () => {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    /* not available on plain http — fall back below */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

// Server answers, with this device's unsent saves laid on top (they are newer).
const mergeResponses = (answers, pending) => {
  const restored = {};
  (answers || []).forEach((a) => {
    restored[String(a.questionId)] = {
      selectedOption: a.selectedOption,
      answerStatus: a.answerStatus,
      markedForReview: Boolean(a.markedForReview),
    };
  });
  (pending || []).forEach((item) => {
    if (item.timeOnly) return;
    const p = item.payload;
    restored[String(p.questionId)] = {
      selectedOption: p.selectedOption ?? null,
      answerStatus: p.answerStatus,
      markedForReview: Boolean(p.markedForReview),
    };
  });
  return restored;
};

// A time-only save: seconds spent on a question, nothing else changes.
const timePayload = (attemptId, question, seconds) => ({
  attemptId,
  questionId: question.questionId,
  questionNumber: question.questionNumber,
  fromQuestionNumber: question.questionNumber,
  timeSpent: seconds,
  saveType: "timer",
});

// Resolves when the browser is back online, or after `ms`.
const waitForOnline = (ms) =>
  new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    window.addEventListener("online", done);
  });

const NET_ERROR_TEXT =
  "Can't reach the server. Your answers are kept on this device; please check your internet.";
const OFFLINE_TEXT = "Offline – answers will be saved when you're back online";
const CONFLICT_TEXT = "This test was opened in another tab or device. Continue here?";
// why queued saves were dropped (see lib/saveQueue.js)
const DROPPED_TEXT = {
  other_user:
    "You're no longer signed in as the student taking this test on this device. Unsent answers were not sent.",
  signed_out: "Your login has expired. Please sign in again to continue this test.",
  gone: "This test is no longer available. Its unsent answers were removed from this device.",
};

// Default server calls for ranked / practice attempts — the calls this screen
// has always made. A custom practice set passes its own `service` with the
// same function names (see customAttemptService in test.service.js).
const rankedPracticeService = (attemptId) => ({
  getState: () => getAttemptState(attemptId),
  registerSession: (sessionId, takeover) =>
    registerAttemptSession(attemptId, sessionId, takeover),
  saveAnswer: (payload) => saveAnswer(payload),
  submit: (remainingSeconds, extra) => submitSection(attemptId, extra),
  pause: (remainingSeconds, extra) => pauseAttempt(attemptId, remainingSeconds, extra),
  resume: (extra) => resumeAttempt(attemptId, extra),
  syncTimer: (remainingSeconds, extra) => syncTimer(attemptId, remainingSeconds, extra),
  // same API base URL as every other call (custom mode does the same)
  timerUrl: `${api.defaults.baseURL}/api/student/attempt/timer`,
  saveUrl: `${api.defaults.baseURL}/api/student/attempt/save-answer`,
  resultPath: `/result/${attemptId}`,
  leavePath: "/attempts",
});

const ATTEMPT_LABEL = {
  ranked: { short: "Ranked", long: "Ranked Attempt" },
  practice: { short: "Practice", long: "Practice (not ranked)" },
  custom: { short: "Custom Practice", long: "Custom Practice (no marks)" },
};

function AttemptPage({ service } = {}) {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const svc = useMemo(
    () => service || rankedPracticeService(attemptId),
    [service, attemptId]
  );
  const isCustom = Boolean(service);
  // where this tab keeps its screen id across a reload
  const sessionKey = `testSession:${attemptId || "custom"}`;

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // busy with pause / resume / exit / submit
  const [saving, setSaving] = useState(false);

  // Position
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);

  // responses: { [questionId]: { selectedOption, answerStatus, markedForReview } }
  const [responses, setResponses] = useState({});

  // section timer
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [paused, setPaused] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  // phones: the slide-up question list
  const [showPalette, setShowPalette] = useState(false);

  // saving status
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queueState, setQueueState] = useState({ pending: 0, sending: false });
  // { retry } — "Can't reach the server" card
  const [netError, setNetError] = useState(null);
  // null | "open" (another screen is live) | "lost" (another screen took over)
  const [conflict, setConflict] = useState(null);
  // null | message while time is up and the section is being submitted
  const [timeUp, setTimeUp] = useState(null);
  // null | "other_user" | "signed_out" | "gone" — saving stopped for good on this screen
  const [dropped, setDropped] = useState(null);

  // question language ("en" | "hi") — remembered across questions & reloads
  const [lang, setLang] = useState(
    () => localStorage.getItem("testLang") || "en"
  );

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem("testLang", next);
  };
  const durationsRef = useRef([]); // [{ sectionName, durationMinutes }]
  // server-provided remaining seconds for the resumed current section (applied once)
  const resumeRemainingRef = useRef(null); // { index, seconds }
  // latest secondsLeft, readable inside intervals / unload without stale closures
  const secondsLeftRef = useRef(null);

  // per-question time: when counting started (epoch ms); null = not counting
  // (paused, tab hidden, test frozen)
  const questionStartRef = useRef(null);

  // guards against double auto-submit
  const autoSubmitRef = useRef(false);

  // the save queue, this screen's session id, and the latest values that
  // event handlers / intervals need
  const queueRef = useRef(null);
  const sessionIdRef = useRef(null);
  const loadIdRef = useRef(0);
  const frozenRef = useRef(true);
  const conflictRef = useRef(null);
  const sectionIndexRef = useRef(0);
  const currentQuestionRef = useRef(null);
  const leftRef = useRef(false);

  // =========================
  // DERIVED
  // =========================

  const sections = useMemo(
    () => attempt?.testSnapshot?.sections || [],
    [attempt]
  );
  const currentSection = sections[sectionIndex];
  const sectionQuestions = currentSection?.questions || [];
  const currentQuestion = sectionQuestions[questionIndex];

  const totalQuestions = useMemo(
    () =>
      sections.reduce(
        (sum, s) => sum + (s.questions?.length || 0),
        0
      ),
    [sections]
  );

  // clock and per-question time stop while paused, while another screen owns
  // the test, and while time is up
  const frozen =
    paused || Boolean(conflict) || Boolean(timeUp) || Boolean(dropped) || loading;

  useEffect(() => {
    frozenRef.current = frozen;
    if (frozen) {
      questionStartRef.current = null;
    } else if (questionStartRef.current == null && !document.hidden) {
      questionStartRef.current = Date.now();
    }
  }, [frozen]);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

  useEffect(() => {
    sectionIndexRef.current = sectionIndex;
    currentQuestionRef.current = currentQuestion || null;
  }, [sectionIndex, currentQuestion]);

  // =========================
  // PER-QUESTION TIME
  // =========================

  // Whole seconds on the current question since the last time they were
  // taken. The part-second stays for next time, so no second is counted twice.
  const takeQuestionSeconds = useCallback(() => {
    const start = questionStartRef.current;
    if (start == null) return 0;
    const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
    questionStartRef.current = start + s * 1000;
    return s;
  }, []);

  // new question on screen → start counting it
  useEffect(() => {
    questionStartRef.current =
      frozenRef.current || document.hidden ? null : Date.now();
  }, [sectionIndex, questionIndex]);

  // =========================
  // LOAD / OPEN THE TEST SCREEN
  // =========================

  const applyState = useCallback((data, pending) => {
    setAttempt(data);

    // resume at the section AND question the student left off on
    const secIdx = data.currentSectionIndex || 0;
    setSectionIndex(secIdx);

    const secQuestions =
      data.testSnapshot?.sections?.[secIdx]?.questions || [];
    const qIdx = secQuestions.findIndex(
      (q) => String(q.questionId) === String(data.currentQuestionId)
    );
    setQuestionIndex(qIdx >= 0 ? qIdx : 0);

    // restore responses (unsent saves on this device win)
    setResponses(mergeResponses(data.answers, pending));

    durationsRef.current = data.sectionDurations || [];

    // continue the section clock from where the server says it is
    resumeRemainingRef.current = {
      index: secIdx,
      seconds: data.currentSectionRemainingSeconds,
    };
    if (data.currentSectionRemainingSeconds != null) {
      setSecondsLeft(data.currentSectionRemainingSeconds);
    }
    setPaused(Boolean(data.paused));
  }, []);

  const finishAndShowResult = useCallback(() => {
    leftRef.current = true;
    questionStartRef.current = null;
    queueRef.current?.clear();
    navigate(svc.resultPath, { replace: true });
  }, [navigate, svc]);

  // Opens the screen: load state, register this screen (or take over), send
  // anything this device didn't manage to save last time, THEN trust the
  // server state.
  const openScreen = useCallback(
    async (takeover = false) => {
      const myLoad = ++loadIdRef.current;
      const stale = () => myLoad !== loadIdRef.current;

      // This screen's id. A reload in the same tab keeps it (handed over via
      // sessionStorage on pagehide), so a reload is never mistaken for a second
      // tab. It is taken out of sessionStorage at once, so a duplicated tab or
      // a crashed page can't reuse it.
      if (takeover) {
        sessionIdRef.current = newSessionId();
      } else if (!sessionIdRef.current) {
        try {
          sessionIdRef.current = sessionStorage.getItem(sessionKey);
          sessionStorage.removeItem(sessionKey);
        } catch {
          /* storage unavailable */
        }
        if (!sessionIdRef.current) sessionIdRef.current = newSessionId();
      }

      try {
        let data = await svc.getState();
        if (stale()) return;

        // one save queue per attempt, kept on this device
        const key = isCustom
          ? `testSaveQueue:custom:${data.startedAt}`
          : `testSaveQueue:${attemptId}`;

        // already finished → straight to result (nothing left to keep here)
        if (data.status === "completed") {
          try {
            localStorage.removeItem(key);
          } catch {
            /* ignore */
          }
          finishAndShowResult();
          return;
        }
        if (!queueRef.current || queueRef.current.storageKey !== key) {
          queueRef.current?.destroy();
          queueRef.current = createSaveQueue({
            storageKey: key,
            owner: currentUserId(),
            send: (item) =>
              svc.saveAnswer({
                ...item.payload,
                seq: item.seq,
                sessionId: sessionIdRef.current,
              }),
            onChange: (s) => setQueueState({ pending: s.pending, sending: s.sending }),
            onConflict: () => setConflict("lost"),
            onDropped: (reason) => {
              if (reason === "other_user" || reason === "signed_out") {
                setDropped(reason);
              } else if (reason === "attempt_over") {
                refreshFromServerRef.current?.(); // finished elsewhere → result
              }
            },
          });
        }
        const queue = queueRef.current;

        // register this screen as the one that owns the test
        try {
          const reg = await svc.registerSession(sessionIdRef.current, takeover);
          if (stale()) return;
          queue.setMinSeq(reg?.maxSeq || 0);
        } catch (err) {
          if (stale()) return;
          if (isOtherSessionError(err)) {
            queue.stop();
            applyState(data, queue.pending());
            setConflict("open");
            return;
          }
          // offline / server busy: carry on — saves retry on their own
        }
        setConflict(null);
        queue.resume();

        // unsent saves from last time go first, then the server is trusted
        if (queue.pending().length) {
          const flushed = await queue.flush(navigator.onLine ? 8000 : 1000);
          if (stale()) return;
          if (flushed) {
            data = await svc.getState();
            if (stale()) return;
            if (data.status === "completed") {
              finishAndShowResult();
              return;
            }
          }
        }

        applyState(data, queue.pending());
      } catch (err) {
        if (stale()) return;
        setError(
          err.response?.data?.message || "Failed to load attempt"
        );
      } finally {
        if (!stale()) setLoading(false);
      }
    },
    [svc, isCustom, attemptId, sessionKey, applyState, finishAndShowResult]
  );

  useEffect(() => {
    openScreen(false);
    return () => {
      loadIdRef.current += 1; // ignore a load that finishes after unmount
    };
  }, [openScreen]);

  const refreshFromServerRef = useRef(null);

  // Back on the tab: other screens / devices may have changed things.
  const refreshFromServer = useCallback(async () => {
    const queue = queueRef.current;
    if (!queue || conflictRef.current) return;
    try {
      const data = await svc.getState();
      if (data.status === "completed") {
        finishAndShowResult();
        return;
      }
      const pending = queue.pending();
      if ((data.currentSectionIndex || 0) !== sectionIndexRef.current) {
        applyState(data, pending);
        return;
      }
      setResponses(mergeResponses(data.answers, pending));
      setPaused(Boolean(data.paused));
      const server = data.currentSectionRemainingSeconds;
      if (server != null) {
        // the clock never goes up
        setSecondsLeft((prev) => (prev == null ? server : Math.min(prev, server)));
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        queueRef.current?.clear();
        setDropped("gone");
      }
      /* offline — keep what we have */
    }
  }, [svc, applyState, finishAndShowResult]);

  useEffect(() => {
    refreshFromServerRef.current = refreshFromServer;
  }, [refreshFromServer]);

  // =========================
  // LEAVE GUARDS (back button / tab close)
  // =========================

  // Trap the browser Back button: instead of leaving the test (or landing on
  // the instructions page), re-pin history and show the "Save & Exit" card.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      setShowLeavePrompt(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Escape closes the phone question list.
  useEffect(() => {
    if (!showPalette) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPalette]);

  // Native warning on tab close / refresh so it isn't lost by accident.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Best-effort save when the tab is hidden or closing: the section timer AND
  // the seconds on the current question, by fetch(keepalive) — it can carry
  // the auth header and survives the page going away (sendBeacon can't set
  // Authorization). `release` (tab closing) frees this screen's claim on the
  // test so reopening it doesn't ask "Continue here?".
  const saveOnLeave = useCallback(
    (release) => {
      if (conflictRef.current || !sessionIdRef.current) return;
      // never send anything under another student's login
      if (queueRef.current && !queueRef.current.ownerStillLoggedIn()) return;
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const s = secondsLeftRef.current;
      try {
        fetch(svc.timerUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            attemptId,
            remainingSeconds: s ?? undefined,
            sessionId: sessionIdRef.current,
            release,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }

      const q = currentQuestionRef.current;
      const secs = takeQuestionSeconds();
      if (q && secs > 0 && queueRef.current) {
        // also queued (and kept on this device); the server ignores the
        // second copy by its sequence number
        const item = queueRef.current.enqueueBeacon(
          String(q.questionId),
          timePayload(attemptId, q, secs)
        );
        try {
          fetch(svc.saveUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              ...item.payload,
              seq: item.seq,
              sessionId: sessionIdRef.current,
            }),
            keepalive: true,
          }).catch(() => {});
        } catch {
          /* ignore */
        }
      }
    },
    [svc, attemptId, takeQuestionSeconds]
  );

  useEffect(() => {
    const onPageHide = () => {
      // hand this screen's id to the page that loads next in this tab (reload)
      if (sessionIdRef.current && !conflictRef.current && !leftRef.current) {
        try {
          sessionStorage.setItem(sessionKey, sessionIdRef.current);
        } catch {
          /* ignore */
        }
      }
      saveOnLeave(true);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [saveOnLeave, sessionKey]);

  // Tab hidden → save now. Visible again → reload state and resync the clock.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (!frozenRef.current) saveOnLeave(false);
        questionStartRef.current = null;
      } else {
        if (!frozenRef.current) questionStartRef.current = Date.now();
        refreshFromServer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [saveOnLeave, refreshFromServer]);

  // Leaving the screen inside the app (exit, result): free this screen's claim
  // on the test and stop the queue's timers. Unsent saves stay on the device.
  const saveOnLeaveRef = useRef(saveOnLeave);
  useEffect(() => {
    saveOnLeaveRef.current = saveOnLeave;
  }, [saveOnLeave]);
  useEffect(
    () => () => {
      saveOnLeaveRef.current(true);
      queueRef.current?.destroy();
    },
    []
  );

  // online / offline
  useEffect(() => {
    const up = () => {
      setOnline(true);
      queueRef.current?.retryNow();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // =========================
  // SECTION COUNTDOWN
  // =========================

  // Initialise the clock for the active section. Uses the server's remaining
  // time for the resumed current section (so reload/resume continues), and a
  // full fresh duration for any section entered afterwards.
  useEffect(() => {
    if (!currentSection) return;

    autoSubmitRef.current = false;

    const meta = durationsRef.current.find(
      (d) => d.sectionName === currentSection.sectionName
    );
    const minutes = meta?.durationMinutes || 0;

    const resume = resumeRemainingRef.current;
    if (resume && resume.index === sectionIndex && resume.seconds != null) {
      setSecondsLeft(resume.seconds);
    } else {
      setSecondsLeft(minutes > 0 ? minutes * 60 : null);
    }
    resumeRemainingRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIndex, currentSection?.sectionName]);

  // Tick every second while running. The interval stays alive across sections —
  // it must NOT clear itself at 0, or the next section's countdown would have no
  // ticker. It clamps at 0 (no-op) and resumes decrementing when the next
  // section seeds a fresh time. Pausing clears it (cleanup); resuming re-creates it.
  useEffect(() => {
    if (frozen) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [frozen]);

  // keep a ref of the latest secondsLeft for intervals / unload handlers
  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  // Heartbeat every 10s while running: save the remaining time (so a refresh /
  // power cut resumes from roughly here) and the seconds spent on the current
  // question since the last save (so a crash loses at most ~10 s of it).
  useEffect(() => {
    if (frozen) return;
    const id = setInterval(() => {
      svc
        .syncTimer(secondsLeftRef.current ?? undefined, { sessionId: sessionIdRef.current })
        .catch((err) => {
          if (isOtherSessionError(err)) setConflict("lost");
        });
      if (!document.hidden) {
        const q = currentQuestionRef.current;
        const secs = takeQuestionSeconds();
        if (q && secs > 0) {
          queueRef.current?.enqueue(
            String(q.questionId),
            timePayload(attemptId, q, secs),
            { timeOnly: true }
          );
        }
      }
    }, 10000);
    return () => clearInterval(id);
  }, [frozen, svc, attemptId, takeQuestionSeconds]);

  // auto-submit when section time runs out
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitRef.current && !loading && !paused && !conflict) {
      autoSubmitRef.current = true;
      handleTimeUp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // =========================
  // SAVING
  // =========================

  // Queue a save of the current question (its answer, mark and the seconds
  // spent on it since the last save). Nothing waits for the network.
  // opts: { cleared?: boolean, marked?: boolean }
  const persistCurrent = (toQuestionNumber, saveType, opts = {}) => {
    if (!currentQuestion || !queueRef.current) return;

    const qid = String(currentQuestion.questionId);
    const resp = responses[qid] || {};

    const selectedOption = opts.cleared
      ? null
      : resp.selectedOption ?? null;

    // explicit override wins, otherwise preserve existing marked flag
    const markedForReview =
      opts.marked != null
        ? opts.marked
        : Boolean(resp.markedForReview);

    const answerStatus = selectedOption ? "answered" : "skipped";

    queueRef.current.enqueue(qid, {
      attemptId,
      questionId: currentQuestion.questionId,
      questionNumber: currentQuestion.questionNumber,
      selectedOption,
      answerStatus,
      markedForReview,
      timeSpent: takeQuestionSeconds(),
      fromQuestionNumber: currentQuestion.questionNumber,
      toQuestionNumber,
      saveType,
    });

    setResponses((prev) => ({
      ...prev,
      [qid]: { selectedOption, answerStatus, markedForReview },
    }));
  };

  // Wait until every queued save has reached the server.
  const flushQueue = () =>
    queueRef.current
      ? queueRef.current.flush(navigator.onLine ? 8000 : 1500)
      : Promise.resolve(true);

  // A pause / exit / submit that couldn't be done.
  const showFailure = (err, retry) => {
    if (isOtherSessionError(err)) {
      setConflict("lost");
    } else if (isNetworkError(err)) {
      setNetError({ retry });
    } else {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  // The queue couldn't empty: another screen took over, or no connection.
  const queueBlocked = (retry) => {
    if (!queueRef.current?.isStopped()) setNetError({ retry });
  };

  // =========================
  // ANSWER SELECTION (saved straight away, through the queue)
  // =========================

  const selectOption = (key) => {
    if (!currentQuestion || !queueRef.current) return;
    const qid = String(currentQuestion.questionId);
    const markedForReview = Boolean(responses[qid]?.markedForReview);

    setResponses((prev) => ({
      ...prev,
      [qid]: {
        ...prev[qid],
        selectedOption: key,
        answerStatus: "answered",
      },
    }));

    // Position (currentQuestionId) is unchanged; time is added on navigation
    // and by the heartbeat.
    queueRef.current.enqueue(qid, {
      attemptId,
      questionId: currentQuestion.questionId,
      questionNumber: currentQuestion.questionNumber,
      selectedOption: key,
      answerStatus: "answered",
      markedForReview,
      timeSpent: 0,
      fromQuestionNumber: currentQuestion.questionNumber,
      saveType: "answer_select",
    });
  };

  // =========================
  // NAVIGATION
  // =========================

  const goToIndex = (targetIndex, saveType = "direct_navigation") => {
    if (targetIndex === questionIndex) return;
    const target = sectionQuestions[targetIndex];
    persistCurrent(target?.questionNumber, saveType);
    setQuestionIndex(targetIndex);
  };

  const handleSaveNext = () => {
    const next = questionIndex + 1;
    if (next < sectionQuestions.length) {
      goToIndex(next, "save_and_next");
    } else {
      persistCurrent(undefined, "save_and_next");
    }
  };

  // Toggle "marked for review" on the current question. This button does NOT
  // navigate — moving between questions is done via Save & Next / Previous / the
  // palette.
  const handleToggleMark = () => {
    if (!currentQuestion) return;
    const qid = String(currentQuestion.questionId);
    const currentlyMarked = Boolean(responses[qid]?.markedForReview);
    persistCurrent(undefined, "mark_for_review", {
      marked: !currentlyMarked,
    });
  };

  const handleClearResponse = () => {
    persistCurrent(undefined, "clear_response", { cleared: true });
  };

  // =========================
  // SUBMIT SECTION
  // =========================

  const afterSubmit = (res) => {
    if (res?.attempt?.status === "completed") {
      finishAndShowResult();
      return;
    }
    // move to next section
    setSectionIndex((prev) => prev + 1);
    setQuestionIndex(0);
  };

  // Manual submit (after the confirmation card). Every save must reach the
  // server first; if it can't, nothing is submitted.
  async function handleSubmitSection() {
    if (saving) return;
    setShowSubmitConfirm(false);
    setNetError(null);

    try {
      setSaving(true);
      persistCurrent(undefined, "direct_navigation");
      if (!(await flushQueue())) {
        queueBlocked(handleSubmitSection);
        return;
      }
      const res = await svc.submit(secondsLeftRef.current, {
        sessionId: sessionIdRef.current,
      });
      afterSubmit(res);
    } catch (err) {
      showFailure(err, handleSubmitSection);
    } finally {
      setSaving(false);
    }
  }

  // Time ran out: lock the screen, get every save to the server (up to ~10 s),
  // then submit. Offline → stay locked and submit as soon as we're back.
  async function handleTimeUp() {
    setShowSubmitConfirm(false);
    setShowLeavePrompt(false);
    setShowPalette(false);
    setNetError(null);
    setTimeUp("Time's up – submitting…");
    persistCurrent(undefined, "direct_navigation");

    for (;;) {
      if (leftRef.current) return;
      const flushed = queueRef.current ? await queueRef.current.flush(10000) : true;
      if (queueRef.current?.isStopped()) {
        setTimeUp(null); // another screen took over — its prompt shows instead
        return;
      }
      if (flushed) {
        try {
          const res = await svc.submit(secondsLeftRef.current, {
            sessionId: sessionIdRef.current,
          });
          setTimeUp(null);
          afterSubmit(res);
          return;
        } catch (err) {
          if (isOtherSessionError(err)) {
            setTimeUp(null);
            setConflict("lost");
            return;
          }
          if (!isNetworkError(err)) {
            setTimeUp(null);
            setError(err.response?.data?.message || "Failed to submit section");
            return;
          }
        }
      }
      setTimeUp(
        navigator.onLine
          ? "Time's up – trying to reach the server…"
          : "Time's up – submitting when you're back online"
      );
      await waitForOnline(15000);
    }
  }

  // =========================
  // PAUSE / RESUME / EXIT
  // =========================

  const handlePause = async () => {
    if (saving || paused) return;
    setNetError(null);
    try {
      setSaving(true);
      // save the current selection/time before freezing the clock
      persistCurrent(undefined, "direct_navigation");
      if (!(await flushQueue())) {
        queueBlocked(handlePause);
        return;
      }
      await svc.pause(secondsLeftRef.current, { sessionId: sessionIdRef.current });
      setPaused(true);
    } catch (err) {
      showFailure(err, handlePause);
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    setNetError(null);
    try {
      setSaving(true);
      const res = await svc.resume({ sessionId: sessionIdRef.current });
      if (res?.currentSectionRemainingSeconds != null) {
        setSecondsLeft(res.currentSectionRemainingSeconds);
      }
      setPaused(false);
    } catch (err) {
      showFailure(err, handleResume);
    } finally {
      setSaving(false);
    }
  };

  // Save & Exit (paused screen, top-bar Exit, browser Back): save the current
  // question, wait until every save is on the server, make sure the attempt is
  // paused there, then leave — ranked/practice → My Attempts, custom → the set.
  const handleSaveAndExit = async () => {
    setNetError(null);
    try {
      setSaving(true);
      persistCurrent(undefined, "direct_navigation");
      if (!(await flushQueue())) {
        queueBlocked(handleSaveAndExit);
        return;
      }
      if (!paused) {
        await svc.pause(secondsLeftRef.current, { sessionId: sessionIdRef.current });
      }
      // free this screen's claim first, so reopening the test straight away
      // never asks "Continue here?"
      await svc
        .syncTimer(secondsLeftRef.current ?? undefined, {
          sessionId: sessionIdRef.current,
          release: true,
        })
        .catch(() => {});
      leftRef.current = true;
      questionStartRef.current = null;
      navigate(svc.leavePath);
    } catch (err) {
      showFailure(err, handleSaveAndExit);
    } finally {
      setSaving(false);
    }
  };

  // "Continue here" — take the test over from the other tab / device.
  const handleTakeOver = async () => {
    setSaving(true);
    await openScreen(true);
    setSaving(false);
  };

  // =========================
  // RENDER STATES
  // =========================

  if (loading) {
    return (
      <div className="text-lg font-medium">Loading attempt...</div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div className="text-red-600 font-medium">{error}</div>
    );
  }

  if (!currentQuestion) {
    return <div>No questions found.</div>;
  }

  const currentResp = responses[String(currentQuestion.questionId)];
  const selectedKey = currentResp?.selectedOption;
  const isMarked = Boolean(currentResp?.markedForReview);

  const isLastSection = sectionIndex === sections.length - 1;

  const sectionAnswered = sectionQuestions.filter(
    (q) => responses[String(q.questionId)]?.selectedOption
  ).length;
  const sectionMarked = sectionQuestions.filter(
    (q) => responses[String(q.questionId)]?.markedForReview
  ).length;

  const sectionLabel = (ATTEMPT_LABEL[attempt?.attemptType] || ATTEMPT_LABEL.practice);
  const isLastQuestion = questionIndex >= sectionQuestions.length - 1;

  // "Saved" / "Saving…" / "Offline"
  const saveStatus = !online
    ? "offline"
    : queueState.pending > 0 || queueState.sending
    ? "saving"
    : "saved";
  const saveStatusLabel = {
    saved: "✓ Saved",
    saving: "Saving…",
    offline: "Offline",
  }[saveStatus];

  // The question-number grid. Shown beside the question on tablets/desktops and
  // inside the slide-up "Questions" panel on phones.
  const renderPalette = (inSheet) => (
    <>
      <div className={`grid gap-2 lg:gap-3 ${inSheet ? "grid-cols-5 min-[400px]:grid-cols-6" : "grid-cols-4"}`}>
        {sectionQuestions.map((q, index) => {
          const resp = responses[String(q.questionId)];
          return (
            <button
              key={q.questionId}
              onClick={() => {
                if (inSheet) setShowPalette(false);
                goToIndex(index);
              }}
              disabled={saving}
              aria-label={`Question ${q.sectionQuestionNumber}`}
              aria-current={index === questionIndex ? "true" : undefined}
              className={paletteBg(resp, index === questionIndex)}
            >
              {q.sectionQuestionNumber}
              {resp?.markedForReview && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 border-2 border-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className={`mt-6 text-xs text-gray-600 ${inSheet ? "grid grid-cols-2 gap-2" : "space-y-2"}`}>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500 shrink-0" /> Answered
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-orange-400 shrink-0" /> Skipped
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0" /> Marked
          for review
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded border border-gray-300 bg-white shrink-0" />{" "}
          Not visited
        </div>
      </div>

      <button
        onClick={() => {
          setShowPalette(false);
          setShowSubmitConfirm(true);
        }}
        disabled={saving}
        className="w-full mt-6 px-4 py-3 rounded-2xl bg-green-600 text-white font-medium disabled:opacity-40"
      >
        {isLastSection ? "Submit Test" : "Submit Section"}
      </button>
    </>
  );

  const langButton = (code, full) => (
    <button
      onClick={() => changeLang(code)}
      aria-pressed={lang === code}
      className={`min-w-10 h-10 px-3 text-sm font-medium transition ${
        lang === code
          ? "bg-black text-white"
          : "bg-white text-gray-600 hover:text-black"
      }`}
    >
      {full}
    </button>
  );

  // a full-screen card (pause, leave, submit, errors…)
  const overlay = (children, label) => (
    <div
      className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="bg-white rounded-3xl p-6 sm:p-10 text-center w-full max-w-sm shadow-xl">
        {children}
      </div>
    </div>
  );

  return (
    <>
      {/* ========================= */}
      {/* FIXED TOP BAR */}
      {/* ========================= */}

      <header className="fixed top-0 inset-x-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1100px] mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold text-gray-900 truncate"
              title={currentSection?.sectionName}
            >
              {currentSection?.sectionName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              <span
                role="status"
                aria-live="polite"
                data-save-status={saveStatus}
                className={
                  saveStatus === "offline"
                    ? "text-amber-700 font-medium"
                    : saveStatus === "saving"
                    ? "text-gray-600"
                    : "text-green-700"
                }
              >
                {saveStatusLabel}
              </span>
              {" · "}
              Section {sectionIndex + 1} / {sections.length}
              {attempt?.attemptType && (
                <>
                  {" · "}
                  {sectionLabel.short}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Language: one switch on phones, both choices from 640px */}
            <button
              onClick={() => changeLang(lang === "hi" ? "en" : "hi")}
              aria-label={lang === "hi" ? "Switch to English" : "Switch to Hindi"}
              className="sm:hidden min-w-10 h-10 px-2 rounded-xl border border-gray-300 text-sm font-medium"
            >
              {lang === "hi" ? "EN" : "हिंदी"}
            </button>
            <div className="hidden sm:flex items-center rounded-xl border border-gray-300 overflow-hidden">
              {langButton("en", "English")}
              {langButton("hi", "हिंदी")}
            </div>

            {/* Countdown */}
            {secondsLeft !== null && (
              <div
                className={`h-10 flex items-center px-2 sm:px-4 rounded-xl text-sm font-semibold tabular-nums ${
                  secondsLeft <= 60
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <span className="hidden sm:inline" aria-hidden="true">⏱&nbsp;</span>
                {formatClock(secondsLeft)}
              </div>
            )}

            {/* Pause */}
            <button
              onClick={handlePause}
              disabled={saving || paused}
              aria-label="Pause test"
              className="min-w-10 h-10 px-2 sm:px-4 rounded-xl text-sm font-medium border border-gray-300 hover:border-black disabled:opacity-40"
            >
              ⏸<span className="hidden sm:inline"> Pause</span>
            </button>

            {/* Exit — same card as the browser Back button */}
            <button
              onClick={() => setShowLeavePrompt(true)}
              disabled={saving}
              aria-label="Exit test"
              className="min-w-10 h-10 px-2 sm:px-4 rounded-xl text-sm font-medium border border-gray-300 hover:border-black disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                <path d="M9 16l-4-4 4-4" />
                <path d="M5 12h11" />
              </svg>
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        {/* Offline: the full message under the bar */}
        {saveStatus === "offline" && (
          <div className="border-t border-amber-200 bg-amber-50 text-amber-800 text-xs sm:text-sm px-3 py-1.5 text-center">
            {OFFLINE_TEXT}
          </div>
        )}
      </header>

      <div
        className={`max-w-[1100px] mx-auto ${
          saveStatus === "offline" ? "pt-[5.25rem] sm:pt-[5.75rem]" : "pt-14 sm:pt-16"
        } pb-24 md:pb-0 md:grid md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_17rem] gap-4 lg:gap-6 items-start`}
      >
      {/* ========================= */}
      {/* LEAVE PROMPT (Exit button / browser Back) */}
      {/* ========================= */}

      {showLeavePrompt && !paused && !conflict && !timeUp && overlay(
        <>
          <div className="text-4xl mb-3">⏸</div>
          <h2 className="text-2xl font-bold text-gray-900">Leave the test?</h2>
          <p className="text-gray-500 mt-2">
            Your answers and time are saved and the test is paused. You'll
            resume from exactly where you left off.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={handleSaveAndExit}
              disabled={saving}
              className="w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save & Exit"}
            </button>
            <button
              onClick={() => setShowLeavePrompt(false)}
              disabled={saving}
              className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
            >
              Stay in test
            </button>
          </div>
        </>,
        "Leave the test?"
      )}

      {/* ========================= */}
      {/* PAUSED OVERLAY */}
      {/* ========================= */}

      {paused && !conflict && overlay(
        <>
          <div className="text-4xl mb-3">⏸</div>
          <h2 className="text-2xl font-bold text-gray-900">Test paused</h2>
          <p className="text-gray-500 mt-2">
            Your timer is frozen. The test stays hidden until you resume.
          </p>
          {attempt?.attemptType === "ranked" && (
            <p className="text-sm text-gray-700 mt-3">
              Your answers and remaining time are saved. Resume any time from My Attempts.
            </p>
          )}
          {secondsLeft !== null && (
            <p className="text-gray-800 font-semibold mt-4 tabular-nums">
              {isCustom ? "Time left" : "Time left in this section"}:{" "}
              {formatClock(secondsLeft)}
            </p>
          )}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleResume}
              disabled={saving}
              className="w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
            >
              ▶ Resume test
            </button>
            <button
              onClick={handleSaveAndExit}
              disabled={saving}
              className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
            >
              Save &amp; Exit
            </button>
          </div>
        </>,
        "Test paused"
      )}

      {/* ========================= */}
      {/* SUBMIT CONFIRMATION CARD */}
      {/* ========================= */}

      {showSubmitConfirm && !conflict && !timeUp && overlay(
        <>
          <div className="text-4xl mb-3">{isLastSection ? "🏁" : "📤"}</div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isLastSection ? "Finish the test?" : "Submit this section?"}
          </h2>

          {/* Section summary */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-lg font-bold text-gray-900">{sectionQuestions.length}</p>
              <p className="text-xs text-gray-500">Questions</p>
            </div>
            <div className="rounded-2xl bg-green-50 p-3">
              <p className="text-lg font-bold text-green-700">{sectionAnswered}</p>
              <p className="text-xs text-gray-500">Answered</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-3">
              <p className="text-lg font-bold text-purple-700">{sectionMarked}</p>
              <p className="text-xs text-gray-500">Marked</p>
            </div>
          </div>

          <p className="text-gray-500 mt-5 text-sm">
            {isLastSection
              ? "This ends the test and generates your result. You can't come back to it."
              : "You won't be able to return to this section once submitted."}
          </p>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleSubmitSection}
              disabled={saving}
              className="w-full bg-green-600 text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving
                ? "Submitting..."
                : isLastSection
                ? "Submit & finish test"
                : "Submit section"}
            </button>
            <button
              onClick={() => setShowSubmitConfirm(false)}
              disabled={saving}
              className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
            >
              Go back
            </button>
          </div>
        </>,
        isLastSection ? "Finish the test?" : "Submit this section?"
      )}

      {/* ========================= */}
      {/* CAN'T REACH THE SERVER */}
      {/* ========================= */}

      {netError && !conflict && !timeUp && overlay(
        <>
          <div className="text-4xl mb-3">📶</div>
          <h2 className="text-xl font-bold text-gray-900">Not saved yet</h2>
          <p className="text-gray-600 mt-2">{NET_ERROR_TEXT}</p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => netError.retry()}
              disabled={saving}
              className="w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Trying..." : "Retry"}
            </button>
            <button
              onClick={() => setNetError(null)}
              disabled={saving}
              className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
            >
              Back to the test
            </button>
          </div>
        </>,
        "Not saved yet"
      )}

      {/* ========================= */}
      {/* TIME'S UP (screen locked until submitted) */}
      {/* ========================= */}

      {timeUp && !conflict && overlay(
        <>
          <div className="text-4xl mb-3">⏰</div>
          <h2 className="text-xl font-bold text-gray-900" role="status" aria-live="assertive">
            {timeUp}
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            Keep this page open. Your answers are kept on this device until they're saved.
          </p>
        </>,
        "Time's up"
      )}

      {/* ========================= */}
      {/* SAVING STOPPED (signed out / another student signed in) */}
      {/* ========================= */}

      {dropped && overlay(
        <>
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-gray-900">Saving stopped</h2>
          <p className="text-gray-600 mt-2">{DROPPED_TEXT[dropped]}</p>
          <div className="mt-6">
            <button
              onClick={() => {
                leftRef.current = true;
                navigate(dropped === "gone" ? svc.leavePath : "/login");
              }}
              className="w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90"
            >
              {dropped === "gone" ? "Back" : "Go to login"}
            </button>
          </div>
        </>,
        "Saving stopped"
      )}

      {/* ========================= */}
      {/* OPENED IN ANOTHER TAB / DEVICE */}
      {/* ========================= */}

      {conflict && !dropped && overlay(
        <>
          <div className="text-4xl mb-3">🗂</div>
          <h2 className="text-xl font-bold text-gray-900">{CONFLICT_TEXT}</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Only one screen can work on a test at a time. Continuing here makes the
            other one read-only.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={handleTakeOver}
              disabled={saving}
              className="w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Please wait..." : "Continue here"}
            </button>
            <button
              onClick={() => {
                leftRef.current = true;
                navigate(svc.leavePath);
              }}
              disabled={saving}
              className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
            >
              Leave
            </button>
          </div>
        </>,
        "Test open elsewhere"
      )}

      {/* ========================= */}
      {/* QUESTION AREA */}
      {/* ========================= */}

      <div className="min-w-0">
        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200 p-4 sm:p-6 lg:p-8 shadow-sm">
          {/* Header */}
          <div className="mb-5 sm:mb-6">
            <p className="text-sm text-gray-500 break-words">
              {currentSection.sectionName}
              <span className="text-gray-300"> · </span>
              {currentQuestion.subjectName}
              {attempt?.attemptType && (
                <>
                  <span className="text-gray-300"> · </span>
                  {sectionLabel.long}
                </>
              )}
            </p>

            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
              Question {currentQuestion.sectionQuestionNumber}
              <span className="text-gray-400 text-base font-medium">
                {" "}
                / {sectionQuestions.length}
              </span>
              {isMarked && (
                <span className="ml-3 align-middle text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">
                  Marked
                </span>
              )}
            </h2>
          </div>

          {/* Question */}
          <div
            className="text-gray-900 leading-7 prose max-w-none break-words [&_img]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
            dangerouslySetInnerHTML={{
              __html: drawMathInHtml(pickText(currentQuestion.question, lang)),
            }}
          />

          {/* Options */}
          <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
            {currentQuestion.options.map((option) => {
              const active = selectedKey === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => selectOption(option.key)}
                  className={`w-full text-left border rounded-2xl p-3 sm:p-4 transition ${
                    active
                      ? "border-black bg-gray-50"
                      : "border-gray-200 hover:border-black"
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-medium shrink-0 ${
                        active
                          ? "bg-black text-white border-black"
                          : "border-gray-300"
                      }`}
                    >
                      {option.key}
                    </div>

                    <div
                      className="prose max-w-none min-w-0 flex-1 break-words pt-0.5 [&_img]:max-w-full [&_img]:h-auto"
                      dangerouslySetInnerHTML={{
                        __html: drawMathInHtml(pickText(option.text, lang)),
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Clear (phones — the other actions live in the bottom bar) */}
          <div className="md:hidden flex justify-end mt-4">
            <button
              onClick={handleClearResponse}
              disabled={saving || !selectedKey}
              className="min-h-10 px-4 rounded-xl border border-gray-300 text-sm font-medium disabled:opacity-40"
            >
              Clear response
            </button>
          </div>

          {/* Action row (tablets: 2 x 2 grid; desktops: one row) */}
          <div className="hidden md:grid grid-cols-2 gap-3 mt-8 lg:flex lg:flex-wrap lg:items-center lg:mt-10">
            <button
              onClick={handleClearResponse}
              disabled={saving || !selectedKey}
              className="px-5 py-3 rounded-2xl border border-gray-300 disabled:opacity-40"
            >
              Clear
            </button>

            <button
              onClick={handleToggleMark}
              disabled={saving}
              className={`px-5 py-3 rounded-2xl border disabled:opacity-40 ${
                isMarked
                  ? "border-purple-500 bg-purple-100 text-purple-800"
                  : "border-purple-400 text-purple-700"
              }`}
            >
              {isMarked ? "Unmark for Review" : "Mark for Review"}
            </button>

            <div className="hidden lg:block flex-1" />

            <button
              disabled={saving || questionIndex === 0}
              onClick={() => goToIndex(questionIndex - 1)}
              className="px-6 py-3 rounded-2xl border border-gray-300 disabled:opacity-40"
            >
              Previous
            </button>

            {!isLastQuestion ? (
              <button
                disabled={saving}
                onClick={handleSaveNext}
                className="px-6 py-3 rounded-2xl bg-black text-white disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                disabled={saving}
                onClick={() => setShowSubmitConfirm(true)}
                className="px-6 py-3 rounded-2xl bg-green-600 text-white disabled:opacity-40"
              >
                {isLastSection ? "Submit Test" : "Submit Section"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* QUESTION PALETTE (tablets / desktops) */}
      {/* ========================= */}

      <aside className="hidden md:block min-w-0 sticky top-20">
        <div className="bg-white rounded-3xl border border-gray-200 p-4 lg:p-6 shadow-sm max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-lg font-bold">
              Section {sectionIndex + 1}
              <span className="text-gray-400 font-medium">
                {" "}
                / {sections.length}
              </span>
            </h3>
            <span className="text-xs text-gray-500 shrink-0">
              {totalQuestions} total
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-5 break-words">
            {currentSection.sectionName}
          </p>

          {renderPalette(false)}
        </div>
      </aside>
      </div>

      {/* ========================= */}
      {/* PHONE BOTTOM BAR */}
      {/* ========================= */}

      <nav
        aria-label="Question navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 gap-1.5 px-2 py-2">
          <button
            disabled={saving || questionIndex === 0}
            onClick={() => goToIndex(questionIndex - 1)}
            className="min-h-12 rounded-xl border border-gray-300 flex flex-col items-center justify-center leading-tight disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span className="text-xs font-medium">Previous</span>
          </button>

          <button
            onClick={() => setShowPalette(true)}
            aria-haspopup="dialog"
            aria-label={`Questions — ${currentQuestion.sectionQuestionNumber} of ${sectionQuestions.length}`}
            className="min-h-12 rounded-xl border border-gray-300 bg-gray-50 flex flex-col items-center justify-center leading-tight"
          >
            <span className="text-sm font-bold tabular-nums">
              {currentQuestion.sectionQuestionNumber}/{sectionQuestions.length}
            </span>
            <span className="text-xs font-medium text-gray-600">Questions</span>
          </button>

          <button
            onClick={handleToggleMark}
            disabled={saving}
            aria-pressed={isMarked}
            className={`min-h-12 rounded-xl border flex flex-col items-center justify-center leading-tight disabled:opacity-40 ${
              isMarked
                ? "border-purple-500 bg-purple-100 text-purple-800"
                : "border-purple-400 text-purple-700"
            }`}
          >
            <span aria-hidden="true" className="text-base">⚑</span>
            <span className="text-xs font-medium">{isMarked ? "Unmark" : "Mark Review"}</span>
          </button>

          {!isLastQuestion ? (
            <button
              disabled={saving}
              onClick={handleSaveNext}
              className="min-h-12 rounded-xl bg-black text-white flex flex-col items-center justify-center leading-tight disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span className="text-xs font-medium">Save &amp; Next</span>
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={() => setShowSubmitConfirm(true)}
              className="min-h-12 rounded-xl bg-green-600 text-white flex flex-col items-center justify-center leading-tight disabled:opacity-40"
            >
              <span aria-hidden="true" className="text-base">✓</span>
              <span className="text-xs font-medium">{isLastSection ? "Submit" : "Submit Sec."}</span>
            </button>
          )}
        </div>
      </nav>

      {/* ========================= */}
      {/* PHONE QUESTION PANEL (slide-up) */}
      {/* ========================= */}

      {showPalette && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end bg-gray-900/50"
          onClick={() => setShowPalette(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Questions in this section"
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl shadow-xl max-h-[85vh] overflow-y-auto px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-[sheet-up_200ms_ease-out] motion-reduce:animate-none"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold">
                  Questions {currentQuestion.sectionQuestionNumber}/{sectionQuestions.length}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  Section {sectionIndex + 1} / {sections.length} · {currentSection.sectionName}
                </p>
              </div>
              <button
                onClick={() => setShowPalette(false)}
                aria-label="Close question list"
                className="w-11 h-11 shrink-0 -mr-2 -mt-1 flex items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {renderPalette(true)}
          </div>
        </div>
      )}
    </>
  );
}

export default AttemptPage;
