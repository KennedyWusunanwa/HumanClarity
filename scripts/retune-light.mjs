// Color-only light-theme retune: warm neutral background, charcoal text, cool-gray
// borders, premium indigo->violet accents, soft shadows, de-hazed glows.
// Only LIGHT values are touched (the manual :root and the generated light :root block).
// Every html.dark value is left exactly as-is, so dark mode is unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'app/globals.css');

// Manual :root tokens (first :root block, before the generated one).
const MANUAL = {
  '--bg': '#fafafa',
  '--surface': '#f4f5f8',
  '--card2': '#f3f0ff',
  '--border': '#e2e6ef',
  '--text1': '#111827',
  '--text2': '#5f6675',
  '--text3': '#8a91a3',
  '--active': '#ede9fe',
  '--active-t': '#4c1d95',
  '--hover': '#f7f8fb',
  '--glass-b': 'rgba(148,163,184,0.30)',
  '--primary': '#4f46e5',
  '--primary2': '#6d28d9',
  '--accent-strong': '#5b35d5',
  '--sb-track': 'rgba(79,70,229,0.10)',
  '--sb-thumb': 'linear-gradient(180deg, #6366f1, #7c3aed)',
  '--sb-thumb-hover': 'linear-gradient(180deg, #4f46e5, #6d28d9)',
};

