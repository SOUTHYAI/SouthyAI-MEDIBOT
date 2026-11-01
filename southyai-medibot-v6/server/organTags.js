// Lets the chat tell the 3D body which organs an answer is about, and how urgent it is.
export const ORGAN_IDS = [
  "brain", "lung-r", "lung-l", "heart", "liver",
  "stomach", "kidney-r", "kidney-l", "intestines"
];

export const TAG_INSTRUCTION = `After your answer, add these final two lines in exactly this format:
URGENCY: emergency | urgent | routine | none
ORGANS: id1, id2
URGENCY meaning: "emergency" = needs emergency services or an emergency department right now; "urgent" = should be seen by a clinician today; "routine" = a normal appointment or self-care is fine; "none" = not a health concern.
For ORGANS use ONLY these ids for the body parts your answer is mainly about: ${ORGAN_IDS.join(", ")}. If none apply, write: ORGANS: none
Never mention or explain these two lines in your answer.`;

// Kept for backwards compatibility with older code.
export const ORGAN_INSTRUCTION = TAG_INSTRUCTION;

const URGENCY_VALUES = ["emergency", "urgent", "routine", "none"];

export function extractTags(text = "") {
  let urgency = "none";
  let organs = [];

  const cleaned = text.replace(/^[ \t]*(URGENCY|ORGANS):[ \t]*(.*)$/gim, (_line, key, value) => {
    const v = String(value).trim().toLowerCase();
    if (key.toUpperCase() === "URGENCY") {
      const found = URGENCY_VALUES.find((u) => v.startsWith(u));
      if (found) urgency = found;
    } else {
      organs = v.split(/[,\s]+/).filter((id) => ORGAN_IDS.includes(id));
    }
    return "";
  });

  return {
    text: cleaned.replace(/\n{3,}/g, "\n\n").trim(),
    organs: [...new Set(organs)],
    urgency
  };
}

// Older helper, still exported in case anything imports it.
export function extractOrgans(text = "") {
  const { text: t, organs } = extractTags(text);
  return { text: t, organs };
}
