export const ORGAN_NAMES = {
  brain: "Brain",
  "lung-r": "Right lung",
  "lung-l": "Left lung",
  heart: "Heart",
  liver: "Liver",
  stomach: "Stomach",
  "kidney-r": "Right kidney",
  "kidney-l": "Left kidney",
  intestines: "Intestines"
};

export function organName(id) {
  return ORGAN_NAMES[id] || id;
}
