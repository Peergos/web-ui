<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-modal')">
            <div style="height:30%"></div>
            <div class="link-password-modal-container" @click.stop>
                
                <div class="modal-header">
                    <h3 id="modal-header-id">{{ title }}</h3>
                </div>
                
                <div class="modal-body">
                    <div class="container"><p style="word-wrap;break-all;">
                            <div style="font-size: 1.2em;">
                                <div style="padding: 10px;">
                                    <input v-model="password" v-on:keyup.enter="submit()">
                                </div>
                                <div style="padding: 10px;">
                                    <button
                                        id='modal-button-id'
                                        class="btn btn-success"
                                        @click="submit">
                                        {{ translate("DRIVE.LINK.OK") }}
                                    </button>
                                </div>
                        </p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <slot name="footer">
                    </slot>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
const i18n = require("../i18n/index.js");
    module.exports = {
	data() {
	    return {
                password:"",
            };
	},
        mixins:[i18n],
	props: [
	    "title",
	    "future",
        ],
        created: function() {
        },
        methods: {
            submit: function() {
                this.future.complete(this.password);
                this.$emit('hide-modal');
            }
        }
    }
</script>
<style>
.link-password-modal-container {
    width: 25%;
    margin: 0px auto;
    padding: 20px 30px;
	color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
    min-width: 400px;
}
</style>