
var OpusEncoder = function (config) {

    console.log('OpusEncoder init with config');

    this.numberOfChannels = config.numberOfChannels || 1;
    this.originalSampleRate = config.originalSampleRate;
    this.originalSampleRateOverride = config.originalSampleRateOverride;
    this.encoderSampleRate = config.encoderSampleRate || 48000;
    this.maxBuffersPerPage = config.maxBuffersPerPage || 40; // Limit latency for streaming
    this.encoderApplication = config.encoderApplication || 2049; // 2048 = Voice, 2049 = Full Band Audio, 2051 = Restricted Low Delay
    this.encoderFrameSize = config.encoderFrameSize || 60; // 60ms frame
    this.encoderComplexity = config.encoderComplexity; // Value between 0 and 10 inclusive. 10 being highest quality.
    this.bufferLength = config.bufferLength || 4096;
    this.resampleQuality = config.resampleQuality || 3; // Value between 0 and 10 inclusive. 10 being highest quality.
    this.bitRate = config.bitRate;

    this.pageIndex = 0;
    this.granulePosition = 0;
    this.segmentData = new Uint8Array(65025); // Maximum length of data
    this.segmentDataIndex = 0;
    this.segmentTable = new Uint8Array(255); // Maximum data segments
    this.segmentTableIndex = 0;
    this.buffersInPage = 0;
    this.serial = Math.floor(Math.random() * Math.pow(2, 32));

    this.initCodec();
    this.initResampler();


    console.log('OpusEncoder options');

    console.log('OutFrameSize: ' + this.encoderFrameSize);
    console.log('OutSamplesPerChannel: ' + this.encoderSamplesPerChannel);
    console.log('ResampleSamplesPerChannel: ' + this.resampleSamplesPerChannel);

    console.log('OriginalSampleRate: ' + this.originalSampleRate);
    console.log('OutSampleRate: ' + this.encoderSampleRate);

    console.log('OpusEncoder init successed');
};

OpusEncoder._opus_encoder_create = _opus_encoder_create;
OpusEncoder._opus_encoder_ctl = _opus_encoder_ctl;
OpusEncoder._speex_resampler_process_interleaved_float = _speex_resampler_process_interleaved_float;
OpusEncoder._speex_resampler_init = _speex_resampler_init;
OpusEncoder._opus_encode_float = _opus_encode_float;
OpusEncoder._free = _free;
OpusEncoder._malloc = _malloc;

OpusEncoder.prototype.initCodec = function () {
    var errLocation = OpusEncoder._malloc(4);
    this.encoder = OpusEncoder._opus_encoder_create(this.encoderSampleRate, this.numberOfChannels, this.encoderApplication, errLocation);
    OpusEncoder._free(errLocation);

    if (this.bitRate) {
        var bitRateLocation = OpusEncoder._malloc(4);
        HEAP32[bitRateLocation >> 2] = this.bitRate;
        OpusEncoder._opus_encoder_ctl(this.encoder, 4002, bitRateLocation);
        OpusEncoder._free(bitRateLocation);
    }

    if (this.encoderComplexity) {
        var encoderComplexityLocation = OpusEncoder._malloc(4);
        HEAP32[encoderComplexityLocation >> 2] = this.encoderComplexity;
        OpusEncoder._opus_encoder_ctl(this.encoder, 4010, encoderComplexityLocation);
        OpusEncoder._free(encoderComplexityLocation);
    }

    this.encoderSamplesPerChannel = this.encoderSampleRate * this.encoderFrameSize / 1000;
    this.encoderSamplesPerChannelPointer = OpusEncoder._malloc(4);
    HEAP32[this.encoderSamplesPerChannelPointer >> 2] = this.encoderSamplesPerChannel;

    this.encoderBufferLength = this.encoderSamplesPerChannel * this.numberOfChannels;
    this.encoderBufferPointer = OpusEncoder._malloc(this.encoderBufferLength * 4); // 4 bytes per sample
    this.encoderBuffer = HEAPF32.subarray(this.encoderBufferPointer >> 2, (this.encoderBufferPointer >> 2) + this.encoderBufferLength);

    this.encoderOutputMaxLength = 4000;
    this.encoderOutputPointer = OpusEncoder._malloc(this.encoderOutputMaxLength);
    this.encoderOutputBuffer = HEAPU8.subarray(this.encoderOutputPointer, this.encoderOutputPointer + this.encoderOutputMaxLength);
};


OpusEncoder.prototype.initResampler = function () {
    var errLocation = OpusEncoder._malloc(4);
    this.resampler = OpusEncoder._speex_resampler_init(this.numberOfChannels, this.originalSampleRate, this.encoderSampleRate, this.resampleQuality, errLocation);
    OpusEncoder._free(errLocation);

    this.resampleBufferIndex = 0;
    this.resampleSamplesPerChannel = this.originalSampleRate * this.encoderFrameSize / 1000;
    this.resampleSamplesPerChannelPointer = OpusEncoder._malloc(4);
    HEAP32[this.resampleSamplesPerChannelPointer >> 2] = this.resampleSamplesPerChannel;

    this.resampleBufferLength = this.resampleSamplesPerChannel * this.numberOfChannels;
    this.resampleBufferPointer = OpusEncoder._malloc(this.resampleBufferLength * 4); // 4 bytes per sample
    this.resampleBuffer = HEAPF32.subarray(this.resampleBufferPointer >> 2, (this.resampleBufferPointer >> 2) + this.resampleBufferLength);
};


OpusEncoder.prototype.encode = function (buffers) {

    var samples = buffers[0];
    var sampleIndex = 0;

    while (sampleIndex < samples.length) {

        var lengthToCopy = Math.min(this.resampleBufferLength - this.resampleBufferIndex, samples.length - sampleIndex);
        this.resampleBuffer.set(samples.subarray(sampleIndex, sampleIndex + lengthToCopy), this.resampleBufferIndex);
        sampleIndex += lengthToCopy;
        this.resampleBufferIndex += lengthToCopy;

        if (this.resampleBufferIndex === this.resampleBufferLength) {

            OpusEncoder._speex_resampler_process_interleaved_float(this.resampler, this.resampleBufferPointer, this.resampleSamplesPerChannelPointer, this.encoderBufferPointer, this.encoderSamplesPerChannelPointer);
            var packetLength = OpusEncoder._opus_encode_float(this.encoder, this.encoderBufferPointer, this.encoderSamplesPerChannel, this.encoderOutputPointer, this.encoderOutputMaxLength);

            this.resampleBufferIndex = 0;
            this.generatePage(packetLength);
        }
    }
};

OpusEncoder.prototype.done = function (buffers) {
    console.log('OpusEncoder done');
};

OpusEncoder.prototype.generatePage = function (packetLength) {
    var packageData = this.encoderOutputBuffer.slice(0, packetLength);
    this.onPackageEncoded(packageData);
};

OpusEncoder.prototype.onPackageEncoded = function (package) { };

if (typeof module !== 'undefined') {
    module.exports = OpusEncoder;
}