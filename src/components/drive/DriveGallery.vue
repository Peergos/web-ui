<template>
	<div class="modal-mask" @click="close">
		<div
			class="modal-container full-height"
			@click.stop
			style="overflow-y: auto"
			@keyup.right="next"
			@keyup.left="previous"
		>
			<span
				@click="close"
				tabindex="0"
				v-on:keyup.enter="close"
				aria-label="close"
				class="close"
				>&times;</span
			>
			<spinner v-if="showSpinner"></spinner>
			<center>
				<h2 v-if="current != null">{{ showGalleryTitle(current) }}</h2>
			</center>
			<center v-if="showableFiles.length > 1">
				<div class="btn-group" style="padding: 10px">
					<button
						@click="start()"
						class="btn btn-large center-block btn-primary"
					>
						First
					</button>
					<button
						@click="previous()"
						class="btn btn-large center-block btn-primary"
					>
						Previous
					</button>
					<button
						@click="next()"
						class="btn btn-large center-block btn-primary"
					>
						Next
					</button>
					<button
						@click="end()"
						class="btn btn-large center-block btn-primary"
					>
						Last
					</button>
				</div>
			</center>
			<center
				style="height: 75%"
				@keyup.right="next"
				@keyup.left="previous"
			>
				<img
					v-if="currentIsImage"
					style="
						height: 100%;
						max-width: 100%;
						max-height: 100%;
						text-align: center;
						line-height: 200px;
					"
					@click="next()"
					v-on:longpress="openMenu($event, current)"
					v-on:contextmenu="openMenu($event, current)"
					v-bind:src="dataURL"
					alt="Image loading..."
					@keyup.right="next"
					@keyup.left="previous"
				/>
				<video
					v-if="currentIsVideoOrAudio"
					style="
						height: 100%;
						max-width: 100%;
						max-height: 100%;
						text-align: center;
						line-height: 200px;
					"
					v-bind:src="dataURL"
					autoplay="true"
					alt="Video loading..."
					controls
				/>
			</center>
		</div>
	</div>
</template>

<script>
const downloaderMixins = require("../../mixins/downloader/index.js");

