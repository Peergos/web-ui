const ProgressBar = require("../../components/drive/ProgressBar.vue");
module.exports = {

  methods: {
    calculateDirectoryStatistics(file, path, accumulator, future) {
        let that = this;
        file.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function (children) {
            let arr = children.toArray();
            for (var i = 0; i < arr.length; i++) {
                let child = arr[i];
                let childProps = child.getFileProperties();
                if (childProps.isDirectory) {
                    accumulator.folderCount += 1;
                    accumulator.apparentSize += 4096;
                    let newPath = path + "/" + childProps.name;
                    accumulator.directoryMap.set(newPath, '');
                    that.calculateDirectoryStatistics(child, newPath, accumulator, future);
                } else {
                    accumulator.fileCount += 1;
                    let size = that.getFileSize(childProps);
                    accumulator.actualSize += size;
                    accumulator.apparentSize += (size + (4096 - (size % 4096)));
                }
            }
              accumulator.directoryMap.delete(path);
            if (accumulator.directoryMap.size == 0) {
                future.complete(accumulator);
            }
        });
    },
    calculateTotalSize(file, path) {
        let future = peergos.shared.util.Futures.incomplete();
        let accumulator = { folderName: file.getFileProperties().name, actualSize: 0, apparentSize: 4096, directoryMap: new Map(), fileCount: 0, folderCount: 0 };
        if (file.isDirectory()) {
            accumulator.folderName = file.getFileProperties().name;
              this.calculateDirectoryStatistics(file, path + file.getFileProperties().name, accumulator, future);
          } else {
              accumulator.fileCount += 1;
              let size = this.getFileSize(file.getFileProperties());
              accumulator.actualSize += size;
              accumulator.apparentSize += (size + (4096 - (size % 4096)));
              future.complete(accumulator);
          }
        return future;
    },
    // This will only work up to a file size of 2^52 bytes (the biggest integer you can fit in a double)
    // But who ever needed a filesize > 4 PB ? ;-)
    getFileSize: function (props) {
      var low = props.sizeLow()
      if (low < 0) low = low + Math.pow(2, 32)
      return low + props.sizeHigh() * Math.pow(2, 32)
    },

    supportsVideoStreaming: function() {
        try {
            return 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
        } catch(err) {
            return false;
        }
    },

    supportsStreaming: function () {
      try {
        //see https://github.com/jimmywarting/StreamSaver.js/issues/69
        //safari is getting writable streams, but unable to use them due to issues
        let safari =
          /constructor/i.test(window.HTMLElement) ||
          !!window.safari ||
          !!window.WebKitPoint
        return (
          !safari &&
          'serviceWorker' in navigator &&
          !!new ReadableStream() &&
          !!new WritableStream()
        )
      } catch (err) {
        return false
      }
    },

    detectFirefoxWritableSteams: function () {
      let userAgent = navigator.userAgent
      let firefoxToken = 'Firefox/'
      if (userAgent.includes('Gecko/') && userAgent.includes(firefoxToken)) {
        let version = Number(
          userAgent.substring(
            userAgent.indexOf(firefoxToken) + firefoxToken.length
          )
        )
        return version >= 72 //indicates javascript.options.writable_streams is available in about:config
      } else {
        return false
      }
    },

    openItem: function (name, data, mimeType) {
      console.log('saving data of length ' + data.length + ' to ' + name)

      var blob = new Blob([data], { type: 'octet/stream' })
      var url = window.URL.createObjectURL(blob)
      var link = document.getElementById('downloadAnchor')
      link.href = url
      link.type = mimeType
      link.download = name
      link.click()
    },

    downloadFile: function (file) {
      console.log('downloading ' + file.getFileProperties().name)
      var props = file.getFileProperties()
      var that = this
      var resultingSize = this.getFileSize(props)
      var progress = {
        show: true,
        title: 'Downloading and decrypting ' + props.name,
        done: 0,
        max: resultingSize
      }
        var that = this
        that.$toast({
	    component: ProgressBar,
	    props:  progress,
	} , { icon: false , timeout:false, id: props.name})
    //   var context = this.getContext()
      file
        .getInputStream(
          this.context.network,
          this.context.crypto,
          props.sizeHigh(),
          props.sizeLow(),
          function (read) {
            progress.done += read.value_0
              if (progress.done >= progress.max) {
                setTimeout(function () {
                    that.$toast.dismiss(props.name);
                }, 100)
              }
          }
        )
        .thenCompose(function (reader) {
          if (that.supportsStreaming()) {
            var size = that.getFileSize(props)
            var maxBlockSize = 1024 * 1024 * 5
            var blockSize = size > maxBlockSize ? maxBlockSize : size

            console.log('saving data of length ' + size + ' to ' + props.name)
            let result = peergos.shared.util.Futures.incomplete()
            let fileStream = streamSaver.createWriteStream(
              props.name,
              props.mimeType,
              function (url) {
                let link = document.createElement('a')
                let click = new MouseEvent('click')
                link.type = props.mimeType
                link.href = url
                link.dispatchEvent(click)
              },
              function (seekHi, seekLo, seekLength) {},
              undefined,
              size
            )
            let writer = fileStream.getWriter()
            let pump = () => {
              if (blockSize == 0) {
                writer.close()
                result.complete(true)
              } else {
                var data = convertToByteArray(new Uint8Array(blockSize))
                reader
                  .readIntoArray(data, 0, blockSize)
                  .thenApply(function (read) {
                    size = size - read.value_0
                    blockSize = size > maxBlockSize ? maxBlockSize : size
                    writer.write(data).then(() => {
                      setTimeout(pump)
                    })
                  })
              }
            }
            pump()
            return result
          } else {
            var size = that.getFileSize(props)
            var data = convertToByteArray(new Int8Array(size))
            return reader
              .readIntoArray(data, 0, data.length)
              .thenApply(function (read) {
                that.openItem(props.name, data, props.mimeType)
              })
          }
        })
        .exceptionally(function (throwable) {
          progress.show = false
          that.errorTitle = 'Error downloading file: ' + props.name
          that.errorBody = throwable.getMessage()
          that.showError = true
        })
    }
  }
}
