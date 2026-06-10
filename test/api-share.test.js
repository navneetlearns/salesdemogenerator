const assert = require('node:assert/strict');
const test = require('node:test');

function loadShareApiWithStore(storeMock) {
  const storePath = require.resolve('../lib/share-store');
  const apiPath = require.resolve('../api/share');
  const previousStore = require.cache[storePath];
  delete require.cache[apiPath];
  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: storeMock
  };
  const handler = require('../api/share');
  delete require.cache[apiPath];
  if (previousStore) {
    require.cache[storePath] = previousStore;
  } else {
    delete require.cache[storePath];
  }
  return handler;
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader: function(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end: function(body) {
      this.body = body || '';
    }
  };
}

test('GET v3 share serves a complete hub page with journey loader script', async function() {
  const token = '0123456789abcdef0123456789abcdef';
  const handler = loadShareApiWithStore({
    createShare: async function() {},
    initHub: async function() {},
    addJourneyToHub: async function() {},
    readJourneyBlob: async function() {},
    getShare: async function(receivedToken) {
      assert.equal(receivedToken, token);
      return {
        version: 3,
        token: token,
        brandName: 'Acme Cement',
        config: { name: 'Acme Cement', brandColor: '#1565C0' },
        journeyTypes: ['order_to_cash', 'dealer_engagement', 'field_ops_expense'],
        journeyBlobs: [
          { type: 'order_to_cash', path: 'shares/' + token + '_order_to_cash.html' },
          { type: 'dealer_engagement', path: 'shares/' + token + '_dealer_engagement.html' }
        ]
      };
    }
  });

  const req = {
    method: 'GET',
    query: { token: token },
    url: '/api/share?token=' + token,
    headers: {}
  };
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.body, /window\.loadJourney=function/);
  assert.match(res.body, /window\._hubToken="0123456789abcdef0123456789abcdef"/);
  assert.match(res.body, /field_ops_expense/);
  assert.match(res.body, /<\/script><\/body><\/html>$/);
  assert.doesNotMatch(res.body, /undefined$/);
});

test('GET v3 journey subrequest serves stored journey HTML', async function() {
  const token = '0123456789abcdef0123456789abcdef';
  const handler = loadShareApiWithStore({
    createShare: async function() {},
    initHub: async function() {},
    addJourneyToHub: async function() {},
    getShare: async function() {},
    readJourneyBlob: async function(receivedToken, journeyType) {
      assert.equal(receivedToken, token);
      assert.equal(journeyType, 'order_to_cash');
      return '<!doctype html><html><body>Journey</body></html>';
    }
  });

  const req = {
    method: 'GET',
    query: { token: token, journey: 'order_to_cash' },
    url: '/api/share?token=' + token + '&journey=order_to_cash',
    headers: {}
  };
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<!doctype html><html><body>Journey</body></html>');
});
