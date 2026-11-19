// Reliable answer saving for the test screen.
//
//  - Every save goes into a queue that is also kept in localStorage (one key
//    per attempt), so a crash or closed tab loses nothing that was queued.
//  - Saves are sent one at a time, in order — never two in flight together.
//  - For the same question only the LATEST unsent save is kept: a newer
//    selection replaces an older unsent one (its seconds are added on, so no
//    time is lost). A save that is already being sent is never replaced.
//  - A failed save is retried after 1 s, 2 s, 5 s, 10 s, then every 15 s.
//  - Each save carries an increasing sequence number. The server ignores a
//    save that is not newer than the one it already has for that question,
//    so a slow old save can never overwrite a newer answer and a repeated
//    (retried) save is never counted twice.
//  - The queue belongs to the student who made it. If a different student
//    (or nobody) is logged in when a save is due, everything is dropped
//    without being sent, and the device copy is removed.
//  - A save the server refuses for good is dropped, never retried. If the
//    refusal means the whole attempt is over for this device (not logged in,
//    attempt not found, test already submitted) the whole queue and its
//    device copy are cleared.

const STORAGE_PREFIX = "testSaveQueue:";

// Who is logged in on this device right now: the student's id (or, if the
// stored login has no id, the login token itself). null = nobody.
export const currentUserId = () => {
  try {
    const id = JSON.parse(localStorage.getItem("user") || "null")?.id;
    if (id) return String(id);
    const token = localStorage.getItem("token");
    return token ? "token:" + token : null;
  } catch {
    return null;
  }
};

// After a login: remove any unsent test saves left by a different student.
export function purgeOtherUsersQueues(userId) {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => {
      let owner = null;
      try {
        owner = JSON.parse(localStorage.getItem(k) || "null")?.owner || null;
      } catch {
        /* unreadable → remove */
      }
      if (!owner || String(owner) !== String(userId)) localStorage.removeItem(k);
    });
  } catch {
    /* storage unavailable */
  }
}

// Refusals that end this attempt for this device (vs. refusing one save).
const endsAttempt = (err) => {
  const status = err?.response?.status;
  const message = String(err?.response?.data?.message || "");
  if (status === 401 || status === 404) return true;
  return /already (completed|submitted)/i.test(message) && !/section/i.test(message);
};

const RETRY_DELAYS = [1000, 2000, 5000, 10000, 15000];

// 409 OTHER_SESSION: the test is now open in another tab or device
export const isOtherSessionError = (err) =>
  err?.response?.status === 409 && err.response.data?.code === "OTHER_SESSION";

// worth retrying: no answer from the server, or a temporary server problem
export const isNetworkError = (err) => {
  const status = err?.response?.status;
  return !status || status >= 500 || status === 408 || status === 429;
};

