// Validates the contact form, then runs the automation rules (rules.json, see automation.js).

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

if (typeof document !== 'undefined') {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const fields = ['name', 'email', 'message'];

  form.addEventListener('submit', async (e) => {
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

    button.disabled = true; // stops a double click creating two tickets while the rules load
    try {
      const rules = await loadRules();
      const { ticket } = runRules(rules, 'form_sent', values, localStorage);
      const urgent = ticket && ticket.priority === 'P1' ? ' and flagged as urgent' : '';
      status.textContent = `Thank you, ${values.name.trim()}. Your enquiry was logged${ticket ? ` as a ${ticket.priority} ticket` : ''}${urgent}. This is a demo: nothing leaves your browser.`;
      status.className = 'ok';
      form.reset(); // only after success, so a failed send never loses what was typed
    } catch (err) {
      status.textContent = 'Sorry, your message could not be processed. ' + err.message;
      status.className = 'error';
    } finally {
      button.disabled = false;
    }
  });
} else {
  module.exports = { validate };
}
