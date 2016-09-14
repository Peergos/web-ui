function getProm(url) {
    console.log("getProm");
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
	var req = new XMLHttpRequest();
	req.open('GET', url);
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
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
            future.complete(result);
    });
    return future;
}

function postProm(url, data, unzip) {
    console.log("postProm");
    var future = peergos.shared.util.FutureUtils.incomplete();
    new Promise(function(resolve, reject) {
	console.log("making http post request");
	var req = new XMLHttpRequest();
	req.open('POST', window.location.origin + "/" + url);
	req.responseType = 'arraybuffer';
	
	req.onload = function() {
	    console.log("http post returned");
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
	
	req.send(data);
    }).then(function(result, err) {
        if (err != null)
            future.completeExceptionally(err);
        else
            future.complete(result);
    });
    return future;
}

var http = {
    NativeJSHttp: function() {
	this.get = getProm;
	this.post = postProm;
    }
};
