const ProgressBar = require("../../components/drive/ProgressBar.vue");
module.exports = {
	data() {
		return {
            CrcPreCalcTable: [],
            ZipConstants: {
                fileHeaderSignature: 0x504b_0304, fileHeaderLength: 30,
                descriptorSignature: 0x504b_0708, descriptorLength: 16,
                centralHeaderSignature: 0x504b_0102, centralHeaderLength: 46,
                endSignature: 0x504b_0506, endLength: 22,
                zip64endRecordSignature: 0x504b_0606, zip64endRecordLength: 56,
                zip64endLocatorSignature: 0x504b_0607, zip64endLocatorLength: 20
            }
		};
	},
    methods: {
        //from https://stackoverflow.com/a/18639903
        precalcCrc32() {
              if (this.CrcPreCalcTable.length > 0) {
                  return;
              }
              let table = [];
              for(var i=256; i--;){
                  var tmp = i;
                  for(var k=8; k--;){
                      tmp = tmp & 1 ? 3988292384 ^ tmp >>> 1 : tmp >>> 1;
                  }
                  table[i] = tmp;
              }
              this.CrcPreCalcTable = table;
          },
          crc32(data, crc) {
              let table = this.CrcPreCalcTable;
              for(var i=0, l=data.length; i<l; i++){
                  crc = crc >>> 8 ^ table[ crc & 255 ^ data[i] ];
              }
              return crc;
          },
        isLocalhostAndroid() {
            return window.location.hostname == "localhost" && navigator.userAgent.toLowerCase().indexOf("android") > -1;
        },
        reflectZipFiles(files) {
            let mimeType = "application/zip";
            // if android localhost use app to stream data rather than a serviceworker, which the download manager can't talk to
            if (this.isLocalhostAndroid()) {
                let result = peergos.shared.util.Futures.incomplete();
                const caps = files.map(file => file.toLink().substring(1)).join("$"); // without #, separated by $
                let link = document.createElement('a')
                let click = new MouseEvent('click')
                link.type = mimeType;
                link.href = "http://localhost:" + window.location.port + "/peergos/v0/reflector/zip/" + caps;
                link.dispatchEvent(click);
                result.complete(true);
                return result;
            }
        },
        zipFiles(zipFilename, allFiles, progress) {
            let that = this;
            let mimeType = "application/zip";
            
            let writerContainer = {};
            let zipFuture = peergos.shared.util.Futures.incomplete();
            let fileStream = streamSaver.createWriteStream(zipFilename, mimeType,
                function (url) {
                    let link = document.createElement('a')
                    let click = new MouseEvent('click')
                    link.type = mimeType
                    link.href = url
                    link.dispatchEvent(click)
                    that.startZipDownload(zipFilename, allFiles, progress, zipFuture, writerContainer);
                },function (seekHi, seekLo, seekLength, uuid) {},undefined, progress.max);
            writerContainer.writer = fileStream.getWriter();
            return zipFuture;
        },
        reduceZippingFiles(allFiles, index, future, progress, writer, zipFilename, state) {
            let that = this;
            if (index == allFiles.length) {
                future.complete(true);
            } else {
                let fileEntry = allFiles[index];
                this.zipFile(fileEntry, progress, writer, zipFilename, state).thenApply(res => {
                    that.reduceZippingFiles(allFiles, ++index, future, progress, writer, zipFilename, state);
                }).exceptionally(function(throwable) {
                    console.log(throwable);
                    that.showToastError("Unable to process file: " + file.getName());
                    future.complete(false);
                });
            }
        },
        startZipDownload(zipFilename, allFiles, progress, completedZipping, writerContainer) {
            let that = this;
            this.precalcCrc32();
            let writer = writerContainer.writer;
            let future = peergos.shared.util.Futures.incomplete();
            let state = {centralRecord: [], offset: BigInt(0), fileCount: 0, archiveNeedsZip64: false};
            this.reduceZippingFiles(allFiles, 0, future, progress, writer, zipFilename, state);
            future.thenApply(done => {
                if (done) {
                    // write central repository
                    let centralSize = 0
                    for (var i =0 ; i < state.centralRecord.length; i++) {
                        let record = state.centralRecord[i];
                        centralSize += record.length;
                    }
                    if (state.archiveNeedsZip64 || state.offset >= 0xffffffffn) {
                        const endZip64 = that.makeBuffer(that.ZipConstants.zip64endRecordLength + that.ZipConstants.zip64endLocatorLength)
                        // 4.3.14 Zip64 end of central directory record
                        endZip64.setUint32(0, that.ZipConstants.zip64endRecordSignature)
                        endZip64.setBigUint64(4, BigInt(that.ZipConstants.zip64endRecordLength - 12), true)
                        endZip64.setUint32(12, 0x2d03_2d_00) // UNIX app version 4.5 | ZIP version 4.5
                        // leave 8 bytes at zero
                        endZip64.setBigUint64(24, BigInt(state.fileCount), true)
                        endZip64.setBigUint64(32, BigInt(state.fileCount), true)
                        endZip64.setBigUint64(40, BigInt(centralSize), true)
                        endZip64.setBigUint64(48, BigInt(state.offset), true)

                        // 4.3.15 Zip64 end of central directory locator
                        endZip64.setUint32(56, that.ZipConstants.zip64endLocatorSignature)
                        // leave 4 bytes at zero
                        endZip64.setBigUint64(64, state.offset + BigInt(centralSize), true)
                        endZip64.setUint32(72, 1, true)
                        let zip64end = that.makeUint8Array(endZip64)
                        combinedCentralRecord = new Uint8Array(centralSize + zip64end.length);
                        combinedCentralRecord.set(zip64end, centralSize);
                    } else {
                        combinedCentralRecord = new Uint8Array(centralSize);
                    }
                    var insertOffset = 0;
                    for (var i =0 ; i < state.centralRecord.length; i++) {
                        let record = state.centralRecord[i];
                        combinedCentralRecord.set(record, insertOffset);
                        insertOffset += record.length;
                    }
                    writer.write(combinedCentralRecord).then(() => {
                        const end = that.makeBuffer(that.ZipConstants.endLength)
                        end.setUint32(0, that.ZipConstants.endSignature)
                        // skip 4 useless bytes here
                        end.setUint16(8, that.clampInt16(state.fileCount), true)
                        end.setUint16(10, that.clampInt16(state.fileCount), true)
                        end.setUint32(12, that.clampInt32(centralSize), true)
                        end.setUint32(16, that.clampInt32(state.offset), true)
                        // leave comment length = zero (2 bytes)
                        let zipEnd = that.makeUint8Array(end)
                        writer.write(zipEnd).then(() => {
                            writer.close()
                            completedZipping.complete(done);
                        });
                    });
                } else {
                    writer.close()
                    completedZipping.complete(done);
                }
            });
        },
        zipFile(fileEntry, progress, writer, zipFilename, state) {
            let future = peergos.shared.util.Futures.incomplete();
            let file = fileEntry.file;
            let path = fileEntry.path == '' ? '' : fileEntry.path + '/';
            var props = file.getFileProperties()
            var that = this;
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(),
                function (read) {
                    progress.done += read.value_0;
                    if (progress.done >= progress.max) {
                        setTimeout(function () {
                            that.$toast.dismiss(zipFilename);
                        }, 100);
                    }
                }
            ).thenApply(function (reader) {
                console.log('zipping: ' + path + file.getName());
                var crc = -1; // Begin with all bits set ( 0xffffffff )
                let fileEncodedName = new TextEncoder().encode(path + file.getName());
                let header = that.createZipFileHeader(props, fileEncodedName);
                let fileSize = that.getFileSize(props);
                writer.write(header).then(() => {
                    var size = that.getFileSize(props);
                    var maxBlockSize = 1024 * 1024 * 5;
                    var blockSize = size > maxBlockSize ? maxBlockSize : size;
                    let pump = () => {
                        if (blockSize == 0) {
                            crc = (crc ^ -1) >>> 0; // Apply binary NOT

                            const bigFile = fileSize >= 0xffffffffn;
                            const bigOffset = state.offset >= 0xffffffffn;
                            const zip64HeaderLength = (+bigOffset * 12 | +bigFile * 28);
                            let descriptor = that.createDataDescriptor(crc, fileSize, bigFile);
                            writer.write(descriptor).then(() => {
                                let centralHeader = that.createCentralHeader(fileEncodedName, props, crc, fileSize, state.offset, zip64HeaderLength);
                                state.centralRecord.push(centralHeader);
                                state.centralRecord.push(fileEncodedName);
                                if (zip64HeaderLength) {
                                    state.centralRecord.push(that.createZip64ExtraField(fileSize, state.offset, zip64HeaderLength))
                                }
                                if (bigFile) {
                                    state.offset += 8n // because the data descriptor will have 64-bit sizes
                                }
                                state.fileCount++
                                state.offset += BigInt(that.ZipConstants.fileHeaderLength)
                                    + BigInt(that.ZipConstants.descriptorLength) + BigInt(fileEncodedName.length) + BigInt(fileSize)
                                state.archiveNeedsZip64 ||= bigFile

                                future.complete(true);
                            });
                        } else {
                            var data = convertToByteArray(new Uint8Array(blockSize))
                            reader.readIntoArray(data, 0, blockSize).thenApply(function (read) {
                                size = size - read.value_0;
                                blockSize = size > maxBlockSize ? maxBlockSize : size;
                                crc = that.crc32(data, crc);
                                writer.write(data).then(() => {
                                    setTimeout(pump);
                                })
                            })
                        }
                    }
                    pump();
                });
            }).exceptionally(function (throwable) {
                console.log(throwable);
                that.showToastError("Unable to zip file: " + file.getName());
                future.complete(false);
            })
            return future;
        },
        //zip code from https://github.com/Touffy/client-zip MIT license
        makeBuffer(size) {
        	return new DataView(new ArrayBuffer(size));
        },
        makeUint8Array(thing) {
        	return new Uint8Array(thing.buffer || thing);
        },
        clampInt32(n) {
        	return Math.min(0xffffffff, Number(n));
        },
        clampInt16(n) {
        	return Math.min(0xffff, Number(n));
        },
        toJsDate(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            return date;
        },
        createZip64ExtraField(fileSize, offset, zip64HeaderLength) {
            const header = this.makeBuffer(zip64HeaderLength)
            header.setUint16(0, 1, true)
            header.setUint16(2, zip64HeaderLength - 4, true)
            if (zip64HeaderLength & 16) {
                header.setBigUint64(4, BigInt(fileSize), true)
                header.setBigUint64(12, BigInt(fileSize), true)
            }
            header.setBigUint64(zip64HeaderLength - 8, offset, true)
            return this.makeUint8Array(header)
        },
        createCentralHeader: function(fileEncodedName, fileProps, crc, fileSize, offset, zip64HeaderLength) {
            const header = this.makeBuffer(this.ZipConstants.centralHeaderLength)
            header.setUint32(0, this.ZipConstants.centralHeaderSignature)
            header.setUint32(4, 0x2d03_2d_00) // UNIX app version 4.5 | ZIP version 4.5
            header.setUint16(8, 0x0800) // flags, bit 3 on
            // leave compression = zero (2 bytes) until we implement compression
            this.formatDOSDateTime(this.toJsDate(fileProps.modified), header, 12)
            header.setUint32(16, crc, true)
            header.setUint32(20, this.clampInt32(fileSize), true)
            header.setUint32(24, this.clampInt32(fileSize), true)
            header.setUint16(28, fileEncodedName.length, true)
            header.setUint16(30, zip64HeaderLength, true)
            // useless disk fields = zero (4 bytes)
            // useless attributes = zero (4 bytes)
            header.setUint16(40, 0o100664, true) // UNIX regular file, permissions 664
            header.setUint32(42, this.clampInt32(offset), true) // offset
            return this.makeUint8Array(header)
        },
        createDataDescriptor(crc, fileSize, needsZip64) {
          const header = this.makeBuffer(this.ZipConstants.descriptorLength + (needsZip64 ? 8 : 0))
          header.setUint32(0, this.ZipConstants.descriptorSignature)
          header.setUint32(4, crc, true)
          if (needsZip64) {
              header.setBigUint64(8, BigInt(fileSize), true)
              header.setBigUint64(16, BigInt(fileSize), true)
          } else {
            header.setUint32(8, this.clampInt32(fileSize), true)
            header.setUint32(12, this.clampInt32(fileSize), true)
          }
          return this.makeUint8Array(header)
        },
        createZipFileHeader(fileProps, fileEncodedName) {
            const header = this.makeBuffer(this.ZipConstants.fileHeaderLength + fileEncodedName.length)
            header.setUint32(0, this.ZipConstants.fileHeaderSignature)
            header.setUint32(4, 0x2d_00_0800) // ZIP version 4.5 | flags, bit 3 on = size and CRCs will be zero
            // leave compression = zero (2 bytes) until we implement compression
            this.formatDOSDateTime(this.toJsDate(fileProps.modified), header, 10)
            // leave CRC = zero (4 bytes) because we'll write it later, in the central repo
            // leave lengths = zero (2x4 bytes) because we'll write them later, in the central repo
            header.setUint16(26, fileEncodedName.length, true)
            // leave extra field length = zero (2 bytes)
            let headerBytes = this.makeUint8Array(header)
            headerBytes.set(fileEncodedName, this.ZipConstants.fileHeaderLength);
            return headerBytes;
        },
        formatDOSDateTime(date, into, offset = 0) {
            const dosTime = date.getSeconds() >> 1
            | date.getMinutes() << 5
            | date.getHours() << 11

            const dosDate = date.getDate()
            | (date.getMonth() + 1) << 5
            | (date.getFullYear() - 1980) << 9

            into.setUint16(offset, dosTime, true)
            into.setUint16(offset + 2, dosDate, true)
        }
  }
}
