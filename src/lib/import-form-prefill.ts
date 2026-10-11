import type { ImportPayload } from './import-wire';

const stateNames: Record<string, string> = Object.fromEntries(
  ('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|' +
   'DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|' +
   'IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|' +
   'MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|' +
   'NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|' +
   'OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|' +
   'SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|' +
   'WV:West Virginia|WI:Wisconsin|WY:Wyoming').split('|').map(pair => pair.split(':'))
);
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const country = '(?:US[A]?|United States(?: of America)?)';
// Require a complete designator, or an explicit compact numeric/# unit.
const unit = /^(?:(?:apt|apartment|suite|ste|unit|building|bldg|floor|fl|room|rm)(?:\s+|\.\s*|(?=[#\d]))|#\s*)\S+/i;

function addressParts(value: string, knownCity: string) {
  const parts = value.split(/[,\r\n]+/).map(s => s.trim()).filter(Boolean);
  const cityIndex = knownCity ? parts.findIndex((s, i) => i > 0 && s.toLowerCase() === knownCity.toLowerCase()) : -1;
  if (cityIndex > 0) return { street: parts.slice(0, cityIndex).join(', '), locality: parts[cityIndex], separated: true, postalRemainder: '' };
  let street = parts.shift() || '';
  while (parts[0] && unit.test(parts[0])) street += `, ${parts.shift()}`;
  return { street, locality: parts[0] || '', separated: false, postalRemainder: parts.join(' ') };
}

function postalTail(p: ImportPayload) {
  const knownState = Object.entries(stateNames).find(([code, name]) =>
    code.toLowerCase() === p.state.trim().toLowerCase() || name.toLowerCase() === p.state.trim().toLowerCase());
  const state = (knownState || [p.state.trim()]).filter(Boolean).map(escapePattern).join('|');
  const zip = p.postalCode.trim();
  return (state ? `(?:\\s+(?:${state}))?` : '') +
    (zip ? `(?:\\s+${escapePattern(zip)}${/^\d{5}$/.test(zip) ? '(?:-\\d{4})?' : ''})?` : '') +
    `(?:\\s+${country})?\\s*$`;
}

function streetFromMailingLine(value: string, p: ImportPayload, postalRemainder: string) {
  const city = p.city.trim();
  if (!city) return value;
  // A coincident direction or street type is not evidence that the word is a city.
  // Without a separate locality segment, retain it and remove only postal text.
  const ambiguousName = /^(?:[NSEW]\.?|[NS]\.?[EW]\.?|north|south|east|west|(?:north|south)[ -]?(?:east|west)|street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|circle|cir\.?|boulevard|blvd\.?|parkway|pkwy\.?|place|pl\.?|terrace|ter\.?|way|trail|trl\.?|highway|hwy\.?)$/i;
  const match = value.match(new RegExp('\\s+' + escapePattern(city) + '(' + postalTail(p) + ')', 'i'));
  if (!match) return value;
  // Remove only postal text proven to follow the ambiguous word, never the word itself.
  if (ambiguousName.test(city)) return value.slice(0, value.length - match[1].length).trim();
  const prefix = value.slice(0, match.index).trim();
  if (!match[1].trim()) {
    // Keep discarded postal segments as evidence, but never guess away a bare
    // street or named unit. Only an otherwise complete street supports this split.
    const postalEvidence = postalRemainder && new RegExp('^' + postalTail(p), 'i').test(' ' + postalRemainder);
    const completeStreet = /^\d+[A-Za-z-]*\s+\S.*\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|circle|cir\.?|boulevard|blvd\.?|parkway|pkwy\.?|place|pl\.?|terrace|ter\.?|way|trail|trl\.?|highway|hwy\.?)(?:\s+(?:N|S|E|W|NE|NW|SE|SW))?$/i;
    if (!postalEvidence || value.includes(',') || !completeStreet.test(prefix)) return value;
  }
  return prefix;
}

// A draft-only projection. Neither the saved snapshot nor the immutable receipt is rewritten.
export function importFormData(p: ImportPayload, reviewed: Record<string, string> | null): Record<string, string> {
  const sourceNotes = [p.inquiryNotes, p.estimatorNotes, p.salesNotes].filter(Boolean).join('\n\n');
  // Older saved imports can have an empty Description even though notes arrived.
  // Restore those notes only in the initial editable draft; keep nonempty edits.
  if (reviewed) return {
    ...reviewed,
    description: reviewed.description || sourceNotes,
    unlockLimit: reviewed.unlockLimit || '1',
  };
  const raw = p.formattedAddress || p.address;
  const source = addressParts(raw, p.city.trim());
  const fallback = addressParts(p.address, p.city.trim()).locality;
  const locality = (source.locality || fallback).replace(new RegExp(postalTail(p), 'i'), '').trim();
  return {
    name: p.customerName, email: p.customerEmail, phone: p.customerPhone,
    address: source.separated ? source.street : streetFromMailingLine(source.street, p, source.postalRemainder),
    city: p.city || (new RegExp(`^(?:${country}|[A-Z]{2}(?:\\s+\\d{5}(?:-\\d{4})?)?)$`, 'i').test(locality) ? '' : locality),
    state: p.state, zip: p.postalCode,
    description: sourceNotes,
    jobType: '', price: '', unlockLimit: '1',
  };
}
