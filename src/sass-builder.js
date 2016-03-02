import autoprefixer from 'autoprefixer';
import fs from 'fs';
import isEmpty from 'lodash/lang/isEmpty';
import path from 'path';
import postcss from 'postcss';
import sass from 'sass.js';

import resolvePath from './resolve-path';

const cssInject = "(function(c){if (typeof document == 'undefined') return; var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})";
const isWin = process.platform.match(/^win/);

const escape = source => {
  return source
    .replace(/(["\\])/g, '\\$1')
    .replace(/[\f]/g, '\\f')
    .replace(/[\b]/g, '\\b')
    .replace(/[\n]/g, '\\n')
    .replace(/[\t]/g, '\\t')
    .replace(/[\r]/g, '\\r')
    .replace(/[\ufeff]/g, '')
    .replace(/[\u2028]/g, '\\u2028')
    .replace(/[\u2029]/g, '\\u2029');
};

const loadFile = file => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, { encoding: 'UTF-8' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const fromFileURL = url => {
  const address = url.replace(/^file:(\/+)?/i, '');
  return !isWin ? `/${address}` : address.replace(/\//g, '\\');
};

// intercept file loading requests (@import directive) from libsass
sass.importer((request, done) => {
  // Currently only supporting scss imports due to
  // https://github.com/sass/libsass/issues/1695
  let content;
  let resolved;
  let readImportPath;
  let readPartialPath;
  resolvePath(request)
    .then(importUrl => {
      resolved = importUrl;
      const partialUrl = importUrl.replace(/\/([^/]*)$/, '/_$1');
      readImportPath = fromFileURL(importUrl);
      readPartialPath = fromFileURL(partialUrl);
      return loadFile(readPartialPath);
    })
    .then(data => content = data)
    .catch(() => loadFile(readImportPath))
    .then(data => content = data)
    .then(() => done({ content, path: resolved }))
    .catch(() => done());
});

export default (loads, compileOpts) => {
  const stubDefines = loads.map(load => {
    return `${(compileOpts.systemGlobal || 'System')}\.register('${load.name}', [], false, function() {});`;
  }).join('\n');

  const compilePromise = load => {
    return new Promise((resolve, reject) => {
      const urlBase = `${path.dirname(load.address)}/`;
      const options = {
        style: sass.style.compressed,
        indentedSyntax: load.address.endsWith('.sass'),
        importer: { urlBase },
      };
      // Occurs on empty files
      if (isEmpty(load.source)) {
        return resolve('');
      }
      sass.compile(load.source, options, ({ status, text, formatted }) => {
        if (status === 0) {
          postcss([autoprefixer]).process(text).then(({ css }) => {
            resolve(css);
          });
        } else {
          reject(formatted);
        }
      });
    });
  };
  return new Promise((resolve, reject) => {
    // Keep style order
    Promise.all(loads.map(compilePromise))
    .then(
      response => resolve([stubDefines, cssInject, `("${escape(response.reverse().join(''))}");`].join('\n')),
      reason => reject(reason));
  });
};
