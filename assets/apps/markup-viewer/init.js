var mainWindow;
var origin;
var editorJS = null;

window.MathJax = {
  tex: {
    inlineMath: [ ['$','$'], ["\\(","\\)"] ],
    displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
    processEscapes: false,
    tagSide: "right",
    tagIndent: ".8em",
    multlineWidth: "85%",
    tags: "ams",
    autoload: {
      color: [],
      colorv2: ['color']
    },
    packages: {'[+]': ['noerrors']}
  },
  options: {
    ignoreHtmlClass: 'tex2jax_ignore',
    processHtmlClass: 'tex2jax_process'
  },
  loader: {
    load: ['[tex]/noerrors']
  }
};

window.addEventListener('message', function (e) {
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;

    mainWindow = e.source;
    origin = e.origin;

    var jsonNoteData = {blocks: [], version: "", time: ""}
    if (e.data.action == "ping") {
        mainWindow.postMessage({action:'pong'}, e.origin);
    } else if(e.data.action == "respondToLoadImage"){
        let image = document.getElementById(e.data.id);
        let blob = new Blob([e.data.data]);
        image.src = URL.createObjectURL(blob);
    } else if(e.data.action == "respondToNavigateTo"){
        let markdownThemeToUse = e.data.theme != null && e.data.theme == 'dark-mode' ? 'dark' : 'light';
        if (e.data.extension == 'note') {
            initialiseMarkdownEditor(markdownThemeToUse, e.data.subPath, '');
            if (e.data.text.length > 0) {
                try {
                    jsonNoteData = JSON.parse(e.data.text);
                    if (!(jsonNoteData.blocks.constructor === Array)) {
                        alert(`Unable to parse file`);
                    }
                } catch (ex) {
                    alert(`Unable to read contents of file`);
                    console.log(ex);
                }
            }
            initialiseEditorJS(e.data.theme, jsonNoteData);
        } else if (e.data.extension == 'md') {
            initialiseMarkdownEditor(markdownThemeToUse, e.data.subPath, e.data.text);
            initialiseEditorJS(null, jsonNoteData);
        } else {
            console.log('unknown extension: ' + extension);
        }
    }
});
	function getCurrentFolder() {
		return "";
	}