module.exports = {
	data() {
		return {
			showSpinner: false,
			fileIndex: 0,
			imageData: null,
			videoUrl: null,
			pinging: false,
		};
	},
	props: ["files", "initialFileName", "hideGalleryTitle"],
	mixins: [downloaderMixins],
	computed: {
		...Vuex.mapState([
			'context',
		]),
		current() {
			if (this.showableFiles == null || this.showableFiles.length == 0)
				return null;
			var file = this.showableFiles[this.fileIndex];
			return file;
		},
		dataURL() {
			console.log("Getting data url");

			if (this.videoUrl != null) {
				var url = this.videoUrl;
				this.videoUrl = null;
				return url;
			}
			if (this.imageData == null) {
				console.log("No URL for null imageData");
				return null;
			}
			var blob = new Blob([this.imageData], { type: "octet/stream" });
			var dataURL = window.URL.createObjectURL(blob);
			console.log("Setting data url to " + dataURL);
			return dataURL;
		},
		currentIsVideo() {
			return this.isVideo(this.current);
		},
		currentIsImage() {
			return this.isImage(this.current);
		},
		currentIsAudio() {
			return this.isAudio(this.current);
		},
		currentIsVideoOrAudio() {
			return this.isVideo(this.current) || this.isAudio(this.current);
		},
		showableFiles() {
			if (this.files == null) return null;
			var that = this;
			return this.files.filter(function (file) {
				var is_image = that.isImage(file);
				var is_video = that.isVideo(file);
				var is_audio = that.isAudio(file);
				// console.log(
				// 	"is_image " +
				// 		is_image +
				// 		", is_video " +
				// 		is_video +
				// 		", is_audio " +
				// 		is_audio
				// );
				return is_image || is_video || is_audio;
			});
		},
	},
	created() {
		console.debug("Gallery module created!");
		console.log('gallery files:', this.files)
		var showable = this.showableFiles;
		for (var i = 0; i < showable.length; i++)
			if (showable[i].getFileProperties().name == this.initialFileName)
				this.fileIndex = i;
		console.log("Set initial gallery index to " + this.fileIndex);
		window.addEventListener("keyup", this.keyup);
		this.updateCurrentFileData();
	},

	watch: {
		files(newFiles) {
			this.files = newFiles;
			this.updateCurrentFileData();
		},
	},

	methods: {
		showGalleryTitle(current) {
			if (this.hideGalleryTitle) {
				return "";
			} else {
				return current.getFileProperties().name;
			}
		},
		close() {
			this.pinging = false;
			this.$emit("hide-gallery");
		},

		keyup(e) {
			if (e.keyCode == 37) this.previous();
			else if (e.keyCode == 39) this.next();
		},

		start() {
			this.fileIndex = 0;
			this.updateCurrentFileData();
		},

		end() {
			if (this.showableFiles == null || this.showableFiles.length == 0)
				this.fileIndex = 0;
			else this.fileIndex = this.showableFiles.length - 1;
			this.updateCurrentFileData();
		},

		startPing(pingUrl) {
			if (!this.pinging) return;
			fetch(pingUrl);
			setTimeout(() => this.startPing(pingUrl), 5000);
		},

		next() {
			if (this.showableFiles == null || this.showableFiles.length == 0)
				this.fileIndex = 0;
			else if (this.fileIndex < this.showableFiles.length - 1)
				this.fileIndex++;
			this.updateCurrentFileData();
		},

		previous() {
			if (
				this.showableFiles == null ||
				this.showableFiles.length == 0 ||
				this.fileIndex == 0
			)
				this.fileIndex = 0;
			else this.fileIndex--;
			this.updateCurrentFileData();
		},
		updateCurrentFileData() {
			var file = this.current;
			if (file == null) {
				console.log("null file in gallery");
				return;
			}
			if (file.isDirectory()) return;
			var props = file.getFileProperties();
			var that = this;
			this.showSpinner = true;
			var isLargeAudioFile =
				that.isAudio(file) && that.getFileSize(props) > 1024 * 1024 * 5;
			if (
				that.supportsStreaming() &&
				(that.isVideo(file) || isLargeAudioFile)
			) {
				var size = that.getFileSize(props);
				function Context(file, network, crypto, sizeHigh, sizeLow) {
					this.maxBlockSize = 1024 * 1024 * 5;
					this.writer = null;
					this.file = file;
					this.network = network;
					this.crypto = crypto;
					(this.sizeHigh = sizeHigh), (this.sizeLow = sizeLow);
					this.counter = 0;
					this.readerFuture = null;
					this.stream = function (seekHi, seekLo, length) {
						this.counter++;
						var work = function (thatRef, currentCount) {
							var currentSize = length;
							var blockSize =
								currentSize > this.maxBlockSize
									? this.maxBlockSize
									: currentSize;
							var pump = function (reader) {
								if (
									blockSize > 0 &&
									thatRef.counter == currentCount
								) {
									var data = convertToByteArray(
										new Uint8Array(blockSize)
									);
									data.length = blockSize;
									return reader
										.readIntoArray(data, 0, blockSize)
										.thenApply(function (read) {
											currentSize =
												currentSize - read.value_0;
											blockSize =
												currentSize >
												thatRef.maxBlockSize
													? thatRef.maxBlockSize
													: currentSize;
											thatRef.writer.write(data);
											return pump(reader);
										});
								} else {
									var future =
										peergos.shared.util.Futures.incomplete();
									future.complete(true);
									return future;
								}
							};
							var updated =
								thatRef.readerFuture != null &&
								thatRef.counter == currentCount
									? thatRef.readerFuture
									: file.getBufferedInputStream(
											network,
											crypto,
											sizeHigh,
											sizeLow,
											4,
											function (read) {}
									  );
							updated.thenCompose(function (reader) {
								return reader
									.seekJS(seekHi, seekLo)
									.thenApply(function (seekReader) {
										var readerFuture =
											peergos.shared.util.Futures.incomplete();
										readerFuture.complete(seekReader);
										thatRef.readerFuture = readerFuture;
										return pump(seekReader);
									});
							});
						};
						var empty = convertToByteArray(new Uint8Array(0));
						this.writer.write(empty);
						return work(this, this.counter);
					};
				}
				const context = new Context(
					file,
					this.context.network,
					this.context.crypto,
					props.sizeHigh(),
					props.sizeLow()
				);
				console.log("streaming data of length " + size);
				let fileStream = streamSaver.createWriteStream(
					"media-" + props.name,
					props.mimeType,
					function (url) {
						that.videoUrl = url;
						that.showSpinner = false;
						that.pinging = true;
						that.startPing(url + "/ping");
					},
					function (seekHi, seekLo, seekLength) {
						context.stream(seekHi, seekLo, seekLength);
					},
					undefined,
					size
				);
				context.writer = fileStream.getWriter();
			} else {
				file.getInputStream(
					this.context.network,
					this.context.crypto,
					props.sizeHigh(),
					props.sizeLow(),
					function (read) {}
				).thenCompose(function (reader) {
					var size = that.getFileSize(props);
					var data = convertToByteArray(new Int8Array(size));
					return reader
						.readIntoArray(data, 0, data.length)
						.thenApply(function (read) {
							that.imageData = data;
							that.showSpinner = false;
							console.log(
								"Finished retrieving media of size " +
									data.length
							);
						});
				});
			}
		},
		isImage(file) {
			if (file == null) return false;
			var mimeType = file.getFileProperties().mimeType;
			return mimeType.startsWith("image");
		},
		isVideo(file) {
			if (file == null) return false;
			var mimeType = file.getFileProperties().mimeType;
			return mimeType.startsWith("video");
		},
		isAudio(file) {
			if (file == null) return false;
			var mimeType = file.getFileProperties().mimeType;
			return mimeType.startsWith("audio");
		},
	}
};
</script>

<style>
</style>