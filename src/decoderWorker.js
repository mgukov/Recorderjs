
function OpusDecoder(config) {

    console.log('OpusDecoder created');

    this.bufferLength = config.bufferLength || 4096;
    this.decoderSampleRate = config.decoderSampleRate || 24000;
    this.outputBufferSampleRate = config.outputBufferSampleRate || 44100;
    this.resampleQuality = config.resampleQuality || 3;
    this.outputBuffers = [];

    this.numberOfChannels = 1;
    this.init();
};

OpusDecoder.prototype.init = function () {
    this.initCodec();
    this.initResampler();
};

OpusDecoder.prototype.initCodec = function () {

    if (this.decoder) {
        _opus_decoder_destroy(this.decoder);
        _free(this.decoderBufferPointer);
        _free(this.decoderOutputLengthPointer);
        _free(this.decoderOutputPointer);
    }

    var errReference = _malloc(4);
    this.decoder = _opus_decoder_create(this.decoderSampleRate, this.numberOfChannels, errReference);
    _free(errReference);

    this.decoderBufferMaxLength = 4000;
    this.decoderBufferPointer = _malloc(this.decoderBufferMaxLength);
    this.decoderBuffer = HEAPU8.subarray(this.decoderBufferPointer, this.decoderBufferPointer + this.decoderBufferMaxLength);
    this.decoderBufferIndex = 0;

    this.decoderOutputLengthPointer = _malloc(4);
    this.decoderOutputMaxLength = this.decoderSampleRate * this.numberOfChannels * 120 / 1000; // Max 120ms frame size
    this.decoderOutputPointer = _malloc(this.decoderOutputMaxLength * 4); // 4 bytes per sample
};

OpusDecoder.prototype.initResampler = function () {

    if (this.resampler) {
        _speex_resampler_destroy(this.resampler);
        _free(this.resampleOutputLengthPointer);
        _free(this.resampleOutputBufferPointer);
    }

    var errLocation = _malloc(4);
    this.resampler = _speex_resampler_init(this.numberOfChannels, this.decoderSampleRate, this.outputBufferSampleRate, this.resampleQuality, errLocation);
    _free(errLocation);

    this.resampleOutputLengthPointer = _malloc(4);
    this.resampleOutputMaxLength = Math.ceil(this.decoderOutputMaxLength * this.outputBufferSampleRate / this.decoderSampleRate);
    this.resampleOutputBufferPointer = _malloc(this.resampleOutputMaxLength * 4); // 4 bytes per sample
};

//OpusDecoder.prototype.sendToOutputBuffers = function (buffers) {
//    self.postMessage(buffers, [buffers.buffer]);
//};

OpusDecoder.prototype.decode = function (typedArray) {

    this.decoderBuffer.set(typedArray, 0);

    var outputSampleLength = _opus_decode_float(this.decoder, this.decoderBufferPointer, typedArray.length, this.decoderOutputPointer, this.decoderOutputMaxLength, 0);
    HEAP32[this.decoderOutputLengthPointer >> 2] = outputSampleLength;

    var resampledLength = Math.ceil(outputSampleLength * this.outputBufferSampleRate / this.decoderSampleRate);
    HEAP32[this.resampleOutputLengthPointer >> 2] = resampledLength;
    _speex_resampler_process_interleaved_float(this.resampler, this.decoderOutputPointer, this.decoderOutputLengthPointer, this.resampleOutputBufferPointer, this.resampleOutputLengthPointer);

    var outData = HEAPF32.subarray(this.resampleOutputBufferPointer >> 2, (this.resampleOutputBufferPointer >> 2) + resampledLength * this.numberOfChannels);
    //this.sendToOutputBuffers(outData);
    
    return new Float32Array(outData);
};