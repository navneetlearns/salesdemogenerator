const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs-extra');

const {
  renderers,
  registerRenderer,
  renderScreen,
  renderStep,
  renderJourney,
  getRegisteredTypes,
  hasRenderer
} = require('../lib/screen-renderer');

const Ajv = require('ajv');
const ajv = new Ajv();
const schema = fs.readJsonSync(path.join(__dirname, '..', 'schema', 'journey.schema.json'));
const validate = ajv.compile(schema);

// ─── Schema Validation Tests ──────────────────────────────────────────────────

describe('Journey Schema', () => {
  it('accepts a minimal valid journey', () => {
    const journey = {
      id: 'test_journey',
      title: 'Test Journey',
      steps: [
        {
          num: 1,
          title: 'Step 1',
          screens: [
            { type: 'whatsapp-message', data: { body: 'Hello' } }
          ]
        }
      ]
    };
    assert.strictEqual(validate(journey), true, JSON.stringify(validate.errors));
  });

  it('rejects journey without id', () => {
    const journey = {
      title: 'Test',
      steps: [{ num: 1, title: 'S1', screens: [{ type: 'x', data: {} }] }]
    };
    assert.strictEqual(validate(journey), false);
  });

  it('rejects journey without title', () => {
    const journey = {
      id: 'test',
      steps: [{ num: 1, title: 'S1', screens: [{ type: 'x', data: {} }] }]
    };
    assert.strictEqual(validate(journey), false);
  });

  it('rejects journey without steps', () => {
    const journey = { id: 'test', title: 'Test' };
    assert.strictEqual(validate(journey), false);
  });

  it('rejects step without screens', () => {
    const journey = {
      id: 'test',
      title: 'Test',
      steps: [{ num: 1, title: 'S1' }]
    };
    assert.strictEqual(validate(journey), false);
  });

  it('rejects step with empty screens array', () => {
    const journey = {
      id: 'test',
      title: 'Test',
      steps: [{ num: 1, title: 'S1', screens: [] }]
    };
    assert.strictEqual(validate(journey), false);
  });

  it('rejects screen without type', () => {
    const journey = {
      id: 'test',
      title: 'Test',
      steps: [{ num: 1, title: 'S1', screens: [{ data: {} }] }]
    };
    assert.strictEqual(validate(journey), false);
  });

  it('rejects screen without data', () => {
    const journey = {
      id: 'test',
      title: 'Test',
      steps: [{ num: 1, title: 'S1', screens: [{ type: 'x' }] }]
    };
    assert.strictEqual(validate(journey), false);
  });

  it('accepts journey with optional fields', () => {
    const journey = {
      id: 'test',
      title: 'Test',
      description: 'A test journey',
      industry: ['FMCG'],
      brands: ['brand_a'],
      steps: [
        {
          num: 1,
          title: 'Step 1',
          description: 'Description',
          tags: ['utility'],
          screens: [
            {
              type: 'whatsapp-message',
              description: 'A message screen',
              data: { body: 'Hello', sender: 'user', time: '10:00 AM' }
            }
          ]
        }
      ]
    };
    assert.strictEqual(validate(journey), true, JSON.stringify(validate.errors));
  });

  it('accepts multi-step journey with multiple screens per step', () => {
    const journey = {
      id: 'complex',
      title: 'Complex Journey',
      steps: [
        {
          num: 1,
          title: 'Step 1',
          screens: [
            { type: 'whatsapp-message', data: { body: 'Msg 1' } },
            { type: 'whatsapp-document', data: { body: 'Doc', documentName: 'test.pdf' } }
          ]
        },
        {
          num: 2,
          title: 'Step 2',
          screens: [
            { type: 'pwa-webview', data: { title: 'PWA', content: '<div>test</div>' } }
          ]
        }
      ]
    };
    assert.strictEqual(validate(journey), true, JSON.stringify(validate.errors));
  });
});

// ─── Renderer Registry Tests ──────────────────────────────────────────────────

describe('Screen Renderer Registry', () => {
  it('has built-in renderers registered', () => {
    const types = getRegisteredTypes();
    assert.ok(types.includes('whatsapp-message'));
    assert.ok(types.includes('whatsapp-template'));
    assert.ok(types.includes('whatsapp-document'));
    assert.ok(types.includes('interactive-list'));
    assert.ok(types.includes('pwa-webview'));
    assert.ok(types.includes('notification'));
    assert.ok(types.includes('screen-description'));
  });

  it('hasRenderer returns true for registered types', () => {
    assert.strictEqual(hasRenderer('whatsapp-message'), true);
    assert.strictEqual(hasRenderer('pwa-webview'), true);
  });

  it('hasRenderer returns false for unknown types', () => {
    assert.strictEqual(hasRenderer('nonexistent-type'), false);
  });

  it('throws on unknown screen type with clear error', () => {
    assert.throws(
      () => renderScreen({ type: 'nonexistent-type', data: {} }, {}),
      /No renderer registered for screen type: "nonexistent-type"/
    );
  });

  it('throws on screen without type', () => {
    assert.throws(
      () => renderScreen({ data: {} }, {}),
      /Screen must have a "type" field/
    );
  });

  it('allows registering custom renderers', () => {
    registerRenderer('custom-test', (data) => `<div>${data.text}</div>`);
    assert.strictEqual(hasRenderer('custom-test'), true);
    const html = renderScreen({ type: 'custom-test', data: { text: 'hello' } }, {});
    assert.ok(html.includes('hello'));
  });

  it('throws when registering non-function', () => {
    assert.throws(
      () => registerRenderer('bad-type', 'not a function'),
      /must be a function/
    );
  });
});

