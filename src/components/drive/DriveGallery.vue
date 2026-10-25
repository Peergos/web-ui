<template>
	<div class="pg-gallery__mask" @click="close">
		<section class="pg-gallery" role="dialog" aria-modal="true" :aria-label="currentName.length > 0 ? currentName : 'Gallery'" @click.stop>
			<header class="pg-gallery__bar">
				<template v-if="! hideGalleryTitle && currentName.length > 0">
					<span v-if="showableFiles.length > 1" class="pg-gallery__count">{{ fileIndex + 1 }} / {{ showableFiles.length }}</span>
					<h2 class="pg-gallery__title">{{ currentName }}</h2>
				</template>
				<span v-else class="pg-gallery__spacer"></span>
				<DialogClose @close="close"/>
			</header>
			<Spinner v-if="showSpinner"></Spinner>
            <Warning
                v-if="showWarning"
                v-on:hide-warning="hideWarning"
                :warning_message='warning_message'
                :warning_body="warning_body"
                :consumer_func="warning_consumer_func">
            </Warning>
            <div id="slideshow-container" class="pg-gallery__stage">
            	<div id="slideshow-wrapper-id" class="slideshow-wrapper">
            	</div>
            	<template v-if="showableFiles != null && showableFiles.length > 1">
            		<!-- the gallery does not wrap round: at either end the way on is shown, and closed -->
            		<button id="slideshow-prev" type="button" class="pg-gallery__arrow pg-gallery__arrow--prev" aria-label="Previous"
            		        :disabled="fileIndex === 0" @click="previous">
            			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            		</button>
            		<button id="slideshow-next" type="button" class="pg-gallery__arrow pg-gallery__arrow--next" aria-label="Next"
            		        :disabled="fileIndex === showableFiles.length - 1" @click="next">
            			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
            		</button>
            	</template>
            	<!-- playing through a folder of music: shuffle, and repeat all or the one track -->
            	<div v-if="currentIsAudio" class="pg-gallery__audio-modes">
            		<button type="button" :class="['pg-gallery__mode', shuffle ? 'pg-gallery__mode--on' : '']" :aria-pressed="shuffle ? 'true' : 'false'"
            		        :title="translate('GALLERY.SHUFFLE')" :aria-label="translate('GALLERY.SHUFFLE')" @click="toggleShuffle">
            			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>
            		</button>
            		<button type="button" :class="['pg-gallery__mode', repeat != 'off' ? 'pg-gallery__mode--on' : '']" :aria-pressed="repeat != 'off' ? 'true' : 'false'"
            		        :title="repeatLabel" :aria-label="repeatLabel" @click="cycleRepeat">
            			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
            			<span v-if="repeat == 'one'" class="pg-gallery__mode-badge">1</span>
            		</button>
            	</div>
            </div>
		</section>
	</div>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");
