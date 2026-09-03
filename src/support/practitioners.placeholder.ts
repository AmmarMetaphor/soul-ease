/**
 * Professional directory — DEVELOPMENT PLACEHOLDERS ONLY.
 *
 * No real practitioners are listed. Every entry is clearly marked as a
 * placeholder and must be replaced by verified practitioner records (with
 * their consent) through the `practitioners` table before any production use.
 */
export interface PractitionerListing {
  id: string;
  displayName: string;
  /** e.g. "Clinical psychologist" — describes the human, never Noor. */
  role: string;
  languages: string[];
  focusAreas: string[];
  location: string;
  isPlaceholder: true;
  isVerified: false;
}

export const PLACEHOLDER_PRACTITIONERS: PractitionerListing[] = [
  {
    id: 'placeholder-1',
    displayName: 'Placeholder practitioner A',
    role: 'Example role — to be replaced',
    languages: ['Urdu', 'English'],
    focusAreas: ['Anxiety', 'Stress'],
    location: 'City to be confirmed',
    isPlaceholder: true,
    isVerified: false,
  },
  {
    id: 'placeholder-2',
    displayName: 'Placeholder practitioner B',
    role: 'Example role — to be replaced',
    languages: ['Urdu', 'Punjabi', 'English'],
    focusAreas: ['Grief', 'Relationships'],
    location: 'City to be confirmed',
    isPlaceholder: true,
    isVerified: false,
  },
  {
    id: 'placeholder-3',
    displayName: 'Placeholder practitioner C',
    role: 'Example role — to be replaced',
    languages: ['English'],
    focusAreas: ['Low mood', 'Overthinking'],
    location: 'Online — to be confirmed',
    isPlaceholder: true,
    isVerified: false,
  },
];
