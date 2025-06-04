<template>
	<div class="gallery-mask" @click="close">
		<div class="gallery-container gallery" @click.stop @keyup.right="next" @keyup.left="previous">
			<div tabindex="0" @click="close" v-on:keyup.enter="close" aria-label="close" class="slideshow-close"><span style="font-family:'Cambria Math'">&times;</span></div>
			<Spinner v-if="showSpinner"></Spinner>
            <Warning
                v-if="showWarning"
                v-on:hide-warning="hideWarning"
                :warning_message='warning_message'
                :warning_body="warning_body"
                :consumer_func="warning_consumer_func">
            </Warning>
            <div id="slideshow-container">
            	<div id="slideshow-info-id" :class="{ 'hidden-info': isInfoHidden, 'slideshow-info': true }"></div>
            	<button id="slideshow-next" @click="next" style="cursor:pointer"><span >&gt;</span></button>
            	<button id="slideshow-prev" @click="previous" style="cursor:pointer"><span >&lt;</span></button>
            	<div id="slideshow-wrapper-id" class="slideshow-wrapper">
            	</div>
            </div>
		</div>
	</div>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const Warning = require('../Warning.vue');
const downloaderMixins = require("../../mixins/downloader/index.js");

module.exports = {
	components: {
    	Spinner,
	    Warning,
	},
	data() {
	    return {
                cache:{},
		    showSpinner: false,
		    fileIndex: 0,
		    pinging: false,
            showWarning: false,
		    warning_message: "",
		    warning_body: "",
		    warning_consumer_func: () => {}
		};
	},
	props: ["files", "initialFileName", "hideGalleryTitle"],
	mixins: [downloaderMixins],
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
        isInfoHidden() {
            return this.hideGalleryTitle;
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
	methods: {
		showGalleryTitle() {
			if (!this.hideGalleryTitle) {
			    let index = this.showableFiles.length > 1 ? (this.fileIndex + 1) + "/" + this.showableFiles.length + ' ' : '';
				let text =  index + this.showableFiles[this.fileIndex].getFileProperties().name;
				let infoElement = document.getElementById("slideshow-info-id");
				infoElement.innerText = text;
			}
		},
		close() {
            window.removeEventListener("keyup", this.keyup);
		    this.pinging = false;
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
                    that.next();
                });
            }
        },
        updateMediaElement(index, url) {
            let that = this;
            this.showGalleryTitle();
            let file = this.showableFiles[index];
            this.$nextTick(function () {
                let next = document.getElementById("slideshow-next");
                let prev = document.getElementById("slideshow-prev");
                if (index === 0) {
                    prev.classList.add('hidden');
                } else {
                    prev.classList.remove('hidden');
                }
                if (index === this.showableFiles.length - 1) {
                    next.classList.add('hidden');
                } else {
                    next.classList.remove('hidden');
                }
                let wrapper = document.getElementById("slideshow-wrapper-id");
                wrapper.innerText = '';
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
                    wrapper.appendChild(audio);
                    that.addMediaHandlers(audio, file);
                } else {
                    wrapper.innerText = '';
                    let img = new Image();
                    img.src = url;
                    img.classList.add("image-display");
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
					this.stream = function (seekHi, seekLo, length, uuid) {
						let work = function (thatRef, header) {
							var currentSize = length;
							var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize: currentSize;
							let pump = function (reader) {
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
                if (index > this.showableFiles.length)
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

<style> /* inspired from https://github.com/codepo8/slide-show */
.hidden-info {
  display: none;
}
.gallery-mask {
  position: fixed;
  z-index: 2500;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, .5);
  transition: opacity .3s ease;
}
.gallery-container {
    height:100%;
    margin: 0px auto;
	color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
    /* font-family: Helvetica, Arial, sans-serif; */
}
.gallery {
    color: var(--color);
    background-color: var(--bg);
}

.slideshow-info {
  position: absolute;
  padding: 5px 10px;
  background: rgba(0,0,0,.8);
  color: #fff;
}

.slideshow-close {
  position: absolute;
  right: 10px;
  text-align: right;
  font-size: xx-large;
  cursor: pointer;
  z-index: 20;
}
.slideshow-close span {
  display: block;
}

.slideshow-wrapper {
  height:100vh;
  background-position: center;
  background-size: contain;
  background-repeat: no-repeat;
}
.slideshow-wrapper video, audio {
  object-fit: contain;
  width:100%;
  height:100%;
  z-index: 20;
}
.image-display {
  object-fit: contain;
  width:100%;
  height:100%;
  z-index: 20;
}
#slideshow-next {
  position: absolute;
  background: rgba(0, 0, 0, 0);
  border: none;
  z-index: 10;
  border-radius: 50%;
  border-style: solid;
  top: calc(50vh);
  height: 40px;
  width: 40px;
  margin-right: 5px;
}
#slideshow-prev {
  position: absolute;
  background: rgba(0, 0, 0, 0);
  border: none;
  z-index: 10;
  border-radius: 50%;
  border-style: solid;
  top: calc(50vh);
  height: 40px;
  width: 40px;
  margin-left: 5px;
}
#slideshow-next.hidden, #slideshow-prev.hidden {
  display: none;
}
#slideshow-next {
  right: 0;
}
</style>
