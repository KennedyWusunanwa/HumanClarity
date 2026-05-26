// Shared email-validation helpers used by both the client (instant feedback) and the
// server route (authoritative). The disposable list is intentionally compact and
// curated to the providers we actually see in the wild — adding the full 3k-domain
// list ships a lot of bytes to the browser for little extra coverage.

export const EMAIL_FORMAT = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// 80+ of the most-used disposable providers. Comparison is lowercase.
export const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '10minutemail.co.uk', '10minemail.com',
  '20minutemail.com', '30minutemail.com', '33mail.com',
  'anonbox.net', 'antichef.com', 'antispam.de', 'armyspy.com',
  'binkmail.com', 'bobmail.info', 'bofthew.com', 'boximail.com',
  'cuvox.de', 'dayrep.com', 'deadaddress.com', 'discard.email',
  'discardmail.com', 'discardmail.de', 'dispostable.com', 'drdrb.net',
  'einrot.com', 'emailondeck.com', 'emltmp.com', 'emlhub.com', 'emkei.cf',
  'fakeinbox.com', 'fakemailgenerator.com', 'fakemail.fr', 'fake-email.pp.ua',
  'fakemail.net', 'fastacura.com',
  'getairmail.com', 'getnada.com', 'gmial.com', 'guerrillamail.biz',
  'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.info',
  'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'inboxbear.com', 'inboxkitten.com', 'incognitomail.com', 'instantemailaddress.com',
  'jetable.org', 'jourrapide.com',
  'klzlk.com', 'kuhrap.com',
  'mail-temp.com', 'mail.tm', 'mail4mail.com', 'mailcatch.com', 'maildrop.cc',
  'maildu.de', 'mailexpire.com', 'mailfa.tk', 'mailforspam.com', 'mailfree.gq',
  'mailfreeonline.com', 'mailimate.com', 'mailinator.com', 'mailinator.net',
  'mailinator.org', 'mailmetrash.com', 'mailmoat.com', 'mailnesia.com',
  'mailnull.com', 'mailproxsy.com', 'mailseven.com', 'mailshell.com',
  'mailsiphon.com', 'mailtothis.com', 'mailtrash.net', 'mailzilla.com',
  'meantinc.com', 'mintemail.com', 'mohmal.com', 'mohmal.in', 'moncourrier.fr.nf',
  'mt2015.com', 'mvrht.com', 'mytemp.email', 'mytrashmail.com',
  'noemail.xyz', 'nomail.xl.cx', 'notmailinator.com',
  'objectmail.com', 'oneoffemail.com', 'opayq.com',
  'sharklasers.com', 'shieldemail.com', 'spam4.me', 'spambog.com',
  'spambox.us', 'spamcero.com', 'spamday.com', 'spamfree.eu', 'spamgourmet.com',
  'spaml.com', 'spaml.de', 'spamspot.com', 'spamthis.co.uk',
  'temp-mail.org', 'temp-mail.io', 'temp-mail.com', 'temp-mailbox.com',
  'tempemail.co', 'tempemail.com', 'tempinbox.com', 'tempmail.email',
  'tempmail.net', 'tempmail2.com', 'tempmailo.com', 'tempr.email',
  'throwam.com', 'throwawaymail.com', 'tmail.ws', 'tmailinator.com',
  'tmpeml.com', 'tmpmail.org', 'tmpmail.net', 'trash-mail.com', 'trashmail.com',
  'trashmail.de', 'trashmail.io', 'trashmail.me', 'trashmail.net',
  'trbvm.com', 'twinmail.de', 'umail.net',
  'wegwerfmail.de', 'wegwerfmail.info', 'wegwerfmail.net',
  'wegwerfemail.com', 'wegwerfemail.de',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'zehnminutenmail.de', 'zoaxe.com',
]);

export function extractDomain(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at === -1) return '';
  return trimmed.slice(at + 1);
}

// Cheap client-side check. Returns { ok, reason }.
// "reason" matches the server's response so the same UI string can be reused.
export function quickEmailCheck(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!EMAIL_FORMAT.test(trimmed)) return { ok: false, reason: 'format' };
  const domain = extractDomain(trimmed);
  if (!domain) return { ok: false, reason: 'format' };
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: 'disposable' };
  return { ok: true };
}

export function emailErrorMessage(reason) {
  switch (reason) {
    case 'empty':
      return 'Enter an email address.';
    case 'format':
      return "That doesn't look like a valid email address.";
    case 'disposable':
      return 'Disposable or temporary email providers are not allowed.';
    case 'no-mx':
      return "We couldn't find a mail server for that domain. Double-check the spelling.";
    case 'lookup-failed':
      return "We couldn't verify that email right now. Try again in a moment.";
    default:
      return 'That email address could not be verified.';
  }
}
