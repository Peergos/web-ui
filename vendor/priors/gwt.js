function convertToByteArray(target) {
    var source = peergos.shared.user.JavaScriptPoster.emptyArray();
    // This relies on internal implementation details of GWT's byte[] emulation
    target.___clazz = source.___clazz;
    target.castableTypeMap = source.castableTypeMap;
    target.typeMarker = source.typeMarker;
    target.__elementTypeCategory$ = source.__elementTypeCategory$;
    target.__elementTypeId$ = source.__elementTypeId$;
    target.__proto__ = source.__proto__;
    return target;
}

function getProm(url) {
    console.log("getProm " + url);
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('GET', url);
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
	    console.log("http get returned retrieving " + url);
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		reject(Error(req.getResponseHeader("Trailer")));
            }
	};
	
	req.onerror = function() {
            reject(Error("Network Error"));
	};
	
	req.send();
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else {
            future.complete(convertToByteArray(Array.from(result)));
	}
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

function postProm(url, data) {
    console.log("postProm " + url);
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('POST', window.location.origin + "/" + url);
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
	    console.log("http post returned retrieving " + url);
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		reject(req.getResponseHeader("Trailer"));
            }
	};
	
	req.onerror = function() {
            reject(Error("Network Error"));
	};
	
	req.send(new Uint8Array(data));
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(java.lang.Throwable.of(err));
        else
            future.complete(peergos.shared.user.JavaScriptPoster.convertToBytes(result));
    }, function(err) {
	future.completeExceptionally(java.lang.Throwable.of(err)); 
    });
    return future;
}

function postMultipartProm(url, dataArrays) {
    console.log("postMultipartProm " + url);
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();

	req.open('POST', window.location.origin + "/" + url);
	req.responseType = 'arraybuffer';

	req.onload = function() {
	    console.log("http post returned retrieving " + url);
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
		resolve(new Int8Array(req.response));
            }
            else {
		reject(Error(req.statusText));
            }
	};
	
	req.onerror = function(e) {
	    console.log(e);
            reject(Error("Network Error"));
	};

	var form = new FormData();

	for (var i=0; i < dataArrays.array.length; i++)
	    form.append(i, new Blob([new Int8Array(dataArrays.array[i])]));

        req.send(form);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(err);
        else
            future.complete(peergos.shared.user.JavaScriptPoster.convertToBytes(result));
    });
    return future;
}

var http = {
    NativeJSHttp: function() {
	this.get = getProm;
	this.post = postProm;
	this.postMultipart = postMultipartProm;
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
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
        console.log("making scrypt request");
        
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
            future.complete(peergos.shared.user.JavaScriptPoster.convertToBytes(result));
    });
    return future;
}

function generateRandomBytes(len) {    
    var bytes = nacl.randomBytes(len);
    return peergos.shared.user.JavaScriptPoster.convertToBytes(new Int8Array(bytes));
}

function generateSecretbox(data, nonce, key) {
    var bytes = nacl.secretbox(new Uint8Array(data), new Uint8Array(nonce), new Uint8Array(key));
    return peergos.shared.user.JavaScriptPoster.convertToBytes(bytes);
}

