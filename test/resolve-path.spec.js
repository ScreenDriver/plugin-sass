import test from 'tape';
import path from 'path';
import url from 'url';
import resolvePath from '../src/resolve-path';

test('sanity check', assert => {
  assert.equal(typeof resolvePath, 'function', 'can import resolvePath and it is a function');
  assert.end();
});

test('import', assert => {
  let request = {
    current: 'mock/import',
    previous: 'stdin',
    options: {
      urlBase: '/'
    }
  };

  resolvePath(request, '/')
    .then(p => {
      assert.equal(p, '/mock/import.scss', 'resolves import.');
    })
    .catch(e => assert.fail(e))
    .then(() => assert.end());
});

test('jspm import', assert => {
  System.config({
    baseURL: __dirname,
    defaultJSExtensions: true,
    paths: {
      'github:*': 'jspm_packages/github/*',
      'npm:*': 'jspm_packages/npm/*',
    },
    map: {
      'mock-package': 'npm:mock-package@1.0.0',
    },
  });

  const request = {
    current: 'jspm:mock-package/mock-asset',
    previous: 'stdin',
  };

  resolvePath(request, '/')
    .then(p => {
      // System.normalize in resolvePath will give us the absolute path
      const relative = '/' + path.relative(__dirname, url.parse(p).path);
      assert.equal(relative, '/jspm_packages/npm/mock-package@1.0.0/mock-asset.scss', 'resolves "jspm:" import');
    })
    .catch(e => assert.fail(e))
    .then(() => assert.end());
});

test('nested imports from jspm package', assert => {
  let request = {
    current: 'mixins/mixin',
    previous: '/jspm_packages/npm/mock-package@1.0.0/mock-asset',
  };

  resolvePath(request, '/')
    .then(p => {
      assert.equal(p, '/jspm_packages/npm/mock-package@1.0.0/mixins/mixin.scss', 'resolves a nested import');
    })
    .catch(e => assert.fail(e))
    .then(() => {
      request = {
        current: 'deeper/mixin',
        previous: 'mixins/mixin',
      };

      resolvePath(request, '/')
        .then(p => {
          assert.equal(p, '/jspm_packages/npm/mock-package@1.0.0/mixins/deeper/mixin.scss', 'resolves a doubly nested import');
        })
        .catch(e => assert.fail(e))
        .then(() => assert.end());
    });
});
