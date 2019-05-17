var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
    template: require('login.html'),
    data: function() {
        return {
            username: [],
            password: [],
            demo: isDemo,
            isFirefox: false,
            isSafari: false,
            showSpinner: false,
            showError:false,
            errorTitle:'',
            errorBody:'',
            spinnerMessage:'',
	    isPublicLink: false
        };
    },
    props: {

    },
    created: function() {
        console.debug('Login module created!');
        this.isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        this.isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || safari.pushNotification);
        var that = this;
        var href = window.location.href;
	
        const fragment = href.includes("#") ? href.substring(href.indexOf("#") + 1) : "";
	if (href.includes("?signup=true"))
	    this.showSignup();
	else if (fragment.length > 0) {
            // this is a public link
	    this.isPublicLink = true;
	    console.log("Navigating to public link...");
            Vue.nextTick(function() {
                that.gotoPublicLink(fragment);
            });
        } else
            Vue.nextTick(function() {
                document.getElementById("username").focus();
            });
    },
    methods: {
        displayDemoWarning: function() {
            if (this.demo == true) {
                if(this.isPublicLink == true) {
                    return false;
                }
                return true;
            } else {
                return false;
            }
        },
        gotoPublicLink: function(link) {
            var that = this;
            var query = link.indexOf("?");
            var download = false;
            var open = false;
            if (query > 0) {
                if (link.indexOf("download=true") > 0)
                    download = true;
                if (link.indexOf("open=true") > 0)
                    open = true;
                link = link.substring(0, query);
            }
            var that = this;
            peergos.shared.NetworkAccess.buildJS("QmXZXGXsNhxh2LiWFsa7CLHeRWJS5wb8RHxcTvQhvCzAeu")
                .thenApply(function(network){
                    peergos.shared.user.UserContext.fromPublicLink(link, network, that.crypto).thenApply(function(context) {
                        that.$dispatch('child-msg', {
                            view:'filesystem', 
                            props:{
                                context: context,
                                download: download,
                                open: open
                            }
                        });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Public link not found!'
                        that.errorBody = 'Url copy/paste error?'
                        that.showSpinner = false;
                        that.showError = true;

                    });
                });
        },

        login : function() {
            const creationStart = Date.now();
            const that = this;
            this.showSpinner = true;
            return peergos.shared.user.UserContext.signIn(
                    that.username, that.password, that.network, that.crypto, {"accept" : x => that.spinnerMessage = x}).thenApply(function(context) {
                that.$dispatch('child-msg', {
                    view:'filesystem',
                    props:{
                        context: context
                    }
                })
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                        console.log('Error logging in: '+throwable);
                        var msg = throwable.getMessage();
                        that.errorTitle = 'Error logging-in'
                        that.errorBody = throwable.getMessage();
                        that.showSpinner = false;
                        that.showError = true;
                    });
        },

        showSignup : function() {
            this.$dispatch('child-msg', {view:"signup", props:{
                username:this.username,
                password:this.password,
                crypto: this.crypto,
                network: this.network
            }})
        }
    },
    computed: {
        crypto: function() {
            return peergos.shared.Crypto.initJS();
        }
    },
    asyncComputed: {
        network: function() {
            return new Promise(function(resolve, reject) {
                peergos.shared.NetworkAccess.buildJS("QmXZXGXsNhxh2LiWFsa7CLHeRWJS5wb8RHxcTvQhvCzAeu")
                    .thenApply(function(network){resolve(network)});
            });
        }
    }
};
