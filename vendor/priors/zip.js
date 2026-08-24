// Raw deflate decompression for reading zip archives stored in Peergos.
//
// The GWT emulation of java.util.zip.InflaterInputStream is a stub that throws, so shared code
// calls out to this instead, one instance per entry being read. See NativeJSInflate.java.
//
// The awkward part is that DecompressionStream is asynchronous while the Java side needs to ask,
// synchronously, whether more compressed input is wanted. So the source of the pipeline is a
// ReadableStream that pulls, and a pull that finds nothing queued is what makes needsInput() true.
// A read that is waiting when that happens completes with zero bytes rather than deadlocking on
// input the Java side is not going to send until it is asked.

var zipInflate = {
    NativeJSInflate: function() {
        var self = this;

        var open = function() {
            self.queue = [];          // compressed chunks not yet taken by the stream
            self.pullResolve = null;  // set while the stream is waiting for input
            self.closedInput = false; // finish() has been called
            self.out = null;          // the current decompressed chunk
            self.outPos = 0;
            self.done = false;
            self.error = null;
            self.waiting = null;      // an inflate() call waiting for output
            self.pendingRead = null;

            var source = new ReadableStream({
                pull: function(controller) {
                    if (self.queue.length > 0) {
                        controller.enqueue(self.queue.shift());
                        return;
                    }
                    if (self.closedInput) {
                        controller.close();
                        return;
                    }
                    // nothing to give it: let any waiting read return empty so the caller asks
                    // needsInput() again and feeds us
                    var waiting = self.waiting;
                    self.waiting = null;
                    if (waiting != null)
                        waiting.future.complete({value_0: 0});
                    return new Promise(function(resolve) {
                        self.pullResolve = function() {
                            self.pullResolve = null;
                            if (self.queue.length > 0)
                                controller.enqueue(self.queue.shift());
                            else
                                controller.close();
                            resolve();
                        };
                    });
                }
            });
            self.reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        };

        var pump = function() {
            if (self.pendingRead != null)
                return;
            self.pendingRead = self.reader.read().then(function(result) {
                self.pendingRead = null;
                if (result.done)
                    self.done = true;
                else {
                    self.out = result.value;
                    self.outPos = 0;
                }
                var waiting = self.waiting;
                if (waiting != null) {
                    self.waiting = null;
                    deliver(waiting.future, waiting.res, waiting.offset, waiting.length);
                }
            }).catch(function(err) {
                self.pendingRead = null;
                self.error = err;
                var waiting = self.waiting;
                if (waiting != null) {
                    self.waiting = null;
                    waiting.future.completeExceptionally(java.lang.Throwable.of(err));
                }
            });
        };

        var available = function() {
            return self.out == null ? 0 : self.out.length - self.outPos;
        };

        var deliver = function(future, res, offset, length) {
            if (self.error != null) {
                future.completeExceptionally(java.lang.Throwable.of(self.error));
                return;
            }
            var avail = available();
            if (avail > 0) {
                var n = Math.min(avail, length);
                new Int8Array(res.buffer, (res.byteOffset || 0) + offset, n)
                    .set(self.out.subarray(self.outPos, self.outPos + n));
                self.outPos += n;
                if (self.outPos === self.out.length) {
                    self.out = null;
                    self.outPos = 0;
                }
                future.complete({value_0: n});
                return;
            }
            if (self.done || (self.queue.length === 0 && !self.closedInput)) {
                future.complete({value_0: 0});
                return;
            }
            self.waiting = {future: future, res: res, offset: offset, length: length};
            pump();
        };

        this.needsInput = function() {
            return !self.done && self.error == null && available() === 0
                && self.queue.length === 0 && !self.closedInput;
        };

        this.setInput = function(compressed, offset, length) {
            // copy, because the caller reuses its input buffer as soon as this returns
            var start = (compressed.byteOffset || 0) + offset;
            self.queue.push(new Uint8Array(compressed.buffer.slice(start, start + length)));
            if (self.pullResolve != null)
                self.pullResolve();
        };

        this.inflate = function(res, offset, length) {
            var future = peergos.shared.util.Futures.incomplete();
            deliver(future, res, offset, length);
            return future;
        };

        this.finish = function() {
            self.closedInput = true;
            if (self.pullResolve != null)
                self.pullResolve();
            else if (self.waiting != null) {
                // nothing is going to arrive by itself, so start draining what is left
                pump();
            }
        };

        this.finished = function() {
            return self.done;
        };

        this.reset = function() {
            this.close();
            open();
        };

        this.close = function() {
            if (self.reader != null) {
                try {
                    self.reader.cancel();
                } catch (e) {
                }
                self.reader = null;
            }
        };

        open();
    }
};
