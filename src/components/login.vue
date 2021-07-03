<template>
<div class="container form-signin">
    <spinner v-if="showSpinner" :message="spinnerMessage"></spinner>
    <div class="alert alert-danger" v-if="displayDemoWarning()">
      <strong>WARNING:</strong>This is a demo server and all data will be occasionally cleared.
      <br/>
      <br/>
      If you want to create a <i>permanent</i> account,
      <br/>
      please go to our <a href="https://alpha.peergos.net?signup=true">alpha network</a>
    </div>

	<!-- <h2>Peergos</h2> -->
	<AppIcon icon="logo-full" class="sprite-test"/>

	<div>
        <h4>Please log in</h4>

        <div class="form-group flex-container">
            <input type="text" name="username" id="username" class="form-control flex-grow" style="text-transform: lowercase;" v-model="username" placeholder="Username">
        </div>
        <div class="form-group flex-row">
          <input :type="passwordFieldType" name="password" class="password form-control flex-grow" v-model="password" placeholder="Password" v-on:keyup.enter="login()">
	  <div v-bind:class="['fa', 'password' == passwordFieldType ? 'fa-eye password-eye' : 'fa-eye-slash password-eye-slash']" @click="togglePassword()"></div>
        </div>
        <button @click="login()" class="btn btn-large btn-block btn-success">Login</button>
        <center>
            <h4><i>or</i></h4>
        </center>
        <div>
            <button @click="showSignup()" class="btn btn-large btn-block btn-primary">Sign Up</button>
        </div>
    </div>
    <error
        v-if="showError"
        v-on:hide-error="showError = false"
        :title="errorTitle"
        :body="errorBody">
    </error>
</div>
</template>

<script>
var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
    data() {
        return {
            username: "",
            passwordFieldType: "password",
            password: [],
	   		token: "",
            demo: isDemo,
            showSpinner: false,
            showError:false,
            errorTitle:'',
            errorBody:'',
            spinnerMessage:''
        };
    },
    props: ["network"],
    created: function() {
        Vue.nextTick(function() {
            document.getElementById("username").focus();
	});
    },
    methods: {
	togglePassword: function() {
            this.passwordFieldType = this.passwordFieldType == "text" ? "password" : "text";
        },

        lowercaseUsername: function() {
            return this.username.toLocaleLowerCase();
        },

        displayDemoWarning: function() {
	    if (this.demo == true) {
                if(this.isSecretLink == true) {
                    return false;
                }
                return true;
            } else {
                return false;
            }
        },

        login : function() {
            const creationStart = Date.now();
            const that = this;
            this.showSpinner = true;
            return peergos.shared.user.UserContext.signIn(
                    that.lowercaseUsername(), that.password, that.network, that.crypto, {"accept" : x => that.spinnerMessage = x}).thenApply(function(context) {
                that.$emit("filesystem", {context: context})
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
            this.$emit("signup", {
                username:this.lowercaseUsername(),
                password1:this.password,
                crypto: this.crypto,
                network: this.network,
		token: this.token
            })
        }
    },
    computed: {
        crypto: function() {
            return peergos.shared.Crypto.initJS();
        }
    }
};
</script>
<style>
.form-signin .sprite-test{
	display: block;
	width:200px;
	height: 48px;
	margin: var(--app-margin) auto;
}

.modal:nth-of-type(even) {
        z-index: 1040 !important;
}
.modal-backdrop.in:nth-of-type(even) {
    z-index: 1042 !important;
}

.form-change-password {
        max-width: 330px;
        padding: 15px;
        margin: 0 auto;
}

.form-signin {
        max-width: 450px;
        padding: 15px;
        margin: 0 auto;
}



.form-signin input[type="email"] {
        margin-bottom: -1px;
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
}
.form-signin input[type="password"] {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
	display: inherit;
	width: auto;
}

.form-signin .form-control {
        position: relative;
        height: auto;
        -webkit-box-sizing: border-box;
        -moz-box-sizing: border-box;
        box-sizing: border-box;
        padding: 10px;
        font-size: 16px;
}

h2{
    text-align: center;
}
</style>