function generateSecretbox_open(cipher, nonce, key) {
    var bytes = nacl.secretbox.open(new Uint8Array(cipher), new Uint8Array(nonce), new Uint8Array(key));
    if(bytes === false) {
        throw "Invalid encryption!";
    }
    return peergos.shared.user.JavaScriptPoster.convertToBytes(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
}

function generateCrypto_sign_open(signed, publicSigningKey) {    
    var bytes = nacl.sign.open(new Uint8Array(signed), new Uint8Array(publicSigningKey));
    return peergos.shared.user.JavaScriptPoster.convertToBytes(new Int8Array(bytes));
}

function generateCrypto_sign(message, secretSigningKey) {    
    var bytes = nacl.sign(new Uint8Array(message), new Uint8Array(secretSigningKey));
    return peergos.shared.user.JavaScriptPoster.convertToBytes(bytes);
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
    return peergos.shared.user.JavaScriptPoster.convertToBytes(i8Array);
}

function generateCrypto_box(message, nonce, theirPublicBoxingKey, ourSecretBoxingKey) {    
    var res = nacl.box(new Uint8Array(message), new Uint8Array(nonce), new Uint8Array(theirPublicBoxingKey), new Uint8Array(ourSecretBoxingKey));
    var i8Array = new Int8Array(res);
    return peergos.shared.user.JavaScriptPoster.convertToBytes(i8Array);
}

function generateCrypto_box_keypair(publicKey, secretKey) {    
    var boxPair = nacl.box.keyPair.fromSecretKey(new Uint8Array(secretKey));
    for (var i=0; i < boxPair.publicKey.length; i++)
        publicKey[i] = boxPair.publicKey[i];
    
    return publicKey;
}

var scryptJS = {
    NativeScryptJS: function() {
        this.hashToKeyBytes = hashToKeyBytesProm;
    }
};

var thumbnail = {
    NativeJSThumbnail: function() {
        this.generateThumbnail = generateThumbnailProm;
    }   
};

var tweetNaCl = {
    JSNaCl: function() {
        this.randombytes = generateRandomBytes;
        this.secretbox = generateSecretbox;
        this.secretbox_open = generateSecretbox_open;
        this.secretboxAsync = generateSecretboxAsync;
        this.secretbox_openAsync = generateSecretbox_openAsync;

        this.crypto_sign_open = generateCrypto_sign_open;
        this.crypto_sign = generateCrypto_sign;
        this.crypto_sign_keypair = generateCrypto_sign_keypair;
        this.crypto_box_open = generateCrypto_box_open;
        this.crypto_box = generateCrypto_box;
        this.crypto_box_keypair = generateCrypto_box_keypair;
    }   
};

var inflightEncryptFutures = new Object();
var inflightDecryptFutures = new Object();

document.encryptworker = new Worker('js/encrypt.js');
document.encryptworker.onmessage = function(oEvent) {
    let uInt8IdView = new Uint8Array(oEvent.data.id, oEvent.data.id.byteOffset, oEvent.data.id.byteLength);
    let taskId = uInt8IdView.toString();
    let future = inflightEncryptFutures[taskId];
    delete inflightEncryptFutures[taskId];
    var uInt8DataView = new Uint8Array(oEvent.data.data, oEvent.data.data.byteOffset, oEvent.data.data.byteLength);
    future.complete(peergos.shared.user.JavaScriptPoster.convertToBytes(uInt8DataView));
};

document.decryptworker = new Worker('js/decrypt.js');
document.decryptworker.onmessage = function(oEvent) {
    let uInt8IdView = new Uint8Array(oEvent.data.id, oEvent.data.id.byteOffset, oEvent.data.id.byteLength);
    let taskId = uInt8IdView.toString();
    let future = inflightDecryptFutures[taskId];
    delete inflightDecryptFutures[taskId];
    let int8DataView = new Int8Array(oEvent.data.data, oEvent.data.data.byteOffset, oEvent.data.data.byteLength);
    future.complete(peergos.shared.user.JavaScriptPoster.convertToBytes(int8DataView));
};

function generateSecretboxAsync(data, nonce, key) {
    let uInt8DataView = new Uint8Array(data);
    let uInt8NonceView = new Uint8Array(nonce);
    let uInt8KeyView = new Uint8Array(key);

    let uInt8IdView = new Uint8Array(nacl.randomBytes(6));
    let taskId = uInt8IdView.toString();
    var future = peergos.shared.util.FutureUtils.incomplete();
    inflightEncryptFutures[taskId] = future
    document.encryptworker.postMessage({id: uInt8IdView.buffer, data: uInt8DataView.buffer, nonce: uInt8NonceView.buffer, key: uInt8KeyView.buffer}, [uInt8IdView.buffer, uInt8DataView.buffer, uInt8NonceView.buffer, uInt8KeyView.buffer]);
    return future;
}

function generateSecretbox_openAsync(cipher, nonce, key) {
    let uInt8CipherView = new Uint8Array(cipher);
    let uInt8NonceView = new Uint8Array(nonce);
    let uInt8KeyView = new Uint8Array(key);

    let uInt8IdView = new Uint8Array(nacl.randomBytes(6));
    let taskId = uInt8IdView.toString();
    var future = peergos.shared.util.FutureUtils.incomplete();
    inflightDecryptFutures[taskId] = future
    document.decryptworker.postMessage({id: uInt8IdView.buffer, cipher: uInt8CipherView.buffer, nonce: uInt8NonceView.buffer, key: uInt8KeyView.buffer}, [uInt8IdView.buffer, uInt8CipherView.buffer, uInt8NonceView.buffer, uInt8KeyView.buffer]);
    return future;
}

var browserio = {
    JSFileReader: function(file) {
	this.name = file.name;
	this.file = file;
	this.size = file.size;
	this.offset = 0;
	
	this.seek = function(hi, low) {
	    this.offset = low;
	    var fut = peergos.shared.util.FutureUtils.incomplete();
	    fut.complete(true);
	    return fut;
	}

	this.readIntoArray = function(res, offset, length) {
	    var future = peergos.shared.util.FutureUtils.incomplete();

	    var filereader = new FileReader();
	    filereader.file_name = file.name;
	    filereader.onload = function(){
		const data = new Uint8Array(this.result);
		for (var i=0; i < length; i++)
		    res[offset + i] = data[i];
		future.complete(length);
	    };
	    
	    filereader.readAsArrayBuffer(file.slice(this.offset, this.offset + length));
	    this.offset += length;
	    return future;
	}

	this.reset = function() {
	    this.offset = 0;
	    var fut = peergos.shared.util.FutureUtils.incomplete();
	    fut.complete(true);
	    return fut;
	}

	this.close = function() {
	    
	}
    }
};

function generateThumbnailProm(asyncReader, fileSize, fileName) {
    var future = peergos.shared.util.FutureUtils.incomplete();
    var bytes = peergos.shared.util.Serialize.newByteArray(fileSize);
    asyncReader.readIntoArray(bytes, 0, fileSize).thenApply(function(bytesRead) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function(){
            var w = 100, h = 100;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img,0,0,img.width, img.height, 0, 0, w, h);
            var b64Thumb = canvas.toDataURL().substring("data:image/png;base64,".length);
            future.complete(b64Thumb);
        }
	img.onerror = function(e) {
	    console.log(e);
	    future.complete("");
	}
        var blob = new Blob([new Uint8Array(bytes)], {type: "octet/stream"});
        var url = window.URL.createObjectURL(blob);
        img.src = url;
    });
    return future;
}
