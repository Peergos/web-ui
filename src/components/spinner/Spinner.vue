<template>
<div style="width:100%; left:0; top:0; z-index:100;" >
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
        };
    },
    props: ['message','absolutePosition'],
    created: function() {
        var that = this;
        this.isPositionAbsolute = this.absolutePosition != null && this.absolutePosition === true;
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
.spinner-absolute-position {
  height:100%;
  position:absolute;
}
.spinner-fixed-position {
    height:100vh;
    position:fixed;
}
</style>