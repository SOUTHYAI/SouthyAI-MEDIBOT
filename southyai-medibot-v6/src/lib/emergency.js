// South African emergency numbers (checked against several SA sources, Oct 2026).
export const EMERGENCY_NUMBERS = [
  { label: "Emergency (from any cellphone)", number: "112", note: "Free, works without airtime", primary: true },
  { label: "Ambulance / Fire (state)", number: "10177", note: "National ambulance line", primary: true },
  { label: "Netcare 911 (private ambulance)", number: "082911", display: "082 911", note: "Charges may apply without medical aid" },
  { label: "ER24 (private ambulance)", number: "084124", display: "084 124", note: "Charges may apply without medical aid" },
  { label: "Police", number: "10111", note: "Police flying squad" }
];

export const HELP_LINES = [
  { label: "Poison Information Centre", number: "0861555777", display: "0861 555 777" },
  { label: "LifeLine (counselling)", number: "0861322322", display: "0861 322 322" }
];