const Warning = require('../Warning.vue');
const downloaderMixins = require("../../mixins/downloader/index.js");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    DialogClose,
    	Spinner,
	    Warning,
	},
	data() {
	    return {
                cache:{},
		    showSpinner: false,
		    fileIndex: 0,
		    pinging: false,
		    shuffle: false,
		    repeat: 'off',
            showWarning: false,
		    warning_message: "",
		    warning_body: "",
		    warning_consumer_func: () => {}
		};
	},
	props: ["files", "initialFileName", "hideGalleryTitle"],
	mixins: [downloaderMixins, i18n],
	computed: {
		...Vuex.mapState([
			'context',
		]),
		showableFiles() {
			if (this.files == null) return null;
			var that = this;
			return this.files.filter(function (file) {
				var is_image = that.isImage(file);
				var is_video = that.isVideo(file);
				var is_audio = that.isAudio(file);
				return is_image || is_video || is_audio;
			});
		},
        currentIsAudio() {
            let file = this.showableFiles == null ? null : this.showableFiles[this.fileIndex];
            return file != null && this.isAudio(file);
        },
        repeatLabel() {
            return this.translate(this.repeat == 'one' ? 'GALLERY.REPEAT.ONE' : this.repeat == 'all' ? 'GALLERY.REPEAT.ALL' : 'GALLERY.REPEAT.OFF');
        },
        currentName() {
            let showable = this.showableFiles;
            let file = showable == null ? null : showable[this.fileIndex];
            return file == null ? '' : file.getFileProperties().name;
        },
	},
	created() {
	    var showable = this.showableFiles;
	    for (var i = 0; i < showable.length; i++) {
		    if (showable[i].getFileProperties().name == this.initialFileName) {
		        this.fileIndex = i;
		        break;
		    }
        }
	    console.log("Set initial gallery index to " + this.fileIndex);
	    // the tracks shuffle has played; not reactive, it only decides what comes next
	    this.playedAudio = new Set();
	    this.currentAudio = null;
	    try {
	        let modes = JSON.parse(localStorage.getItem("gallery-audio-modes"));
	        if (modes != null) {
	            this.shuffle = modes.shuffle === true;
	            this.repeat = ['off', 'all', 'one'].includes(modes.repeat) ? modes.repeat : 'off';
	        }
	    } catch (e) {}
	    window.addEventListener("keyup", this.keyup);
	},
	mounted() {
        let that = this;
        if (this.showableFiles.length == 0) {
            this.close();
        }
        let currentFile =  this.showableFiles[this.fileIndex];
        this.confirmView(currentFile, () => {
            that.showWarning = false;
            that.update();
        })
	},
	// however it goes - its x, Escape, or the browser's back button, which closes it without a
	// word to it - the keys and the streaming ping go with it
	beforeUnmount() {
	    window.removeEventListener("keyup", this.keyup);
	    this.pinging = false;
	},
	methods: {
		close() {
            this.showWarning = false;
		    this.$emit("hide-gallery");
		},

		hideWarning() {
            this.showWarning = false;
		},

		keyup(e) {
    		e.preventDefault();
			if (e.key === "ArrowLeft") this.previous();
			else if (e.key === "ArrowRight") this.next();
            else if (e.key === "ArrowUp") this.start();
            else if (e.key === "ArrowDown") this.end();
		},

		start() {
		    if (this.fileIndex != 0) {
	    		this.fileIndex = 0;
    			this.update();
			}
		},

		end() {
			if (this.fileIndex != this.showableFiles.length - 1) {
                this.fileIndex = this.showableFiles.length - 1;
    			this.update();
            }
		},

		startPing(pingUrl) {
			if (!this.pinging) return;
			this.sendPingRequest(pingUrl);
			setTimeout(() => this.startPing(pingUrl), 5000);
		},
		sendPingRequest(url) {
            var req = new XMLHttpRequest();
            req.open('GET', url);
            req.onload = function() {
                if (!req.status == 200) {
                    console.log('sendPingRequest-status-!200. status:' + req.status);
                }
            };
            req.onerror = function(e) {
                console.log('sendPingRequest-onerror. error:' + e.toString());
            };
            req.send();
        },
		next() {
            if (this.fileIndex < this.showableFiles.length - 1) {
				this.fileIndex++;
			    this.update();
			}
		},

		toggleShuffle() {
		    this.shuffle = !this.shuffle;
		    this.playedAudio = new Set();
		    this.saveAudioModes();
		},
		cycleRepeat() {
		    this.repeat = this.repeat == 'off' ? 'all' : this.repeat == 'all' ? 'one' : 'off';
		    if (this.currentAudio != null)
		        this.currentAudio.loop = this.repeat == 'one';
		    this.saveAudioModes();
		},
		saveAudioModes() {
		    try {
		        localStorage.setItem("gallery-audio-modes", JSON.stringify({shuffle: this.shuffle, repeat: this.repeat}));
		    } catch (e) {}
		},
		// the next track to play: in order, or one not yet played when shuffling; at the end only when repeating all
		nextAudio() {
		    let tracks = [];
		    this.showableFiles.forEach((f, i) => {
		        if (this.isAudio(f))
		            tracks.push(i);
		    });
		    if (tracks.length == 0)
		        return;
		    var target = -1;
		    if (this.shuffle) {
		        this.playedAudio.add(this.fileIndex);
		        var left = tracks.filter(i => !this.playedAudio.has(i));
		        if (left.length == 0 && this.repeat == 'all') {
		            this.playedAudio = new Set([this.fileIndex]);
		            left = tracks.length > 1 ? tracks.filter(i => i != this.fileIndex) : tracks;
		        }
		        if (left.length > 0)
		            target = left[Math.floor(Math.random() * left.length)];
		    } else {
		        let later = tracks.filter(i => i > this.fileIndex);
		        if (later.length > 0)
		            target = later[0];
		        else if (this.repeat == 'all')
		            target = tracks[0];
		    }
		    if (target < 0)
		        return;
		    if (target == this.fileIndex && this.currentAudio != null) {
		        this.currentAudio.currentTime = 0;
		        this.currentAudio.play();
		        return;
		    }
		    this.fileIndex = target;
		    this.update();
		},

		previous() {
			if (this.fileIndex > 0) {
                this.fileIndex--;
    			this.update();
            }
		},
		confirmView(file, viewFn) {
			let size = this.getFileSize(file.getFileProperties());
			if (this.supportsVideoStreaming() || size < 50 * 1024 * 1024)
				return viewFn();
			let sizeMb = (size / 1024 / 1024) | 0;
			this.warning_message = 'Are you sure you want to view ' + file.getName() + " of size " + sizeMb + 'MiB?';
			if (this.detectFirefoxWritableSteams()) {
				this.warning_body = "Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
			} else {
				this.warning_body = "We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
			}
			this.warning_consumer_func = viewFn;
			this.showWarning = true;
		},
        addMediaHandlers(mediaElement, file) {
            let that = this;
            if ('mediaSession' in navigator) {
                let thumbnail = file.getBase64Thumbnail();
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: file.getFileProperties().name,
                    artwork: [{ src: thumbnail}]
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    mediaElement.pause();
                });
                navigator.mediaSession.setActionHandler('play', () => {
                    mediaElement.play();
                });
                let defaultSeekOffset = 10;
                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    mediaElement.currentTime = mediaElement.currentTime - (details.seekOffset || defaultSeekOffset);
                });
                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    mediaElement.currentTime = mediaElement.currentTime + (details.seekOffset || defaultSeekOffset);
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    that.previous();
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    if (that.isAudio(file))
                        that.nextAudio();
                    else
                        that.next();
                });
            }
        },
        updateMediaElement(index, url) {
            let that = this;
            let file = this.showableFiles[index];
            this.$nextTick(function () {
                let wrapper = document.getElementById("slideshow-wrapper-id");
                wrapper.innerText = '';
                wrapper.style.overflow = '';
                if(that.isVideo(file)) {
                    wrapper.style.backgroundImage = '';
                    let vid = document.createElement('video');
                    vid.setAttribute('autoplay','true');
                    vid.setAttribute('controls','true');
                    vid.setAttribute('controlsList','nodownload');
                    vid.setAttribute('src', url);
                    wrapper.appendChild(vid);
                    that.addMediaHandlers(vid, file);
                } else if(that.isAudio(file)) {
                    wrapper.style.backgroundImage = '';
                    let audio = document.createElement('audio');
                    audio.setAttribute('autoplay','true');
                    audio.setAttribute('controls','true');
                    audio.setAttribute('controlsList','nodownload');
                    audio.setAttribute('src', url);
                    audio.loop = that.repeat == 'one';
                    audio.addEventListener('ended', () => that.nextAudio());
                    that.currentAudio = audio;
                    wrapper.appendChild(audio);
                    that.addMediaHandlers(audio, file);
                } else {
                    wrapper.innerText = '';
                    let img = new Image();
                    img.src = url;
                    img.classList.add("image-display");
                    let isZoomed = false;
                    function updateZoomCursor() {
                        if (!img.naturalWidth) return;
                        let scale = Math.min(wrapper.clientWidth / img.naturalWidth, wrapper.clientHeight / img.naturalHeight);
                        img.style.cursor = scale < 1 ? 'zoom-in' : '';
                    }
                    img.addEventListener('load', updateZoomCursor);
                    updateZoomCursor();
                    img.addEventListener('click', function(e) {
                        let cW = wrapper.clientWidth;
                        let cH = wrapper.clientHeight;
                        let iW = img.naturalWidth;
                        let iH = img.naturalHeight;
                        if (!isZoomed) {
                            let scale = Math.min(cW / iW, cH / iH);
                            if (scale >= 1) return;
                            let rect = wrapper.getBoundingClientRect();
                            let cx = e.clientX - rect.left;
                            let cy = e.clientY - rect.top;
                            let paddingLeft = (cW - iW * scale) / 2;
                            let paddingTop = (cH - iH * scale) / 2;
                            let natX = Math.max(0, Math.min(iW, (cx - paddingLeft) / scale));
                            let natY = Math.max(0, Math.min(iH, (cy - paddingTop) / scale));
                            isZoomed = true;
                            img.classList.remove('image-display');
                            img.classList.add('image-display-zoomed');
                            wrapper.style.overflow = 'auto';
                            img.style.cursor = 'zoom-out';
                            // Force layout so image is at natural size before reading offsetWidth
                            void img.offsetWidth;
                            // If the image is narrower/shorter than the viewport, center it
                            // with margins so it doesn't sit at the top-left corner
                            let marginLeft = Math.max(0, (cW - iW) / 2);
                            let marginTop  = Math.max(0, (cH - iH) / 2);
                            img.style.marginLeft = marginLeft + 'px';
                            img.style.marginTop  = marginTop  + 'px';
                            // When margin > 0 the image fits in that axis so scroll
                            // clamps to 0 anyway; margin handles centering in that case.
                            wrapper.scrollLeft = marginLeft + natX - cW / 2;
                            wrapper.scrollTop  = marginTop  + natY - cH / 2;
                        } else {
                            isZoomed = false;
                            img.classList.remove('image-display-zoomed');
                            img.classList.add('image-display');
                            img.style.marginLeft = '';
                            img.style.marginTop  = '';
                            wrapper.style.overflow = '';
                            updateZoomCursor();
                        }
                    });
                    wrapper.appendChild(img);
                }
            });
        },
        update() {
            let index = this.fileIndex;
            if (this.cache[index] != null) {
                this.updateMediaElement(index, this.cache[index]);
                this.prefetch(index + 1);
                return;
            }
			let file = this.showableFiles[this.fileIndex];
			if (file.isDirectory()) return;
			let props = file.getFileProperties();
			let that = this;
			this.showSpinner = true;

			let isLargeAudioFile =
				that.isAudio(file) && that.getFileSize(props) > 1024 * 1024 * 5;
			if (
				that.supportsVideoStreaming() &&
				(that.isVideo(file) || isLargeAudioFile)
			) {
				let size = that.getFileSize(props);
				function Context(file, network, crypto, sizeHigh, sizeLow) {
					this.maxBlockSize = 1024 * 1024 * 5;
					this.writer = null;
					this.file = file;
					this.network = network;
					this.crypto = crypto;
					(this.sizeHigh = sizeHigh), (this.sizeLow = sizeLow);
					this.readerFuture = null;
					// reads the viewer skipped past, so we stop filling them
					this.cancelled = new Set();
					this.cancel = function (uuid) {
						this.cancelled.add(uuid);
					};
					this.stream = function (seekHi, seekLo, length, uuid) {
						let work = function (thatRef, header) {
							var currentSize = length;
							var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize: currentSize;
							let pump = function (reader) {
								if (thatRef.cancelled.has(uuid)) {
									thatRef.cancelled.delete(uuid);
									var cancelled = peergos.shared.util.Futures.incomplete();
									cancelled.complete(true);
									return cancelled;
								}
								if (blockSize > 0) {
                                    let bytes = new Uint8Array(blockSize + header.byteLength);
                                    for(var i=0;i < header.byteLength;i++){
                                        bytes[i] = header[i];
                                    }
                                    let data = convertToByteArray(bytes);
									return reader
										.readIntoArray(data, header.byteLength, blockSize)
										.thenApply(function (read) {
											currentSize = currentSize - read.value_0;
											blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize
													: currentSize;
											thatRef.writer.write(data);
											return pump(reader);
										});
								} else {
									var future = peergos.shared.util.Futures.incomplete();
									future.complete(true);
									return future;
								}
							};
							var update = thatRef.readerFuture != null ? thatRef.readerFuture
									: file.getBufferedInputStream(network, crypto, sizeHigh, sizeLow, 10,
											function (read) {});
							update.thenCompose(function (reader) {
								return reader
									.seekJS(seekHi, seekLo)
									.thenApply(function (seekReader) {
										var readerFuture = peergos.shared.util.Futures.incomplete();
										readerFuture.complete(seekReader);
										thatRef.readerFuture = readerFuture;
										return pump(seekReader);
									});
							});
						};
						return work(this, buildHeader(uuid));
					};
				}
				const context = new Context(file, this.context.network, this.context.crypto, props.sizeHigh(),
					props.sizeLow());
				console.log("streaming data of length " + size);
				let fileStream = streamSaver.createWriteStream("media-" + props.name, props.mimeType,
					function (url) {
					    that.updateMediaElement(index, url);
						that.showSpinner = false;
						that.pinging = true;
						that.startPing(url + "/ping");
					},
					function (seekHi, seekLo, seekLength, uuid) {
						context.stream(seekHi, seekLo, seekLength, uuid);
					},
					undefined, size);
				context.writer = fileStream.getWriter();
			} else {
				file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(),
					function (read) {}
				).thenCompose(function (reader) {
					let size = that.getFileSize(props);
					let data = convertToByteArray(new Int8Array(size));
					return reader.readIntoArray(data, 0, data.length)
						.thenApply(function (read) {
                            let type = file.getFileProperties().mimeType;
                            let blob = new Blob([data], { type: type });
                            let url = window.URL.createObjectURL(blob);
    						that.updateMediaElement(index, url);
							that.showSpinner = false;
						    console.log("Finished retrieving media of size " + data.length);
                            that.prefetch(index + 1);
						});
				});
			}
		},
		buildHeader(uuid) {
            let encoder = new TextEncoder();
            let uuidBytes = encoder.encode(uuid);
            let uuidSize = uuidBytes.byteLength;
            let headerSize = 1 + uuidSize;
            let data = new Uint8Array(headerSize);
            var offset = 0;
            data.set([uuidSize], offset);
            offset = offset + 1;
            data.set(uuidBytes, offset);
            return data;
                },
            prefetch(index) {
                if (this.cache[index] != null)
                    return;
                if (index >= this.showableFiles.length)
                    return;
                if (index - 10 > 0) // keep cache small
                    this.cache[index-10] = null;
                let file = this.showableFiles[index];
		if (file.isDirectory()) return;
		let props = file.getFileProperties();
                // only prefetch small files
                if (this.getFileSize(props) > 10 * 1024 * 1024)
                    return
                let that = this;
                file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(),
				    function (read) {}
				   ).thenCompose(function (reader) {
				       let size = that.getFileSize(props);
				       let data = convertToByteArray(new Int8Array(size));
				       return reader.readIntoArray(data, 0, data.length)
					   .thenApply(function (read) {
                                               let type = file.getFileProperties().mimeType;
                                               let blob = new Blob([data], { type: type });
                                               let url = window.URL.createObjectURL(blob);
    					       that.cache[index] = url;
					   });
				   });
            },
		isImage(file) {
			if (file == null) return false;
			let mimeType = file.getFileProperties().mimeType;
			return mimeType.startsWith("image");
		},
		isVideo(file) {
			if (file == null) return false;
			let mimeType = file.getFileProperties().mimeType;
			return mimeType.startsWith("video");
		},
		isAudio(file) {
			if (file == null) return false;
			let mimeType = file.getFileProperties().mimeType;
			return mimeType.startsWith("audio");
		},
	}
};
</script>

