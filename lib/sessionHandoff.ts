/* Lets the practice header end a session that lives in the workspace below
   it. The workspace registers a finisher while it is mounted; the Review
   button calls it before navigating, so a session stopped mid-piece is still
   graded and stored for the feedback chat. */

let finisher: (() => void) | null = null;

export function setSessionFinisher(fn: (() => void) | null) {
  finisher = fn;
}

/* Ends the running session, if there is one. Safe to call at any time. */
export function finishSession() {
  finisher?.();
}
