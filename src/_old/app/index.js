var isLocalhost = window.location.hostname == "localhost";
module.exports = {
    template: require('app.html'),
    data: function() {
        return {
            view:"",
            network: null,
	    isSecretLink: false,
            token: "",
            showError:false,
            errorTitle:'',
            errorBody:'',
	    data: {
                context: null
            }
        };
    },
    props: [],
    created: function() {
        this.updateNetwork();
    },
    watch: {
	network: function(newNetwork) {
	    this.isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
            this.isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification);
            var that = this;
            const href = window.location.href;
            var fragment = window.location.hash.substring(1);
	    var props = {};
	    try {
		props = fragmentToProps(fragment);
	    } catch (e) {
		if (fragment.length > 0) {
		    // support legacy secret links
		    props.secretLink = true;

		    var query = fragment.indexOf("?");
		    if (query > 0) {
			if (fragment.indexOf("download=true") > 0)
			    props.download = true;
			if (fragment.indexOf("open=true") > 0)
			    props.open = true;
			fragment = fragment.substring(0, query);
		    }
		    props.link = fragment;
		}
	    }
            if (href.includes("?signup=true")) {
		if (href.includes("token=")) {
		    var urlParams = new URLSearchParams(window.location.search);
		    this.token = urlParams.get("token");
		}
		this.signup({token:this.token, username:''});
            } else if (props.secretLink) {
		// this is a secret link
		console.log("Navigating to secret link...");
                this.gotoSecretLink(props);
            } else
		this.login();
	    this.checkIfDomainNeedsUnblocking();
	}
    },
    methods: {
        login: function(data) {
	    this.view = "login"
	    this.data = data;
	},
	signup: function(data) {
	    this.view = "signup"
	    this.data = data;
	},
        filesystem: function(data) {
	    this.view = "filesystem"
	    this.data = data;
	},
        updateNetwork: function() {
	    var that = this;
	    peergos.shared.NetworkAccess.buildJS("QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF", !isLocalhost)
                .thenApply(function(network){
		    that.network = network;
		});
	},
        checkIfDomainNeedsUnblocking: function() {
	    if (this.network == null)
		return;
	    var that = this;
	    this.network.otherDomain().thenApply(function(domainOpt) {
		if (domainOpt.isPresent()) {
		    var req = new XMLHttpRequest();
		    var url = domainOpt.get() + "notablock";
		    req.open('GET', url);
		    req.responseType = 'arraybuffer';
		    req.onload = function() {
			console.log("S3 test returned: " + req.status)
		    };
    
		    req.onerror = function(e) {
			that.errorTitle = "Unblock domain";
			that.errorBody = "Please unblock the following domain for Peergos to function correctly: " + domainOpt.get();
			that.showError = true;
		    };
		    
		    req.send();
		}
	    });
	},
        gotoSecretLink: function(props) {
            var that = this;
            this.isSecretLink = true;
            peergos.shared.user.UserContext.fromSecretLink(props.link, this.network, that.crypto).thenApply(function(context) {
                that.data = {
                    context: context,
                    download: props.download,
                    open: props.open,
		    initPath: props.path
		}
                that.view = "filesystem";
                that.isSecretLink = false;
            }).exceptionally(function(throwable) {
                that.errorTitle = 'Secret link not found!'
                that.errorBody = 'Url copy/paste error?'
                that.showSpinner = false;
                that.showError = true;
            });
        },

    },
    computed: {
        crypto: function() {
            return peergos.shared.Crypto.initJS();
        }
    }
};
