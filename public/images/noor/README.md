# Noor portrait asset — required before production

`src/components/brand/NoorPortrait.tsx` loads:

- `/images/noor/noor-portrait.webp` — 352 × 352, square, WebP
- `/images/noor/noor-portrait@2x.webp` — 704 × 704, square, WebP

Both files are **intentionally absent from the repository.** Until they are
added the component renders an abstract identity mark in Noor's palette. It
never falls back to a stock photograph, because a photograph of an
identifiable real person must not stand in for a fictional AI guide.

## Brief for the asset

Noor is a fixed AI identity. The portrait must be **original or synthetic** —
generated, illustrated or commissioned — and must not depict an identifiable
real person.

**She should read as:** an adult woman, roughly late twenties to mid thirties,
South Asian / Pakistani in appearance. Warm, calm, approachable, intelligent,
emotionally composed, natural. Professional without being clinical.

**She must not read as:** a doctor, psychiatrist, nurse or hospital employee;
a corporate stock-photo model; an influencer; a glamorous fashion model.

**The image must not contain:** a medical coat, a stethoscope, a hospital, any
medical equipment, or a clinical office.

**Framing:** head and shoulders, centred, eyes toward the viewer, soft even
light, shallow depth of field. A plain or softly blurred background in the
Soul Ease palette (warm ivory `#f7f4ee`, muted sage `#b8c9b3`, dusk
`#d9d0e6`) sits best against the app. Neutral, contemporary clothing.

**Expression:** settled and attentive. A faint warmth, not a broad smile.

## Rules that travel with the asset

- Alt text is fixed by the component: “Noor, Soul Ease AI Wellbeing Guide”.
- Never caption her “Dr Noor”, “Therapist Noor”, or with any clinical title.
- The photograph itself stays static. Ambient motion belongs to the ring
  around it. Do not add lip sync or facial animation.

Once both files are in this folder the portrait appears automatically — no
code change is needed.