export function createSaveQueue({
  storageKey,
  owner,
  currentOwner = currentUserId,
  send,
  onChange,
  onConflict,
  onDropped,
}) {
  let items = []; // { key, seq, payload, timeOnly, sending?, beaconed? }
  let lastSeq = 0;
  let sending = false;
  let failures = 0;
  let retryTimer = null;
  let stopped = false;
  let destroyed = false;
  // dropped for good (other student / signed out / attempt over): accepts
  // nothing more and never writes to the device again
  let dead = false;
  const waiters = new Set();

  // ---- restore what an earlier page left behind ----
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && saved.owner && owner && String(saved.owner) !== String(owner)) {
      // another student's leftovers — never send them under this login
      localStorage.removeItem(storageKey);
    } else if (saved) {
      lastSeq = Number(saved.seq) || 0;
      items = (Array.isArray(saved.items) ? saved.items : []).map((i) => ({
        ...i,
        sending: false,
        // it may already have gone out by keepalive — never merge into it
        beaconed: true,
      }));
    }
  } catch {
    /* storage unavailable: queue still works in memory */
  }

  const persist = () => {
    if (dead) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          owner,
          seq: lastSeq,
          items: items.map(({ key, seq, payload, timeOnly }) => ({ key, seq, payload, timeOnly })),
        })
      );
    } catch {
      /* ignore */
    }
  };

  const idle = () => !items.length && !sending;

  const status = () => ({
    pending: items.length,
    sending,
    failing: failures > 0,
    stopped,
  });

  const notify = () => {
    if (destroyed) return;
    onChange?.(status());
    if (idle() || stopped) {
      for (const w of [...waiters]) w(idle());
    }
  };

  const nextSeq = () => {
    lastSeq = Math.max(Date.now(), lastSeq + 1);
    return lastSeq;
  };

  // drop everything and the device copy, for good
  const dropAll = () => {
    dead = true;
    items = [];
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  // the student who made these saves is still the one logged in
  const ownerStillLoggedIn = () =>
    Boolean(owner) && String(currentOwner() || "") === String(owner);

  const pump = () => {
    if (sending || stopped || destroyed || retryTimer || !items.length) return;
    if (!ownerStillLoggedIn()) {
      dropAll();
      stopped = true;
      notify();
      onDropped?.("other_user");
      return;
    }
    const item = items[0];
    sending = true;
    item.sending = true;
    notify();

    Promise.resolve()
      .then(() => send(item))
      .then(
        () => {
          items = items.filter((i) => i !== item);
          failures = 0;
        },
        (err) => {
          item.sending = false;
          if (isOtherSessionError(err)) {
            stopped = true;
            onConflict?.(err);
          } else if (!isNetworkError(err)) {
            if (endsAttempt(err)) {
              // not logged in / attempt gone / test already submitted:
              // nothing in this queue can ever be saved
              dropAll();
              stopped = true;
              onDropped?.(err.response?.status === 401 ? "signed_out" : "attempt_over", err);
            } else {
              // this one save was refused (e.g. its section was already submitted)
              items = items.filter((i) => i !== item);
              onDropped?.("refused", err);
            }
          } else {
            failures += 1;
            const delay = RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length) - 1];
            retryTimer = setTimeout(() => {
              retryTimer = null;
              pump();
            }, delay);
          }
        }
      )
      .finally(() => {
        sending = false;
        persist();
        notify();
        pump();
      });
  };

  const add = (item, mergeable) => {
    if (dead) return item;
    const idx = mergeable
      ? items.findIndex((i) => i.key === item.key && !i.sending && !i.beaconed)
      : -1;

    if (idx >= 0) {
      const old = items[idx];
      const timeSpent = (old.payload.timeSpent || 0) + (item.payload.timeSpent || 0);
      // a time-only save keeps the older unsent answer; any other save replaces it
      items[idx] =
        item.timeOnly && !old.timeOnly
          ? { ...item, timeOnly: false, payload: { ...old.payload, timeSpent } }
          : { ...item, payload: { ...item.payload, timeSpent } };
    } else {
      items.push(item);
    }
    persist();
    notify();
    pump();
    return idx >= 0 ? items[idx] : item;
  };

  return {
    storageKey,

    // queue a save for question `key`
    enqueue(key, payload, { timeOnly = false } = {}) {
      return add({ key, seq: nextSeq(), payload, timeOnly }, true);
    },

    // queue a save that is ALSO sent right now by fetch(keepalive); it is never
    // merged with later saves (the server drops the duplicate by its seq)
    enqueueBeacon(key, payload) {
      return add({ key, seq: nextSeq(), payload, timeOnly: true, beaconed: true }, false);
    },

    // unsent saves (oldest first)
    pending: () => items.map(({ key, seq, payload, timeOnly }) => ({ key, seq, payload, timeOnly })),

    // resolves true once everything is saved, false if that doesn't happen in time
    flush(timeoutMs) {
      if (stopped || destroyed) return Promise.resolve(false);
      if (idle()) return Promise.resolve(true);
      this.retryNow();
      return new Promise((resolve) => {
        const done = (ok) => {
          clearTimeout(timer);
          waiters.delete(done);
          resolve(ok);
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        waiters.add(done);
      });
    },

    // skip the back-off wait (e.g. the browser came back online)
    retryNow() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      pump();
    },

    // never number a new save at or below a sequence the server already has
    setMinSeq(seq) {
      lastSeq = Math.max(lastSeq, Number(seq) || 0);
      persist();
    },

    // stop sending (this screen lost the test to another tab) / start again
    stop() {
      stopped = true;
      notify();
    },
    resume() {
      if (dead) return;
      stopped = false;
      failures = 0;
      notify();
      pump();
    },
    isStopped: () => stopped,

    // the test is finished — nothing left to keep on this device
    clear() {
      dropAll();
      notify();
    },

    isDead: () => dead,

    // the student who made these saves is still the one logged in
    ownerStillLoggedIn,

    destroy() {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      for (const w of [...waiters]) w(false);
    },
  };
}
