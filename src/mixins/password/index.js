import bip39 from 'bip-0039-english.js';
export default {
    data() {
		return {
			"bip39": bip39
		}
    },
    methods: {
        generatePassword: function() {
            var bytes = nacl.randomBytes(16);
            var wordIndices = [];
            for (var i=0; i < 7; i++)
            wordIndices[i] = bytes[2*i]*8 + (bytes[2*i + 1] & 7);
            var password = wordIndices.map(j => this.bip39[j]).join("-");
            // this.passwordFieldType = "text";
            this.password = password;
        }
    }
};
