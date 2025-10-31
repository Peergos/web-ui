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
        return (
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

    downloadFile: function (file, fileLabel) {
      console.log('downloading ' + file.getFileProperties().name)

      let result = peergos.shared.util.Futures.incomplete();
      var props = file.getFileProperties()

      // if android localhost use app to stream data rather than a serviceworker, which the download manager can't talk to
      if (window.location.hostname == "localhost" && navigator.userAgent.toLowerCase().indexOf("android") > -1) {
          console.log("Downloading " + file.getName() + " through localhost reflector");
          const cap = file.toLink().substring(1); // without #
          let link = document.createElement('a')
          let click = new MouseEvent('click')
          link.type = props.mimeType;
          link.href = "http://localhost:" + window.location.port + "/peergos/v0/reflector/file/" + cap;
          link.dispatchEvent(click);
          result.complete(true);
          return result;
      }
        
      var that = this
      var resultingSize = this.getFileSize(props)
      let filename = fileLabel != null ? fileLabel : props.name;

      var progress = {
        show: true,
        title: 'Downloading and decrypting ' + filename,
        done: 0,
        max: resultingSize
      }
        var that = this
        that.$toast({
	    component: ProgressBar,
	    props:  progress,
	} , { icon: false , timeout:false, id: filename})
    //   var context = this.getContext()
      file
        .getBufferedInputStream(
          this.context.network,
          this.context.crypto,
          props.sizeHigh(),
            props.sizeLow(),
            20,
          function (read) {
            progress.done += read.value_0
              if (progress.done >= progress.max) {
                setTimeout(function () {
                    that.$toast.dismiss(filename);
                }, 100)
              }
          }
        )
        .thenApply(function (reader) {
          if (that.supportsStreaming()) {
            var size = that.getFileSize(props)
            var maxBlockSize = 1024 * 1024 * 5
            var blockSize = size > maxBlockSize ? maxBlockSize : size

            console.log('saving data of length ' + size + ' to ' + filename)
            let fileStream = streamSaver.createWriteStream(
              filename,
              props.mimeType,
              function (url) {
                let link = document.createElement('a')
                let click = new MouseEvent('click')
                link.type = props.mimeType
                link.href = url
                link.dispatchEvent(click)
              },
              function (seekHi, seekLo, seekLength, uuid) {},
              undefined,
              size
            )
            let writer = fileStream.getWriter()
            let pump = () => {
              if (blockSize == 0) {
                writer.close()
              } else {
                var data = convertToByteArray(new Uint8Array(blockSize))
                reader
                  .readIntoArray(data, 0, blockSize)
                  .thenApply(function (read) {
                    size = size - read.value_0
                    blockSize = size > maxBlockSize ? maxBlockSize : size
                    writer.write(data).then(() => {
                      setTimeout(pump)
                    }).catch((err) => {
                        console.error(err);
                    });
                    if (size == 0) {
                        result.complete(true);
                    }
                  }).exceptionally(t => {
                      console.log(t);
                      progress.show = false
                      that.errorTitle = 'Error downloading file: ' + filename
                      that.errorBody = t.getMessage()
                      that.showError = true
                      result.completeExceptionally(t);
                  })
              }
            }
            pump()
          } else {
            var size = that.getFileSize(props)
            var data = convertToByteArray(new Int8Array(size))
            reader
              .readIntoArray(data, 0, data.length)
              .thenApply(function (read) {
                that.openItem(filename, data, props.mimeType);
                result.complete(true);
              })
          }
        })
        .exceptionally(function (throwable) {
          progress.show = false
          that.errorTitle = 'Error downloading file: ' + filename
          that.errorBody = throwable.getMessage()
          that.showError = true
          result.complete(false);
        })
      return result;
    },
    contents: function (file) {
      var props = file.getFileProperties()
      var that = this
      var resultingSize = this.getFileSize(props)
      let result = peergos.shared.util.Futures.incomplete();
      file.getBufferedInputStream(
          this.context.network,
          this.context.crypto,
          props.sizeHigh(),
            props.sizeLow(),
            20,
          function (read) {}
        ).thenApply(function (reader) {
            var size = that.getFileSize(props)
            var data = convertToByteArray(new Int8Array(size))
            reader.readIntoArray(data, 0, data.length).thenApply(function (read) {
                result.complete(data);
            })
        }).exceptionally(function (throwable) {
          result.complete(null);
        })
      return result;
    }
  }
}
