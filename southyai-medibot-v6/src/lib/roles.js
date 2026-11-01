export const ROLES = [
  {
    id: "public",
    name: "Public",
    shortDesc: "Everyday health questions",
    headerDesc:
      "General medical information, symptom guidance, and plain-language explanations. Not a diagnosis, and not a replacement for professional care.",
    gated: false
  },
  {
    id: "doctor",
    name: "Doctor",
    shortDesc: "Clinical decision support",
    headerDesc:
      "Differential considerations, red flags, and treatment/guideline research to support a clinician's own judgment — not autonomous diagnosis.",
    gated: true
  },
  {
    id: "nurse",
    name: "Nurse",
    shortDesc: "Nursing & patient-care support",
    headerDesc:
      "Assessment support, care planning, monitoring, and handover help within a nursing scope of practice.",
    gated: true
  },
  {
    id: "pharmacist",
    name: "Pharmacist",
    shortDesc: "Medication & interaction research",
    headerDesc:
      "Drug interactions, contraindications, mechanisms, and comparisons to support pharmaceutical decision-making.",
    gated: true
  }
];

export function getRole(id) {
  return ROLES.find((r) => r.id === id) || ROLES[0];
}
