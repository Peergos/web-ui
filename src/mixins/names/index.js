/** A name someone gives a thing of theirs that is only ever shown, never a path or an address -
 *  a calendar, a chat, a mail folder - so it can be in any language, with any character that
 *  shows as itself.
 *
 *  Gives back the name in one Unicode form, so two that look the same are the same, or null when
 *  it would not show as itself: nothing visible, a line break or another control character, or one
 *  of the characters that make text show in another order than it has (U+202A-202E, U+2066-2069),
 *  with which one name could pass for another. `blank` tells nothing given from something refused,
 *  since only the second is worth a message.
 */
const REFUSED = /[\p{Cc}\p{Zl}\p{Zp}\u202A-\u202E\u2066-\u2069]/u;

module.exports = {
    shownName: function(supplied) {
        let name = String(supplied).normalize('NFC').trim();
        if (module.exports.blank(name) || name === '.' || name === '..' || REFUSED.test(name))
            return null;
        return name;
    },

    blank: function(supplied) {
        return ! /[^\s\p{Cf}]/u.test(String(supplied));
    }
};
