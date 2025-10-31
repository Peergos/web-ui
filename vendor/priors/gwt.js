function convertToByteArray(target) {
    var source = peergos.shared.user.JavaScriptPoster.emptyArray();
    // This relies on internal implementation details of GWT's byte[] emulation
    target.___clazz = source.___clazz;
    target.castableTypeMap = source.castableTypeMap;
    target.typeMarker = source.typeMarker;
    target.__elementTypeCategory$ = source.__elementTypeCategory$;
    target.__elementTypeId$ = source.__elementTypeId$;
    var len = target.length;
    target.__proto__ = source.__proto__;
    target.length = len;
    return target;
}

function propsToFragment(props) {
    // Manually percent encode commas to work around some broken clients, like signal
    return encodeURI(JSON.stringify(props)).split(",").join("%2c");
}

function fragmentToProps(fragment) {
    var decoded = decodeURIComponent(fragment);
    return JSON.parse(decoded);
}

function getProm(url) {
    return getWithHeadersProm(url, []);
}

function getWithHeadersProm(url, headers) {
    var future = peergos.shared.util.Futures.incomplete();
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = 'arraybuffer';
    var index = 0;
    while (index < headers.length){
	var name = headers[index++];
    	var value = headers[index++];
	if (name != "Host" && name != "Content-Length")
	    req.setRequestHeader(name, value);
    }
    
    req.onload = function() {
        // This is called even on 404 etc
        // so check the status
        if (req.status == 200) {
	    future.complete(convertToByteArray(new Int8Array(req.response)));
        } else if (req.status == 404) {
	    future.completeExceptionally(new peergos.shared.storage.HttpFileNotFoundException());
        } else if (req.status == 429 || req.status == 503) {
	    future.completeExceptionally(new peergos.shared.storage.RateLimitException());
        } else {
	        future.completeExceptionally(java.lang.Throwable.of(Error(req.getResponseHeader("Trailer"))));
        }
    };
    
    req.onerror = function(e) {
        future.completeExceptionally(new peergos.shared.storage.RateLimitException());
    };
    
    req.send();
    return future;
}

