// Behaviour shared by every page: the mobile menu, the order dialog, the forms.
(function () {
  'use strict';

  // Mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Order dialog
  var modal = document.getElementById('order-modal');
  if (modal) {
    var fill = function (name, value) {
      modal.querySelector('[data-field="' + name + '"]').textContent = value;
    };
    var close = function () {
      modal.hidden = true;
    };
    document.querySelectorAll('[data-order]').forEach(function (button) {
      button.addEventListener('click', function () {
        var row = button.closest('tr');
        fill('id', button.getAttribute('data-order'));
        ['date', 'customer', 'status', 'total'].forEach(function (name) {
          fill(name, row.querySelector('[data-col="' + name + '"]').textContent.trim());
        });
        modal.hidden = false;
        modal.querySelector('.modal-close').focus();
      });
    });
    modal.querySelectorAll('[data-modal-close]').forEach(function (button) {
      button.addEventListener('click', close);
    });
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
  }

  // Forms
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var rules = {
    name: function (v) { return v.trim() ? '' : 'Please enter your name.'; },
    email: function (v) { return EMAIL.test(v.trim()) ? '' : 'Please enter a valid email address.'; },
    message: function (v) { return v.trim().length >= 10 ? '' : 'Please write at least 10 characters.'; },
    consent: function (v, field) { return field.checked ? '' : 'Please agree before sending.'; }
  };

  function validate(form) {
    var valid = true;
    form.querySelectorAll('[data-validate]').forEach(function (field) {
      var message = rules[field.getAttribute('data-validate')](field.value, field);
      var error = form.querySelector('[data-error-for="' + field.name + '"]');
      field.classList.toggle('is-invalid', Boolean(message));
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
      if (message) valid = false;
    });
    return valid;
  }

  var contact = document.getElementById('contact-form');
  if (contact) {
    contact.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!validate(contact)) return;
      var done = document.getElementById('contact-done');
      done.textContent = 'Thanks, ' + contact.elements.name.value.trim() + '. We will reply within one business day.';
      done.hidden = false;
      contact.hidden = true;
    });
  }

  var newsletter = document.getElementById('newsletter-form');
  if (newsletter) {
    newsletter.addEventListener('submit', function (event) {
      event.preventDefault();
      var note = document.getElementById('newsletter-note');
      if (!validate(newsletter)) {
        note.textContent = 'Please enter a valid email address.';
        return;
      }
      note.textContent = 'You are on the list. Look out for the next issue.';
      newsletter.reset();
    });
  }
})();