<style>
/* A dark stage the picture fills, with its controls round the edges. Solid: a photo is judged
   against what surrounds it, and the drive showing through would be part of that. */
.pg-gallery__mask {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  background-color: #0b1116;
  overscroll-behavior: contain;
}
.pg-gallery {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  color: #ffffff;
}
.pg-gallery:focus {
  outline: none;
}
.pg-gallery__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-height: 64px;
  padding: 0 12px 0 20px;
}
.pg-gallery__count {
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background-color: rgba(255, 255, 255, .14);
  font-size: 13px;
  font-weight: var(--bold);
}
.pg-gallery__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  border: 0;
  font-size: 15px;
  font-weight: var(--bold);
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pg-gallery__spacer {
  flex: 1 1 auto;
}
.pg-gallery .pg-dialog__close {
  width: 44px;
  height: 44px;
  margin-top: 0;
  color: #ffffff;
  background-color: rgba(255, 255, 255, .1);
}
.pg-gallery__stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}
.pg-gallery__arrow {
  position: absolute;
  top: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-top: -24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, .14);
  color: #ffffff;
  cursor: pointer;
}
.pg-gallery__arrow svg {
  width: 22px;
  height: 22px;
}
.pg-gallery__arrow--prev {
  left: 24px;
}
.pg-gallery__arrow--next {
  right: 24px;
}
.pg-gallery__arrow:disabled {
  opacity: .35;
  cursor: default;
}
.pg-gallery__arrow:focus-visible {
  outline: 2px solid var(--green-200);
  outline-offset: 2px;
}
@media (hover: hover) {
  .pg-gallery .pg-dialog__close:hover,
  .pg-gallery__arrow:not(:disabled):hover {
    color: #ffffff;
    background-color: rgba(255, 255, 255, .24);
  }
}

