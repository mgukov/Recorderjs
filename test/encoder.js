var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require("sinon-chai");

chai.use(sinonChai);
var should = chai.should();
var expect = chai.expect;


describe('encoder', function() {

  var OpusEncoder = require('../dist/encoder.min');
  var sandbox = sinon.sandbox.create();
  var _opus_encoder_create_spy;
  var _opus_encoder_ctl_spy;
  var _speex_resampler_process_interleaved_float_spy;
  var _speex_resampler_init_spy;
  var _opus_encode_float_spy;

  function getPacket(page, packetNumber){
    var dataView = new DataView(page.buffer);
    var packetTableLength = dataView.getUint8( 26, true );
    var packetLength = dataView.getUint8( 27 + packetNumber, true );
    return page.slice(27 + packetTableLength, 27 + packetTableLength + packetLength);
  }

  function getUTF8String(data) {
    return String.fromCharCode.apply(null, data);
  }

  beforeEach(function(){
    global.postMessage = sandbox.stub();
    global.close = sandbox.stub();
    _opus_encoder_create_spy = sandbox.spy(OpusEncoder, '_opus_encoder_create');
    _opus_encoder_ctl_spy = sandbox.spy(OpusEncoder, '_opus_encoder_ctl');
    _speex_resampler_process_interleaved_float_spy = sandbox.spy(OpusEncoder, '_speex_resampler_process_interleaved_float');
    _speex_resampler_init_spy = sandbox.spy(OpusEncoder, '_speex_resampler_init');
    _opus_encode_float_spy = sandbox.spy(OpusEncoder, '_opus_encode_float');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should initialize config', function () {
    var encoder = new OpusEncoder({
      originalSampleRate: 44100
    });

    expect(encoder).to.have.property('numberOfChannels', 1);
    expect(encoder).to.have.property('encoderSampleRate', 48000);
    expect(encoder).to.have.property('maxBuffersPerPage', 40);
    expect(encoder).to.have.property('encoderApplication', 2049);
    expect(encoder).to.have.property('encoderFrameSize', 60);
    expect(encoder).to.have.property('bufferLength', 4096);
    expect(encoder).to.have.property('resampleQuality', 3);
    expect(encoder).to.have.property('originalSampleRate', 44100);
  });

  it('should initialize encoder', function () {
    var encoder = new OpusEncoder({
      originalSampleRate: 44100
    });

    expect(_opus_encoder_create_spy).to.have.been.calledOnce;
    expect(_opus_encoder_ctl_spy).not.to.have.been.called;
  });

  it('should configure bitRate', function () {
    var encoder = new OpusEncoder({
      originalSampleRate: 44100,
      bitRate: 16000
    });

    expect(_opus_encoder_ctl_spy).to.have.been.calledWith(encoder.encoder, 4002, sinon.match.any);
  });

  it('should configure compexity', function () {
    var encoder = new OpusEncoder({
      originalSampleRate: 44100,
      encoderComplexity: 10
    });

    expect(_opus_encoder_ctl_spy).to.have.been.calledWith(encoder.encoder, 4010, sinon.match.any);
  });

  it('should default input sample rate field to originalSampleRate', function (done) {
    var pageBufferCount = 0;
    global.postMessage = function(page){
      pageBufferCount++;

      // First Page
      if (pageBufferCount == 1) {
        var pageData = getPacket(page);
        var dataView = new DataView(pageData.buffer);
        expect(dataView.getUint32(12, true)).to.equal(44100);
        done();
      }
    }

    new OpusEncoder({
      originalSampleRate: 44100
    });

  });

  it('should override input sample rate field', function (done) {
    var pageBufferCount = 0;
    global.postMessage = function(page){
      pageBufferCount++;

      // First Page
      if (pageBufferCount == 1) {
        var pageData = getPacket(page, 1);
        var dataView = new DataView(pageData.buffer);
        expect(dataView.getUint32(12, true)).to.equal(16000);
        done();
      }
    }

    new OpusEncoder({
      originalSampleRate: 44100,
      originalSampleRateOverride: 16000
    });

  });

  it('should have vendor \'RecorderJS\' in the second page', function (done) {
    var pageBufferCount = 0;
    global.postMessage = function(page){
      pageBufferCount++;

      // Second Page
      if (pageBufferCount == 2) {
        var pageData = getPacket(page, 1);
        var dataView = new DataView(pageData.buffer);
        var vendorLength = dataView.getUint8(8, true);
        var vendorData = pageData.subarray(12, 12 + vendorLength);
        expect(getUTF8String(vendorData)).to.equal('RecorderJS');
        done();
      }
    }

    new OpusEncoder({
      originalSampleRate: 44100
    });
  });

});
