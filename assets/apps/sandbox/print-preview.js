window.addEventListener('message', e => {
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;
    if (e.data.type == "printPreviewRequest") {
        let existingStyle = document.getElementById('cssId');
        if (existingStyle != null) {
            existingStyle.remove();
        }
        const style = document.createElement('style');
        style.id = 'cssId';
        style.textContent = e.data.css;
        document.head.append(style);
        let sanitizedHTML = DOMPurify.sanitize(e.data.html);
        let contentElement = document.getElementById('print-preview-content');
        contentElement.innerHTML = sanitizedHTML;
        document.title = e.data.title;
        try {
            window.print();
        } catch (ex) {
            console.log('unable to call window.print(). Error:' + ex);
        }
    }
});