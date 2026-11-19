// What a student can do next on a mock, from the `attempt` summary the server
// sends with each mock (status + ranked / latest practice attempt). One place,
// so the series page, dashboard and cards always agree.
//
//   not started → "Start Test"            (instructions)
//   in progress → "Resume"                (straight to the open attempt)
//   completed   → "View Result"           (ranked result)
//                 + "Re-attempt (Practice)" (instructions)
//
// The rules for which attempt is ranked / practice and what gets replaced stay
// on the server; the instructions page shows what the next start will do.

export const instructionsPath = (testId) => `/test/${testId}/instructions`;

export function mockActions(testId, attempt) {
  const status = attempt?.status || "not_started";

  if (status === "in_progress") {
    const open = [attempt.practice, attempt.ranked].find(
      (a) => a && a.status !== "completed"
    );
    if (open) {
      return {
        label: "In progress",
        primary: { text: "Resume", to: `/attempt/${open.attemptId}` },
      };
    }
  }

  if (status === "completed") {
    const result = attempt.ranked || attempt.practice;
    return {
      label: "Attempted",
      primary: { text: "View Result", to: `/result/${result.attemptId}` },
      secondary: { text: "Re-attempt (Practice)", to: instructionsPath(testId) },
    };
  }

  return {
    label: null,
    primary: { text: "Start Test", to: instructionsPath(testId) },
  };
}

// Small "Attempted" / "In progress" pill styles
export const LABEL_STYLE = {
  Attempted: "bg-green-100 text-green-800",
  "In progress": "bg-amber-100 text-amber-800",
};
