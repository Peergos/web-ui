<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div style="height:10%"></div>
    <div class="modal-container" @click.stop style="height:90%;overflow-y:auto">

        <div class="modal-header">
            <h2>Admin Panel</h2>
        </div>

        <div class="modal-body">
            <Spinner v-if="showSpinner"></Spinner>
            <div>
                <h3>Pending space requests</h3>
                <table class="table table-responsive table-striped table-hover">
                    <tr v-if="data.pending.length>0"><th>Username</th><th>Requested size (MiB)</th><th></th><th></th></tr>
                    <tr v-if="data.pending.length>0" v-for="req in data.pending">
                        <td>{{ req.getUsername() }}</td>
                        <td>{{ req.getSizeInMiB() }}</td>
                        <td style="text-align:right">
                            <button class="btn btn-info" @click="approve(req)">Approve</button>
                        </td>
                        <td style="text-align:right">
                            <button class="btn btn-danger" @click="reject(req)">Deny</button>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
</div>
</transition>
</template>
<script>
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
	components: {
	    Spinner
	},
    data: function() {
        return {
            showSpinner: false
        }
    },
    props: ['data', 'context'],
    created: function() {
    },
    methods: {
        showMessage: function(body) {
            this.$toast(body);
        },
        approve: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.approveSpaceRequest(req)
                .thenApply(function(success) {
		    that.showSpinner = false;
                    that.showMessage("User: " + req.getUsername() + ". Space request approved!");
                    that.$emit("recalc-admin");
                });
        },

        reject: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.rejectSpaceRequest(req)
                .thenApply(function(success) {
                    that.showMessage("User: " + req.getUsername() + ". Space request rejected!");
                    that.showSpinner = false;
                    that.$emit("recalc-admin");
                });
        },

        close: function () {
            this.$emit("hide-admin");
        }
    }
}
</script>
<style>
</style>