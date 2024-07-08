<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-modal')">
            <div style="height:30%"></div>
            <div class="modal-container" @click.stop>
                
                <div class="modal-header">
                    <h3 id="modal-header-id">{{ title }}</h3>
                </div>
                
                <div class="modal-body">
                    <div class="container"><p style="word-wrap;break-all;">
                            <div style="font-size: 1.2em;">
                                <div style="padding: 10px;">
                                    <input v-model="password">
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
