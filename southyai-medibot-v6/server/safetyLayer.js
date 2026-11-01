/**
 * Deterministic safety layer.
 *
 * This runs on every incoming message BEFORE the AI model sees it, and its
 * output can override or accompany the AI's reply. The idea (from the
 * product spec) is that emergency detection should not depend entirely on
 * the language model — a simple, predictable, testable layer catches the
 * clearest danger signals even if the model is unavailable or gets it wrong.
 *
 * This is intentionally simple keyword matching. It is a starting point,
 * not a validated clinical triage system — see README for what would be
 * needed before relying on this in a real emergency-detection product.
 */

const EMERGENCY_PATTERNS = [
  // Cardiac / respiratory
  /chest pain/i,
  /crushing (chest|pain)/i,
  /can'?t breathe/i,
  /can not breathe/i,
  /difficulty breathing/i,
  /turning blue/i,
  /lips? (are |is )?blue/i,

  // Neurological / stroke
  /face (is |looks )?droop/i,
  /slurred speech/i,
  /sudden (numbness|weakness)/i,
  /worst headache of my life/i,
  /can'?t move (my )?(arm|leg|face)/i,
  /seizure/i,
  /convulsion/i,

  // Bleeding / trauma
  /severe bleeding/i,
  /won'?t stop bleeding/i,
  /bleeding heavily/i,
  /coughing (up )?blood/i,
  /vomit(ing)? blood/i,

  // Collapse / breathing / major trauma
  /not breathing/i,
  /stopped breathing/i,
  /unconscious/i,
  /unresponsive/i,
  /passed out and/i,
  /stab(bed)?/i,
  /gunshot|shot (in|me)/i,
  /spurting/i,
  /choking/i,
  /drown/i,

  // Allergic
  /anaphylaxis/i,
  /throat (is )?closing/i,
  /swelling (of|in) (my )?(throat|tongue|face)/i,

  // Obstetric emergencies
  /(heavy|severe) bleeding.*(pregnan|weeks)/i,
  /(pregnan|weeks).*(heavy|severe) bleeding/i,
  /baby (is |has )?not moving/i,
  /water broke/i,
  /severe (headache|swelling).*(pregnan|weeks)/i,
  /vision changes.*(pregnan|weeks)/i,

  // Mental health / self-harm crisis
  /suicid/i,
  /kill myself/i,
  /end my life/i,
  /want to die/i,
  /hurt myself/i,
  /self.?harm/i,
  /overdose/i
];

export const EMERGENCY_MESSAGE = {
  level: "emergency",
  title: "This may be a medical emergency",
  body:
    "Please get help right now rather than continuing this chat:\n\n" +
    "• Call 112 from a cellphone, or 10177 for an ambulance. Tap a button below to dial.\n" +
    "• Tell them what happened, where you are, and the patient's age and condition. Stay on the line.\n" +
    "• If it's about suicide or self-harm, call or message someone you trust now, and call 112 if you are in immediate danger.\n\n" +
    "This assistant can't provide emergency care and can't make the call for you. Anything below is general information only."
};

export const URGENT_MESSAGE = {
  level: "urgent",
  title: "Please get this checked today",
  body:
    "This sounds like something a nurse or doctor should look at soon, ideally today. " +
    "Go to a clinic or doctor, or an emergency department if it gets worse. " +
    "If it becomes severe or you feel unsafe, call 112 or 10177."
};

/**
 * Scans a message for high-risk patterns.
 * Returns { triggered: boolean, message?: object }
 */
export function checkEmergency(text = "") {
  const triggered = EMERGENCY_PATTERNS.some((pattern) => pattern.test(text));
  return triggered ? { triggered: true, message: EMERGENCY_MESSAGE } : { triggered: false };
}
