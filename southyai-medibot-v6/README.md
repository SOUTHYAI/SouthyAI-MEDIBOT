# SOUTHYAI MediBot (v1.2)

Everyday health-information assistant with four sections (Public, Doctor, Nurse, Pharmacist).

## What's new in v1.2
- **3D Anatomy Atlas** built in (real human anatomy, about 1,950 labelled structures, split apart, zoom, cross-section, hologram mode). Chat answers can highlight organs on it.
- **Photo reading**: wound / burn / cut photos (first-aid steps), prescriptions (transcribed and explained), pills and packaging. With a Gemini key, photo answers are cross-checked against online sources and the sources are shown.
- **Emergency button** on every screen with tap-to-call South African numbers (112, 10177, Netcare 911, ER24, police) and a "show my location" helper. Emergency and urgent answers also show call buttons.
- **Voice typing** (English, isiZulu, Afrikaans; Chrome/Edge) and optional read-aloud.

## Staff access (v1.3)
The Doctor, Nurse and Pharmacist sections are locked. Access is created by the employer:
1. You (platform owner) open `/platform.html`, enter your PLATFORM_KEY and create a hospital or practice. You get an activation code for its administrator.
2. The administrator activates, signs in, and opens **Manage staff** to add each person by staff number and role. Each person gets a one-time activation code, then sets their own password.
3. Sessions last 8 hours, sign out after 30 minutes idle, accounts lock for 15 minutes after 5 wrong passwords, and every sign-in and staff change is logged.
4. You can suspend an organisation's licence at any time; everyone from that organisation is signed out immediately.
Needs `DATABASE_URL`, `AUTH_SECRET` and `PLATFORM_KEY` (see `.env.example`). Patient records come in the next part.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and add `GEMINI_API_KEY` (free: https://aistudio.google.com/apikey) or `ANTHROPIC_API_KEY`.
3. `npm run dev`, then open http://localhost:5173

On Vercel: add `GEMINI_API_KEY` under Project Settings, Environment Variables, then redeploy.

## Honest limits
- The app cannot place phone calls by itself. It opens the phone's dialler with the number filled in.
- Photo answers are guidance only. They cannot judge wound depth, burn size or infection reliably, and loose pills cannot be identified from a photo.
- Role selection (Doctor/Nurse/Pharmacist) is self-declared. There is no credential check.
- The free Gemini tier may allow Google to use submitted content to improve its products. For real patient photos, use a paid key or the Claude key, and review POPIA obligations.
- Software giving clinical decision support may fall under SAHPRA medical-device rules. Get that reviewed before positioning this as a clinical tool.

## Credits
3D anatomy model and definitions: **Z-Anatomy, the libre 3D atlas of anatomy**
(https://github.com/Z-Anatomy/Models-of-human-anatomy), built on **BodyParts3D** (DBCLS).
Licence: **CC BY-SA 4.0**. Please keep the credit line visible in the app.
Anything derived from the model must be shared under the same licence.
