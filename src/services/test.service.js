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

export const submitSection =
  async (attemptId) => {

    const response = await api.post(
      "/api/student/attempt/submit-section",
      {
        attemptId
      }
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