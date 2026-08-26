// A tree can be wider than the dialog, and nothing about a scroll container says so until
// you try. This shades whichever edge still has content beyond it.
function update(el) {
    const more = el.scrollWidth - el.clientWidth - el.scrollLeft;
    el.classList.toggle("fp-scroll--left", el.scrollLeft > 1);
    el.classList.toggle("fp-scroll--right", more > 1);
}

module.exports = {
    methods: {
        watchScrollShadow(selector) {
            const el = this.$el.querySelector(selector);
            if (el == null)
                return;
            this.scrollShadowEl = el;
            this.scrollShadowHandler = () => update(el);
            el.addEventListener("scroll", this.scrollShadowHandler, { passive: true });
            window.addEventListener("resize", this.scrollShadowHandler);
            update(el);
        },
    },
    updated() {
        // rows appear as folders are opened, so the reach changes without a scroll
        if (this.scrollShadowEl != null)
            update(this.scrollShadowEl);
    },
    beforeDestroy() {
        if (this.scrollShadowEl != null) {
            this.scrollShadowEl.removeEventListener("scroll", this.scrollShadowHandler);
            window.removeEventListener("resize", this.scrollShadowHandler);
        }
    },
};