function postProm(url, data, timeout) {
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('POST', url);
        if (timeout >= 0)
            req.timeout = timeout;
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		try {
            let trailer = req.getResponseHeader("Trailer");
            if (trailer == null) {
                reject('Unexpected error from server');
            } else {
                if (trailer.startsWith('Storage+quota+reached')) {
                    future.completeExceptionally(new peergos.shared.storage.StorageQuotaExceededException(decodeURIComponent(trailer)));
                } else if (trailer.startsWith('CAS+exception') || trailer.startsWith('Mutable+pointer+update+failed')) {
                    future.completeExceptionally(new peergos.shared.storage.CasException(decodeURIComponent(trailer)));
                } else if (trailer.startsWith('PointerCAS')) {
                    future.completeExceptionally(peergos.shared.storage.PointerCasException.fromString(decodeURIComponent(trailer)));
                } else if (trailer.startsWith('Rate+Limit')) {
                    future.completeExceptionally(new peergos.shared.storage.MajorRateLimitException(decodeURIComponent(trailer)));
                } else {
                    reject(decodeURIComponent(trailer));
                }
            }
		} catch (e) {
		    reject(e);
		}
            }
	};
	
	req.onerror = function(e) {
            future.completeExceptionally(new java.net.ConnectException("Unable to connect"));
	};

        req.ontimeout = function() {
            reject(Error("Network timeout"));
        };

	req.send(data);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(convertToByteArray(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

function postMultipartProm(url, dataArrays, timeout) {
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('POST', url);
        if (timeout >= 0)
            req.timeout = timeout;
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		try {
		    let trailer = req.getResponseHeader("Trailer");
            if (trailer == null) {
                reject('Unexpected error from server');
            } else {
                if (trailer.startsWith('Storage+quota+reached')) {
                    future.completeExceptionally(new peergos.shared.storage.StorageQuotaExceededException(trailer));
                } else if (trailer.startsWith('CAS+exception') || trailer.startsWith('Mutable+pointer+update+failed')) {
                    future.completeExceptionally(new peergos.shared.storage.CasException(trailer));
                } else {
                    reject(trailer);
                }
            }
		} catch (e) {
		    reject("Error");
		}
            }
	};
	
	req.onerror = function(e) {
            future.completeExceptionally(new java.net.ConnectException("Unable to connect"));
	};
	req.ontimeout = function(e) {
            future.completeExceptionally(new peergos.shared.storage.RateLimitException());
	};
	var form = new FormData();

	for (var i=0; i < dataArrays.array.length; i++)
	    form.append(i, new Blob([dataArrays.array[i]]));

        req.send(form);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(convertToByteArray(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

function putProm(url, data, headers) {
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('PUT', url);
	req.responseType = 'arraybuffer';
	var index = 0;
	while (index < headers.length){
	    var name = headers[index++];
    	    var value = headers[index++];
	    if (name != "Host" && name != "Content-Length")
		req.setRequestHeader(name, value);
	}
	
	req.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            } else if (req.status == 429 || req.status == 500 || req.status == 503) {
	        future.completeExceptionally(new peergos.shared.storage.RateLimitException());
            } else {
		reject("HTTP " + req.status);
            }
	};
	
	req.onerror = function(e) {
            future.completeExceptionally(new peergos.shared.storage.RateLimitException());
	};

	req.ontimeout = function(e) {
            future.completeExceptionally(new peergos.shared.storage.RateLimitException());
	};

	req.send(data);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(convertToByteArray(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

var callback = {
    NativeJSScheduler: function() {
	    this.callAfterDelay = function callbackFunc(func, delay) {
           setTimeout(function(){
                func.call();
           }, delay);
       }
    }
};

var http = {
    NativeJSHttp: function() {
	this.get = getProm;
	this.getWithHeaders = getWithHeadersProm;
	this.post = postProm;
	this.postMultipart = postMultipartProm;
	this.put = putProm;
    }
};

var online = {
    NativeJsOnlineState: function() {
	this.isOnline = function() {
            return window.navigator.onLine;
        };
    }
};

var cache = {
    NativeJSCache: function() {
    this.cacheStore = null;
    this.cacheStoreMetadata = null;
    this.cacheDesiredSizeStore = null;
    this.cacheMetadataArray = [];
    this.cacheMetadataRefs = {};
    this.maxSizeBytes = 0;
    this.currentCacheSize = 0;
    this.currentCacheBlockCount = 0;
    this.MAX_CACHE_BLOCKS = 30000; // must be > 1000
    this.enablePolicyEvictOnBlockCount = false;
    this.evicting = false;
    this.isCachingEnabled = false;
    this.isOpfsCachingEnabled = false;
    this.isIndexedDBCachingEnabled = false;
    this.desiredCacheSize = 0;

    this.init = function init(maxSizeMiB) {
        let that = this;
        if (window.location.hostname == "localhost")
            return;
        bindCacheStore(that);
        isOPFSAvailable().thenApply(function(isOpfsCachingEnabled) {
            isIndexedDBAvailable().thenApply(function(isIndexedDBCachingEnabled) {
                that.isIndexedDBCachingEnabled = isIndexedDBCachingEnabled;
                that.isOpfsCachingEnabled = isIndexedDBCachingEnabled && isOpfsCachingEnabled;
                that.isCachingEnabled = isOpfsCachingEnabled || isIndexedDBCachingEnabled;
                if (that.isCachingEnabled) {
                    that.cacheStore = isOpfsCachingEnabled ? 'data' : createStoreIDBKV('data', 'keyval');
                    that.cacheStoreMetadata = isOpfsCachingEnabled ? null : createStoreIDBKV('metadata', 'keyval');
                    that.cacheDesiredSizeStore = createStoreIDBKV('size', 'keyval');
                    getDesiredCacheSize().thenApply(desiredCacheSize => {
                        getBrowserStorageQuota().then(browserStorageQuota => {
                            that.maxSizeBytes = calculateCacheSize(maxSizeMiB * 1024 * 1024, browserStorageQuota, desiredCacheSize);
                            that.desiredCacheSize = that.maxSizeBytes;
                            if (isOpfsCachingEnabled) {
                                removeIndexedDBIfExists().thenApply((done) => {
                                    valuesOPFSKV(that.cacheStore).thenApply((values) => {
                                        values.forEach((json, idx) => {
                                            that.cacheMetadataArray.push(json);
                                            that.cacheMetadataRefs['k'+json.key] = that.cacheMetadataArray[idx]; // 'k' prefix as key may start with a digit
                                            that.currentCacheSize = that.currentCacheSize + json.l;
                                        });
                                        that.prepare(values);
                                    });
                                });
                            } else {
                                valuesIDBKV(that.cacheStoreMetadata).then((values) => {
                                    values.forEach((value, idx) => {
                                        let json = JSON.parse(value);
                                        that.cacheMetadataArray.push(json);
                                        that.cacheMetadataRefs['k'+json.key] = that.cacheMetadataArray[idx]; // 'k' prefix as key may start with a digit
                                        that.currentCacheSize = that.currentCacheSize + json.l;
                                    });
                                    that.prepare(values);
                                });
                            }
                        });
                    });
                }
            });
        });
    };
    this.prepare = function(values) {
        let that = this;
        that.currentCacheBlockCount = values.length;
        prepareLRU().thenApply(lruInitialised => {
            setDesiredCacheSize(that.maxSizeBytes).thenApply(done => {
                let currentMiB = (that.currentCacheSize /1024 /1024).toFixed(2);
                let maxMiB = (that.maxSizeBytes /1024 /1024).toFixed(2);
                getBrowserStorageUsage().then(browserStorageUsage => {
                    let actualMiB = (browserStorageUsage /1024 /1024).toFixed(2);
                    console.log('Block Cache. Actual usage:' + actualMiB + ' MiB');
                    console.log('Block Cache. Objects:' + that.currentCacheBlockCount + " Size:" + currentMiB + " MiB" + " Max:" + maxMiB + " MiB");
                });
            });
        });
    }
	this.put = putIntoCacheProm;
	this.get = getFromCacheProm;
	this.hasBlock = hasBlockInCache;
	this.clear = clearCache;
    }
};
function prepareLRU() {
    let future = peergos.shared.util.Futures.incomplete();
    evictLRU(blockStoreCache, function() {future.complete(true)});
    return future;
}

var rootDirectory = null;

function delManyOPFSKV(filesArray, directory) {
    let future = peergos.shared.util.Futures.incomplete();
    deleteFiles(filesArray, directory).then(() => {
        future.complete(true);
    })
    return future;
}
async function deleteFiles(filesArray, directory) {
      const promises = [];
      for await (const name of filesArray) {
        let prom = new Promise(function(resolve, reject) {
            let work = function(filename) {
                getParentDirectoryHandle(filename, directory).then(parentDirHandle => {
                    parentDirHandle.removeEntry(filename).then(() => {
                        resolve(true);
                    }).catch(e => {
                        if (e.toString().startsWith("NotFoundError") || e.toString().startsWith("NoModificationAllowedError")) {
                            resolve(true);
                        } else {
                            console.log(e);
                            resolve(true);
                        }
                    });
                });
            };
            work(name, 0);
        });
        promises.push(prom);
      }
      return Promise.all(promises);
}
function clearOPFSKV(directory) {
    let future = peergos.shared.util.Futures.incomplete();
    rootDirectory.removeEntry(directory, { recursive: true }).then(() => {
        future.complete(true)
    });
    return future;
}
function getParentDirectoryHandle(filename, directory) {
    let blockFolder = filename.substring(filename.length - 3, filename.length - 1);
    return rootDirectory.getDirectoryHandle(directory, { create: true })
        .then(dirHandle =>
            dirHandle.getDirectoryHandle(blockFolder, { create: true }));
}
function getParentDirectoryHandleReadOnly(filename, directory) {
    let blockFolder = filename.substring(filename.length - 3, filename.length - 1);
    return rootDirectory.getDirectoryHandle(directory, { create: false })
        .then(dirHandle =>
            dirHandle.getDirectoryHandle(blockFolder, { create: false }));
}
function getFileHandle(filename, directory) {
    return getParentDirectoryHandleReadOnly(filename, directory)
        .then(blockDirHandle =>
            blockDirHandle.getFileHandle(filename));
}
function getFileHandleCreateIfNecessary(filename, directory) {
    return getParentDirectoryHandle(filename, directory)
        .then(blockDirHandle =>
            blockDirHandle.getFileHandle(filename, { create: true }));
}
let pendingWrites = new Map(); //key: String, value: byte[]
let pendingReads = new Map(); //key: String, value: Future
let waitingForPendingRead = new Map(); //key: String, value: Future[]
let recentReadCache = new Map(); //key: String, value: byte[]
function setOPFSKV(filename, value, directory) {
    let future = peergos.shared.util.Futures.incomplete();
    let alreadyWritten = pendingWrites.get(filename);
    if (alreadyWritten != null) {
        future.complete(true);
    } else {
        pendingWrites.set(filename, value)
        getFileHandleCreateIfNecessary(filename, directory).then(file => {
          writeFileContents(file, value).thenApply(done => {
                if (done) {
                    setTimeout(() => {
                      pendingWrites.delete(filename);
                    }, 5000);
                } else {
                    pendingWrites.delete(filename);
                }
                future.complete(done);
          });
        }).catch(e => {
            console.log('setOPFSKV error: ' + e);
            future.complete(false);
        });
    }
    return future;
}
function resolveWaiting(filename) {
    let waitList = waitingForPendingRead.get(filename);
    if (waitList.length > 0) {
        const pendingReadFuture = pendingReads.get(filename);
        pendingReadFuture.thenApply(res => {
            pendingReads.delete(filename);
            waitingForPendingRead.delete(filename);
            let waitLength = waitList.length;
            for(var i = 0; i < waitLength; i++) {
                let waitingFuture = waitList[i];
                waitingFuture.complete(res);
            }
            if (waitLength > 1 && res != null) {
                recentReadCache.set(filename, res);
                setTimeout(() => {recentReadCache.delete(filename);}, 10000);
            }
        });
    } else {
        pendingReads.delete(filename);
        waitingForPendingRead.delete(filename);
    }
}
function getOPFSKV(filename, directory) {
    let future = peergos.shared.util.Futures.incomplete();
    const pending = pendingWrites.get(filename);
    if (pending != null) {
        future.complete(pending);
    } else {
        const recentCachedResult = recentReadCache.get(filename);
        if (recentCachedResult != null) {
            future.complete(recentCachedResult);
        } else {
            const pendingReadFuture = pendingReads.get(filename);
            if (pendingReadFuture != null) {
                let waitList = waitingForPendingRead.get(filename);
                waitList.push(future);
            } else {
                pendingReads.set(filename, future)
                waitingForPendingRead.set(filename, []);
                getFileHandle(filename, directory).then(file => {
                    readFileContents(file).thenApply(contents => {
                        if (contents == null) {
                            console.log('unable to read opfs file contents: ' + filename);
                            future.complete(null);
                            resolveWaiting(filename, 0);
                        } else {
                            let data = new Int8Array(contents);
                            if (data.byteLength == 0) { //file has been created, but contents not written yet
                                console.log('cache miss in directory: ' + directory);
                                future.complete(null);
                                resolveWaiting(filename, 0);
                            } else {
                                future.complete(data);
                                resolveWaiting(filename, 0);
                            }
                        }
                    });
                }).catch(e => {
                    future.complete(null);
                    resolveWaiting(filename, 0);
                });
            }
        }
    }
    return future;
}
function valuesOPFSKV(directory) {
    let future = peergos.shared.util.Futures.incomplete();
    rootDirectory.getDirectoryHandle(directory, { create: true }).then(dirHandle => {
        getFilesMetadata(dirHandle).then(values => {
            future.complete(values);
        });
    });
    return future;
}
function readFileContents(fileHandle) {
    let future = peergos.shared.util.Futures.incomplete();
    fileHandle.getFile().then(file => {
        file.arrayBuffer().then(contents => {
            future.complete(contents);
        }).catch(e2 => {
            console.log("unexpected file read exception: " + e2);
            future.complete(null);
        });
    }).catch(e => {
        console.log('readFileContents error: ' + e);
        future.complete(null);
    });
    return future;
}
function writeFileContents(file, value) {
    let future = peergos.shared.util.Futures.incomplete();
    file.createWritable().then(writableStream => {
        writableStream.write(value).then( () => {
            writableStream.close().then( () => {
                future.complete(true);
            }).catch(e1 => {
                console.log('writableStream.close error: ' + e1);
                future.complete(false);
            });
        }).catch(e2 => {
            console.log('writableStream.write error: ' + e2);
            future.complete(false);
        });
    }).catch(e3 => {
        console.log('file.createWritable error: ' + e3);
        future.complete(false);
    });
    return future;
}
async function getFilesMetadata(directoryHandle) {
    const filesMetadata = [];
    for await (const stats of getFileStatsRecursively(directoryHandle)) {
        filesMetadata.push(stats);
    }
    return filesMetadata;
}
async function* getFileStatsRecursively(entry) { //https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle
  if (entry.kind === "file") {
    const file = await entry.getFile();
    if (file !== null) {
        let json = {key: file.name, l: file.size, t: file.lastModified};
        yield json;
    }
  } else if (entry.kind === "directory") {
    for await (const handle of entry.values()) {
      yield* getFileStatsRecursively(handle);
    }
  }
}
/*
mobile browsers - not confirmed to work and difficult to debug.
*/
function isOPFSAvailable() {
    let future = peergos.shared.util.Futures.incomplete();
    try {
        let isMobile = /Mobi|Android/i.test(navigator.userAgent); // https://stackoverflow.com/a/24600597
        let isLinuxOnFirefox = navigator.userAgent.search('Linux')!==-1 && navigator.userAgent.search('X11')!==-1
            && navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
        if (!isMobile && !isLinuxOnFirefox) {
            navigator.storage.getDirectory().then(root => {
                if (rootDirectory == null) {
                    rootDirectory = root;
                }
                console.log('OPFS available');
                future.complete(true);
            }).catch(e => {
                console.log('OPFS not available:' + e);
                future.complete(false);
            });
        } else {
            console.log('OPFS support not currently available for your browser');
            future.complete(false);
        }
    } catch (e) {
        future.complete(false);
    }
    return future;
}
//Firefox private mode does not support IndexedDB.  https://bugzilla.mozilla.org/show_bug.cgi?id=781982
function isIndexedDBAvailable() {
    let future = peergos.shared.util.Futures.incomplete();
    if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1
        || navigator.userAgent.toLowerCase().indexOf("iphone") > -1){
        //console.log("Firefox")
        try {
          var db = indexedDB.open("IsPBMode");
          db.onerror = function() {
                future.complete(false);
          };
          db.onsuccess = function() {
                console.log('IndexedDB available');
                future.complete(true);
          };
        }
        catch(err) {
            future.complete(false);
        }
    } else {
        console.log('IndexedDB available');
        future.complete(true);
    }
    return future;
}
var blockStoreCache;
var pointerStoreCache;
var batStoreCache;
var accountStoreCache;
var pkiStoreCache;
var rootKeyCache;
let SAFARI_CACHE_SIZE = 1024 * 1024 * 700;

function bindCacheStore(storeCache) {
    blockStoreCache = storeCache;
}
function isCachingAvailable() {
    return blockStoreCache.isCachingEnabled;
}
function getCurrentCacheSizeMiB() {
    return blockStoreCache.maxSizeBytes /1024 /1024;
}
function getCurrentDesiredCacheSize() {
    return blockStoreCache.desiredCacheSize /1024/1024;
}
function getDesiredCacheSize() {
    let future = peergos.shared.util.Futures.incomplete();
    getIDBKV("desiredSize", blockStoreCache.cacheDesiredSizeStore).then((val) => {
        if (val == null || val == -1) {
            future.complete(-1);
        } else if(val == 0 && isSafariTest()) {
            future.complete(SAFARI_CACHE_SIZE);
        } else {
            future.complete(val);
        }
    });
    return future;
}
function setDesiredCacheSize(desiredSize) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!blockStoreCache.isCachingEnabled) {
        future.complete(true);
    } else {
        setIDBKV("desiredSize", desiredSize, blockStoreCache.cacheDesiredSizeStore).then(() => {
            future.complete(true);
        }).catch(err => {
            console.error("unable to update desired size!", err.message);
            clearCacheFully(blockStoreCache, function() {
                setIDBKV("desiredSize", desiredSize, blockStoreCache.cacheDesiredSizeStore).then(() => {
                    future.complete(true);
                }).catch(err => {
                    future.complete(true);
                });
            });
        });
    }
    return future;
}
function modifyCacheSize(newCacheSizeMiB) {
    let future = peergos.shared.util.Futures.incomplete();
    if (window.location.hostname == "localhost") {
        new Promise(function(resolve, reject) {
	    var req = new XMLHttpRequest();
	    req.open('POST', "peergos/v0/config/cache/set-size-mb?size="+newCacheSizeMiB);
            req.responseType = 'json';
	    
	    req.onload = function() {
                // This is called even on 404 etc
                // so check the status
                if (req.status == 200) {
		    resolve(true);
                }
                else {
		    try {
                        let trailer = req.getResponseHeader("Trailer");
                        if (trailer == null) {
                            reject('Unexpected error from server');
                        } else {
                            reject(trailer);
                        }
		    } catch (e) {
		        reject(e);
		    }
                }
	    };
	    
	    req.onerror = function(e) {
                future.completeExceptionally(new java.net.ConnectException("Unable to connect"));
	    };
            
            req.ontimeout = function() {
                reject(Error("Network timeout"));
            };
            
	    req.send(new Int8Array(0));
        }).then(function(result, err) {
            if (err != null)
                future.completeExceptionally(java.lang.Throwable.of(err));
            else
                future.complete(result);
        }, function(err) {
	    future.completeExceptionally(java.lang.Throwable.of(err)); 
        })
        return future;
    }
    let newSizeBytes = newCacheSizeMiB * 1024 * 1024;
    if (!blockStoreCache.isCachingEnabled) {
        future.complete(true);
    } else {
        setDesiredCacheSize(newSizeBytes).thenApply(done => {
            blockStoreCache.desiredCacheSize = newSizeBytes;
            if (newSizeBytes == 0) {
                clearCacheFully(blockStoreCache, function() {
                    clearPointerCacheFully(pointerStoreCache, function() {
                        blockStoreCache.maxSizeBytes = 0;
                        future.complete(true);
                    });
                });
            } else if (newSizeBytes < blockStoreCache.maxSizeBytes) { //less than current max
                blockStoreCache.maxSizeBytes = newSizeBytes;
                if (triggerEviction(blockStoreCache)) {
                    evictLRU(blockStoreCache, function() {future.complete(true)});
                } else {
                    future.complete(true);
                }
            } else {
                blockStoreCache.maxSizeBytes = newSizeBytes;
                future.complete(true);
            }
        });
    }
    return future;
}

function getBrowserStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
        return navigator.storage.estimate().then(quota => quota.usage);
    } else {
        let prom = new Promise(function(resolve, reject) { resolve(0)});
        return prom;
    }
}
function isSafariTest() {
    let test =
        /constructor/i.test(window.HTMLElement) ||
        (function (p) {
        return p.toString() === "[object SafariRemoteNotification]";
        })(!window["safari"] || safari.pushNotification);
    return test;
}
function getBrowserStorageQuota() {
    if (window.location.hostname == "localhost") {
        return new Promise(function(resolve, reject) {
	    var req = new XMLHttpRequest();
	    req.open('POST', "peergos/v0/config/cache/get-size");
            req.responseType = 'json';
	    
	    req.onload = function() {
                // This is called even on 404 etc
                // so check the status
                if (req.status == 200) {
		    resolve(JSON.parse(req.response).size*1024*1024);
                }
                else {
		    try {
                        let trailer = req.getResponseHeader("Trailer");
                        if (trailer == null) {
                            reject('Unexpected error from server');
                        } else {
                            reject(trailer);
                        }
		    } catch (e) {
		        reject(e);
		    }
                }
	    };
	    
	    req.onerror = function(e) {
                future.completeExceptionally(new java.net.ConnectException("Unable to connect"));
	    };
            
            req.ontimeout = function() {
                reject(Error("Network timeout"));
            };
            
	    req.send(new Int8Array(0));
        });
    }
    if (navigator.storage && navigator.storage.estimate) {
        return navigator.storage.estimate().then(quota => quota.quota);
    } else {

        let prom = new Promise(function(resolve, reject) { resolve(isSafariTest() ? SAFARI_CACHE_SIZE : 0)});
        return prom;
    }
}
function calculateCacheSize(maxSizeBytes, maxBrowserStorageBytes, desiredCacheSize) {
    if (maxBrowserStorageBytes == 0) {
        return 0;//no cache
    } else if (maxSizeBytes <= 0) {
        if (desiredCacheSize > -1 && desiredCacheSize < maxBrowserStorageBytes) {
            return desiredCacheSize;
        } else {
            return maxBrowserStorageBytes;
        }
    } else {
        let newLimit  = maxSizeBytes > maxBrowserStorageBytes ? maxBrowserStorageBytes : maxSizeBytes;
        if (desiredCacheSize > -1 && desiredCacheSize < maxBrowserStorageBytes && desiredCacheSize < newLimit) {
            return desiredCacheSize;
        } else {
            return newLimit;
        }
    }
}
function triggerEviction(cache) {
    if (!cache.isCachingEnabled) {
        return false;
    }
    //above 90% of max
    return (cache.currentCacheSize / cache.maxSizeBytes) * 100.0 > 90.0
        || (cache.enablePolicyEvictOnBlockCount && cache.currentCacheBlockCount > cache.MAX_CACHE_BLOCKS);
}
function reclaim(cache) {
    //80% of max
    return Math.floor(cache.maxSizeBytes / 100 * 80);
}
function evictLRU(cache, callback) {
    if (!cache.isCachingEnabled) {
        return;
    }
    if (cache.evicting) {
        return;
    }
    cache.evicting = true;
    var cacheSize = cache.currentCacheSize;
    var cacheBlockCount = cache.currentCacheBlockCount;
    let toDelete = [];
    let newLimit = reclaim(cache);
    let isOverBlockCountLimit = (cache.enablePolicyEvictOnBlockCount && cache.currentCacheBlockCount > cache.MAX_CACHE_BLOCKS);
    let newBlockCountLimit = isOverBlockCountLimit ? cache.MAX_CACHE_BLOCKS - 1000 : cache.MAX_CACHE_BLOCKS;
    if (!isOverBlockCountLimit && cacheSize <= newLimit) {
        callback();
        cache.evicting=false;
    } else {
        let sorted = cache.cacheMetadataArray.slice().sort((a, b) => a.t < b.t);
        for(var i=0; i < sorted.length; i++) {
            cacheSize = cacheSize - sorted[i].l;
            toDelete.push(sorted[i].key);
            cacheBlockCount = cacheBlockCount - 1;
            if (cacheSize <= newLimit && cacheBlockCount <= newBlockCountLimit) {
                cache.currentCacheSize = cacheSize;
                cache.currentCacheBlockCount = cacheBlockCount;
                break;
            }
        }
        for (var i=0; i < toDelete.length; i++) {
            sorted.splice(sorted.findIndex(v => v.key === toDelete[i]), 1);
            try {
                delete cache.cacheMetadataRefs['k' + toDelete[i]];
            } catch(e) {}
        }
        cache.cacheMetadataArray = sorted;
        if (cache.isOpfsCachingEnabled) {
           delManyOPFSKV(toDelete, cache.cacheStore)
                .thenApply(() => { callback();cache.evicting=false;});
        } else {
            delManyIDBKV(toDelete, cache.cacheStore)
                .then(() => {
                    delManyIDBKV(toDelete, cache.cacheStoreMetadata)
                        .then(() => { callback();cache.evicting=false;})
                        .catch((err) => {
                            console.log("block cache metadata evict error:" + err);
                            clearCacheFully(cache, function(){callback();cache.evicting=false;});
                        });
                }).catch((err) => {
                    console.log("block cache evict error:" + err);
                    clearCacheFully(cache, function(){callback();cache.evicting=false;});
            });
        }
    }
}
function createBlockCacheMetadataRecord(key, blockLength) {
    let now = new Date();
    let length = blockLength + (key.length * 2);
    let json = {key: key, l: length, t: now.getTime()};
    var record = JSON.stringify(json);
    json.l = length + record.length;//close enough
    return json;
}
//public native CompletableFuture<Boolean> put(Cid hash, byte[] data);
function putIntoCacheProm(hash, data) {
    let future = peergos.shared.util.Futures.incomplete();
    if (this.maxSizeBytes == 0 || !this.isCachingEnabled) {
        future.complete(true);
    } else {
        let that = this;
        let key = hash.toString();
        if (this.isOpfsCachingEnabled) {
            if (data.byteLength == 0) {
                console.log("OPFS: attempt to write 0 byte data. hash:" + key);
                future.complete(true); //We don't want to force .exceptionally() handling and OPFS is just a cache, so .get() can return empty.
            } else {
                setOPFSKV(key, data, this.cacheStore).thenApply(() => {
                    that.currentCacheSize = that.currentCacheSize + data.byteLength;
                    let now = new Date();
                    let metaData = {key: key, l: data.byteLength, t: now.getTime()};
                    let length = that.cacheMetadataArray.length;
                    that.cacheMetadataArray.push(metaData);
                    that.cacheMetadataRefs['k'+metaData.key] = that.cacheMetadataArray[length];
                    that.currentCacheBlockCount = that.currentCacheBlockCount + 1;
                    if (triggerEviction(this)) {
                        evictLRU(this, function() {future.complete(true)});
                    } else {
                        future.complete(true);
                    }
                });
            }
        } else {
            setIDBKV(key, data, this.cacheStore).then(() => {
                let metaData = createBlockCacheMetadataRecord(key, data.byteLength);
                that.currentCacheSize = that.currentCacheSize + metaData.l;
                setIDBKV(key, JSON.stringify(metaData), that.cacheStoreMetadata).then(() => {
                    let length = that.cacheMetadataArray.length;
                    that.cacheMetadataArray.push(metaData);
                    that.cacheMetadataRefs['k'+metaData.key] = that.cacheMetadataArray[length];
                    that.currentCacheBlockCount = that.currentCacheBlockCount + 1;
                    if (triggerEviction(this)) {
                        evictLRU(this, function() {future.complete(true)});
                    } else {
                        future.complete(true);
                    }
                }).catch(err => {
                    delIDBKV(key, that.cacheStore).then(() => {
                        future.complete(true);
                    });
                });
            }).catch(err => {
                evictLRU(blockStoreCache, function() {future.complete(true)});
            });
        }
    }
    return future;
}
function noop() {
}
//public native CompletableFuture<Optional<byte[]>> get(Cid hash);
function getFromCacheProm(hash) {
    let future = peergos.shared.util.Futures.incomplete();
    return getFromCachePromWithRetry(this, future, hash);
}
function getFromCachePromWithRetry(context, future, hash) {
    let that = context;
    if (!that.isCachingEnabled) {
        future.complete(peergos.client.JsUtil.emptyOptional());
    } else {
        let key = hash.toString();
        if (that.isOpfsCachingEnabled) {
            getOPFSKV(key, that.cacheStore).thenApply((val) => {
                if (val == null) {
                    future.complete(peergos.client.JsUtil.emptyOptional());
                } else {
                    try {
                        let now = new Date();
                        that.cacheMetadataRefs['k'+key].t = now.getTime();
                    } catch(e) {}
                    future.complete(peergos.client.JsUtil.optionalOf(convertToByteArray(val)));
                }
            });
        } else {
            getIDBKV(key, that.cacheStore).then((val) => {
                if (val == null) {
                    future.complete(peergos.client.JsUtil.emptyOptional());
                } else {
                    setTimeout(() => {
                        let metaData = createBlockCacheMetadataRecord(key, val.length);
                        setIDBKV(key, JSON.stringify(metaData), that.cacheStoreMetadata).then(() => {
                            try {
                                let now = new Date();
                                that.cacheMetadataRefs['k'+key].t = now.getTime();
                            } catch(e) {}
                        }).catch(err => {
                            noop();
                        });
                    });
                    future.complete(peergos.client.JsUtil.optionalOf(convertToByteArray(val)));
                }
            });
        }
    }
    return future;
}
//public native boolean hasBlock(Cid hash);
function hasBlockInCache(hash) {
    return this.cacheEntrySizes.get(hash.toString()) != null;
}
//public native CompletableFuture<Boolean> clear();
function clearCache() {
    let future = peergos.shared.util.Futures.incomplete();
    if (cache.isCachingEnabled) {
        clearCacheFully(this, function() {
            future.complete(true);
        });
    } else {
        future.complete(true);
    }
    return future;
}
function removeIndexedDBIfExists() {
    let future = peergos.shared.util.Futures.incomplete();
    let cacheStore = createStoreIDBKV('data', 'keyval');
    let cacheStoreMetadata = createStoreIDBKV('metadata', 'keyval');
    clearIDBKV(cacheStore).then((res1) => {
        clearIDBKV(cacheStoreMetadata).then((res2) => {
            future.complete(true);
        });
    });
    return future;
}
function clearCacheFully(cache, func) {
    if (cache.isCachingEnabled) {
        cache.cacheMetadataArray = [];
        cache.cacheMetadataRefs = {};
        cache.currentCacheSize = 0;
        if (cache.isOpfsCachingEnabled) {
            clearOPFSKV(cache.cacheStore).thenApply((res2) => func());
        } else {
            clearIDBKV(cache.cacheStore).then((res1) => {
                clearIDBKV(cache.cacheStoreMetadata).then((res2) => func());
            });
        }
    } else {
        func();
    }
}

