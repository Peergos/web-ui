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
		resolve(new Uint8Array(req.response));
            }
            else {
		reject(Error(req.statusText));
            }
	};
	
	req.onerror = function() {
            reject(Error("Network Error"));
	};
	
	req.send();
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(err);
        else
            future.complete(peergos.shared.user.JavaScriptPoster.convertToBytes(result));
    });
    return future;
}

function postProm(url, data, unzip) {
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
		resolve(new Uint8Array(req.response));
            }
            else {
		reject(Error(req.statusText));
            }
	};
	
	req.onerror = function() {
            reject(Error("Network Error"));
	};
	
	req.send(new Uint8Array(data));
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
    }
};

function hashToKeyBytesProm(username, password) {
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
        console.log("making scrypt request");
        
        var t1 = Date.now();
        var hash = sha256(nacl.util.decodeUTF8(password));
        var salt = nacl.util.decodeUTF8(username)
        scrypt(hash, salt, 17, 8, 96, 1000, function(keyBytes) {
            console.log("JS Scrypt complete in: "+ (Date.now()-t1)+"mS");
            var hashedBytes = nacl.util.decodeBase64(keyBytes);
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

var scryptJS = {
    NativeScryptJS: function() {
    this.hashToKeyBytes = hashToKeyBytesProm;
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
		future.complete(data);
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
