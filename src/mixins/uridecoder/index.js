module.exports = {
    methods: {
        uriDecode: function(urlencoded) {
            let jsErrorBody = urlencoded.split("\\+").join("%20")
                .split("\\%21").join("!")
                .split("\\%27").join("'")
                .split("\\%28").join("(")
                .split("\\%29").join(")")
                .split("\\%7E").join("~")
                .split("+").join("%20");

            let str = decodeURIComponent(jsErrorBody);
            let token = 'java.lang.JsException: ';
            return str.startsWith(token) ? str.substring(token.length) : str;
        }
    }
}
