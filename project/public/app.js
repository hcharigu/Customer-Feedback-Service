const MAX_MESSAGE_LENGTH = 2000;

const elements = {
  formPage: document.querySelector('#feedback-page'),
  reviewPage: document.querySelector('#review-page'),
  form: document.querySelector('#feedback-form'),
  message: document.querySelector('#message'),
  messageError: document.querySelector('#message-error'),
  submit: document.querySelector('#submit-button'),
  formStatus: document.querySelector('#form-status'),
  reviewStatus: document.querySelector('#review-status'),
  list: document.querySelector('#feedback-list'),
  retry: document.querySelector('#retry-button')
};

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('status-error', isError);
  if (isError) {
    element.setAttribute('role', 'alert');
  } else {
    element.removeAttribute('role');
  }
}

function localMessageError(value) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > MAX_MESSAGE_LENGTH) {
    return 'Escribe un comentario de entre 1 y 2000 caracteres.';
  }

  return '';
}

function showMessageError(message = '') {
  elements.messageError.textContent = message;
  elements.messageError.hidden = !message;
  elements.message.setAttribute('aria-invalid', String(Boolean(message)));
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function createFeedback(message) {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const body = await parseJson(response);

  if (response.status === 201 && body?.data) {
    return body.data;
  }

  const fieldMessage = body?.error?.fields?.message;
  const globalMessage = body?.error?.message || 'No se pudo enviar el feedback. Inténtalo de nuevo.';
  const error = new Error(globalMessage);
  error.fieldMessage = fieldMessage;
  throw error;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function renderFeedback(items) {
  elements.list.replaceChildren();

  if (items.length === 0) {
    setStatus(elements.reviewStatus, 'Todavía no hay feedback enviado.');
    return;
  }

  setStatus(elements.reviewStatus, '');
  for (const feedback of items) {
    const item = document.createElement('li');
    const message = document.createElement('p');
    const timestamp = document.createElement('time');

    message.textContent = feedback.message;
    timestamp.textContent = formatDate(feedback.createdAt);
    timestamp.dateTime = feedback.createdAt;

    item.append(message, timestamp);
    elements.list.append(item);
  }
}

async function loadFeedback() {
  elements.retry.hidden = true;
  elements.list.replaceChildren();
  setStatus(elements.reviewStatus, 'Cargando feedback...');

  try {
    const response = await fetch('/api/feedback');
    const body = await parseJson(response);

    if (!response.ok || !Array.isArray(body?.data)) {
      throw new Error('No se pudo cargar el feedback. Inténtalo de nuevo.');
    }

    renderFeedback(body.data);
  } catch {
    setStatus(elements.reviewStatus, 'No se pudo cargar el feedback. Inténtalo de nuevo.', true);
    elements.retry.hidden = false;
  }
}

function renderRoute() {
  const isReview = window.location.pathname === '/admin';
  elements.formPage.hidden = isReview;
  elements.reviewPage.hidden = !isReview;

  document.querySelectorAll('[data-route]').forEach((link) => {
    link.toggleAttribute('aria-current', link.dataset.route === window.location.pathname);
  });

  if (isReview) {
    document.title = 'Revisar feedback';
    loadFeedback();
  } else {
    document.title = 'Enviar feedback';
  }
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(elements.formStatus, '');
  const error = localMessageError(elements.message.value);
  showMessageError(error);

  if (error) {
    elements.message.focus();
    return;
  }

  elements.submit.disabled = true;
  elements.submit.textContent = 'Enviando…';

  try {
    await createFeedback(elements.message.value);
    elements.message.value = '';
    showMessageError();
    setStatus(elements.formStatus, 'Feedback enviado correctamente.');
  } catch (requestError) {
    if (requestError.fieldMessage) {
      showMessageError(requestError.fieldMessage);
      elements.message.focus();
    } else {
      setStatus(elements.formStatus, requestError.message, true);
    }
  } finally {
    elements.submit.disabled = false;
    elements.submit.textContent = 'Enviar feedback';
  }
});

elements.retry.addEventListener('click', loadFeedback);
renderRoute();