var pointerCache = {
    NativeJSPointerCache: function() {
    this.cachePointerStore = createStoreIDBKV('pointers', 'keyval');
    this.cachePointerStoreMetadata = createStoreIDBKV('pmetadata', 'keyval');
    this.cachePointerMetadataArray = [];
    this.cachePointerRefs = {};
    this.maxItems = 2000;
    this.currentCacheSize = 0;
    this.evicting = false;
    this.isCachingEnabled = false;
    this.init = function init(maxItems) {
        let that = this;
        bindPointerCacheStore(that);
        isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
            that.isCachingEnabled = isCachingEnabled;
            if (isCachingEnabled) {
                valuesIDBKV(that.cachePointerStoreMetadata).then((values) => {
                    values.forEach((value, idx) => {
                        let json = JSON.parse(value);
                        that.cachePointerMetadataArray.push(json);
                        that.cachePointerRefs['k'+json.key] = that.cachePointerMetadataArray[idx];
                    });
                    that.currentCacheSize = values.length;
                    console.log('Pointer Cache. Objects:' + that.currentCacheSize);
                });
            }
        });
    };
	this.put = putIntoPointerCacheProm;
	this.get = getFromPointerCacheProm;
    }
};

function bindPointerCacheStore(storeCache) {
    pointerStoreCache = storeCache;
}
function triggerPointerCacheEviction(cache) {
    //above 90% of max
    return (cache.currentCacheSize / cache.maxItems) * 100.0 > 90.0;
}
function reclaimPointerCache(cache) {
    //80% of max
    return Math.floor(cache.maxItems / 100 * 80);
}
function evictPointerCacheLRU(cache, callback) {
    if (cache.evicting || !cache.isCachingEnabled) {
        return;
    }
    cache.evicting = true;
    let sorted = cache.cachePointerMetadataArray.slice().sort((a, b) => a.t < b.t);
    var cacheSize = cache.currentCacheSize;
    let toDelete = [];
    let newLimit = reclaimPointerCache(cache);
    if (cacheSize <= newLimit) {
        callback();
        cache.evicting=false;
    } else {
        for(var i=0; i < sorted.length; i++) {
            cacheSize--;
            toDelete.push(sorted[i].key);
            if (cacheSize <= newLimit) {
                cache.currentCacheSize = cacheSize;
                break;
            }
        }
        for (var i=0; i < toDelete.length; i++) {
            sorted.splice(sorted.findIndex(v => v.key === toDelete[i]), 1);
            try {
                delete cache.cachePointerRefs['k' + toDelete[i]];
            } catch(e) {}
        }
        cache.cachePointerMetadataArray = sorted;
        delManyIDBKV(toDelete, cache.cachePointerStore)
            .then(() => {
                delManyIDBKV(toDelete, cache.cachePointerStoreMetadata)
                    .then(() => { callback();cache.evicting=false;})
                    .catch((err) => {
                        console.log("pointer cache metadata evict error:" + err);
                        clearPointerCacheFully(cache, function(){callback();cache.evicting=false;});
                    });
            }).catch((err) => {
                console.log("pointer cache evict error:" + err);
                clearPointerCacheFully(cache, function(){callback();cache.evicting=false;});
        });
    }
}
//    public native CompletableFuture<Boolean> put(PublicKeyHash owner, PublicKeyHash writer, byte[] writerSignedBtreeRootHash);
function putIntoPointerCacheProm(owner, writer, writerSignedBtreeRootHash) {
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(true);
    } else {
        let that = this;
        let key = owner.toString() + "-" + writer.toString();
        setIDBKV(key, writerSignedBtreeRootHash, this.cachePointerStore).then(() => {
            let now = new Date();
            let json = {key: key, t: now.getTime()};
            let value = JSON.stringify(json);
            that.currentCacheSize++;
            setIDBKV(key, value, that.cachePointerStoreMetadata).then(() => {
                let length = that.cachePointerMetadataArray.length;
                that.cachePointerMetadataArray.push(json);
                that.cachePointerRefs['k'+json.key] = that.cachePointerMetadataArray[length];
                if (triggerPointerCacheEviction(this)) {
                    evictPointerCacheLRU(this, function() {future.complete(true)});
                } else {
                    future.complete(true);
                }
            }).catch(err => {
                delIDBKV(key, that.cachePointerStore).then(() => {
                    future.complete(true);
                });
            });
        }).catch(err => {
            future.complete(true);
        });
    }
    return future;
}
//    public native CompletableFuture<Optional<byte[]>> get(PublicKeyHash owner, PublicKeyHash writer);
function getFromPointerCacheProm(owner, writer) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(peergos.client.JsUtil.emptyOptional());
    } else {
        let key = owner.toString() + "-" + writer.toString();
        getIDBKV(key, this.cachePointerStore).then((val) => {
            if (val == null) {
                future.complete(peergos.client.JsUtil.emptyOptional());
            } else {
                setTimeout(() => {
                    let now = new Date();
                    let json = {key: key, t: now.getTime()};
                    setIDBKV(key, JSON.stringify(json), that.cachePointerStoreMetadata).then(() => {
                        try {
                            let now = new Date();
                            that.cachePointerRefs['k'+key].t = now.getTime();
                        } catch(e) {}
                    }).catch(err => {
                        noop();
                    });
                });
                future.complete(peergos.client.JsUtil.optionalOf(convertToByteArray(val)));
            }
        });
    }
    return future;
}
function clearPointerCacheFully(cache, func) {
    if (cache.isCachingEnabled) {
        cache.cachePointerMetadataArray = [];
        cache.currentCacheSize = 0;
        cache.cachePointerRefs = {};
        clearIDBKV(cache.cachePointerStore).then((res1) => {
            clearIDBKV(cache.cachePointerStoreMetadata).then((res2) => func());
        });
    } else {
        func();
    }
}