// ─── Individual Renderer Tests ────────────────────────────────────────────────

describe('whatsapp-message renderer', () => {
  it('renders sender message', () => {
    const html = renderScreen({
      type: 'whatsapp-message',
      data: { body: 'Hello world', sender: 'user', time: '10:30 AM' }
    }, {});
    assert.ok(html.includes('msg-sender'));
    assert.ok(html.includes('Hello world'));
    assert.ok(html.includes('10:30 AM'));
  });

  it('renders receiver message', () => {
    const html = renderScreen({
      type: 'whatsapp-message',
      data: { body: 'Hi there', sender: 'business' }
    }, {});
    assert.ok(html.includes('msg-receiver'));
    assert.ok(html.includes('Hi there'));
  });

  it('handles missing optional fields', () => {
    const html = renderScreen({
      type: 'whatsapp-message',
      data: { body: 'Minimal' }
    }, {});
    assert.ok(html.includes('Minimal'));
  });
});

describe('whatsapp-document renderer', () => {
  it('renders document template', () => {
    const html = renderScreen({
      type: 'whatsapp-document',
      data: {
        documentName: 'Invoice_123.pdf',
        documentSize: '1.2 MB',
        body: 'Your invoice is ready',
        buttons: [{ label: 'Download', url: '/download/123' }],
        time: '2:15 PM'
      }
    }, {});
    assert.ok(html.includes('Invoice_123.pdf'));
    assert.ok(html.includes('1.2 MB'));
    assert.ok(html.includes('Your invoice is ready'));
    assert.ok(html.includes('Download'));
  });
});

describe('interactive-list renderer', () => {
  it('renders list with items', () => {
    const html = renderScreen({
      type: 'interactive-list',
      data: {
        body: 'Select an option:',
        buttonText: 'Choose',
        items: [
          { title: 'Option A', description: 'First choice' },
          { title: 'Option B', description: 'Second choice' }
        ],
        time: '11:00 AM'
      }
    }, {});
    assert.ok(html.includes('Select an option:'));
    assert.ok(html.includes('Choose'));
    assert.ok(html.includes('Option A'));
    assert.ok(html.includes('Option B'));
  });
});

describe('pwa-webview renderer', () => {
  it('renders PWA screen', () => {
    const html = renderScreen({
      type: 'pwa-webview',
      data: {
        title: 'Order Details',
        subtitle: 'Banas Dairy',
        brandColor: '#10A7E1',
        content: '<div>Order items here</div>',
        status: 'Confirmed'
      }
    }, {});
    assert.ok(html.includes('Order Details'));
    assert.ok(html.includes('Banas Dairy'));
    assert.ok(html.includes('#10A7E1'));
    assert.ok(html.includes('Order items here'));
    assert.ok(html.includes('Confirmed'));
  });
});

describe('notification renderer', () => {
  it('renders notification', () => {
    const html = renderScreen({
      type: 'notification',
      data: {
        title: 'Payment Received',
        body: '₹48,500 has been credited',
        time: '3:45 PM'
      }
    }, {});
    assert.ok(html.includes('Payment Received'));
    assert.ok(html.includes('48,500'));
  });
});

// ─── Composite Rendering Tests ────────────────────────────────────────────────

describe('renderStep', () => {
  it('renders all screens in a step', () => {
    const step = {
      num: 1,
      title: 'Test Step',
      screens: [
        { type: 'whatsapp-message', data: { body: 'Message 1', sender: 'user' } },
        { type: 'whatsapp-message', data: { body: 'Message 2', sender: 'business' } }
      ]
    };
    const html = renderStep(step, {});
    assert.ok(html.includes('Message 1'));
    assert.ok(html.includes('Message 2'));
  });

  it('throws on step without screens', () => {
    assert.throws(
      () => renderStep({ num: 1, title: 'Bad' }, {}),
      /Step must have a "screens" array/
    );
  });
});

describe('renderJourney', () => {
  it('renders all steps in a journey', () => {
    const journey = {
      id: 'test',
      title: 'Test',
      steps: [
        {
          num: 1,
          title: 'Step 1',
          screens: [{ type: 'whatsapp-message', data: { body: 'Step 1 content' } }]
        },
        {
          num: 2,
          title: 'Step 2',
          screens: [{ type: 'pwa-webview', data: { title: 'PWA', content: 'Step 2' } }]
        }
      ]
    };
    const html = renderJourney(journey, {});
    assert.ok(html.includes('Step 1 content'));
    assert.ok(html.includes('Step 2'));
  });
});
