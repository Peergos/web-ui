<template>
<div class="pg-spinner" style="width:100%; left:0; top:0;" :hidden="!due">
    <div id="spinner" style="width:100%; height:100%; ">
        <div v-if="isMessageSet()" class="spinner-text">{{ message }}</div>
    </div>
</div>
</template>

<script>
module.exports = {
    data: function() {
        return {
            isPositionAbsolute: false,
            due: true,
            dueTimer: null,
        };
    },
    // since: when the wait began, if it is to show only once the wait has lasted 400 ms - a shorter
    // one needs none, and a spinner that comes and goes at once only flashes
    props: ['message','absolutePosition', 'since'],
    created: function() {
        var that = this;
        this.isPositionAbsolute = this.absolutePosition != null && this.absolutePosition === true;
        let wait = this.since == null ? 0 : this.since + 400 - Date.now();
        if (wait > 0) {
            this.due = false;
            this.dueTimer = setTimeout(() => that.due = true, wait);
        }
        Vue.nextTick(function() {
            let spinnerElement = document.getElementById("spinner");
            if (that.isPositionAbsolute) {
                spinnerElement.classList.add("spinner-absolute-position");
            } else {
                spinnerElement.classList.add("spinner-fixed-position");
            }
            that.spinner.spin(spinnerElement);
        });
    },
    beforeUnmount: function() {
        clearTimeout(this.dueTimer);
    },
    methods: {
        isMessageSet: function () {
            return this.message != null && this.message.length > 0;
        }
    },
    computed: {
        spinner: function() {
            var opts = {
                lines: 13, // The number of lines to draw
                length: 28, // The length of each line
                width: 14, // The line thickness
                radius: 42, // The radius of the inner circle
                scale: 1.0, // Scales overall size of the spinner
                corners: 1, // Corner roundness (0..1)
                color: '#337ab7', // #rgb or #rrggbb or array of colors
                opacity: 0.25, // Opacity of the lines
                rotate: 0, // The rotation offset
                animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
                fadeColor: 'transparent', // CSS color or array of colors
                direction: 1, // 1: clockwise, -1: counterclockwise
                speed: 1, // Rounds per second
                trail: 60, // Afterglow percentage
                fps: 20, // Frames per second when using setTimeout() as a fallback for CSS
                zIndex: 2e9, // The z-index (defaults to 2000000000)
                className: 'spinner', // The CSS class to assign to the spinner
                top: '50%', // Top position relative to parent
                left: '50%', // Left position relative to parent
                shadow: false, // Whether to render a shadow
                hwaccel: true, // Whether to use hardware acceleration
                position: 'absolute', // Element positioning
            };
            return new Spin.Spinner(opts);
        }
    }
};
</script>
<style>
/* above every overlay the app can raise: a spinner that says the view is busy is no use
   behind the thing it is describing */
.spinner-absolute-position,
.spinner-fixed-position {
    z-index: 10000;
}

.spinner-absolute-position {
  height:100%;
  position:absolute;
}

/* a wait the page under it stays usable through, which can be long on a connection that hangs */
.pg-spinner--passive {
    pointer-events: none;
}

/* anchored, not just fixed: a fixed box with no offset starts at wherever it
   flowed, so the spinner drew below the middle of the page - or off it */
.spinner-fixed-position {
    top:0;
    left:0;
    width:100%;
    height:100vh;
    position:fixed;
}
</style>