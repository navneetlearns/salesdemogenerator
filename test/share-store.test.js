const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SHARE_TTL_MS,
  MAX_SHARE_HTML_BYTES,
  createShare,
  getShare,
  cleanupExpiredShares
} = require('../lib/share-store');

function createBlobMock(now) {
  const blobs = new Map();
  const deleted = [];

  return {
    blobs,
    deleted,
    client: {
      put: async function(pathname, body, options) {
        blobs.set(pathname, {
          body: String(body),
          options: options || {},
          uploadedAt: now()
        });
        return { pathname: pathname, url: 'https://blob.example/' + pathname };
      },
      list: async function(options) {
        const prefix = options && options.prefix || '';
        return {
          blobs: Array.from(blobs.keys())
            .filter(function(pathname) { return pathname.indexOf(prefix) === 0; })
            .map(function(pathname) {
              return { pathname: pathname, url: 'https://blob.example/' + pathname };
            })
        };
      },
      del: async function(pathname) {
        deleted.push(pathname);
        blobs.delete(pathname);
      }
    }
  };
}

test('createShare stores generated html in a private blob behind a random token', async function() {
  let currentTime = Date.UTC(2026, 4, 28, 9, 0, 0);
  const blob = createBlobMock(function() { return currentTime; });

  const result = await createShare({
    html: '<!doctype html><html><body>Demo</body></html>',
    brandName: 'Acme Cement',
    journeyType: 'order_to_cash'
  }, {
    blob: blob.client,
    now: function() { return currentTime; },
    origin: 'https://demo.example'
  });

  assert.match(result.token, /^[a-f0-9]{32}$/);
  assert.equal(result.url, 'https://demo.example/api/share?token=' + result.token);
  assert.equal(result.expiresAt, currentTime + SHARE_TTL_MS);

  const pathname = 'shares/' + result.token + '.json';
  assert.equal(blob.blobs.has(pathname), true);
  assert.equal(blob.blobs.get(pathname).options.access, 'private');

  const stored = JSON.parse(blob.blobs.get(pathname).body);
  assert.equal(stored.html, '<!doctype html><html><body>Demo</body></html>');
  assert.equal(stored.brandName, 'Acme Cement');
  assert.equal(stored.journeyType, 'order_to_cash');
  assert.equal(stored.expiresAt, currentTime + SHARE_TTL_MS);
  assert.equal(stored.journeyTypes, null);

  // Verify journeyTypes is stored when provided
  const result2 = await createShare({
    html: '<!doctype html><html><body>Multi</body></html>',
    brandName: 'Acme Multi',
    journeyType: 'order_to_cash',
    journeyTypes: ['order_to_cash', 'dealer_engagement']
  }, {
    blob: blob.client,
    now: function() { return currentTime; },
    origin: 'https://demo.example'
  });
  const pathname2 = 'shares/' + result2.token + '.json';
  const stored2 = JSON.parse(blob.blobs.get(pathname2).body);
  assert.deepEqual(stored2.journeyTypes, ['order_to_cash', 'dealer_engagement']);
});

test('createShare rejects missing and oversized html', async function() {
  const blob = createBlobMock(function() { return 0; });

  await assert.rejects(
    createShare({ html: '' }, { blob: blob.client, now: function() { return 0; } }),
    /Generated HTML is required/
  );

  await assert.rejects(
    createShare({ html: 'x'.repeat(MAX_SHARE_HTML_BYTES + 1) }, {
      blob: blob.client,
      now: function() { return 0; }
    }),
    /too large/
  );
});

test('getShare returns html before expiry and throws gone after expiry', async function() {
  let currentTime = Date.UTC(2026, 4, 28, 9, 0, 0);
  const blob = createBlobMock(function() { return currentTime; });

  const created = await createShare({
    html: '<html><body>Shared</body></html>',
    brandName: 'Acme',
    journeyType: 'field_ops_expense'
  }, {
    blob: blob.client,
    now: function() { return currentTime; },
    origin: 'https://demo.example'
  });

  const share = await getShare(created.token, {
    blob: blob.client,
    fetchBlob: async function(url) {
      const pathname = url.replace('https://blob.example/', '');
      return { ok: true, text: async function() { return blob.blobs.get(pathname).body; } };
    },
    now: function() { return currentTime + SHARE_TTL_MS - 1; }
  });

  assert.equal(share.html, '<html><body>Shared</body></html>');
  assert.equal(share.brandName, 'Acme');

  await assert.rejects(
    getShare(created.token, {
      blob: blob.client,
      fetchBlob: async function(url) {
        const pathname = url.replace('https://blob.example/', '');
        return { ok: true, text: async function() { return blob.blobs.get(pathname).body; } };
      },
      now: function() { return currentTime + SHARE_TTL_MS + 1; }
    }),
    function(err) {
      assert.equal(err.code, 'SHARE_EXPIRED');
      return true;
    }
  );
});

test('cleanupExpiredShares deletes only expired share blobs', async function() {
  let currentTime = Date.UTC(2026, 4, 28, 9, 0, 0);
  const blob = createBlobMock(function() { return currentTime; });

  await blob.client.put('shares/expired.json', JSON.stringify({
    token: 'expired',
    html: '<html></html>',
    expiresAt: currentTime - 1
  }), { access: 'private' });
  await blob.client.put('shares/live.json', JSON.stringify({
    token: 'live',
    html: '<html></html>',
    expiresAt: currentTime + 1
  }), { access: 'private' });

  const result = await cleanupExpiredShares({
    blob: blob.client,
    fetchBlob: async function(url) {
      const pathname = url.replace('https://blob.example/', '');
      return { ok: true, text: async function() { return blob.blobs.get(pathname).body; } };
    },
    now: function() { return currentTime; }
  });

  assert.deepEqual(result, { checked: 2, deleted: 1 });
  assert.deepEqual(blob.deleted, ['shares/expired.json']);
  assert.equal(blob.blobs.has('shares/live.json'), true);
});