/* the picture keeps clear of the arrows either side of it */
.slideshow-wrapper {
  position: absolute;
  inset: 0 96px 24px;
  background-position: center;
  background-size: contain;
  background-repeat: no-repeat;
}

@media (max-width: 600px) {
  .pg-gallery__bar {
    gap: 8px;
    min-height: 60px;
    padding: 0 6px 0 16px;
  }
  /* on a phone the arrows go under the picture, where a thumb reaches them */
  .slideshow-wrapper {
    inset: 0 0 76px;
  }
  .pg-gallery__arrow {
    top: auto;
    bottom: 14px;
    margin-top: 0;
  }
  .pg-gallery__arrow--prev {
    left: 16px;
  }
  .pg-gallery__arrow--next {
    right: 16px;
  }
  /* between the arrows, where a thumb reaches them */
  .pg-gallery__audio-modes {
    bottom: 16px;
  }
}

.slideshow-wrapper video,
.slideshow-wrapper audio {
  object-fit: contain;
  width:100%;
  height:100%;
  z-index: 20;
}
/* shuffle and repeat, under the player */
.pg-gallery__audio-modes {
  position: absolute;
  left: 50%;
  bottom: 84px;
  z-index: 30;
  display: flex;
  gap: 12px;
  transform: translateX(-50%);
}
.pg-gallery__mode {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, .14);
  color: rgba(255, 255, 255, .6);
  cursor: pointer;
}
.pg-gallery__mode svg {
  width: 22px;
  height: 22px;
}
.pg-gallery__mode:hover {
  background-color: rgba(255, 255, 255, .24);
}
.pg-gallery__mode--on {
  color: #ffffff;
  background-color: rgba(255, 255, 255, .3);
}
.pg-gallery__mode-badge {
  position: absolute;
  top: 6px;
  right: 7px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
.image-display {
  object-fit: contain;
  width:100%;
  height:100%;
  z-index: 20;
}
.image-display-zoomed {
  display: block;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  z-index: 20;
}
</style>
