import reqwest from 'reqwest';
import url from 'url';
import './modernizr';

const importSass = new Promise((resolve, reject) => {
  if (Modernizr.webworkers) {
    System.import('sass.js/dist/sass', __moduleName).then(Sass => {
      resolve(new Sass());
    }).catch(err => reject(err));
  } else {
    System.import('sass.js/dist/sass.sync', __moduleName).then(Sass => {
      resolve(Sass);
    }).catch(err => reject(err));
  }
});


// intercept file loading requests (@import directive) from libsass
importSass.then(sass => {
  sass.importer((request, done) => {
    // Currently only supporting scss imports due to
    // https://github.com/sass/libsass/issues/1695
    const importUrl = url.resolve('', `${request.resolved}.scss`);
    const partialUrl = importUrl.replace(/\/([^/]*)$/, '/_$1');
    let content;
    reqwest(partialUrl)
      .then(resp => {
        // In Cordova Apps the response is the raw XMLHttpRequest
        content = resp.responseText ? resp.responseText : resp;
        return content;
      })
      .catch(() => reqwest(importUrl))
      .then(resp => {
        content = resp.responseText ? resp.responseText : resp;
        return content;
      })
      .then(() => done({ content }));
  });
});


const compile = scss => {
  return new Promise((resolve, reject) => {
    importSass.then(sass => {
      sass.compile(scss.content, scss.options, result => {
        if (result.status === 0) {
          const style = document.createElement('style');
          style.textContent = result.text;
          style.setAttribute('type', 'text/css');
          document.getElementsByTagName('head')[0].appendChild(style);
          resolve('');
        } else {
          reject(result.formatted);
        }
      });
    });
  });
};

export default load => {
  const urlBase = load.address;
  const indentedSyntax = urlBase.endsWith('.sass');
  // load initial scss file
  return reqwest(urlBase)
    // In Cordova Apps the response is the raw XMLHttpRequest
    .then(resp => {
      return {
        content: (resp.responseText ? resp.responseText : resp),
        options: { indentedSyntax },
      };
    })
    .then(compile);
};