var batCache = {
    NativeJSBatCache: function() {
    this.cacheBatStore = createStoreIDBKV('bats', 'keyval');
    this.isCachingEnabled = false;
    this.init = function init() {
        let that = this;
        bindBatCacheStore(that);
        isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
            that.isCachingEnabled = isCachingEnabled;
            if (isCachingEnabled) {
                valuesIDBKV(that.cacheBatStore).then((values) => {
                    console.log('Bat Cache. Objects:' + values.length);
                });
            }
        });
    };
	this.setUserBats = setUserBatsIntoCacheProm;
	this.getUserBats = getUserBatsFromCacheProm;
    }
};

function bindBatCacheStore(storeCache) {
    batStoreCache = storeCache;
}
//        public native CompletableFuture<Boolean> setUserBats(String username, byte[] serialisedBats);
function setUserBatsIntoCacheProm(username, serialisedBats) {
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(true);
    } else {
        let that = this;
        setIDBKV(username, serialisedBats, this.cacheBatStore).then(() => {
            future.complete(true);
        }).catch(err => {
            future.complete(true);
        });
    }
    return future;
}

//    public native CompletableFuture<byte[]> getUserBats(String username);
function getUserBatsFromCacheProm(username) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(null);
    } else {
        getIDBKV(username, this.cacheBatStore).then((val) => {
            if (val == null) {
                future.complete(null);
            } else {
                future.complete(convertToByteArray(val));
            }
        });
    }
    return future;
}

