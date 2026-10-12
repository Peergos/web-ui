const DEFAULT_BOOK = 'default';

let books = [];
let currentBook = null;
let cards = [];
let selectedFile = null;
// the open book couldn't be read: its list says so, rather than looking empty
let loadFailed = false;

// ------------------------------------------------------------------ vCard

function unfold(text) {
	let lines = [];
	let softBreak = false;
	for (let line of text.split(/\r\n|\r|\n/)) {
		if (softBreak)
			// a quoted-printable value goes on after a line ending in =, with nothing in front
			lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + line;
		else if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0)
			lines[lines.length - 1] += line.substring(1);
		else if (line.length > 0)
			lines.push(line);
		let last = lines[lines.length - 1];
		softBreak = last != null && last.endsWith('=') && /QUOTED-PRINTABLE/i.test(last.substring(0, last.indexOf(':') + 1));
	}
	return lines;
}

// splits on a separator, ignoring any inside double quotes
function splitOutsideQuotes(s, sep) {
	let parts = [], current = '', quoted = false;
	for (let c of s) {
		if (c == '"') quoted = !quoted;
		if (c == sep && !quoted) { parts.push(current); current = ''; }
		else current += c;
	}
	parts.push(current);
	return parts;
}

function parseLine(raw) {
	let quoted = false, colon = -1;
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] == '"') quoted = !quoted;
		if (raw[i] == ':' && !quoted) { colon = i; break; }
	}
	if (colon < 0)
		return null;
	let head = splitOutsideQuotes(raw.substring(0, colon), ';');
	let fullName = head[0];
	let dot = fullName.indexOf('.');
	let params = head.slice(1).map(p => {
		let eq = p.indexOf('=');
		// a bare parameter is a vCard 2.1/3.0 shorthand for TYPE
		if (eq < 0)
			return {key: 'TYPE', values: [p]};
		let key = p.substring(0, eq).toUpperCase();
		let values = splitOutsideQuotes(p.substring(eq + 1), ',').map(v => v.replace(/^"|"$/g, ''));
		// TYPE="voice,cell" is the same list as TYPE=voice,cell
		return {key: key, values: key == 'TYPE' ? values.flatMap(v => v.split(',')) : values};
	});
	return {group: dot < 0 ? '' : fullName.substring(0, dot),
		name: (dot < 0 ? fullName : fullName.substring(dot + 1)).toUpperCase(),
		params: params, value: raw.substring(colon + 1), raw: raw};
}

// vCard 2.1 writes any value that isn't plain ASCII as quoted-printable, as Android's own
// contacts export does, and this app reads and writes plain text. Such a value is decoded once,
// as the card is read, and the card becomes a 3.0 one, the version without quoted-printable.
// Each value is written back the 3.0 way for what it is: a link as it was, the parts of a
// structured value or the items of a list each escaped on their own, so a ; or a , inside one
// stays part of it. Android's own X- properties are structured too.
const STRUCTURED = ['N', 'ADR', 'ORG'];
const LISTS = ['CATEGORIES', 'NICKNAME'];
const URIS = ['URL', 'PHOTO', 'LOGO', 'SOUND', 'KEY', 'SOURCE', 'MEMBER', 'IMPP', 'GEO', 'CALURI', 'CALADRURI', 'FBURL'];

function isQuotedPrintable(p) {
	return p.params.some(x => (x.key == 'ENCODING' || x.key == 'TYPE') && x.values.some(v => v.toUpperCase() == 'QUOTED-PRINTABLE'));
}

function decodeQuotedPrintable(s, charset) {
	let bytes = [];
	let encoder = new TextEncoder();
	// by character rather than by UTF-16 unit, so one left as it was outside the BMP stays whole
	let chars = Array.from(s);
	for (let i = 0; i < chars.length; i++) {
		let hex = (chars[i + 1] || '') + (chars[i + 2] || '');
		if (chars[i] == '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
			bytes.push(parseInt(hex, 16));
			i += 2;
		} else {
			bytes.push(...encoder.encode(chars[i]));
		}
	}
	let decoder;
	try {
		decoder = new TextDecoder(charset || 'utf-8');
	} catch (e) {
		decoder = new TextDecoder('utf-8');
	}
	return decoder.decode(new Uint8Array(bytes));
}

// splits on a separator that isn't escaped with a backslash
function splitUnescaped(s, sep) {
	let parts = [], current = '';
	for (let i = 0; i < s.length; i++) {
		if (s[i] == '\\' && i + 1 < s.length) { current += s[i] + s[i + 1]; i++; }
		else if (s[i] == sep) { parts.push(current); current = ''; }
		else current += s[i];
	}
	parts.push(current);
	return parts;
}

// a piece of a decoded 2.1 value, written the 3.0 way: 2.1 escapes only a separator that isn't one
function from21(text) {
	return escapeText(text.replace(/\\([;,])/g, '$1'));
}

// decoded whole, and only then split: an exporter that encodes every byte, as Android's does,
// encodes the separators too
function plainValue(p, charset) {
	let text = decodeQuotedPrintable(p.value, charset);
	if (URIS.includes(p.name) || p.params.some(x => x.key == 'VALUE' && x.values.some(v => v.toLowerCase() == 'uri')))
		return text;
	if (STRUCTURED.includes(p.name) || p.name.startsWith('X-'))
		return splitUnescaped(text, ';').map(from21).join(';');
	if (LISTS.includes(p.name))
		return splitUnescaped(text, ',').map(from21).join(',');
	return from21(text);
}

