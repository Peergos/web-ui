const cacheName = 'BrowserCache_v1';

const precachedAssets = [
    'index.html',
    'init.js',
    'codemirror.js',
    'codemirror.css',
    'addon/mode/simple.js',
    'mode/modelica/modelica.js',
    'mode/eiffel/eiffel.js',
    'mode/mathematica/mathematica.js',
    'mode/stex/stex.js',
    'mode/python/python.js',
    'mode/clike/clike.js',
    'mode/xml/xml.js',
    'mode/elm/elm.js',
    'mode/cobol/cobol.js',
    'mode/vbscript/vbscript.js',
    'mode/jinja2/jinja2.js',
    'mode/ecl/ecl.js',
    'mode/puppet/puppet.js',
    'mode/tiddlywiki/tiddlywiki.css',
    'mode/tiddlywiki/tiddlywiki.js',
    'mode/javascript/javascript.js',
    'mode/brainfuck/brainfuck.js',
    'mode/mumps/mumps.js',
    'mode/rst/rst.js',
    'mode/factor/factor.js',
    'mode/r/r.js',
    'mode/toml/toml.js',
    'mode/properties/properties.js',
    'mode/xquery/xquery.js',
    'mode/webidl/webidl.js',
    'mode/sparql/sparql.js',
    'mode/d/d.js',
    'mode/lua/lua.js',
    'mode/ttcn/ttcn.js',
    'mode/mbox/mbox.js',
    'mode/coffeescript/coffeescript.js',
    'mode/idl/idl.js',
    'mode/commonlisp/commonlisp.js',
    'mode/octave/octave.js',
    'mode/apl/apl.js',
    'mode/z80/z80.js',
    'mode/css/css.js',
    'mode/twig/twig.js',
    'mode/jsx/jsx.js',
    'mode/meta.js',
    'mode/swift/swift.js',
    'mode/asn.1/asn.1.js',
    'mode/crystal/crystal.js',
    'mode/tornado/tornado.js',
    'mode/gas/gas.js',
    'mode/haxe/haxe.js',
    'mode/powershell/powershell.js',
    'mode/pig/pig.js',
    'mode/ttcn-cfg/ttcn-cfg.js',
    'mode/go/go.js',
    'mode/turtle/turtle.js',
    'mode/ruby/ruby.js',
    'mode/haskell/haskell.js',
    'mode/tcl/tcl.js',
    'mode/soy/soy.js',
    'mode/ebnf/ebnf.js',
    'mode/q/q.js',
    'mode/asterisk/asterisk.js',
    'mode/handlebars/handlebars.js',
    'mode/sieve/sieve.js',
    'mode/velocity/velocity.js',
    'mode/yaml-frontmatter/yaml-frontmatter.js',
    'mode/http/http.js',
    'mode/dart/dart.js',
    'mode/dylan/dylan.js',
    'mode/cypher/cypher.js',
    'mode/cmake/cmake.js',
    'mode/yacas/yacas.js',
    'mode/solr/solr.js',
    'mode/fortran/fortran.js',
    'mode/pascal/pascal.js',
    'mode/yaml/yaml.js',
    'mode/diff/diff.js',
    'mode/php/php.js',
    'mode/perl/perl.js',
    'mode/julia/julia.js',
    'mode/gherkin/gherkin.js',
    'mode/forth/forth.js',
    'mode/scheme/scheme.js',
    'mode/vb/vb.js',
    'mode/haml/haml.js',
    'mode/vue/vue.js',
    'mode/protobuf/protobuf.js',
    'mode/erlang/erlang.js',
    'mode/asciiarmor/asciiarmor.js',
    'mode/rust/rust.js',
    'mode/nsis/nsis.js',
    'mode/htmlembedded/htmlembedded.js',
    'mode/sass/sass.js',
    'mode/markdown/markdown.js',
    'mode/htmlmixed/htmlmixed.js',
    'mode/haskell-literate/haskell-literate.js',
    'mode/stylus/stylus.js',
    'mode/dockerfile/dockerfile.js',
    'mode/django/django.js',
    'mode/ntriples/ntriples.js',
    'mode/smarty/smarty.js',
    'mode/mirc/mirc.js',
    'mode/slim/slim.js',
    'mode/groovy/groovy.js',
    'mode/shell/shell.js',
    'mode/pegjs/pegjs.js',
    'mode/fcl/fcl.js',
    'mode/pug/pug.js',
    'mode/textile/textile.js',
    'mode/sql/sql.js',
    'mode/oz/oz.js',
    'mode/mllike/mllike.js',
    'mode/livescript/livescript.js',
    'mode/rpm/rpm.js',
    'mode/mscgen/mscgen.js',
    'mode/troff/troff.js',
    'mode/smalltalk/smalltalk.js',
    'mode/spreadsheet/spreadsheet.js',
    'mode/gfm/gfm.js',
    'mode/clojure/clojure.js',
    'mode/vhdl/vhdl.js',
    'mode/tiki/tiki.css',
    'mode/tiki/tiki.js',
    'mode/verilog/verilog.js',
    'mode/sas/sas.js',
    'mode/nginx/nginx.js',
    'mode/dtd/dtd.js',
];

self.addEventListener('install', event =>  {
      event.waitUntil(caches.open(cacheName).then((cache) => {
        return cache.addAll(precachedAssets);
      }));
    self.skipWaiting();
});
self.addEventListener('activate', event => {
    clients.claim();
});

self.onfetch = event => {
    const url = event.request.url;
    let requestURL = new URL(url);
    if (requestURL.pathname.startsWith('/api')) return;
    if (event.request.mode === 'navigate') {
        event.respondWith(caches.open(cacheName).then(async cache => {
            const cached = await cache.match(event.request.url);
            if (cached) return cached;
            const index = await cache.match('index.html');
            if (index) return index;
            return fetch(event.request.url);
        }));
    } else if (event.request.mode === 'no-cors') {
        event.respondWith(caches.open(cacheName).then(cache => {
            return fetch(event.request.url).then(fetchedResponse => {
                cache.put(event.request, fetchedResponse.clone());
                return fetchedResponse;
            }).catch(() => cache.match(event.request.url));
        }));
    }
}

