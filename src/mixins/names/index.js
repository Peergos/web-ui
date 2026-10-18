/** A name someone gives a thing of theirs that is only ever shown, never a path or an address -
 *  a calendar, a chat, a mail folder - so it can be in any language, with any character that
 *  shows as itself.
 *
 *  Gives back the name in one Unicode form and without invisible characters at either end, so
 *  names that look alike are alike, or null when it would not show as itself: nothing visible, a
 *  line break or another control character, a zero-width space or joiner with no place in a name
 *  (U+200B, U+2060-2064, U+FEFF), or one of the characters that make text show in another order
 *  than it has (U+202A-202E, U+2066-2069), with which one name could pass for another. The joiners
 *  emoji and some scripts are written with, and the marks that order mixed-direction text, stay.
 *  `blank` tells nothing given from something refused, since only the second is worth a message.
 */
const REFUSED = /[\p{Cc}\p{Zl}\p{Zp}\u200B\u2060-\u2064\uFEFF\u202A-\u202E\u2066-\u2069]/u;

module.exports = {
    shownName: function(supplied) {
        let name = String(supplied).normalize('NFC').replace(/^[\s\p{Cf}]+|[\s\p{Cf}]+$/gu, '');
        if (module.exports.blank(name) || name === '.' || name === '..' || REFUSED.test(name))
            return null;
        return name;
    },

    blank: function(supplied) {
        return ! /[^\s\p{Cf}]/u.test(String(supplied));
    }
};
