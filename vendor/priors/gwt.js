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
        } else if (req.status == 429) {
	    future.completeExceptionally(new peergos.shared.storage.RateLimitException());
        } else {
	        future.completeExceptionally(java.lang.Throwable.of(Error(req.getResponseHeader("Trailer"))));
        }
    };
    
    req.onerror = function(e) {
        future.completeExceptionally(new java.net.ConnectException("Unable to connect"));
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
                    future.completeExceptionally(new peergos.shared.storage.StorageQuotaExceededException(trailer));
                } else {
                    reject(trailer);
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

function postMultipartProm(url, dataArrays) {
    var future = peergos.shared.util.Futures.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('POST', url);
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
	    console.log(e);
            reject(Error("Network Error"));
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
            }
            else {
		reject("HTTP " + req.status);
            }
	};
	
	req.onerror = function(e) {
            reject(Error("Network Error"));
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

var cache = {
    NativeJSCache: function() {
    this.cacheStore = null;
    this.cacheStoreMetadata = null;
    this.cacheDesiredSizeStore = null;
    this.cacheMetadataArray = [];
    this.maxSizeBytes = 0;
    this.currentCacheSize = 0;
    this.evicting = false;
    this.isCachingEnabled = false;
    this.desiredCacheSize = 0;
    this.init = function init(maxSizeMiB) {
        let that = this;
        bindCacheStore(that);
        isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
            that.isCachingEnabled = isCachingEnabled;
            if (isCachingEnabled) {
                that.cacheStore = createStoreIDBKV('data', 'keyval');
                that.cacheStoreMetadata = createStoreIDBKV('metadata', 'keyval');
                that.cacheDesiredSizeStore = createStoreIDBKV('size', 'keyval');
                getDesiredCacheSize().thenApply(desiredCacheSize => {
                    getBrowserStorageQuota().then(browserStorageQuota => {
                        that.maxSizeBytes = calculateCacheSize(maxSizeMiB * 1024 * 1024, browserStorageQuota, desiredCacheSize);
                        that.desiredCacheSize = that.maxSizeBytes;
                        valuesIDBKV(that.cacheStoreMetadata).then((values) => {
                            values.forEach(value => {
                                let json = JSON.parse(value);
                                that.cacheMetadataArray.push(json);
                                that.currentCacheSize = that.currentCacheSize + json.l;
                            });
                            prepareLRU().thenApply(lruInitialised => {
                                setDesiredCacheSize(that.maxSizeBytes).thenApply(done => {
                                    let currentMiB = (that.currentCacheSize /1024 /1024).toFixed(2);
                                    let maxMiB = (that.maxSizeBytes /1024 /1024).toFixed(2);
                                    getBrowserStorageUsage().then(browserStorageUsage => {
                                        let actualMiB = (browserStorageUsage /1024 /1024).toFixed(2);
                                        console.log('Block Cache. Actual usage:' + actualMiB + ' MiB');
                                        //audit(that.currentCacheSize).thenApply(auditResult => {
                                            console.log('Block Cache. Objects:' + values.length + " Size:" + currentMiB + " MiB" + " Max:" + maxMiB + " MiB");
                                        //});
                                    });
                                });
                            });
                        });
                    });
                });
            }
        });
    };
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
//Firefox private mode does not support IndexedDB.  https://bugzilla.mozilla.org/show_bug.cgi?id=781982
function isIndexedDBAvailable() {
    let future = peergos.shared.util.Futures.incomplete();
    if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1){
        //console.log("Firefox")
        try {
          var db = indexedDB.open("IsPBMode");
          db.onerror = function() {
                future.complete(false);
          };
          db.onsuccess = function() {
                future.complete(true);
          };
        }
        catch(err) {
            future.complete(false);
        }
    } else {
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
        if (val == null) {
            future.complete(-1);
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
    let newSizeBytes = newCacheSizeMiB * 1024 * 1024;
    let future = peergos.shared.util.Futures.incomplete();
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
function clearAllCaches(future) {
    clearCacheFully(blockStoreCache, function() {
        blockStoreCache.maxSizeBytes = 0;
        clearPointerCacheFully(pointerStoreCache, function() {
            clearLoginData(function() {
                future.complete(true);
            });
        });
    });
    return future;
}
function clearLoginData(func) {
    if (accountStoreCache != null && accountStoreCache.offlineAccess) {
        clearBatCacheFully(function() {
            clearRootKeyCacheFully(function() {
                clearAccountCacheFully(function() {
                    clearPkiCacheFully(function() {
                        func();
                    });
                });
            });
        });
    } else {
        func();
    }
}
function getBrowserStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
        return navigator.storage.estimate().then(quota => quota.usage);
    } else {
        let prom = new Promise(function(resolve, reject) { resolve(0)});
        return prom;
    }
}

function getBrowserStorageQuota() {
    if (navigator.storage && navigator.storage.estimate) {
        return navigator.storage.estimate().then(quota => quota.quota);
    } else {
        let prom = new Promise(function(resolve, reject) { resolve(0)});
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
    return (cache.currentCacheSize / cache.maxSizeBytes) * 100.0 > 90.0;
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
    let sorted = cache.cacheMetadataArray.slice().sort((a, b) => a.t < b.t);
    var cacheSize = cache.currentCacheSize;
    let toDelete = [];
    let newLimit = reclaim(cache);
    for(var i=0; i < sorted.length; i++) {
        cacheSize = cacheSize - sorted[i].l;
        toDelete.push(sorted[i].key);
        if (cacheSize <= newLimit) {
            cache.currentCacheSize = cacheSize;
            break;
        }
    }
    for (var i=0; i < toDelete.length; i++) {
        sorted.splice(sorted.findIndex(v => v.key === toDelete[i]), 1);
    }
    cache.cacheMetadataArray = sorted;
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
function createBlockCacheMetadataRecord(key, blockLength) {
    let now = new Date();
    let length = blockLength + (key.length * 2);
    let json = {key: key, l: length, t: now.getTime()};
    var record = JSON.stringify(json);
    json.l = length + record.length;//close enough
    return json;
}

function audit(calcValue) {
    let future = peergos.shared.util.Futures.incomplete();
    var actualSize = 0;
    var cacheStoreCount = 0;
    var cacheStoreMetadataCount = 0;
    valuesIDBKV(blockStoreCache.cacheStore).then((values) => {
        values.forEach(value => {
            actualSize = actualSize + value.byteLength;
            cacheStoreCount++;
        });
        keysIDBKV(blockStoreCache.cacheStore).then((keys) => {
            keys.forEach(key => {
                actualSize = actualSize + key.length;
            });
            valuesIDBKV(blockStoreCache.cacheStoreMetadata).then((values) => {
                values.forEach(value => {
                    actualSize = actualSize + value.length;
                    cacheStoreMetadataCount++;
                });
                keysIDBKV(blockStoreCache.cacheStoreMetadata).then((keys) => {
                    keys.forEach(key => {
                        actualSize = actualSize + key.length;
                    });
                    let diff = calcValue - actualSize;
                    console.log("currentCacheSize=" + calcValue +" actual size=" + actualSize + " diff=" + diff + " cache count=" + cacheStoreCount+" metadataCount=" + cacheStoreMetadataCount);
                    future.complete(true);
                });
            });
        });
    });
    return future;
}
//public native CompletableFuture<Boolean> put(Cid hash, byte[] data);
function putIntoCacheProm(hash, data) {
    let future = peergos.shared.util.Futures.incomplete();
    if (this.maxSizeBytes == 0 || !this.isCachingEnabled) {
        future.complete(true);
    } else {
        let that = this;
        let key = hash.toString();
        setIDBKV(key, data, this.cacheStore).then(() => {
            let metaData = createBlockCacheMetadataRecord(key, data.byteLength);
            that.currentCacheSize = that.currentCacheSize + metaData.l;
            setIDBKV(key, JSON.stringify(metaData), that.cacheStoreMetadata).then(() => {
                //audit(that.currentCacheSize).thenApply(auditResult => {
                    that.cacheMetadataArray.push(metaData);
                    if (triggerEviction(this)) {
                        evictLRU(this, function() {future.complete(true)});
                    } else {
                        future.complete(true);
                    }
                //});
            }).catch(err => {
                delIDBKV(key, that.cacheStore).then(() => {
                    future.complete(true);
                });
            });
        }).catch(err => {
            evictLRU(blockStoreCache, function() {future.complete(true)});
        });
    }
    return future;
}
function noop() {
}
//public native CompletableFuture<Optional<byte[]>> get(Cid hash);
function getFromCacheProm(hash) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(peergos.client.JsUtil.emptyOptional());
    } else {
        let key = hash.toString();
        getIDBKV(key, this.cacheStore).then((val) => {
            if (val == null) {
                future.complete(peergos.client.JsUtil.emptyOptional());
            } else {
                setTimeout(() => {
                    let metaData = createBlockCacheMetadataRecord(key, val.length);
                    setIDBKV(key, JSON.stringify(metaData), that.cacheStoreMetadata).then(() => {
                        noop();
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
function clearCacheFully(cache, func) {
    if (cache.isCachingEnabled) {
        cache.cacheMetadataArray = [];
        cache.currentCacheSize = 0
        clearIDBKV(cache.cacheStore).then((res1) => {
            clearIDBKV(cache.cacheStoreMetadata).then((res2) => func());
        });
    } else {
        func();
    }
}

var pointerCache = {
    NativeJSPointerCache: function() {
    this.cachePointerStore = createStoreIDBKV('pointers', 'keyval');
    this.cachePointerStoreMetadata = createStoreIDBKV('pmetadata', 'keyval');
    this.cachePointerMetadataArray = [];
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
                    values.forEach(value => {
                        let json = JSON.parse(value);
                        that.cachePointerMetadataArray.push(json);
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
                that.cachePointerMetadataArray.push(json);
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
                        noop();
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
            entriesIDBKV(that.rootKeyCache).then((val) => {
                if (val == null || val.length == 0) {
                    future.complete(null);
                } else {
                    let storedUsername = val[0][0];
                    let storedRootKey = convertToByteArray(val[0][1]);
                    future.complete({username: storedUsername, rootKey: storedRootKey});
                }
            });
        } else {
            future.complete(null);
        }
    });
    return future;
}
function setRootKeyIntoCacheProm(username, rootKeySerialised) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    isIndexedDBAvailable().thenApply(function(isCachingEnabled) {
        if (isCachingEnabled) {
            that.rootKeyCache = createStoreIDBKV('rootKey', 'keyval');
            setIDBKV(username, rootKeySerialised, that.rootKeyCache).then(() => {
                future.complete(true);
            }).catch(err => {
                future.complete(false);
            });
        } else {
            future.complete(false);
        }
    });
    return future;
}

function clearRootKeyCacheFully(func) {
    if (rootKeyCache != null) {
        clearIDBKV(rootKeyCache).then(res => func());
    } else {
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

//      public native CompletableFuture<byte[]> getEntryData(String key);
function getEntryDataFromCacheProm(key) {
    let that = this;
    let future = peergos.shared.util.Futures.incomplete();
    if (!this.isCachingEnabled) {
        future.complete(null);
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
            future.complete(null);
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

function clearAccountCacheFully(func) {
    if (accountStoreCache.isCachingEnabled) {
        clearIDBKV(accountStoreCache.cacheAccountStore).then(res => func());
    } else {
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
    if(bytes === false) {
        throw "Invalid encryption!";
    }
    return convertToByteArray(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}

function generateCrypto_sign_open(signed, publicSigningKey) {    
    var bytes = nacl.sign.open(new Uint8Array(signed), new Uint8Array(publicSigningKey));
    return convertToByteArray(new Int8Array(bytes));
}

function generateCrypto_sign(message, secretSigningKey) {    
    var bytes = nacl.sign(new Uint8Array(message), new Uint8Array(secretSigningKey));
    return convertToByteArray(new Int8Array(bytes));
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
    JSNaCl: function() {
        this.randombytes = generateRandomBytes;
        this.secretbox = generateSecretbox;
        this.secretbox_open = generateSecretbox_open;

        this.crypto_sign_open = generateCrypto_sign_open;
        this.crypto_sign = generateCrypto_sign;
        this.crypto_sign_keypair = generateCrypto_sign_keypair;
        this.crypto_box_open = generateCrypto_box_open;
        this.crypto_box = generateCrypto_box;
        this.crypto_box_keypair = generateCrypto_box_keypair;
    }   
};

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

function generateThumbnailProm(asyncReader, fileSize, fileName) {
    var future = peergos.shared.util.Futures.incomplete();
    var bytes = peergos.shared.util.Serialize.newByteArray(fileSize);
    asyncReader.readIntoArray(bytes, 0, fileSize).thenApply(function(bytesRead) {
        renderThumbnail(bytes, future, 400);
    });
    return future;
}

function renderThumbnail(bytes, future, size) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function(){
        getThumbnailFromCanvas(canvas, img, img.width, img.height, size, future);
    }
    img.onerror = function(e) {
	console.log(e);
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
        let context = canvas.getContext('2d');
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
            let context = canvas.getContext('2d');
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

function createVideoThumbnailStreamingProm(future, asyncReader, size, filename, mimeType) {
    let maxBlockSize = 1024 * 1024 * 5;
    var blockSize = size > maxBlockSize ? maxBlockSize : size;
    var result = { done: false};
    function Context(asyncReader, sizeHigh, sizeLow) {
        this.maxBlockSize = 1024 * 1024 * 5;
        this.writer = null;
        this.asyncReader = asyncReader;
        this.sizeHigh = sizeHigh,
        this.sizeLow = sizeLow;
        this.counter = 0;
        this.stream = function(seekHi, seekLo, length) {
            this.counter++;
            var work = function(thatRef, currentCount) {
                var currentSize = length;
                var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize : currentSize;
                var pump = function(reader) {
                    if(! result.done && blockSize > 0 && thatRef.counter == currentCount) {
                        var data = convertToByteArray(new Uint8Array(blockSize));
                        data.length = blockSize;
                        reader.readIntoArray(data, 0, blockSize).thenApply(function(read){
                               currentSize = currentSize - read.value_0;
                               blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                               thatRef.writer.write(data);
                               pump(reader);
                        });
                    }
                }
                asyncReader.seekJS(seekHi, seekLo).thenApply(function(seekReader){
                    pump(seekReader);
                })
            }
            var empty = convertToByteArray(new Uint8Array(0));
            this.writer.write(empty);
            work(this, this.counter);
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
                            let context = canvas.getContext('2d');
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
    }, function(seekHi, seekLo, seekLength){
        if(! result.done) {
            context.stream(seekHi, seekLo, seekLength);
        }
    }, undefined, size);
    context.writer = fileStream.getWriter();
    return future;
}
