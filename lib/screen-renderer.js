/**
 * Screen Renderer Registry
 * 
 * Function-based dispatcher: each screen type maps to a render function.
 * Adding a new screen type = adding one function + one registry entry.
 * Unknown screen types throw a clear error (fail loudly).
 * 
 * Usage:
 *   const { renderScreen, registerRenderer } = require('./lib/screen-renderer');
 *   const html = renderScreen({ type: 'whatsapp-message', data: { ... } }, context);
 */

const Handlebars = require('handlebars');
const { getPartialName } = require('./screen-registry');

/**
 * Registry: screen type → render function
 * 
 * Each render function signature:
 *   function(data, context) → string (HTML)
 * 
 * - data: the screen's data object from the journey JSON
 * - context: brand/journey/dealer context for resolving placeholders
 */
const renderers = {};

/**
 * Register a new screen type renderer
 * @param {string} type - Screen type identifier
 * @param {function} fn - Render function (data, context) → HTML string
 */
function registerRenderer(type, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`Renderer for "${type}" must be a function, got ${typeof fn}`);
  }
  if (renderers[type]) {
    console.warn(`Warning: Overwriting existing renderer for "${type}"`);
  }
  renderers[type] = fn;
}

/**
 * Render a single screen
 * @param {object} screen - Screen object with { type, data }
 * @param {object} context - Brand/journey context
 * @returns {string} Rendered HTML
 * @throws {Error} If no renderer is registered for the screen type
 */
function renderScreen(screen, context) {
  if (!screen || !screen.type) {
    throw new Error('Screen must have a "type" field');
  }

  const fn = renderers[screen.type];
  if (!fn) {
    throw new Error(
      `No renderer registered for screen type: "${screen.type}". ` +
      `Available types: ${Object.keys(renderers).join(', ') || '(none)'}`
    );
  }

  return fn(screen.data || {}, context);
}

/**
 * Render all screens in a step
 * @param {object} step - Step object with { screens }
 * @param {object} context - Brand/journey context
 * @returns {string} Concatenated HTML for all screens
 */
function renderStep(step, context) {
  if (!step || !Array.isArray(step.screens)) {
    throw new Error('Step must have a "screens" array');
  }

  return step.screens
    .map(screen => renderScreen(screen, context))
    .join('\n');
}

/**
 * Render all steps in a journey
 * @param {object} journey - Journey object with { steps }
 * @param {object} context - Brand/journey context
 * @returns {string} Concatenated HTML for all steps
 */
function renderJourney(journey, context) {
  if (!journey || !Array.isArray(journey.steps)) {
    throw new Error('Journey must have a "steps" array');
  }

  return journey.steps
    .map(step => renderStep(step, context))
    .join('\n');
}

/**
 * Get list of registered screen types
 * @returns {string[]} Array of registered type names
 */
function getRegisteredTypes() {
  return Object.keys(renderers);
}

/**
 * Check if a screen type is registered
 * @param {string} type - Screen type to check
 * @returns {boolean}
 */
function hasRenderer(type) {
  return type in renderers;
}

// ─── Built-in Renderers ───────────────────────────────────────────────────────

/**
 * WhatsApp text message renderer
 * Renders a simple WhatsApp chat bubble (sender or receiver)
 * Uses the whatsapp-message Handlebars partial
 */
registerRenderer('whatsapp-message', (data, context) => {
  const partialName = getPartialName('whatsapp-message');
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    // Fallback if partial not registered (client-side)
    const {
      body = '',
      sender = 'user',
      time = '',
      showTail = true
    } = data;

    const isSender = sender === 'user' || sender === 'dealer';
    const msgClass = isSender ? 'msg-sender' : 'msg-receiver';
    const tailHtml = showTail ? `<div class="${isSender ? 'msg-sender-tail' : 'msg-receiver-tail'}"></div>` : '';

    return `
      <div class="${msgClass}-wrap">
        ${tailHtml}
        <div class="${msgClass}">
          <div class="msg-body">${body}</div>
        </div>
        ${time ? `<div class="msg-time">${time}</div>` : ''}
      </div>
    `.trim();
  }
  
  const template = Handlebars.compile(partial);
  return template(data);
});