function initialiseMarkdownEditor(theme, subPathInput, text) {
    let div = document.createElement('div');
    let subPath = subPathInput ? subPathInput : '';
    const viewer = new toastui.Editor({
        el: div,
        initialValue: text,
        usageStatistics: false,
        headless: true,
        theme: theme,
        subPath: subPath
    });
    let output = viewer.getHTML();
    let xss = DOMPurify.sanitize(output);
    let element = document.getElementById('sanitized');
    let body = document.getElementById('body-element');
    let mdElement = document.getElementById('md-element');
    if (text.length == 0) {
        element.innerHTML = xss;
    } else {
        addMathJax(xss);
    }
    if (theme == 'dark') {
        mdElement.classList.add("toastui-editor-dark");
        body.classList.add("dark-body");
    } else {
        mdElement.classList.remove("toastui-editor-dark");
        body.classList.remove("dark-body");
    }
}
function typeset(code) {
  MathJax.startup.promise = MathJax.startup.promise
    .then(() => MathJax.typesetPromise(code()))
    .catch((err) => console.log('Typeset failed: ' + err.message));
  return MathJax.startup.promise;
}
function isDigit(char) {
    return !isNaN(parseInt(char));
}
function encodeMath(text) {
    var startIdx = -1;
    let token = "$";
    let replacementToken = "<span>$</span>";
    let indexesToReplace = [];
    var done = false;
    while(!done) {
        startIdx = text.indexOf(token, startIdx + 1);
        if (startIdx > -1) {
            if (startIdx < text.length -1 && (isDigit(text[startIdx + 1]) )){ // || text[startIdx + 1] == ' ')) {
                indexesToReplace.push(startIdx);
            }
        } else {
            done = true;
        }
    }
    let indexesToReplaceReversed = indexesToReplace.reverse();
    for(var i = 0; i < indexesToReplaceReversed.length; i++) {
        let idx = indexesToReplaceReversed[i];
        let before = text.substring(0, idx);
        let after = text.substring(idx + token.length);
        text = before + replacementToken + after;
    }
    return text;
}
function addMathJax(text) {
    let callback = () => {
        typeset(() => {
            const node = document.getElementById('sanitized');
            node.innerHTML = encodeMath(text);
            return [node];
        }).then(() => {
            console.log('math typeset complete');
        });
	};
    var script = document.createElement('script');
    script.onload = callback;
    script.setAttribute("type","text/javascript");
    script.setAttribute("src", './es5/tex-chtml.js');
    document.getElementsByTagName("head")[0].appendChild(script);
}
function updateResources() {
    const collection = document.getElementsByClassName("math-input");
    for(var i=0; i < collection.length; i++) {
        let el = collection[i];
        el.style.display = 'none';
    }
    let that = this;
    setTimeout(() => {
        that.updateResourcesInDoc();
    }, 100);
}
function updateResourcesInDoc() {
        let anchors = document.getElementsByTagName("a");
        for(var i=0; i < anchors.length;i++) {
            let anchor = anchors[i];
            anchor.addEventListener("click", function(e){
                e.preventDefault();
                let url = e.target.href;
                if (url == null) {
                    let media = e.target.parentElement;
                    mainWindow.postMessage({action:'showMedia', path: media.pathname}, origin);
                } else {
                    const requestedResource = new URL(url);
                    if (window.location.host == requestedResource.host) {
                        mainWindow.postMessage({action:'navigateTo', path: requestedResource.pathname}, origin);
                    } else {
                        if(requestedResource.protocol == 'https:' || requestedResource.protocol == 'http:') {
                            mainWindow.postMessage({action:'externalLink', url: url}, origin);
                        } else {
                            console.log('invalid link: ' + url);
                        }
                    }
                }
            });
        }
        let images = document.getElementsByTagName("img");
        for(var i=0; i < images.length;i++) {
            let image = images[i];
            let isDataImage = image.src.startsWith("data:");
            if (!isDataImage) {
                const requestedResource = new URL(image.src);
                if (window.location.host == requestedResource.host) {
                    image.src = '#';
                    let generatedId = 'image-' + uuid();
                    image.id = generatedId;
                    mainWindow.postMessage({action:'loadImage', src: requestedResource.pathname, id: generatedId}, origin);
                } else {
                    console.log('invalid link: ' + image.src);
                }
            }
        }
}
function initialiseEditorJS(theme, jsonData) {
    let setToDarkMode = theme != null && theme == 'dark-mode';
    if (setToDarkMode) {
        document.body.classList.add("dark-mode");
    }
    if (editorJS == null) {
        editorJS = new EditorJS({
            readOnly: true,
            holder: 'editorjs',
            tools: {
                header: {
                    class: Header,
                    inlineToolbar: ['marker', 'link'],
                    config: {
                        placeholder: 'Header'
                    },
                    shortcut: 'CMD+SHIFT+H'
                },
                underline: Underline,
                strikethrough: Strikethrough,
                image: {
                    class: ImageTool,
                    config: {
                        types: 'image/*',
                        uploader: {
                            uploadByFile(file){
                                let prom = new Promise(function(resolve, reject) {
                                    if (file.lastModified == null) {
                                        let obj = {
                                            success: file.url.length == 0 ? 0 : 1,
                                            file: {
                                                url: file.url,
                                            }
                                        };
                                        resolve(obj);
                                    } else {
                                        var reader = new FileReader();
                                        reader.onloadend = function() {
                                            let obj = {
                                                success: 1,
                                                file: {
                                                    url: reader.result,
                                                }
                                            };
                                            resolve(obj);
                                        }
                                        reader.readAsDataURL(file);
                                    }
                                });
                                return prom;
                            },
                            uploadByUrl(url){ //url
                                let prom = new Promise(function(resolve, reject) {
                                    let obj = {
                                        success: 0,
                                        file: {
                                            url: url,
                                        }
                                    };
                                    resolve(obj);
                                });
                                return prom;
                            },
                        }
                    },
                },
                list: {
                    class: NestedList,
                    inlineToolbar: true,
                    config: {
                        defaultStyle: 'unordered'
                    },
                },
                checklist: {
                    class: Checklist,
                    inlineToolbar: true,
                },
                marker: {
                    class:  Marker,
                    shortcut: 'CMD+SHIFT+M'
                },
                code: {
                    class:  CodeTool,
                    shortcut: 'CMD+SHIFT+C'
                },
                delimiter: Delimiter,
                inlineCode: {
                    class: InlineCode,
                },
                table: {
                    class: Table,
                    inlineToolbar: true,
                    shortcut: 'CMD+ALT+T'
                },
                Math: {
        			class: EJLaTeX,
        			shortcut: 'CMD+SHIFT+L'
		    	},
                attaches: {
                    class: AttachesTool,
                    config: {
                        uploader: {
                            uploadByFile(file){
                                let prom = new Promise(function(resolve, reject) {
                                    let obj = {
                                        success: 1,
                                        file: {
                                            url: 'test.png',
                                            size: 0,
                                            title: 'test.png',
                                            extension: 'png'
                                        }
                                        };
                                        resolve(obj);
                                });
                                return prom;
                            },
                        }
                    },
                },
                mermaid: MermaidTool,
                anyTuneName: {
                    class:AlignmentBlockTune,
                },
                textVariant: TextVariantTune,
                paragraph: {
                    tunes: ['textVariant','anyTuneName'],
                },
                anchorTune: AnchorTune,
            },
            tunes: ['anchorTune'],
            data: jsonData,
            onReady: function(){
                new DragDrop(editorJS);
                updateResources();
            },
            onChange: function(api, event) {
                //console.log('change event: ', event);
            }
        });
    } else {
        //editorJS.clear();
        editorJS.render(jsonData).then(() => {
            updateResources();
        });
    }
}
function uuid() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
}

navigator.serviceWorker.getRegistration('./').then(swReg => {
    return swReg || navigator.serviceWorker.register('sw.js', {scope: './'})
}).catch(e => {
    console.log(e);
    let parentHost = window.location.protocol + "//" + window.location.host.substring(window.location.host.indexOf(".")+1)
    window.parent.postMessage("sw-registration-failure", parentHost)
})
