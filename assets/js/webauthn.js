/* Security keys in the desktop app.
 *
 * The webview it runs in has no WebAuthn of its own, so navigator.credentials is
 * routed to the local Peergos server, which drives the key over CTAP2 and signs
 * for the relying party the account lives on. That is also why a key registered
 * in a browser for peergos.net works here, which the browser would refuse to do
 * from a localhost page.
 *
 * In a real browser this file does nothing at all.
 */
(function () {
    if (navigator.credentials && window.PublicKeyCredential)
        return;

    function serialise(options) {
        return JSON.stringify(options, function (key, value) {
            if (value instanceof ArrayBuffer)
                return {_type: 'ArrayBuffer', data: Array.from(new Uint8Array(value))};
            if (ArrayBuffer.isView(value))
                return {_type: 'ArrayBuffer',
                        data: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))};
            return value;
        });
    }

    function toArrayBuffer(base64url) {
        var base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4)
            base64 += '=';
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    function toCredential(json) {
        var credential = {
            id: json.id,
            type: json.type || 'public-key',
            rawId: toArrayBuffer(json.rawId),
            response: {},
            getClientExtensionResults: function () { return {}; }
        };
        ['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle']
            .forEach(function (field) {
                if (json.response[field] !== undefined)
                    credential.response[field] = toArrayBuffer(json.response[field]);
            });
        return credential;
    }

    function ask(action, options) {
        if (! options || ! options.publicKey)
            return Promise.reject(new DOMException('Only publicKey credentials are supported here',
                                                   'NotSupportedError'));
        return fetch('/peergos/v0/webauthn/' + action, {method: 'POST', body: serialise(options)})
            .then(function (response) {
                if (! response.ok) {
                    // the server puts the reason in a Trailer header, url encoded
                    var reason = response.headers.get('Trailer');
                    throw new DOMException(reason ? decodeURIComponent(reason.replace(/\+/g, ' '))
                                                  : 'The security key could not be used',
                                           'NotAllowedError');
                }
                return response.json().then(toCredential);
            });
    }

    var credentials = {
        create: function (options) { return ask('create', options); },
        get: function (options) { return ask('get', options); }
    };

    // navigator.credentials is a read only idl attribute, so go via the prototype
    try {
        Object.defineProperty(Navigator.prototype, 'credentials', {
            get: function () { return credentials; },
            configurable: true
        });
    } catch (e) {
        try {
            Object.defineProperty(navigator, 'credentials',
                                  {value: credentials, writable: true, configurable: true});
        } catch (e2) {
            navigator.credentials = credentials;
        }
    }

    // enough of PublicKeyCredential for the ui to see that security keys work
    if (! window.PublicKeyCredential) {
        window.PublicKeyCredential = function PublicKeyCredential() {};
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable =
            function () { return Promise.resolve(false); };
        window.PublicKeyCredential.isConditionalMediationAvailable =
            function () { return Promise.resolve(false); };
    }
})();
