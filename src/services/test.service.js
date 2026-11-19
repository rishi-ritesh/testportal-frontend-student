import api from "../api/axios";

// =========================
// TESTS
// =========================

export const getPublishedTests = async () => {
  const response = await api.get(
    "/api/student/tests"
  );

  return response.data;
};

export const getTestById = async (testId) => {
  const response = await api.get(
    `/api/student/tests/${testId}`
  );

  return response.data;
};

export const getNextAttemptInfo = async (testId) => {
  const response = await api.get(
    `/api/student/tests/${testId}/next-attempt`
  );

  return response.data;
};

// =========================
// PACKAGES (TEST SERIES)
// =========================

export const getPackages = async () => {
  const response = await api.get("/api/student/packages");
  return response.data;
};

export const getPackageById = async (packageId) => {
  const response = await api.get(
    `/api/student/packages/${packageId}`
  );
  return response.data;
};

// =========================
// ATTEMPTS
// =========================

export const startAttempt = async (
  testId
) => {
  const response = await api.post(
    "/api/student/attempt/start",
    {
      testId
    }
  );

  return response.data;
};

export const getAttemptState =
  async (attemptId) => {

    const response = await api.get(
      `/api/student/attempt/${attemptId}`
    );

    return response.data;
  };

export const getMyAttempts = async () => {

  const response = await api.get(
    "/api/student/attempts"
  );

  return response.data;
};

export const saveAnswer = async (
  payload
) => {

  const response = await api.post(
    "/api/student/attempt/save-answer",
    payload
  );

  return response.data;
};

// `extra` carries the test screen's sessionId (one open screen per attempt)
export const submitSection =
  async (attemptId, extra = {}) => {

    const response = await api.post(
      "/api/student/attempt/submit-section",
      {
        attemptId,
        ...extra
      }
    );

    return response.data;
  };

export const pauseAttempt = async (attemptId, remainingSeconds, extra = {}) => {
  const response = await api.post(
    "/api/student/attempt/pause",
    { attemptId, remainingSeconds, ...extra }
  );

  return response.data;
};

export const syncTimer = async (attemptId, remainingSeconds, extra = {}) => {
  const response = await api.post(
    "/api/student/attempt/timer",
    { attemptId, remainingSeconds, ...extra }
  );

  return response.data;
};

export const resumeAttempt = async (attemptId, extra = {}) => {
  const response = await api.post(
    "/api/student/attempt/resume",
    { attemptId, ...extra }
  );

  return response.data;
};

// The test screen registers itself when it opens. 409 OTHER_SESSION = the
// test is open in another tab/device; takeover = "Continue here".
export const registerAttemptSession = async (attemptId, sessionId, takeover = false) => {
  const response = await api.post(
    "/api/student/attempt/session",
    { attemptId, sessionId, takeover }
  );

  return response.data;
};

export const getResult = async (
  attemptId
) => {

  const response = await api.get(
    `/api/student/result/${attemptId}`
  );

  return response.data;
};

// =========================
// BOOKMARKS
// =========================

export const getBookmarks = async () => {
  const response = await api.get("/api/student/bookmarks");
  return response.data;
};

export const getBookmarkIds = async () => {
  const response = await api.get("/api/student/bookmarks/ids");
  return response.data;
};

export const toggleBookmark = async (questionId) => {
  const response = await api.post(`/api/student/bookmark/${questionId}`);
  return response.data;
};
// =========================
// CUSTOM PRACTICE SET
// =========================
// The student's own set built from bookmarks (one per student, no marks).

export const getCustomSet = async () => {
  const response = await api.get("/api/student/custom-set");
  return response.data;
};

export const addToCustomSet = async (questionIds) => {
  const response = await api.post("/api/student/custom-set/questions", { questionIds });
  return response.data;
};

export const removeFromCustomSet = async (questionId) => {
  const response = await api.delete(`/api/student/custom-set/questions/${questionId}`);
  return response.data;
};

export const clearCustomSet = async () => {
  const response = await api.delete("/api/student/custom-set");
  return response.data;
};

export const updateCustomSetTimer = async (secondsPerQuestion) => {
  const response = await api.put("/api/student/custom-set/timer", { secondsPerQuestion });
  return response.data;
};

export const startCustomSet = async () => {
  const response = await api.post("/api/student/custom-set/start");
  return response.data;
};

export const getCustomSetResult = async () => {
  const response = await api.get("/api/student/custom-set/result");
  return response.data;
};

// The same functions the test screen uses for ranked/practice attempts, but
// pointed at the custom set. AttemptPage receives this as its `service` prop.
export const customAttemptService = {
  getState: async () => (await api.get("/api/student/custom-set/attempt")).data,
  registerSession: async (sessionId, takeover = false) =>
    (await api.post("/api/student/custom-set/attempt/session", { sessionId, takeover })).data,
  saveAnswer: async (payload) =>
    (await api.post("/api/student/custom-set/attempt/save-answer", payload)).data,
  submit: async (remainingSeconds, extra = {}) =>
    (await api.post("/api/student/custom-set/attempt/submit", { remainingSeconds, ...extra })).data,
  pause: async (remainingSeconds, extra = {}) =>
    (await api.post("/api/student/custom-set/attempt/pause", { remainingSeconds, ...extra })).data,
  resume: async (extra = {}) =>
    (await api.post("/api/student/custom-set/attempt/resume", extra)).data,
  syncTimer: async (remainingSeconds, extra = {}) =>
    (await api.post("/api/student/custom-set/attempt/timer", { remainingSeconds, ...extra })).data,
  // used for the best-effort saves when the tab is hidden or closes
  timerUrl: `${api.defaults.baseURL}/api/student/custom-set/attempt/timer`,
  saveUrl: `${api.defaults.baseURL}/api/student/custom-set/attempt/save-answer`,
  resultPath: "/custom-set/result",
  leavePath: "/custom-set",
};