function clearBatCacheFully(func) {
    if (batStoreCache.isCachingEnabled) {
        clearIDBKV(batStoreCache.cacheBatStore).then(res => func());
    } else {
        func();
    }
}

function getRootKeyEntryFromCacheProm() {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
        if (isCachingEnabled) {
            that.rootKeyCache = createStoreIDBKV('rootKey', 'keyval');
            getIDBKV('rootKey', that.rootKeyCache).then((val) => {
                if (val == null) {
                    future.complete(null);
                } else {
                    decodeRootKey(val, future);
                }
            });
        } else {
            let val = window.localStorage.getItem('logindata-rootKey');
            if (val == null) {
                future.complete(null);
            } else {
                decodeRootKey(val, future);
            }
        }
    });
    return future;
}
function decodeRootKey(val, future) {
    let json = JSON.parse(val);
    let storedUsername = json.username;
    let binary = window.atob(json.rootKey);
    var data = new Int8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
    }
    let storedRootKey =  convertToByteArray(data);
    future.complete({username: storedUsername, rootKey: storedRootKey});
}
function setRootKeyIntoCacheProm(username, rootKeySerialised) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
        let encodedRootKey = encodeRootKey(username, rootKeySerialised);
        if (isCachingEnabled) {
            that.rootKeyCache = createStoreIDBKV('rootKey', 'keyval');
            setIDBKV('rootKey', encodedRootKey, that.rootKeyCache).then(() => {
                future.complete(true);
            }).catch(err => {
                future.complete(false);
            });
        } else {
            window.localStorage.setItem('logindata-rootKey', encodedRootKey);
            future.complete(true);
        }
    });
    return future;
}
function encodeRootKey(username, rootKeySerialised) {
    let json = {};
    json.username = username;
    var str = "";
    for (let i = 0; i < rootKeySerialised.byteLength; i++) {
        str = str + String.fromCharCode(rootKeySerialised[i] & 0xff);
    }
    json.rootKey = window.btoa(str);
    let asStr = JSON.stringify(json);
    return asStr;
}
function clearRootKeyCacheFully(func) {
    if (rootKeyCache != null) {
        clearIDBKV(rootKeyCache).then(res => func());
    } else {
        window.localStorage.removeItem('logindata-rootKey');
        func();
    }
}

var accountCache = {
    NativeJSAccountCache: function() {
    this.cacheAccountStore = createStoreIDBKV('account', 'keyval');
    this.isCachingEnabled = false;
    this.offlineAccess = true;
    this.init = function init() {
        let that = this;
        bindAccountCacheStore(that);
        isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
            that.isCachingEnabled = isCachingEnabled;
        });
    };
	this.setLoginData = setLoginDataIntoCacheProm;
	this.remove = removeLoginDataFromCacheProm;
	this.getEntryData = getEntryDataFromCacheProm;
    }
};

function bindAccountCacheStore(storeCache) {
    accountStoreCache = storeCache;
}
//      public native CompletableFuture<Boolean> setLoginData(String key, byte[] entryPoints);
function setLoginDataIntoCacheProm(key, entryPoints) {
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        let encodedEntryPoints = encodeEntryPoints(entryPoints);
        window.localStorage.setItem('logindata-' + key, encodedEntryPoints);
        future.complete(true);
    } else {
        let that = this;
        setIDBKV(key, entryPoints, this.cacheAccountStore).then(() => {
            future.complete(true);
        }).catch(err => {
            future.complete(true);
        });
    }
    return future;
}
function encodeEntryPoints(entryPoints) {
    var str = "";
    for (let i = 0; i < entryPoints.byteLength; i++) {
        str = str + String.fromCharCode(entryPoints[i] & 0xff);
    }
    return window.btoa(str);
}
function removeLoginDataFromCacheProm(key) {
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        window.localStorage.removeItem('logindata-' + key);
        future.complete(true);
    } else {
        let that = this;
        delIDBKV(key, this.cacheAccountStore).then(() => {
            future.complete(true);
        }).catch(err => {
            future.complete(true);
        });
    }
    return future;
}

//      public native CompletableFuture<byte[]> getEntryData(String key);
function getEntryDataFromCacheProm(key) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        let val = window.localStorage.getItem('logindata-' + key);
        if (val == null) {
            future.complete(null);
        } else {
            decodeEntryData(val, future);
        }
    } else {
        getIDBKV(key, this.cacheAccountStore).then((val) => {
            if (val == null) {
                future.complete(null);
            } else {
                future.complete(convertToByteArray(val));
            }
        });
    }
    return future;
}

function directGetEntryDataFromCacheProm(key) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
        if (!isCachingEnabled) {
            let val = window.localStorage.getItem('logindata-' + key);
            if (val == null) {
                future.complete(null);
            } else {
                decodeEntryData(val, future);
            }
        } else {
            let accountStoreCache = createStoreIDBKV('account', 'keyval');
            getIDBKV(key, accountStoreCache).then((val) => {
                if (val == null) {
                    future.complete(null);
                } else {
                    future.complete(convertToByteArray(val));
                }
            });
        }
    });
    return future;
}
function decodeEntryData(val, future) {
    let binary = window.atob(val);
    var data = new Int8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        data[i] = binary.charCodeAt(i);
    }
    future.complete(convertToByteArray(data));
}
function clearAccountCacheFully(func) {
    if (accountStoreCache.isCachingEnabled) {
        clearIDBKV(accountStoreCache.cacheAccountStore).then(res => func());
    } else {
        for (var i = 0; i < window.localStorage.length; i++) {
            let key = window.localStorage.key(i);
            if (key.startsWith('logindata-')) {
                window.localStorage.removeItem('logindata-' + key);
            }
        }
        func();
    }
}

var pkiCache = {
    NativeJSPkiCache: function() {
    this.cachePkiStore = createStoreIDBKV('pki', 'keyval');
    this.cachePkiOwnerToUsernameStore = createStoreIDBKV('pkiOwnerToUsername', 'keyval');
    this.isCachingEnabled = false;
    this.init = function init() {
        let that = this;
        bindPkiCacheStore(that);
        isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
            that.isCachingEnabled = isCachingEnabled;
        });
    };
	this.getChain = getChainFromCacheProm;
	this.setChain = setChainIntoCacheProm;
	this.getUsername = getUsernameFromCacheProm;
    }
};

function bindPkiCacheStore(storeCache) {
    pkiStoreCache = storeCache;
}

