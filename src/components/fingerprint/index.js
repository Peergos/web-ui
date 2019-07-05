module.exports = {
    template: require('fingerprint.html'),
    data: function() {
        return {
        };
    },
    props: ['fingerprint', 'friendname', 'context'],
    created: function() {
        console.debug('Fingerprint module created!');
    },

    methods: {
        close: function() {
            this.$emit("hide-fingerprint");
        },

	scanQRCode: function() {
	    
	}
    },
    computed: {
        QRCodeURL: function() {
            return this.fingerprint.getBase64Thumbnail();
        },

	safetyNumber: function() {
	    var res = this.fingerprint.getDisplayString();
	    var split = [];
	    for (var i=0; i < res.length; i += 5)
		split.push(res.substring(i, i + 5))
            return split.join(" ");
        },
    }
};
