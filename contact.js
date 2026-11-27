const TICKETS_KEY = 'northlight-helpdesk-tickets'; // same key the helpdesk page reads

// Returns { field: message } for every problem, or {} when the form is fine.
function validate({ name, email, message }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Enter your name.';
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'This does not look like an email address. Use the form name@example.com.';
  if (message.trim().length < 10) errors.message = 'Write at least 10 characters so we know how to help.';
  else if (message.length > 1000) errors.message = 'Please keep the message under 1000 characters.';
  return errors;
}

// Same shape as a helpdesk ticket. Website enquiries start as P3 (impact Low, urgency Low), status New.
function makeEnquiryTicket(name, email, message, now = Date.now()) {
  return {
    id: now + Math.random(), requester: `${name.trim()} (${email.trim()})`, issue: 'Website enquiry: ' + message.trim(),
    impact: 1, urgency: 1, priority: 'P3', status: 'New', created: now, replies: [],
  };
}

// Throws if storage is blocked or full; the caller shows an error instead of claiming success.
function addTicket(ticket, storage) {
  let list = [];
  try { const s = JSON.parse(storage.getItem(TICKETS_KEY)); if (Array.isArray(s)) list = s; } catch (e) { /* unreadable: start a fresh list */ }
  list.push(ticket);
  storage.setItem(TICKETS_KEY, JSON.stringify(list));
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const fields = ['name', 'email', 'message'];

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = Object.fromEntries(fields.map((f) => [f, form.elements[f].value]));
    const errors = validate(values);
    let first = null;
    for (const f of fields) {
      const input = form.elements[f];
      const out = document.getElementById(f + '-error');
      out.textContent = errors[f] || ''; // textContent: nothing typed is parsed as HTML
      out.hidden = !errors[f];
      input.setAttribute('aria-invalid', errors[f] ? 'true' : 'false');
      if (errors[f] && !first) first = input;
    }
    status.textContent = '';
    status.className = '';
    if (first) { first.focus(); return; }

    try {
      addTicket(makeEnquiryTicket(values.name, values.email, values.message), localStorage);
    } catch (err) {
      status.textContent = 'Sorry, your message could not be saved in this browser. Please try again or use another browser.';
      status.className = 'error';
      return;
    }
    status.textContent = `Thank you, ${values.name.trim()}. Your message was added to our help desk as a new ticket. We reply within one working day.`;
    status.className = 'ok';
    form.reset();
  });
} else {
  module.exports = { validate, makeEnquiryTicket, addTicket, TICKETS_KEY };
}