//    public native CompletableFuture<Boolean> setChain(String username, String[] serialisedUserPublicKeyLinkChain, String serialisedOwner);
function setChainIntoCacheProm(username, serialisedUserPublicKeyLinkChain, serialisedOwner) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(true);
    } else {
        let that = this;
        let jsChain = [];
        for(var i = 0; i < serialisedUserPublicKeyLinkChain.length; i++) {
            jsChain.push(serialisedUserPublicKeyLinkChain[i]);
        }
        setIDBKV(username, jsChain, this.cachePkiStore).then(() => {
            setIDBKV(serialisedOwner, username, that.cachePkiOwnerToUsernameStore).then(() => {
                future.complete(true);
            }).catch(err => {
                delIDBKV(username, that.cachePkiStore).then(() => {
                    future.complete(true);
                });
            });
        }).catch(err => {
            future.complete(true);
        });
    }
    return future;
}

//    public native CompletableFuture<List<String>> getChain(String username);
function getChainFromCacheProm(username) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(peergos.client.JsUtil.emptyList());
    } else {
        getIDBKV(username, this.cachePkiStore).then((val) => {
            if (val == null) {
                future.complete(peergos.client.JsUtil.emptyList());
            } else {
                future.complete(peergos.client.JsUtil.asList(val));
            }
        });
    }
    return future;
}

//    public native CompletableFuture<String> getUsername(String serialisedPublicKeyHash);
function getUsernameFromCacheProm(serialisedPublicKeyHash) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete("");
    } else {
        getIDBKV(serialisedPublicKeyHash, this.cachePkiOwnerToUsernameStore).then((username) => {
            if (username == null) {
                future.complete("");
            } else {
                future.complete(username);
            }
        });
    }
    return future;
}

function clearPkiCacheFully(func) {
    if (pkiStoreCache.isCachingEnabled) {
        clearIDBKV(pkiStoreCache.cachePkiStore).then(res => {
            clearIDBKV(pkiStoreCache.cachePkiOwnerToUsernameStore).then(res => {
                func();
            });
        });
    } else {
        func();
    }
}

function decodeUTF8(s) {
  var i, d = unescape(encodeURIComponent(s)), b = new Uint8Array(d.length);
  for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
  return b;
}

function decodeBase64(s) {
  if (typeof atob === 'undefined') {
    return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));
  } else {
    var i, d = atob(s), b = new Uint8Array(d.length);
    for (i = 0; i < d.length; i++) b[i] = d.charCodeAt(i);
    return b;
  }
}

function hashToKeyBytesProm(username, password, algorithm) {
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
        var t1 = Date.now();
        var hash = sha256(decodeUTF8(password));
        var salt = decodeUTF8(username)
	if (algorithm.getType().value != 1)
	    throw "Unknown UserGenerationAlgorithm type: " + algorithm.getType();
	var memCost = algorithm.memoryCost;
	var cpuCost = algorithm.cpuCost;
	var outputBytes = algorithm.outputBytes;
	var parallelism = algorithm.parallelism;
	if (parallelism != 1)
	    throw "Unimplemented scrypt parallelism: " + parallelism;
	
        scrypt(hash, salt, memCost, cpuCost, outputBytes, 1000, function(keyBytes) {
            console.log("JS Scrypt complete in: "+ (Date.now()-t1)+"mS");
            var hashedBytes = decodeBase64(keyBytes);
            resolve(hashedBytes);
        }, 'base64');  
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(err);
        else
            future.complete(convertToByteArray(new Int8Array(result)));
    });
    return future;
}

function generateRandomBytes(len) {    
    var bytes = nacl.randomBytes(len);
    return convertToByteArray(new Int8Array(bytes));
}

function generateSecretbox(data, nonce, key) {
    var bytes = nacl.secretbox(new Uint8Array(data), new Uint8Array(nonce), new Uint8Array(key));
    return convertToByteArray(new Int8Array(bytes));
}