// Generated light tokens (--h-* / --r-*). Anything omitted keeps its current light value.
const GEN = {
  // backgrounds
  '--h-0e0f11': '#fafafa', '--h-0b0d12': '#f7f8fb', '--h-f0f4ff': '#fafafa',
  // brand / accent solids -> indigo / violet
  '--h-4968ff': '#4f46e5', '--h-7c3cff': '#6d28d9', '--h-6f8cff': '#6d28d9',
  '--h-5b76ff': '#4f46e5', '--h-7c9fff': '#4f46e5', '--h-0874ff': '#4f46e5',
  '--h-0b64f4': '#4f46e5', '--h-0a3d91': '#3730a3', '--h-8f5cff': '#6d28d9',
  '--h-8f7cff': '#6d28d9', '--h-a78bfa': '#6d28d9', '--h-a78bff': '#5b35d5',
  '--h-c4b5fd': '#6d28d9',
  // blue accent text / gradient stops -> indigo / violet
  '--h-a8c7fa': '#4f46e5', '--h-d3e3fd': '#6d28d9', '--h-9ec1ff': '#4f46e5',
  '--h-a9c5ff': '#4f46e5', '--h-bcd0ff': '#4f46e5', '--h-cdd9ff': '#4f46e5',
  '--h-c7d3ff': '#4f46e5', '--h-6d87ff': '#4f46e5', '--h-7e97ff': '#5b35d5',
  '--h-7fb1ff': '#6d28d9', '--h-7eb8f7': '#4f46e5', '--h-60a5fa': '#4f46e5',
  '--h-e9edf7': '#4f46e5',
  // headings / strong text -> charcoal
  '--h-e3e3e3': '#111827', '--h-f8fafc': '#111827', '--h-f4f7fb': '#111827',
  '--h-1f1f1f': '#111827', '--h-1a1a1a': '#111827', '--h-e7ebf5': '#111827',
  '--h-eef2ff': '#111827', '--h-e8edff': '#374151', '--h-c4c7c5': '#374151',
  '--h-c9d3e8': '#374151', '--h-cdd6ee': '#374151', '--h-d7def0': '#374151',
  '--h-d8deef': '#374151',
  // secondary / muted text
  '--h-8e918f': '#5f6675', '--h-8e9dc2': '#5f6675', '--h-5f6368': '#5f6675',
  '--h-aeb8ce': '#5f6675', '--h-b2bdd2': '#5f6675', '--h-b8c2d8': '#5f6675',
  '--h-b8c8e0': '#5f6675', '--h-b9c4da': '#5f6675', '--h-9ca8bd': '#5f6675',
  '--h-6b7a94': '#8a91a3', '--h-70809e': '#8a91a3', '--h-94a0b7': '#8a91a3',
  '--h-9aa7c4': '#8a91a3', '--h-98a4bb': '#9aa1af',
  // shadows -> soft neutral
  '--r-0-0-0-0_18': 'rgba(17,24,39,0.06)', '--r-0-0-0-0_25': 'rgba(17,24,39,0.07)',
  '--r-0-0-0-0_28': 'rgba(17,24,39,0.07)', '--r-0-0-0-0_32': 'rgba(17,24,39,0.08)',
  '--r-0-0-0-0_35': 'rgba(17,24,39,0.08)', '--r-0-0-0-0_5': 'rgba(17,24,39,0.10)',
  '--r-0-0-0-0_6': 'rgba(17,24,39,0.10)', '--r-0-0-0-0_62': 'rgba(17,24,39,0.10)',
  // brand-blue: shadows -> soft indigo; pills/fills -> lavender
  '--r-73-104-255-0_07': 'rgba(124,58,237,0.05)', '--r-73-104-255-0_09': 'rgba(124,58,237,0.05)',
  '--r-73-104-255-0_1': 'rgba(124,58,237,0.08)', '--r-73-104-255-0_12': 'rgba(124,58,237,0.10)',
  '--r-73-104-255-0_18': 'rgba(79,70,229,0.16)', '--r-73-104-255-0_2': 'rgba(79,70,229,0.18)',
  '--r-73-104-255-0_22': 'rgba(79,70,229,0.20)', '--r-73-104-255-0_24': 'rgba(79,70,229,0.22)',
  '--r-73-104-255-0_26': 'rgba(79,70,229,0.22)', '--r-73-104-255-0_28': 'rgba(79,70,229,0.24)',
  '--r-73-104-255-0_32': 'rgba(79,70,229,0.22)', '--r-73-104-255-0_34': 'rgba(79,70,229,0.24)',
  // purple glows / pills
  '--r-109-40-217-0_08': 'rgba(109,40,217,0.06)', '--r-124-60-255-0_06': 'rgba(124,58,237,0.05)',
  '--r-124-82-255-0_08': 'rgba(124,58,237,0.05)', '--r-124-82-255-0_1': 'rgba(124,58,237,0.08)',
  '--r-124-82-255-0_24': 'rgba(124,58,237,0.16)', '--r-124-82-255-0_28': 'rgba(124,58,237,0.22)',
  '--r-124-82-255-0_35': 'rgba(124,58,237,0.28)', '--r-124-82-255-0_45': 'rgba(124,58,237,0.35)',
  '--r-143-92-255-0_12': 'rgba(124,58,237,0.10)', '--r-143-92-255-0_35': 'rgba(124,58,237,0.28)',
  // google-blue hero glows -> faint violet (de-haze)
  '--r-66-133-244-0_08': 'rgba(124,58,237,0.03)', '--r-66-133-244-0_12': 'rgba(124,58,237,0.04)',
  '--r-66-133-244-0_18': 'rgba(124,58,237,0.05)', '--r-66-133-244-0_2': 'rgba(124,58,237,0.05)',
  '--r-66-133-244-0_22': 'rgba(124,58,237,0.05)', '--r-66-133-244-0_28': 'rgba(124,58,237,0.06)',
  '--r-37-99-235-0_06': 'rgba(124,58,237,0.04)', '--r-37-99-235-0_12': 'rgba(124,58,237,0.05)',
  '--r-8-116-255-0_24': 'rgba(79,70,229,0.18)',
  // light-blue: fills -> faint lavender, borders -> cool gray, glows -> faint
  '--r-168-199-250-0': 'rgba(124,58,237,0)', '--r-168-199-250-0_04': 'rgba(124,58,237,0.035)',
  '--r-168-199-250-0_06': 'rgba(124,58,237,0.045)', '--r-168-199-250-0_07': 'rgba(124,58,237,0.05)',
  '--r-168-199-250-0_08': 'rgba(124,58,237,0.05)', '--r-168-199-250-0_09': 'rgba(148,163,184,0.14)',
  '--r-168-199-250-0_1': 'rgba(148,163,184,0.16)', '--r-168-199-250-0_12': 'rgba(148,163,184,0.18)',
  '--r-168-199-250-0_14': 'rgba(148,163,184,0.20)', '--r-168-199-250-0_15': 'rgba(148,163,184,0.22)',
  '--r-168-199-250-0_16': 'rgba(148,163,184,0.24)', '--r-168-199-250-0_18': 'rgba(148,163,184,0.26)',
  '--r-168-199-250-0_2': 'rgba(148,163,184,0.20)', '--r-168-199-250-0_22': 'rgba(148,163,184,0.28)',
  '--r-168-199-250-0_24': 'rgba(148,163,184,0.30)', '--r-168-199-250-0_28': 'rgba(124,58,237,0.06)',
  '--r-168-199-250-0_3': 'rgba(148,163,184,0.32)', '--r-168-199-250-0_4': 'rgba(124,58,237,0.10)',
  '--r-168-199-250-0_56': 'rgba(79,70,229,0.50)', '--r-168-199-250-0_95': 'rgba(79,70,229,0.95)',
  // 126,151,255
  '--r-126-151-255-0_1': 'rgba(124,58,237,0.06)', '--r-126-151-255-0_16': 'rgba(148,163,184,0.22)',
  '--r-126-151-255-0_2': 'rgba(124,58,237,0.06)', '--r-126-151-255-0_25': 'rgba(148,163,184,0.28)',
  '--r-126-151-255-0_32': 'rgba(148,163,184,0.32)', '--r-126-151-255-0_34': 'rgba(148,163,184,0.34)',
  '--r-126-151-255-0_4': 'rgba(124,58,237,0.12)', '--r-126-151-255-0_54': 'rgba(124,58,237,0.28)',
  '--r-126-151-255-0_55': 'rgba(124,58,237,0.20)',
  // slate 145,158,191 borders
  '--r-145-158-191-0_12': 'rgba(148,163,184,0.18)', '--r-145-158-191-0_13': 'rgba(148,163,184,0.20)',
  '--r-145-158-191-0_14': 'rgba(148,163,184,0.20)', '--r-145-158-191-0_18': 'rgba(148,163,184,0.24)',
  '--r-145-158-191-0_22': 'rgba(148,163,184,0.28)', '--r-145-158-191-0_24': 'rgba(148,163,184,0.30)',
  // 113,131,255 (active rail border / premium card border)
  '--r-113-131-255-0_25': 'rgba(124,58,237,0.18)', '--r-113-131-255-0_55': 'rgba(124,58,237,0.32)',
  // 124,159,255 (admin accents)
  '--r-124-159-255-0_12': 'rgba(124,58,237,0.08)', '--r-124-159-255-0_15': 'rgba(124,58,237,0.10)',
  '--r-124-159-255-0_16': 'rgba(124,58,237,0.12)', '--r-124-159-255-0_2': 'rgba(124,58,237,0.16)',
  '--r-124-159-255-0_35': 'rgba(124,58,237,0.28)', '--r-124-159-255-0_5': 'rgba(124,58,237,0.40)',
  // misc blue accents
  '--r-158-193-255-0_55': 'rgba(124,58,237,0.40)', '--r-211-227-253-0_95': 'rgba(124,58,237,0.90)',
  '--r-70-103-178-0_18': 'rgba(148,163,184,0.20)', '--r-70-103-178-0_45': 'rgba(148,163,184,0.30)',
  '--r-70-103-178-0_55': 'rgba(148,163,184,0.40)', '--r-76-88-180-0_2': 'rgba(124,58,237,0.10)',
  '--r-77-100-190-0_28': 'rgba(148,163,184,0.30)', '--r-148-163-184-0_08': 'rgba(148,163,184,0.12)',
};

let css = readFileSync(FILE, 'utf8');

function applyInRange(text, start, end, map) {
  let head = text.slice(0, start);
  let body = text.slice(start, end);
  let tail = text.slice(end);
  let changed = 0;
  for (const [name, val] of Object.entries(map)) {
    const re = new RegExp('(' + name.replace(/[-]/g, '\\-') + ':\\s*)[^;]+;');
    if (re.test(body)) { body = body.replace(re, `$1${val};`); changed++; }
  }
  return { text: head + body + tail, changed };
}

// Manual light block: file start -> first "html.dark {"
const firstDark = css.indexOf('html.dark {');
let r1 = applyInRange(css, 0, firstDark, MANUAL);
css = r1.text;

// Generated light block: MARK_START -> the html.dark { that follows it
const markStart = css.indexOf('THEME-TOKENS-START');
const genDark = css.indexOf('html.dark {', markStart);
let r2 = applyInRange(css, markStart, genDark, GEN);
css = r2.text;

writeFileSync(FILE, css, 'utf8');
console.log(`Manual tokens updated: ${r1.changed}/${Object.keys(MANUAL).length}`);
console.log(`Generated light tokens updated: ${r2.changed}/${Object.keys(GEN).length}`);