/**
 * WhatsApp template renderer
 * Renders a WhatsApp template message with header, body, and buttons
 */
registerRenderer('whatsapp-template', (data, context) => {
  const {
    headerType = 'text',
    headerText = '',
    headerImage = '',
    headerDocument = '',
    body = '',
    buttons = [],
    time = '',
    senderName = ''
  } = data;

  let headerHtml = '';
  if (headerType === 'text' && headerText) {
    headerHtml = `<div class="wa-tmpl-header">${headerText}</div>`;
  } else if (headerType === 'image' && headerImage) {
    headerHtml = `<div class="wa-tmpl-header-img"><img src="${headerImage}" alt="Header" /></div>`;
  } else if (headerType === 'document' && headerDocument) {
    headerHtml = `
      <div class="wa-hdr-doc">
        <div class="doc-icon">
          <svg width="14" height="17" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8" fill="none" stroke="white" stroke-width="2"/></svg>
        </div>
        <div class="doc-meta">
          <div class="doc-name">${headerDocument.name || 'Document'}</div>
          <div class="doc-info">${headerDocument.size || ''} ${headerDocument.pages ? '· ' + headerDocument.pages + ' pages' : ''}</div>
        </div>
      </div>
    `;
  }

  const buttonsHtml = buttons.length > 0 ? `
    <div class="wa-tmpl-btns">
      ${buttons.map(btn => {
        if (btn.type === 'url' || btn.url) {
          return `<a href="${btn.url || '#'}" class="wa-tmpl-btn wa-tmpl-btn-url">${btn.label}</a>`;
        } else if (btn.type === 'quick-reply' || btn.type === 'reply') {
          return `<button class="wa-tmpl-btn wa-tmpl-btn-qr">${btn.label}</button>`;
        }
        return `<button class="wa-tmpl-btn">${btn.label}</button>`;
      }).join('')}
    </div>
  ` : '';

  return `
    <div class="msg-receiver-wrap">
      <div class="wa-tmpl">
        ${headerHtml}
        <div class="wa-tmpl-body">${body}</div>
        ${buttonsHtml}
        <div class="wa-tmpl-time">${time}${senderName ? ' · ' + senderName : ''}</div>
      </div>
    </div>
  `.trim();
});

/**
 * WhatsApp document template renderer
 * Specialized renderer for document-based templates (PDF, etc.)
 * Uses the whatsapp-document Handlebars partial
 */
registerRenderer('whatsapp-document', (data, context) => {
  const partialName = getPartialName('whatsapp-document');
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    // Fallback if partial not registered (client-side)
    const {
      documentName = 'Document.pdf',
      documentSize = '',
      documentPages = '',
      body = '',
      buttons = [],
      time = '',
      senderName = ''
    } = data;

    return renderers['whatsapp-template']({
      headerType: 'document',
      headerDocument: {
        name: documentName,
        size: documentSize,
        pages: documentPages
      },
      body,
      buttons,
      time,
      senderName
    }, context);
  }
  
  const template = Handlebars.compile(partial);
  return template(data);
});

/**
 * Interactive list renderer
 * Renders a WhatsApp interactive list message with bottom sheet
 * Uses the interactive-list Handlebars partial
 */