function generateSecretbox_open(cipher, nonce, key) {
    var bytes = nacl.secretbox.open(new Uint8Array(cipher), new Uint8Array(nonce), new Uint8Array(key));
    if(bytes === null) {
        throw "Invalid encryption!";
    }
    return convertToByteArray(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}

function generateCrypto_sign_open(signed, publicSigningKey) {
    var future = peergos.shared.util.Futures.incomplete();
    var bytes = nacl.sign.open(new Uint8Array(signed), new Uint8Array(publicSigningKey));
    if (bytes != null)
        future.complete(convertToByteArray(new Int8Array(bytes)));
    else
        future.completeExceptionally(java.lang.Throwable.of(Error("Invalid signature")));
    return future;
}

var derHeaderPublic = [48, 42, 48, 5, 6, 3, 43, 101, 112, 3, 33, 0];

function generateCrypto_sign_open_webcrypto(signed, publicSigningKey) {
    var future = peergos.shared.util.Futures.incomplete();
    let signature = signed.slice(0, 64);
    let encoded = signed.slice(64, signed.length);
    var spki = new Int8Array(44);
    for (var i=0; i < 12; i++)
        spki[i] = derHeaderPublic[i];
    for (var i=0; i < 32; i++)
        spki[12+i] = publicSigningKey[i];
    window.crypto.subtle.importKey("spki", spki, "Ed25519", false, ["verify"]).then(publicKey => {
        return window.crypto.subtle.verify(
            "Ed25519",
            publicKey,
            signature,
            encoded
        ).then(valid => {
            if (valid)
                future.complete(convertToByteArray(new Int8Array(encoded)));
            future.completeExceptionally(java.lang.Throwable.of(Error("Invalid signature")));
        });
    }).catch(t => {
        var bytes = nacl.sign.open(new Uint8Array(signed), new Uint8Array(publicSigningKey));
        if (bytes != null)
            future.complete(convertToByteArray(new Int8Array(bytes)));
        else
            future.completeExceptionally(java.lang.Throwable.of(Error("Invalid signature")));
    });
    return future;
}

var derHeader = [48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32];

function generateCrypto_sign(message, secretSigningKey) {
    var future = peergos.shared.util.Futures.incomplete();
    var bytes = nacl.sign(new Uint8Array(message), new Uint8Array(secretSigningKey));
    future.complete(convertToByteArray(new Int8Array(bytes)));
    return future;
}

function generateCrypto_sign_webcrypto(message, secretSigningKey) {
    var future = peergos.shared.util.Futures.incomplete();
    var pkcs8der = new Int8Array(48);
    for (var i=0; i < 16; i++)
        pkcs8der[i] = derHeader[i];
    for (var i=0; i < 32; i++)
        pkcs8der[16+i] = secretSigningKey[i]; // first 32 bytes are the private key
    window.crypto.subtle.importKey("pkcs8", pkcs8der, "Ed25519", false, ["sign"]).then(secretKey => {
        return window.crypto.subtle.sign(
            "Ed25519",
            secretKey,
            message
        ).then(signature => {
            var res = new Int8Array(signature.byteLength + message.length);
            res.set(new Int8Array(signature));
            res.set(message, signature.byteLength);
            future.complete(convertToByteArray(res));
        });
    }).catch (e => {
        var bytes = nacl.sign(new Uint8Array(message), new Uint8Array(secretSigningKey));
        future.complete(convertToByteArray(new Int8Array(bytes)));
    });
    return future;
}

function generateCrypto_sign_keypair(publicKey, secretKey) {    
    var signSeed = new Uint8Array(secretKey.slice(0, 32));
    var signPair = nacl.sign.keyPair.fromSeed(signSeed);
    for (var i=0; i < signPair.secretKey.length; i++)
        secretKey[i] = signPair.secretKey[i];
    for (var i=0; i < signPair.publicKey.length; i++)
        publicKey[i] = signPair.publicKey[i];
    
    var returnArrays = [];
    returnArrays.push(publicKey);
    returnArrays.push(secretKey);
    return returnArrays;
}

function generateCrypto_box_open(cipher, nonce, theirPublicBoxingKey, ourSecretBoxingKey) {    
    var res = nacl.box.open(new Uint8Array(cipher), new Uint8Array(nonce), new Uint8Array(theirPublicBoxingKey), new Uint8Array(ourSecretBoxingKey));
    var i8Array = new Int8Array(res);
    return convertToByteArray(i8Array);
}

function generateCrypto_box(message, nonce, theirPublicBoxingKey, ourSecretBoxingKey) {    
    var res = nacl.box(new Uint8Array(message), new Uint8Array(nonce), new Uint8Array(theirPublicBoxingKey), new Uint8Array(ourSecretBoxingKey));
    var i8Array = new Int8Array(res);
    return convertToByteArray(i8Array);
}

function generateCrypto_box_keypair(publicKey, secretKey) {    
    var boxPair = nacl.box.keyPair.fromSecretKey(new Uint8Array(secretKey));
    for (var i=0; i < boxPair.publicKey.length; i++)
        publicKey[i] = boxPair.publicKey[i];
    
    return publicKey;
}

function generate_mlkem_keypair() {
    var future = peergos.shared.util.Futures.incomplete();
    const recipient = new MlKem1024();
    recipient.generateKeyPair().then(function([pkR, skR]) {
        var pki8Array = new Int8Array(pkR);
        var pk = convertToByteArray(pki8Array);
        var ski8Array = new Int8Array(skR);
        var sk = convertToByteArray(ski8Array);
        future.complete(convertToByteArray([pk, sk]));
    });
    return future;
}

function encapsulate(pk) {
    var future = peergos.shared.util.Futures.incomplete();
    const recipient = new MlKem1024();
    recipient.encap(new Uint8Array(pk)).then(function([ct, ssS]) {
        var cti8Array = new Int8Array(ct);
        var c = convertToByteArray(cti8Array);
        var ssi8Array = new Int8Array(ssS);
        var ss = convertToByteArray(ssi8Array);
        future.complete(convertToByteArray([ss, c]));
    });
    return future;
}

function decapsulate(ct, sk) {
    var future = peergos.shared.util.Futures.incomplete();
    const recipient = new MlKem1024();
    recipient.decap(new Uint8Array(ct), new Uint8Array(sk)).then(function(ssS) {
        var ssi8Array = new Int8Array(ssS);
        var ss = convertToByteArray(ssi8Array);
        future.complete(ss);
    });
    return future;
}

if (window.crypto.subtle == null) { // polyfill webcrypto if it is absent
    console.log("Using webcrypto polyfill.");
    window.crypto.subtle = {
        digest: function(props, data) {
            return new Promise(function(resolve, reject) {
                if (props.name != "SHA-256") {
                    reject(Error("Unknown hash function: " + props.name));
                    return;
                }
                resolve(sha256(data));
            });
        }
    }
}

var tryProofOfWork = function(counter, difficulty, combined, future) {
    // Put the counter into the first 8 bytes little endian (JS can't reach 8th byte)
    combined[0] = counter;
    combined[1] = (counter >> 8);
    combined[2] = (counter >> 16);
    combined[3] = (counter >> 24);
    combined[4] = (counter / 4294967296);
    combined[5] = ((counter / 4294967296) >> 8);
    combined[6] = ((counter / 4294967296) >> 16);
    window.crypto.subtle.digest(
	{
	    name: "SHA-256",
	},
	combined
    ).then(function(hash){
	//returns the hash as an ArrayBuffer
	var data = new Int8Array(hash);
	var res = convertToByteArray(data.slice(0, 32));
	if (peergos.shared.crypto.ProofOfWork.satisfiesDifficulty(difficulty, res))
	    future.complete(peergos.shared.crypto.ProofOfWork.buildSha256(convertToByteArray(combined.slice(0, 8))));
	else
	    setTimeout(() => tryProofOfWork(counter + 1, difficulty, combined, future), 0);
    }).catch(function(err){
	future.completeExceptionally(java.lang.Throwable.of(err));
    });
}

var scryptJS = {
    NativeScryptJS: function() {
        this.hashToKeyBytes = hashToKeyBytesProm;

	this.generateProofOfWork = function(difficulty, data) {
	    var future = peergos.shared.util.Futures.incomplete();
	    var combined = new Int8Array(data.length + 8);
	    for (var i=0; i < data.length; i++)
		combined[8 + i] = data[i];
	    
	    tryProofOfWork(0, difficulty, combined, future);
	    return future;
	}
	
	this.sha256 = function(input) {
	    var future = peergos.shared.util.Futures.incomplete();
	    window.crypto.subtle.digest(
		{
		    name: "SHA-256",
		},
		input
	    ).then(function(hash){
		//returns the hash as an ArrayBuffer
		var data = new Int8Array(hash);
		var res = convertToByteArray(data.slice(0, 32));
		future.complete(res);
	    }).catch(function(err){
		future.completeExceptionally(java.lang.Throwable.of(err));
	    });
	    return future;
	}

	this.streamSha256 = function(asyncReader, fileSize) {
	    var future = peergos.shared.util.Futures.incomplete();
	    if (fileSize > 10*1024*1024) {
		var buf = peergos.shared.util.Serialize.newByteArray(5*1024*1024);
		var h = new sha256stream([]);
		var priv = {};
		
		priv.recurse = function(toRead) {
		    if (toRead == 0) {
			var res = peergos.shared.util.Futures.incomplete();
			res.complete(true);
			return res;
		    }
		    return asyncReader.readIntoArray(buf, 0, Math.min(buf.length, toRead)).thenCompose(function(bytesRead){
			h.update(bytesRead.value_0 == buf.length ? buf : buf.slice(0, bytesRead.value_0));
			return priv.recurse(toRead - bytesRead.value_0);
		    });
		}
		priv.recurse(fileSize).thenApply(function(){
		    var data = new Int8Array(h.complete());
		    var res = convertToByteArray(data.slice(0, 32));
		    future.complete(res);
		});
		return future;
	    }
	    // load entire file into ram if < 10 MiB (webcrypto is 20x faster)
            var input = peergos.shared.util.Serialize.newByteArray(fileSize);
            asyncReader.readIntoArray(input, 0, fileSize).thenApply(function(bytesRead) {
		window.crypto.subtle.digest(
		    {
			name: "SHA-256",
		    }, input).then(function(hash){
			//returns the hash as an ArrayBuffer
			var data = new Int8Array(hash);
			var res = convertToByteArray(data.slice(0, 32));
			future.complete(res);
		    }).catch(function(err){
			future.completeExceptionally(java.lang.Throwable.of(err));
		    });
            });
	    return future;
	}

	this.blake2b = function(input, outputLength) {
		var data = new Int8Array(blake2b.blake2b(input, outputLength));
	    var res = convertToByteArray(data.slice(0, outputLength));
	    return res;
	}

        this.hmacSha256 = function(secretKey, message) {
            var future = peergos.shared.util.Futures.incomplete();
            crypto.subtle.importKey(
    		'raw',
    		secretKey,
   		{ name: 'HMAC', hash: 'SHA-256' },
    		false,
    		['sign', 'verify'],
  	    ).then(function(key) {
	        return window.crypto.subtle.sign(
		    'HMAC',
                    key,
		    message
	        ).then(function(sig){
		    //returns the hash as an ArrayBuffer
		    var data = new Int8Array(sig);
		    var res = convertToByteArray(data.slice(0, 32));
		    future.complete(res);
	        }).catch(function(err){
		    future.completeExceptionally(java.lang.Throwable.of(err));
	        });
            })
	    return future;
        }
    }
};

var ForkJoinJS = {
    JSForkJoinPool: function() {
	this.execute = function(task) {
            setTimeout(() => task.run(), 0)
	}
    }
}

var thumbnail = {
    NativeJSThumbnail: function() {
        this.generateThumbnail = generateThumbnailProm;
        this.generateVideoThumbnail = generateVideoThumbnailProm;
    }   
};

var tweetNaCl = {
    useWebcyptoVerify : false,
    useWebcyptoSign : false,    
    JSNaCl: function() {
        this.randombytes = generateRandomBytes;
        this.secretbox = generateSecretbox;
        this.secretbox_open = generateSecretbox_open;

        if (tweetNaCl.useWebcryptoVerify) {
            this.crypto_sign_open = generateCrypto_sign_open_webcrypto;
        } else {
            this.crypto_sign_open = generateCrypto_sign_open;
        }
        if (tweetNaCl.useWebcryptoSign) {
            this.crypto_sign = generateCrypto_sign_webcrypto;
        } else {
            this.crypto_sign = generateCrypto_sign;
        }
            
        this.crypto_sign_keypair = generateCrypto_sign_keypair;
        this.crypto_box_open = generateCrypto_box_open;
        this.crypto_box = generateCrypto_box;
        this.crypto_box_keypair = generateCrypto_box_keypair;
        this.generateMlkemKeyPair = generate_mlkem_keypair;
        this.encapsulate = encapsulate;
        this.decapsulate = decapsulate;
    }   
};

// use webcrypto verify if present
var spki = new Int8Array(44);
for (var i=0; i < 12; i++)
    spki[i] = derHeaderPublic[i];
window.crypto.subtle.importKey != null && window.crypto.subtle.importKey("spki", spki, "Ed25519", false, ["verify"]).then(publicKey => {
    console.log("Using optimised webcrypto Ed25519 verify implementation.");
    tweetNaCl.useWebcryptoVerify = true;
});
// use webcrypto sign if present
var pkcs8der = new Int8Array(48);
for (var i=0; i < 16; i++)
    pkcs8der[i] = derHeader[i];
window.crypto.subtle.importKey != null && window.crypto.subtle.importKey("pkcs8", pkcs8der, "Ed25519", false, ["sign"]).then(secretKey => {
    console.log("Using optimised webcrypto Ed25519 sign implementation.");
    tweetNaCl.useWebcryptoSign = true;
});


var browserio = {
    JSFileReader: function(file) {
	this.name = file.name;
	this.file = file;
	this.size = file.size;
	this.offset = 0;
	
	this.seek = function(hi, low) {
	    this.offset = low;
	    var fut = peergos.shared.util.Futures.incomplete();
	    fut.complete(true);
	    return fut;
	}

	this.readIntoArray = function(res, offset, length) {
	    var future = peergos.shared.util.Futures.incomplete();

	    var filereader = new FileReader();
	    filereader.file_name = file.name;
	    filereader.onload = function(){
		const data = new Uint8Array(this.result);
		for (var i=0; i < length; i++)
		    res[offset + i] = data[i];
		future.complete({value_0:length});
	    };
	    
	    filereader.readAsArrayBuffer(file.slice(this.offset, this.offset + length));
	    this.offset += length;
	    return future;
	}

	this.reset = function() {
	    this.offset = 0;
	    var fut = peergos.shared.util.Futures.incomplete();
	    fut.complete(true);
	    return fut;
	}

	this.close = function() {
	    
	}
    }
};

function generateThumbnailProm(asyncReader, fileSize, filename) {
    var future = peergos.shared.util.Futures.incomplete();
    var bytes = peergos.shared.util.Serialize.newByteArray(fileSize);
    asyncReader.readIntoArray(bytes, 0, fileSize).thenApply(function(bytesRead) {
        renderThumbnail(bytes, future, 400, filename);
    });
    return future;
}

function renderThumbnail(bytes, future, size, filename) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var img = new Image();
    img.onload = function(){
        getThumbnailFromCanvas(canvas, img, img.width, img.height, size, future);
    }
    img.onerror = function(e) {
	    console.log("thumbnail generation failed for:" + filename);
	future.complete("");
    }
    var blob = new Blob([new Uint8Array(bytes)], {type: "octet/stream"});
    var url = window.URL.createObjectURL(blob);
    img.src = url;
}