// 2.1 shorthands written the 3.0 way: a bare TEL;CELL as TYPE=CELL, ENCODING=BASE64 as b
function as30(p) {
	let params = p.params.map(x => x.key == 'ENCODING' && x.values.some(v => v.toUpperCase() == 'BASE64') ? {key: 'ENCODING', values: ['b']} : x);
	return parseLine(line(p.group, p.name, params, p.value));
}

function plainProps(props) {
	let decoded = false;
	let out = props.map(p => {
		if (! isQuotedPrintable(p))
			return p;
		decoded = true;
		let charset = (p.params.find(x => x.key == 'CHARSET') || {values: []}).values[0];
		let params = p.params.filter(x => x.key != 'ENCODING' && x.key != 'CHARSET')
			.map(x => x.key != 'TYPE' ? x : {key: 'TYPE', values: x.values.filter(v => v.toUpperCase() != 'QUOTED-PRINTABLE')})
			.filter(x => x.values.length > 0);
		return parseLine(line(p.group, p.name, params, plainValue(p, charset)));
	});
	let version = out.find(p => p.name == 'VERSION');
	if (! decoded || (version && version.value.trim() != '2.1'))
		return out;
	return out.map(p => p.name == 'VERSION' ? parseLine('VERSION:3.0') : as30(p));
}

function parseCards(text) {
	let result = [], current = null;
	for (let line of unfold(text)) {
		let upper = line.toUpperCase();
		if (upper == 'BEGIN:VCARD') {
			current = [];
		} else if (upper == 'END:VCARD') {
			if (current != null)
				result.push({props: plainProps(current)});
			current = null;
		} else if (current != null) {
			let prop = parseLine(line);
			if (prop != null)
				current.push(prop);
		}
	}
	// a card the file ends in the middle of, with no END:VCARD, is read as far as it goes
	if (current != null && current.length > 0)
		result.push({props: plainProps(current)});
	return result;
}

function unescapeText(s) {
	return s.replace(/\\([\\;,nN])/g, (m, c) => c == 'n' || c == 'N' ? '\n' : c);
}