registerRenderer('interactive-list', (data, context) => {
  const partialName = getPartialName('interactive-list');
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    // Fallback if partial not registered (client-side)
    const {
      body = '',
      buttonText = 'Select',
      items = [],
      time = '',
      senderName = ''
    } = data;

    const listItemsHtml = items.map(item => `
      <div class="wa-list-item">
        ${item.icon ? `<div class="wa-list-icon">${item.icon}</div>` : ''}
        <div class="wa-list-content">
          <div class="wa-list-title">${item.title}</div>
          ${item.description ? `<div class="wa-list-desc">${item.description}</div>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="msg-receiver-wrap">
        <div class="wa-tmpl">
          <div class="wa-tmpl-body">${body}</div>
          <div class="wa-tmpl-list-btn">
            <span>${buttonText}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="wa-tmpl-time">${time}${senderName ? ' · ' + senderName : ''}</div>
        </div>
        <div class="wa-list-sheet" style="display:none;">
          ${listItemsHtml}
        </div>
      </div>
    `.trim();
  }
  
  const template = Handlebars.compile(partial);
  return template(data);
});

/**
 * PWA WebView renderer
 * Renders a Progressive Web App screen inside a phone frame
 * Uses the pwa-webview Handlebars partial
 */
registerRenderer('pwa-webview', (data, context) => {
  const partialName = getPartialName('pwa-webview');
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    // Fallback if partial not registered (client-side)
    const {
      title = '',
      subtitle = '',
      brandColor = '#075E54',
      content = '',
      status = ''
    } = data;

    return `
      <div class="phone-wrap">
        <div class="screen-lbl">${title}</div>
        <div class="screen-type-lbl">PWA WebView</div>
        <div class="phone-frame">
          <div class="status-bar-web">
            <span class="status-time">9:41</span>
            <div class="status-icons">
              <div class="battery-box">100</div>
            </div>
          </div>
          <div class="brand-strip" style="background:${brandColor};">
            <div class="bs-info">
              <div class="bs-title">${title}</div>
              ${subtitle ? `<div class="bs-sub">${subtitle}</div>` : ''}
            </div>
            ${status ? `<div class="bs-status">${status}</div>` : ''}
          </div>
          <div class="pwa-content">
            ${content}
          </div>
        </div>
      </div>
    `.trim();
  }
  
  const template = Handlebars.compile(partial);
  return template(data);
});

/**
 * Notification renderer
 * Renders a push notification or system notification
 * Uses the notification Handlebars partial
 */
registerRenderer('notification', (data, context) => {
  const partialName = getPartialName('notification');
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    // Fallback if partial not registered (client-side)
    const {
      title = '',
      body = '',
      icon = '',
      time = '',
      type = 'push'
    } = data;

    return `
      <div class="notification-wrap">
        <div class="notification ${type}">
          ${icon ? `<div class="notif-icon">${icon}</div>` : ''}
          <div class="notif-content">
            <div class="notif-title">${title}</div>
            <div class="notif-body">${body}</div>
          </div>
          ${time ? `<div class="notif-time">${time}</div>` : ''}
        </div>
      </div>
    `.trim();
  }
  
  const template = Handlebars.compile(partial);
  return template(data);
});

/**
 * Screen description renderer
 * Renders a description card below a screen
 */
registerRenderer('screen-description', (data, context) => {
  const partialName = getPartialName('screen-description');
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    const {
      title = '',
      body = '',
      backgroundColor = '#E8F5E9'
    } = data;

    return `
      <div class="screen-desc" style="background:${backgroundColor};">
        <strong>${title}</strong>
        ${body}
      </div>
    `.trim();
  }
  
  const template = Handlebars.compile(partial);
  return template(data);
});

/**
 * Step partial renderer (bridge to existing system)
 * Wraps an existing step partial as a single screen in the new schema.
 * This allows existing step partials (step1-self-service.hbs etc.) to be
 * referenced from the new schema-driven journey format.
 * 
 * Data fields:
 * - partialName: string (required) - Name of the existing partial to include
 * 
 * The renderer simply includes the partial with the full journey context,
 * preserving visual identity with the old system.
 */
registerRenderer('step-partial', (data, context) => {
  const { partialName } = data;
  if (!partialName) {
    throw new Error('step-partial screen requires data.partialName');
  }
  
  const partial = Handlebars.partials[partialName];
  if (!partial) {
    throw new Error(
      `step-partial: partial "${partialName}" not found. ` +
      `Available partials: ${Object.keys(Handlebars.partials).filter(k => k.startsWith('step')).join(', ')}`
    );
  }
  
  // Render the partial with the full context (brand, journey, catalog, etc.)
  const template = Handlebars.compile(partial);
  return template(context || {});
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  renderers,
  registerRenderer,
  renderScreen,
  renderStep,
  renderJourney,
  getRegisteredTypes,
  hasRenderer
};
