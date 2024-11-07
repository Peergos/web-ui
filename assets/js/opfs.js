var rootDirectory = null;
onmessage = async (e) => {
  // retrieve message sent to work from main script
  const message = e.data;
  let that = this;
  if (message.action == "init") {
      navigator.storage.getDirectory().then(rootDir => {
        that.rootDirectory = rootDir;
      });
  } else if (message.action =="set") {
    setOPFSKV(message.filename, message.value, message.directory, 0);
  } else if(message.action =="get") {
    getOPFSKV(message.filename, message.directory, 0);
  }
};
function getOPFSKV(filename, directory, retryCount) {
    getFileHandle(filename, directory).then( fileHandle => {
        if (fileHandle != null) {
            fileHandle.createSyncAccessHandle().then(accessHandle => {
                const size = accessHandle.getSize();
                if (size == 0) {
                    console.log("OPFS: attempt to read 0 byte data. hash:" + filename);
                    if (retryCount < 3) {
                        setTimeout(() => getOPFSKV(filename, directory, retryCount + 1),2000);
                    } else {
                        postMessage({filename: filename, contents: null});
                    }
                } else {
                    const dataView = new Int8Array(size);
                    accessHandle.read(dataView);
                    accessHandle.close();
                    postMessage({filename: filename, contents: dataView});
                }
            }).catch(e => {
                if (retryCount < 3) {
                    setTimeout(() => getOPFSKV(filename, directory, retryCount + 1),2000);
                } else {
                    console.log('getOPFSKV error: ' + e + " filename:" + filename);
                    postMessage({filename: filename, contents: null});
                }
            });
        }
    }).catch(e => {
        postMessage({filename: filename, contents: null});
    });
}
function setOPFSKV(filename, value, directory, retryCount) {
    //console.log('setOPFSKV opening:' + filename);
    getSyncFileHandleCreateIfNecessary(filename, directory).then(accessHandle => {
        accessHandle.write(value);
        accessHandle.flush();
        accessHandle.close();
        //console.log('setOPFSKV closing:' + filename);
    }).catch(e => {
        if (retryCount < 3) {
            setTimeout(() => setOPFSKV(filename, value, directory, retryCount + 1),500);
        } else {
            console.log('setOPFSKV error: ' + e + " filename:" + filename);
        }
    });
}
function getFileHandle(filename, directory) {
    let blockFolder = filename.substring(filename.length - 3, filename.length - 1);
    return rootDirectory.getDirectoryHandle(directory)
        .then(dirHandle => dirHandle.getDirectoryHandle(blockFolder)
            .then(blockDirHandle => blockDirHandle.getFileHandle(filename))
        ).catch(e => {
            //console.log('getFileHandle error: ' + e);
            postMessage({filename: filename, contents: null});
        });
}
function getParentDirectoryHandle(filename, directory) {
    let blockFolder = filename.substring(filename.length - 3, filename.length - 1);
    return rootDirectory.getDirectoryHandle(directory, { create: true })
        .then(dirHandle => dirHandle.getDirectoryHandle(blockFolder, { create: true }))
}

function getSyncFileHandleCreateIfNecessary(filename, directory) {
    return getParentDirectoryHandle(filename, directory)
        .then(blockDirHandle =>
            blockDirHandle.getFileHandle(filename, { create: true })
                .then(fileHandle => fileHandle.createSyncAccessHandle()));
}