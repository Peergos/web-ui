module.exports = {
    template: require('video-capture.html'),
    data: function() {
        return {
            error: "",
            isError: false,
            errorClass: "",
            buttonLabel: "start capture",
            captureChunks:[],
            finalCaptureChunks:[],
            isFinished: false,
            recorder: null
        };
    },
    props: ['videocapture'],
    created: function() {
    },
    methods: {
        createCaptureFilename: function() {
            let date = new Date();
            return "capture-" + date.getFullYear() + "-" + this.formatAs2Digits(date.getMonth())
                + "-" + this.formatAs2Digits(date.getDate()) + "T"
                + this.formatAs2Digits(date.getHours()) + "." + this.formatAs2Digits(date.getMinutes())
                + "." + this.formatAs2Digits(date.getSeconds()) + ".mov";
        },
        formatAs2Digits: function(digitsAsStr) {
            let digitsAsInt = Number(digitsAsStr);
            if(digitsAsInt < 10) {
                return "0" + digitsAsStr;
            }
            return digitsAsStr;
        },
        startCapture: function() {
            this.isFinished = false;
            this.captureChunks = [];
            this.finalCaptureChunks =[];
            let preview = document.getElementById("preview");
            navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            }).then(stream => {
                preview.srcObject = stream;
                var options = {
                  audioBitsPerSecond : 128000, //64000,
                  videoBitsPerSecond : 128000 //64000
                }
                //this.recorder = new MediaRecorder({ mimeType: 'video/webm; codecs="vp8, opus"'  });
                try {
                    this.recorder = new MediaRecorder(stream, options);
                    this.buttonLabel = "activating capture";
                    this.recorder.ondataavailable = this.handleDataAvailable;
                    this.recorder.onstop = this.handleEndOfCapture;
                    this.recorder.start();
                    this.waitingUntilRecording(this.createCaptureFilename());
                } catch (ex) {
                    this.isError = true;
                    this.error = "MediaRecorder functionality not supported on your device";
                    this.errorClass = "has-error has-feedback alert alert-danger";
                }
            });
        },
        handleEndOfCapture: function() {
            this.isFinished = true;
        },
        waitingUntilRecording: function(filename) {
            let that = this;
            if(this.isRecording()) {
                let vbps = this.recorder.videoBitsPerSecond;
                let abps = this.recorder.audioBitsPerSecond;
                console.log("v bps:" + vbps + " a bps:" + abps);
                setTimeout(function(){ //it seems i have to wait a bit before i can call requestData
                    that.buttonLabel = "stop capture";
                    try {
                        let resp = that.recorder.requestData();
                        that.mainLoop(that.createCaptureFilename(), false);
                    } catch (ex) {
                        that.mainLoop(that.createCaptureFilename(), false); //recording saved when finished
                    }
                }, 3000);
            } else {
                setTimeout(function(){ that.waitingUntilRecording(filename);}, 100);
            }
        },
        mainLoop: function(filename, inError) {
            let that = this;
            let chunk = this.captureChunks.shift();
            if (chunk != null) {
                if(! this.inError) {
                    this.videocapture(filename, chunk).thenApply(function(res){
                        //console.log("videocapture-now=" + new Date());
                        if (res) {
                            if(!that.isFinished) {
                                that.recorder.requestData();
                            }
                        } else {
                            inError = true;
                            that.handleError();
                        }
                        setTimeout(function(){ that.mainLoop(filename, inError); }, 100);
                    });
                }
            } else {
                if(this.isFinished) {
                    setTimeout(function(){ that.handleLastChunks(filename); }, 2000);//wait a bit
                } else {
                    setTimeout(function(){ that.mainLoop(filename, inError); }, 100);
                }
            }
        },
        handleLastChunks: function(filename) {
            let that = this;
            let chunk = this.finalCaptureChunks.shift();
            if (chunk != null) {
                this.videocapture(filename, chunk).thenApply(function(res){
                    //console.log("last-chunk-videocapture-now=" + new Date());
                    setTimeout(function(){ that.handleLastChunks(); }, 2000);
                });
            } else {
                this.buttonLabel = "start capture";
                this.recorder = null;
            }
        },
        isRecording: function() {
            return this.recorder != null && this.recorder.state != 'inactive';
        },
        handleError: function() {
            this.isError = true;
            this.error = "Unable to record";
            this.errorClass = "has-error has-feedback alert alert-danger";
            this.stopRecorder();
        },
        handleDataAvailable: function(event) {
            //not supported on mac :( event.data.arrayBuffer().then(ab => {
            new Response(event.data).arrayBuffer().then(ab => {
                if(ab.byteLength > 0) {
                    if(!this.isFinished) {
                        this.captureChunks.push(convertToByteArray(new Int8Array(ab)));
                    } else {
                        this.finalCaptureChunks.push(convertToByteArray(new Int8Array(ab)));
                    }
                }
            });
        },
        stopRecorder: function() {
            if(this.isRecording()) {
                this.recorder.stop();
            }
        },
        toggleCapture: function() {
            if(this.buttonLabel == "start capture") {
                this.startCapture();
            } else if(this.buttonLabel == "stop capture"){
                this.close();
            } else if(this.buttonLabel == "activating capture"){
                //need to wait until recording starts
            } else if(this.buttonLabel == "stopping capture"){
                //need to wait until previous recording is complete before starting anew
            }
        },
        close: function () {
            this.buttonLabel = "stopping capture";
            this.stopRecorder();
            this.$emit("hide-video-capture");
        }
    }
}
