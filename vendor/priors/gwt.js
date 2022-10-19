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
    if (this.isDirectS3 && this.isRobotReady) {
        let plainArray = [];
        var index = 0;
        while (index < headers.length){
    	    var name = headers[index++];
    	    plainArray.push(name);
        	var value = headers[index++];
    	    plainArray.push(value);
        }
        return this.sendRequest({type: 'getWithHeadersProm', url: url, headers: plainArray});
    } else {
        return getWithHeadersPromDirect(url, headers);
    }
}

function getWithHeadersPromDirect(url, headers) {
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
        future.completeExceptionally(java.lang.Throwable.of(Error("Network Error")));
    };
    
    req.send();
    return future;
}

function postProm(url, data, timeout) {
    return this.isDirectS3 && this.isRobotReady ? this.sendRequest({type: 'postProm', url: url, data: data, timeout: timeout})
        : postPromDirect(url, data, timeout);
}

function postPromDirect(url, data, timeout) {
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
            reject(Error("Network Error"));
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
    if (this.isDirectS3 && this.isRobotReady) {
        let plainArray = [];
        var index = 0;
        while (index < headers.length){
            var name = headers[index++];
            plainArray.push(name);
            var value = headers[index++];
            plainArray.push(value);
        }
        return this.sendRequest({type: 'putProm', url: url, data: data, headers: plainArray})
    } else {
        return putPromDirect(url, data, headers);
    }
}

function putPromDirect(url, data, headers) {
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
        this.isDirectS3 = false;
        this.robotIframeId = 'robot-proxy';
        this.isRobotInitialised= false;
        this.isRobotReady= false;
        this.currentRequests = new Map();
        this.init = function init(directS3) {
            this.isDirectS3 = directS3;
            if (this.isDirectS3) {
                this.startRobot('https://peergos-test.us-east-1.linodeobjects.com/robot-proxy.html');
                //this.startRobot('robot-proxy.html');
            }
        };
        this.startRobot = function(url) {
            let that = this;
            var iframe = document.createElement('iframe');
            iframe.id = this.robotIframeId;
            document.body.appendChild(iframe);
            window.setTimeout(function(){
                iframe.src = url;
                window.addEventListener('message', function(e) {
                    let win = iframe.contentWindow;
                    if (win != null ) {
                        if (e.source === iframe.contentWindow) {
                            if (e.data.action == 'pong') {
                                that.isRobotInitialised = true;
                            } else {
                                let future = that.currentRequests.get(e.data.id);
                                that.currentRequests.delete(e.data.id);
                                if (e.data.status == 200) {
                                    future.complete(convertToByteArray(new Int8Array(e.data.response)));
                                } else if (e.data.action == 'getWithHeadersProm') {
                                    if (e.data.status == 404) {
                                        future.completeExceptionally(new peergos.shared.storage.HttpFileNotFoundException());
                                    } else if (e.data.status == 429) {
                                        future.completeExceptionally(new peergos.shared.storage.RateLimitException());
                                    } else {
                                        future.completeExceptionally(java.lang.Throwable.of(Error(e.data.errMsg)));
                                    }
                                } else if (e.data.action == 'postProm') {
                                    if (e.data.errMsg.startsWith('Storage+quota+reached')) {
                                        future.completeExceptionally(new peergos.shared.storage.StorageQuotaExceededException(e.data.errMsg));
                                    } else {
                                        that.handleError(e.data.wrapInError, e.data.errMsg);
                                    }
                                } else if (e.data.action == 'putProm') {
                                    that.handleError(e.data.wrapInError, e.data.errMsg);
                                }
                            }
                        }
                    }
                });
                that.isRobotReady = true;
            });
        };
        this.handleError = function(future, wrapInError, errMsg) {
            if (e.data.wrapInError) {
                future.completeExceptionally(java.lang.Throwable.of(Error(e.data.errMsg)));
            } else {
                future.completeExceptionally(java.lang.Throwable.of(e.data.errMsg));
            }
        };
        this.postMessage = function(obj) {
            let iframe = document.getElementById(this.robotIframeId);
            iframe.contentWindow.postMessage(obj, '*');
        };
        this.sendRobotMessage = function(func) {
            if (this.isRobotInitialised) {
                func();
            } else {
                let iframe = document.getElementById(this.robotIframeId);
                iframe.contentWindow.postMessage({type: 'ping'}, '*');
                let that = this;
                window.setTimeout(function() {that.sendRobotMessage(func);}, 3000);
            }
        }
        this.sendRequest = function(obj, fut) {
            var that = this;
            obj.id = this.generateUUID();
            let future = peergos.shared.util.Futures.incomplete();
            this.currentRequests.set(obj.id, future);
            let func = function() {
                that.postMessage(obj);
            };
            this.sendRobotMessage(func);
            return future;
        }
        this.generateUUID = function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          );
        };
        this.get = getProm;
        this.getWithHeaders = getWithHeadersProm;
        this.post = postProm;
        this.postMultipart = postMultipartProm;
        this.put = putProm;
    }
};

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
