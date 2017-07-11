

function LiveAudioPlayer() {
    
    var context = new AudioContext();
    this.context = context;

    var self = this;

    var scriptNode = context.createScriptProcessor(1024, 1, 1);
    scriptNode.onaudioprocess = function (e) {
        var outputData = e.outputBuffer.getChannelData(0);
        self.bufferList.loadDataTo(outputData);
    };
    scriptNode.connect(context.destination);

    this.bufferList = new AudioBufferList();
    this.decoder = new OpusDecoder({
        outputBufferSampleRate: context.sampleRate
    });
}

LiveAudioPlayer.prototype = {

    putAudio: function (audio) {
        if (this.play) {
            var decodedAudio = this.decoder.decode(audio);
            this.bufferList.putData(decodedAudio);
        }
    },

    stop: function () {

    },

    resume: function () {

    }
};