function getThumbnailFromCanvas(canvas, img, width, height, size, future) {
    if (img != null) {
        let tall = height > width;
        let canvasWidth = tall ? width*size/height : size;
        let canvasHeight = tall ? size : height*size/width;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        let context = canvas.getContext('2d', { willReadFrequently: true });
        //canvas.getContext('2d').drawImage(img, 0, 0, width, height, 0, 0, canvasWidth, canvasHeight);
        try {
            context.drawImage(img, 0, 0, width, height, 0, 0, canvasWidth, canvasHeight);
        } catch (ex) {
            console.log("Unable to capture thumbnail. Maybe blocked by browser addon?");
            future.complete("");
            return;
        }
    }
    var dataUrl = canvas.toDataURL("image/webp");
    if (dataUrl.startsWith("data:image/png")) {
        // browser doesn't support webp
        dataUrl = canvas.toDataURL("image/jpeg");
    }
    let byteSize = dataUrl.substring(dataUrl.indexOf(",")+1).length * 3 / 4;
    if (byteSize < 100*1024) {
        future.complete(dataUrl);
        return;
    }
    return getThumbnailFromCanvas(canvas, img, width, height, size/2, future);
}

function supportsStreaming() {
    try {
        return 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
    } catch(err) {
        return false;
    }
}

function generateVideoThumbnailProm(asyncReader, fileSize, fileName, mimeType) {
    var future = peergos.shared.util.Futures.incomplete();
    if(supportsStreaming() && fileSize > 50 * 1000 * 1000) {
        return createVideoThumbnailStreamingProm(future, asyncReader, fileSize, fileName, mimeType);
    }else{
        return createVideoThumbnailProm(future, asyncReader, fileSize, fileName, mimeType);
    }
}

function createVideoThumbnailProm(future, asyncReader, fileSize, fileName, mimeType) {
    let bytes = peergos.shared.util.Serialize.newByteArray(fileSize);
    asyncReader.readIntoArray(bytes, 0, fileSize).thenApply(function(bytesRead) {
        var increment = 0;
        var currentIncrement = 0;                                                   
        let size = 400;   
        let video = document.createElement('video');
        video.onloadedmetadata = function(){
            let thumbnailGenerator = () => {
                let duration = video.duration;
                if(increment == 0) {
                    increment = duration / 10;
                    currentIncrement = increment; //skip over intro                                          
                }
                currentIncrement = currentIncrement + increment;
                if(currentIncrement < duration){
                    let vHeight = video.videoHeight;
                    let vWidth = video.videoWidth;
                    if (vHeight == 0) {
                        future.complete("");
                        return;
                    }
                    let tall = vHeight > vWidth;
                    let width = tall ? vWidth*size/vHeight : size;
                    let height = tall ? size : vHeight*size/vWidth;
                    captureThumbnail(width, height, currentIncrement, video).thenApply((thumbnail)=>{
                        if (thumbnail == null) {
                            future.complete("");
                        } else if(thumbnail.length == 0){
                            setTimeout(function(){thumbnailGenerator();}, 1000);
                        } else {
                            future.complete(thumbnail);
                        }
                    })
                } else {
                    future.complete("");
                }
            };
            thumbnailGenerator();
       };
        video.onerror = function(e) {
            console.log(e);
            future.complete("");
        }
        let blob = new Blob([new Uint8Array(bytes)], {type: mimeType});
        var url = (window.webkitURL || window.URL).createObjectURL(blob);
        video.src = url;
    });
    return future;
}
function captureThumbnail(width, height, currentIncrement, video){
    let capturingFuture = peergos.shared.util.Futures.incomplete();   
    video.currentTime = currentIncrement;

    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    let blackWhiteThreshold = width * height / 10 * 8; //80%
    setTimeout(() => {
            let context = canvas.getContext('2d', { willReadFrequently: true });
            try {
                context.drawImage(video, 0, 0, width, height);
            } catch (ex) {
                console.log("Unable to capture thumbnail. Maybe blocked by browser addon?");
                capturingFuture.complete(null);
                return;
            }
            let imageData = context.getImageData(0, 0, width, height);
            if(isLikelyValidImage(imageData, blackWhiteThreshold)) {
                getThumbnailFromCanvas(canvas, null, width, height, Math.max(width, height), capturingFuture);
            } else {
                capturingFuture.complete("");
            }
    }, 1000);
    return capturingFuture;
}

//Make sure image is not all black or all white
function isLikelyValidImage(imageData, blackWhiteThreshold) {
    let pix = imageData.data;
    var blackCount = 0;
    var whiteCount = 0;
    var isValidImage = true;
    for (var i = 0, n = pix.length; i < n; i += 4) {
        let total = pix[i] + pix[i+1] + pix[i+2];
        if(total < 20) {
            if(++blackCount > blackWhiteThreshold) {
                isValidImage = false;
                break;
            }
        }else if(total > 760) {
            if(++whiteCount > blackWhiteThreshold) {
                isValidImage = false;
                break;
            }
        }
    }
    return isValidImage;
}
function buildHeader(uuid) {
    let encoder = new TextEncoder();
    let uuidBytes = encoder.encode(uuid);
    let uuidSize = uuidBytes.byteLength;
    let headerSize = 1 + uuidSize;
    var data = new Uint8Array(headerSize);
    var offset = 0;
    data.set([uuidSize], offset);
    offset = offset + 1;
    data.set(uuidBytes, offset);
    return data;
}
function createVideoThumbnailStreamingProm(future, asyncReader, size, filename, mimeType) {
    let maxBlockSize = 1024 * 1024 * 5;
    var result = { done: false};
    function Context(asyncReader, sizeHigh, sizeLow) {
        this.maxBlockSize = 1024 * 1024 * 5;
        this.writer = null;
        this.asyncReader = asyncReader;
        this.sizeHigh = sizeHigh,
        this.sizeLow = sizeLow;
        this.stream = function(seekHi, seekLo, length, uuid) {
            var work = function(thatRef, header) {
                var currentSize = length;
                var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize : currentSize;
                var pump = function(reader) {
                    if(blockSize > 0) {
                        var bytes = new Uint8Array(blockSize + header.byteLength);
                        for(var i=0;i < header.byteLength;i++){
                            bytes[i] = header[i];
                        }
                        var data = convertToByteArray(bytes);
                        reader.readIntoArray(data, header.byteLength, blockSize).thenApply(function(read){
                               currentSize = currentSize - read.value_0;
                               blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                               thatRef.writer.write(data);
                               pump(reader);
                        }).exceptionally(function (throwable) {
                            console.log('createVideoThumbnailStreamingProm readIntoArray failed: ' + throwable);
                            future.complete("");
                        });
                    }
                }
                asyncReader.seekJS(seekHi, seekLo).thenApply(function(seekReader){
                    pump(seekReader);
                }).exceptionally(function (throwable) {
                    console.log('createVideoThumbnailStreamingProm seekJS failed: ' + throwable);
                    future.complete("");
                })
            }
            work(this, buildHeader(uuid));
        }
    }
    const context = new Context(asyncReader, 0, size);
    let fileStream = streamSaver.createWriteStream("media-" + filename, mimeType, function(url){
        let width = 400, height = 400;
        let video = document.createElement('video');
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        let blackWhiteThreshold = width * height / 10 * 8; //80%
        video.muted = true;

        video.onerror = function(e) {
            console.log("unable to create video thumbnail onerror: " + e);
            if(! result.done) {
                result.done = true;
                video.pause();
                future.complete("");
            }
        }

        video.onloadedmetadata = function(){
            video.currentTime = 10;
        }
        video.oncanplay = function(){
            let thumbnailGenerator = () => {
                try {
                    //console.log("in oncanplay time= " + video.currentTime);
                    if (! result.done) {
                        if (video.currentTime >= 10) {
                            if (video.currentTime >= video.duration || video.currentTime > 30) {
                                console.log("unable to create video thumbnail within time");
                                result.done = true;
                                video.pause();
                                future.complete("");
                                return;
                            }
                            let context = canvas.getContext('2d', { willReadFrequently: true });
                            try {
                                context.drawImage(video, 0, 0, width, height);
                            } catch (ex) {
                                console.log("Unable to capture thumbnail. Maybe blocked by browser addon?");
                                future.complete("");
                                return;
                            }
                            let imageData = context.getImageData(0, 0, width, height);
                            if (isLikelyValidImage(imageData, blackWhiteThreshold)) {
                                result.done = true;
                                video.pause();
                                getThumbnailFromCanvas(canvas, null, width, height, width, future);
                            } else {
                                if (! result.done) {
                                    setTimeout(function(){thumbnailGenerator();}, 1000);
                                }
                            }
                        } else {
                            setTimeout(function(){thumbnailGenerator();}, 1000);
                        }
                    }
                }catch(e) {
                    console.log("unable to create video thumbnail: " + e);
                    result.done = true;
                    video.pause();
                    future.complete("");
                }
            };
            if(! result.done) {
                setTimeout(function(){thumbnailGenerator();}, 1000);
            }
        }
        video.src = url;
        video.play();
    }, function(seekHi, seekLo, seekLength, uuid){
        context.stream(seekHi, seekLo, seekLength, uuid);
    }, undefined, size);
    context.writer = fileStream.getWriter();
    return future;
}
