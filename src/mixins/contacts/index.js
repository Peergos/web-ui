// Address books, stored the way the CardDAV bridge (ContactStore) serves them, so a change made
// here reaches synced phones and clients:
//   <user>/.apps/contacts/data/<book>/addressbook.inf  {"name"}
//   <user>/.apps/contacts/data/<book>/<uid>.vcf
// App.config is left alone; the bridge only reads it, and nothing writes it yet.
// Used by Address Book's own view, and by the contacts API that apps with MANAGE_CONTACTS get.
module.exports = {
    data: function() {
        return {
            DEFAULT_ADDRESS_BOOK: 'default',
            contactsApp: null,
        };
    },
    methods: {
        contactsCall: function(future) {
            return new Promise((resolve, reject) => {
                future.thenApply(res => resolve(res)).exceptionally(t => {
                    reject(t);
                    return null;
                });
            });
        },
        getContactsApp: async function() {
            if (this.contactsApp == null) {
                this.contactsApp = await this.contactsCall(peergos.shared.user.App.init(this.context, "contacts"));
            }
            return this.contactsApp;
        },
        contactsPath: function(parts) {
            return peergos.client.PathUtils.directoryToPath(parts);
        },
        // a new address book's folder name; getRandomValues rather than randomUUID, which older
        // webviews lack
        newAddressBookId: function() {
            return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
        },
        isValidContactsSegment: function(name) {
            return name.length > 0 && name.length <= 255 && !name.includes('/') && !name.includes('\\') && !name.startsWith('.');
        },
        listAddressBooks: async function() {
            let dataPath = this.context.username + '/.apps/contacts/data';
            let dirOpt = await this.contactsCall(this.context.getByPath(dataPath));
            let books = [];
            if (dirOpt.ref != null) {
                let children = (await this.contactsCall(dirOpt.get().getChildren(this.context.crypto.hasher, this.context.network))).toArray();
                for (const child of children.filter(c => c.isDirectory())) {
                    books.push({id: child.getName(), name: await this.readAddressBookName(child.getName())});
                }
            }
            if (books.filter(b => b.id == this.DEFAULT_ADDRESS_BOOK).length == 0) {
                // the bridge serves this one even before it exists on disk
                books.push({id: this.DEFAULT_ADDRESS_BOOK, name: "Contacts"});
            }
            return books;
        },
        readAddressBookName: async function(book) {
            let app = await this.getContactsApp();
            try {
                let data = await this.contactsCall(app.readInternal(this.contactsPath([book, 'addressbook.inf']), null));
                let json = JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
                return typeof json.name == 'string' ? json.name : book;
            } catch (e) {
                return book == this.DEFAULT_ADDRESS_BOOK ? "Contacts" : book;
            }
        },
        writeAddressBookName: async function(book, name) {
            let app = await this.getContactsApp();
            let bytes = convertToByteArray(new TextEncoder().encode(JSON.stringify({name: name})));
            await this.contactsCall(app.writeInternal(this.contactsPath([book, 'addressbook.inf']), bytes, null));
        },
        addressBookExists: async function(book) {
            let app = await this.getContactsApp();
            return await this.contactsCall(app.existsInternal(this.contactsPath([book]), null)) == 1;
        },
        // every card in a book, as text, with the name of the file it is in
        listContactCards: async function(book) {
            let app = await this.getContactsApp();
            let names = (await this.contactsCall(app.dirInternal(this.contactsPath([book]), null))).toArray();
            return await Promise.all(names.filter(n => n.endsWith('.vcf')).map(async n => {
                let bytes = await this.contactsCall(app.readInternal(this.contactsPath([book, n]), null));
                return {file: n, vcard: new TextDecoder().decode(new Uint8Array(bytes))};
            }));
        },
        // the card as stored now, or null if there is none
        readContactCard: async function(book, file) {
            let app = await this.getContactsApp();
            let path = this.contactsPath([book, file]);
            if (await this.contactsCall(app.existsInternal(path, null)) != 0)
                return null;
            return new TextDecoder().decode(new Uint8Array(await this.contactsCall(app.readInternal(path, null))));
        },
        writeContactCard: async function(book, file, vcard) {
            let app = await this.getContactsApp();
            let bytes = convertToByteArray(new TextEncoder().encode(vcard));
            await this.contactsCall(app.writeInternal(this.contactsPath([book, file]), bytes, null));
        },
        deleteContactCard: async function(book, file) {
            let app = await this.getContactsApp();
            await this.contactsCall(app.deleteInternal(this.contactsPath([book, file]), null));
        },
        deleteAddressBook: async function(book) {
            let app = await this.getContactsApp();
            await this.contactsCall(app.deleteInternal(this.contactsPath([book]), null));
        },
    },
};
