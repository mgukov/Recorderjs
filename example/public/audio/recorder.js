
var AudioRecorder = function (config) {

    var self = this;

    if (!AudioRecorder.isRecordingSupported()) {
        throw new Error("Recording is not supported in this browser");
    }

    this.state = "inactive";
    this.eventTarget = document.createDocumentFragment();
    this.audioContext = new AudioContext();
    this.monitorNode = this.audioContext.createGain();

    this.config = config = config || {};
    this.config.bufferLength = config.bufferLength || 1024;
    this.config.monitorGain = config.monitorGain || 0;
    this.config.numberOfChannels = config.numberOfChannels || 1;
    this.config.originalSampleRate = this.audioContext.sampleRate;
    this.config.encoderSampleRate = config.encoderSampleRate || 48000;
    this.config.encoderPath = config.encoderPath || 'encoder.min.js';
    this.config.leaveStreamOpen = config.leaveStreamOpen === false ? false : true;
    this.config.maxBuffersPerPage = config.maxBuffersPerPage || 1;
    this.config.encoderApplication = config.encoderApplication || 2049;
    this.config.encoderFrameSize = config.encoderFrameSize || 60;
    this.config.resampleQuality = config.resampleQuality || 3;
    this.config.streamOptions = config.streamOptions || {
        optional: [],
        mandatory: {
            googEchoCancellation: false,
            googAutoGainControl: false,
            googNoiseSuppression: false,
            googHighpassFilter: false
        }
    };

    this.setMonitorGain(this.config.monitorGain);
    this.scriptProcessorNode = this.audioContext.createScriptProcessor(
            this.config.bufferLength, this.config.numberOfChannels, this.config.numberOfChannels);
    
    this.scriptProcessorNode.onaudioprocess = function (e) {
        self.encodeBuffers(e.inputBuffer);
    };

    this.listenersSet = false;
    this.setupListeners();
};


AudioRecorder.isRecordingSupported = function () {
    return typeof AudioContext !== 'undefined'
            && navigator && (navigator.getUserMedia || (navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
};


AudioRecorder.prototype.setupListeners = function () {

    if (this.listenersSet) {
        return;
    }

    this.listenersSet = true;

    var capitalizeFirstLetter = function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    var self = this;

    var events = [
        "start",
        "stop",
        "pause",
        "resume",
        "streamError",
        "streamReady",
        "dataAvailable"
    ];

    events.forEach(function (event) {
        self.addEventListener(event, function (e) {
            var handlerName = 'on' + capitalizeFirstLetter(event);
            var handler = self[handlerName];

            if (handler && typeof handler === 'function') {
                handler(e);
            }
        });
    });
};


AudioRecorder.prototype.addEventListener = function (type, listener, useCapture) {
    this.eventTarget.addEventListener(type, listener, useCapture);
};

AudioRecorder.prototype.clearStream = function () {
    if (this.stream) {

        if (this.stream.getTracks) {
            this.stream.getTracks().forEach(function (track) {
                track.stop();
            });
        } else {
            this.stream.stop();
        }

        delete this.stream;
    }
};

AudioRecorder.prototype.encodeBuffers = function (inputBuffer) {
    if (this.state === "recording") {
        var buffers = [];
        for (var i = 0; i < inputBuffer.numberOfChannels; i++) {
            buffers[i] = inputBuffer.getChannelData(i);
        }
        this.encoder.encode(buffers);
    }
};

AudioRecorder.prototype.initStream = function () {
    var self = this;

    var onStreamInit = function (stream) {
        self.stream = stream;
        self.sourceNode = self.audioContext.createMediaStreamSource(stream);
        self.sourceNode.connect(self.scriptProcessorNode);
        self.sourceNode.connect(self.monitorNode);
        self.eventTarget.dispatchEvent(new Event("streamReady"));
        return stream;
    }

    var onStreamError = function (e) {
        self.eventTarget.dispatchEvent(new ErrorEvent("streamError", {error: e}));
    }

    var constraints = {audio: this.config.streamOptions};

    if (this.stream) {
        this.eventTarget.dispatchEvent(new Event("streamReady"));
        return Promise.resolve(this.stream);
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return navigator.mediaDevices.getUserMedia(constraints).then(onStreamInit, onStreamError);
    }

    if (navigator.getUserMedia) {
        return new Promise(function (resolve, reject) {
            navigator.getUserMedia(constraints, resolve, reject);
        }).then(onStreamInit, onStreamError);
    }
};

AudioRecorder.prototype.pause = function () {
    if (this.state === "recording") {
        this.state = "paused";
        this.eventTarget.dispatchEvent(new Event('pause'));
    }
};

AudioRecorder.prototype.removeEventListener = function (type, listener, useCapture) {
    this.eventTarget.removeEventListener(type, listener, useCapture);
};

AudioRecorder.prototype.resume = function () {
    if (this.state === "paused") {
        this.state = "recording";
        this.eventTarget.dispatchEvent(new Event('resume'));
    }
};

AudioRecorder.prototype.setMonitorGain = function (gain) {
    this.monitorNode.gain.value = gain;
};

AudioRecorder.prototype.start = function () {
    if (this.state === "inactive" && this.stream) {
        var self = this;
        this.encoder = new OpusEncoder(this.config);
        this.encoder.onPackageEncoded = function (package) {
            self.streamPage(package);
        };

        // First buffer can contain old data. Don't encode it.
        this.encodeBuffers = function () {
            delete this.encodeBuffers;
        };

        this.state = "recording";
        this.monitorNode.connect(this.audioContext.destination);
        this.scriptProcessorNode.connect(this.audioContext.destination);
        this.eventTarget.dispatchEvent(new Event('start'));
    }
};

AudioRecorder.prototype.stop = function () {
    if (this.state !== "inactive") {
        this.state = "inactive";
        this.monitorNode.disconnect();
        this.scriptProcessorNode.disconnect();

        if (!this.config.leaveStreamOpen) {
            this.clearStream();
        }

        this.encoder.done();
    }
};

AudioRecorder.prototype.streamPage = function (page) {
    if (page === null) {
        this.eventTarget.dispatchEvent(new Event('stop'));
    } else {
        this.eventTarget.dispatchEvent(new CustomEvent('dataAvailable', {
            detail: page
        }));
    }
};

if (typeof module !== 'undefined') {
    module.exports = AudioRecorder;
}