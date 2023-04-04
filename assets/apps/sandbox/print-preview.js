window.addEventListener('message', e => {
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;
    if (e.data.type == "printPreviewRequest") {
        let cssPlusHtml = `<style>${ e.data.css }</style>` + e.data.html;
        let TOKEN = "INVALID_HTML_DETECTED";
        //var config = {USE_PROFILES: {html: true}};//
        var config = {
          FORBID_TAGS: ['svg'],
          WHOLE_DOCUMENT: true,
        };
        let sanitizedHTML = sanitize(cssPlusHtml, config, TOKEN);
        if (sanitizedHTML.indexOf(TOKEN) != -1) {
            console.log('unable to sanitize html or css. print preview request failed');
        } else {
            let contentElement = document.getElementById('print-preview-content');
            contentElement.innerHTML = sanitizedHTML;
            document.title = e.data.title;
            try {
                window.print();
            } catch (ex) {
                console.log('unable to call window.print(). Error:' + ex);
            }
        }
    }
});
// from page https://github.com/cure53/DOMPurify/blob/main/demos/README.md
// Hook to proxy all HTTP leaks including CSS
// https://github.com/cure53/DOMPurify/blob/main/demos/hooks-proxy-demo.html
function sanitize(cssPlusHtml, config, proxy) {
    // Specify attributes to proxy
    var attributes = ['action', 'background', 'href', 'poster', 'src', 'srcset']

    // specify the regex to detect external content
    var regex = /(url\("?)(?!data:)/gim;

    /**
     *  Take CSS property-value pairs and proxy URLs in values,
     *  then add the styles to an array of property-value pairs
     */
    function addStyles(output, styles) {
        for (var prop = styles.length-1; prop >= 0; prop--) {
            if (styles[styles[prop]]) {
                var url = styles[styles[prop]].replace(regex, '$1' + proxy);
                styles[styles[prop]] = url;
            }
            if (styles[styles[prop]]) {
                output.push(styles[prop] + ':' + styles[styles[prop]] + ';');
            }
        }
    }

    /**
     * Take CSS rules and analyze them, proxy URLs via addStyles(),
     * then create matching CSS text for later application to the DOM
     */
    function addCSSRules(output, cssRules) {
        for (var index=cssRules.length-1; index>=0; index--) {
            var rule = cssRules[index];
            // check for rules with selector
            if (rule.type == 1 && rule.selectorText) {
                output.push(rule.selectorText + '{')
                if (rule.style) {
                    addStyles(output, rule.style)
                }
                output.push('}');
            // check for @media rules
            } else if (rule.type === rule.MEDIA_RULE) {
                output.push('@media ' + rule.media.mediaText + '{');
                addCSSRules(output, rule.cssRules)
                output.push('}');
            // check for @font-face rules
            } else if (rule.type === rule.FONT_FACE_RULE) {
                output.push('@font-face {');
                if (rule.style) {
                    addStyles(output, rule.style)
                }
                output.push('}');
            // check for @keyframes rules
            } else if (rule.type === rule.KEYFRAMES_RULE) {
                output.push('@keyframes ' + rule.name + '{');
                for (var i=rule.cssRules.length-1;i>=0;i--) {
                    var frame = rule.cssRules[i];
                    if (frame.type === 8 && frame.keyText) {
                        output.push(frame.keyText + '{');
                        if (frame.style) {
                            addStyles(output, frame.style);
                        }
                        output.push('}');
                    }
                }
                output.push('}');
            }
        }
    }

    /**
     * Proxy a URL in case it's not a Data URI
     */
    function proxyAttribute(url) {
        if (/^data:image\//.test(url)) {
            return url;
         } else {
            return "";// RETURN NOTHING proxy+escape(url)
        }
    }

    // Add a hook to enforce proxy for leaky CSS rules
    DOMPurify.addHook('uponSanitizeElement', function (node, data) {
        if (data.tagName === 'style') {
            var output  = [];
            addCSSRules(output, node.sheet.cssRules);
            node.textContent = output.join("\n");
        }
    });

    // Add a hook to enforce proxy for all HTTP leaks incl. inline CSS
    DOMPurify.addHook('afterSanitizeAttributes', function(node) {

        // Check all src attributes and proxy them
        for(var i = 0; i <= attributes.length-1; i++) {
            if (node.hasAttribute(attributes[i])) {
                node.setAttribute(attributes[i], proxyAttribute(
                    node.getAttribute(attributes[i]))
                );
            }
        }

        // Check all style attribute values and proxy them
        if (node.hasAttribute('style')) {
            var styles = node.style;
            var output = [];
            for (var prop = styles.length-1; prop >= 0; prop--) {
                // we re-write each property-value pair to remove invalid CSS
                if (node.style[styles[prop]] && regex.test(node.style[styles[prop]])) {
                    var url = node.style[styles[prop]].replace(regex, '$1'+proxy)
                    node.style[styles[prop]] = url;
                }
                output.push(styles[prop] + ':' + node.style[styles[prop]] + ';');
            }
            // re-add styles in case any are left
            if (output.length) {
                node.setAttribute('style', output.join(""));
            } else {
                node.removeAttribute('style');
            }

        }
    });
    return DOMPurify.sanitize(cssPlusHtml, config);
}