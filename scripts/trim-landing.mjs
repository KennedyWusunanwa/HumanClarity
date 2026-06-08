// Remove the three post-hero Landing sections (Features, How it works, Ready CTA),
// keeping nav + hero + footer. Anchored on unique substrings, not line numbers.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'src/App.jsx');
let s = readFileSync(FILE, 'utf8');

const START = "      <section style={{ padding: 'clamp(70px, 11vh, 120px) clamp(16px, 4vw, 32px)', position: 'relative', background: featBg";
const start = s.indexOf(START);
if (start < 0) throw new Error('Features section start not found');

const launch = s.indexOf('Launch the App', start);
if (launch < 0) throw new Error('"Launch the App" not found');

const closeTag = '</section>';
const closeIdx = s.indexOf(closeTag, launch);
if (closeIdx < 0) throw new Error('closing </section> after CTA not found');
const afterClose = closeIdx + closeTag.length;

const before = s.slice(0, start);          // ends with hero "</section>\n"
let after = s.slice(afterClose);           // starts with newlines then "<footer"
after = after.replace(/^\n+/, '\n');       // collapse blank lines to a single separator

s = before + after;
writeFileSync(FILE, s, 'utf8');
console.log('Removed Features + How-it-works + Ready CTA sections.');
console.log('Bytes removed:', afterClose - start);