function escapeText(s) {
	return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

function splitStructured(value) {
	let parts = [], current = '';
	for (let i = 0; i < value.length; i++) {
		if (value[i] == '\\' && i + 1 < value.length) { current += value[i] + value[i + 1]; i++; }
		else if (value[i] == ';') { parts.push(unescapeText(current)); current = ''; }
		else current += value[i];
	}
	parts.push(unescapeText(current));
	return parts;
}

function prop(card, name) {
	return card.props.find(p => p.name == name);
}

function props(card, name) {
	return card.props.filter(p => p.name == name);
}

function text(card, name) {
	let p = prop(card, name);
	return p == null ? '' : unescapeText(p.value);
}

function version(card) {
	return text(card, 'VERSION') == '4.0' ? '4.0' : '3.0';
}

function typesOf(p) {
	return p.params.filter(x => x.key == 'TYPE').flatMap(x => x.values).map(v => v.toLowerCase());
}

const TEL_TYPES = [['fax', 'Fax'], ['cell', 'Mobile'], ['work', 'Work'], ['home', 'Home'], ['other', 'Other']];
const TEL_ALIASES = {iphone: 'cell', mobile: 'cell'};
const PLACE_TYPES = [['home', 'Home'], ['work', 'Work'], ['other', 'Other']];

function kindOf(p, choices, aliases) {
	let types = typesOf(p).map(t => (aliases || {})[t] || t);
	for (let [key] of choices) {
		if (types.includes(key))
			return key;
	}
	return 'other';
}

function labelOf(kind, choices) {
	return (choices.find(c => c[0] == kind) || [kind, kind])[1];
}

function displayName(card) {
	let fn = text(card, 'FN').trim();
	if (fn) return fn;
	let n = prop(card, 'N');
	if (n) {
		let c = splitStructured(n.value);
		let composed = [c[3], c[1], c[2], c[0], c[4]].filter(x => x && x.trim()).join(' ');
		if (composed) return composed;
	}
	let org = prop(card, 'ORG');
	if (org && splitStructured(org.value)[0]) return splitStructured(org.value)[0];
	let email = prop(card, 'EMAIL');
	if (email) return email.value;
	let tel = prop(card, 'TEL');
	if (tel) return tel.value;
	return '(No name)';
}

function sortKey(card) {
	let n = prop(card, 'N');
	if (n) {
		let c = splitStructured(n.value);
		if (c[0] && c[0].trim()) return (c[0] + ' ' + (c[1] || '')).trim().toLowerCase();
	}
	return displayName(card).toLowerCase();
}

function photoUrl(card) {
	let p = prop(card, 'PHOTO');
	if (p == null) return null;
	if (p.value.startsWith('data:')) return p.value;
	let encoding = p.params.filter(x => x.key == 'ENCODING').flatMap(x => x.values).map(v => v.toLowerCase());
	if (encoding.includes('b') || encoding.includes('base64')) {
		let type = typesOf(p).find(t => t != 'pref') || 'jpeg';
		return 'data:image/' + (type.includes('/') ? type.split('/')[1] : type) + ';base64,' + p.value.replace(/\s/g, '');
	}
	return null;
}

function formatParams(params) {
	return params.map(x => ';' + x.key + '=' + x.values.map(v => /[:;,]/.test(v) ? '"' + v + '"' : v).join(',')).join('');
}

function line(group, name, params, value) {
	return (group ? group + '.' : '') + name + formatParams(params) + ':' + value;
}

// fold at 75 octets without splitting a UTF-8 sequence
function fold(l) {
	let out = [], current = '', bytes = 0;
	for (let c of l) {
		let code = c.codePointAt(0);
		let size = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
		if (bytes + size > (out.length == 0 ? 75 : 74)) {
			out.push(current);
			current = '';
			bytes = 0;
		}
		current += c;
		bytes += size;
	}
	out.push(current);
	return out.join('\r\n ');
}

function serialise(lines) {
	return ['BEGIN:VCARD'].concat(lines, ['END:VCARD']).map(fold).join('\r\n') + '\r\n';
}

function newUid() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

function revision() {
	return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

function toDateInput(value) {
	let m = value.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
	return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

// ------------------------------------------------------------------ form <-> card

function cardToForm(card) {
	let n = prop(card, 'N');
	let nc = n ? splitStructured(n.value) : [];
	let org = prop(card, 'ORG');
	let bday = prop(card, 'BDAY');
	// A card with only a formatted name - some exporters write no structured one - shows it in
	// the first name, rather than empty name fields that would have it typed in again before
	// it can be saved. Left as it is, its name is saved as it was, apart from the structured one
	// a vCard 3.0 card must have.
	let fn = text(card, 'FN').trim();
	let named = (nc[0] || '').trim() || (nc[1] || '').trim();
	let company = org ? splitStructured(org.value)[0] : '';
	return {
		family: nc[0] || '', given: nc[1] || (named || fn == company ? '' : fn),
		org: company,
		title: text(card, 'TITLE'),
		bday: bday ? toDateInput(bday.value) : '',
		bdayRaw: bday ? bday.value : '',
		note: text(card, 'NOTE'),
		tels: props(card, 'TEL').map(p => ({kind: kindOf(p, TEL_TYPES, TEL_ALIASES), value: p.value.replace(/^tel:/i, ''), orig: p})),
		emails: props(card, 'EMAIL').map(p => ({kind: kindOf(p, PLACE_TYPES), value: p.value, orig: p})),
		adrs: props(card, 'ADR').map(p => {
			let c = splitStructured(p.value);
			return {kind: kindOf(p, PLACE_TYPES), street: c[2] || '', city: c[3] || '', region: c[4] || '',
				code: c[5] || '', country: c[6] || '', orig: p};
		}),
		urls: props(card, 'URL').map(p => ({value: p.value, orig: p}))
	};
}

const MANAGED = ['VERSION', 'FN', 'N', 'ORG', 'TITLE', 'TEL', 'EMAIL', 'ADR', 'BDAY', 'URL', 'NOTE', 'REV'];

// rebuilds a multi-valued property, keeping its group and any parameters we do not manage
function typedLine(entry, name, kind, value, choices, ver, aliases) {
	// a kind left as it was keeps its types as they were: a work mobile whose number is changed
	// stays a work mobile, though the choices only know it as a mobile
	if (entry.orig && kindOf(entry.orig, choices, aliases) == kind)
		return line(entry.orig.group, name, entry.orig.params, value);
	let known = choices.map(c => c[0]).concat(Object.keys(TEL_ALIASES));
	let params = entry.orig ? entry.orig.params.map(x => x.key != 'TYPE' ? x :
			{key: 'TYPE', values: x.values.filter(v => !known.includes(v.toLowerCase()))})
			.filter(x => x.values.length > 0) : [];
	if (kind != 'other')
		params.push({key: 'TYPE', values: [ver == '4.0' ? kind : kind.toUpperCase()]});
	return line(entry.orig ? entry.orig.group : '', name, params, value);
}

// A phone stored as a tel: URI (vCard 4's VALUE=uri) is written back as one, which has no spaces.
function telValue(orig, number) {
	let uri = orig != null && (/^tel:/i.test(orig.value)
		|| orig.params.some(x => x.key == 'VALUE' && x.values.some(v => v.toLowerCase() == 'uri')));
	return uri ? 'tel:' + number.replace(/\s+/g, '-') : number;
}

function formToCard(form, card) {
	let ver = card ? version(card) : '3.0';
	let before = card ? cardToForm(card) : null;
	let lines = ['VERSION:' + ver];
	if (card == null) {
		lines.push('PRODID:-//Peergos//Address Book//EN');
		lines.push('UID:' + newUid());
	}
	if (card != null)
		card.props.filter(p => !MANAGED.includes(p.name)).forEach(p => lines.push(p.raw));
	// The form shows the first of each of these: any after it, a second note or the name in
	// another language, is kept as it was, after the first, which is the one other apps show.
	let rest = name => {
		if (card != null)
			props(card, name).slice(1).forEach(p => lines.push(p.raw));
	};

	let namesSame = before && before.given == form.given && before.family == form.family;
	let n = card && prop(card, 'N');
	let parts = n ? splitStructured(n.value) : [];
	while (parts.length < 5) parts.push('');
	if (namesSame && n) {
		lines.push(n.raw);
	} else if (n || ver == '3.0' || ! namesSame && (form.given.trim() || form.family.trim())) {
		parts[0] = form.family; parts[1] = form.given;
		lines.push(line(n ? n.group : '', 'N', n ? n.params : [], parts.map(escapeText).join(';')));
	}
	rest('N');
	let fn = card && prop(card, 'FN');
	if (namesSame && fn && fn.value.trim()) {
		lines.push(fn.raw);
	} else {
		// the whole name, with the parts of it the form doesn't show: Dr. John Q. Smith Jr.
		let name = [parts[3], form.given, parts[2], form.family, parts[4]].filter(x => x && x.trim()).join(' ') || form.org
			|| (form.emails[0] || {}).value || (form.tels[0] || {}).value || '';
		lines.push(line(fn ? fn.group : '', 'FN', [], escapeText(name)));
	}
	rest('FN');
	// A changed value keeps its group, which a label another app gave it hangs on, and its
	// parameters, such as its language.
	let single = (name, value, previous, build, keep) => {
		let p = card && prop(card, name);
		if (p && before && value == previous) lines.push(p.raw);
		else if (value.trim()) lines.push(line(p ? p.group : '', name, p ? p.params.filter(keep || (() => true)) : [], build(value)));
		rest(name);
	};
	// the departments after the company name stay with it when only the name is changed
	let units = card && prop(card, 'ORG') ? splitStructured(prop(card, 'ORG').value).slice(1) : [];
	single('ORG', form.org, before && before.org, v => [v].concat(units).map(escapeText).join(';'));
	single('TITLE', form.title, before && before.title, v => escapeText(v));
	// a birthday picked as a date is one now, whatever kind of value it was before
	single('BDAY', form.bday, before && before.bday, v => ver == '4.0' ? v.replace(/-/g, '') : v, x => x.key != 'VALUE');
	single('NOTE', form.note, before && before.note, v => escapeText(v));

	let clean = s => s.replace(/[\r\n]+/g, ' ').trim();
	form.tels.filter(t => clean(t.value)).forEach(t => {
		if (t.orig && t.orig.value.replace(/^tel:/i, '') == t.value && kindOf(t.orig, TEL_TYPES, TEL_ALIASES) == t.kind)
			lines.push(t.orig.raw);
		else
			lines.push(typedLine(t, 'TEL', t.kind, telValue(t.orig, clean(t.value)), TEL_TYPES, ver, TEL_ALIASES));
	});
	form.emails.filter(e => clean(e.value)).forEach(e => {
		if (e.orig && e.orig.value == e.value && kindOf(e.orig, PLACE_TYPES) == e.kind)
			lines.push(e.orig.raw);
		else
			lines.push(typedLine(e, 'EMAIL', e.kind, clean(e.value), PLACE_TYPES, ver));
	});
	form.adrs.filter(a => [a.street, a.city, a.region, a.code, a.country].some(x => x.trim())).forEach(a => {
		let c = a.orig ? splitStructured(a.orig.value) : [];
		while (c.length < 7) c.push('');
		let next = c.slice(0, 2).concat([a.street, a.city, a.region, a.code, a.country]);
		if (a.orig && next.join('\u0000') == c.slice(0, 7).join('\u0000') && kindOf(a.orig, PLACE_TYPES) == a.kind)
			lines.push(a.orig.raw);
		else
			lines.push(typedLine(a, 'ADR', a.kind, next.map(escapeText).join(';'), PLACE_TYPES, ver));
	});
	form.urls.filter(u => clean(u.value)).forEach(u => {
		lines.push(u.orig && u.orig.value == u.value ? u.orig.raw : line(u.orig ? u.orig.group : '', 'URL', u.orig ? u.orig.params : [], clean(u.value)));
	});
	lines.push('REV:' + revision());
	return serialise(lines);
}

// ------------------------------------------------------------------ host

// Peergos hosts this page on a subdomain of its own and keeps the address books, and asks the
// questions, for it: each request is posted to it and answered under the same id. Only the
// parent, at the address this page's own is a subdomain of, is listened to.
const hostOrigin = location.protocol + '//' + location.host.substring(location.host.indexOf('.') + 1);
const pendingRequests = new Map();
// from a random start, so an answer to the page this one replaced can't pass for one of its own
let nextRequestId = crypto.getRandomValues(new Uint32Array(1))[0];
let started = false;

function host(type, payload) {
	return new Promise((resolve, reject) => {
		let requestId = nextRequestId++;
		pendingRequests.set(requestId, {resolve: resolve, reject: reject});
		window.parent.postMessage(Object.assign({}, payload, {type: type, requestId: requestId}), hostOrigin);
	});
}

window.addEventListener('message', e => {
	if (e.origin !== hostOrigin || e.source !== window.parent || e.data == null || typeof e.data !== 'object')
		return;
	let data = e.data;
	if (data.type == 'ping' || data.type == 'setTheme') {
		applyTheme(data.currentTheme);
		if (data.type == 'ping' && ! started) {
			started = true;
			start();
		}
	} else if (data.type == 'answer') {
		let request = pendingRequests.get(data.requestId);
		if (request == null)
			return;
		pendingRequests.delete(data.requestId);
		if (data.error)
			request.reject(new Error('The request failed'));
		else
			request.resolve(data);
	}
});

async function loadBooks() {
	books = (await host('listBooks')).books;
	books.sort((a, b) => (a.id == DEFAULT_BOOK ? -1 : b.id == DEFAULT_BOOK ? 1 : a.name.localeCompare(b.name)));
}

async function loadCards(book) {
	let list = (await host('loadBook', {book: book})).cards;
	return list.map(c => {
		let parsed = parseCards(c.vcard);
		// text: the card exactly as read, which a save or a delete says it expects to find
		if (parsed.length > 0)
			return {file: c.file, card: parsed[0], text: c.vcard};
		// A file that isn't a vCard at all still shows, by its name, so it can be deleted
		// rather than lie there unseen.
		return {file: c.file, card: {props: [parseLine('FN:' + escapeText(c.file))]}, text: c.vcard, unreadable: true};
	});
}

function fileFor(card) {
	let uid = text(card, 'UID').replace(/^urn:uuid:/i, '');
	return (/^[A-Za-z0-9_\-@.]{1,200}$/.test(uid) && !uid.startsWith('.') ? uid : newUid()) + '.vcf';
}

// ------------------------------------------------------------------ actions

async function openBook(id) {
	currentBook = id;
	selectedFile = null;
	try { localStorage.setItem('addressbook.book', id); } catch (e) {}
	renderBooks();
	document.getElementById('contacts').innerHTML = '<li class="empty">Loading…</li>';
	renderDetail();
	let loaded = [], failed = false;
	try {
		loaded = await loadCards(id);
	} catch (e) {
		failed = true;
	}
	// a book opened since has taken this one's place, and these are not its contacts
	if (currentBook != id)
		return;
	cards = loaded;
	loadFailed = failed;
	renderBooks();
	renderContacts();
}

// the book read again, with a contact open in it if it is still there
async function reopen(book, file) {
	await openBook(book);
	if (currentBook == book && file != null && cards.some(c => c.file == file)) {
		selectedFile = file;
		renderContacts();
		renderDetail();
	}
}

function onBookSelect(value) {
	if (value == '__new__') {
		document.getElementById('bookSelect').value = currentBook;
		newBook();
	} else {
		openBook(value);
	}
}

async function newBook() {
	try {
		let answer = await host('newBook');
		if (answer.cancelled) return;
		await loadBooks();
		openBook(answer.book);
	} catch (e) {
		status('Could not create the address book');
	}
}

async function renameBook() {
	let book = books.find(b => b.id == currentBook);
	try {
		let answer = await host('renameBook', {book: currentBook, name: book ? book.name : ''});
		if (answer.cancelled) return;
		await loadBooks();
		renderBooks();
	} catch (e) {
		status('Could not rename the address book');
	}
}

async function deleteBook() {
	if (currentBook == DEFAULT_BOOK) return;
	let book = books.find(b => b.id == currentBook);
	try {
		let answer = await host('deleteBook', {book: currentBook, name: book ? book.name : currentBook});
		if (answer.cancelled) return;
		await loadBooks();
		openBook(DEFAULT_BOOK);
	} catch (e) {
		status('Could not delete the address book');
	}
}

function newContact() {
	selectedFile = null;
	renderContacts();
	renderForm(null);
}

function selectContact(file) {
	selectedFile = file;
	renderContacts();
	renderDetail();
}

// Work that waits on Peergos is done in the book it started in. Another book may be open by the
// time it finishes, and that book's list is left alone.
async function saveContact(form, entry) {
	let book = currentBook;
	let vcard = formToCard(form, entry ? entry.card : null);
	let file = entry ? entry.file : fileFor(parseCards(vcard)[0]);
	let answer;
	try {
		// Peergos asks before saving over a change made elsewhere since this was read
		answer = await host('saveCard', {book: book, file: file, vcard: vcard, expected: entry ? entry.text : null,
			ask: true, name: displayName(parseCards(vcard)[0])});
	} catch (e) {
		status('Could not save the contact');
		return;
	}
	if (answer.conflict) {
		status('Not saved. It had changed elsewhere, so it now shows that change');
		if (currentBook == book)
			await reopen(book, answer.current != null ? file : null);
		return;
	}
	if (currentBook != book) {
		status('Saved');
		return;
	}
	let updated = {file: file, card: parseCards(vcard)[0], text: vcard};
	cards = cards.filter(c => c.file != file).concat([updated]);
	selectedFile = file;
	renderBooks();
	renderContacts();
	renderDetail();
	status('Saved');
}

async function deleteContact(entry) {
	let book = currentBook;
	try {
		let answer = await host('deleteCard', {book: book, file: entry.file, name: displayName(entry.card), expected: entry.text});
		if (answer.cancelled) return;
		if (answer.conflict) {
			status('Not deleted. It had changed elsewhere, so it now shows that change');
			if (currentBook == book)
				await reopen(book, entry.file);
			return;
		}
	} catch (e) {
		status('Could not delete the contact');
		return;
	}
	if (currentBook != book)
		return;
	cards = cards.filter(c => c.file != entry.file);
	selectedFile = null;
	renderBooks();
	renderContacts();
	renderDetail();
}

// Puts a card in a book without replacing one there under the same name: the same card is left
// as it is, and a different one keeps its place while this one gets a UID, and a file, of its
// own. Says where the card went, and whether it was 'added', already 'there', or put 'beside'.
async function addCard(book, card) {
	let vcard = serialise(card.props.map(p => p.raw));
	let file = fileFor(card);
	let answer = await host('saveCard', {book: book, file: file, vcard: vcard, expected: null});
	if (! answer.conflict)
		return {file: file, card: card, text: vcard, how: 'added'};
	if (answer.current === vcard)
		return {file: file, card: card, text: vcard, how: 'there'};
	card.props = card.props.filter(p => p.name != 'UID').concat([parseLine('UID:' + newUid())]);
	vcard = serialise(card.props.map(p => p.raw));
	file = fileFor(card);
	if ((await host('saveCard', {book: book, file: file, vcard: vcard, expected: null})).conflict)
		throw new Error('No room for ' + file);
	return {file: file, card: card, text: vcard, how: 'beside'};
}

async function moveContact(entry, target) {
	let from = currentBook;
	let vcard = serialise(entry.card.props.map(p => p.raw));
	let moved, placed;
	try {
		// written before it is removed, so a failure part way leaves a copy rather than nothing
		placed = await addCard(target, parseCards(vcard)[0]);
		moved = await host('deleteCard', {book: from, file: entry.file, expected: entry.text});
	} catch (e) {
		status('Could not move the contact');
		return;
	}
	let book = books.find(b => b.id == target);
	if (moved.conflict) {
		// both are kept: the copy as it was read, and the original with the change made to it
		status('Copied to ' + (book ? book.name : target) + '. The original had changed elsewhere, so it was kept too');
		if (currentBook == from)
			await reopen(from, null);
		return;
	}
	status('Moved to ' + (book ? book.name : target) + (placed.how == 'beside' ? ', beside a different version of it there' : ''));
	if (currentBook == from) {
		cards = cards.filter(c => c.file != entry.file);
		selectedFile = null;
		renderContacts();
		renderDetail();
	} else if (currentBook == target) {
		// opened while the contact was on its way, so it may have been read without it
		openBook(target);
	}
}

async function importText(textContent) {
	let parsed = parseCards(textContent);
	if (parsed.length == 0) {
		status('No contacts found in that file');
		return;
	}
	let book = currentBook;
	// an import adds and never replaces: a contact imported again is already there, and one
	// changed since is kept beside the imported version rather than lost to it
	let count = {added: 0, there: 0, beside: 0, failed: 0};
	for (let card of parsed) {
		if (!prop(card, 'UID'))
			card.props.push(parseLine('UID:' + newUid()));
		if (!prop(card, 'VERSION'))
			card.props.unshift(parseLine('VERSION:3.0'));
		status('Importing ' + (count.added + count.there + count.beside + count.failed + 1) + ' of ' + parsed.length, true);
		try {
			let placed = await addCard(book, card);
			count[placed.how]++;
			if (currentBook == book && placed.how != 'there')
				cards = cards.filter(c => c.file != placed.file).concat([{file: placed.file, card: placed.card, text: placed.text}]);
		} catch (e) {
			count.failed++;
		}
	}
	if (currentBook == book) {
		renderBooks();
		renderContacts();
	}
	status('Imported ' + (count.added + count.beside)
		+ (count.there > 0 ? ', ' + count.there + ' already here' : '')
		+ (count.beside > 0 ? ', ' + count.beside + ' kept beside a different version' : '')
		+ (count.failed > 0 ? ', ' + count.failed + ' failed' : ''));
}

async function importFiles(input) {
	for (let f of input.files)
		await importText(await f.text());
	input.value = '';
}

// ------------------------------------------------------------------ rendering

function el(tag, attrs, children) {
	let e = document.createElement(tag);
	for (let [k, v] of Object.entries(attrs || {})) {
		if (k == 'text') e.textContent = v;
		else if (k.startsWith('on')) e[k] = v;
		else e.setAttribute(k, v);
	}
	(children || []).forEach(c => c && e.appendChild(c));
	return e;
}

function avatar(card, big) {
	let url = photoUrl(card);
	if (url)
		return el('img', {class: 'avatar' + (big ? ' big' : ''), src: url, alt: ''});
	let name = displayName(card);
	let initials = name.split(/\s+/).filter(x => x).slice(0, 2).map(x => x[0].toUpperCase()).join('');
	let hash = 0;
	for (let c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
	return el('div', {class: 'avatar' + (big ? ' big' : ''), text: initials || '?',
		style: 'background: hsl(' + (Math.abs(hash) % 360) + ', 45%, 50%)'});
}

// Each row is a button, so a book or a contact can be reached with Tab and opened with Enter or
// Space. A list is drawn again whenever anything in it changes, which would drop the focus a
// keyboard user had in it, so it goes to the open row instead.
function row(open, onclick, children) {
	return el('button', {type: 'button', class: 'list-row', 'aria-current': open ? 'true' : 'false', onclick: onclick}, children);
}

function keepFocus(list, draw) {
	let hadFocus = list.contains(document.activeElement);
	draw();
	let open = list.querySelector('.list-row[aria-current="true"]');
	if (hadFocus && open)
		open.focus();
}

function renderBooks() {
	let list = document.getElementById('bookList');
	let select = document.getElementById('bookSelect');
	select.innerHTML = '';
	keepFocus(list, () => {
		list.innerHTML = '';
		books.forEach(b => {
			list.appendChild(el('li', {}, [
				row(b.id == currentBook, () => openBook(b.id), [
					el('span', {text: b.name}),
					b.id == currentBook && ! loadFailed ? el('span', {class: 'count', text: String(cards.length)}) : null
				])
			]));
		});
	});
	books.forEach(b => select.appendChild(el('option', {value: b.id, text: b.name})));
	select.appendChild(el('option', {value: '__new__', text: '+ New address book'}));
	select.value = currentBook;
	let book = books.find(b => b.id == currentBook);
	document.getElementById('bookTitle').textContent = book ? book.name : '';
	document.getElementById('deleteBookButton').disabled = currentBook == DEFAULT_BOOK;
}

function matches(card, query) {
	if (!query) return true;
	let haystack = [displayName(card), text(card, 'ORG')]
		.concat(props(card, 'EMAIL').map(p => p.value), props(card, 'TEL').map(p => p.value))
		.join(' ').toLowerCase();
	return query.toLowerCase().split(/\s+/).every(q => haystack.includes(q));
}

function renderContacts() {
	let list = document.getElementById('contacts');
	keepFocus(list, () => drawContacts(list));
}

function drawContacts(list) {
	list.innerHTML = '';
	if (loadFailed) {
		list.appendChild(el('li', {class: 'empty'}, [
			el('p', {text: "Couldn't load this address book."}),
			el('button', {type: 'button', text: 'Try again', onclick: () => openBook(currentBook)})
		]));
		return;
	}
	let query = document.getElementById('search').value.trim();
	let shown = cards.filter(c => matches(c.card, query))
		.sort((a, b) => sortKey(a.card).localeCompare(sortKey(b.card)));
	if (shown.length == 0) {
		list.appendChild(el('li', {class: 'empty', text: cards.length == 0 ? 'No contacts yet' : 'No matches'}));
		return;
	}
	let letter = null;
	shown.forEach(c => {
		let first = (sortKey(c.card)[0] || '#').toUpperCase();
		if (!/\p{L}/u.test(first)) first = '#';
		if (first != letter) {
			letter = first;
			list.appendChild(el('li', {class: 'letter', text: letter}));
		}
		let sub = c.unreadable ? "Can't be read" : text(c.card, 'ORG') ? splitStructured(prop(c.card, 'ORG').value)[0]
			: (prop(c.card, 'EMAIL') || prop(c.card, 'TEL') || {value: ''}).value;
		list.appendChild(el('li', {class: 'card'}, [
			row(c.file == selectedFile, () => selectContact(c.file), [
				avatar(c.card, false),
				el('div', {class: 'names'}, [el('div', {text: displayName(c.card)}), el('div', {class: 'sub', text: sub})])
			])
		]));
	});
}

function showDetailPane(show) {
	document.getElementById('app').classList.toggle('show-detail', show);
}

function backButton() {
	return el('button', {class: 'back', text: '‹ Back', onclick: () => { selectedFile = null; renderContacts(); renderDetail(); }});
}

function renderDetail() {
	let pane = document.getElementById('detail');
	pane.innerHTML = '';
	let entry = cards.find(c => c.file == selectedFile);
	if (entry == null) {
		showDetailPane(false);
		pane.appendChild(el('div', {class: 'empty', text: cards.length > 0 ? 'Select a contact' : ''}));
		return;
	}
	showDetailPane(true);
	if (entry.unreadable) {
		pane.appendChild(el('div', {class: 'detail'}, [
			backButton(),
			el('h1', {text: entry.file}),
			el('p', {text: "This file can't be read as a contact. Here is how it starts:"}),
			el('pre', {class: 'unreadable', text: entry.text.substring(0, 400)}),
			el('div', {class: 'actions'}, [el('button', {class: 'danger', text: 'Delete', onclick: () => deleteContact(entry)})])
		]));
		return;
	}
	let card = entry.card;
	let form = cardToForm(card);
	let fields = [];
	let add = (label, value) => { if (value && value.trim()) fields.push(el('div', {class: 'field'}, [
		el('div', {class: 'label', text: label}), el('div', {class: 'value', text: value})])); };
	form.tels.forEach(t => add(labelOf(t.kind, TEL_TYPES) + ' phone', t.value));
	form.emails.forEach(e => add(labelOf(e.kind, PLACE_TYPES) + ' email', e.value));
	form.adrs.forEach(a => add(labelOf(a.kind, PLACE_TYPES) + ' address',
		[a.street, [a.city, a.region, a.code].filter(x => x.trim()).join(' '), a.country].filter(x => x.trim()).join('\n')));
	form.urls.forEach(u => add('Website', u.value));
	add('Birthday', form.bday ? new Date(form.bday + 'T00:00:00').toLocaleDateString() : form.bdayRaw);
	add('Note', form.note);

	let others = books.filter(b => b.id != currentBook);
	let move = others.length == 0 ? null : el('select', {onchange: e => { if (e.target.value) moveContact(entry, e.target.value); }},
		[el('option', {value: '', text: 'Move to…'})].concat(others.map(b => el('option', {value: b.id, text: b.name}))));

	pane.appendChild(el('div', {class: 'detail'}, [
		backButton(),
		el('div', {class: 'detail-head'}, [
			avatar(card, true),
			el('div', {}, [
				el('h1', {text: displayName(card)}),
				el('div', {class: 'sub', text: [form.title, form.org].filter(x => x).join(', ')})
			])
		]),
		el('div', {class: 'actions'}, [
			el('button', {class: 'primary', text: 'Edit', onclick: () => renderForm(entry)}),
			move,
			el('button', {class: 'danger', text: 'Delete', onclick: () => deleteContact(entry)})
		]),
		el('div', {}, fields)
	]));
}

function kindSelect(choices, value, onchange) {
	let s = el('select', {onchange: e => onchange(e.target.value)},
		choices.map(c => el('option', {value: c[0], text: c[1]})));
	s.value = value;
	return s;
}

function renderForm(entry) {
	showDetailPane(true);
	let pane = document.getElementById('detail');
	pane.innerHTML = '';
	let form = entry ? cardToForm(entry.card) : {family: '', given: '', org: '', title: '', bday: '', bdayRaw: '', note: '',
		tels: [{kind: 'cell', value: ''}], emails: [{kind: 'home', value: ''}], adrs: [], urls: []};

	let input = (obj, key, placeholder, type) => el('input', {type: type || 'text', placeholder: placeholder, value: obj[key],
		oninput: e => obj[key] = e.target.value});
	let remove = (list, item) => el('button', {class: 'link', type: 'button', text: '✕', title: 'Remove',
		onclick: () => { list.splice(list.indexOf(item), 1); draw(); }});

	let body = el('div');
	let draw = () => {
		body.innerHTML = '';
		body.appendChild(el('h3', {text: 'Name'}));
		body.appendChild(el('div', {class: 'row'}, [input(form, 'given', 'First name'), input(form, 'family', 'Last name')]));
		body.appendChild(el('div', {class: 'row'}, [input(form, 'org', 'Company'), input(form, 'title', 'Job title')]));

		body.appendChild(el('h3', {text: 'Phone'}));
		form.tels.forEach(t => body.appendChild(el('div', {class: 'row'}, [
			kindSelect(TEL_TYPES, t.kind, v => t.kind = v), input(t, 'value', 'Phone', 'tel'), remove(form.tels, t)])));
		body.appendChild(el('button', {type: 'button', class: 'link', text: '+ Add phone',
			onclick: () => { form.tels.push({kind: 'cell', value: ''}); draw(); }}));

		body.appendChild(el('h3', {text: 'Email'}));
		form.emails.forEach(m => body.appendChild(el('div', {class: 'row'}, [
			kindSelect(PLACE_TYPES, m.kind, v => m.kind = v), input(m, 'value', 'Email', 'email'), remove(form.emails, m)])));
		body.appendChild(el('button', {type: 'button', class: 'link', text: '+ Add email',
			onclick: () => { form.emails.push({kind: 'home', value: ''}); draw(); }}));

		body.appendChild(el('h3', {text: 'Address'}));
		form.adrs.forEach(a => body.appendChild(el('div', {class: 'row address'}, [
			kindSelect(PLACE_TYPES, a.kind, v => a.kind = v),
			el('div', {class: 'adr'}, [
				Object.assign(input(a, 'street', 'Street'), {className: 'wide'}),
				input(a, 'city', 'City'), input(a, 'region', 'State / region'),
				input(a, 'code', 'Postcode'), input(a, 'country', 'Country')]),
			remove(form.adrs, a)])));
		body.appendChild(el('button', {type: 'button', class: 'link', text: '+ Add address',
			onclick: () => { form.adrs.push({kind: 'home', street: '', city: '', region: '', code: '', country: ''}); draw(); }}));

		body.appendChild(el('h3', {text: 'Website'}));
		form.urls.forEach(u => body.appendChild(el('div', {class: 'row'}, [input(u, 'value', 'https://', 'url'), remove(form.urls, u)])));
		body.appendChild(el('button', {type: 'button', class: 'link', text: '+ Add website',
			onclick: () => { form.urls.push({value: ''}); draw(); }}));

		body.appendChild(el('h3', {text: 'Other'}));
		body.appendChild(el('div', {class: 'row'}, [el('label', {text: 'Birthday'}), input(form, 'bday', '', 'date')]));
		let note = el('textarea', {rows: '4', placeholder: 'Note', oninput: e => form.note = e.target.value});
		note.value = form.note;
		body.appendChild(el('div', {class: 'row'}, [note]));
	};
	draw();

	let cancel = () => entry ? renderDetail() : (selectedFile = null, renderDetail());
	// One save at a time: a second click, or Enter, while the first is on its way would save a new
	// contact twice, as two contacts.
	let save = el('button', {class: 'primary', type: 'submit', text: 'Save'});
	let element = el('form', {class: 'detail', onsubmit: e => {
		e.preventDefault();
		if (save.disabled)
			return;
		let empty = !form.given.trim() && !form.family.trim() && !form.org.trim()
			&& !form.tels.some(t => t.value.trim()) && !form.emails.some(m => m.value.trim());
		if (empty) {
			status('Add a name, company, phone or email');
			return;
		}
		save.disabled = true;
		save.textContent = 'Saving…';
		saveContact(form, entry).finally(() => {
			save.disabled = false;
			save.textContent = 'Save';
		});
	}}, [
		el('h1', {text: entry ? 'Edit contact' : 'New contact'}),
		body,
		el('div', {class: 'actions', style: 'margin-top: 24px'}, [
			save,
			el('button', {type: 'button', text: 'Cancel', onclick: cancel})
		])
	]);
	pane.appendChild(element);
	let first = element.querySelector('input');
	if (first) first.focus();
}

let statusTimer = null;
function status(message, sticky) {
	let s = document.getElementById('status');
	s.textContent = message;
	s.style.display = 'block';
	clearTimeout(statusTimer);
	if (!sticky)
		statusTimer = setTimeout(() => s.style.display = 'none', 3000);
}

// ------------------------------------------------------------------ start

function applyTheme(theme) {
	document.documentElement.setAttribute('data-theme', theme == 'dark-mode' ? 'dark' : 'light');
}

async function start() {
	try {
		await loadBooks();
	} catch (e) {
		document.getElementById('contacts').innerHTML = '';
		document.getElementById('contacts').appendChild(el('li', {class: 'empty', text: 'Could not reach your contacts'}));
		return;
	}
	let remembered = null;
	try { remembered = localStorage.getItem('addressbook.book'); } catch (e) {}
	await openBook(books.some(b => b.id == remembered) ? remembered : DEFAULT_BOOK);
}

document.getElementById('newBookButton').addEventListener('click', () => newBook());
document.getElementById('bookSelect').addEventListener('change', e => onBookSelect(e.target.value));
document.getElementById('renameBookButton').addEventListener('click', () => renameBook());
document.getElementById('deleteBookButton').addEventListener('click', () => deleteBook());
document.getElementById('newContactButton').addEventListener('click', () => newContact());
document.getElementById('importButton').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e => importFiles(e.target));
document.getElementById('search').addEventListener('input', () => renderContacts());

// the theme the page was opened in, until the host's first ping, which starts it
applyTheme(new URL(window.location.href).searchParams.get('theme'));
window.parent.postMessage({type: 'hello'}, hostOrigin);
